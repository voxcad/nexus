# NEXUS — Tiered Study Plan

> **Date:** 2026-04-10
> **Methodology:** Clone Tier 1 → Study architecture → Extract patterns → Build on top

---

## Tier 1 — Clone & Study Deeply

These are projects we will **build on or integrate directly**. Clone them, read their source, understand architecture.

| # | Project | Why Tier 1 | What to Learn |
|---|---------|-----------|---------------|
| 1 | **web-ifc** | Our BIM/IFC engine | WASM build pipeline, IFC parser architecture, Fragments binary format |
| 2 | **engine_components** | BIM component patterns | How they compose viewer, properties, spatial trees on top of web-ifc |
| 3 | **opencascade.js** | Our B-Rep kernel | WASM compilation of C++, API binding patterns, memory management |
| 4 | **replicad** | TypeScript CAD API | How to wrap OCCT in a clean TS API — directly reusable for headless geometry |
| 5 | **CADmium** | Architecture reference | Rust/WASM + Svelte + Three.js integration, worker threading, Truck kernel |
| 6 | **Manifold** | Mesh booleans | WASM build, API design, performance patterns |
| 7 | **Potree** | Point cloud rendering | Octree streaming, LOD, WebGL point rendering at scale |
| 8 | **CesiumJS** | GIS globe | 3D Tiles, terrain streaming, coordinate precision, camera systems |
| 9 | **Yjs** | Real-time collaboration | CRDT architecture, WebRTC P2P, conflict resolution |
| 10 | **LangGraph.js** | Agent orchestration | Stateful agent graphs, human-in-the-loop, tool calling patterns |

---

## Tier 2 — Read Docs & Architecture (Don't Clone)

Learn patterns from docs, READMEs, and blog posts. Don't need source code.

| # | Project | What to Learn |
|---|---------|---------------|
| 1 | **Speckle** | AEC data interop model, versioned object graph, connector architecture |
| 2 | **iTwin.js** | Digital twin visualization architecture, iModel format patterns |
| 3 | **TerriaJS** | Large-scale GIS data catalog management, multi-source federation |
| 4 | **Text2BIM** | Multi-agent BIM generation agent decomposition (Programmer + Reviewer) |
| 5 | **MCP4IFC** | MCP tool schemas for BIM operations, dynamic code generation with RAG |
| 6 | **Zoo.dev** | Text-to-CAD pipeline, KCL language design, AI + geometry architecture |
| 7 | **GIS MCP Server** | GIS operation tool schemas for AI agents |
| 8 | **Eclipse Ditto** | IoT twin state management patterns, Thing model |
| 9 | **xeokit-sdk** | Double-precision coordinate handling in WebGL |
| 10 | **Bonsai/IfcOpenShell** | BIM authoring workflows, IFC property set management |
| 11 | **GDAL3.js** | Full geospatial stack compiled to WASM (GDAL+PROJ+GEOS+SpatiaLite) |
| 12 | **DuckDB-WASM** | In-browser analytical SQL, spatial extension, Parquet |
| 13 | **planegcs** | 2D geometric constraint solver WASM API |
| 14 | **Automerge** | Alternative CRDT with Rust/WASM, document history model |
| 15 | **Threlte** | Declarative Three.js in Svelte 5 — our rendering bridge |

---

## Tier 3 — Bookmark (Reference Only)

Everything else. Consult when needed for specific features.

---

## Study Order for Tier 1

**Phase A — Rendering & Visualization (Week 1)**
1. CesiumJS → understand globe, 3D Tiles, coordinate systems
2. Potree → understand point cloud streaming and octree LOD
3. Study Three.js WebGPU renderer docs (no clone needed, we know Three.js)

**Phase B — Geometry Kernels (Week 2)**
4. opencascade.js → WASM build, API, memory model
5. replicad → TypeScript abstraction over OCCT
6. Manifold → mesh boolean API and WASM build
7. CADmium → full architecture study (Rust + Svelte + Three.js + Truck)

**Phase C — BIM & Data (Week 3)**
8. web-ifc → IFC WASM parser, Fragments format
9. engine_components → BIM component composition
10. Read Speckle + iTwin.js docs for data model patterns

**Phase D — AI & Collaboration (Week 4)**
11. LangGraph.js → agent state machines, tool calling
12. Yjs → CRDT internals, P2P sync
13. Read Text2BIM + MCP4IFC papers for agent patterns
