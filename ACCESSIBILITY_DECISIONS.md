# Accessibility Decisions

This document records **accessibility-related product decisions** so they remain consistent over time.

## Typography: minimum readable text size

### Decision
- **Minimum readable UI text size**: **12px** (`0.75rem`, Tailwind `text-xs`)
- **Scope**: All *functional/readable* text in the UI (labels, help text, metadata, button text, tooltips, etc.).
- **Non-goals**: This decision does not (by itself) address color contrast, focus/keyboard, ARIA, or screen reader semantics.

### Rationale (research-based)
- **WCAG 2.2 does not mandate a minimum font size.** Instead, it requires that text can be resized up to **200%** without loss of content or functionality (SC 1.4.4 “Resize text”). For contrast, WCAG uses “large text” thresholds to adjust contrast requirements, but still does not prescribe a base size.
  - WCAG 2.2: `https://www.w3.org/TR/WCAG22/`
- **Design system baselines typically use ~14–16px for body/UI text**, with smaller sizes reserved for captions:
  - GOV.UK: body is larger (often ~19px), and “body small” is **16px** (used sparingly): `https://design-system.service.gov.uk/styles/type-scale/`
  - Material: common body sizes include **14sp**, with **12sp** used for caption/small text: `https://m1.material.io/style/typography.html`
  - Microsoft/Windows: guidance commonly treats **12px regular** as a lower bound for legibility, with **14px** frequently used for stronger weights: `https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography`
- Given Facilitate Studio’s dense UI and the feedback that 14px felt too large for “small” UI text, **12px** is the smallest size we’ll allow for readable UI text, while keeping primary body text larger where appropriate.

### Implementation rules (Tailwind)
- **Use**:
  - `text-xs` for compact labels/metadata where space is tight.
  - `text-sm` (or larger) for primary reading content, paragraphs, and anything users must read comfortably for longer.
- **Avoid**:
  - Any size below `text-xs` (e.g. `text-[10px]`, `text-[11px]`, etc.).
  - Arbitrary pixel sizes in general (prefer Tailwind scale) unless there’s a documented exception.

### Exceptions policy (limited)
Text may be smaller than 12px **only if all are true**:
- **Non-essential**: Not required to operate the editor and not the only conveyer of meaning.
- **Not relied upon**: Users do not need to read it to understand state or complete tasks.
- **Documented**: The exception is listed below with a rationale.

#### Approved exceptions (current)
- **TopBar brand subtitle “Studio”** (`src/components/TopBar.tsx`): `text-[9px]` — non-essential branding text retained to match original logo proportions.

