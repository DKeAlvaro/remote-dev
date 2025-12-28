import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRepos } from '../services/github';

function Repos({ token, user, onLogout, serverUrl, serverSecret, onServerConfig }) {
    const navigate = useNavigate();
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        getUserRepos(token)
            .then(setRepos)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [token]);

    const filteredRepos = repos.filter(repo =>
        repo.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (repo.description || '').toLowerCase().includes(search.toLowerCase())
    );

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return date.toLocaleDateString();
    };

    return (
        <>
            <header className="header">
                <div className="header-logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                        <path d="M2 12h20" />
                    </svg>
                    Remote Dev
                </div>
                <div className="header-actions">
                    <span className="status status-connected">
                        <span className="status-dot"></span>
                        Connected
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={onServerConfig}>
                        Disconnect
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={onLogout}>
                        Sign Out
                    </button>
                </div>
            </header>

            <div className="page">
                <div className="page-header">
                    <h1 className="page-title">Your Repositories</h1>
                    <p className="page-subtitle">Select a repository to start making changes</p>
                </div>

                <input
                    type="text"
                    className="input"
                    placeholder="Search repositories..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ marginBottom: '20px' }}
                />

                {loading ? (
                    <div className="empty-state">
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                    </div>
                ) : filteredRepos.length === 0 ? (
                    <div className="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <p>No repositories found</p>
                    </div>
                ) : (
                    <div className="card">
                        <div className="list">
                            {filteredRepos.map(repo => (
                                <div
                                    key={repo.id}
                                    className="list-item repo-item"
                                    onClick={() => navigate(`/repo/${repo.owner.login}/${repo.name}`)}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div className="repo-name">{repo.full_name}</div>
                                        {repo.description && (
                                            <div className="repo-description">{repo.description}</div>
                                        )}
                                        <div className="repo-meta">
                                            {repo.language && (
                                                <span>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        width: '12px',
                                                        height: '12px',
                                                        borderRadius: '50%',
                                                        background: getLanguageColor(repo.language)
                                                    }}></span>
                                                    {repo.language}
                                                </span>
                                            )}
                                            <span>Updated {formatDate(repo.updated_at)}</span>
                                            {repo.private && (
                                                <span style={{ color: 'var(--color-warning)' }}>
                                                    🔒 Private
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function getLanguageColor(language) {
    const colors = {
        JavaScript: '#f1e05a',
        TypeScript: '#3178c6',
        Python: '#3572A5',
        Java: '#b07219',
        Go: '#00ADD8',
        Rust: '#dea584',
        Ruby: '#701516',
        PHP: '#4F5D95',
        CSS: '#563d7c',
        HTML: '#e34c26',
        Lua: '#000080',
        'C++': '#f34b7d',
        C: '#555555',
        'C#': '#178600'
    };
    return colors[language] || '#8b949e';
}

export default Repos;
