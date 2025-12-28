/**
 * GitHub API service for authentication and repository access
 */

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;

/**
 * Initiate GitHub OAuth login flow
 */
export function initiateGitHubLogin() {
    const redirectUri = `${window.location.origin}/callback`;
    const scope = 'repo read:user';

    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: scope,
        state: generateState()
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Generate random state for CSRF protection
 */
function generateState() {
    const state = crypto.randomUUID();
    sessionStorage.setItem('github_oauth_state', state);
    return state;
}

/**
 * Validate OAuth state
 */
export function validateState(state) {
    const savedState = sessionStorage.getItem('github_oauth_state');
    sessionStorage.removeItem('github_oauth_state');
    return state === savedState;
}

/**
 * Get current user info
 */
export async function getCurrentUser(token) {
    const response = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to get user info');
    }

    return response.json();
}

/**
 * Get user's repositories
 */
export async function getUserRepos(token, page = 1, perPage = 30) {
    const params = new URLSearchParams({
        sort: 'updated',
        direction: 'desc',
        per_page: perPage.toString(),
        page: page.toString()
    });

    const response = await fetch(`https://api.github.com/user/repos?${params}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to get repositories');
    }

    return response.json();
}

/**
 * Get repository details
 */
export async function getRepo(token, owner, repo) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to get repository');
    }

    return response.json();
}

/**
 * Get repository commits from GitHub API
 */
export async function getRepoCommits(token, owner, repo, page = 1, perPage = 20) {
    const params = new URLSearchParams({
        per_page: perPage.toString(),
        page: page.toString()
    });

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?${params}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to get commits');
    }

    return response.json();
}

/**
 * Get a specific commit's details
 */
export async function getCommitDetails(token, owner, repo, sha) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to get commit details');
    }

    return response.json();
}
