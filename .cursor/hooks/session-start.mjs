#!/usr/bin/env node
/**
 * Cursor Hook: beforeSubmitPrompt
 * 
 * Captures session start event with intention summary.
 * Reads hook input from stdin (JSON), generates intention summary, logs event.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

// Determine project root - Cursor runs hooks from project root
// but we need to be explicit about paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Dynamic imports with explicit paths
const schemaPath = join(projectRoot, 'scripts', 'worklog', 'schema.mjs');
const loggerPath = join(projectRoot, 'scripts', 'worklog', 'logger.mjs');

const { createBaseEvent, EventTypes } = await import(schemaPath);
const { appendEvent, getCurrentBranch } = await import(loggerPath);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Generates a concise intention summary from user prompt
 * Uses heuristic approach (no LLM call) for speed and simplicity
 */
function generateIntentionSummary(prompt, attachments = []) {
  if (!prompt || typeof prompt !== 'string') {
    return 'Continue work on current task';
  }
  
  // Truncate to first 2 sentences or 150 chars, whichever is shorter
  let summary = prompt.trim();
  
  // Extract first 1-2 sentences
  const sentenceEnd = /[.!?]\s/;
  const matches = [];
  let remaining = summary;
  
  for (let i = 0; i < 2; i++) {
    const match = remaining.match(sentenceEnd);
    if (!match) break;
    const endIdx = match.index + match[0].length;
    matches.push(remaining.slice(0, endIdx).trim());
    remaining = remaining.slice(endIdx);
  }
  
  if (matches.length > 0) {
    summary = matches.join(' ');
  }
  
  // Hard limit at 150 chars
  if (summary.length > 150) {
    summary = summary.slice(0, 147) + '...';
  }
  
  // Add context about attachments if present
  if (attachments && attachments.length > 0) {
    const fileCount = attachments.filter(a => a.type === 'file').length;
    if (fileCount > 0) {
      summary += ` (with ${fileCount} file${fileCount > 1 ? 's' : ''})`;
    }
  }
  
  return summary;
}

async function main() {
  try {
    const input = await readStdin();
    const hookData = JSON.parse(input);
    
    const {
      conversation_id: conversationId,
      generation_id: generationId,
      prompt = '',
      attachments = [],
    } = hookData;
    
    if (!conversationId || !generationId) {
      console.error('Missing conversation_id or generation_id');
      process.exit(0); // Fail open - don't block the prompt
    }
    
    const branch = await getCurrentBranch();
    const intentSummary = generateIntentionSummary(prompt, attachments);
    
    // Optional: hash prompt for traceability without storing content
    const promptHash = crypto
      .createHash('sha256')
      .update(prompt)
      .digest('hex')
      .slice(0, 12);
    
    const event = {
      ...createBaseEvent(EventTypes.SESSION_START, branch),
      conversationId,
      generationId,
      intentSummary,
      promptHash,
    };
    
    await appendEvent(event);
    
    // Output continue signal to Cursor
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  } catch (error) {
    console.error('Session start hook error:', error.message);
    // Fail open - don't block user's prompt
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

main();
