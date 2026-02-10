/**
 * Feature Digest Generator
 * 
 * Reads worklog events and generates human-readable Feature Review markdown files.
 * Groups events by feature windows (branch-based) and produces concise summaries.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { getEvents, getCurrentBranch } from './logger.mjs';
import { EventTypes } from './schema.mjs';

/**
 * Determines feature windows from events
 * A feature window is defined by:
 * - All events on the same branch between feature boundaries
 * - Boundaries: push events OR branch changes
 */
function identifyFeatureWindows(events) {
  const windows = [];
  let currentWindow = null;
  
  for (const event of events) {
    const { branch, type, ts } = event;
    
    // Start new window if:
    // 1. No current window
    // 2. Branch changed
    // 3. Previous event was a push
    if (
      !currentWindow ||
      currentWindow.branch !== branch ||
      currentWindow.closed
    ) {
      if (currentWindow) {
        windows.push(currentWindow);
      }
      currentWindow = {
        branch,
        featureId: branch,
        startTime: ts,
        endTime: ts,
        events: [],
        closed: false,
      };
    }
    
    currentWindow.events.push(event);
    currentWindow.endTime = ts;
    
    // Close window on push
    if (type === EventTypes.PUSH) {
      currentWindow.closed = true;
    }
  }
  
  if (currentWindow) {
    windows.push(currentWindow);
  }
  
  return windows;
}

/**
 * Calculates duration between two ISO timestamps
 */
function calculateDuration(startTs, endTs) {
  const start = new Date(startTs);
  const end = new Date(endTs);
  const ms = end - start;
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Groups sessions by conversation
 */
function groupSessions(events) {
  const sessions = [];
  const sessionMap = new Map();
  
  for (const event of events) {
    if (event.type === EventTypes.SESSION_START) {
      const key = `${event.conversationId}:${event.generationId}`;
      sessionMap.set(key, {
        start: event,
        end: null,
      });
    } else if (event.type === EventTypes.SESSION_END) {
      const key = `${event.conversationId}:${event.generationId}`;
      const session = sessionMap.get(key);
      if (session) {
        session.end = event;
        sessions.push(session);
      }
    }
  }
  
  return sessions;
}

/**
 * Generates Feature Review markdown content
 */
function generateFeatureReview(window, verificationResults = null) {
  const { branch, featureId, startTime, endTime, events } = window;
  
  const sessions = groupSessions(events);
  const commits = events.filter(e => e.type === EventTypes.COMMIT);
  const pushEvents = events.filter(e => e.type === EventTypes.PUSH);
  
  const duration = calculateDuration(startTime, endTime);
  
  let markdown = `# Feature: ${featureId}\n\n`;
  markdown += `**Branch**: \`${branch}\`  \n`;
  markdown += `**Duration**: ${duration}  \n`;
  markdown += `**Period**: ${new Date(startTime).toLocaleString()} → ${new Date(endTime).toLocaleString()}\n\n`;
  
  // Summary section
  markdown += `## Summary\n\n`;
  if (sessions.length > 0) {
    const intentions = sessions
      .map(s => s.start?.intentSummary)
      .filter(Boolean)
      .slice(0, 3);
    
    if (intentions.length > 0) {
      markdown += intentions.map(intent => `- ${intent}`).join('\n');
      markdown += '\n\n';
    }
  }
  
  // Sessions timeline
  if (sessions.length > 0) {
    markdown += `## Work Sessions\n\n`;
    markdown += `Total sessions: ${sessions.length}\n\n`;
    
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const { start, end } = session;
      
      markdown += `### Session ${i + 1}\n\n`;
      markdown += `**Time**: ${new Date(start.ts).toLocaleTimeString()}`;
      
      if (end && end.durationMs) {
        const durationMin = Math.round(end.durationMs / 1000 / 60);
        markdown += ` (${durationMin}m)`;
      }
      
      markdown += `  \n`;
      markdown += `**Status**: ${end?.status || 'unknown'}\n\n`;
      
      if (start.intentSummary) {
        markdown += `**Intention**: ${start.intentSummary}\n\n`;
      }
      
      if (end?.insights && end.insights.length > 0) {
        markdown += `**Insights**:\n`;
        markdown += end.insights.map(insight => `- ${insight}`).join('\n');
        markdown += '\n\n';
      }
    }
  }
  
  // Commits
  if (commits.length > 0) {
    markdown += `## Commits\n\n`;
    markdown += `Total: ${commits.length} commits\n\n`;
    
    for (const commit of commits) {
      markdown += `- \`${commit.hash.slice(0, 7)}\` ${commit.subject}`;
      if (commit.filesChanged) {
        markdown += ` (${commit.filesChanged} files`;
        if (commit.insertions || commit.deletions) {
          markdown += `, +${commit.insertions || 0}/-${commit.deletions || 0}`;
        }
        markdown += ')';
      }
      markdown += '\n';
    }
    markdown += '\n';
  }
  
  // Verification results
  if (verificationResults) {
    markdown += `## Verification\n\n`;
    markdown += `- **Typecheck**: ${verificationResults.typecheck || 'not run'}\n`;
    markdown += `- **Lint**: ${verificationResults.lint || 'not run'}\n`;
    markdown += `- **Tests**: ${verificationResults.tests || 'not run'}\n\n`;
  }
  
  // Shipped
  if (pushEvents.length > 0) {
    markdown += `## Shipped\n\n`;
    for (const push of pushEvents) {
      markdown += `- Pushed to \`${push.remote}\` at ${new Date(push.ts).toLocaleString()}\n`;
      markdown += `  Range: \`${push.range}\`\n`;
    }
    markdown += '\n';
  }
  
  markdown += `---\n`;
  markdown += `*Generated from worklog events on ${new Date().toLocaleString()}*\n`;
  
  return markdown;
}

/**
 * Generates digest for the current feature (current branch)
 */
export async function generateCurrentFeatureDigest(verificationResults = null) {
  const branch = await getCurrentBranch();
  const events = await getEvents({ branch });
  
  if (events.length === 0) {
    console.log('No events found for current branch');
    return null;
  }
  
  // Get the most recent feature window (current unclosed window)
  const windows = identifyFeatureWindows(events);
  const currentWindow = windows[windows.length - 1];
  
  if (!currentWindow) {
    console.log('No feature window found');
    return null;
  }
  
  // Generate markdown
  const markdown = generateFeatureReview(currentWindow, verificationResults);
  
  // Determine output path
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sanitizedBranch = branch.replace(/[^a-zA-Z0-9-_]/g, '_');
  
  const digestDir = path.join(process.cwd(), 'docs', 'worklog', 'digests', yearMonth);
  await fs.mkdir(digestDir, { recursive: true });
  
  const digestPath = path.join(digestDir, `${sanitizedBranch}.md`);
  await fs.writeFile(digestPath, markdown, 'utf8');
  
  console.log(`Feature digest generated: ${digestPath}`);
  
  // Log digest event
  const { appendEvent } = await import('./logger.mjs');
  const { createBaseEvent } = await import('./schema.mjs');
  
  const commits = currentWindow.events.filter(e => e.type === EventTypes.COMMIT);
  const firstCommit = commits[0]?.hash;
  const lastCommit = commits[commits.length - 1]?.hash;
  
  await appendEvent({
    ...createBaseEvent(EventTypes.FEATURE_DIGEST, branch),
    digestPath: path.relative(process.cwd(), digestPath),
    fromCommit: firstCommit || 'unknown',
    toCommit: lastCommit || 'unknown',
    featureId: currentWindow.featureId,
  });
  
  return digestPath;
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  generateCurrentFeatureDigest()
    .then(digestPath => {
      if (digestPath) {
        console.log('✅ Feature digest generated successfully');
        process.exit(0);
      } else {
        console.log('⚠️  No digest generated (no events found)');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error generating digest:', error.message);
      process.exit(1);
    });
}
