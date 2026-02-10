/**
 * Worklog Event Logger
 * 
 * Appends events to .git/worklog/events.ndjson in a safe, atomic manner.
 * Used by both Cursor hooks and git hooks.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBaseEvent } from './schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to the worklog events file
 * Searches upward from current directory to find .git folder
 */
async function getEventsFilePath() {
  let dir = process.cwd();
  
  // Search upward for .git directory
  while (dir !== path.parse(dir).root) {
    const gitDir = path.join(dir, '.git');
    try {
      const stat = await fs.stat(gitDir);
      if (stat.isDirectory()) {
        const worklogDir = path.join(gitDir, 'worklog');
        await fs.mkdir(worklogDir, { recursive: true });
        return path.join(worklogDir, 'events.ndjson');
      }
    } catch {
      // Not found, continue searching upward
    }
    dir = path.dirname(dir);
  }
  
  throw new Error('Could not find .git directory. Are you in a git repository?');
}

/**
 * Appends an event to the NDJSON log file
 * @param {Object} event - Event object conforming to schema
 */
export async function appendEvent(event) {
  validateBaseEvent(event);
  
  const eventsFile = await getEventsFilePath();
  const line = JSON.stringify(event) + '\n';
  
  // Append atomically
  await fs.appendFile(eventsFile, line, 'utf8');
}

/**
 * Reads all events from the log file
 * @returns {Promise<Object[]>} Array of event objects
 */
export async function readEvents() {
  const eventsFile = await getEventsFilePath();
  
  try {
    const content = await fs.readFile(eventsFile, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []; // File doesn't exist yet
    }
    throw error;
  }
}

/**
 * Gets events filtered by criteria
 * @param {Object} filters
 * @param {string} [filters.branch] - Filter by branch
 * @param {string} [filters.type] - Filter by event type
 * @param {string} [filters.conversationId] - Filter by conversation
 * @param {Date} [filters.since] - Events after this timestamp
 * @param {Date} [filters.until] - Events before this timestamp
 */
export async function getEvents(filters = {}) {
  const events = await readEvents();
  
  return events.filter(event => {
    if (filters.branch && event.branch !== filters.branch) return false;
    if (filters.type && event.type !== filters.type) return false;
    if (filters.conversationId && event.conversationId !== filters.conversationId) return false;
    
    if (filters.since) {
      const eventTime = new Date(event.ts);
      if (eventTime < filters.since) return false;
    }
    
    if (filters.until) {
      const eventTime = new Date(event.ts);
      if (eventTime > filters.until) return false;
    }
    
    return true;
  });
}

/**
 * Gets the current git branch
 */
export async function getCurrentBranch() {
  const { execSync } = await import('node:child_process');
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}
