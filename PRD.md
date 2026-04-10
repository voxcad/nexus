# NEXUS — Product Requirements Document

## Product: 2D CAD Vertical Slice (v0.1)

> **Goal:** One complete end-to-end flow — create, edit, constrain, save, reload, AI-driven — in 2D CAD. Both TypeScript and Rust paths running together in the browser.

---

## Vision

A browser-based 2D CAD that works like a minimal AutoCAD, where both humans and AI agents are first-class users. Every operation available via GUI is also callable headlessly by an AI agent via MCP tool schemas.

## Non-Functional Requirements

- **Zero install:** Runs in Chrome/Firefox/Safari. No plugins, no Electron.
- **Local-first:** All data in OPFS. Works offline.
- **Dual stack:** UI in TypeScript/Svelte 5, geometry kernel in Rust/WASM.
- **AI-native:** Every operation is a command that AI can call.
- **Open source:** MIT license. All dependencies MIT/Apache 2.0/BSD compatible.

---

## Functional Requirements

### R1 — 2D Drawing Entities

| Entity | Properties | Priority |
|--------|-----------|----------|
| Line | start, end | P0 |
| Circle | center, radius | P0 |
| Arc | center, radius, start_angle, end_angle | P0 |
| Polyline | vertices[], closed | P0 |
| Rectangle | origin, width, height, rotation | P0 |
| Text | position, content, height, rotation | P1 |
| Dimension | type (linear/angular/radial), references | P1 |
| Hatch | boundary, pattern | P2 |
| Spline | control_points[], degree | P2 |

### R2 — Drawing Operations

| Operation | Description | Priority |
|-----------|------------|----------|
| Create | Draw any entity via click or coordinate input | P0 |
| Select | Click, window, crossing selection | P0 |
| Move | Translate selected entities | P0 |
| Copy | Duplicate selected entities | P0 |
| Delete | Remove selected entities | P0 |
| Rotate | Rotate selected entities around point | P0 |
| Scale | Scale selected entities from base point | P0 |
| Trim | Trim entity at intersection | P1 |
| Extend | Extend entity to boundary | P1 |
| Offset | Create parallel copy at distance | P1 |
| Fillet | Round corner between two entities | P1 |
| Mirror | Mirror selected entities across axis | P1 |
| Array | Rectangular/polar array of entities | P2 |

### R3 — Constraint System

| Constraint | Description | Priority |
|-----------|------------|----------|
| Horizontal | Force line/segment horizontal | P0 |
| Vertical | Force line/segment vertical | P0 |
| Distance | Fixed distance between points | P0 |
| Angle | Fixed angle between segments | P1 |
| Parallel | Two segments parallel | P1 |
| Perpendicular | Two segments perpendicular | P1 |
| Tangent | Line tangent to arc/circle | P1 |
| Coincident | Two points share location | P0 |
| Concentric | Two circles share center | P1 |
| Equal | Two segments equal length | P1 |
| Fixed | Point/entity locked in place | P0 |

Implementation: planegcs (FreeCAD's WASM constraint solver)

### R4 — Layer System

- Create/rename/delete layers
- Assign entities to layers
- Toggle layer visibility
- Lock layers (prevent editing)
- Layer colors (entities inherit layer color unless overridden)

### R5 — Snapping

| Snap | Priority |
|------|----------|
| Endpoint | P0 |
| Midpoint | P0 |
| Center | P0 |
| Intersection | P0 |
| Perpendicular | P1 |
| Nearest | P1 |
| Grid | P0 |

### R6 — Coordinate Input

- Absolute: `x,y` (e.g., `100,200`)
- Relative: `@dx,dy` (e.g., `@10,20`)
- Polar: `@distance<angle` (e.g., `@50<45`)
- Command line input (AutoCAD-style)

### R7 — Undo/Redo

- Event-sourced: every operation = immutable event
- Unlimited undo depth
- Undo/redo via Ctrl+Z / Ctrl+Shift+Z
- Event log viewable for debugging and AI replay

### R8 — File I/O

| Format | Read | Write | Priority |
|--------|------|-------|----------|
| DXF (R2018) | Yes (dxf-parser) | Yes (custom) | P0 |
| Native JSON | Yes | Yes | P0 |
| SVG export | No | Yes | P1 |
| DWG | Yes (libredwg WASM) | No | P2 |

### R9 — Local Persistence

- Auto-save to OPFS every 30 seconds
- Project browser showing saved files
- Open/save/save-as workflow

### R10 — AI Agent Interface

Every R2 operation must be callable via MCP tool schema:

```json
{
  "tool": "draw_line",
  "parameters": {
    "start": [0, 0],
    "end": [100, 50],
    "layer": "default"
  }
}
```

- Chat bar in UI for natural language input
- LLM decomposes NL to tool calls
- Agent action log visible in UI
- Same result whether human clicks or agent calls API

### R11 — Viewport

- Pan (middle mouse drag or space+drag)
- Zoom (scroll wheel, pinch on tablet)
- Zoom extents (fit all entities)
- Zoom window (rubber-band zoom)
- Orthographic 2D view (no perspective)
- Grid display with dynamic spacing based on zoom level

---

## Technical Architecture

```
packages/
├── @nexus/core          # Shared types, events, entity IDs
├── @nexus/kernel         # Rust/WASM geometry kernel + ECS
├── @nexus/renderer       # Three.js 2D rendering
├── @nexus/ui             # Svelte 5 shell (toolbars, panels, chat)
├── @nexus/file-io        # DXF parser/writer, OPFS persistence
├── @nexus/ai             # MCP server, tool schemas, LLM integration
└── @nexus/app            # SvelteKit app wiring everything together
```

---

## Success Criteria

1. User can draw a floor plan (walls as lines, doors as arcs) in < 5 minutes
2. Save as DXF, open in AutoCAD/LibreCAD, geometry is correct
3. AI agent can reproduce the same floor plan from: "Draw a 10m x 8m rectangle, add a 0.9m door opening on the south wall"
4. Constraint solver keeps walls perpendicular when user drags a corner
5. 60fps with 10,000 entities on screen
6. Works fully offline after first load
