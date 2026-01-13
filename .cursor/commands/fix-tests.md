# Fix Failing Tests

Tests are failing. Your job is to **diagnose and fix them**.

---

## Step 1: Run Tests and Capture Output

```bash
npm run test
```

Read the error output carefully. Identify:
- Which tests are failing
- What type of failure (assertion, timeout, missing element, etc.)
- The relevant file and line numbers

---

## Step 2: Diagnose the Root Cause

### Common Failure Types

**Assertion Failure** (`Expected X, received Y`)
- Is the test expectation correct, or did intended behavior change?
- Is there a bug in the implementation?
- Fix whichever is wrong.

**Element Not Found** (`Unable to find element...`)
- Element renders asynchronously → wrap in `await waitFor()`
- Element is conditionally rendered → trigger the condition first
- Query is wrong → check the actual rendered output
- Element is in a portal → query differently

```typescript
// Fix for async rendering
await waitFor(() => {
  expect(screen.getByText('Hello')).toBeInTheDocument();
});

// Or use findBy (auto-waits)
const element = await screen.findByText('Hello');
```

**Mock Not Working** (real implementation called)
- Mock not hoisted → move `vi.mock()` to top of file
- Mock path doesn't match import path exactly
- Mock not reset → add `vi.clearAllMocks()` in beforeEach

```typescript
// At TOP of file
vi.mock('../utils/someModule', () => ({
  someFunction: vi.fn(() => 'mocked')
}));

// In test setup
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Context Missing** (`useXxx must be used within XxxProvider`)
- Component needs to be wrapped in provider

```typescript
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <PopupProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </PopupProvider>
  );
}
```

**Timeout** (test takes too long)
- Unresolved promise → check async logic
- Infinite loop → check useEffect dependencies
- Missing await → add await before async operations

---

## Step 3: Fix the Issue

Based on your diagnosis:

1. **If the test is wrong** → Update the test to match correct behavior
2. **If the implementation is wrong** → Fix the implementation
3. **If it's a test setup issue** → Fix the test infrastructure

Make the minimal change needed. Don't refactor while fixing.

---

## Step 4: Verify the Fix

```bash
npm run test
```

All tests should pass. If fixing one test broke another, you may have uncovered a real bug.

---

## Step 5: Check Types Too

```bash
npm run typecheck
```

Make sure your fix didn't introduce type errors.

---

## Debugging Commands

```bash
# Run specific test file
npm run test -- src/components/Button.test.tsx

# Run tests matching a pattern
npm run test -- --grep "should render"

# Run with verbose output
npm run test -- --reporter=verbose

# Watch mode for iteration
npm run test:watch
```

---

## Output

### Root Cause
What was actually wrong (be specific)

### Fix Applied
What you changed and why

### Verification
```
tests: ✓ all passing
typecheck: ✓ no errors
```
