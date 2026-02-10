/**
 * Worklog feature helpers.
 *
 * We treat "feature" as a user-meaningful unit of work (often smaller than a branch),
 * derived primarily from the Agent's WORKLOG_START line.
 *
 * Convention:
 *   WORKLOG_START: [Some Feature Name] Do the thing
 *
 * - The bracket content becomes `featureTitle`
 * - We derive a stable-ish `featureId` slug from the title
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export function slugifyFeatureId(featureTitle) {
  if (!featureTitle || typeof featureTitle !== 'string') return null;

  // Lowercase, replace non-alphanumerics with "-", collapse repeats.
  const slug = featureTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) return null;
  return slug.length > 60 ? slug.slice(0, 60) : slug;
}

/**
 * Parses a WORKLOG_START payload (the part AFTER "WORKLOG_START:")
 * @param {string} payload
 * @returns {{ featureId: string | null, featureTitle: string | null, intent: string }}
 */
export function parseWorklogStartPayload(payload) {
  const raw = typeof payload === 'string' ? payload.trim() : '';
  if (!raw) return { featureId: null, featureTitle: null, intent: '' };

  // Optional leading bracket tag: [Feature Name]
  const m = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!m) return { featureId: null, featureTitle: null, intent: raw };

  const featureTitle = (m[1] || '').trim() || null;
  const intent = (m[2] || '').trim() || '';
  const featureId = slugifyFeatureId(featureTitle);

  return { featureId, featureTitle, intent: intent || raw };
}

export function getCurrentFeatureFilePath(projectRoot) {
  return path.join(projectRoot, '.git', 'worklog', 'current-feature.json');
}

/**
 * Reads current feature selection (best-effort).
 * @param {string} projectRoot
 */
export async function readCurrentFeature(projectRoot) {
  try {
    const filePath = getCurrentFeatureFilePath(projectRoot);
    const content = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(content);
    if (!json || typeof json !== 'object') return null;
    if (!json.featureId || typeof json.featureId !== 'string') return null;
    return {
      featureId: json.featureId,
      featureTitle: typeof json.featureTitle === 'string' ? json.featureTitle : null,
      updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : null,
    };
  } catch {
    return null;
  }
}

/**
 * Writes current feature selection (best-effort, local-only).
 * @param {string} projectRoot
 * @param {{ featureId: string, featureTitle?: string | null }} feature
 */
export async function writeCurrentFeature(projectRoot, feature) {
  try {
    const filePath = getCurrentFeatureFilePath(projectRoot);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const payload = {
      featureId: feature.featureId,
      featureTitle: feature.featureTitle ?? null,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

