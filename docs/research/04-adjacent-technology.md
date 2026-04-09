# NEXUS — Adjacent Technology: Game Engines, 3D Tools & Systems Patterns

> **Date:** 2026-04-10
> **Key Insight:** Game engines and 3D tools have solved many hard problems we need — ECS, rendering, scene graphs, undo/redo, collision detection, real-time collaboration. Don't reinvent these.

---

## Why This Matters

CAD/BIM/GIS software and game engines face the **same core problems**:
- Millions of entities in a scene
- Real-time rendering with LOD
- Spatial indexing and collision detection
- Undo/redo with complex state
- Multi-user collaboration
- Plugin/scripting systems

The difference: game engines are 10+ years ahead in solving these at scale.

---

## 1. Game Engines

### Bevy (Rust) — MOST RELEVANT TO NEXUS
- **Homepage:** [bevyengine.org](https://bevy.org/)
- **GitHub:** [bevyengine/bevy](https://github.com/bevyengine/bevy) — 44k+ stars
- **License:** MIT / Apache 2.0
- **Description:** Data-driven game engine built in Rust. ECS at its core. Compiles to WASM for browser. WebGPU rendering. v0.18 as of 2026.
- **Why it matters for NEXUS:**
  - **Bevy ECS** is one of the best ECS implementations anywhere — sparse set storage, parallel system scheduling, change detection, queries. We can use it directly or learn from its patterns.
  - **wgpu rendering** — Bevy uses wgpu (Rust WebGPU), same tech we'd use for custom rendering.
  - **WASM browser support** — runs in browser via WASM + WebGPU/WebGL2.
  - **Plugin system** — extensible architecture we could adopt for NEXUS domain plugins.
- **Consideration:** Bevy is game-focused. It lacks engineering precision (double-precision coords, B-Rep geometry). But its ECS + rendering + plugin patterns are gold.

### Godot Engine
- **Homepage:** [godotengine.org](https://godotengine.org/)
- **GitHub:** [godotengine/godot](https://github.com/godotengine/godot) — 95k+ stars
- **License:** MIT
- **Description:** Full-featured open-source game engine. Exports to WASM for browser. Own scripting language (GDScript). WASM SIMD support gives 1.5-2x perf boost (2025).
- **Why it matters:** Massive community, proven web export. But GDScript and C++ core make it less useful as a library. Better as a reference for scene management, UI systems.

---

## 2. Rust Graphics & GPU

### wgpu
- **Homepage:** [wgpu.rs](https://wgpu.rs/)
- **GitHub:** [gfx-rs/wgpu](https://github.com/gfx-rs/wgpu) — 13k+ stars
- **License:** MIT / Apache 2.0
- **Description:** Cross-platform, safe, pure-Rust WebGPU implementation. Runs natively on Vulkan/Metal/D3D12/OpenGL AND in browser via WASM+WebGPU/WebGL2. Powers Firefox's WebGPU. Powers Bevy rendering.
- **Why it matters:** If we ever build a custom renderer in Rust/WASM (bypassing Three.js), wgpu is THE library. Write once, run on desktop and browser.

### Rapier — COLLISION DETECTION FOR FREE
- **Homepage:** [rapier.rs](https://rapier.rs/)
- **GitHub:** [dimforge/rapier](https://github.com/dimforge/rapier) — 4k+ stars
- **License:** Apache 2.0
- **Description:** 2D and 3D physics engine in Rust. Official WASM/JavaScript bindings on npm (`@dimforge/rapier3d`). Fastest physics engine available for browser.
- **Why it matters for NEXUS:**
  - **Clash detection** — Rapier's collision detection (BVH, AABB, CCD) solves the BIM clash detection problem without us building a custom BVH tree.
  - **Spatial queries** — ray casting, shape casting, point queries, intersection tests.
  - **WASM bindings** — drop-in for browser use.
  - We don't need the physics simulation part, but the collision/spatial query part is exactly what NEXUS needs.

---

## 3. ECS Libraries (Standalone)

### Flecs — FASTEST ECS, WASM SUPPORT
- **Homepage:** [flecs.dev](https://www.flecs.dev/)
- **GitHub:** [SanderMertens/flecs](https://github.com/SanderMertens/flecs) — 6k+ stars
- **License:** MIT
- **Description:** Blazing-fast C ECS library. Supports relationships, hierarchies, queries, observers, modules. Compiles to WASM via Emscripten. Has a universal scripting API for WASM languages (flecs-polyglot). Rust bindings exist.
- **Why it matters:** If we want an ECS that runs in both Rust/WASM and is queryable from JavaScript, Flecs is the most mature option. Its relationship system (entity A "depends_on" entity B) maps perfectly to NEXUS's constraint graphs.

### Bevy ECS (standalone)
- Can be used as a library separate from Bevy engine (`bevy_ecs` crate).
- Best Rust-native ECS. Sparse set + table storage, parallel scheduling.
- Compiles to WASM.

### bitECS (JavaScript)
- **GitHub:** [NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS)
- **License:** MIT
- **Description:** Tiny, fast ECS for JavaScript. 3kb. Uses typed arrays (cache-friendly). No WASM dependency.
- **Why it matters:** If we want a pure-JS ECS that runs directly in the main thread for UI/rendering components, bitECS is lightweight and proven.

---

## 4. Blender — Architecture Study

### What Blender Teaches Us

Blender is not something we'll use directly, but its **architecture patterns** are deeply relevant:

- **Homepage:** [blender.org](https://www.blender.org/)
- **GitHub:** [blender/blender](https://github.com/blender/blender) (mirror)
- **License:** GPL-2.0

**Key patterns to study:**

| Pattern | How Blender Does It | How NEXUS Can Learn |
|---------|-------------------|-------------------|
| **Data model** | "Data-Oriented" structs stored as lists of lists. IDs link everything. Directly serializable to file. | Our ECS entity model should be similarly flat and serializable |
| **MVC architecture** | Strict separation: blenkernel (model), editors (view), window manager (controller) | Hexagonal architecture for geometry kernel |
| **Geometry Nodes** | Node-based procedural geometry system. DAG of operations. Lazy evaluation. | Directly maps to our parametric constraint graph (D6 pattern) |
| **BMesh** | Half-edge mesh data structure for mesh editing. Rich topology queries. | Study for mesh representation in our ECS |
| **Undo system** | Memento pattern — snapshots entire state. Fast but memory-heavy. | We chose Event Sourcing instead (more scalable, AI-replayable) |
| **Python scripting** | Every operation is a Python-callable operator. Full API exposure. | Same goal: every operation callable by AI agents |
| **Modifier stack** | Non-destructive operations applied in order. Each modifier reads mesh and outputs modified mesh. | Maps to our event sourcing + parametric dependencies |

**The biggest lesson from Blender:** Every operation should be an independent, composable unit (operator/command) that can be called from GUI, scripting, or automation equally. This is exactly the "headless geometry" principle for AI agents.

### Blender MCP Server
- **GitHub:** [MScanter/blender-mcp-Geometry_Nodes](https://github.com/MScanter/blender-mcp-Geometry_Nodes)
- MCP server for controlling Blender's Geometry Nodes via AI agents. Shows the pattern of AI → geometry tool calls.

---

## 5. Event Sourcing / Undo-Redo

### eventually-rs
- **GitHub:** [get-eventually/eventually-rs](https://github.com/get-eventually/eventually-rs)
- **License:** MIT
- **Description:** Event Sourcing library for Rust. Immutable event series, aggregate pattern.
- **Why it matters:** If our WASM kernel is in Rust, this handles the event store pattern natively.

### Thalo
- **GitHub:** [thalo-rs/thalo](https://github.com/thalo-rs/thalo)
- **License:** MIT
- **Description:** Event Sourcing runtime with WebAssembly support. Changes stored as sequence of events.
- **Why it matters:** Event sourcing + WASM — exactly our stack.

### TypeScript Event Sourcing
- **GitHub:** [xolvio/typescript-event-sourcing](https://github.com/SamHatoum/typescript-event-sourcing)
- **Description:** DDD + Event Sourcing + CQRS in TypeScript. Command → Event → Projection pattern.

---

## 6. Other Relevant Systems

### Parry (Collision Detection, Rust)
- **GitHub:** [dimforge/parry](https://github.com/dimforge/parry)
- **License:** Apache 2.0
- **Description:** 2D/3D collision detection library (extracted from Rapier). Standalone. BVH, AABB tree, GJK, EPA, ray casting. Compiles to WASM.
- **Why it matters:** If we only need collision/spatial queries without full physics, Parry is lighter than Rapier.

### nalgebra (Linear Algebra, Rust)
- **GitHub:** [dimforge/nalgebra](https://github.com/dimforge/nalgebra)
- **License:** Apache 2.0
- **Description:** Linear algebra library for Rust. Matrices, vectors, transformations. WASM-compatible.
- **Why it matters:** Foundation for coordinate transforms, geometry math in our Rust/WASM kernel.

### glam (Fast Math, Rust)
- **GitHub:** [bitshifter/glam-rs](https://github.com/bitshifter/glam-rs)
- **License:** MIT / Apache 2.0
- **Description:** Fast, simple math library for games/graphics in Rust. f32 and f64 types. SIMD-optimized. WASM-compatible.
- **Why it matters:** Lighter than nalgebra for transform math. Used by Bevy.

---

## Summary: What Game Tech Gives Us for Free

| NEXUS Need | Game Engine Solution | Project |
|-----------|---------------------|---------|
| Entity data model (500k+ entities) | ECS with sparse storage | **Flecs**, **Bevy ECS**, or **bitECS** |
| Clash detection (BIM) | BVH collision detection | **Rapier** / **Parry** (Rust/WASM) |
| Spatial queries ("find all columns in zone F5") | AABB tree, ray casting | **Rapier** / **Parry** |
| WebGPU rendering (Rust path) | Cross-platform GPU API | **wgpu** |
| Undo/redo with full history | Event sourcing | **Thalo** / **eventually-rs** |
| Parametric constraint graph | Node-based evaluation DAG | Study **Blender Geometry Nodes** |
| Scene management | Scene graph + ECS world | **Bevy** patterns |
| Plugin/extension system | Modular architecture | **Bevy** plugin model |
| Coordinate math | Linear algebra | **nalgebra** / **glam** |
| Real-time collaboration | CRDT state sync | **Yjs** / **Automerge** (already in Tier 1) |

---

## Recommendation: What to Clone from This List

Add to Tier 1 (clone & study):

| Project | Why |
|---------|-----|
| **Rapier** | Clash detection solved. WASM bindings ready. Use directly. |
| **Flecs** | Best standalone ECS. WASM support. Relationship system for constraint graphs. |

Study docs only (Tier 2):

| Project | Why |
|---------|-----|
| **Bevy** | ECS patterns, plugin architecture, wgpu rendering approach |
| **Blender** | Geometry Nodes (DAG), operator pattern, data model |
| **wgpu** | Only if we build custom Rust renderer later |
| **Godot** | Web export patterns, scene management |
