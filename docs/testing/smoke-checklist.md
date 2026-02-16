# Smoke Checklist (Demo + Early Production)

Use this checklist after dependency or runtime changes to catch regressions quickly.

## Preconditions

- Install deps: `npm install`
- Build once: `npm run build`
- Start app: `npm run dev`
- (SOP extract check) Start dev API in another terminal: `npm run dev:api`

## Manual Smoke Steps

1. **Editor loads**
   - Open `/editor` from Home.
   - Verify the canvas, top bar, and left panels render with no blocking error popup.
2. **Model upload works**
   - Upload a small `.glb` or `.fbx`.
   - Verify it appears in scene and in recent assets.
3. **Step creation works**
   - Add an info-card step, then a move-item step.
   - Verify both appear in step list and can be selected.
4. **SOP extract endpoint responds (dev)**
   - In SOP upload flow, upload a sample PDF/DOCX.
   - Verify extraction returns step suggestions (or explicit handled error), not network failure.
5. **Publish flow happy path**
   - Publish a project from editor.
   - Open generated published link and verify snapshot loads.

## Fast Failure Signals

- Browser console has uncaught exceptions.
- Network panel shows repeated 4xx/5xx calls for core flows.
- Upload/import buttons stop responding after first action.
- Editor route hangs on loading state for more than 5 seconds on local dev.
