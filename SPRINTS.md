# NEXUS — Sprint Plan (2D CAD Vertical Slice)

---

## Sprint 0 — Foundation (Days 1-3)

**Goal:** Monorepo boots, Rust compiles to WASM, Svelte renders a canvas.

**Deliverables:**
- [ ] pnpm + Turborepo monorepo with all packages
- [ ] Rust crate (`@nexus/kernel`) with wasm-pack build
- [ ] Basic 2D geometry types in Rust: Point, Line, Arc, Circle, Polyline
- [ ] WASM bindings via wasm-bindgen exposing geometry types to JS
- [ ] SvelteKit app (`@nexus/app`) with Three.js orthographic 2D canvas
- [ ] Render a single line from Rust kernel → WASM → Three.js
- [ ] CI: `pnpm build` compiles Rust + TypeScript, `pnpm test` runs both
- [ ] TypeScript strict mode, Svelte 5 runes

**Success:** A line defined in Rust appears on the Svelte/Three.js canvas.

**Key deps:** wasm-pack, wasm-bindgen, Three.js, Threlte, SvelteKit, Turborepo

---

## Sprint 1 — Drawing & Rendering (Days 4-8)

**Goal:** User can draw basic entities and see them rendered.

**Deliverables:**
- [ ] Entity types in Rust kernel: Line, Circle, Arc, Polyline, Rectangle
- [ ] ECS world in kernel (simple sparse array storage)
- [ ] Create entity → add to ECS → emit event → renderer picks up
- [ ] Three.js 2D renderer: render all entity types with proper styles
- [ ] Mouse interaction: click to place points, draw lines, draw circles
- [ ] Grid display with dynamic spacing
- [ ] Viewport controls: pan, zoom, zoom extents
- [ ] Layer system (create, assign, toggle visibility, colors)
- [ ] Entity selection: click, window, crossing

**Success:** User can draw lines, circles, arcs, rectangles on a grid. Pan/zoom works.

---

## Sprint 2 — Edit Operations (Days 9-13)

**Goal:** Full edit capability with undo/redo.

**Deliverables:**
- [ ] Move, copy, delete, rotate, scale operations
- [ ] Event sourcing: every operation → immutable event in event log
- [ ] Undo/redo (Ctrl+Z / Ctrl+Shift+Z) via event replay
- [ ] Command line input: type coordinates, operations (AutoCAD-style)
- [ ] Coordinate input: absolute, relative (@dx,dy), polar (@d<a)
- [ ] Snapping: endpoint, midpoint, center, intersection, grid
- [ ] Entity properties panel (show/edit selected entity properties)
- [ ] Trim, extend, offset, fillet, mirror (P1 operations)

**Success:** User can draw a floor plan, move walls, undo mistakes, type exact coordinates.

---

## Sprint 3 — Constraints & Persistence (Days 14-18)

**Goal:** Geometric constraints keep the drawing consistent. Files save and reload.

**Deliverables:**
- [ ] Integrate planegcs WASM for constraint solving
- [ ] Constraints: horizontal, vertical, coincident, distance, fixed
- [ ] Constraint visualization (colored markers on constrained geometry)
- [ ] DXF import via dxf-parser → kernel entities
- [ ] DXF export (custom writer from kernel entities)
- [ ] OPFS auto-save every 30 seconds
- [ ] Project browser: list saved files, open, save-as
- [ ] Native JSON format for full-fidelity save (preserves constraints + events)

**Success:** Draw constrained geometry, save as DXF, open in LibreCAD/AutoCAD — correct.

---

## Sprint 4 — AI Agent Layer (Days 19-23)

**Goal:** AI agent can drive the CAD via natural language.

**Deliverables:**
- [ ] MCP tool schemas for all drawing operations (draw_line, draw_circle, move, etc.)
- [ ] Headless command executor: tool call JSON → kernel operation → result
- [ ] Chat bar in UI (Svelte component)
- [ ] LLM integration (Claude/GPT via API) with tool calling
- [ ] Agent action log panel (shows what AI is doing)
- [ ] Demo: "Draw a 10m x 8m room with a door on the south wall"
- [ ] Same result from GUI and from AI — verified

**Success:** Type natural language → AI calls tools → geometry appears correctly.

---

## Sprint 5 — Polish & Integration (Days 24-28)

**Goal:** Everything works together. Smooth UX. Ready for demo.

**Deliverables:**
- [ ] Keyboard shortcuts (all standard CAD shortcuts)
- [ ] Dark/light theme
- [ ] Status bar (cursor coordinates, snap mode, current operation)
- [ ] Performance test: 10,000 entities at 60fps
- [ ] Offline test: airplane mode, full functionality
- [ ] DXF round-trip test: NEXUS → DXF → LibreCAD → DXF → NEXUS
- [ ] AI round-trip test: NL prompt → geometry → modify via NL → save
- [ ] Documentation: README, architecture diagram, getting started
- [ ] Bug fixes, edge cases, stability

**Success:** Demo-ready. A single vertical slice that proves the full stack works.

---

## Post v0.1 Expansion Path

| Version | Adds | Timeline |
|---------|------|----------|
| v0.2 | 3D primitives (extrude, revolve, OCCT kernel) | +4 weeks |
| v0.3 | IFC/BIM (web-ifc, property sets, building elements) | +4 weeks |
| v0.4 | GIS (CesiumJS globe, georeferencing, terrain) | +4 weeks |
| v0.5 | Civil (road alignment, grading, drainage) | +6 weeks |
| v0.6 | Point clouds (Potree, LiDAR import) | +4 weeks |
| v0.7 | Multi-agent (structural + MEP + compliance agents) | +6 weeks |
| v0.8 | Collaboration (Yjs CRDT, multi-user) | +4 weeks |
| v1.0 | Production release | +8 weeks |
