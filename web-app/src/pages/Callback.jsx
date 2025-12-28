import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * OAuth callback page - handles GitHub's redirect after authorization
 * 
 * NOTE: GitHub's OAuth flow requires a backend to exchange the code for an access token.
 * For this demo, we'll use a simple workaround with a GitHub OAuth proxy or
 * you can set up your own backend endpoint.
 * 
 * For a quick solution, you can use: https://github.com/nickel-dev/oauth-proxy
 * Or implement a simple serverless function.
 */
function Callback({ onLogin }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState(null);
    const [manualToken, setManualToken] = useState('');

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
            setError(`GitHub authorization failed: ${error}`);
            return;
        }

        if (code) {
            // In a production app, you would exchange this code for an access token
            // via your backend. For now, we'll show instructions for manual token entry.
            setError('CODE_RECEIVED');
        }
    }, [searchParams, navigate, onLogin]);

    const handleManualToken = (e) => {
        e.preventDefault();
        if (manualToken.trim()) {
            onLogin(manualToken.trim());
            navigate('/');
        }
    };

    if (error === 'CODE_RECEIVED') {
        return (
            <div className="login-page">
                <div className="card login-card" style={{ maxWidth: '500px' }}>
                    <div className="card-body">
                        <h2 style={{ marginBottom: '16px' }}>Almost there!</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                            To complete the setup, you need to use a <strong>Personal Access Token</strong> instead.
                            This is simpler and doesn't require a backend server.
                        </p>

                        <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>How to get a token:</h3>
                            <ol style={{ color: 'var(--color-text-secondary)', fontSize: '13px', paddingLeft: '20px' }}>
                                <li style={{ marginBottom: '8px' }}>
                                    Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>GitHub Settings → Tokens</a>
                                </li>
                                <li style={{ marginBottom: '8px' }}>Click "Generate new token (classic)"</li>
                                <li style={{ marginBottom: '8px' }}>Select scope: <code style={{ background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px' }}>repo</code></li>
                                <li>Copy the generated token</li>
                            </ol>
                        </div>

                        <form onSubmit={handleManualToken}>
                            <input
                                type="password"
                                className="input"
                                placeholder="Paste your Personal Access Token"
                                value={manualToken}
                                onChange={(e) => setManualToken(e.target.value)}
                                style={{ marginBottom: '12px' }}
                            />
                            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                                Continue
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="login-page">
                <div className="card login-card">
                    <div className="card-body">
                        <h2 style={{ color: 'var(--color-error)', marginBottom: '16px' }}>Error</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>{error}</p>
                        <button className="btn btn-primary" onClick={() => navigate('/')}>
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="card login-card">
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div className="spinner"></div>
                    <p>Completing authorization...</p>
                </div>
            </div>
        </div>
    );
}

export default Callback;
