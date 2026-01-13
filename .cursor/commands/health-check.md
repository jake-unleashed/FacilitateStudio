# Codebase Health Check

Run this weekly to find and fix technical debt before it accumulates.

**Approach**: Don't just report issues - **propose specific fixes** or fix them directly if straightforward. Use your judgment on what needs immediate attention vs. what can be noted for later.

---

## 1. Error Handling Audit

### Find Silent Failures
Search for catch blocks that don't notify users:
- Empty catch blocks
- Catch blocks with only `console.log`/`console.error`
- Errors that should use PopupContext but don't

**Action**: Fix critical ones (user-facing operations). Note others for backlog.

### Check Error Patterns
Verify error handling follows the project pattern:
```typescript
try {
  await operation();
} catch (error) {
  console.error('[Context] Description:', error);
  showPopup({ type: 'error', title: '...', message: '...' });
}
```

---

## 2. Type Safety Audit

### Find Type Issues
Search for and assess:
- Explicit `any` types
- `// @ts-ignore` or `// @ts-expect-error` comments
- `as unknown as` type assertions
- Implicit `any` from missing types

**Action**: Fix the easy ones. For complex ones, note what proper typing would require.

---

## 3. File Size Analysis

### Check for Oversized Files

| Type | Threshold | Action |
|------|-----------|--------|
| Components | > 400 lines | Must split |
| Hooks | > 250 lines | Should split |
| Utils | > 200 lines | Consider splitting |

**Action**: For files over threshold, propose how to split them (what sub-components, what extracted hooks, etc.)

---

## 4. Test Coverage

### Run Coverage Report
```bash
npm run test:coverage
```

### Identify Gaps
Focus on untested:
- User-facing functionality
- Error handling paths
- Edge cases in critical utils

**Action**: Note the most important missing tests. Propose what they should cover.

---

## 5. Dependency Health

### Check for Issues
```bash
npm audit
npm outdated
```

**Action**: 
- Security vulnerabilities → recommend updating
- Major version updates → note for consideration
- Unused dependencies → recommend removal

---

## 6. Performance Review

### Three.js Resources
Check for potential memory leaks:
- `new THREE.*` without corresponding `.dispose()`
- Missing cleanup in useEffect
- Objects created in render loops

### React Performance
Check for:
- Missing dependency arrays
- Functions defined inline without useCallback
- Large objects in dependency arrays that should be refs

**Action**: Fix clear issues. Note patterns that need attention.

---

## 7. Accessibility Spot Check

Pick 2-3 components and verify:
- Interactive elements are focusable
- Buttons have accessible names
- Keyboard navigation works

**Action**: Fix issues found. Note patterns to apply elsewhere.

---

## 8. Documentation Check

### Find Gaps
- Exported functions without JSDoc
- Complex logic without explanatory comments
- Outdated comments that don't match code

**Action**: Add critical documentation. Note what else needs docs.

---

## 9. Dead Code

### Find and Remove
- Unused exports
- Commented-out code blocks
- Obsolete TODO comments

**Action**: Remove what's clearly dead. Note uncertain cases.

---

## Output

### Critical Issues (Fix Now)
Issues that could cause bugs or are easy wins:
1. [Issue] in [file] - [fix applied or proposed fix]

### Medium Priority (Fix This Week)
Issues that should be addressed soon:
1. [Issue] in [file] - [proposed fix]

### Low Priority (Backlog)
Technical debt to track:
1. [Issue] in [file] - [notes]

### Metrics Summary
```
Files over size limit: X
Test coverage: XX%
Type issues found: X  
Security vulnerabilities: X
```

### Recommendations
Top 3 things to focus on this week:
1. ...
2. ...
3. ...
