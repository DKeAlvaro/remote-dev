import { useState } from 'react';
import { getCurrentUser } from '../services/github';

function Login({ onLogin }) {
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token.trim()) return;

        setLoading(true);
        setError(null);

        try {
            // Verify the token works by getting user info
            const user = await getCurrentUser(token.trim());
            console.log('Logged in as:', user.login);
            onLogin(token.trim());
        } catch (err) {
            setError('Invalid token. Make sure it has "repo" scope.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="card login-card">
                <div className="card-body">
                    <div className="login-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                            <path d="M9 18c-4.51 2-5-2-7-2" />
                        </svg>
                    </div>

                    <h1 className="login-title">Remote Dev</h1>
                    <p className="login-subtitle">
                        Control your GitHub repositories remotely with AI-powered code changes
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                GitHub Personal Access Token
                            </label>
                            <input
                                type="password"
                                className="input"
                                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                disabled={loading}
                            />
                            <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                Create one at{' '}
                                <a
                                    href="https://github.com/settings/tokens/new?scopes=repo&description=Remote%20Dev"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--color-accent)' }}
                                >
                                    GitHub Settings → Tokens
                                </a>
                                {' '}with <code style={{ background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px' }}>repo</code> scope
                            </p>
                        </div>

                        {error && (
                            <div style={{
                                padding: '12px',
                                background: 'rgba(248, 81, 73, 0.15)',
                                color: 'var(--color-error)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '16px',
                                fontSize: '13px'
                            }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={loading || !token.trim()}
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner"></div>
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                                    </svg>
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;
