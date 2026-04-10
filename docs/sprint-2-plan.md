# Sprint 2 — Edit Operations, Undo/Redo, Snapping, Coordinate Input

> **Goal:** Transform from drawing toy to usable CAD tool
> **Duration:** 3-5 days
> **Success:** User can draw a floor plan with precise coordinates, undo mistakes, snap to geometry

---

## Workstreams (Parallelizable)

### WS1: Event Sourcing + Undo/Redo (Rust Kernel)
**Owner:** Agent 1 — Kernel
**Files:** `packages/kernel/src/lib.rs`, `packages/kernel/src/events.rs`, `packages/kernel/src/commands.rs`

- Refactor kernel to command/event pattern
- Every operation (create, delete, move, modify) → Command → Event
- EventStore: Vec<CadEvent> with cursor for undo position
- Undo: revert last event, move cursor back
- Redo: replay next event, move cursor forward
- Expose via WASM: `kernel.undo()`, `kernel.redo()`, `kernel.get_event_count()`, `kernel.get_undo_depth()`
- Add `create_arc()` and `create_polyline()` to complete entity types
- Add `rotate_entity(id, cx, cy, angle)` and `scale_entity(id, cx, cy, factor)`
- Add `copy_entity(id) -> new_id`
- Tests for all operations + undo/redo round-trips

### WS2: Selection + Snap System (Renderer)
**Owner:** Agent 2 — Renderer
**Files:** `packages/renderer/src/CadRenderer.ts`, `packages/renderer/src/SnapEngine.ts`, `packages/renderer/src/SelectionManager.ts`

Selection:
- Click to select entity (ray cast against entity meshes)
- Selected entity: highlight color (cyan/yellow), show grip points
- Grip points: small squares at endpoints, center, midpoints
- Window selection: drag left-to-right = window (fully enclosed), drag right-to-left = crossing (any overlap)
- Multi-select with Shift+click
- Deselect: click empty space or Escape
- `getSelectedIds(): string[]`

Snapping:
- SnapEngine class that finds nearest snap point to cursor
- Snap types: endpoint, midpoint, center, intersection, grid, nearest
- Visual indicator: small colored marker at snap point (green diamond)
- Snap distance threshold: 10 pixels (screen space)
- Grid snap: round to nearest grid unit
- Snap enabled/disabled toggle
- `getSnapPoint(worldX, worldY, entities): SnapResult | null`

Rubber-band preview:
- While drawing (drawStep > 0), render a preview entity following cursor
- Preview line from firstPoint to cursor
- Preview circle from center to cursor (showing radius)
- Preview rectangle from firstPoint to cursor
- Preview rendered as dashed/transparent material

### WS3: UI Enhancements (Svelte App)
**Owner:** Agent 3 — App UI
**Files:** `packages/app/src/routes/+page.svelte`, `packages/app/src/lib/PropertiesPanel.svelte`, `packages/app/src/lib/CommandLine.svelte`

Coordinate input:
- Enhanced command line parser
- Absolute: `100,200` → point at (100, 200)
- Relative: `@10,20` → offset from last point
- Polar: `@50<45` → 50 units at 45 degrees from last point
- During line drawing: type coordinates instead of clicking

Properties panel:
- Right sidebar (collapsible, 250px width)
- When entity selected: show type, layer, all geometry properties
- Editable fields: change coordinates, radius, etc. → update kernel
- When nothing selected: show layer list

Keyboard shortcuts:
- Ctrl+Z: undo
- Ctrl+Shift+Z / Ctrl+Y: redo
- Delete/Backspace: delete selected
- Escape: cancel current operation / deselect
- L: switch to line tool
- C: switch to circle tool
- R: switch to rectangle tool
- A: switch to arc tool
- M: move mode
- S: select mode
- F2: zoom extents

Toolbar update:
- Add: Move, Copy, Rotate, Delete tool buttons
- Add: Undo/Redo buttons
- Add: Snap toggle button
- Visual indicator of snap mode (on/off)

Move/Copy/Rotate workflow:
- Select entities → press M → click base point → click destination → kernel.move_entity()
- Select entities → press Ctrl+C/Ctrl+D → click base → click destination → kernel.copy_entity()
- Select entities → type 'rotate' → click center → type angle → kernel.rotate_entity()

Status bar update:
- Show: current tool | snap mode | coordinate display | entity count
- Coordinate display updates in real-time as cursor moves

---

## Integration Points

```
User clicks canvas
  → SnapEngine finds snap point
  → If drawing: use snap point as input to draw state machine
  → If selecting: SelectionManager hit-tests entities
  → Command dispatched to kernel
  → Kernel emits event
  → EventStore records event
  → Renderer syncs entities
  → UI updates (properties panel, entity count, status)
```

---

## Files Created/Modified

### New Files:
- `packages/kernel/src/events.rs` — Event types, EventStore
- `packages/kernel/src/commands.rs` — Command dispatch
- `packages/renderer/src/SnapEngine.ts` — Snap point calculation
- `packages/renderer/src/SelectionManager.ts` — Entity selection + grips
- `packages/app/src/lib/PropertiesPanel.svelte` — Property editor sidebar
- `packages/app/src/lib/CommandLine.svelte` — Enhanced command input

### Modified Files:
- `packages/kernel/src/lib.rs` — Refactor to use events, add undo/redo
- `packages/renderer/src/CadRenderer.ts` — Add selection highlight, snap visuals, rubber-band preview
- `packages/app/src/routes/+page.svelte` — Wire everything together
