import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Git operations wrapper for cloning, committing, pushing, and rollback
 */
export class GitManager {
  constructor(reposDir) {
    this.reposDir = reposDir;
    
    // Ensure repos directory exists
    if (!fs.existsSync(this.reposDir)) {
      fs.mkdirSync(this.reposDir, { recursive: true });
    }
  }

  /**
   * Get the local path for a repository
   */
  getRepoPath(owner, repo) {
    return path.join(this.reposDir, owner, repo);
  }

  /**
   * Clone or update a repository
   */
  async cloneOrPull(owner, repo, githubToken) {
    const repoPath = this.getRepoPath(owner, repo);
    const repoUrl = `https://${githubToken}@github.com/${owner}/${repo}.git`;

    if (fs.existsSync(repoPath)) {
      // Repository exists, pull latest changes
      const git = simpleGit(repoPath);
      await git.pull('origin', 'main').catch(() => git.pull('origin', 'master'));
      return { action: 'pulled', path: repoPath };
    } else {
      // Clone the repository
      const ownerDir = path.dirname(repoPath);
      if (!fs.existsSync(ownerDir)) {
        fs.mkdirSync(ownerDir, { recursive: true });
      }
      
      await simpleGit().clone(repoUrl, repoPath);
      return { action: 'cloned', path: repoPath };
    }
  }

  /**
   * Get the default branch name
   */
  async getDefaultBranch(repoPath) {
    const git = simpleGit(repoPath);
    try {
      const result = await git.revparse(['--abbrev-ref', 'HEAD']);
      return result.trim();
    } catch {
      return 'main';
    }
  }

  /**
   * Stage all changes, commit, and push
   */
  async commitAndPush(owner, repo, message, githubToken) {
    const repoPath = this.getRepoPath(owner, repo);
    const git = simpleGit(repoPath);
    
    // Configure git user for this repo
    await git.addConfig('user.email', 'remote-dev@localhost');
    await git.addConfig('user.name', 'Remote Dev System');

    // Stage all changes
    await git.add('-A');

    // Check if there are changes to commit
    const status = await git.status();
    if (status.files.length === 0) {
      return { committed: false, message: 'No changes to commit' };
    }

    // Commit
    const commitResult = await git.commit(message);
    
    // Push
    const branch = await this.getDefaultBranch(repoPath);
    const remoteUrl = `https://${githubToken}@github.com/${owner}/${repo}.git`;
    
    // Update remote URL with token
    await git.remote(['set-url', 'origin', remoteUrl]);
    await git.push('origin', branch);

    return {
      committed: true,
      hash: commitResult.commit,
      summary: commitResult.summary,
      branch
    };
  }

  /**
   * Get commit history
   */
  async getCommitHistory(owner, repo, limit = 20) {
    const repoPath = this.getRepoPath(owner, repo);
    
    if (!fs.existsSync(repoPath)) {
      return [];
    }

    const git = simpleGit(repoPath);
    const log = await git.log({ maxCount: limit });
    
    return log.all.map(commit => ({
      hash: commit.hash,
      shortHash: commit.hash.substring(0, 7),
      message: commit.message,
      date: commit.date,
      author: commit.author_name
    }));
  }

  /**
   * Rollback to a specific commit and force push
   */
  async rollbackToCommit(owner, repo, commitHash, githubToken) {
    const repoPath = this.getRepoPath(owner, repo);
    const git = simpleGit(repoPath);

    // Reset to the specified commit
    await git.reset(['--hard', commitHash]);

    // Force push
    const branch = await this.getDefaultBranch(repoPath);
    const remoteUrl = `https://${githubToken}@github.com/${owner}/${repo}.git`;
    
    await git.remote(['set-url', 'origin', remoteUrl]);
    await git.push('origin', branch, ['--force']);

    return { success: true, rolledBackTo: commitHash };
  }

  /**
   * Get diff for a specific commit
   */
  async getCommitDiff(owner, repo, commitHash) {
    const repoPath = this.getRepoPath(owner, repo);
    const git = simpleGit(repoPath);

    const diff = await git.diff([`${commitHash}^`, commitHash]);
    return diff;
  }
}
