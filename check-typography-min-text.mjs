import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

/** @type {Set<string>} */
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/**
 * Recursively walk a directory and return matching files.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listFiles(dir) {
  /** @type {string[]} */
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFiles(full)));
      continue;
    }
    if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} absolutePath
 * @returns {string}
 */
function toPosixRelative(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join('/');
}

/**
 * @param {string} filePath
 * @param {string} content
 * @returns {{ file: string; line: number; match: string; reason: string }[]}
 */
function findViolations(filePath, content) {
  /** @type {{ file: string; line: number; match: string; reason: string }[]} */
  const violations = [];
  const rel = toPosixRelative(filePath);
  const lines = content.split(/\r?\n/);

  const textPxRegex = /\btext-\[(\d+)px\]\b/g;
  const allowlisted = [
    // Brand subtitle: intentionally tiny to match original logo proportions.
    { file: 'src/components/TopBar.tsx', match: 'text-[9px]' },
  ];

  /**
   * @param {string} file
   * @param {string} match
   */
  function isAllowlisted(file, match) {
    return allowlisted.some((a) => a.file === file && a.match === match);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    textPxRegex.lastIndex = 0;
    for (const m of line.matchAll(textPxRegex)) {
      if (isAllowlisted(rel, m[0])) continue;
      violations.push({
        file: rel,
        line: i + 1,
        match: m[0],
        reason:
          'Arbitrary pixel text sizes are disallowed (use Tailwind scale like text-xs/text-sm, or document an exception)',
      });
    }
  }

  return violations;
}

async function main() {
  let files;
  try {
    files = await listFiles(SRC_DIR);
  } catch (e) {
    console.error(`[check-typography-min-text] Failed to read src/: ${String(e)}`);
    process.exitCode = 2;
    return;
  }

  /** @type {{ file: string; line: number; match: string; reason: string }[]} */
  const allViolations = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    allViolations.push(...findViolations(file, content));
  }

  if (allViolations.length === 0) {
    console.log('[check-typography-min-text] OK: no disallowed text-[Npx] classes found in src/.');
    return;
  }

  console.error(
    `[check-typography-min-text] FAIL: found ${allViolations.length} violation(s) in src/.`
  );
  for (const v of allViolations) {
    console.error(`- ${v.file}:${v.line}  ${v.match}  (${v.reason})`);
  }
  process.exitCode = 1;
}

await main();

