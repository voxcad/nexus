# Sprint 3 — Constraints (planegcs) + DXF File I/O + OPFS Persistence

> **Goal:** Parametric constraints make geometry smart. DXF import/export connects to real world. Auto-save means no work lost.

---

## Workstreams (Parallelizable)

### WS1: Constraint System (planegcs WASM integration)
**Files:** `packages/kernel/src/constraints.rs`, `packages/app/src/lib/ConstraintBar.svelte`

- Integrate planegcs WASM as constraint solver
- Constraint types: horizontal, vertical, coincident, distance, fixed, parallel, perpendicular
- User flow: select two lines → right-click or press shortcut → add constraint
- Solver runs after each edit, adjusts geometry to satisfy constraints
- Visual indicators: constraint icons near constrained geometry
- Expose via WASM: `kernel.add_constraint(type, entity_ids, params)`, `kernel.solve_constraints()`

### WS2: DXF Import/Export + Native Save
**Files:** `packages/file-io/` (new package)

- DXF import: parse via dxf-parser → create kernel entities
- DXF export: serialize kernel entities → DXF format string → download
- Native JSON save: full-fidelity (entities + events + constraints)
- OPFS auto-save every 30 seconds
- File menu: New, Open (DXF/JSON), Save, Save As, Export DXF
- Project browser showing saved files in OPFS

### WS3: UI Polish + File Menu
**Files:** `packages/app/src/lib/FileMenu.svelte`, `packages/app/src/routes/+page.svelte`

- File menu dropdown (New, Open, Save, Save As, Export DXF, Import DXF)
- Constraint toolbar buttons
- Auto-save indicator in status bar
- Open file dialog (native file picker for DXF import)
- Download trigger for DXF export
