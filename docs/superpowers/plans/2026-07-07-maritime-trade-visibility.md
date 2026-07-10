# Maritime Trade Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make existing merchant traffic visibly commercial by rendering Trade Ship movement as map trails.

**Architecture:** Reuse the existing `TrailManager` + `TrailPass` pipeline. `GameView.populateFrame()` already chooses which mobile units stamp the trail texture through `TRAIL_TYPES`; adding `UnitType.TradeShip` makes merchant routes visible without introducing a new render pass or protocol field.

**Tech Stack:** TypeScript, Vitest, existing WebGL trail pipeline.

---

### Task 1: Add Trade Ship to trail tracking

**Files:**
- Modify: `src/client/view/GameView.ts`
- Modify: `tests/client/view/GameView.test.ts`

- [x] **Step 1: Write failing test**

Add a test that creates a Trade Ship unit update with `lastPos` and `pos`, runs `GameView.update()`, and asserts the `frameData().trailState` stamps the trade ship owner at the movement path.

- [x] **Step 2: Verify RED**

Run: `npx vitest run tests/client/view/GameView.test.ts -t "stamps trade ship movement into trail state"`
Expected: FAIL because `TradeShip` is not in `TRAIL_TYPES`.

- [x] **Step 3: Minimal implementation**

Add `UnitType.TradeShip` to `TRAIL_TYPES` in `src/client/view/GameView.ts`.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run tests/client/view/GameView.test.ts -t "stamps trade ship movement into trail state"`
Expected: PASS.

- [x] **Step 5: Regression verification**

Run: `npx vitest run tests/client/render/frame/TrailManager.test.ts tests/client/view/GameView.test.ts`
Expected: PASS.

---

### Task 2: Document route visibility decision

**Files:**
- Modify: `README.md`

- [x] **Step 1: Update roadmap/status wording**

Change roadmap text so the commercial visibility slice is explicit: active merchant traffic leaves visible sea-route trails.

- [x] **Step 2: Verify docs/metadata tests**

Run: `npx vitest run tests/Branding.test.ts`
Expected: PASS.

