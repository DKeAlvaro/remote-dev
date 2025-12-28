# Remote Dev System

Control your GitHub repositories remotely with AI-powered code changes using Gemini CLI.

## Project Structure

```
├── laptop-server/     # Node.js server running on your laptop
│   └── src/
│       ├── index.js   # Main server
│       ├── git.js     # Git operations
│       ├── gemini.js  # Gemini CLI wrapper
│       └── tunnel.js  # ngrok tunnel
│
└── web-app/           # React web app (PWA)
    └── src/
        ├── pages/     # Login, Repos, RepoDetail
        ├── hooks/     # WebSocket hook
        └── services/  # GitHub API
```

## Quick Start

### 1. Setup Laptop Server

```bash
cd laptop-server
cp .env.example .env
# Edit .env with your tokens
npm install
npm start
```

### 2. Setup Web App

```bash
cd web-app
npm install
npm run dev
```

### 3. Configure Environment Variables

**laptop-server/.env:**
```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx      # GitHub Personal Access Token
SHARED_SECRET=your-secret-key       # Shared auth secret
NGROK_AUTH_TOKEN=xxxxxxxxx          # From ngrok.com dashboard
```

**web-app/.env:**
```env
VITE_GITHUB_CLIENT_ID=your-client-id  # Optional for OAuth
```

## Usage

1. Start the laptop server → copy the ngrok URL
2. Open web app on your phone
3. Login with GitHub Personal Access Token
4. Enter laptop server URL and shared secret
5. Select a repository
6. Type instructions → Gemini CLI makes changes → auto-commits and pushes

## Features

- **View Repos**: Browse all your GitHub repositories
- **Commit History**: See recent commits for selected repo
- **AI Commands**: Use natural language to describe changes
- **Auto-commit**: Every change is committed and pushed
- **Rollback**: Easily revert to any previous commit

## Security

- Shared secret authentication between app and server
- GitHub Personal Access Token for API and Git operations
- ngrok provides HTTPS tunnel

## Requirements

- Node.js 18+
- Gemini CLI installed (`npm install -g @anthropic-ai/gemini-cli`)
- ngrok account (free tier works)
- GitHub account
