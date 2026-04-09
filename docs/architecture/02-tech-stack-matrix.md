# NEXUS Tech Stack Matrix

**Status:** BINDING
**Decision Authority:** CTO
**Date:** 2026-04-09
**Constraint:** All components MIT / Apache 2.0 / LGPL. No proprietary runtime dependencies. AI agents are first-class consumers of every API surface.

---

## B1 -- Frontend Framework

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **Svelte 5 (runes)** | **MIT** | **Yes -- compiled output, trivial Worker interop** | **~120k reactive updates/sec (no VDOM diffing)** | **Yes -- compiled components expose predictable DOM; actions/events map to tool calls** | **Proprietary UI frameworks** | **SELECTED** |
| SolidJS 1.9+ | MIT | Yes -- fine-grained, no VDOM | ~100k updates/sec (signals) | Yes -- similar signal model | -- | Strong runner-up. Smaller ecosystem than Svelte, fewer UI component libraries for enterprise dashboards. |
| React 19 | MIT | Yes -- but reconciler sits between you and DOM | ~40-60k updates/sec (VDOM reconciliation is the bottleneck) | Yes -- massive ecosystem | -- | **REJECTED.** Virtual DOM reconciliation is pure waste when the CAD canvas is owner-drawn. React re-renders entire subtrees; Svelte touches only the changed binding. For 100k+ property panel updates during parametric sweeps, React's scheduler becomes the bottleneck. |
| Vue 3.5 | MIT | Yes | ~70k updates/sec (Proxy-based reactivity) | Yes | -- | Viable but no advantage over Svelte. Larger runtime (~33 KB vs ~2 KB Svelte). |
| Qwik 2 | MIT | Partial -- resumability model conflicts with long-lived CAD sessions | ~50k updates/sec | Partial -- serialization boundaries complicate agent state injection | -- | **REJECTED.** Resumability optimizes first-load for content sites. A CAD app is a long-lived SPA; Qwik's lazy-loading granularity adds indirection with zero benefit. No community around engineering UIs. |

**Decision:** Svelte 5 with runes. Compiled reactivity means the framework disappears at build time. Bundle overhead: ~2-4 KB. Fine-grained runes (`$state`, `$derived`, `$effect`) map 1:1 to CAD property bindings without intermediate diffing. WebWorker integration is trivial since compiled output is plain JS with no framework runtime to transfer.

---

## B2 -- 3D Rendering Engine

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **Three.js r170+** | **MIT** | **N/A (JS-native, consumes WASM geometry)** | **~10M triangles @ 60fps WebGL2; WebGPU path doubles this** | **Yes -- imperative scene graph API, fully scriptable** | **Autodesk Viewer, Bentley iModel.js renderer** | **SELECTED** |
| Custom WebGPU compute | Apache 2.0 (our code) | N/A | Theoretical max: GPU-bound only | Yes -- raw API | -- | **SELECTED as auxiliary** for point cloud compute shaders and GPU-side spatial queries. Not a replacement for Three.js scene management. |
| Babylon.js 7+ | Apache 2.0 | N/A | ~10M triangles (comparable) | Yes | -- | **REJECTED.** 2.1 MB minified (vs Three.js 650 KB). Game-engine defaults (physics, particles, GUI system) are dead weight. Inspector/playground tooling is excellent but oriented toward game devs, not engineering precision. Community plugins skew entertainment. |
| PlayCanvas 2+ | MIT | N/A | ~8M triangles | Partial -- editor-centric workflow | -- | **REJECTED.** Architecture assumes their cloud editor as primary authoring tool. Engine is extractable but underdocumented for headless/programmatic use. No double-precision workaround community. |
| Filament WASM | Apache 2.0 | Yes (native WASM build) | ~15M triangles (PBR-optimized) | Limited -- C++ API through WASM bindings | -- | Impressive renderer but API surface is narrow. No scene graph. Would require building all CAD interaction (picking, gizmos, annotations) from scratch. Too much integration cost for marginal rendering gain. |

**Double-precision strategy:** Three.js uses Float32 internally. We use a camera-relative rendering pattern: subtract the camera origin (Float64 in JS) from all coordinates before passing to GPU. This gives micrometer precision within a ~10 km working radius. Proven pattern used by CesiumJS and Google Earth.

---

## B3 -- Global GIS Rendering

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **CesiumJS 1.120+** | **Apache 2.0** | **Partial (DRACO WASM decoders)** | **~500M 3D Tiles points streamed; terrain + imagery + vectors simultaneously** | **Yes -- full JS API, entity/primitive system** | **Google Earth Enterprise, Esri Scene Viewer** | **SELECTED (3D globe)** |
| **MapLibre GL JS 4+** | **BSD-3** | **No (GPU-native)** | **~2M vector features @ 60fps** | **Yes -- style spec is JSON-serializable, fully agent-drivable** | **Mapbox GL JS (proprietary after v2), Esri JS SDK** | **SELECTED (2D map)** |
| **Deck.gl 9+** | **MIT** | **No (GPU-native)** | **~10M points in ScatterplotLayer; ~1M arcs** | **Yes -- declarative layer props** | **Kepler.gl (uses Deck.gl internally)** | **SELECTED (overlay layer system)** |
| iTowns 2.44+ | MIT/CeCILL-B | Partial | ~100M points with 3D Tiles | Yes | -- | **REJECTED.** 90% feature overlap with CesiumJS but 1/20th the community. 47 npm downloads/week vs CesiumJS's 25k. Documentation is French-first. Dual-license (CeCILL-B) adds legal review overhead. |
| OpenLayers 9+ | BSD-2 | No | ~500k vector features | Yes | -- | **REJECTED.** 2D only. No 3D globe, no terrain draping, no 3D Tiles. Would require CesiumJS anyway for the 3D use case, making OpenLayers redundant. MapLibre covers the 2D vector map niche with better GPU performance. |

**Integration pattern:** CesiumJS owns the 3D globe view. MapLibre owns the 2D plan view. Deck.gl layers overlay both via shared viewport state. Camera sync between views uses a shared `ViewState` store in Svelte.

---

## B4 -- BIM / IFC Processing

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **web-ifc 0.0.57+** | **MPL 2.0** | **Yes (C++ compiled to WASM)** | **Parses 500 MB IFC in ~8s (WebWorker); geometry extraction ~15s** | **Yes -- typed API for entity traversal** | **Autodesk Forge IFC pipeline, Solibri parser** | **SELECTED (parser/geometry)** |
| **xeokit-sdk 2+** | **AGPL-3.0 (viewer) / proprietary (SDK)** | **Partial** | **~10M triangles from IFC/BIM; instanced geometry** | **Yes -- entity picking, sectioning, measurements via API** | **Autodesk Viewer, Trimble Connect viewer** | **SELECTED (BIM visualization)** -- note AGPL requires careful isolation or commercial license evaluation |
| **That Open Engine** | **MIT** | **Yes (wraps web-ifc)** | **Same as web-ifc + higher-level component overhead** | **Yes -- component architecture maps well to agent tools** | **BIMserver viewer components** | **SELECTED (high-level BIM components)** |
| IFC.js | MIT | Yes | Deprecated | -- | -- | **REJECTED.** Project officially deprecated. Repository archived. Superseded by That Open Engine which is maintained by the same team. Any dependency on IFC.js is a dead end. |
| IfcOpenShell WASM | LGPL 3.0 | Experimental | Untested at scale in browser | Limited | -- | **REJECTED for browser use.** Excellent on server (Python bindings are best-in-class). WASM build is experimental, undocumented, and 48 MB. Use server-side only for validation/conversion pipelines. |

**Architecture note:** web-ifc runs in a dedicated WebWorker. That Open Engine provides the component abstraction layer (spatial trees, property sets, type decomposition). xeokit handles GPU rendering of the extracted geometry with its own optimized format (XKT).

---

## B5 -- B-Rep / Solid Geometry Kernel

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **OpenCASCADE WASM (opencascade.js)** | **LGPL 2.1** | **Yes -- full OCCT 7.8 compiled to WASM** | **Boolean ops: ~200ms for moderate complexity; NURBS evaluation: real-time for degree <= 5** | **Yes -- full OCCT API exposed, ~2,300 classes** | **Parasolid, ACIS, CGM** | **SELECTED (primary kernel)** |
| **Manifold WASM** | **Apache 2.0** | **Yes -- 180 KB WASM** | **Mesh booleans: 10-100x faster than OCCT for manifold meshes** | **Yes -- simple API (union, difference, intersection)** | **-- (complementary)** | **SELECTED (fast mesh booleans)** |
| CGAL WASM | GPL 3.0 / LGPL (limited) | Yes (community builds) | Comparable to OCCT for many ops | Yes | -- | **REJECTED.** GPL 3.0 for most geometry packages (Booleans, Mesh Generation, Triangulation). LGPL applies only to basic components. Incompatible with our MIT/Apache licensing requirement for the application layer. Non-starter. |
| JSCAD 2.x | MIT | N/A (pure JS) | Boolean ops: ~5x slower than OCCT WASM | Yes | OpenSCAD | **REJECTED.** No NURBS. No filleting. No chamfering. Pure polyhedral CSG only. Hits a hard ceiling at any real mechanical/civil engineering geometry. Adequate for 3D printing toys, inadequate for engineering. |

**WASM load strategy:** OCCT WASM is ~35 MB gzipped. Cold start: 2-4s. Mitigation: (1) lazy-load only when user enters parametric modeling mode, (2) cache in IndexedDB after first load, (3) use Manifold for simple boolean previews while OCCT loads in background. Warm start from IndexedDB: ~800ms.

---

## B6 -- Spatial Database & Indexing (In-Browser)

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **DuckDB WASM 1.1+** | **MIT** | **Yes -- 8 MB WASM** | **~100M rows/sec scan; spatial extension for ST_ functions; native Parquet/Arrow** | **Yes -- SQL interface is inherently agent-friendly** | **PostGIS (for analytics), Esri Geodatabase (for queries)** | **SELECTED (primary)** |
| **flatbush 4+** | **ISC** | **N/A (pure JS)** | **~5M bbox queries/sec; build index for 1M items in ~200ms** | **Yes -- simple API** | **-- (spatial index primitive)** | **SELECTED (R-tree index)** |
| **H3-js 4+** | **Apache 2.0** | **Yes (WASM core)** | **~2M hex resolutions/sec** | **Yes -- resolution + index functions** | **Uber H3 (same, it IS the open-source version)** | **SELECTED (hex indexing)** |
| sql.js | MIT | Yes (SQLite WASM) | ~10M rows/sec scan | Yes -- SQL | -- | **REJECTED.** No spatial extension. SpatiaLite can be bolted on via wa-sqlite but DuckDB's columnar engine is 5-10x faster for analytical queries (aggregations, window functions, joins on spatial data). sql.js is row-oriented SQLite -- wrong engine for analytics. |
| wa-sqlite + SpatiaLite | MIT / MPL | Yes | ~15M rows/sec + spatial ops | Yes -- SQL | PostGIS (lightweight) | Feasible. SpatiaLite provides real spatial SQL. But DuckDB WASM outperforms on every analytical workload and ships spatial as a loadable extension. wa-sqlite is the fallback if DuckDB spatial extension proves unstable. |

**Architecture:** DuckDB WASM runs in a SharedWorker, serving all tabs. Geometry stored as WKB in Parquet files on OPFS. flatbush provides sub-millisecond viewport queries for the active working set in main-thread memory. H3 provides hierarchical aggregation for heatmaps and analytics dashboards.

---

## B7 -- Coordinate Reference Systems

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **PROJ WASM (proj.js)** | **MIT (bindings) / MIT (PROJ 9.x)** | **Yes -- full PROJ 9.4 compiled** | **~500k transforms/sec; supports 8,000+ CRS definitions** | **Yes -- EPSG code in, coordinates out** | **Esri projection engine, Trimble coordinate systems** | **SELECTED (primary)** |
| proj4js 2.12+ | MIT | N/A (pure JS) | ~200k transforms/sec for common CRS | Yes | -- | **SELECTED (lightweight fallback)** for WGS84 <-> Web Mercator and other common transforms where PROJ WASM overhead is unnecessary. ~45 KB vs ~5 MB for PROJ WASM. |
| pyproj via Pyodide | MIT | Yes (Pyodide WASM) | ~100k transforms/sec after 15s Pyodide boot | Partial | -- | **REJECTED.** Pyodide is a 25 MB download that takes 10-15s to initialize. All of that to call the same underlying PROJ C library we can compile directly to WASM. Absurd indirection. Use PROJ WASM directly. |

**Survey-grade requirement:** PROJ WASM with the full PROJ database (proj.db, ~800 KB) supports datum transformations with grid shifts (NADCON5, NTv2, GEOID18). This is non-negotiable for surveying workflows where sub-centimeter accuracy across datum boundaries is required. proj4js cannot do grid-shift transforms.

---

## B8 -- Point Cloud Processing

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **Potree 2** | **BSD-2** | **Partial (WASM decoders)** | **~50-100M points @ 60fps via octree LOD; tested on RTX 3060** | **Yes -- scene tree API, point budget control** | **Autodesk ReCap viewer, Leica Cyclone viewer** | **SELECTED (renderer)** |
| **laz-perf.js 3+** | **Apache 2.0** | **Yes (WASM LAZ decoder)** | **~15M points/sec decompression** | **Yes -- decode to typed arrays** | **LAStools (proprietary)** | **SELECTED (LAZ decompression)** |
| **COPC.js** | **MIT** | **N/A (JS, uses laz-perf)** | **Streams billions of points via HTTP range requests; only fetches visible octree nodes** | **Yes -- query by bounds/resolution** | **Entwine EPT, proprietary streaming formats** | **SELECTED (cloud-optimized streaming)** |
| plasio.js | MIT | No | Unmaintained since 2019 | No | -- | **REJECTED.** Last commit 5 years ago. WebGL 1 only. No LOD streaming. No LAZ 1.4 support. Dead project. |
| Greyhound (Entwine) | MIT | N/A (server) | Server-dependent | Via HTTP | -- | **REJECTED.** Requires a dedicated point cloud server running Entwine. Breaks local-first architecture. COPC achieves the same streaming capability with static files on any HTTP server or object storage. Zero server infrastructure. |

**Performance budget:** On 2025 mid-range hardware (RTX 4060, 16 GB RAM), target is 80M points visible at 60fps. Potree's adaptive point budget + WebGPU compute for classification coloring. Total pipeline: COPC HTTP range request -> laz-perf WASM decode in Worker -> GPU upload -> Potree octree render.

---

## B9 -- AI / LLM Layer

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **LangGraph.js 0.2+** | **MIT** | **N/A (JS-native)** | **N/A (orchestration layer)** | **Yes -- this IS the agent framework; state machines, cycles, human-in-the-loop** | **Proprietary agent platforms** | **SELECTED (orchestration)** |
| **Transformers.js 3+** | **Apache 2.0** | **Yes (ONNX WASM/WebGPU)** | **MiniLM-L6 384d: ~50ms/embedding on WebGPU; ~200ms on WASM** | **Yes -- pipeline API** | **OpenAI embeddings API (for local use)** | **SELECTED (in-browser embeddings)** |
| **Vectra** | **MIT** | **N/A (JS, IndexedDB)** | **~10k vectors cosine similarity in <5ms** | **Yes -- simple add/query API** | **Pinecone, Weaviate (for local use)** | **SELECTED (in-browser vector DB)** |
| External LLM API (Claude / GPT-4) | N/A (SaaS) | N/A | Network-bound (~500ms-2s per response) | Yes -- tool_use / function_calling | -- | **SELECTED** for complex reasoning, code generation, specification interpretation. Accessed via server-side gateway with rate limiting and cost controls. |
| LangChain.js | MIT | N/A | N/A | Yes | -- | Usable but LangGraph.js is the recommended successor for agent workflows. LangChain.js chains are linear; LangGraph.js supports cycles and conditional branching required for iterative engineering agents. |
| CrewAI | MIT | No (Python-only) | N/A | N/A in browser | -- | **REJECTED.** Python-only. No WASM path. No browser execution. Would require a separate Python server, violating local-first constraint for agent orchestration. |
| AutoGen | MIT | No (Python-only) | N/A | N/A in browser | -- | **REJECTED.** Same as CrewAI: Python-only, no browser path. Additionally, AutoGen's multi-agent conversation model is overly complex for tool-calling engineering agents. |

**Agent architecture:** LangGraph.js orchestrates agent state machines in a WebWorker. Each agent (DesignAgent, AnalysisAgent, ComplianceAgent) is a LangGraph node with typed tool schemas. Transformers.js runs MiniLM-L6-v2 locally for semantic search over project specifications. Vectra stores embeddings in IndexedDB. Complex queries (structural analysis interpretation, code generation) route to Claude API via authenticated gateway.

---

## B10 -- Real-time & Robotics

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **rosbridge_suite 1.4+** | **BSD-3** | **N/A (server bridge)** | **~1,000 msgs/sec over WebSocket (JSON); ~15-30ms LAN latency** | **Yes -- JSON-RPC protocol** | **Proprietary ROS bridges** | **SELECTED (ROS 2 bridge)** |
| **roslibjs 2+** | **BSD-3** | **N/A (JS client)** | **Matches rosbridge throughput** | **Yes -- topic pub/sub, service calls, action clients** | **-- (client for rosbridge)** | **SELECTED (browser ROS client)** |
| **WebRTC** | **W3C standard** | **N/A (browser-native)** | **4K @ 30fps, ~50-100ms P2P latency** | **Yes -- standard APIs** | **Proprietary video streaming** | **SELECTED (drone/robot video)** |
| **MQTT.js over WebSocket** | **MIT** | **N/A (JS)** | **~5,000 msgs/sec; QoS 0 latency ~5-10ms LAN** | **Yes -- topic-based pub/sub** | **Proprietary IoT gateways** | **SELECTED (IoT sensors)** |
| micro-ROS | Apache 2.0 | No (MCU firmware) | N/A (runs on MCU) | No (firmware) | -- | Not browser-relevant. micro-ROS runs on embedded devices and publishes to the ROS 2 graph. Browser sees it via rosbridge. Listed for completeness. |
| Kafka | Apache 2.0 | No | N/A (server-only) | Via REST proxy | -- | **Server-side only** for durable stream aggregation. No direct browser client. Browser receives aggregated data via WebSocket from a Kafka consumer. Not a browser dependency. |

**Latency targets:** Teleoperation requires <100ms round-trip. rosbridge on LAN: 15-30ms. WebRTC video: 50-100ms. MQTT sensor telemetry: 5-10ms. All within budget. For WAN teleoperation, WebRTC with STUN/TURN is mandatory.

---

## B11 -- Collaboration & CRDT

| Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|---|---|---|---|---|---|---|
| **Yjs 13+** | **MIT** | **N/A (JS-native, 10 KB gzipped)** | **~100k ops/sec; tested with 10k+ concurrent edits** | **Yes -- Y.Doc is a shared mutable data structure; agents write to it like any other client** | **Autodesk BIM 360 collab, Trimble Connect** | **SELECTED** |
| Automerge 2.0 | MIT | Yes (Rust WASM core) | ~50k ops/sec | Yes | -- | Strong contender. WASM core is faster for merge resolution. However: 150 KB bundle (vs 10 KB for Yjs), less mature provider ecosystem (no y-webrtc equivalent), and Yjs's Y.Map/Y.Array map more naturally to CAD property trees. Automerge is better for document-shaped data; Yjs is better for structured state. |
| Electric SQL | Apache 2.0 | No (server-dependent) | Server-bound | Via SQL | -- | **REJECTED.** Requires a PostgreSQL server with the Electric sync engine. Breaks local-first constraint. When the server is down, collaboration stops. Yjs works fully offline with P2P sync. |
| Liveblocks | Proprietary | No | N/A | Yes | -- | **REJECTED.** Commercial/proprietary. Violates open-source constraint. Non-starter. |

**Geometry CRDT strategy:** Full polygon CRDT is an unsolved research problem. We use Yjs with last-writer-wins (LWW) registers per geometric property: each vertex position, each face normal, each parameter value is an independent LWW register in a Y.Map. Conflicts are rare (two users editing the same vertex simultaneously) and LWW resolution is acceptable. Structural changes (add/delete face) use Y.Array with tombstones.

---

## B12 -- File Format I/O

| Format | Library | License | WASM? | Perf Notes | Verdict |
|---|---|---|---|---|---|
| **IFC 2x3/4** | web-ifc | MPL 2.0 | Yes | 500 MB IFC in ~8s | **SELECTED** (see B4) |
| **DXF** | dxf-parser | MIT | No (JS) | Handles R12-R2018; ~50 MB/s parse | **SELECTED** |
| **DWG** | libredwg WASM | GPL 3.0 | Experimental | ~10 MB/s; limited entity support | Use server-side only (GPL isolation). Convert to DXF or IFC for browser consumption. |
| **Shapefile** | shpjs 4+ | MIT | No (JS) | ~30 MB/s; full .shp/.dbf/.prj | **SELECTED** |
| **GeoJSON** | Native JSON.parse | -- | N/A | ~100 MB/s parse | **SELECTED** (trivial) |
| **GeoParquet** | DuckDB WASM spatial | MIT | Yes | ~200 MB/s columnar scan | **SELECTED** (see B6) |
| **LAS/LAZ** | laz-perf.js + COPC | Apache 2.0 / MIT | Yes | 15M pts/sec decode | **SELECTED** (see B8) |
| **GeoTIFF/COG** | geotiff.js 2+ | MIT | No (JS + WebWorker) | Streams tiles via HTTP range; ~50 MB/s decode | **SELECTED** |
| **CityGML** | CesiumJS + loaders.gl | Apache 2.0 / MIT | Partial | Via 3D Tiles conversion pipeline | **SELECTED** -- CityGML ingested server-side, converted to 3D Tiles for streaming |
| **3D Tiles** | CesiumJS | Apache 2.0 | Partial (DRACO WASM) | Native streaming, billions of features | **SELECTED** (see B3) |
| **glTF/GLB** | Three.js GLTFLoader | MIT | Partial (DRACO) | ~100 MB/s with DRACO WASM | **SELECTED** (interchange format for 3D assets) |

---

## Summary Verdict Table

| Category | Primary Selection | Secondary / Auxiliary | Bundle Impact | Cold Start |
|---|---|---|---|---|
| **B1 Frontend** | Svelte 5 (runes) | -- | 2-4 KB | Instant |
| **B2 3D Rendering** | Three.js r170+ | Custom WebGPU compute shaders | ~650 KB | <500ms |
| **B3 GIS** | CesiumJS (3D) + MapLibre GL JS (2D) | Deck.gl (overlays) | ~1.8 MB + ~800 KB + ~600 KB | <2s |
| **B4 BIM/IFC** | web-ifc + That Open Engine | xeokit-sdk (visualization) | ~3 MB WASM + ~200 KB | ~1.5s WASM init |
| **B5 Geometry Kernel** | OpenCASCADE WASM | Manifold WASM (fast booleans) | ~35 MB gzip + ~180 KB | 2-4s cold, ~800ms warm |
| **B6 Spatial DB** | DuckDB WASM | flatbush + H3-js | ~8 MB + ~5 KB + ~50 KB | ~1s |
| **B7 CRS** | PROJ WASM | proj4js (common CRS fallback) | ~5 MB + ~45 KB | ~500ms |
| **B8 Point Cloud** | Potree 2 + laz-perf.js + COPC | -- | ~300 KB + ~200 KB WASM + ~50 KB | <1s |
| **B9 AI/LLM** | LangGraph.js + Transformers.js + Vectra | External LLM API (Claude) | ~50 KB + ~30 MB (model) + ~20 KB | ~3s (model load) |
| **B10 Robotics** | rosbridge + roslibjs + WebRTC + MQTT.js | -- | ~80 KB total | Instant |
| **B11 Collaboration** | Yjs | -- | ~10 KB | Instant |
| **B12 File I/O** | web-ifc, dxf-parser, shpjs, laz-perf, geotiff.js, loaders.gl | DuckDB (GeoParquet), CesiumJS (3D Tiles) | Varies per format, lazy-loaded | On-demand |

**Total critical-path bundle (initial load):** Svelte + Three.js + MapLibre + Yjs + DuckDB WASM ~ **12 MB** gzipped. All other modules (OCCT, Potree, CesiumJS, AI models) are lazy-loaded on first use.

**WASM modules total (all loaded):** ~85 MB. Cached in IndexedDB/Cache API after first download. Warm startup for full platform: <5s on broadband.

**Licensing audit:** All primary selections are MIT, Apache 2.0, BSD, or MPL 2.0. LGPL applies to OpenCASCADE (dynamic linking compliant via WASM module boundary). GPL applies only to libredwg (server-side isolation, never shipped to browser). xeokit AGPL requires evaluation -- commercial license may be needed if AGPL viral clause is unacceptable; alternative is to use That Open Engine's viewer components directly.
