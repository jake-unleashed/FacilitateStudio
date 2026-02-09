import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import {
  getExtractSopStepsSystemPrompt,
} from '../shared/ai/extractSopStepsPrompt.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const apiKey = process.env.OPENAI_API_KEY;

function usage() {
  // eslint-disable-next-line no-console
  console.log(`
Usage:
  node scripts/evalSopExtraction.mjs <file-or-folder> [more paths...]
  node scripts/evalSopExtraction.mjs --synthetic [count]

Environment:
  OPENAI_API_KEY   (required)
  OPENAI_MODEL     (optional, default: ${DEFAULT_MODEL})

Notes:
  - Accepts one or more files or folders. Folders are scanned recursively.
  - Supported input files: .txt (recommended). You can paste extracted SOP text into a .txt.
  - --synthetic runs built-in tricky test cases (no files needed).
`.trim());
}

function isTxtFile(p) {
  return p.toLowerCase().endsWith('.txt');
}

async function listTxtFilesRecursively(entryPath) {
  const stat = await fs.stat(entryPath);
  if (stat.isFile()) return isTxtFile(entryPath) ? [entryPath] : [];

  const out = [];
  const stack = [entryPath];
  while (stack.length) {
    const dir = stack.pop();
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) stack.push(full);
      else if (it.isFile() && isTxtFile(full)) out.push(full);
    }
  }
  return out;
}

function printSteps(title, steps) {
  // eslint-disable-next-line no-console
  console.log(`\n${title}`);
  if (!steps?.length) {
    // eslint-disable-next-line no-console
    console.log('(none)');
    return;
  }
  for (let i = 0; i < steps.length; i++) {
    // eslint-disable-next-line no-console
    console.log(`${i + 1}. ${steps[i]}`);
  }
}

async function runOneFile(filePath) {
  const rawText = await fs.readFile(filePath, 'utf8');
  await runOneText({ label: `FILE: ${filePath}`, text: rawText });
}

async function runOneText({ label, text }) {
  // eslint-disable-next-line no-console
  console.log('\n' + '='.repeat(80));
  // eslint-disable-next-line no-console
  console.log(label);
  // eslint-disable-next-line no-console
  console.log(`CHARS: raw=${text.length}`);

  const client = new OpenAI({ apiKey });
  const systemInstruction = getExtractSopStepsSystemPrompt();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const completion = await client.chat.completions.create(
      {
        model: DEFAULT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: text },
        ],
        max_tokens: 800,
      },
      { signal: controller.signal }
    );

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      // eslint-disable-next-line no-console
      console.log('ERROR: empty AI response');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // eslint-disable-next-line no-console
      console.log('ERROR: AI returned non-JSON content');
      // eslint-disable-next-line no-console
      console.log(content);
      return;
    }

    if (parsed?.error) {
      // eslint-disable-next-line no-console
      console.log(`ERROR: ${String(parsed.error)}`);
      return;
    }

    const rawSteps = Array.isArray(parsed?.steps)
      ? parsed.steps
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean)
      : [];

    printSteps('RAW MODEL steps[]', rawSteps);
    printSteps('FINAL steps[] (no deterministic postprocess)', rawSteps);
  } finally {
    clearTimeout(timeout);
  }
}

function getSyntheticCases() {
  return [
    {
      label: 'SYNTHETIC: storyboard-table-with-noise',
      text: `
VR Training Simulation: Hybrid Battery Insulation Testing

Learner Profile: Techs new to this specific procedure.
Required Assets: busbars, cover, nuts, tray, megohmmeter, HV gloves.
NOTE NOTE NOTE 1111 2222: Ignore non-step text.

VR Simulation Storyboard

Key Step | Learner Interactions | Guidance | Rationale
1. Safety | Learner picks up and puts on the HV gloves. | Safety first. | ...
2. Setup | Learner picks up the tester; turns dial to 500V. | Select at least double voltage. | ...
3. Ground check | Connect black probe to case. Press Test and touch red probe to case. Confirm 0.00 MΩ. | ... | ...
4. Diagnose | Confirm safety plug removed. Press Test and touch red probe to positive. Press Test and touch red probe to negative. | ... | ...
5. Disassembly | Remove cover. Use nut driver to remove nuts. Remove busbars and place them in tray. | ... | ...
6. Cell test | Test each cell terminal methodically. Identify faulty cell with low reading. | ... | ...
7. Wrap-up | Complete test and review results on UI panel. | ... | ...
`.trim(),
    },
    {
      label: 'SYNTHETIC: messy-bullets-conditions',
      text: `
Procedure: Leak Check (Workshop)

Purpose: detect and isolate leaks. (not steps)

Steps:
- Wear PPE (gloves, goggles).
- Inspect hoses and fittings (look for cracks).
- If leak is suspected then spray soapy water.
- Observe bubbles and mark the leak location.
- Tighten the fitting and re-test.
- If bubbles persist, replace the hose.
- Record results in the log.
`.trim(),
    },
    {
      label: 'SYNTHETIC: duplicated-safety-and-appendix',
      text: `
SOP: Power Cycle Device

Safety: Wear gloves. Wear gloves. Wear gloves.

Appendix A: Tool list includes gloves, screwdrivers, busbars. (ignore)

Procedure
1. Put on gloves.
2. Press the Power button.
3. Wait 10 seconds.
4. Press the Power button again.
5. Verify the status light is green.
6. Document the result.
`.trim(),
    },
    {
      label: 'SYNTHETIC: out-of-order-notes',
      text: `
VR Simulation Storyboard
2. Setup
Learner picks up the meter and turns dial to 500V.
NOTE: End of test shows results on UI panel. (do not put first)
1. Safety
Learner puts on high-voltage gloves.
3. Test
Press Test. Touch red probe to case. Confirm reading.
4. Conclusion
Review results.
`.trim(),
    },
    {
      label: 'SYNTHETIC: not-a-procedure',
      text: `
Company: Acme Corp
Date: January 2025

This document outlines the roles and responsibilities of team leads in the
quality assurance department. Team leads are responsible for overseeing
daily operations, conducting performance reviews, and ensuring compliance
with company policies. They must also attend bi-weekly meetings with
management to discuss KPIs and improvement initiatives.

References: ISO 9001, Internal Policy Handbook Section 4.2
`.trim(),
    },
    {
      label: 'SYNTHETIC: nested-substeps-and-repeats',
      text: `
Procedure: Fire Extinguisher Inspection

Steps:
1. Verify the extinguisher is in its designated location.
2. Check the pressure gauge.
   a. The needle should be in the green zone.
   b. If the needle is in the red zone, tag the extinguisher for service.
3. Inspect the pin and tamper seal.
4. Examine the hose and nozzle for cracks or blockages.
5. Check the manufacture date and last service date on the label.
6. Weigh the extinguisher and compare to listed weight.
7. Clean the exterior of the extinguisher.
8. Sign and date the inspection tag.
9. Return the extinguisher to its mount.
`.trim(),
    },
  ];
}

async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(args.length ? 0 : 1);
  }

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.error('Missing OPENAI_API_KEY. Put it in .env.local or your environment.');
    process.exit(1);
  }

  if (args[0] === '--synthetic') {
    const count = Number(args[1] || '4');
    const cases = getSyntheticCases().slice(0, Math.max(1, Math.min(count, 50)));
    for (const c of cases) {
      // eslint-disable-next-line no-await-in-loop
      await runOneText({ label: c.label, text: c.text });
    }
    return;
  }

  const filePaths = [];
  for (const p of args) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    const files = await listTxtFilesRecursively(abs);
    for (const f of files) filePaths.push(f);
  }

  if (filePaths.length === 0) {
    // eslint-disable-next-line no-console
    console.error('No .txt files found in the provided paths.');
    process.exit(1);
  }

  for (const f of filePaths) {
    // eslint-disable-next-line no-await-in-loop
    await runOneFile(f);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

