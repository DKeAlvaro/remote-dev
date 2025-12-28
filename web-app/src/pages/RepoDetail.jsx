import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRepo, getRepoCommits } from '../services/github';
import { useWebSocket } from '../hooks/useWebSocket';

function RepoDetail({ token, user, serverUrl, serverSecret }) {
    const { owner, repo } = useParams();
    const navigate = useNavigate();

    const [repoData, setRepoData] = useState(null);
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [command, setCommand] = useState('');
    const [executing, setExecuting] = useState(false);
    const [output, setOutput] = useState([]);
    const [status, setStatus] = useState('');
    const [selectedCommit, setSelectedCommit] = useState(null);

    // WebSocket connection
    const ws = useWebSocket(serverUrl, serverSecret);

    // Load repo and commits
    useEffect(() => {
        Promise.all([
            getRepo(token, owner, repo),
            getRepoCommits(token, owner, repo)
        ])
            .then(([repoData, commitsData]) => {
                setRepoData(repoData);
                setCommits(commitsData.map(c => ({
                    hash: c.sha,
                    shortHash: c.sha.substring(0, 7),
                    message: c.commit.message.split('\n')[0],
                    date: c.commit.author.date,
                    author: c.commit.author.name
                })));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [token, owner, repo]);

    // Connect to WebSocket on mount
    useEffect(() => {
        ws.connect();
        return () => ws.disconnect();
    }, []);

    // Handle progress updates
    useEffect(() => {
        const unsubProgress = ws.onMessage('progress', (progress) => {
            setStatus(progress.message || progress.stage);
            if (progress.text) {
                setOutput(prev => [...prev, {
                    type: progress.type || 'stdout',
                    text: progress.text
                }]);
            }
        });

        return () => {
            unsubProgress();
        };
    }, [ws.onMessage]);

    // Clone/pull repo when connected
    useEffect(() => {
        if (ws.isAuthenticated) {
            setStatus('Syncing repository...');
            ws.request('clone_repo', { owner, repo })
                .then(() => setStatus('Repository ready'))
                .catch(err => setStatus(`Error: ${err.message}`));
        }
    }, [ws.isAuthenticated, owner, repo]);

    const handleExecute = async (e) => {
        e.preventDefault();
        console.log('Execute clicked!', { command, executing, isAuthenticated: ws.isAuthenticated });

        if (!command.trim() || executing) {
            console.log('Blocked:', { hasCommand: !!command.trim(), executing });
            return;
        }

        setExecuting(true);
        // Don't clear output - append the user's command to it for history visibility
        setOutput(prev => [...prev, { type: 'stdout', text: `\n> USER: ${command}\n` }]);
        setStatus('Running Gemini CLI...');
        const currentCommand = command;
        setCommand('');

        try {
            console.log('Sending execute_command...', { owner, repo, prompt: currentCommand });
            const result = await ws.request('execute_command', {
                owner,
                repo,
                prompt: currentCommand
            });
            console.log('Result:', result);

            if (result.success) {
                setStatus('Done! Click Push to commit changes.');
            } else {
                setStatus(`Error: ${result.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Execute error:', err);
            setStatus(`Error: ${err.message}`);
        } finally {
            setExecuting(false);
        }
    };

    const handleStop = () => {
        ws.send('cancel', { owner, repo });
        setStatus('Cancelled');
        setExecuting(false);
    };

    const handleCommit = async () => {
        setStatus('Committing and pushing...');
        try {
            const result = await ws.request('commit_changes', { owner, repo });
            if (result.committed) {
                setStatus(`Pushed! Commit: ${result.hash?.substring(0, 7) || 'done'}`);
                // Refresh commits
                const newCommits = await getRepoCommits(token, owner, repo);
                setCommits(newCommits.map(c => ({
                    hash: c.sha,
                    shortHash: c.sha.substring(0, 7),
                    message: c.commit.message.split('\n')[0],
                    date: c.commit.author.date,
                    author: c.commit.author.name
                })));
            } else {
                setStatus(result.message || 'No changes to commit');
            }
        } catch (err) {
            setStatus(`Commit failed: ${err.message}`);
        }
    };


    const handleRollback = async (commitHash) => {
        if (!confirm(`Are you sure you want to rollback to ${commitHash.substring(0, 7)}? This will force-push and rewrite history.`)) {
            return;
        }

        setExecuting(true);
        setStatus('Rolling back...');

        try {
            await ws.request('rollback', { owner, repo, commitHash });
            setStatus('Rollback complete!');

            // Refresh commits
            const newCommits = await getRepoCommits(token, owner, repo);
            setCommits(newCommits.map(c => ({
                hash: c.sha,
                shortHash: c.sha.substring(0, 7),
                message: c.commit.message.split('\n')[0],
                date: c.commit.author.date,
                author: c.commit.author.name
            })));
        } catch (err) {
            setStatus(`Rollback failed: ${err.message}`);
        } finally {
            setExecuting(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    if (loading) {
        return (
            <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <>
            <header className="header">
                <div className="header-logo">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <span>{owner}/{repo}</span>
                </div>
                <div className="header-actions">
                    <span className={`status ${ws.isAuthenticated ? 'status-connected' : 'status-disconnected'}`}>
                        <span className="status-dot"></span>
                        {ws.isAuthenticated ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
            </header>

            <div className="page" style={{ paddingBottom: '100px' }}>
                {/* Status bar */}
                {status && (
                    <div style={{
                        padding: '12px 16px',
                        background: 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        {executing && <div className="spinner"></div>}
                        <span style={{ fontSize: '14px' }}>{status}</span>
                    </div>
                )}

                {/* Terminal output */}
                {output.length > 0 && (
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div className="card-header">
                            <span className="card-title">Output</span>
                            <button className="btn btn-ghost btn-sm" onClick={() => setOutput([])}>Clear</button>
                        </div>
                        <div className="terminal">
                            {output.map((line, i) => {
                                // Improved Markdown Formatter
                                const formatText = (text) => {
                                    if (!text) return null;

                                    // Process line by line
                                    return text.split('\n').map((segment, lineIdx) => {
                                        let content = segment;
                                        let style = {};

                                        // Headers
                                        if (content.match(/^#{1,6}\s/)) {
                                            const level = content.match(/^(#{1,6})/)[0].length;
                                            content = content.replace(/^#{1,6}\s/, '');
                                            style = {
                                                fontWeight: 'bold',
                                                fontSize: `${1.4 - (level * 0.1)}em`,
                                                marginTop: '0.5em',
                                                marginBottom: '0.2em',
                                                display: 'block'
                                            };
                                        }
                                        // Lists (Bulleted)
                                        else if (content.match(/^\s*[\-\*]\s/)) {
                                            content = content.replace(/^\s*[\-\*]\s/, '• ');
                                            style = { paddingLeft: '1em', display: 'block' };
                                        }
                                        // Lists (Numbered)
                                        else if (content.match(/^\s*\d+\.\s/)) {
                                            // Keep the number
                                            style = { paddingLeft: '1em', display: 'block' };
                                        }

                                        // Inline Formatting
                                        // Bold
                                        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                        // Italic
                                        content = content.replace(/\*([^\s].*?)\*/g, '<em>$1</em>'); // distinct from list bullet
                                        // Inline Code
                                        content = content.replace(/(`)(.*?)\1/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 4px; border-radius:3px;">$2</code>');
                                        // Links
                                        content = content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#58a6ff; text-decoration:underline;">$1</a>');

                                        return (
                                            <div
                                                key={lineIdx}
                                                style={style}
                                                dangerouslySetInnerHTML={{ __html: content || '&nbsp;' }}
                                            />
                                        );
                                    });
                                };

                                return (
                                    <div key={i} className={`terminal-line terminal-${line.type}`}>
                                        {formatText(line.text)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Commit history */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Commit History</span>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                                const newCommits = await getRepoCommits(token, owner, repo);
                                setCommits(newCommits.map(c => ({
                                    hash: c.sha,
                                    shortHash: c.sha.substring(0, 7),
                                    message: c.commit.message.split('\n')[0],
                                    date: c.commit.author.date,
                                    author: c.commit.author.name
                                })));
                            }}
                        >
                            Refresh
                        </button>
                    </div>
                    <div className="list">
                        {commits.map((commit, index) => (
                            <div
                                key={commit.hash}
                                className="list-item commit-item"
                                onClick={() => setSelectedCommit(selectedCommit === commit.hash ? null : commit.hash)}
                                style={{
                                    flexDirection: 'column',
                                    alignItems: 'stretch',
                                    cursor: 'pointer',
                                    background: selectedCommit === commit.hash ? 'var(--color-bg-tertiary)' : undefined
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                    <span className="commit-hash">{commit.shortHash}</span>
                                    <span className="commit-message" style={{ flex: 1 }}>{commit.message}</span>
                                    <span className="commit-date">{formatDate(commit.date)}</span>
                                </div>

                                {selectedCommit === commit.hash && index > 0 && (
                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRollback(commit.hash);
                                            }}
                                            disabled={executing}
                                        >
                                            Rollback to this commit
                                        </button>
                                        <a
                                            href={`https://github.com/${owner}/${repo}/commit/${commit.hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-secondary btn-sm"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            View on GitHub
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Command input - fixed at bottom */}
            <div className="command-panel">
                <form onSubmit={handleExecute} className="command-input-wrapper">
                    <input
                        type="text"
                        className="input"
                        placeholder="Be specific: 'Add a dark mode toggle button to the header'"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        disabled={!ws.isAuthenticated}
                    />
                    {executing ? (
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={handleStop}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            </svg>
                            Stop
                        </button>
                    ) : (
                        <>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!command.trim() || !ws.isAuthenticated}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 2L11 13" />
                                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                                </svg>
                                Send
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleCommit}
                                disabled={!ws.isAuthenticated}
                                title="Commit and push all changes"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 19V5M5 12l7-7 7 7" />
                                </svg>
                                Push
                            </button>
                        </>
                    )}
                </form>
                {!ws.isAuthenticated && (
                    <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-warning)' }}>
                        Connecting to laptop server...
                    </p>
                )}
            </div>
        </>
    );
}

export default RepoDetail;
