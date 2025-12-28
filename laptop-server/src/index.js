import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { GitManager } from './git.js';
import { GeminiRunner } from './gemini.js';
import { TunnelManager } from './tunnel.js';
import { WebSocketHandler } from './websocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
    port: parseInt(process.env.PORT || '3001'),
    githubToken: process.env.GITHUB_TOKEN,
    sharedSecret: process.env.SHARED_SECRET,
    ngrokToken: process.env.NGROK_AUTH_TOKEN,
    reposDir: path.resolve(process.env.REPOS_DIR || './repos')
};

// Validate config
if (!config.githubToken) {
    console.error('❌ GITHUB_TOKEN is required in .env');
    process.exit(1);
}
if (!config.sharedSecret) {
    console.error('❌ SHARED_SECRET is required in .env');
    process.exit(1);
}

// Initialize services
const gitManager = new GitManager(config.reposDir);
const geminiRunner = new GeminiRunner();
const tunnelManager = new TunnelManager(config.ngrokToken);

// Express app
const app = express();
app.use(express.json());

// CORS for web app
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

// Info endpoint (requires auth header)
app.get('/info', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${config.sharedSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({
        geminiAvailable: true,
        reposDir: config.reposDir,
        tunnelUrl: tunnelManager.getUrl()
    });
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket message handlers
const wsHandlers = {
    /**
     * Clone or pull a repository and start Gemini session
     */
    clone_repo: async ({ owner, repo }, onProgress) => {
        onProgress({ stage: 'cloning', message: `Cloning ${owner}/${repo}...` });
        const result = await gitManager.cloneOrPull(owner, repo, config.githubToken);
        onProgress({ stage: 'cloned', message: `Repository ${result.action}` });

        // Start Gemini CLI session immediately (pre-warm)
        const repoPath = gitManager.getRepoPath(owner, repo);
        onProgress({ stage: 'starting_gemini', message: 'Starting Gemini CLI (this may take a moment)...' });

        try {
            await geminiRunner.startSession(repoPath, (output) => {
                onProgress({ stage: 'gemini_output', ...output });
            });
            onProgress({ stage: 'ready', message: 'Gemini CLI ready! You can now send commands.' });
        } catch (err) {
            onProgress({ stage: 'gemini_error', message: `Gemini CLI error: ${err.message}` });
        }

        return result;
    },

    /**
     * Get commit history
     */
    get_commits: async ({ owner, repo, limit = 20 }) => {
        return await gitManager.getCommitHistory(owner, repo, limit);
    },

    /**
     * Get diff for a commit
     */
    get_diff: async ({ owner, repo, commitHash }) => {
        return await gitManager.getCommitDiff(owner, repo, commitHash);
    },

    /**
     * Execute Gemini CLI command
     */
    execute_command: async ({ owner, repo, prompt }, onProgress) => {
        const repoPath = gitManager.getRepoPath(owner, repo);

        onProgress({ stage: 'starting', message: 'Starting Gemini Execution...' });

        try {
            // Execute and wait for full completion
            // sendPrompt now wraps execute() which returns a Promise that resolves when the process exits
            const result = await geminiRunner.sendPrompt(repoPath, prompt, (output) => {
                onProgress({ stage: 'running', ...output });
            });

            if (result.success) {
                onProgress({ stage: 'done', message: 'Execution finished. Ready to commit.' });
                return { success: true, message: 'Gemini execution complete' };
            } else {
                onProgress({ stage: 'error', message: 'Gemini finished with errors.' });
                return { success: false, error: 'Process exited with non-zero code' };
            }

        } catch (err) {
            console.error('Gemini error:', err);
            onProgress({ stage: 'error', message: `Execution failed: ${err.message}` });
            return { success: false, error: err.message };
        }
    },

    /**
     * Commit and push current changes
     */
    commit_changes: async ({ owner, repo, message }, onProgress) => {
        onProgress({ stage: 'committing', message: 'Committing changes...' });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const commitMessage = message || `[Remote Dev] Changes at ${timestamp}`;

        const commitResult = await gitManager.commitAndPush(
            owner, repo, commitMessage, config.githubToken
        );

        onProgress({ stage: 'done', message: 'Changes pushed successfully!' });
        return commitResult;
    },

    /**
     * Rollback to a specific commit
     */
    rollback: async ({ owner, repo, commitHash }, onProgress) => {
        onProgress({ stage: 'rolling_back', message: `Rolling back to ${commitHash}...` });
        const result = await gitManager.rollbackToCommit(owner, repo, commitHash, config.githubToken);
        onProgress({ stage: 'done', message: 'Rollback complete!' });
        return result;
    },

    /**
     * Cancel current Gemini session for a repo
     */
    cancel: async ({ owner, repo }) => {
        const repoPath = gitManager.getRepoPath(owner, repo);
        const cancelled = geminiRunner.cancel(repoPath);
        return { cancelled };
    }
};

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(server, config.sharedSecret, wsHandlers);

// Start server
async function start() {
    console.log('🚀 Remote Dev Server');
    console.log('====================\n');

    // Check Gemini CLI availability
    const geminiAvailable = await geminiRunner.isAvailable();
    if (geminiAvailable) {
        console.log('✅ Gemini CLI detected');
    } else {
        console.log('⚠️  Gemini CLI not found in PATH. Make sure it\'s installed.');
    }

    // Start HTTP server
    server.listen(config.port, () => {
        console.log(`✅ Server running on port ${config.port}`);
    });

    // Start ngrok tunnel if token provided
    if (config.ngrokToken) {
        try {
            await tunnelManager.start(config.port);
        } catch (error) {
            console.log('⚠️  Could not start ngrok tunnel. Running in local mode.');
            console.log(`   Local URL: http://localhost:${config.port}`);
        }
    } else {
        console.log('\n⚠️  No NGROK_AUTH_TOKEN provided. Running in local mode only.');
        console.log(`   Local URL: http://localhost:${config.port}`);
    }

    console.log('\n📋 Waiting for connections...\n');
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await tunnelManager.stop();
    server.close();
    process.exit(0);
});

start().catch(console.error);
