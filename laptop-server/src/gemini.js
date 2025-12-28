import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export class GeminiRunner extends EventEmitter {
    constructor() {
        super();
        this.activeProcess = null;
    }

    async execute(repoPath, prompt, onOutput = () => { }) {
        console.log(`\n\n════════════════════════════════════════════════════════════`);
        console.log(`🤖 GEMINI CLI EXECUTION (DIRECT MODE)`);
        console.log(`📂 Repo:   ${repoPath}`);
        console.log(`📝 Prompt: ${prompt}`);
        console.log(`════════════════════════════════════════════════════════════\n`);

        return new Promise((resolve, reject) => {
            let fullOutput = '';

            // DIRECT EXECUTION: gemini "prompt"
            // We removed -p based on the user's CLI help output indicating it's deprecated/conflicting
            const isWindows = process.platform === 'win32';

            // On Windows, use shell: true to find 'gemini' in PATH, but pass args as array
            const safePrompt = String(prompt);

            const proc = spawn('gemini', [safePrompt], {
                cwd: repoPath,
                shell: true, // Required on Windows to find executable in PATH
                env: { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            this.activeProcess = proc;

            proc.stdout.on('data', (data) => {
                const text = data.toString();
                fullOutput += text;
                process.stdout.write(text); // Mirror to server terminal
                onOutput({ type: 'stdout', text });
            });

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                // Filter "Loaded cached credentials"
                if (!text.includes('Loaded cached credentials')) {
                    process.stderr.write(text);
                }
                onOutput({ type: 'stderr', text });
            });

            proc.on('close', (code) => {
                console.log(`\n✅ Gemini finished (Code: ${code})`);
                this.activeProcess = null;
                resolve({
                    success: code === 0,
                    output: fullOutput,
                    exitCode: code
                });
            });

            proc.on('error', (err) => {
                console.error('❌ Failed to start process:', err);
                this.activeProcess = null;
                reject(err);
            });
        });
    }

    // Required for index.js compatibility
    async startSession(repoPath, onOutput = () => { }) {
        console.log(`\n📂 Active Repository switched to: ${repoPath}`);
        onOutput({ type: 'info', text: `Ready for prompts in ${repoPath}` });
        return { ready: true };
    }

    async sendPrompt(repoPath, prompt, onOutput = () => { }) {
        return this.execute(repoPath, prompt, onOutput);
    }

    cancel(repoPath) {
        if (this.activeProcess) {
            console.log('🛑 Cancel requested. Killing process.');
            this.activeProcess.kill();
            this.activeProcess = null;
            return true;
        }
        return false;
    }

    async isAvailable() {
        return new Promise((resolve) => {
            const proc = spawn('gemini', ['--version'], { shell: true, stdio: 'ignore' });
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
            setTimeout(() => {
                if (proc && !proc.killed) proc.kill();
                resolve(false);
            }, 2000);
        });
    }
}
