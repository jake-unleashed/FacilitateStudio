#!/usr/bin/env node
/**
 * Cursor Hook: afterAgentResponse
 * 
 * Captures session events by parsing WORKLOG_START and WORKLOG_END lines
 * from the Agent's response text. Writes both session_start and session_end
 * events to the worklog.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Determine project root - Cursor runs hooks from project root
// but we need to be explicit about paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Dynamic imports with explicit paths
const schemaPath = join(projectRoot, 'scripts', 'worklog', 'schema.mjs');
const loggerPath = join(projectRoot, 'scripts', 'worklog', 'logger.mjs');

const { createBaseEvent, EventTypes, SessionStatus } = await import(schemaPath);
const { appendEvent, getCurrentBranch } = await import(loggerPath);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Parses WORKLOG_START and WORKLOG_END from Agent response text
 * @param {string} text - Full Agent response text
 * @returns {string} - Intention summary (from WORKLOG_START line or fallback)
 */
function parseWorklogLines(text) {
  if (!text || typeof text !== 'string') {
    return '(worklog line missing)';
  }

  const lines = text.split('\n');
  
  // Parse first line for WORKLOG_START
  const firstLine = lines[0]?.trim() || '';
  const startMatch = firstLine.match(/^WORKLOG_START:\s*(.*)$/);
  
  if (!startMatch) {
    return '(worklog line missing)';
  }
  
  // Extract intention, limit to 200 chars
  let intention = startMatch[1].trim();
  if (intention.length > 200) {
    intention = intention.slice(0, 197) + '...';
  }
  
  return intention || '(worklog line missing - empty intention)';
}

async function main() {
  try {
    const input = await readStdin();
    const hookData = JSON.parse(input);
    
    const {
      conversation_id: conversationId,
      generation_id: generationId,
      text = '',
    } = hookData;
    
    // Fail open if missing required fields
    if (!conversationId || !generationId) {
      console.error('[agent-response-worklog] Missing conversation_id or generation_id');
      process.exit(0);
    }
    
    const branch = await getCurrentBranch();
    const intentSummary = parseWorklogLines(text);
    
    // Create session_start event
    const sessionStartEvent = {
      ...createBaseEvent(EventTypes.SESSION_START, branch),
      conversationId,
      generationId,
      intentSummary,
    };
    
    // Create session_end event
    const sessionEndEvent = {
      ...createBaseEvent(EventTypes.SESSION_END, branch),
      conversationId,
      generationId,
      status: SessionStatus.COMPLETED,
      durationMs: 0, // Cannot calculate duration since we only run at end
      insights: [], // No insights extraction in this version
    };
    
    // Append both events
    await appendEvent(sessionStartEvent);
    await appendEvent(sessionEndEvent);
    
    process.exit(0);
  } catch (error) {
    console.error('[agent-response-worklog] Hook error:', error.message);
    // Fail open - don't block the agent
    process.exit(0);
  }
}

main();
