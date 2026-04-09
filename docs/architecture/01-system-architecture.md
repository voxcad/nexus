# NEXUS -- System Architecture

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  LAYER 6 — AGENTIC UI SHELL                                       │
 │  NL prompt bar · agent panel · generative design · command line    │
 ├─────────────────────────────────────────────────────────────────────┤
 │  LAYER 5 — RENDERING ENGINE                                       │
 │  CesiumJS · xeokit-sdk · WebGPU CAD · Potree 2 · Compositor       │
 ├─────────────────────────────────────────────────────────────────────┤
 │  LAYER 4 — HEADLESS GEOMETRY API                                   │
 │  REST/GraphQL · WebSocket deltas · FlatBuffers · RBAC              │
 ├─────────────────────────────────────────────────────────────────────┤
 │  LAYER 3 — AI ORCHESTRATION (Intelligence Plane)                   │
 │  LLM Gateway · Multi-Agent Supervisor · Geometric RAG · Memory     │
 ├─────────────────────────────────────────────────────────────────────┤
 │  LAYER 2 — GEOMETRIC / SPATIAL KERNEL (WASM)                       │
 │  OpenCASCADE · Manifold · GDAL/PROJ · JSTS · web-ifc · COPC       │
 ├─────────────────────────────────────────────────────────────────────┤
 │  LAYER 1 — DATA PERSISTENCE (Local-First)                          │
 │  OPFS · SQLite WASM + SpatiaLite · IndexedDB · Vector Store · Yjs  │
 ├─────────────────────────────────────────────────────────────────────┤
 │  LAYER 0 — PHYSICAL / IoT INGESTION                                │
 │  ROS 2 · rosbridge WebSocket · micro-ROS WebRTC · LiDAR · Drones   │
 └─────────────────────────────────────────────────────────────────────┘
        ▲               ▲                ▲               ▲
        │               │                │               │
   ┌────┴────┐   ┌──────┴──────┐  ┌──────┴──────┐  ┌────┴────┐
   │ Robots  │   │ IoT Sensors │  │ LiDAR/Drone │  │  Cloud  │
   │ (ROS 2) │   │ (MQTT/WS)   │  │  Scanners   │  │  Sync   │
   └─────────┘   └─────────────┘  └─────────────┘  └─────────┘
```

---

## Layer 0 -- Physical / IoT Ingestion

### Responsibility

Ingest real-time telemetry from physical devices -- robots, drones, total stations, IoT sensors, and LiDAR scanners -- and deliver decoded, timestamped messages to Layer 1 for persistence and Layer 2 for geometric integration.

### Technology Choices

| Component | Technology | Version / Notes |
|---|---|---|
| Robot middleware | ROS 2 Jazzy Jalisco | LTS, DDS-based pub/sub |
| Browser bridge | rosbridge_suite 1.3+ | WebSocket JSON/CBOR transport |
| Low-latency path | micro-ROS over WebRTC | DataChannel for sub-50ms telemetry |
| Protocol decode | Custom WASM CDR decoder | Decodes ROS 2 CDR binary in-browser, avoids JSON overhead |
| Point cloud stream | COPC incremental tiles | Delta-encoded octree nodes over WebSocket |
| Sensor normalization | SensorThings API (OGC) | For non-ROS IoT devices (temperature, strain, tilt) |

### Latency Budgets

| Data Type | Budget | Rationale |
|---|---|---|
| Robot telemetry (pose, joint state) | 50ms | Safety-critical for remote operation |
| Point cloud delta (incremental scan) | 200ms | Perceptual continuity for progressive loading |
| Full scan ingest (new LiDAR capture) | 500ms | Background task, user sees progress bar |
| IoT sensor reading | 1000ms | Non-safety, trend data |

### Interfaces

- **Down (physical):** ROS 2 DDS topics, MQTT 5.0, raw TCP/UDP for proprietary scanners.
- **Up (Layer 1):** Writes raw messages to OPFS as append-only logs. Writes decoded spatial features to SQLite WASM via Layer 1's write API.
- **Up (Layer 2):** Publishes geometry-relevant events (new point cloud tile, updated robot pose) to the in-browser event bus for kernel consumption.

### Failure Modes

- **WebSocket disconnect:** Exponential backoff reconnect with jitter. Buffer last 60s of messages in a SharedArrayBuffer ring buffer. Replay on reconnect.
- **CDR decode failure:** Log malformed message, skip, increment error counter. Never crash the ingest pipeline for a single bad frame.
- **Bandwidth saturation:** Adaptive quality -- reduce point density or telemetry frequency. Prefer dropping old frames over blocking new ones.

### Rejected Alternatives

- **Server-side ROS bridge with REST polling:** Adds 200ms+ round-trip. Rejected.
- **gRPC-Web for ROS transport:** Requires proxy, breaks local-first. Rejected.
- **Raw DDS in browser via WebTransport:** DDS implementations are not browser-ready as of 2026. Revisit when eProsima ships a WASM DDS participant.

---

## Layer 1 -- Data Persistence (Local-First)

### Responsibility

Store all project data on the user's device first. Provide spatial query capability locally. Synchronize with cloud peers when connectivity exists and the user opts in. Guarantee that no data is lost if the browser tab closes unexpectedly.

### Technology Choices

| Component | Technology | Version / Notes |
|---|---|---|
| Raw file storage | Origin Private File System (OPFS) | Synchronous access via FileSystemSyncAccessHandle in Worker |
| Spatial database | sql.js-httpvfs + SpatiaLite | SQLite 3.45+ compiled to WASM, SpatiaLite 5.1 for R-tree and geometry |
| Metadata/preferences | IndexedDB | Via idb-keyval 6.x for simplicity |
| Vector embeddings | hnswlib-wasm 0.8+ | HNSW index for semantic geometry search, stored in OPFS |
| Real-time sync | Yjs 13.6+ | CRDT-based, y-indexeddb for offline, y-websocket for multi-user |
| Cloud object store | S3-compatible (MinIO / Cloudflare R2) | IFC, LAS, COG files. Never AWS-locked. |
| Cloud spatial DB | PostGIS 3.4+ on PostgreSQL 16 | Server-side spatial queries for cross-project search |
| Cloud sync protocol | Custom CRDT merge over WebSocket | Yjs awareness protocol + custom conflict resolver for geometric ops |

### File Format Registry

| Format | Extension | Storage | Parser |
|---|---|---|---|
| IFC | .ifc, .ifczip | OPFS | web-ifc |
| Point Cloud | .las, .laz, .copc | OPFS | copc.js / laz-perf WASM |
| Vector GIS | .geojson, .gpkg, .shp | OPFS | GDAL WASM |
| Raster GIS | .tif (COG), .jp2 | OPFS | GeoTIFF.js / GDAL WASM |
| CAD exchange | .step, .iges, .brep | OPFS | OpenCASCADE WASM |
| 2D CAD | .dxf | OPFS | dxf-parser + custom WASM |
| Mesh | .glb, .gltf, .obj, .stl | OPFS | three.js loaders / Manifold |

### Interfaces

- **Down (Layer 0):** Receives raw telemetry buffers and decoded spatial features. Writes to OPFS and SQLite respectively.
- **Up (Layer 2):** Provides file handles (OPFS) and query results (SQLite) to the geometry kernel. Layer 2 never touches IndexedDB directly.
- **Lateral (Cloud):** Yjs sync provider pushes CRDT updates. File sync uses content-addressed chunking (similar to Restic) to minimize transfer.

### Failure Modes

- **OPFS quota exceeded:** Alert user with project size breakdown. Offer to offload cold files to cloud. Never silently delete.
- **SQLite WASM crash:** WAL journal enables recovery. On corruption, rebuild from OPFS source files (the database is a derived cache, not source of truth).
- **Yjs merge conflict on geometry:** Geometric conflicts (two users editing the same B-Rep face) escalate to Layer 3's conflict resolution protocol. Yjs handles text/metadata conflicts automatically.
- **Browser storage evicted:** Persistent storage via `navigator.storage.persist()`. If denied, warn user prominently. Cloud sync becomes strongly recommended.

### Rejected Alternatives

- **PouchDB/CouchDB:** Too document-oriented, no spatial indexes. Rejected.
- **Firestore/Supabase as primary:** Cloud-dependent. Violates Decision #4. Rejected.
- **Automerge instead of Yjs:** Yjs has superior performance for large documents (benchmarked 10x faster on 100K operations). Rejected.

---

## Layer 2 -- Geometric / Spatial Kernel (WASM)

### Responsibility

Execute all geometric and spatial computation in the browser via WebAssembly. Provide B-Rep modeling, mesh operations, coordinate transforms, spatial queries, BIM parsing, and point cloud processing. This is the computational heart of NEXUS.

### Technology Choices

| Component | Technology | Version / Notes |
|---|---|---|
| B-Rep kernel | opencascade.js 2.0+ | OpenCASCADE 7.8 compiled to WASM. Boolean ops, fillet, chamfer, STEP/IGES import/export. |
| Mesh kernel | Manifold 3.0+ WASM | Guaranteed-manifold boolean ops on triangle meshes. 2MB binary. Fast path for non-parametric work. |
| Spatial transforms | PROJ 9.4 WASM | CRS transforms. EPSG database embedded. |
| Vector analysis | GDAL 3.9 WASM (gdal3.js) | OGR for vector features, GDAL for raster. |
| 2D topology | JSTS 2.11+ | JTS Topology Suite port. DE-9IM, buffer, union, Voronoi. |
| BIM engine | web-ifc 0.0.57+ / That Open Engine | IFC2x3, IFC4, IFC4x3 parsing and geometry extraction. |
| Point cloud | copc.js + laz-perf WASM | COPC/LAZ decode, octree spatial index, decimation. |
| Tessellation | OpenCASCADE internal + Manifold | B-Rep to mesh for rendering. Configurable chord tolerance. |

### Kernel Dispatch Strategy

Not every operation needs the full OpenCASCADE kernel. A dispatch router selects the lightest capable engine:

```
Request → Classify → Route:
  Parametric B-Rep edit     → OpenCASCADE (heavy, lazy-loaded)
  Mesh boolean / collision  → Manifold (light, always loaded)
  2D spatial query          → JSTS (light, always loaded)
  CRS transform             → PROJ (light, always loaded)
  IFC property extraction   → web-ifc (medium, lazy-loaded)
  Point cloud query         → COPC octree (medium, lazy-loaded)
```

### Threading Model

All heavy geometry runs in dedicated Web Workers. The main thread never blocks.

- **Worker pool:** 4 long-lived workers (configurable). Each owns an OpenCASCADE instance.
- **SharedArrayBuffer:** Geometry buffers shared zero-copy between workers and the rendering thread.
- **Transferable objects:** ArrayBuffers transferred (not copied) between main thread and workers.
- **Atomics:** Used for synchronization on shared geometry buffers. Requires `Cross-Origin-Isolation` headers (COOP/COEP).

### Interfaces

- **Down (Layer 1):** Reads files from OPFS via FileSystemSyncAccessHandle. Queries SpatiaLite for spatial filters before loading geometry.
- **Up (Layer 3):** Exposes a typed function catalog that the AI orchestration layer can call. Every geometric operation is a callable tool.
- **Up (Layer 4):** Provides the implementation behind the Headless Geometry API. Layer 4 is the access-controlled wrapper; Layer 2 is the engine.
- **Up (Layer 5):** Produces tessellated meshes (Float32Array vertex buffers, Uint32Array index buffers) for rendering. Publishes geometry-changed events.

### Failure Modes

- **OpenCASCADE WASM OOM:** Monitor `WebAssembly.Memory` growth. If approaching browser limits (~4GB on 64-bit), serialize state, terminate worker, restart with fresh memory. Warn user about model complexity.
- **Boolean operation failure:** OpenCASCADE booleans fail on degenerate geometry (~5% of real-world models). Fallback: re-mesh with Manifold, attempt mesh boolean, flag result as non-parametric.
- **WASM module fetch timeout:** Service worker caches all WASM binaries. After first load, kernel starts from cache. If cache is empty and network is down, degrade to Manifold-only mode.

### Rejected Alternatives

- **Three.js CSG:** Toy-grade, no B-Rep, no STEP support. Rejected for anything beyond demos.
- **Server-side FreeCAD/OpenCASCADE:** Violates browser-native principle. Rejected as primary path (retained as emergency fallback per executive summary).
- **Babylon.js CSG v2:** Mesh-only, no parametric history. Rejected.
- **CGAL WASM:** License is GPL/LGPL. Violates Decision #5. Rejected.

---

## Layer 3 -- AI Orchestration (The Intelligence Plane)

### Responsibility

Coordinate AI agents that operate on the geometric model. Provide LLM-driven natural language interaction, multi-agent task decomposition, retrieval-augmented generation over project data, and human-agent handoff with conflict resolution. This layer makes NEXUS an agentic platform, not just a tool with a chatbot.

### Technology Choices

| Component | Technology | Version / Notes |
|---|---|---|
| LLM Gateway | Vercel AI SDK 4.x | Provider-agnostic. Anthropic Claude, OpenAI, local Ollama. Tool-calling first. |
| Agent framework | LangGraph.js 0.2+ | Stateful, graph-based agent orchestration. Event-bus MAS topology. |
| Embeddings | Nomic Embed v2 (local ONNX) or API | 768-dim embeddings for geometry properties, IFC metadata. |
| Vector search | hnswlib-wasm (Layer 1) | In-browser nearest-neighbor over geometry embeddings. |
| Agent memory | Custom 3-tier store | Short-term (session), long-term (project), episodic (cross-project). |
| Tool registry | Typed function catalog from Layer 2 | Every geometry op is an LLM-callable tool with JSON Schema. |
| Conflict resolution | Custom protocol over Yjs awareness | Agent proposes, human approves/rejects, CRDT records decision. |

### Multi-Agent Architecture

```
┌──────────────────────────────────────────────┐
│              SUPERVISOR AGENT                 │
│  (routes tasks, manages agent lifecycle)     │
├──────────┬──────────┬──────────┬─────────────┤
│ Geometry │ Analysis │ Code Gen │ Regulatory   │
│ Agent    │ Agent    │ Agent    │ Agent        │
│          │          │          │              │
│ B-Rep    │ Clash    │ IFC      │ Code check   │
│ edits,   │ detect,  │ scripts, │ compliance,  │
│ param    │ quantity │ report   │ zoning,      │
│ modeling │ takeoff  │ gen      │ accessibility│
└──────────┴──────────┴──────────┴──────────────┘
```

Each agent is a LangGraph.js node with:
- **Scoped tool access:** Geometry Agent can call OpenCASCADE tools. Analysis Agent can query SpatiaLite. Neither can delete files.
- **Bounded context window:** Agents receive only relevant geometry embeddings, not the full model.
- **Audit trail:** Every agent action is logged as an immutable event in the project event store.

### Geometric RAG Pipeline

1. **Index:** On IFC import, extract property sets, spatial relationships, and geometric features. Embed each entity as a 768-dim vector.
2. **Store:** Write embeddings to hnswlib-wasm index in OPFS.
3. **Retrieve:** On user query ("find all beams connected to column C-14"), retrieve top-K similar entities by vector similarity + SpatiaLite spatial filter.
4. **Augment:** Inject retrieved entities (with properties and spatial context) into the LLM prompt.
5. **Generate:** LLM produces a tool-call sequence (e.g., select entities, highlight, compute quantities).

### Agent Memory Model

| Tier | Scope | Storage | TTL |
|---|---|---|---|
| Short-term | Current editing session | In-memory (JavaScript heap) | Session end |
| Long-term | Project lifetime | SQLite WASM (Layer 1) | Project deletion |
| Episodic | Cross-project patterns | Vector store (hnswlib-wasm) | User-managed |

### Human-Agent Handoff Protocol

1. Agent proposes an action (e.g., "Move wall W-7 north by 300mm to satisfy fire egress").
2. Proposal rendered as a ghost overlay in Layer 5 (transparent geometry preview).
3. User accepts, rejects, or modifies.
4. On accept: CRDT commit via Yjs, action enters undo history.
5. On reject: Agent receives rejection reason, adjusts strategy.
6. On conflict (two agents propose contradictory edits): Supervisor mediates, presents both options to user.

### Interfaces

- **Down (Layer 2):** Calls geometry kernel functions as tools. Receives computation results.
- **Down (Layer 1):** Reads/writes agent memory. Queries vector store.
- **Up (Layer 4):** Agent actions flow through the Headless Geometry API (same path as programmatic access).
- **Up (Layer 6):** Publishes agent state (thinking, acting, waiting) to the UI shell.

### Failure Modes

- **LLM provider down:** Fallback chain: primary provider -> secondary provider -> local Ollama (reduced capability). Never block the UI.
- **Agent infinite loop:** LangGraph.js step limit (default: 25 steps). Supervisor terminates runaway agents and reports failure.
- **Hallucinated tool call:** Tool registry validates all parameters against JSON Schema before execution. Invalid calls return structured errors to the agent, not silent failures.
- **Embedding model mismatch:** Version-pin embedding model. If model changes, re-index project (background task with progress indicator).

### Rejected Alternatives

- **AutoGPT / CrewAI:** Unstructured agent loops, poor observability. Rejected.
- **LangChain (non-graph):** Sequential chains too rigid for spatial reasoning that requires branching. Rejected in favor of LangGraph.js.
- **Fine-tuned geometry LLM:** Training data insufficient for AEC-specific geometry reasoning. Tool-calling with a general LLM + typed geometry API is more reliable today. Revisit in 2027.

---

## Layer 4 -- Headless Geometry API

### Responsibility

Expose Layer 2's geometry kernel and Layer 3's AI capabilities as a network-accessible API that agents, scripts, CI/CD pipelines, and external tools can consume without a browser UI. This is how NEXUS becomes a platform, not just an application.

### Technology Choices

| Component | Technology | Version / Notes |
|---|---|---|
| REST API | Hono 4.x on Cloudflare Workers or Node | Lightweight, edge-deployable. |
| GraphQL | Yoga 5.x with Pothos schema builder | For complex relational queries across BIM elements. |
| WebSocket | Hono WebSocket / native WS | Streaming geometry deltas, agent status. |
| Binary protocol | FlatBuffers 24.x | Zero-copy deserialization for high-frequency geometry updates (vertex buffers, transforms). |
| Schema validation | Zod 3.x | Runtime validation of all API inputs. TypeScript types generated from Zod schemas. |
| Auth | JWT + RBAC | Agent tokens scoped to specific domains (geometry, analysis, admin). |
| API docs | OpenAPI 3.1 auto-generated from Hono | Machine-readable, agents can self-discover capabilities. |

### API Surface (Key Endpoints)

```
POST   /geometry/boolean          -- Union, subtract, intersect B-Rep bodies
POST   /geometry/transform        -- Translate, rotate, scale, mirror
GET    /geometry/query             -- Spatial query (bbox, within, intersects)
POST   /geometry/import            -- Upload IFC/STEP/LAS, returns entity IDs
GET    /geometry/export/:format    -- Export to IFC/STEP/glTF/LAS
WS     /geometry/stream            -- Subscribe to geometry change deltas
POST   /ai/prompt                  -- Natural language -> tool calls -> result
WS     /ai/agent                   -- Long-running agent session
GET    /project/entities           -- GraphQL endpoint for BIM entity queries
POST   /project/sync               -- Trigger CRDT sync
```

### Binary Protocol Design

For high-frequency updates (robot pose at 20Hz, point cloud tiles):

```
FlatBuffer Schema:
  GeometryDelta {
    entity_id: uint64;
    operation: DeltaOp (enum: Transform, MeshUpdate, PropertyChange, Delete);
    timestamp: uint64;  // microseconds since epoch
    payload: [ubyte];   // operation-specific binary data
  }
```

FlatBuffers chosen over Protocol Buffers for zero-copy reads in WASM. Protobuf requires deserialization; FlatBuffers reads directly from the wire buffer.

### Permission Model

```
Role            | Geometry Write | Analysis Read | AI Invoke | Admin |
----------------|----------------|---------------|-----------|-------|
Human Operator  | yes            | yes           | yes       | yes   |
Geometry Agent  | scoped         | yes           | no        | no    |
Analysis Agent  | no             | yes           | no        | no    |
External Script | scoped         | scoped        | no        | no    |
Read-Only View  | no             | yes           | no        | no    |
```

"Scoped" means write access limited to specific entity types or spatial regions. A Geometry Agent editing structural beams cannot modify MEP elements unless explicitly granted cross-domain access.

### Interfaces

- **Down (Layer 2):** Directly invokes WASM kernel functions. In browser context, this is same-process. In server context, this runs OpenCASCADE in a Node.js WASM runtime.
- **Down (Layer 3):** Routes AI prompts to the orchestration layer.
- **Up (Layer 5):** Rendering engine subscribes to geometry deltas via internal event bus (no network hop in browser context).
- **Up (Layer 6):** UI shell consumes the same API as external agents -- no privileged internal API.

### Failure Modes

- **Malformed geometry input:** Zod validation catches schema violations. Geometry kernel validates topological consistency. Reject with structured error, never partial application.
- **Binary protocol version mismatch:** FlatBuffer schema includes version field. Server rejects clients with incompatible schema versions and returns upgrade URL.
- **Permission escalation attempt:** JWT claims are verified on every request. Token refresh requires re-authentication. Scoped tokens cannot be widened without admin action.
- **WebSocket backpressure:** If a client cannot consume deltas fast enough, server drops oldest unacknowledged frames and sends a "resync required" message. Client requests full state snapshot.

### Rejected Alternatives

- **gRPC-Web:** Requires proxy for browser clients. Extra infrastructure. Hono + FlatBuffers achieves same performance without the proxy tax. Rejected.
- **tRPC:** TypeScript-only clients. Agents may be Python. Rejected in favor of OpenAPI + FlatBuffers.
- **Custom binary protocol without schema:** Unmaintainable. FlatBuffers provides forward/backward compatibility. Rejected.

---

## Layer 5 -- Rendering Engine

### Responsibility

Render all spatial data -- BIM models, GIS terrain, point clouds, parametric CAD, and robot positions -- in a unified 3D viewport. Composite multiple specialized renderers into a coherent visual output via a shared WebGPU context.

### Technology Choices

| Sub-Renderer | Technology | Version / Notes | Scope |
|---|---|---|---|
| A: GIS | CesiumJS 1.120+ | Global terrain, 3D Tiles, satellite imagery, WMS/WMTS | Planet-scale context |
| B: BIM | xeokit-sdk 2.6+ | IFC visualization, section planes, BCF viewpoints, large model perf | Building-scale BIM |
| C: CAD | Custom WebGPU renderer | Parametric surfaces, NURBS display, edge rendering | Precise engineering |
| D: Point Cloud | Potree 2.0+ | Massive point cloud rendering, eye-dome lighting, GPU octree | Survey/LiDAR data |
| Compositor | Custom render-pass orchestrator | Shared WebGPU device, ordered render passes | Unification |

### Compositor Architecture

All four sub-renderers share a single `GPUDevice` and render to separate `GPUTexture` targets. The compositor merges them with depth-aware blending:

```
Pass 1: CesiumJS renders terrain + imagery → Texture A (color + depth)
Pass 2: xeokit renders BIM model            → Texture B (color + depth)
Pass 3: WebGPU CAD renders parametric        → Texture C (color + depth)
Pass 4: Potree renders point cloud           → Texture D (color + depth)
Pass 5: Compositor depth-composites A+B+C+D  → Final framebuffer
Pass 6: Post-processing (SSAO, edge detect)  → Screen
```

### Coordinate Bridge

The fundamental challenge: CesiumJS operates in ECEF (Earth-Centered, Earth-Fixed) coordinates with 64-bit precision. CAD operates in local Cartesian with millimeter precision. These must coexist.

**Solution: Floating-origin with logarithmic depth buffer.**

- All renderers share a common floating origin, updated when the camera moves beyond a threshold (e.g., 10km from current origin).
- Origin is expressed as an ECEF coordinate. Local CAD coordinates are offsets from this origin.
- Logarithmic depth buffer (implemented in WebGPU fragment shader) provides usable depth precision from 1mm to 10,000km.
- PROJ WASM (Layer 2) handles CRS conversions between the project CRS, ECEF, and the rendering coordinate frame.

### Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Frame rate | 60fps sustained | Chrome DevTools Performance panel |
| BIM model capacity | 5M triangles interactive | xeokit benchmark suite |
| Point cloud capacity | 500M points (out-of-core) | Potree LOD system, 2M points visible per frame |
| First meaningful paint | < 2s | Skeleton UI + progressive geometry load |
| Memory ceiling | 4GB GPU, 8GB system | WebGPU buffer tracking + manual GC |

### Interfaces

- **Down (Layer 2):** Receives tessellated geometry (vertex/index buffers as SharedArrayBuffer). Subscribes to geometry-changed events.
- **Down (Layer 4):** Geometry deltas via WebSocket trigger incremental re-renders (not full scene rebuilds).
- **Up (Layer 6):** Provides picking (ray-cast hit results), camera control API, screenshot/export, and measurement overlay API to the UI shell.

### Failure Modes

- **WebGPU not available:** Fall back to WebGL 2 via CesiumJS and xeokit's WebGL backends. Custom CAD renderer has a WebGL 2 fallback path (reduced quality, no compute shaders). Display banner: "Upgrade browser for full experience."
- **GPU OOM:** Monitor `GPUDevice.lost` promise. On loss, reduce LOD aggressively, flush least-recently-used textures, attempt device re-creation. If repeated, suggest the user close other GPU-intensive tabs.
- **Sub-renderer crash:** Each sub-renderer runs in a try/catch boundary. A crashed renderer produces a blank layer, not a full application crash. Error overlay on affected viewport quadrant.
- **Depth fighting between renderers:** Logarithmic depth buffer eliminates most issues. Remaining artifacts resolved by per-renderer depth bias tuning (configured per project, stored in Layer 1).

### Rejected Alternatives

- **Three.js as the unified renderer:** No native IFC support, no 3D Tiles, poor large-model performance. A general-purpose engine that is mediocre at every AEC-specific task. Rejected.
- **Babylon.js:** Same issues as Three.js, plus larger bundle. Rejected.
- **Single custom WebGPU renderer for everything:** 2+ years of development to match CesiumJS's globe rendering or Potree's point cloud LOD. Not viable for a v1 timeline. Rejected. We compose specialists.
- **MapLibre GL JS for GIS:** 2D-first, no globe mode, no 3D Tiles. Rejected for the 3D spatial engineering context.

---

## Layer 6 -- Agentic UI Shell

### Responsibility

Provide the human interface to NEXUS. Unify traditional engineering tool UIs (toolbars, property panels, drawing tools) with agentic interfaces (natural language prompt bar, agent activity panel, generative design browser). Ensure that AI-driven actions are transparent, reversible, and inspectable.

### Technology Choices

| Component | Technology | Version / Notes |
|---|---|---|
| Framework | SvelteKit 2.x | Svelte 5 runes. Lighter than React for a render-heavy app. |
| State management | Svelte 5 runes + custom stores | `$state`, `$derived`, `$effect`. No external state library needed. |
| UI primitives | Bits UI 1.x + custom components | Accessible, unstyled primitives. Tailwind CSS 4 for styling. |
| Command palette | cmdk-sv 1.x | Svelte port of cmdk. Keyboard-driven command execution. |
| Layout | Custom dock system | Draggable, resizable panels. Inspired by VS Code layout model. |
| NL prompt bar | Custom component | Streams agent responses via AI SDK. Renders tool calls inline. |
| 3D viewport integration | Custom Svelte action wrapping Layer 5 | `use:viewport` directive binds canvas lifecycle to Svelte component. |

### UI Zones

```
┌───────────────────────────────────────────────────────────┐
│ [Command Palette / NL Prompt Bar]               [≡ Menu] │
├───────────┬───────────────────────────────┬───────────────┤
│           │                               │               │
│  Project  │                               │  Properties   │
│  Tree     │      3D Viewport              │  Panel        │
│           │      (Layer 5 canvas)         │               │
│  Agent    │                               │  Agent        │
│  Activity │                               │  Proposals    │
│  Feed     │                               │  Queue        │
│           │                               │               │
├───────────┼───────────────────────────────┼───────────────┤
│           │  Timeline / Console / Output                  │
└───────────┴──────────────────────────────────────────────┘
```

### Agent Transparency Features

- **Activity Feed:** Real-time stream of agent actions: "Geometry Agent: performing boolean subtract on Wall-14 and Opening-7." Every entry is clickable, expanding to show the tool call, parameters, and result.
- **Proposal Queue:** Pending agent proposals with accept/reject/modify controls. Each proposal includes a ghost-geometry preview in the viewport.
- **Conflict Resolution Panel:** When agents or users produce conflicting edits, a side-by-side comparison view with "pick left / pick right / merge" controls.
- **Audit Log:** Immutable, scrollable history of all actions (human and agent). Filterable by actor, entity, time range.

### Keyboard-First Design

Every action is accessible via keyboard. The command palette (Ctrl/Cmd+K) exposes all operations, including agent invocations. Power users never need to touch the mouse for common workflows.

### Interfaces

- **Down (Layer 5):** Owns the canvas element. Passes user interactions (pick, orbit, pan, zoom) to the rendering engine. Receives picking results and camera state.
- **Down (Layer 4):** All user-initiated geometry operations route through the Headless Geometry API. The UI has no privileged access -- it uses the same API as an external agent.
- **Down (Layer 3):** Displays agent state, streams NL responses, renders proposals.
- **Lateral (Layer 1):** Reads user preferences and session state from IndexedDB.

### Failure Modes

- **UI framework crash:** Svelte error boundary at each panel. A crashed panel shows an error state with a "reload panel" button. The 3D viewport and other panels remain functional.
- **Agent response timeout:** NL prompt bar shows a spinner with elapsed time. After 30s, offers "Cancel" and "Retry with simpler prompt."
- **Layout corruption:** Panel layout serialized to IndexedDB. "Reset layout" command in palette restores defaults. Layout migration on version updates.
- **Accessibility regression:** Automated axe-core checks in CI. WCAG 2.1 AA compliance is a release gate, not a nice-to-have.

### Rejected Alternatives

- **React + Next.js:** RSC and hydration overhead are unnecessary for a single-page spatial app that renders to canvas. React's reconciliation cost is pure waste when 95% of pixels come from WebGPU. Rejected.
- **Electron wrapper:** Violates Decision #1. Rejected.
- **Web Components for UI primitives:** Poor DX, no reactive primitives, styling is painful. Rejected.
- **Figma-style infinite canvas for UI:** Spatial apps need docked panels for property editing and data tables. A free-form canvas UI fights against structured engineering workflows. Rejected.
