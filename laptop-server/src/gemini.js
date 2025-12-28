import { spawn } from 'child_process';
import path from 'path';

/**
 * Gemini CLI wrapper for executing AI-powered code changes
 */
export class GeminiRunner {
    constructor() {
        this.activeProcess = null;
    }

    /**
     * Execute a Gemini CLI command in a repository
     * @param {string} repoPath - Path to the repository
     * @param {string} prompt - The instruction/prompt for Gemini
     * @param {function} onOutput - Callback for streaming output
     * @returns {Promise<{success: boolean, output: string}>}
     */
    async execute(repoPath, prompt, onOutput = () => { }) {
        return new Promise((resolve, reject) => {
            // Use gemini CLI - adjust command based on your installation
            // Common commands: 'gemini', 'gemini-cli', or full path
            const geminiCmd = process.platform === 'win32' ? 'gemini.cmd' : 'gemini';

            let fullOutput = '';
            let errorOutput = '';

            // Spawn Gemini CLI process
            this.activeProcess = spawn(geminiCmd, [prompt], {
                cwd: repoPath,
                shell: true,
                env: {
                    ...process.env,
                    // Ensure non-interactive mode if supported
                    CI: 'true'
                }
            });

            this.activeProcess.stdout.on('data', (data) => {
                const text = data.toString();
                fullOutput += text;
                onOutput({ type: 'stdout', text });
            });

            this.activeProcess.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                onOutput({ type: 'stderr', text });
            });

            this.activeProcess.on('close', (code) => {
                this.activeProcess = null;

                if (code === 0) {
                    resolve({
                        success: true,
                        output: fullOutput,
                        exitCode: code
                    });
                } else {
                    resolve({
                        success: false,
                        output: fullOutput,
                        error: errorOutput,
                        exitCode: code
                    });
                }
            });

            this.activeProcess.on('error', (err) => {
                this.activeProcess = null;
                reject(new Error(`Failed to start Gemini CLI: ${err.message}`));
            });
        });
    }

    /**
     * Cancel the currently running Gemini process
     */
    cancel() {
        if (this.activeProcess) {
            this.activeProcess.kill('SIGTERM');
            this.activeProcess = null;
            return true;
        }
        return false;
    }

    /**
     * Check if Gemini CLI is available
     */
    async isAvailable() {
        return new Promise((resolve) => {
            const geminiCmd = process.platform === 'win32' ? 'gemini.cmd' : 'gemini';
            const proc = spawn(geminiCmd, ['--version'], { shell: true });

            proc.on('close', (code) => {
                resolve(code === 0);
            });

            proc.on('error', () => {
                resolve(false);
            });
        });
    }
}
