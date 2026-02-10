# Worklog System

This directory contains the automatic worklog system that tracks all development activity.

## What Gets Logged

- **AI Sessions**: Every prompt you send to the AI, with a 1-2 sentence intention summary
- **Commits**: Every git commit with hash, message, and diffstat
- **Pushes**: Every git push with commit range
- **Feature Reviews**: Human-readable summaries generated at `/post-feature`

## Storage

### Raw Events (Local Only)
- **Location**: `.git/worklog/events.ndjson`
- **Format**: Newline-delimited JSON (NDJSON)
- **Privacy**: Never committed to git, stays local
- **Purpose**: Append-only event stream for reliable tracking

### Feature Reviews (Committed)
- **Location**: `docs/worklog/digests/YYYY-MM/branch-name.md`
- **Format**: Human-readable Markdown
- **Purpose**: Shareable feature summaries with full context

## How It Works

1. **Cursor Hooks** (`.cursor/hooks.json`) capture AI session events
2. **Git Hooks** (`.husky/`) capture commit and push events
3. **Generator** (`scripts/worklog/generateDigest.mjs`) creates Feature Reviews

## Privacy & Security

- Only **intention summaries** (1-2 sentences) are stored
- Full prompts/responses are NOT stored
- Prompts are hashed (SHA256, first 12 chars) for traceability
- All raw event logs stay local (never pushed)

## Usage

### Automatic
Everything is logged automatically as you work. No action required.

### Manual Digest Generation
```bash
node scripts/worklog/generateDigest.mjs
```

### View Your History
Browse `docs/worklog/digests/` for Feature Reviews organized by year-month.

## Schema

See `scripts/worklog/schema.mjs` for full event type definitions.

### Event Types
- `session_start`: AI session begins
- `session_end`: AI session completes (with insights)
- `commit`: Git commit created
- `push`: Git push executed
- `feature_digest`: Feature Review generated

## Troubleshooting

### Hooks Not Running
1. Ensure you're in a git repository
2. Check that `.cursor/hooks.json` and `.husky/` files exist
3. Verify Husky is installed: `npm run prepare` (if husky prepare script exists)

### No Events Logged
1. Check `.git/worklog/events.ndjson` exists and has content
2. Try manually triggering: `node .cursor/hooks/session-start.mjs` (with mock stdin)
3. Check git hooks are executable (on Unix systems)

### Digest Not Generating
1. Ensure events exist for the current branch
2. Check for errors: `node scripts/worklog/generateDigest.mjs`
3. Verify `docs/worklog/digests/` directory is writable

## Bypassing Hooks

Git hooks can be bypassed with:
```bash
git commit --no-verify
git push --no-verify
```

This is documented behavior. Use sparingly (for emergency fixes only).
