# Philip Feedback Backlog — Feb 10, 2026

**Source**: Philip's UI/UX review of https://facilitate-studio-g5tm.vercel.app/

**Purpose**: Single source of truth for actionable items extracted from Philip's feedback. This backlog enables multiple AI agents and threads to work through items systematically without conflicts.

---

## How to Use This Backlog

### Next Item Rule

The **next item to work on** is determined by:
1. **Status = TODO** (skip IN_PROGRESS, DONE, BLOCKED)
2. **Priority order**: P0 → P1 → P2 (P0 first)
3. **Tie-breaker**: Lowest numeric ID

Example: If FS-001 (P0), FS-007 (P0), and FS-004 (P1) are all TODO, work on FS-001 first.

### Operating Procedure

**Before starting work:**
1. Find the next item using the rule above
2. **Claim it** by editing the item header:
   - Change `Status: TODO` → `Status: IN_PROGRESS`
   - Add `Owner: <your agent/thread name>`
   - Optionally add `Branch/PR: <link>` if tracking

**While working:**
- Focus only on that item's acceptance criteria
- Follow constraints in `STYLE_GUIDE.md` and patterns in the codebase
- Do not invent new parallel systems; reuse existing components/hooks

**After completing:**
1. Set `Status: DONE`
2. Add a `Notes/Verification:` section with 1–3 bullets describing what was changed and how it was verified
3. Run the quality workflow from `AI_WORKFLOW.md` (typically `/post-feature`)

**If blocked:**
1. Set `Status: BLOCKED`
2. Add a `Blocker:` line explaining the issue
3. Move to the next item

---

## Agent Delegation Prompt (Copy/Paste)

Use this prompt to hand work to another AI agent or thread:

```
You are working on the next item from Philip's feedback backlog.

1. Read `docs/backlog/feedback-philip-2026-02-10.md`
2. Find the next item: Status=TODO, Priority P0 first, then lowest ID
3. Claim it: set Status=IN_PROGRESS and Owner=<your name>
4. Implement only that item according to its acceptance criteria
5. Constraints:
   - Follow `STYLE_GUIDE.md` for UI/styling
   - Reuse existing patterns and hooks (see existing components)
   - Avoid inventing new parallel logic
6. After implementation:
   - Mark Status=DONE with Notes/Verification
   - Run `/post-feature` from `AI_WORKFLOW.md` to verify quality
```

---

## Quality Standards

All implementations must meet the standards defined in:
- **`AI_WORKFLOW.md`**: Quality workflow (run `/post-feature` before considering work done)
- **`STYLE_GUIDE.md`**: UI styling, glass panels, typography, colors, border radius
- **`.cursorrules`**: TypeScript patterns, React patterns, Three.js best practices, error handling

---

## Backlog Items

---

### FS-001: Protect minimum main workspace size

**Priority**: P0  
**Status**: TODO  
**Owner**: —

**Source quote** (Philip):
> "The main working real estate is ok, but i'd make sure it doesn't get any smaller; mind you this was with both menus open"

**Decision**: 
Ensure the main 3D canvas/workspace area maintains a minimum usable width even when both side panels (left navigation and right properties) are open. Add responsive behavior or constraints to prevent the workspace from becoming unusably narrow.

**Acceptance criteria**:
- [ ] Identify current minimum workspace width with both panels open
- [ ] Define and enforce a minimum workspace width (suggest ≥600px for usable 3D interaction)
- [ ] Add CSS constraints or layout logic to prevent panels from squeezing workspace below minimum
- [ ] Test on typical desktop resolutions (1920x1080, 1440x900) with both panels open
- [ ] Verify 3D controls (rotation, zoom, selection) remain usable at minimum width
- [ ] Document the minimum supported viewport width

**Implementation notes**:
- Likely areas: main layout component (check `src/App.tsx` or main layout structure)
- May involve CSS `min-width` on canvas container or flexbox constraints
- Consider panel collapse behavior if viewport is too narrow
- Check existing responsive breakpoints in `tailwind.config.js`

**Test plan**:
1. Open both side panels (navigation + properties)
2. Resize browser window to narrow widths
3. Verify workspace doesn't shrink below minimum
4. Verify 3D camera controls remain functional
5. Test on multiple screen sizes

---

### FS-002: Remove "Transform" term; rename to "Record/set object end position"

**Priority**: P0  
**Status**: TODO  
**Owner**: —

**Source quote** (Philip):
> "With the Snap To / Move item action, lets change the wording from Transform to 'Record/set object end position' and remove all reference to the term Transform."

**Decision**: 
Find all UI references to "Transform" in the context of the Snap To / Move item step type and replace with "Record/set object end position" or similar clear wording. Remove the term "Transform" entirely from user-facing copy in this feature.

**Acceptance criteria**:
- [ ] Audit codebase for "Transform" string in UI components related to Move item / Snap To
- [ ] Replace button/label text with "Record/set object end position" or "Set end position"
- [ ] Update any tooltips, help text, or placeholder text referencing "Transform"
- [ ] Verify no user-facing "Transform" references remain in this feature area
- [ ] Check for consistency: use same wording across all instances
- [ ] Update any related type definitions or comments if they use "Transform" in user-facing contexts

**Implementation notes**:
- Likely areas: `src/components/stepCard/` (step type UI components)
- Check `MoveItemSection` component and related files
- May also appear in step creation flows or property panels
- Grep for "Transform" in `.tsx` files to find all occurrences

**Test plan**:
1. Create a new Move item / Snap To step
2. Verify button/action text shows new wording
3. Check tooltips and help text
4. Verify no "Transform" appears in UI for this feature
5. Test full step creation and editing flow

---

### FS-003: Add undo buttons (and redo if appropriate)

**Priority**: P0  
**Status**: TODO  
**Owner**: —

**Source quote** (Philip):
> "The Autosave works very well, although the undo buttons will be useful to have"

**Decision**: 
Surface undo/redo UI controls (buttons) so users can easily revert changes. Check if undo/redo functionality already exists in `src/hooks/undoRedo/` and wire it to visible UI buttons.

**Acceptance criteria**:
- [ ] Verify undo/redo functionality exists or implement it (check `src/hooks/undoRedo/`)
- [ ] Add undo button to main toolbar/header (keyboard shortcut: Ctrl/Cmd+Z)
- [ ] Add redo button to main toolbar/header (keyboard shortcut: Ctrl/Cmd+Shift+Z)
- [ ] Disable buttons when undo/redo stack is empty (visual feedback)
- [ ] Test undo/redo across major actions: add object, move object, create step, edit step, delete step
- [ ] Add tooltips to buttons showing keyboard shortcuts

**Implementation notes**:
- Likely areas: check `src/hooks/undoRedo/` for existing implementation
- Main toolbar/header component (likely in `src/components/` or `src/pages/`)
- Use icons from `lucide-react` (Undo, Redo icons)
- Follow `STYLE_GUIDE.md` for button styling
- May need to integrate with existing autosave logic

**Test plan**:
1. Perform several actions (add objects, create steps, move items)
2. Click undo button and verify last action reverts
3. Click redo button and verify action is reapplied
4. Test keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
5. Verify buttons are disabled when stacks are empty
6. Test edge cases: undo after autosave, multiple undos in sequence

---

### FS-004: Optional "?" hover explainer for end-position action

**Priority**: P1  
**Status**: TODO  
**Owner**: —

**Source quote** (Philip):
> "a little '?' explain hover thing might be good as well, but not required"

**Decision**: 
Add a small "?" icon next to the "Record/set object end position" action that shows a tooltip/popover explaining what this action does when hovered.

**Acceptance criteria**:
- [ ] Add a small "?" icon next to the end-position action label
- [ ] Show explanatory tooltip on hover (e.g., "Sets where the object will move to when this step plays")
- [ ] Style consistently with existing help icons/tooltips in the app
- [ ] Ensure tooltip is accessible (keyboard focus, ARIA labels)
- [ ] Keep explanation concise (1–2 sentences)

**Implementation notes**:
- Likely areas: `src/components/stepCard/MoveItemSection` or related component
- Use `lucide-react` HelpCircle icon
- Check if app has existing tooltip component/pattern to reuse
- Follow `STYLE_GUIDE.md` for icon sizing and tooltip styling

**Test plan**:
1. Open Move item step editor
2. Hover over "?" icon
3. Verify tooltip appears with clear explanation
4. Test keyboard navigation (focus + Enter/Space)
5. Verify tooltip dismisses appropriately

---

### FS-005: Preview camera improvements (future consideration)

**Priority**: P1  
**Status**: TODO  
**Owner**: —

**Source quote** (Philip):
> "I like not having the WASD movement options, but i wonder if maybe having a pan and zoom option, like in the editor itself might be nice. I can imagine that in time there will be steps that require a more close up view than others. Not something we need right now for sure, but might be an issue later on?"
> "What might work well is to be able to 'set' the level of zoom and basic position of the camera when you add the step, that way the creator can emphasise what's required but the learner doesn't have to pan/zoom, anyways just a thought."

**Decision**: 
Track this as a future improvement. Two potential approaches:
1. Add pan/zoom controls to Preview mode (like editor)
2. Allow creator to set camera position/zoom per step (learner sees that view automatically)

This is explicitly "not needed right now" but worth tracking for later.

**Acceptance criteria**:
- [ ] Document the two potential approaches in detail
- [ ] Spike/prototype: test per-step camera framing (option 2) as it seems more aligned with Philip's suggestion
- [ ] If implementing option 2: add camera position fields to step data model
- [ ] If implementing option 2: capture camera position when creating/editing step
- [ ] If implementing option 2: apply saved camera position when step loads in Preview
- [ ] If implementing option 1: add pan/zoom controls to Preview mode UI

**Implementation notes**:
- Likely areas: `src/components/preview/` for Preview mode components
- Step data model in `src/types/` (add camera position fields)
- Camera controls: check existing camera-controls library usage
- May need to store camera position as part of SimStep type

**Test plan**:
1. Create steps with different camera positions
2. Enter Preview mode
3. Verify each step shows intended camera view
4. Test that learners don't need to adjust camera manually
5. Verify smooth transitions between step camera positions

---

### FS-006: Performance tracking for large models

**Priority**: P1  
**Status**: TODO  
**Owner**: —

**Source quote** (Philip):
> "FYI when i added a 300K poly model the selection of individual components in another object and the preview loading slowed considerably; guess that's a no brainer but just wanted to point it out."

**Decision**: 
Track this as a known performance issue. Consider adding:
1. Model complexity warnings (poly count thresholds)
2. Performance optimizations (LOD, instancing, culling)
3. UX mitigations (loading states, progress indicators)

**Acceptance criteria**:
- [ ] Measure and document current performance thresholds (poly count where slowdown occurs)
- [ ] Add poly count detection when models are loaded
- [ ] Display warning if model exceeds recommended poly count (e.g., >100K)
- [ ] Add loading indicators for Preview mode when large models are present
- [ ] Consider: add model optimization suggestions in UI
- [ ] Document recommended model complexity guidelines for users

**Implementation notes**:
- Likely areas: `src/hooks/useModelUpload.ts` for poly count detection
- Preview loading: `src/components/preview/` components
- Warning UI: integrate with PopupContext or inline warnings
- May need to access Three.js geometry data to count polygons
- Check existing performance patterns in Three.js scene components

**Test plan**:
1. Upload a large model (>100K polys)
2. Verify warning appears
3. Test selection performance with large model in scene
4. Test Preview loading time
5. Verify loading indicators appear appropriately
6. Test with multiple large models

---

### FS-007: Add starter 3D model library

**Priority**: P0  
**Status**: TODO  
**Owner**: —

**Source quote** (Philip):
> "Two nice to haves before we put this in front of testers might be: Having a small library of 3d models they can start to use straight away"

**Decision**: 
Provide a built-in library of 3D models (5–10 common industrial/generic objects) that users can add to their scene without uploading. This removes friction for testers and new users.

**Acceptance criteria**:
- [ ] Curate 5–10 starter models (common objects: cube, cylinder, generic equipment, etc.)
- [ ] Store models in `public/models/` or similar accessible location
- [ ] Add "Model Library" or "Add from Library" UI in the scene
- [ ] Display thumbnails/previews of available models
- [ ] Allow users to click and add library models to scene
- [ ] Ensure library models have reasonable poly counts and proper scale
- [ ] Test that library models work with all existing features (move, label, steps)

**Implementation notes**:
- Likely areas: Add new UI component for model library (modal or side panel)
- Store models in `public/models/library/` with metadata JSON
- May need thumbnails for each model (or generate them)
- Integration point: wherever users currently upload models
- Consider using existing model upload hooks but with pre-loaded paths

**Test plan**:
1. Open model library UI
2. Browse available starter models
3. Add several models to scene
4. Verify models load correctly with proper scale/position
5. Create steps using library models
6. Verify library models work with all step types

---

### FS-008: Add selectable backgrounds

**Priority**: P0  
**Status**: TODO  
**Owner**: —

**Source quote** (Philip):
> "Two nice to haves before we put this in front of testers might be: [...] Being able to add a few different backgrounds, these could be 360 images or our existing CGI enviros."

**Decision**: 
Add a background/environment selector that allows users to choose from several pre-loaded options: 360-degree images or existing CGI environments. This improves visual quality and context for simulations.

**Acceptance criteria**:
- [ ] Curate 3–5 background options (neutral studio, industrial, outdoor, etc.)
- [ ] Store backgrounds in `public/environments/` or similar
- [ ] Add background selector UI (dropdown or gallery in settings/toolbar)
- [ ] Apply selected background to Three.js scene (as skybox or environment map)
- [ ] Persist background choice with project save/load
- [ ] Ensure backgrounds work in both Editor and Preview modes
- [ ] Test that backgrounds don't negatively impact performance

**Implementation notes**:
- Likely areas: Scene setup in `src/components/scene/` (Three.js scene background)
- Background selector UI: likely in toolbar or settings panel
- Use Three.js `scene.background` and/or `scene.environment` with TextureLoader
- For 360 images: use equirectangular textures
- May need to integrate with existing scene state management

**Test plan**:
1. Open background selector
2. Preview each background option
3. Select a background and verify it applies to scene
4. Save project and reload; verify background persists
5. Test in Preview mode
6. Verify lighting/reflections work correctly with backgrounds

---

### FS-009: Simulation-logic shortcuts via templated simulations (EPIC)

**Priority**: P2  
**Status**: TODO  
**Owner**: —

**Source quote** (Philip):
> "the main thing missing from my perspective is a 'shortcut' way to add the simulation logic to the parts of the model, so that is, turning a bunch of models/components into a meaningful simulation. This will be the next major hurdle and will depend heavily on how much 'intelligence' we can build into the system."

**Decision**: 
This is a major feature epic. Provide templated simulation generators that auto-create step sequences based on model structure and user intent. This dramatically reduces manual work for common simulation patterns.

**Epic scope**: Five template types (each can be a separate sub-item)

**Acceptance criteria** (epic-level):
- [ ] Design template system architecture (how templates are defined and executed)
- [ ] Create UI for selecting and configuring templates
- [ ] Implement each template type (FS-009A through FS-009E)
- [ ] Test templates with various model types
- [ ] Document how to create new templates (extensibility)

**Implementation notes**:
- This is a large feature requiring architectural planning
- May need AI integration for intelligent component naming and SOP parsing
- Consider breaking into 5 separate implementation tasks
- Likely needs new UI for template selection and configuration
- May require backend API for AI-powered features (SOP parsing, naming)

**Test plan** (epic-level):
1. Test each template type with appropriate models/documents
2. Verify generated steps are correct and logically ordered
3. Test template configuration options
4. Verify templates work with various model complexities
5. Test extensibility: can new templates be added easily?

**Sub-items**: See FS-009A through FS-009E below

---

### FS-009A: Assembly template

**Priority**: P2  
**Status**: TODO  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The Assembly - explode the model components and place the in a random order in a line, the learner needs to re-assemble the object"

**Decision**: 
Auto-generate an assembly simulation: explode all model components, place them in a randomized line, create snap-to steps for learner to re-assemble.

**Acceptance criteria**:
- [ ] Detect all components in selected model
- [ ] Generate exploded positions (components arranged in a line)
- [ ] Randomize component order
- [ ] Create snap-to step for each component (target: original position)
- [ ] Allow user to adjust randomization and spacing
- [ ] Preview exploded view before generating

**Implementation notes**:
- Requires model hierarchy traversal (Three.js object graph)
- Calculate bounding boxes to determine spacing
- Use existing move-item step creation logic
- May need UI for template configuration (spacing, randomization seed)

**Test plan**:
1. Select a multi-component model
2. Run Assembly template
3. Verify components are exploded and randomized
4. Enter Preview mode
5. Test reassembly by completing snap-to steps
6. Verify assembled model matches original

---

### FS-009B: Disassembly template

**Priority**: P2  
**Status**: TODO  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The Disassembly - Auto add a snap-to step to each component to remove it from model and place in a row on the 'floor', start working from the outside inwards and allow user to change step order easily"

**Decision**: 
Auto-generate a disassembly simulation: create snap-to steps to move each component from model to a row on the floor, ordered outside-in.

**Acceptance criteria**:
- [ ] Detect model components and determine "outside-in" order (by distance from center or hierarchy depth)
- [ ] Generate floor positions in a row
- [ ] Create snap-to steps for each component (start: original position, end: floor position)
- [ ] Order steps outside-in by default
- [ ] Provide UI for user to reorder steps easily (drag/drop)
- [ ] Preview disassembly sequence before generating

**Implementation notes**:
- Calculate component centroids to determine outside-in order
- Floor position: y=0 or slightly above ground plane
- May need spatial sorting algorithm
- Reuse existing step reordering UI

**Test plan**:
1. Select a multi-component model
2. Run Disassembly template
3. Verify steps are created in outside-in order
4. Reorder steps via UI
5. Enter Preview mode and verify disassembly animation
6. Verify components end up in a row on floor

---

### FS-009C: Label Machine template

**Priority**: P2  
**Status**: TODO  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The Label Machine - Auto add labels to all components, guess component name based on model file component name and/or using AI based internet look up to guess names of items from the name of the object (e.g. 450Kv Oil transformer, these are all pretty similar and have a common nomenclature)"

**Decision**: 
Auto-generate labels for all model components, inferring names from model node names and optionally using AI to improve/standardize names.

**Acceptance criteria**:
- [ ] Detect all components in model
- [ ] Extract component names from model node names
- [ ] (Optional) Use AI to improve/standardize names based on model context
- [ ] Create info-card or label step for each component
- [ ] Allow user to review and edit generated names before finalizing
- [ ] Position labels appropriately near components

**Implementation notes**:
- Parse Three.js object names from GLTF/FBX node hierarchy
- May require AI API integration for name improvement
- Label positioning: calculate bounding box and place label nearby
- Consider using existing info-card step type vs new label type

**Test plan**:
1. Load a model with named components (e.g., transformer)
2. Run Label Machine template
3. Verify labels are generated for all components
4. Check that names are reasonable (based on node names)
5. Edit a label name and verify changes persist
6. Enter Preview mode and verify labels display correctly

---

### FS-009D: Quiz template

**Priority**: P2  
**Status**: TODO  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The Quiz - Auto add labels to components and generate 1-2 MCQ questions for each component based on some uploaded SOP/equipment manual doc, allows the learner to explore equipment etc"

**Decision**: 
Auto-generate an exploratory quiz: label components and create multiple-choice questions for each based on uploaded documentation.

**Acceptance criteria**:
- [ ] Accept uploaded SOP/manual document (PDF, TXT, or MD)
- [ ] Parse document and extract relevant information
- [ ] Use AI to generate 1–2 MCQ questions per component based on document
- [ ] Create quiz steps with questions and answer choices
- [ ] Label components in scene
- [ ] Allow user to review/edit questions before finalizing
- [ ] Track quiz answers in Preview mode

**Implementation notes**:
- Requires document parsing (PDF/TXT)
- Requires AI integration for question generation
- May need new quiz step type or extend existing info-card type
- Consider using existing SOP parsing logic from `samples/` and `api/ai/extract-steps.ts`

**Test plan**:
1. Upload a model and equipment manual
2. Run Quiz template
3. Verify questions are generated and relevant to document
4. Review and edit a question
5. Enter Preview mode
6. Answer quiz questions and verify feedback
7. Verify labels and questions match components

---

### FS-009E: SOP auto-step template

**Priority**: P2  
**Status**: TODO  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The SOP - This one would be similar to what we already tested in the original Phoenix prototype, it takes an SOP document and Auto creates steps"

**Decision**: 
Auto-generate simulation steps from an uploaded SOP document, similar to the Phoenix prototype. Parse SOP and create step sequence.

**Acceptance criteria**:
- [ ] Accept uploaded SOP document (PDF, TXT, or MD)
- [ ] Parse SOP into structured steps (leverage existing logic from `api/ai/extract-steps.ts`)
- [ ] Generate simulation steps (info cards with instructions)
- [ ] Map SOP steps to scene objects where possible (requires object matching)
- [ ] Allow user to review and edit generated steps
- [ ] Preserve SOP step numbering and hierarchy

**Implementation notes**:
- Reuse existing SOP parsing from `api/ai/extract-steps.ts` and `shared/ai/extractSopStepsPrompt.js`
- Check `samples/` directory for SOP examples to test with
- May need to enhance AI prompt to better map steps to scene objects
- Consider integrating with model component detection for automatic object references

**Test plan**:
1. Load a model (e.g., equipment from samples)
2. Upload corresponding SOP document
3. Run SOP template
4. Verify steps are generated and match SOP content
5. Check that steps reference correct objects if mapped
6. Edit a step and verify changes
7. Enter Preview mode and walk through SOP steps

---

## Backlog Summary

**Total items**: 14 (5 P0, 3 P1, 6 P2)

**P0 (before testers)**: FS-001, FS-002, FS-003, FS-007, FS-008  
**P1 (improvements)**: FS-004, FS-005, FS-006  
**P2 (epic + sub-items)**: FS-009, FS-009A, FS-009B, FS-009C, FS-009D, FS-009E

**Next item** (as of this writing): **FS-001** (P0, lowest ID)

---

## Changelog

- **2026-02-10**: Initial backlog created from Philip's feedback
