#!/usr/bin/env node
/**
 * Cursor Hook: afterAgentResponse
 * 
 * Captures the AI-written intention line by parsing WORKLOG_START from the
 * assistant response. Cursor's `text` field may omit wrapper lines, so this hook
 * can fall back to reading `transcript_path` and extracting the last WORKLOG_START.
 *
 * IMPORTANT: This hook writes a dedicated `assistant_response` event (not
 * session_start/session_end) to avoid duplicating session events produced by
 * beforeSubmitPrompt/stop hooks.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

// Determine project root - Cursor runs hooks from project root
// but we need to be explicit about paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Dynamic imports with explicit paths
// Use pathToFileURL for Windows compatibility — Node ESM import() requires file:// URLs,
// not bare Windows paths like c:\...
const schemaPath = join(projectRoot, 'scripts', 'worklog', 'schema.mjs');
const loggerPath = join(projectRoot, 'scripts', 'worklog', 'logger.mjs');
const featurePath = join(projectRoot, 'scripts', 'worklog', 'feature.mjs');

const { createBaseEvent, EventTypes } = await import(pathToFileURL(schemaPath).href);
const { appendEvent, getCurrentBranch } = await import(pathToFileURL(loggerPath).href);
const { parseWorklogStartPayload, readCurrentFeature, writeCurrentFeature } = await import(pathToFileURL(featurePath).href);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Parses WORKLOG_START from Agent response text.
 * Searches ALL lines (not just the first) because the response text from
 * Cursor may include thinking blocks or other metadata before the visible text.
 * @param {string} text - Full Agent response text
 * @returns {string} - Intention summary (from WORKLOG_START line or fallback)
 */
function parseWorklogLines(text) {
  if (!text || typeof text !== 'string') {
    return '(worklog line missing)';
  }

  const lines = text.split('\n');
  
  // Search all lines for WORKLOG_START (it may not be line 0 due to thinking blocks etc.)
  for (const line of lines) {
    const trimmed = line.trim();
    const startMatch = trimmed.match(/^WORKLOG_START:\s*(.*)$/);
    if (startMatch) {
      let intention = startMatch[1].trim();
      if (intention.length > 200) {
        intention = intention.slice(0, 197) + '...';
      }
      return intention || '(worklog line missing - empty intention)';
    }
  }
  
  return '(worklog line missing)';
}

function parseWorklogFromTranscriptContent(content) {
  if (!content || typeof content !== 'string') return null;

  // Grab the last WORKLOG_START line from the transcript file, regardless of format.
  // This works even if the transcript is JSON-ish, because we search raw text.
  const re = /^WORKLOG_START:\s*(.*)$/gm;
  let last = null;
  for (;;) {
    const m = re.exec(content);
    if (!m) break;
    last = m[1]?.trim() ?? '';
  }
  if (!last) return null;
  if (last.length > 200) return last.slice(0, 197) + '...';
  return last;
}

async function main() {
  try {
    const input = await readStdin();
    const hookData = JSON.parse(input);
    
    const {
      conversation_id: conversationId,
      generation_id: generationId,
      text = '',
      transcript_path: transcriptPath,
    } = hookData;
    
    // Fail open if missing required fields
    if (!conversationId || !generationId) {
      console.error('[agent-response-worklog] Missing conversation_id or generation_id');
      process.exit(0);
    }
    
    const branch = await getCurrentBranch();

    let intentSummary = parseWorklogLines(text);
    let source = intentSummary.startsWith('(worklog line missing)') ? 'missing' : 'text';

    // If `text` doesn't include WORKLOG_START, fall back to transcript_path.
    if (source === 'missing' && transcriptPath) {
      try {
        const fs = await import('node:fs/promises');
        const transcriptContent = await fs.readFile(transcriptPath, 'utf8');
        const fromTranscript = parseWorklogFromTranscriptContent(transcriptContent);
        if (fromTranscript) {
          intentSummary = fromTranscript;
          source = 'transcript';
        }
      } catch {
        // ignore and keep missing
      }
    }

    const responseHash = crypto
      .createHash('sha256')
      .update(typeof text === 'string' ? text : '')
      .digest('hex')
      .slice(0, 12);

    // Extract optional feature from the WORKLOG_START payload.
    // Convention: WORKLOG_START: [Feature Name] Intention text
    const parsed = parseWorklogStartPayload(intentSummary);
    let featureId = parsed.featureId;
    let featureTitle = parsed.featureTitle;
    const intent = parsed.intent;

    // If no feature tag was found, fall back to the current feature (sticky),
    // instead of defaulting all the way back to the branch.
    if (!featureId) {
      const current = await readCurrentFeature(projectRoot);
      featureId = current?.featureId || null;
      featureTitle = current?.featureTitle || null;
    }

    if (featureId) {
      intentSummary = intent || intentSummary;
      await writeCurrentFeature(projectRoot, { featureId, featureTitle });
    }

    // Debug: keep a lightweight trace for diagnosis (safe, local-only)
    const debugPath = join(projectRoot, '.git', 'worklog', 'hook-debug.log');
    const debugLine =
      `[${new Date().toISOString()}] ` +
      `event=assistant_response source=${source} intentSummary=${JSON.stringify(intentSummary)} ` +
      `transcriptPath=${JSON.stringify(transcriptPath || null)} textStart=${JSON.stringify(text.slice(0, 200))}\n`;
    await import('node:fs/promises').then(fs => fs.appendFile(debugPath, debugLine, 'utf8')).catch(() => {});

    const event = {
      ...createBaseEvent(EventTypes.ASSISTANT_RESPONSE, branch, featureId || null),
      conversationId,
      generationId,
      intentSummary,
      source,
      responseHash,
      ...(featureTitle ? { featureTitle } : {}),
    };

    await appendEvent(event);
    
    process.exit(0);
  } catch (error) {
    console.error('[agent-response-worklog] Hook error:', error.message);
    // Fail open - don't block the agent
    process.exit(0);
  }
}

main();
