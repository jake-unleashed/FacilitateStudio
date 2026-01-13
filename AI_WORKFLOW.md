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

One command after implementing. It handles everything.

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

## Customization

### Adding Commands

1. Create `.md` file in `.cursor/commands/`
2. Filename becomes command (`new-command.md` → `/new-command`)

### Modifying Commands

Edit the `.md` file directly. Changes take effect immediately.

### Updating Project Context

Edit `.cursorrules` to update the always-on context that informs all AI interactions.
