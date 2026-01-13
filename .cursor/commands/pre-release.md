# Pre-Release Check

You're preparing to deploy. Your job is to **verify the build is production-ready** and **fix any issues** that would block release.

---

## 1. Console Cleanup

### Find and Remove Debug Code
Search for and remove:
- `console.log()` statements (keep `console.error` for real errors)
- `console.debug()` statements
- `debugger` statements

### Check Debug Flags
Search for development-only code that shouldn't ship:
- `IS_DEV` or `IS_DEBUG` flags exposing debug UI
- Test/mock data hardcoded in components
- Commented-out experimental code

**Action**: Remove or properly gate debug code.

---

## 2. Build Verification

### Clean Build
```bash
rm -rf dist/
npm run build
```

Must complete with no errors. Warnings should be reviewed.

### Preview the Build
```bash
npm run preview
```

Verify:
- App loads correctly
- No console errors
- Core features work

---

## 3. Full Test Suite

```bash
npm run typecheck && npm run lint && npm run test
```

All must pass. **Do not deploy with failing tests.**

---

## 4. Critical Path Smoke Test

Manually verify these core flows work:

### Project Management
- [ ] Create new project
- [ ] Open existing project  
- [ ] Save project
- [ ] Delete project

### Editor
- [ ] Import 3D model
- [ ] Select and move objects
- [ ] Add simulation step
- [ ] Edit step content

### Preview
- [ ] Enter preview mode
- [ ] Step through simulation
- [ ] Exit preview mode

If any fail → fix before deploying.

---

## 5. Error Handling Verification

Test that errors display correctly:
- [ ] Try to import an invalid file → should show error popup
- [ ] Try an operation that could fail → should handle gracefully

---

## 6. Performance Check

### Bundle Size
Check that bundle hasn't grown unexpectedly:
```bash
# Check dist folder size
ls -la dist/assets/
```

If significantly larger than before, investigate:
- New large dependencies?
- Unintended imports?
- Missing code splitting?

### Runtime
- App should load in < 3 seconds
- 3D scene should run at 60fps
- No obvious memory leaks

---

## 7. Final Checklist

| Check | Status |
|-------|--------|
| Debug logs removed | |
| Build succeeds | |
| TypeScript passes | |
| ESLint passes | |
| All tests pass | |
| Core flows work | |
| Errors display correctly | |
| Performance acceptable | |

---

## Output

### Issues Found and Fixed
List any issues you found and resolved

### Verification Results
```
build:     ✓ success
typecheck: ✓ passed
lint:      ✓ passed
tests:     ✓ X passed
```

### Manual Testing
- Core flows: ✓ working
- Error handling: ✓ working

### Ready to Deploy
**Yes** - all checks pass

or

**No** - [list blocking issues]
