import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export class GeminiRunner extends EventEmitter {
    constructor() {
        super();
        this.histories = new Map();
    }

    async execute(repoPath, prompt, onOutput = () => { }) {
        console.log(`\n\n════════════════════════════════════════════════════════════`);
        console.log(`🤖 GEMINI CLI EXECUTION (via PowerShell)`);
        console.log(`📂 Repo:   ${repoPath}`);
        console.log(`📝 Prompt: ${prompt}`);
        console.log(`════════════════════════════════════════════════════════════\n`);

        if (!this.histories.has(repoPath)) {
            this.histories.set(repoPath, []);
        }
        const history = this.histories.get(repoPath);

        let fullPrompt = "";
        if (history.length > 0) {
            fullPrompt += "PREVIOUS MESSAGES:\n";
            history.forEach(msg => {
                fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}\n`;
            });
            fullPrompt += "\nCURRENT REQUEST:\n";
        }
        fullPrompt += prompt;

        history.push({ role: 'user', text: prompt });

        return new Promise((resolve, reject) => {
            let fullOutput = '';

            // Write to temp file
            const tempFileName = `.gemini_input_${Date.now()}.txt`;
            const tempFilePath = path.join(repoPath, tempFileName);

            try {
                fs.writeFileSync(tempFilePath, fullPrompt);
            } catch (err) {
                return reject(err);
            }

            // USE POWERSHELL FOR ROBUST PIPING
            // Get-Content "file" | gemini --yolo
            const psCommand = `Get-Content "${tempFileName}" | gemini --yolo`;

            const proc = spawn('powershell', ['-Command', psCommand], {
                cwd: repoPath,
                env: { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            this.activeProcess = proc;

            proc.stdout.on('data', (data) => {
                const text = data.toString();
                fullOutput += text; // Keep for history even if we filter display

                // Filter noise
                if (text.includes('YOLO mode is enabled') || text.includes('Loaded cached credentials')) {
                    return;
                }

                process.stdout.write(text);
                onOutput({ type: 'stdout', text });
            });

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                // Strict noise filtering
                if (!text.includes('Loaded cached credentials') &&
                    !text.includes('YOLO mode is enabled') &&
                    !text.includes('Passing args to a child process')) {

                    process.stderr.write(text);
                    onOutput({ type: 'stderr', text });
                }
            });

            proc.on('close', (code) => {
                console.log(`\n✅ Gemini finished (Code: ${code})`);

                try { fs.unlinkSync(tempFilePath); } catch (e) { }

                if (code === 0 && fullOutput.trim()) {
                    history.push({ role: 'model', text: fullOutput.trim() });
                }

                this.activeProcess = null;
                resolve({
                    success: code === 0,
                    output: fullOutput,
                    exitCode: code
                });
            });

            proc.on('error', (err) => {
                console.error('❌ Failed to start process:', err);
                try { fs.unlinkSync(tempFilePath); } catch (e) { }
                this.activeProcess = null;
                reject(err);
            });
        });
    }

    async startSession(repoPath, onOutput = () => { }) {
        if (!this.histories.has(repoPath)) this.histories.set(repoPath, []);
        onOutput({ type: 'info', text: `Session Ready.` });
        return { ready: true };
    }

    async sendPrompt(repoPath, prompt, onOutput = () => { }) {
        return this.execute(repoPath, prompt, onOutput);
    }

    cancel(repoPath) {
        if (this.activeProcess) {
            this.activeProcess.kill();
            this.activeProcess = null;
            return true;
        }
        return false;
    }

    async isAvailable() { return true; }
}
