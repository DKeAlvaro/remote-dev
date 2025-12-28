import { useState } from 'react';

function Connect({ onConnect }) {
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('server_url') || '');
    const [secret, setSecret] = useState(localStorage.getItem('server_secret') || '');
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setTesting(true);

        try {
            // Test connection to the server
            // Add ngrok-skip-browser-warning to bypass ngrok's interstitial page
            const response = await fetch(`${serverUrl}/health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (!response.ok) {
                throw new Error('Server not responding');
            }

            const data = await response.json();
            if (data.status === 'ok') {
                onConnect(serverUrl, secret);
            } else {
                throw new Error('Invalid server response');
            }
        } catch (err) {
            setError(`Could not connect to server: ${err.message}. Make sure the laptop server is running.`);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="login-page">
            <div className="card connect-panel">
                <div className="card-header">
                    <h2 className="card-title">Connect to Laptop</h2>
                </div>
                <div className="card-body">
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                        Enter your laptop server's URL and shared secret to connect.
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                Server URL
                            </label>
                            <input
                                type="url"
                                className="input"
                                placeholder="https://abc123.ngrok.io"
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                required
                            />
                            <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                The ngrok URL shown when starting the laptop server
                            </p>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                Shared Secret
                            </label>
                            <input
                                type="password"
                                className="input"
                                placeholder="Your SHARED_SECRET from .env"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                required
                            />
                            <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                The secret configured in your laptop server's .env file
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
                            style={{ width: '100%', justifyContent: 'center' }}
                            disabled={testing}
                        >
                            {testing ? (
                                <>
                                    <div className="spinner"></div>
                                    Testing Connection...
                                </>
                            ) : (
                                'Connect'
                            )}
                        </button>
                    </form>

                    <div style={{ marginTop: '32px', padding: '16px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                        <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>How to start the laptop server:</h4>
                        <pre style={{
                            fontSize: '12px',
                            color: 'var(--color-text-secondary)',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace'
                        }}>
                            {`cd laptop-server
npm install
npm start`}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Connect;
