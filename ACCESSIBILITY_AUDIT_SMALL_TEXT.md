# Accessibility Audit: Small Text (Historical)

Date: 2026-01-20

## Policy reference
- See `ACCESSIBILITY_DECISIONS.md` → **Typography: minimum readable text size**.
- This audit was originally created during an earlier pass that attempted a **14px minimum**.
- **Current policy** (as of 2026-01-20): minimum readable UI text is **12px** (`text-xs`), with an approved **brand subtitle exception** in `src/components/TopBar.tsx`.

## Findings (pre-fix)

### Sub-14px arbitrary sizes (`text-[Npx]` where N < 14)
All items below were candidates for upgrade during the initial audit. The project has since moved to a **12px minimum** and generally **avoids arbitrary pixel sizes**, except where explicitly approved.

- **`src/components/NavigationHelp.tsx`**
  - `text-[8px]` (keycap/shortcut chip)
  - `text-[9px]` (instruction text)
  - `text-[10px]` (section headers + action labels)
- **`src/components/TopBar.tsx`**
  - `text-[9px]` (brand subtitle)
- **`src/pages/PublishedSimulationPage.tsx`**
  - `text-[9px]` (floating status pill)
- **`src/components/RightSidebar.tsx`**
  - `text-[9px]` (small metadata + range labels)
  - `text-[10px]` (labels + mono badges)
  - `text-[11px]` (tooltip text)
- **`src/components/LeftSidebar.tsx`**
  - `text-[10px]` (small labels)
  - `text-[11px]` (uppercase section chips)
- **`src/components/StepCard.tsx`**
  - `text-[11px]` (helper/description text)
- **`src/components/preview/PreviewStepExecutor.tsx`**
  - `text-[10px]` (status text style constant)
- **`src/components/DebugMenu.tsx`**
  - `text-[10px]` (section headings)
- **`src/components/PerformanceMonitor.tsx`**
  - `text-[10px]` (labels/icons)
- **`src/pages/HomePage.tsx`**
  - `text-[10px]` (subtext row)
- **`src/components/Input.tsx`**
  - `text-[10px]` (field label)

### Tailwind `text-xs` usages (12px)
These were previously targeted for upgrade during the initial 14px pass. Under the **current** policy, `text-xs` is allowed for compact labels/metadata.

Found in:
- `src/components/StepCard.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/SaveOverlay.tsx`
- `src/components/PublishModal.tsx`
- `src/components/LeftSidebar.tsx`
- `src/components/preview/PreviewStepExecutor.tsx`
- `src/components/RecordingModeOverlay.tsx`
- `src/components/RecentAssetsList.tsx`
- `src/components/AssetUploadButton.tsx`
- `src/components/PerformanceMonitor.tsx`
- `src/components/scene/transformGizmo/GizmoTooltip.tsx`
- `src/components/RightSidebar.tsx`
- `src/pages/HomePage.tsx`
- `src/components/Input.tsx` (mono variant)
- `src/components/Button.tsx` (button size `sm`)
- `src/components/Button.test.tsx` (expects `text-xs` in tests)

## Remediation intent
- Historical note: remediation steps here reflect the earlier 14px attempt.
- For the current state, rely on:
  - `ACCESSIBILITY_DECISIONS.md` for the minimum (12px) and exceptions.
  - `check-typography-min-text.mjs` for enforcement in `src/`.

