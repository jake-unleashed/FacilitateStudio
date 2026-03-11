import process from 'node:process';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DEFAULT_COUNT = 10;
const DEFAULT_DOMAIN = 'example.com';
const DEFAULT_PREFIX = 'facilitate-tester';
const DEFAULT_PASSWORD_PREFIX = 'FacilitateBeta';

function usage() {
  // eslint-disable-next-line no-console
  console.log(`
Usage:
  npm run beta:create-testers
  node scripts/createTesterAccounts.mjs [count]
  node scripts/createTesterAccounts.mjs --count 10 --domain example.com

Environment:
  SUPABASE_SERVICE_ROLE_KEY   (required, server-only)
  SUPABASE_URL               (preferred)
  VITE_SUPABASE_URL          (fallback if SUPABASE_URL is unset)

Defaults:
  count=${DEFAULT_COUNT}
  prefix=${DEFAULT_PREFIX}
  domain=${DEFAULT_DOMAIN}
  password format=${DEFAULT_PASSWORD_PREFIX}-001!

Notes:
  - Creates accounts like facilitate-tester-001@example.com.
  - Existing users are skipped by default.
  - Users are marked confirmed so no email inbox is required.
`.trim());
}

function parseArgs(argv) {
  const args = argv
    .slice(2)
    .filter(Boolean)
    .filter((arg) => arg !== '--');
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  let count = DEFAULT_COUNT;
  let domain = DEFAULT_DOMAIN;
  let prefix = DEFAULT_PREFIX;
  let passwordPrefix = DEFAULT_PASSWORD_PREFIX;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;

    if (/^\d+$/.test(arg)) {
      count = Number(arg);
      continue;
    }

    if (arg === '--count') {
      count = Number(args[index + 1] ?? DEFAULT_COUNT);
      index += 1;
      continue;
    }

    if (arg === '--domain') {
      domain = args[index + 1] ?? DEFAULT_DOMAIN;
      index += 1;
      continue;
    }

    if (arg === '--prefix') {
      prefix = args[index + 1] ?? DEFAULT_PREFIX;
      index += 1;
      continue;
    }

    if (arg === '--password-prefix') {
      passwordPrefix = args[index + 1] ?? DEFAULT_PASSWORD_PREFIX;
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(count) || count <= 0 || count > 500) {
    throw new Error('Count must be an integer between 1 and 500.');
  }

  return {
    count,
    domain,
    prefix,
    passwordPrefix,
    dryRun,
  };
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Put it in .env.local or your environment.`);
  }
  return value;
}

function formatIndex(index) {
  return String(index).padStart(3, '0');
}

function buildEmail(prefix, index, domain) {
  return `${prefix}-${formatIndex(index)}@${domain}`;
}

function buildPassword(passwordPrefix, index) {
  return `${passwordPrefix}-${formatIndex(index)}!`;
}

async function listExistingEmails(supabaseAdmin) {
  const emails = new Set();
  let page = 1;
  const perPage = 200;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list existing auth users: ${error.message}`);
    }

    const users = data?.users ?? [];
    for (const user of users) {
      if (typeof user.email === 'string' && user.email.trim()) {
        emails.add(user.email.trim().toLowerCase());
      }
    }

    hasMore = users.length === perPage;
    page += 1;
  }

  return emails;
}

async function main() {
  const options = parseArgs(process.argv);
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL. Put it in .env.local or your environment.');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const existingEmails = await listExistingEmails(supabaseAdmin);
  const created = [];
  const skipped = [];

  for (let index = 1; index <= options.count; index += 1) {
    const email = buildEmail(options.prefix, index, options.domain);
    const password = buildPassword(options.passwordPrefix, index);

    if (existingEmails.has(email.toLowerCase())) {
      skipped.push({ email, reason: 'already exists' });
      continue;
    }

    if (options.dryRun) {
      created.push({ email, password, created: false, mode: 'dry-run' });
      continue;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        accountType: 'tester',
        source: 'bulk-tester-script',
      },
    });

    if (error) {
      throw new Error(`Failed to create ${email}: ${error.message}`);
    }

    created.push({
      email,
      password,
      userId: data.user?.id ?? '(unknown)',
      created: true,
      mode: 'created',
    });
  }

  const createdLabel = options.dryRun ? 'Planned' : 'Created';
  // eslint-disable-next-line no-console
  console.log(`\nTester account generation complete.`);
  // eslint-disable-next-line no-console
  console.log(`${createdLabel}: ${created.length}`);
  // eslint-disable-next-line no-console
  console.log(`Skipped: ${skipped.length}`);

  if (created.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`\n${createdLabel} accounts:`);
    // eslint-disable-next-line no-console
    console.table(
      created.map((entry) => ({
        email: entry.email,
        password: entry.password,
        userId: entry.userId ?? '',
        mode: entry.mode,
      }))
    );
  }

  if (skipped.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\nSkipped accounts:');
    // eslint-disable-next-line no-console
    console.table(skipped);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
