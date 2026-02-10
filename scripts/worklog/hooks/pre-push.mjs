#!/usr/bin/env node
/**
 * Git Hook: pre-push
 * 
 * Logs push event to worklog before each push.
 * Receives remote name and URL from git via command line args.
 * This script is called from .husky/pre-push
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Get the project root (3 levels up from this script: hooks -> worklog -> scripts -> root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..');

// Change to project root for all operations
process.chdir(projectRoot);

// Now import - use relative path from worklog/hooks to worklog
const { createBaseEvent, EventTypes } = await import('../schema.mjs');
const { appendEvent, getCurrentBranch } = await import('../logger.mjs');
const { readCurrentFeature } = await import('../feature.mjs');

function getCommitRange(remote, localRef) {
  try {
    // Get the remote ref
    const remoteBranch = localRef.replace('refs/heads/', '');
    const remoteRef = `${remote}/${remoteBranch}`;
    
    // Get the range of commits being pushed (Windows-compatible)
    const range = execSync(
      `git rev-parse ${remoteRef} 2>nul`,
      { encoding: 'utf8', shell: true }
    ).trim();
    
    const localCommit = execSync(`git rev-parse ${localRef}`, { encoding: 'utf8' }).trim();
    
    if (range) {
      // Get list of commits in range
      const commits = execSync(
        `git rev-list ${range}..${localCommit}`,
        { encoding: 'utf8' }
      )
        .trim()
        .split('\n')
        .filter(Boolean);
      
      return {
        range: `${range.slice(0, 7)}..${localCommit.slice(0, 7)}`,
        commits,
      };
    } else {
      // First push to this remote or remote doesn't exist yet
      return {
        range: `(initial)..${localCommit.slice(0, 7)}`,
        commits: [localCommit],
      };
    }
  } catch (error) {
    console.error('Error getting commit range:', error.message);
    return { range: 'unknown', commits: [] };
  }
}

async function main() {
  try {
    // Git passes: remote_name remote_url
    // Args are passed from husky via "$@"
    const [remote, url] = process.argv.slice(2);
    
    if (!remote) {
      // No remote info, might be first push or dry-run
      process.exit(0);
    }
    
    const branch = await getCurrentBranch();
    const currentFeature = await readCurrentFeature(projectRoot);
    const featureId = currentFeature?.featureId || null;
    const localRef = `refs/heads/${branch}`;
    const { range, commits } = getCommitRange(remote, localRef);
    
    const event = {
      ...createBaseEvent(EventTypes.PUSH, branch, featureId),
      remote,
      range,
      commits,
      ...(currentFeature?.featureTitle ? { featureTitle: currentFeature.featureTitle } : {}),
    };
    
    await appendEvent(event);
  } catch (error) {
    // Fail silently - don't block the push
    console.error('Worklog pre-push hook error:', error.message);
  }
  
  process.exit(0);
}

main();
