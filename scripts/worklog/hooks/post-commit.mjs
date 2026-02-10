#!/usr/bin/env node
/**
 * Git Hook: post-commit
 * 
 * Logs commit event to worklog after each commit.
 * This script is called from .husky/post-commit
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

async function getCommitInfo() {
  try {
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const subject = execSync('git log -1 --format=%s', { encoding: 'utf8' }).trim();
    
    // Get diffstat
    const diffstat = execSync('git diff --shortstat HEAD~1 HEAD 2>nul || echo ""', {
      encoding: 'utf8',
      shell: true,
    }).trim();
    
    // Parse diffstat: "3 files changed, 45 insertions(+), 2 deletions(-)"
    const filesMatch = diffstat.match(/(\d+) files? changed/);
    const insertionsMatch = diffstat.match(/(\d+) insertions?/);
    const deletionsMatch = diffstat.match(/(\d+) deletions?/);
    
    return {
      hash,
      subject,
      filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : undefined,
      insertions: insertionsMatch ? parseInt(insertionsMatch[1], 10) : undefined,
      deletions: deletionsMatch ? parseInt(deletionsMatch[1], 10) : undefined,
    };
  } catch (error) {
    console.error('Error getting commit info:', error.message);
    return null;
  }
}

async function main() {
  try {
    const branch = await getCurrentBranch();
    const currentFeature = await readCurrentFeature(projectRoot);
    const featureId = currentFeature?.featureId || null;
    const commitInfo = await getCommitInfo();
    
    if (!commitInfo) {
      process.exit(0); // Fail silently
    }
    
    const event = {
      ...createBaseEvent(EventTypes.COMMIT, branch, featureId),
      ...commitInfo,
      ...(currentFeature?.featureTitle ? { featureTitle: currentFeature.featureTitle } : {}),
    };
    
    await appendEvent(event);
  } catch (error) {
    // Fail silently - don't block the commit
    console.error('Worklog post-commit hook error:', error.message);
  }
  
  process.exit(0);
}

main();
