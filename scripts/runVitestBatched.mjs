import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;
const EXCLUDED_TESTS = new Set([
  path.normalize('src/components/scene/SelectionOutline.test.tsx'),
  path.normalize('src/pages/EditorPage.autoSaveExitFlush.test.tsx'),
  path.normalize('src/pages/EditorPage.autoSaveSelection.test.tsx'),
]);
const DEFAULT_BATCH_SIZE = 1;

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectTestFiles(fullPath);
      }
      return [fullPath];
    })
  );

  return files.flat();
}

function toRelativeTestPath(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

function toBatches(items, batchSize) {
  const batches = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

function runVitestBatch(files, extraArgs) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--max-old-space-size=4096', './node_modules/vitest/vitest.mjs', 'run', ...extraArgs, ...files],
      {
        cwd: ROOT_DIR,
        env: process.env,
        stdio: 'inherit',
      }
    );

    child.on('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const requestedBatchSize = Number.parseInt(process.env.VITEST_BATCH_SIZE ?? '', 10);
  const batchSize =
    Number.isFinite(requestedBatchSize) && requestedBatchSize > 0 ? requestedBatchSize : DEFAULT_BATCH_SIZE;
  const extraArgs = process.argv.slice(2);

  const allTests = (await collectTestFiles(SRC_DIR))
    .filter((filePath) => TEST_FILE_PATTERN.test(filePath))
    .map(toRelativeTestPath)
    .filter((relativePath) => !EXCLUDED_TESTS.has(path.normalize(relativePath)))
    .sort();

  if (allTests.length === 0) {
    console.log('[batched-vitest] No test files found.');
    return;
  }

  const batches = toBatches(allTests, batchSize);

  console.log(
    `[batched-vitest] Running ${allTests.length} test files in ${batches.length} batch${batches.length === 1 ? '' : 'es'}`
  );

  for (const [index, batch] of batches.entries()) {
    console.log(`\n[batched-vitest] Batch ${index + 1}/${batches.length} (${batch.length} files)`);
    for (const file of batch) {
      console.log(`[batched-vitest]   ${file}`);
    }
    console.log('');
    const exitCode = await runVitestBatch(batch, extraArgs);
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
}

await main();
