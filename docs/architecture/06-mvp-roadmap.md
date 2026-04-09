# NEXUS Phase 1 MVP Roadmap

**Document version:** 1.0
**Date:** 2026-04-09
**Author:** CTO Office
**Status:** Board-approved draft

---

## Executive Context

NEXUS is a browser-native spatial engineering platform unifying Civil, BIM, GIS, Surveying, Remote Sensing, and Construction workflows. AI agents operate as first-class users alongside human engineers. This document defines the 28-week (7-month) Phase 1 MVP, followed by an 11-month post-MVP roadmap through Month 18.

Total Phase 1 team: ramps from 3 to 5 engineers across sprints. Calendar start assumes 2026-04-13 (Week 1).

---

## Sprint Overview

| Sprint | Weeks | Calendar | Deliverable | Success Criteria | Key Risk | Validates |
|--------|-------|----------|-------------|------------------|----------|-----------|
| 0 | 1-2 | Apr 13 - Apr 24 | Architecture Foundation | WASM boolean op via SharedArrayBuffer < 3s | OpenCASCADE WASM binary size (~45MB) and cold-load time | Monorepo structure, WASM worker pipeline, local-first storage |
| 1 | 3-6 | Apr 27 - May 22 | Rendering Foundation | 50MB IFC georeferenced on globe, 60fps at room level | CesiumJS + Three.js render loop synchronization | Globe-to-BIM navigation, IFC georeferencing, dual camera |
| 2 | 7-10 | May 25 - Jun 19 | Geometry Kernel + File I/O | DXF + IFC + GeoJSON aligned in one scene, entity inspection | OCCT WASM memory limits for complex civil DXFs | Multi-format loading, unified coordinate space, ECS |
| 3 | 11-16 | Jun 22 - Jul 31 | AI Agent Layer | LLM-generated road alignment rendered < 30s, AASHTO-compliant | LLM geometric reasoning accuracy and hallucination | Core thesis: AI agents as first-class engineering users |
| 4 | 17-22 | Aug 3 - Sep 11 | Digital Twin Pilot | Drone scan to deviation alert < 5s on LAN | Point cloud streaming bandwidth and decode latency | Real-time BIM-to-reality comparison, compliance automation |
| 5 | 23-28 | Sep 14 - Oct 23 | Multi-Agent Integration | Autonomous clash detection + resolution in < 2s | Agent conflict resolution quality and convergence | Multi-agent collaboration, human-in-the-loop escalation |

---

## Sprint 0 — Architecture Foundation

**Weeks 1-2 (Apr 13 - Apr 24)**
**Team:** 3 engineers (1 infra lead, 1 WASM specialist, 1 frontend)

### Deliverables

1. **Monorepo scaffold** — pnpm + Turborepo with six packages:
   - `@nexus/core` — shared types, ECS primitives, event bus
   - `@nexus/geometry-kernel` — OCCT WASM bindings, geometry operations
   - `@nexus/renderer` — WebGPU/WebGL2 rendering, CesiumJS + Three.js integration
   - `@nexus/ai-orchestrator` — agent runtime, tool registry, LLM client
   - `@nexus/data-layer` — OPFS, DuckDB WASM, IndexedDB, sync engine
   - `@nexus/ui` — Svelte 5 shell, prompt bar, panels

2. **WASM module loader** — lazy-loading with HTTP cache headers + service worker pre-cache for OCCT (~45MB), GDAL (~12MB), PROJ (~8MB) binaries. Loader reports download progress to UI.

3. **Web Worker pool** — 4-8 workers (scaled to `navigator.hardwareConcurrency`). SharedArrayBuffer support detection with fallback to `postMessage` + Transferable. Worker lifecycle: spawn, execute, reclaim.

4. **WebGPU capability detection** — feature-detect `navigator.gpu`, fall back to WebGL2 automatically. Abstraction layer so renderers code against a unified API.

5. **Local-first data layer**:
   - OPFS abstraction for large binary storage (IFC files, point clouds)
   - DuckDB WASM for spatial queries and tabular property data
   - IndexedDB metadata store for project manifests and entity indices

6. **CI/CD pipeline** — GitHub Actions:
   - WASM build step with cached emsdk toolchain (saves ~4 min per build)
   - Vitest for unit/integration tests across all packages
   - Playwright for E2E browser tests (Chrome + Firefox)
   - Bundle size tracking (fail PR if any package grows > 10% without approval)

7. **TypeScript strict mode** across all packages. Svelte 5 runes syntax for UI shell.

### Done Criteria

Worker pool loads OpenCASCADE WASM module, executes a boolean union of two `BRepPrimAPI_MakeBox` solids, transfers the resulting tessellated mesh via SharedArrayBuffer to the main thread, and renders a wireframe preview — all in **< 3 seconds** on an M1 MacBook Air (8GB). Measured with `performance.mark`/`performance.measure` in CI.

---

## Sprint 1 — Rendering Foundation

**Weeks 3-6 (Apr 27 - May 22)**
**Team:** 4 engineers (1 rendering lead, 1 GIS specialist, 1 BIM specialist, 1 frontend)

### Deliverables

1. **CesiumJS globe** — terrain provider (Cesium World Terrain) + satellite imagery (Bing Maps or Mapbox). Configured for engineering use: depth testing enabled, terrain exaggeration = 1.0.

2. **web-ifc loader** — parses IFC 2x3 and IFC 4 files into Three.js `BufferGeometry`. Streaming parse in Web Worker to avoid main thread blocking. Progress callback for files > 10MB.

3. **IFC georeferencing pipeline** — extracts `IfcMapConversion` and `IfcProjectedCRS` from IFC header. Converts local coordinates to WGS84 via PROJ WASM. Falls back to manual placement if metadata is absent.

4. **Floating-origin coordinate rebasing** — WebGL uses 32-bit floats, which lose precision beyond ~10km from origin. Rebasing shifts the rendering origin to the camera position, preserving sub-millimeter precision at building scale.

5. **Dual camera system**:
   - Globe mode: CesiumJS orbital camera (pan, zoom, tilt) for regional navigation
   - Interior mode: Three.js orbit/fly camera for building-level inspection
   - Camera handoff: animated transition when user zooms past a threshold altitude (~200m above ground). Synchronized via shared view matrix.

### Success Criteria

- Load a 50MB IFC file (typical 5-story office building, ~800k triangles).
- Georeference it on the globe at correct latitude/longitude (verified against known coordinates, error < 0.5m horizontal).
- Navigate from 10km altitude to room-level interior maintaining **60fps** throughout.
- Positional accuracy < 1cm at building scale (measured by placing known-coordinate markers).

### Frame Rate Targets

| Triangle count | Target FPS |
|---------------|------------|
| < 500k | 60 |
| 500k - 2M | 30 |
| > 2M | Requires LOD (post-MVP) |

---

## Sprint 2 — Geometry Kernel + File I/O

**Weeks 7-10 (May 25 - Jun 19)**
**Team:** 4 engineers (1 geometry lead, 1 GIS specialist, 1 parser specialist, 1 frontend)

### Deliverables

1. **OpenCASCADE WASM integration**:
   - B-Rep solid creation (`BRepPrimAPI_MakeBox`, `MakeCylinder`, `MakeSphere`)
   - Boolean operations (union, intersection, subtraction) via `BRepAlgoAPI`
   - Filleting and chamfering (`BRepFilletAPI`)
   - NURBS curve/surface creation and evaluation
   - Tessellation to triangle mesh for rendering (`BRepMesh_IncrementalMesh`)

2. **DXF parser** — `dxf-parser` library reading DXF R2000 through R2018. Converts entities to OCCT geometry:
   - LINE → `BRepBuilderAPI_MakeEdge` from `gp_Pnt`
   - ARC → `GC_MakeArcOfCircle`
   - LWPOLYLINE → `BRepBuilderAPI_MakeWire` with arc/line segments
   - INSERT (block references) → resolved with transformation matrices
   - DIMENSION, TEXT → extracted as annotation metadata (not geometry)

3. **GDAL WASM** — loads GeoJSON and Shapefile. PROJ WASM handles CRS reprojection (state plane, UTM, national grids → WGS84). Feature attributes stored in DuckDB WASM for SQL querying.

4. **Unified scene compositor** — all data sources (DXF, IFC, GeoJSON) projected into a common ECEF coordinate space. Layer system with per-source visibility, opacity, and Z-ordering.

5. **Basic ECS world** — entities from all formats registered with components:
   - `Transform` — position, rotation, scale in local and world space
   - `Geometry` — reference to OCCT shape or mesh buffer
   - `Properties` — key-value metadata (IFC properties, DXF attributes, GeoJSON features)
   - `Layer` — source file, visibility, selection state

### MVP File Formats

| Format | Read | Write | Notes |
|--------|------|-------|-------|
| IFC 2x3 / IFC 4 | Yes | No | Via web-ifc |
| DXF R2000-R2018 | Yes | No | Via dxf-parser + OCCT |
| GeoJSON | Yes | Yes | Native JSON |
| Shapefile | Yes | No | Via GDAL WASM |
| GeoTIFF | View only | No | Draped on terrain |

### Post-MVP File Formats

DWG (requires libredwg WASM compilation), LAS/LAZ, CityGML, LandXML, glTF/GLB export.

### Success Criteria

- Load a civil engineering DXF (road plan with alignments, parcels, utilities), an IFC building, and a GeoJSON site boundary.
- All three display correctly aligned in the same scene (verified by overlaying known survey control points, alignment error < 5cm).
- User clicks any entity from any source and sees its properties in the inspector panel.

---

## Sprint 3 — AI Agent Layer

**Weeks 11-16 (Jun 22 - Jul 31)**
**Team:** 5 engineers (2 AI/ML, 3 platform)

**This is the critical bet.** This sprint validates the core thesis that AI agents can function as first-class users of an engineering platform, generating valid, standards-compliant geometry from natural language.

### Deliverables

1. **Headless Geometry API** — internal REST-like endpoints (in-browser, routed through the worker pool) wrapping OCCT WASM operations:
   - `createPoint(x, y, z)` → `gp_Pnt`
   - `createLine(start, end)` → `BRepBuilderAPI_MakeEdge`
   - `createArc(center, radius, startAngle, endAngle)` → `GC_MakeArcOfCircle`
   - `createAlignment(elements: Array<TangentSegment | CurveSegment>)` → `BRepBuilderAPI_MakeWire`
   - `booleanUnion(shapeA, shapeB)`, `booleanSubtract`, `booleanIntersect`
   - `querySpatialRelation(shapeA, shapeB)` → intersects/contains/disjoint
   - `bufferGeometry(shape, distance)` → offset solid
   - 15-20 total tools, each with JSON Schema input/output definitions

2. **LLM tool-calling schema** — JSON Schema definitions for all geometry tools, compatible with OpenAI/Anthropic function-calling format. Includes parameter constraints (e.g., `radius > 0`, `designSpeed` enum), examples, and error descriptions.

3. **Civil Alignment Agent** — specialized agent that:
   - Accepts NL prompt (e.g., "Design a 2-lane rural highway from point A to point B at 60 mph design speed, avoiding the wetland polygon")
   - Retrieves AASHTO design tables (minimum radius, superelevation, sight distance) from an embedded lookup
   - Generates horizontal alignment as a sequence of tangent segments and circular/spiral curves
   - Validates geometry: connected endpoints, tangent continuity, minimum radius compliance
   - Outputs alignment as OCCT wire geometry + station/offset table

4. **NL prompt bar** — Svelte 5 component in the top toolbar. Streams LLM responses token-by-token. Shows inline status: "Thinking...", "Generating geometry...", "Validating...".

5. **Agent action log** — side panel showing:
   - Each tool call the agent makes (function name, parameters, result)
   - Geometry operations with thumbnail previews
   - Timing breakdown (LLM inference, geometry computation, rendering)
   - Error states with human-readable explanations

6. **Integration pipeline** — agent creates geometry → registered as ECS entity with `Transform` + `Geometry` + `Properties` + `AIGenerated` component → rendered in scene → user can select, inspect, modify, or delete.

### Success Criteria for LLM-Generated Road Alignment

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | Topologically valid | All segments connected (gap < 1mm), arcs tangent to adjacent segments |
| 2 | AASHTO compliant | Minimum radius >= lookup value for specified design speed |
| 3 | Avoids exclusion zones | `querySpatialRelation(alignment, exclusionZone)` returns `disjoint` |
| 4 | Human-editable | User can select any segment, drag control points, modify parameters |
| 5 | End-to-end < 30s | From prompt submission to rendered geometry visible in viewport |

### Risk Mitigation

- LLM hallucination: all geometry validated server-side before rendering. Invalid geometry rejected with error message to user.
- Latency: pre-warm LLM connection, stream tool calls, parallelize independent geometry operations.
- Accuracy: AASHTO tables are deterministic lookups, not LLM-generated. The LLM orchestrates; domain logic is hardcoded.

---

## Sprint 4 — Digital Twin Pilot

**Weeks 17-22 (Aug 3 - Sep 11)**
**Team:** 4 engineers (1 robotics/ROS, 1 point cloud specialist, 1 analysis, 1 frontend)

### Deliverables

1. **rosbridge WebSocket pipeline** — connects browser to ROS 2 network via `rosbridge_suite`. WASM-compiled message decoder handles `sensor_msgs/PointCloud2` at wire speed.

2. **Simulated ROS 2 publisher** — Python node (`rclpy`) publishing sample point cloud scans on `/nexus/scan` topic. Simulates a drone completing a building flyover: publishes one scan frame per second, 500k points per frame.

3. **COPC/LAZ streaming decoder** — Web Worker decodes compressed point cloud frames. Outputs position + intensity + RGB into SharedArrayBuffer for zero-copy transfer to renderer.

4. **Potree 2 integration** — octree-based point cloud renderer. Adaptive level-of-detail: full resolution within 50m of camera, progressive decimation beyond. Target: 10M points at 30fps.

5. **BIM-to-scan deviation analysis**:
   - ICP (Iterative Closest Point) alignment of scan to BIM model
   - Per-element distance computation: for each BIM element, compute mean/max/std deviation from nearest scan points
   - Results stored as ECS `Deviation` component on each BIM entity

6. **Deviation visualization** — color-coded overlay on BIM elements:
   - Green: within tolerance (deviation <= 2cm)
   - Yellow: warning (2cm < deviation <= 5cm)
   - Red: critical (deviation > 5cm)
   - Heatmap mode: continuous gradient for detailed inspection

7. **Compliance Agent** — automated agent that:
   - Monitors deviation results as they arrive
   - Classifies each element: pass / warning / critical
   - Generates summary report with statistics per floor, per element type
   - Flags elements exceeding tolerance with recommended actions

### Latency Budget

| Stage | Target | Measurement |
|-------|--------|-------------|
| ROS → WebSocket transfer | < 500ms | Network round-trip |
| WASM decode + upload to GPU | < 1s | `performance.measure` |
| ICP alignment | < 2s | Per-frame incremental |
| Deviation computation | < 1s | Against cached BIM mesh |
| **Total: scan → deviation alert** | **< 5s** | End-to-end on LAN |

---

## Sprint 5 — Multi-Agent Integration

**Weeks 23-28 (Sep 14 - Oct 23)**
**Team:** 5 engineers (2 AI/ML, 2 platform, 1 frontend)

### Deliverables

1. **Agent supervisor** — LangGraph.js state machine orchestrating multiple concurrent agents. Manages agent lifecycle: spawn, execute, pause, resume, terminate. Enforces resource limits (max 3 concurrent agents, 60s timeout per operation).

2. **Structural Agent** — analyzes structural model:
   - Identifies column grid and load paths from IFC structural elements
   - Flags overstressed members based on simplified tributary area analysis
   - Proposes reinforcement: upsized sections, added bracing

3. **MEP Agent** — mechanical/electrical/plumbing routing:
   - Generates ductwork routes between specified endpoints
   - Respects clearance zones around structural elements
   - Optimizes for shortest path with minimum bends

4. **BVH tree collision detection** — WASM-compiled bounding volume hierarchy for spatial queries. Supports:
   - Broad-phase AABB overlap detection
   - Narrow-phase triangle-triangle intersection
   - Batch queries: check all MEP routes against all structural elements in one pass
   - Target: 100k element pairs checked in < 500ms

5. **Agent conflict resolution protocol**:
   - When agents modify overlapping spatial regions, BVH detects clash
   - Both agents receive clash notification with affected geometry
   - Each agent proposes at least 2 resolution alternatives (e.g., reroute duct above beam, reroute duct below beam)
   - Supervisor evaluates proposals against constraints (cost, code compliance, spatial fit)
   - If agents converge on a solution (same choice or compatible choices), applied automatically
   - If agents disagree, escalated to human

6. **Human escalation UI** — conflict resolution cards:
   - Split-view showing each agent's proposed resolution
   - 3D diff: conflicting geometry highlighted in red, proposed changes in blue/green
   - Three actions: Approve Agent A / Approve Agent B / Manual Edit
   - Decision recorded in audit log with timestamp and rationale field

### Autonomous Clash Detection Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | Concurrent modification detected | Two agents modify overlapping regions simultaneously |
| 2 | Clash detected within 2 seconds | BVH query time from modification event to clash alert |
| 3 | Each agent proposes >= 2 resolutions | Count of valid alternative geometries per agent |
| 4 | Auto-resolution when agents agree | Applied without human intervention, audit logged |
| 5 | Human decision in < 3 clicks | From conflict card appearance to resolution committed |

---

## Post-MVP Roadmap (Months 7-18)

### Q3 — Months 7-9 (Nov 2026 - Jan 2027)

**Team:** 8 engineers (3 platform, 2 GIS/survey, 2 AI, 1 frontend)

| Deliverable | Description |
|-------------|-------------|
| Surveying/COGO module | Traverse computation, least-squares adjustment, coordinate geometry (bearings, distances, curve layout). Integrates with alignment agent. |
| LAS/LAZ point cloud import | Streaming loader with classification viewer (ground, vegetation, building, unclassified). Up to 500M points via octree LOD. |
| Plugin API v1 | Third-party agents register tools via manifest. Sandboxed execution in dedicated Web Workers. Versioned tool schemas. |

### Q4 — Months 10-12 (Feb 2027 - Apr 2027)

**Team:** 10 engineers (3 platform, 2 point cloud, 2 AI, 2 generative design, 1 frontend)

| Deliverable | Description |
|-------------|-------------|
| Point cloud processing pipeline | Ground classification (CSF algorithm in WASM), DTM/DSM extraction, contour generation at specified intervals. |
| Generative design module | NSGA-II evolutionary optimizer: multi-objective site layout (minimize cut/fill, maximize solar access, respect setbacks). Agent-driven fitness evaluation. |
| DWG file support | libredwg compiled to WASM. Read-only initially. Covers DWG R2000-R2018. |

### Q5 — Months 13-15 (May 2027 - Jul 2027)

**Team:** 12 engineers (4 platform, 2 mobile, 2 AI, 2 enterprise, 1 drone, 1 frontend)

| Deliverable | Description |
|-------------|-------------|
| Mobile PWA | Tablet-optimized UI for field engineers. Offline-first with OPFS sync. Camera integration for photogrammetry capture (multi-view stereo via WASM). |
| Enterprise auth | OIDC/SAML SSO. Multi-tenant workspace isolation. Role-based access: viewer, editor, agent-operator, admin. Audit logging. |
| Real drone integration | DJI SDK bridge application → WebRTC stream to browser. Live video overlay on 3D model. Waypoint mission planning from NEXUS UI. |

### Q6 — Months 16-18 (Aug 2027 - Oct 2027)

**Team:** 14 engineers (4 platform, 3 compliance, 2 AI, 2 marketplace, 2 devops, 1 frontend)

| Deliverable | Description |
|-------------|-------------|
| Code compliance engine | Rule libraries for IBC (building), Eurocode (structural), AASHTO (highway). Agents reference rules during design. Automated compliance reports. |
| Agent marketplace | Third-party developers publish domain-specific agents (e.g., stormwater analysis, structural timber design). Revenue share model. Review/certification process. |
| Self-hosted deployment | Docker Compose stack: NEXUS web app + PostGIS + S3-compatible object storage + Redis for session/cache. Helm chart for Kubernetes. Air-gapped deployment guide. |

### Team Growth Summary

| Quarter | Period | Headcount | Net Hires |
|---------|--------|-----------|-----------|
| Phase 1 (MVP) | Apr - Oct 2026 | 3 → 5 | — |
| Q3 | Nov 2026 - Jan 2027 | 8 | +3 |
| Q4 | Feb - Apr 2027 | 10 | +2 |
| Q5 | May - Jul 2027 | 12 | +2 |
| Q6 | Aug - Oct 2027 | 14 | +2 |

---

## Key Dependencies and Assumptions

1. **OpenCASCADE WASM build** — maintained community fork (nicknash/opencascade.js or AltairCA) stays compatible with Emscripten 3.x. Fallback: fork and maintain ourselves (1 engineer, 2 weeks).
2. **LLM provider** — Anthropic Claude or OpenAI GPT-4-class model with tool-calling support. No fine-tuning required for MVP; AASHTO logic is deterministic. LLM orchestrates, it does not compute.
3. **Browser support** — Chrome 120+, Firefox 125+, Safari 18+. SharedArrayBuffer requires COOP/COEP headers. WebGPU Chrome-only at MVP; WebGL2 fallback for Firefox/Safari.
4. **No backend servers for MVP** — entire platform runs in-browser. Post-MVP adds optional server components for collaboration, persistence, and drone integration.
5. **Hiring** — Phase 1 uses existing team. Post-MVP hiring plan requires 9 additional engineers over 12 months, with emphasis on GIS/survey and AI specializations.
