import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Callback from './pages/Callback';
import Repos from './pages/Repos';
import RepoDetail from './pages/RepoDetail';
import Connect from './pages/Connect';
import { getCurrentUser } from './services/github';

function App() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('github_token'));
    const [loading, setLoading] = useState(true);

    // Server connection state
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('server_url') || '');
    const [serverSecret, setServerSecret] = useState(localStorage.getItem('server_secret') || '');
    const [isServerConfigured, setIsServerConfigured] = useState(false);

    useEffect(() => {
        // Check if GitHub token is valid
        if (token) {
            getCurrentUser(token)
                .then(user => {
                    setUser(user);
                    setLoading(false);
                })
                .catch(() => {
                    // Token is invalid
                    localStorage.removeItem('github_token');
                    setToken(null);
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        // Check if server is configured
        setIsServerConfigured(Boolean(serverUrl && serverSecret));
    }, [serverUrl, serverSecret]);

    const handleLogin = (newToken) => {
        localStorage.setItem('github_token', newToken);
        setToken(newToken);
    };

    const handleLogout = () => {
        localStorage.removeItem('github_token');
        setToken(null);
        setUser(null);
    };

    const handleServerConfig = (url, secret) => {
        localStorage.setItem('server_url', url);
        localStorage.setItem('server_secret', secret);
        setServerUrl(url);
        setServerSecret(secret);
    };

    if (loading) {
        return (
            <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="app">
            <Routes>
                <Route
                    path="/"
                    element={
                        !token ? (
                            <Login onLogin={handleLogin} />
                        ) : !isServerConfigured ? (
                            <Connect onConnect={handleServerConfig} />
                        ) : (
                            <Repos
                                token={token}
                                user={user}
                                onLogout={handleLogout}
                                serverUrl={serverUrl}
                                serverSecret={serverSecret}
                                onServerConfig={() => {
                                    localStorage.removeItem('server_url');
                                    localStorage.removeItem('server_secret');
                                    setServerUrl('');
                                    setServerSecret('');
                                }}
                            />
                        )
                    }
                />
                <Route
                    path="/callback"
                    element={<Callback onLogin={handleLogin} />}
                />
                <Route
                    path="/repo/:owner/:repo"
                    element={
                        token && isServerConfigured ? (
                            <RepoDetail
                                token={token}
                                user={user}
                                serverUrl={serverUrl}
                                serverSecret={serverSecret}
                            />
                        ) : (
                            <Navigate to="/" replace />
                        )
                    }
                />
            </Routes>
        </div>
    );
}

export default App;
