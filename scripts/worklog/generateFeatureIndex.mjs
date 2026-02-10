#!/usr/bin/env node
/**
 * Feature Index Generator
 *
 * Produces a single human-readable markdown table showing feature work windows.
 * Intended outputs:
 * - .git/worklog/feature-index.md (local, always up-to-date)
 * - docs/worklog/feature-index.md (optional, commit when you want)
 *
 * This script is safe to run frequently (e.g. from Cursor stop hook).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEvents, getCurrentBranch } from './logger.mjs';
import { EventTypes } from './schema.mjs';

function fmt(dt) {
  return new Date(dt).toISOString().replace('T', ' ').slice(0, 16);
}

function msToHuman(ms) {
  if (ms == null || Number.isNaN(ms)) return '';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

function escapePipes(s) {
  return String(s ?? '').replace(/\|/g, '\\|');
}

function featureKey(event) {
  return (typeof event.feature === 'string' && event.feature.trim()) ? event.feature.trim() : event.branch;
}

function buildIndex(events) {
  /** @type {Map<string, any>} */
  const map = new Map();

  for (const e of events) {
    const key = featureKey(e);
    if (!map.has(key)) {
      map.set(key, {
        featureId: key,
        featureTitle: null,
        firstTs: e.ts,
        lastTs: e.ts,
        sessions: 0,
        commits: 0,
        pushes: 0,
        description: null,
        notes: [],
      });
    }
    const row = map.get(key);
    row.firstTs = new Date(e.ts) < new Date(row.firstTs) ? e.ts : row.firstTs;
    row.lastTs = new Date(e.ts) > new Date(row.lastTs) ? e.ts : row.lastTs;

    if (!row.featureTitle && typeof e.featureTitle === 'string') row.featureTitle = e.featureTitle;

    if (e.type === EventTypes.SESSION_START) row.sessions += 1;
    if (e.type === EventTypes.COMMIT) row.commits += 1;
    if (e.type === EventTypes.PUSH) row.pushes += 1;

    if (!row.description) {
      const desc =
        (e.type === EventTypes.ASSISTANT_RESPONSE ? e.intentSummary : null) ||
        (e.type === EventTypes.SESSION_START ? e.intentSummary : null);
      if (desc && !String(desc).startsWith('(worklog line missing)')) row.description = desc;
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => new Date(b.lastTs) - new Date(a.lastTs));
  return rows;
}

function renderMarkdown(rows, branch) {
  const header = [
    `# Worklog Feature Index`,
    ``,
    `**Branch**: \`${branch}\`  `,
    `**Updated**: ${new Date().toLocaleString()}`,
    ``,
    `| Feature | Description | First seen | Last seen | Duration | Sessions | Commits | Pushes | Notes |`,
    `|---|---|---:|---:|---:|---:|---:|---:|---|`,
  ];

  const lines = rows.map(r => {
    const duration = msToHuman(new Date(r.lastTs) - new Date(r.firstTs));
    const featureLabel = r.featureTitle ? `${r.featureTitle} (\`${r.featureId}\`)` : `\`${r.featureId}\``;
    return [
      escapePipes(featureLabel),
      escapePipes(r.description || ''),
      fmt(r.firstTs),
      fmt(r.lastTs),
      duration,
      String(r.sessions),
      String(r.commits),
      String(r.pushes),
      escapePipes((r.notes || []).join('; ')),
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |');
  });

  return header.concat(lines).join('\n') + '\n';
}

export async function generateFeatureIndex({ outPath, branch = null } = {}) {
  const actualBranch = branch || (await getCurrentBranch());
  const events = await getEvents({ branch: actualBranch });
  const rows = buildIndex(events);
  const md = renderMarkdown(rows, actualBranch);

  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, md, 'utf8');
  }

  return { branch: actualBranch, rows, markdown: md };
}

// CLI
const isMain = (() => {
  try {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isMain) {
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : null;
  generateFeatureIndex({ outPath })
    .then(({ branch, rows }) => {
      if (outPath) console.log(`Feature index written: ${outPath}`);
      console.log(`Features: ${rows.length} (branch: ${branch})`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Error generating feature index:', err?.message || err);
      process.exit(1);
    });
}

