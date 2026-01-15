# Post-Feature: Make Production-Ready

You've completed a feature for Facilitate Studio. Your job is to **make this code production-ready** before it gets pushed.

Don't just audit - **actively find and fix issues**. Use extended thinking to deeply analyze the code first, then make the necessary improvements.

---

## Your Mission

Make the recently implemented feature production-ready by:
1. Improving code quality (types, error handling, documentation)
2. Ensuring robustness (edge cases, accessibility)
3. Verifying correctness (tests pass, static analysis clean)

**Approach**: Analyze thoroughly first, then fix what needs fixing. Use your judgment - you understand the codebase patterns.

---

## Phase 1: Deep Analysis

Before making changes, analyze the new/modified code:

1. **Read the changed files** and understand what was implemented
2. **Check patterns** against existing codebase conventions
3. **Identify gaps** in error handling, types, tests, accessibility
4. **Plan fixes** before executing them

Take time to think through this thoroughly.

---

## Phase 2: Code Quality Fixes

### Type Safety
Find and fix:
- Any `any` types → replace with proper types or `unknown`
- Missing return types on functions
- Loose types that should be specific interfaces
- Type assertions (`as`) that could be avoided with better typing

### Error Handling
Find and fix:
- Async operations without try/catch
- Errors not shown to users via PopupContext
- Silent catch blocks that swallow errors
- Missing null/undefined checks

The pattern to follow:
```typescript
const { showPopup } = usePopup();

try {
  await riskyOperation();
} catch (error) {
  console.error('[ComponentName] Operation failed:', error);
  showPopup({
    type: 'error',
    title: 'Operation Failed',
    message: error instanceof Error ? error.message : 'An unexpected error occurred'
  });
}
```

### Documentation
Add where missing:
- JSDoc on exported functions (parameters, return values, purpose)
- Comments explaining non-obvious logic
- Update affected docs if behavior changed

### Code Organization
Fix if needed:
- Components over 300 lines → split into sub-components or extract hooks
- Duplicate logic → extract to utils or custom hooks
- Messy imports → organize (external → internal → relative)

### Performance
Verify and fix:
- Expensive computations wrapped in `useMemo`
- Callbacks passed to children wrapped in `useCallback`
- Three.js resources properly disposed in cleanup
- No objects created inside render loops

---

## Phase 3: Robustness

### Edge Cases
Ensure the code handles:
- Empty arrays/objects (don't call `.map` on undefined)
- Null/undefined props (use defaults or early returns)
- Boundary values (very long strings, large numbers, zero, negative)
- Loading and error states

### Accessibility
Fix any issues with:
- Missing `aria-label` on icon-only buttons
- Non-semantic HTML (`<div onClick>` should be `<button>`)
- Missing keyboard support (can users Tab and Enter through the feature?)
- Focus management (does focus go somewhere sensible?)

---

## Phase 4: Testing

### Run Tests (once)
```bash
npm run test
```

If tests hang, run diagnostics:
```bash
npm run test:diagnose
```

If tests fail, fix the code or update the tests as appropriate. Avoid re-running the full suite more than once.

### Add Missing Tests

For new functionality, add tests covering:
- Basic rendering / happy path
- User interactions (clicks, input, keyboard)
- Edge cases (empty data, error states)
- Accessibility (correct roles, labels)

Follow the existing test patterns in the codebase.

---

## Phase 5: Static Analysis

Run and fix any issues:

```bash
npm run typecheck
npm run lint
```

Only run formatting when needed (for example if lint reports formatting issues):
```bash
npm run format
```

All must pass with no errors. Fix issues rather than suppressing them.

---

## Phase 6: Final Verification

Run any checks you have not already run in this session:
```bash
npm run typecheck
npm run lint
npm run test
```

All green = ready to push.

---

## Output

When complete, summarize:

### Changes Made
- List the improvements you made (type fixes, error handling, tests added, etc.)

### Verification
```
typecheck: ✓ passed
lint:      ✓ passed  
tests:     ✓ X passed
```

### Status
Ready to push: **Yes** / **No** (with explanation if no)

---

## Standards Reference

These are the project's quality standards (also in `.cursorrules`):

| Area | Standard |
|------|----------|
| Types | No `any`, use strict typing |
| Errors | Show to users via PopupContext, log to console |
| React | Memoize callbacks passed as props |
| Three.js | Dispose resources, pre-allocate objects |
| Tests | Co-located with source, cover happy path + edge cases |
| A11y | Semantic HTML, ARIA labels, keyboard support |
| Files | Components < 300 lines, hooks < 200 lines |
