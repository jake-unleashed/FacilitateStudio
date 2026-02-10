# AI Workflow Automation

Slash commands for keeping Facilitate Studio production-ready.

---

## Philosophy

These commands are **action-oriented**. They don't just audit and report - they **find and fix issues**. The AI is trusted to:

1. Analyze the codebase deeply before acting
2. Make judgment calls on what needs fixing
3. Actually implement the fixes
4. Verify everything works

This works well with capable models (Claude Opus, GPT-4, etc.) that can understand context and make good decisions.

---

## Your Workflow

```
Plan (Cursor built-in) → Implement → /post-feature → Push
```

One command after implementing. It handles everything, including generating your Feature Review.

**Note**: Your work is automatically logged! Every prompt you send, every commit you make, and every push is captured in the worklog system. The `/post-feature` command generates a human-readable Feature Review from these events.

---

## Commands

### `/post-feature` - Make Production-Ready

**When**: After completing ANY feature, before pushing

**What it does**:
1. Analyzes your changes deeply
2. Fixes type safety issues
3. Adds missing error handling
4. Ensures edge cases are handled
5. Fixes accessibility issues
6. Adds missing tests
7. Runs all static checks
8. Verifies everything passes
9. **Generates Feature Review** with session timeline, commits, and insights

**Usage**:
```
/post-feature

I just finished implementing the duplicate step feature.
```

---

### `/refactor` - Improve Existing Code

**When**: Cleaning up code that already works, no new features

**What it does**:
1. Improves types, error handling, documentation
2. Splits large files
3. Removes dead code
4. Verifies behavior unchanged

**Usage**:
```
/refactor

Improve src/hooks/useModelUpload.ts
```

---

### `/health` - Weekly Codebase Audit

**When**: Weekly maintenance (e.g., Monday morning)

**What it does**:
1. Finds silent error handling
2. Audits type safety
3. Identifies oversized files
4. Checks test coverage
5. Reviews dependencies
6. Spots performance issues
7. Proposes or implements fixes

**Usage**:
```
/health
```

---

### `/release` - Pre-Deployment Check

**When**: Before deploying to production

**What it does**:
1. Removes debug code
2. Verifies build works
3. Runs full test suite
4. Checks critical paths
5. Verifies performance

**Usage**:
```
/release
```

---

### `/fix-tests` - Debug Failing Tests

**When**: Tests are failing

**What it does**:
1. Diagnoses the failure type
2. Identifies root cause
3. Fixes the issue
4. Verifies all tests pass

**Usage**:
```
/fix-tests

The GlobalPopup tests are timing out.
```

---

## Best Practices

### 1. Always Run `/post-feature` Before Pushing

This single command ensures your code is production-ready. Don't skip it.

### 2. Weekly `/health` Checks

Prevents technical debt from accumulating. Takes 15-20 minutes, saves hours later.

### 3. Use `/release` Before Deploys

Production bugs are expensive. The extra verification is worth it.

---

## File Locations

```
.cursorrules                    # Always-on project context
.cursor/commands/
├── post-feature.md             # /post-feature
├── refactor.md                 # /refactor
├── health-check.md             # /health
├── pre-release.md              # /release
└── fix-tests.md                # /fix-tests
```

---

## Automatic Worklog System

### What Gets Logged Automatically

The project includes an always-on worklog system that captures:

- **Every AI session**: When you prompt the AI, it logs the start time, your intention (1-2 sentence summary), and any insights from the response
- **Every commit**: Git automatically logs commit details (hash, message, files changed)
- **Every push**: Push events are logged with commit ranges
- **Feature Reviews**: Generated at `/post-feature` with full timeline and verification results

### Where Logs Are Stored

- **Raw events**: `.git/worklog/events.ndjson` (local-only, never committed, no merge conflicts)
- **Feature Reviews**: `docs/worklog/digests/YYYY-MM/branch-name.md` (committed to repo, human-readable)

### How It Works

1. **Cursor Hooks** capture your prompts and the AI's responses (as summaries only, not full text)
2. **Git hooks** (via Husky) capture commits and pushes
3. **`/post-feature`** generates a Feature Review markdown file from all captured events

### Privacy

- Only **intention summaries** (1-2 sentences) are stored, not full prompts/responses
- Prompts/responses are hashed for traceability without storing content
- All raw logs stay local in `.git/worklog/` (never pushed to remote)

### Manual Generation

To generate a Feature Review at any time:

```bash
node scripts/worklog/generateDigest.mjs
```

### Viewing Your Work History

Feature Reviews are organized by year-month in `docs/worklog/digests/` and include:
- Session timeline with intentions
- Commit history with diffstats
- Verification results (typecheck/lint/tests)
- Duration and timestamps
- Insights and notes from each session

---

## Customization

### Adding Commands

1. Create `.md` file in `.cursor/commands/`
2. Filename becomes command (`new-command.md` → `/new-command`)

### Modifying Commands

Edit the `.md` file directly. Changes take effect immediately.

### Updating Project Context

Edit `.cursorrules` to update the always-on context that informs all AI interactions.
