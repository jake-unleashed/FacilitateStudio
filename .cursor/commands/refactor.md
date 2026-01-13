# Refactor Code

You are improving existing code in Facilitate Studio **without changing its behavior**.

Target: **{{file_or_area}}**

---

## Rules

### DO
- Improve type safety
- Add missing error handling
- Add JSDoc documentation  
- Split large files
- Extract reusable logic
- Improve naming clarity
- Add missing tests
- Remove dead code

### DO NOT
- Change external behavior
- Add new features
- Modify public APIs
- Break existing tests

---

## Approach

1. **Understand first** - Read the code and understand what it does
2. **Identify improvements** - What would make this code better?
3. **Refactor incrementally** - Make changes one at a time
4. **Verify behavior unchanged** - Run tests after each significant change

---

## Refactoring Priorities

### 1. Type Safety
- Replace `any` with proper types
- Add missing return types
- Use discriminated unions for variants
- Remove unnecessary type assertions

### 2. Error Handling
- Add try/catch to async operations
- Use PopupContext for user-facing errors
- Add null checks where needed
- Remove silent catch blocks

### 3. Documentation
```typescript
/**
 * Brief description of what this does.
 * 
 * @param paramName - What this parameter is for
 * @returns What gets returned
 */
```

### 4. Code Organization
- Keep components under 300 lines
- Extract hooks for complex logic
- Group related code together
- Order: types → constants → main code → exports

### 5. Performance
- Memoize expensive computations
- Use useCallback for passed callbacks
- Dispose Three.js resources
- Avoid allocations in hot paths

---

## Verification

After refactoring, run:
```bash
npm run typecheck && npm run lint && npm run test
```

**All must pass.** If tests fail, the refactoring changed behavior - fix it.

---

## Output

### Changes Made
List each improvement:
- [What was changed] - [Why it's better]

### Tests
- Existing tests: ✓ still pass
- New tests added: [list if any]

### Verification
```
typecheck: ✓
lint: ✓
tests: ✓
```
