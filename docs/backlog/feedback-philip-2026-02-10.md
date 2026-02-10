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
**Status**: DONE  
**Owner**: Agent (Feb 10, 2026)

**Source quote** (Philip):
> "The main working real estate is ok, but i'd make sure it doesn't get any smaller; mind you this was with both menus open"

**Decision**: 
Skipped per product decision; minimum workspace protection not pursued.

**Notes/Verification**:
- Skipped per product decision; minimum workspace constraint not needed at this time
- Workspace sizing is acceptable with current layout

---

### FS-002: Remove "Transform" term; rename to "Record/set object end position"

**Priority**: P0  
**Status**: DONE  
**Owner**: Agent (Feb 10, 2026)

**Source quote** (Philip):
> "With the Snap To / Move item action, lets change the wording from Transform to 'Record/set object end position' and remove all reference to the term Transform."

**Decision**: 
Find all UI references to "Transform" in the context of the Snap To / Move item step type and replace with "Record/set object end position" or similar clear wording.

**Notes/Verification**:
- Wording updated to "Record end position" and "Set end position" across Move item UI
- All user-facing "Transform" references removed from this feature area

---

### FS-003: Add undo buttons (and redo if appropriate)

**Priority**: P0  
**Status**: DONE  
**Owner**: Agent (Feb 10, 2026)

**Source quote** (Philip):
> "The Autosave works very well, although the undo buttons will be useful to have"

**Decision**: 
Surface undo/redo UI controls (buttons) so users can easily revert changes.

**Notes/Verification**:
- Undo/redo buttons already present in TopBar HistoryControls
- Buttons show appropriate tooltips with keyboard shortcuts
- No additional changes required

---

### FS-004: Optional "?" hover explainer for end-position action

**Priority**: P1  
**Status**: DONE  
**Owner**: Agent (Feb 10, 2026)

**Source quote** (Philip):
> "a little '?' explain hover thing might be good as well, but not required"

**Decision**: 
Add help icons with hover tooltips throughout the app.

**Notes/Verification**:
- Delivered as part of project-wide help icons feature
- End-position help icon added to MoveItemSection
- Help icon component created and reused across all major UI sections
- Help tooltips added to: step cards, right sidebar, left sidebar, asset library

---

### FS-005: Preview camera improvements (future consideration)

**Priority**: P1  
**Status**: DEFERRED  
**Owner**: —

**Source quote** (Philip):
> "I like not having the WASD movement options, but i wonder if maybe having a pan and zoom option, like in the editor itself might be nice. I can imagine that in time there will be steps that require a more close up view than others. Not something we need right now for sure, but might be an issue later on?"
> "What might work well is to be able to 'set' the level of zoom and basic position of the camera when you add the step, that way the creator can emphasise what's required but the learner doesn't have to pan/zoom, anyways just a thought."

**Decision**: 
Track this as a future improvement. Explicitly "not needed right now" per Philip's feedback.

**Notes/Verification**:
- Deferred; preview camera improvements (per-step camera framing or pan/zoom controls) planned for later
- Documented for future consideration

---

### FS-006: Performance tracking for large models

**Priority**: P1  
**Status**: DONE  
**Owner**: Agent (Feb 10, 2026)

**Source quote** (Philip):
> "FYI when i added a 300K poly model the selection of individual components in another object and the preview loading slowed considerably; guess that's a no brainer but just wanted to point it out."

**Decision**: 
Track this as a known performance issue.

**Notes/Verification**:
- Tracked as known limitation; no implementation this cycle
- Performance considerations documented for future optimization work

---

### FS-007: Add starter 3D model library

**Priority**: P0  
**Status**: DONE  
**Owner**: Agent (Feb 10, 2026)

**Source quote** (Philip):
> "Two nice to haves before we put this in front of testers might be: Having a small library of 3d models they can start to use straight away"

**Decision**: 
Provide a built-in library of 3D models that users can add to their scene without uploading.

**Notes/Verification**:
- Starter 3D model library implemented in AssetLibraryPanel
- Library includes curated starter models in collapsible section
- Users can click models to add them to the scene

---

### FS-008: Add selectable backgrounds

**Priority**: P0  
**Status**: DEFERRED  
**Owner**: —

**Source quote** (Philip):
> "Two nice to haves before we put this in front of testers might be: [...] Being able to add a few different backgrounds, these could be 360 images or our existing CGI enviros."

**Decision**: 
Add a background/environment selector for future implementation.

**Notes/Verification**:
- Deferred; selectable backgrounds feature planned for later
- Identified as larger feature requiring additional design and implementation work

---

### FS-009: Simulation-logic shortcuts via templated simulations (EPIC)

**Priority**: P2  
**Status**: DEFERRED  
**Owner**: —

**Source quote** (Philip):
> "the main thing missing from my perspective is a 'shortcut' way to add the simulation logic to the parts of the model, so that is, turning a bunch of models/components into a meaningful simulation. This will be the next major hurdle and will depend heavily on how much 'intelligence' we can build into the system."

**Decision**: 
This is a major feature epic for future implementation.

**Notes/Verification**:
- Epic documented; sub-items (FS-009A–E) planned for future implementation
- Requires architectural planning and AI integration
- Deferred to future roadmap

---

### FS-009A: Assembly template

**Priority**: P2  
**Status**: DEFERRED  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The Assembly - explode the model components and place the in a random order in a line, the learner needs to re-assemble the object"

**Decision**: 
Auto-generate an assembly simulation for future implementation.

**Notes/Verification**:
- Documented; implementation deferred as part of FS-009 epic

---

### FS-009B: Disassembly template

**Priority**: P2  
**Status**: DEFERRED  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The Disassembly - Auto add a snap-to step to each component to remove it from model and place in a row on the 'floor', start working from the outside inwards and allow user to change step order easily"

**Decision**: 
Auto-generate a disassembly simulation for future implementation.

**Notes/Verification**:
- Documented; implementation deferred as part of FS-009 epic

---

### FS-009C: Label Machine template

**Priority**: P2  
**Status**: DEFERRED  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The Label Machine - Auto add labels to all components, guess component name based on model file component name and/or using AI based internet look up to guess names of items from the name of the object (e.g. 450Kv Oil transformer, these are all pretty similar and have a common nomenclature)"

**Decision**: 
Auto-generate labels for all model components for future implementation.

**Notes/Verification**:
- Documented; implementation deferred as part of FS-009 epic

---

### FS-009D: Quiz template

**Priority**: P2  
**Status**: DEFERRED  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The Quiz - Auto add labels to components and generate 1-2 MCQ questions for each component based on some uploaded SOP/equipment manual doc, allows the learner to explore equipment etc"

**Decision**: 
Auto-generate an exploratory quiz for future implementation.

**Notes/Verification**:
- Documented; implementation deferred as part of FS-009 epic

---

### FS-009E: SOP auto-step template

**Priority**: P2  
**Status**: DEFERRED  
**Owner**: —

**Parent**: FS-009

**Source quote** (Philip):
> "The SOP - This one would be similar to what we already tested in the original Phoenix prototype, it takes an SOP document and Auto creates steps"

**Decision**: 
Auto-generate simulation steps from an uploaded SOP document for future implementation.

**Notes/Verification**:
- Documented; implementation deferred as part of FS-009 epic

---

## Backlog Summary

**Total items**: 14 (5 P0, 3 P1, 6 P2)

**Status breakdown**:
- **DONE**: FS-001 (skipped), FS-002, FS-003, FS-004, FS-006, FS-007
- **DEFERRED**: FS-005, FS-008, FS-009, FS-009A, FS-009B, FS-009C, FS-009D, FS-009E

**Next item**: None; backlog closed as of Feb 10, 2026

---

## Changelog

- **2026-02-10**: Initial backlog created from Philip's feedback
- **2026-02-10**: All items marked DONE or DEFERRED; backlog closed
  - FS-001: Skipped per product decision
  - FS-002: Transform wording updated to "Record end position"
  - FS-003: Undo/redo buttons already present
  - FS-004: Project-wide help icons implemented
  - FS-005: Deferred (preview camera improvements)
  - FS-006: Tracked as known limitation
  - FS-007: Starter model library implemented
  - FS-008: Deferred (selectable backgrounds)
  - FS-009 + sub-items: Documented and deferred for future implementation
