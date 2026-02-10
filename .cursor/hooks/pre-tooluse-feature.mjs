#!/usr/bin/env node
/**
 * Cursor Hook: preToolUse
 *
 * Goal: Make feature selection "intuitive" by updating the current feature
 * before tools run, based on the agent's message text.
 *
 * Cursor includes `agent_message` in preToolUse input. If that message contains
 * a WORKLOG_START line with a [Feature] tag, we persist it to:
 *   .git/worklog/current-feature.json
 *
 * We always allow the tool execution (fail-open).
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

const featurePath = join(projectRoot, 'scripts', 'worklog', 'feature.mjs');
const { parseWorklogStartPayload, writeCurrentFeature } = await import(pathToFileURL(featurePath).href);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function extractWorklogStartPayload(agentMessage) {
  if (!agentMessage || typeof agentMessage !== 'string') return null;
  const lines = agentMessage.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^WORKLOG_START:\s*(.*)$/);
    if (m) return (m[1] || '').trim();
  }
  return null;
}

async function main() {
  try {
    const input = await readStdin();
    const data = JSON.parse(input);
    const payload = extractWorklogStartPayload(data.agent_message);
    if (payload) {
      const { featureId, featureTitle } = parseWorklogStartPayload(payload);
      if (featureId) {
        await writeCurrentFeature(projectRoot, { featureId, featureTitle });
      }
    }
  } catch {
    // ignore (fail-open)
  }

  // Always allow tool usage.
  // Cursor expects JSON output for preToolUse hooks.
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
}

main();

