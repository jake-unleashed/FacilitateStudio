#!/usr/bin/env node
/**
 * Cursor Hook: stop
 * 
 * Captures session end event with insights extracted from assistant response.
 * Reads hook input from stdin (JSON), extracts insights, logs event.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

// Determine project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Dynamic imports with explicit paths
// Use pathToFileURL for Windows compatibility — Node ESM import() requires file:// URLs,
// not bare Windows paths like c:\...
const schemaPath = join(projectRoot, 'scripts', 'worklog', 'schema.mjs');
const loggerPath = join(projectRoot, 'scripts', 'worklog', 'logger.mjs');

const { createBaseEvent, EventTypes, SessionStatus } = await import(pathToFileURL(schemaPath).href);
const { appendEvent, getCurrentBranch, getEvents } = await import(pathToFileURL(loggerPath).href);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Extracts 0-2 insight bullets from assistant's final response
 * Uses heuristic extraction looking for key patterns
 */
function extractInsights(conversationId, generationId) {
  // For the stop hook, we don't have direct access to the assistant's response text
  // in the hook input. We would need to read it from transcript_path if available.
  // For now, return empty array - insights can be added at /post-feature digest generation
  // when we have full context.
  
  // Future enhancement: if transcript_path is provided in hook input,
  // read the transcript and extract insights from the latest assistant message.
  
  return [];
}

/**
 * Calculates duration since session_start for this generation
 */
async function calculateDuration(conversationId, generationId, branch) {
  try {
    const events = await getEvents({ conversationId, branch });
    const startEvent = events
      .filter(e => e.type === EventTypes.SESSION_START && e.generationId === generationId)
      .pop();
    
    if (startEvent) {
      const startTime = new Date(startEvent.ts);
      const endTime = new Date();
      return endTime - startTime;
    }
  } catch {
    // If we can't find start event, return null
  }
  return null;
}

async function main() {
  try {
    const input = await readStdin();
    const hookData = JSON.parse(input);
    
    const {
      conversation_id: conversationId,
      generation_id: generationId,
      status = 'unknown',
      transcript_path: transcriptPath,
    } = hookData;
    
    if (!conversationId || !generationId) {
      console.error('Missing conversation_id or generation_id');
      process.exit(0);
    }
    
    const branch = await getCurrentBranch();
    const durationMs = await calculateDuration(conversationId, generationId, branch);
    
    // Extract insights (currently empty, can be enhanced)
    const insights = extractInsights(conversationId, generationId);
    
    const event = {
      ...createBaseEvent(EventTypes.SESSION_END, branch),
      conversationId,
      generationId,
      status: Object.values(SessionStatus).includes(status) ? status : SessionStatus.UNKNOWN,
      durationMs,
      insights,
    };
    
    await appendEvent(event);
    
    process.exit(0);
  } catch (error) {
    console.error('Session end hook error:', error.message);
    process.exit(0); // Fail open
  }
}

main();
