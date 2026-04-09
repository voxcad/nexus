# NEXUS — Architectural Risks & Mitigations

---

### Top 5 Risks

| # | Risk | Probability | Impact | Severity |
|---|---|---|---|---|
| 1 | OpenCASCADE WASM performance ceiling | HIGH | HIGH | CRITICAL |
| 2 | Safari WebAssembly limitations | HIGH | MEDIUM | HIGH |
| 3 | LLM geometric reasoning accuracy | HIGH | HIGH | CRITICAL |
| 4 | CRDT conflict resolution for geometry | MEDIUM | HIGH | HIGH |
| 5 | Multi-renderer compositor complexity | MEDIUM | HIGH | HIGH |

---

#### Risk 1 — OpenCASCADE WASM Performance Ceiling

**The problem.** OCCT compiled to WASM produces a 35 MB+ binary. Cold start (download + compile + instantiate) takes 2–4 seconds on a fast connection. Boolean operations run 4–5× slower than native: a moderate B-Rep union takes 200–500 ms in WASM vs. 50–100 ms native. Complex operations (multi-body boolean chains, fillet cascades) can exceed 2 seconds, which is above the 1-second interactivity threshold.

**Probability: HIGH.** This is not speculative — it is the measured current state of OpenCASCADE.js. WASM overhead is structural (no SIMD for all code paths, no threading for serial algorithms, memory indirection costs). Performance will improve incrementally with WASM GC and relaxed SIMD, but the 3–5× gap will persist through 2026.

**Impact: HIGH.** B-Rep operations are the core of parametric CAD. If they feel slow, power users will reject the platform.

**Mitigation:**
1. **Lazy module loading.** OCCT WASM is loaded only when the user first invokes a B-Rep operation — not at app startup. Until then, the 35 MB binary is not fetched. Estimated cold-start reduction for non-CAD users: 100%.
2. **Pre-compiled geometry cache in OPFS.** After a boolean operation completes, cache the result B-Rep in OPFS keyed by operation hash (input shapes + parameters). Repeat operations are instant lookups (~5 ms).
3. **Manifold WASM as fast path.** For mesh-level booleans (no B-Rep fidelity needed), route through Manifold WASM (30–80 ms for equivalent operations, 500 KB binary). Use Manifold for preview, OCCT for final parametric result.
4. **Server-side OCCT fallback.** For batch operations (>10 sequential booleans), offer optional server-side execution with result streamed back. Local-first is preserved — the server is a compute accelerator, not a requirement.

---

#### Risk 2 — Safari WebAssembly Limitations

**The problem.** Safari enforces a 2 GB WASM heap limit (vs. 4 GB on Chrome/Firefox). SharedArrayBuffer support is restricted (requires cross-origin isolation headers that break some third-party embeds). WebGPU is available only in Safari 18+ (released late 2024), with incomplete feature coverage. Collectively, Safari users get ~50% of the memory budget and ~70% of the GPU capability.

**Probability: HIGH.** Apple controls Safari's release cadence. These limitations are facts, not risks — they are the current state.

**Impact: MEDIUM.** Safari represents ~18% of desktop browser share (primarily macOS users). Many enterprise engineering teams use Chrome or Edge. However, some architecture firms are Mac-exclusive.

**Mitigation:**
1. **Safari-specific memory budget.** Detect Safari at init. Set WASM heap ceiling to 1.5 GB (with 500 MB headroom). Enforce aggressive LOD: reduce tile cache from 2000 to 800, reduce point cloud budget from 100 M to 30 M points.
2. **Progressive enhancement.** Safari gets WebGL2 rendering path (no WebGPU). Feature-detect `navigator.gpu` and fall back gracefully. The UI is identical; shading quality and instancing performance are reduced.
3. **Chrome/Firefox priority for v1.** Marketing and documentation recommend Chrome. Safari is "supported" but not "optimized." Revisit when Safari 19 ships (expected late 2025) with improved WASM and WebGPU support.
4. **Memory pressure monitoring.** Use `performance.measureUserAgentSpecificMemory()` (Chrome) and fallback heuristics (Safari) to detect approaching OOM. Proactively evict cached geometry before crash.

---

#### Risk 3 — LLM Geometric Reasoning Accuracy

**The problem.** Current frontier LLMs (Claude Sonnet 4, GPT-4o) demonstrate strong text and code reasoning but struggle with precise 3D spatial reasoning. They cannot reliably: compute boolean intersections mentally, predict topology changes from parameter modifications, or generate valid B-Rep geometry from natural language descriptions. Tool-calling helps — the LLM selects operations rather than computing geometry — but tool parameter selection can still produce geometrically invalid results (self-intersecting surfaces, non-manifold edges, degenerate faces).

**Probability: HIGH.** This is the current state of LLM capabilities. Models are improving rapidly, but reliable 3D spatial reasoning is likely 2–3 years out.

**Impact: HIGH.** If the AI agent produces invalid geometry that passes through to approved state, it could cause real-world engineering failures. Even non-safety-critical invalid geometry erodes user trust.

**Mitigation:**
1. **Constrained tool schemas.** The LLM does not output arbitrary coordinates. It selects from enumerated operations with validated parameter ranges. Example: instead of "place a column at (x, y, z)", the schema offers "place a column on grid intersection (A, 3) at floor level 2" where grid intersections are pre-validated positions.
2. **Geometric validation layer.** Every agent output passes through a topology checker before commit: manifold check (Manifold WASM), self-intersection test (OCCT), constraint satisfaction (parametric solver). Invalid geometry is rejected with a diagnostic message returned to the agent for retry (max 3 attempts).
3. **Human-in-the-loop for structural geometry.** All load-bearing, safety-critical, or code-compliance geometry requires explicit human approval. The agent cannot auto-approve structural changes regardless of confidence score.
4. **Confidence-gated autonomy.** Agent actions with `confidenceScore < 0.7` are automatically routed to human review. Actions with `confidenceScore >= 0.9` on non-structural geometry may be auto-approved per project policy.

---

#### Risk 4 — CRDT Conflict Resolution for Geometry

**The problem.** CRDTs (Yjs) excel at merging concurrent text edits because character insertion is commutative. Geometry is not commutative. Two users concurrently editing vertices of the same polygon can produce self-intersecting geometry. Two users concurrently applying different boolean operations to the same solid can produce topologically inconsistent results. The CRDT correctly merges the operations — but the merged state may be geometrically invalid.

**Probability: MEDIUM.** Concurrent edits to the exact same entity are relatively rare in practice (users tend to work on different parts of a model). But when it happens, the consequences are severe.

**Impact: HIGH.** Self-intersecting or non-manifold geometry silently corrupts downstream operations (meshing, analysis, fabrication export). If undetected, it propagates.

**Mitigation:**
1. **Entity-level last-writer-wins (LWW).** CRDT conflict resolution operates at the entity level, not the vertex level. If two users edit the same entity concurrently, the last write wins for the entire entity. The "losing" edit is preserved in the event log and can be manually re-applied.
2. **Geometric validity check on merge.** After every CRDT merge, run a lightweight topology check on affected entities (~1–5 ms per entity via Manifold WASM). Flag invalid geometry immediately.
3. **Automatic repair for simple cases.** Self-intersecting polygons can often be repaired via Manifold's `repair()` function. Non-manifold edges from concurrent booleans can be resolved by re-executing the boolean sequence in deterministic order.
4. **Human resolution UI for complex conflicts.** When automatic repair fails, present both versions side-by-side in the viewport with a "resolve conflict" modal. Show the diff (highlighted vertices/faces that differ). Let the user pick one version or manually merge.
5. **Entity locking (opt-in).** For high-stakes geometry, users can acquire a soft lock on an entity. Other users see a lock icon and are warned before editing. Locks auto-expire after 5 minutes of inactivity.

---

#### Risk 5 — Multi-Renderer Compositor Complexity

**The problem.** NEXUS composites four rendering libraries in a single viewport: CesiumJS (GIS terrain + imagery), Three.js (BIM models + CAD overlays), Potree (point clouds), and potentially xeokit (IFC). Each library maintains its own scene graph, camera, projection matrix, and depth buffer. Compositing them produces: z-fighting between overlapping renderers, coordinate system mismatches (CesiumJS uses ECEF, Three.js uses local Cartesian), frame budget exhaustion (four renderers competing for 16.67 ms), and maintenance burden across four dependency trees.

**Probability: MEDIUM.** Multi-renderer compositing is a known hard problem. Several projects (TerriaJS, iTwin.js) have solved subsets of it, but none combine all four rendering domains in a single WebGPU viewport.

**Impact: HIGH.** Visual artifacts (z-fighting, flickering, misaligned overlays) destroy the professional credibility of the platform. Frame rate drops below 30 fps make the tool unusable for interactive design.

**Mitigation:**
1. **Shared depth buffer.** All renderers write to a single depth texture. CesiumJS renders first (terrain is the base layer), writes depth. Three.js reads CesiumJS depth for occlusion. Potree reads combined depth. This eliminates z-fighting between renderers.
2. **Unified camera controller.** A single camera controller (custom, framework-agnostic) computes the view and projection matrices. Each renderer receives the matrices rather than maintaining its own camera. This eliminates coordinate mismatches.
3. **Frame budget allocator.** Target: 60 fps = 16.67 ms/frame. Allocation: GIS terrain 4 ms, BIM models 4 ms, point cloud 4 ms, CAD overlays 2 ms, compositor overhead 2 ms. Each renderer has a GPU timer query. If a renderer exceeds its budget, the allocator reduces its LOD for the next frame.
4. **Single WebGPU context (v2).** In v2, migrate all renderers to a single WebGPU device with render-pass orchestration. This eliminates context-switching overhead and enables shared GPU memory. Estimated development cost: 4–6 months.
5. **Progressive renderer activation.** Not all renderers are active simultaneously. If the user is zoomed into a BIM detail view, the GIS terrain renderer drops to a static skybox (0 ms). Only renderers with visible content consume frame budget.

---

### The One Decision to Change if Budget Doubled

**Build a custom WebGPU rendering engine from scratch.** Replace the Three.js + CesiumJS + Potree + xeokit compositor with a single, unified WebGPU renderer purpose-built for NEXUS.

A unified renderer eliminates Risk #5 entirely. It also provides:
- Shared GPU memory pool (no redundant geometry buffers across libraries).
- Single scene graph with heterogeneous node types (terrain tiles, BIM meshes, point clouds, B-Rep tessellations).
- One coordinate system, one depth buffer, one camera, one frame budget.
- Custom LOD strategy optimized for engineering workflows (not gaming or cartography).

**Estimated cost:** 6 months, 3 senior graphics engineers ($150K/month fully loaded = ~$900K).
**Estimated performance gain:** 30–50% over compositor approach due to eliminated overhead.
**Risk:** High execution risk. Custom renderers are notoriously difficult to ship. If the team is not deeply experienced with WebGPU, this becomes a 12-month project that delays the entire platform.

This is the correct long-term architecture. It is too expensive and too risky for MVP. The compositor approach ships in 3 months and is good enough to validate the market. If NEXUS achieves product-market fit, the custom renderer is Sprint 1 of the post-funding roadmap.

---

### The One Irreversible Decision

**The Entity-Component-System (ECS) data model.**

Once NEXUS stores entities as sparse component arrays and every system — rendering, AI query, CRDT sync, collision detection, event sourcing, export — depends on the ECS layout, migrating to an OOP class hierarchy is effectively impossible without rewriting every system. This is not an exaggeration: ECS and OOP are structurally incompatible. ECS composes behavior from data arrays; OOP inherits behavior from class trees. The data access patterns, memory layouts, and query APIs are fundamentally different.

**Why ECS is correct for NEXUS:**
- **Cache performance.** Iterating over contiguous component arrays (all `TransformComponent` values in sequence) is 10–100× faster than chasing pointers through an OOP object graph. For 100K+ entities, this is the difference between 1 ms and 100 ms per frame.
- **Composability.** A survey point, a BIM column, and a point cloud chunk are all just entities with different component sets. No diamond inheritance, no fragile base class problem.
- **Serialization.** ECS state is trivially serializable (component arrays → ArrayBuffer → OPFS/network). OOP object graphs require custom serializers for every class.
- **AI queryability.** An LLM agent can query "all entities with TransformComponent where position.z > 10" via a simple array filter. OOP would require type-specific query methods for every class.

**The commitment:** Invest heavily in ECS schema design during Sprint 0. Get the component taxonomy right. Validate it against all five system domains (rendering, AI, sync, physics, export) before writing production code. The ECS schema is the load-bearing wall of the entire architecture. If it is wrong, everything built on top of it is wrong.
