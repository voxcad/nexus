# NEXUS — Open-Source Landscape Analysis

> **Date:** 2026-04-10
> **Purpose:** Map what already exists before building. Don't reinvent the wheel.

---

## The Big Picture: Nobody Has Unified This Yet

After extensive research, **no open-source project unifies Civil + BIM + GIS + Survey + Remote Sensing + Construction in a browser.** The closest attempts are commercial (Bentley iTwin, Autodesk Tandem). But many strong pieces exist that we can stand on.

---

## 1. Browser-Based BIM/IFC

### That Open Engine (@thatopen) — THE FOUNDATION TO BUILD ON
- **GitHub:** [ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc), [ThatOpen/engine_components](https://github.com/ThatOpen/engine_components)
- **License:** MPL-2.0
- **What it does:** C++ IFC parser compiled to WASM. Reads AND writes IFC at native speed in the browser. Converts IFC to their "Fragments" format (built on FlatBuffers) for 10x faster loading. Has higher-level components for BIM workflows.
- **Key insight:** They already solved IFC → optimized binary → browser rendering. Their Fragments format is exactly the kind of internal format NEXUS needs.
- **Status:** Actively maintained, production-ready, used by multiple companies.
- **Verdict:** **USE THIS. Don't rewrite IFC parsing.**

### xeokit-sdk
- **GitHub:** [xeokit/xeokit-sdk](https://github.com/xeokit/xeokit-sdk)
- **License:** AGPL-3.0 (problematic for commercial use without dual license)
- **What it does:** High-performance WebGL BIM viewer. Full double-precision coordinates. Loads IFC, glTF, 3D Tiles, point clouds.
- **Key insight:** AGPL license is a dealbreaker for an open platform. But their double-precision coordinate handling is worth studying.
- **Verdict:** STUDY their precision approach. Cannot use directly due to AGPL.

### Bonsai (formerly BlenderBIM)
- **GitHub:** [IfcOpenShell/IfcOpenShell](https://github.com/IfcOpenShell/IfcOpenShell)
- **License:** LGPL-3.0
- **What it does:** Full BIM authoring inside Blender. Native IFC editing, not just viewing. Costing, scheduling, simulation.
- **Key insight:** This is the most complete open-source BIM *authoring* tool. But it's Blender-only (desktop, Python). No web version exists.
- **Verdict:** LEARN from their IFC authoring workflows. Their IfcOpenShell Python library is the gold standard for IFC manipulation.

### BIMserver
- **GitHub:** [opensourceBIM](https://github.com/opensourceBIM)
- **License:** AGPL-3.0
- **What it does:** Server-side BIM model management, versioning, federation.
- **Verdict:** STUDY their model federation approach. AGPL prevents direct use.

---

## 2. Browser-Based CAD

### CADmium — MOST ALIGNED WITH NEXUS VISION
- **GitHub:** [CADmium-Co/CADmium](https://github.com/CADmium-Co/CADmium)
- **License:** Elastic License 2.0 (NOT open-source by OSI definition)
- **Stack:** Rust → WASM, SvelteKit, Three.js, Threlte, Tauri for native
- **What it does:** Browser-based parametric CAD. Uses the Truck geometry kernel (Rust). Sketch → extrude → boolean ops workflow.
- **Status:** Early prototype, NOT MVP. Active development.
- **Key insight:** They chose Truck (Rust B-Rep kernel) over OpenCASCADE. Worth understanding why. Their SvelteKit + Three.js + WASM architecture is exactly the pattern NEXUS needs.
- **Verdict:** **STUDY DEEPLY.** Elastic License prevents forking, but their architecture decisions are informative. The Rust/WASM/Svelte/Three.js stack validates our direction.

### replicad
- **GitHub:** [sgenoud/replicad](https://github.com/sgenoud/replicad)
- **License:** MIT
- **What it does:** TypeScript wrapper over opencascade.js for code-based 3D modeling in browser.
- **Key insight:** Proves that opencascade.js works for real CAD operations in browser. Good API design for programmatic geometry.
- **Verdict:** **USE/ADAPT** — their TypeScript abstraction over OCCT WASM is directly usable for the Headless Geometry API.

### opencascade.js
- **GitHub:** [donalffons/opencascade.js](https://github.com/donalffons/opencascade.js)
- **License:** LGPL-2.1
- **What it does:** Full OpenCASCADE compiled to WASM via Emscripten. B-Rep modeling, boolean ops, NURBS, fillets.
- **Status:** Maintained but "old version" of build system — community discussing modernization.
- **Key insight:** It works. Near-native performance with multi-threading support. Custom builds can reduce binary size. This is proven technology.
- **Verdict:** **USE THIS** as the B-Rep foundation.

### JSCAD
- **License:** MIT
- **What it does:** Pure JavaScript CSG modeling. No WASM dependency.
- **Verdict:** Too limited for engineering-grade work. No NURBS, no B-Rep. REJECT.

### FreeCAD
- **Status:** FreeCAD 1.0 released (Nov 2024), 1.1 released (March 2026). Toponaming problem finally solved.
- **Web version:** NO full browser version. Only `planegcs` (2D constraint solver) ported to WASM.
- **Key insight:** planegcs WASM is useful — it's a production-grade 2D geometric constraint solver we can use directly.
- **Verdict:** **USE planegcs WASM** for 2D sketch constraint solving. Study FreeCAD's architecture for parametric modeling patterns.

---

## 3. Web-Native GIS

### TerriaJS — STRONGEST WEB GIS PLATFORM
- **GitHub:** [TerriaJS/terriajs](https://github.com/TerriaJS/terriajs)
- **License:** Apache-2.0
- **What it does:** Full web-based geospatial data explorer. Built on CesiumJS. Supports dozens of formats: WMS, WFS, 3D Tiles, GeoJSON, KML, CSV, CZML, shapefiles. Handles catalogs of tens of thousands of layers. Powers Digital Earth Australia, NSW Spatial Digital Twin, Tokyo Digital Twin.
- **Status:** Very active, v8.11.1 (Nov 2025). 2026 is their "year of the map."
- **Key insight:** This is a production-proven platform already doing GIS + 3D + digital twins at national scale. Their architecture for handling massive heterogeneous data sources is exactly what we need.
- **Verdict:** **EVALUATE AS POTENTIAL FOUNDATION** for the GIS layer. Don't rebuild what TerriaJS already does.

### CesiumJS
- **License:** Apache-2.0
- **What it does:** 3D globe, terrain, 3D Tiles, satellite imagery streaming.
- **Verdict:** **USE THIS** — it's the foundation under TerriaJS and the de facto standard.

### Deck.gl
- **License:** MIT
- **What it does:** Large-scale data visualization layers.
- **Verdict:** **USE** for analytical overlays on top of CesiumJS.

---

## 4. Digital Twin Platforms

### iTwin.js (Bentley)
- **GitHub:** [iTwin/itwinjs-core](https://github.com/iTwin/itwinjs-core)
- **License:** MIT
- **What it does:** Full digital twin framework. Visualization, change tracking, iModel format, reality capture integration.
- **Key insight:** MIT licensed, but deeply integrated with Bentley's commercial cloud services. The core libraries are genuinely open-source though.
- **Status:** Active, regular updates through 2025-2026.
- **Verdict:** **STUDY CAREFULLY.** MIT license allows use, but evaluate how coupled it is to Bentley's backend. If it can run standalone, it could accelerate digital twin features significantly.

### Eclipse Ditto
- **GitHub:** [eclipse-ditto/ditto](https://github.com/eclipse-ditto/ditto)
- **License:** EPL-2.0
- **What it does:** IoT digital twin framework. Manages "Things" with features and properties. REST API, WebSocket, MQTT, Kafka integration.
- **Key insight:** Focused on IoT state management, not 3D visualization. Good for sensor/telemetry layer, not for geometry.
- **Verdict:** **USE** for IoT/sensor ingestion layer (Layer 0), pair with CesiumJS/Three.js for visualization.

### FIWARE
- **License:** AGPL (mostly)
- **What it does:** Smart city platform with NGSI-LD context management.
- **Verdict:** AGPL is problematic. Study their data model patterns but don't integrate directly.

---

## 5. Point Cloud

### Potree / Potree-Next
- **GitHub:** [potree/potree](https://github.com/potree/potree), [m-schuetz/Potree-Next](https://github.com/m-schuetz/Potree-Next)
- **License:** BSD-2-Clause
- **What it does:** WebGL point cloud renderer. Has rendered datasets of up to **597 billion points** in browser. Potree-Next is a WebGPU rewrite using compute shaders.
- **Status:** Potree stable and production. Potree-Next is research/experimental (WebGPU).
- **Verdict:** **USE Potree** now, **TRACK Potree-Next** for WebGPU migration.

---

## 6. AI + AEC (Emerging — This is Where NEXUS Differentiates)

### Text2BIM
- **GitHub:** [dcy0577/Text2BIM](https://github.com/dcy0577/Text2BIM)
- **Paper:** [arXiv:2408.08054](https://arxiv.org/abs/2408.08054)
- **What it does:** Multi-agent LLM framework that generates 3D building models from natural language. Exports to IFC. Has a Reviewer agent that reads BCF files and proposes fixes.
- **Status:** Research prototype, integrated with Vectorworks.
- **Key insight:** Proves the multi-agent BIM generation concept works. Their agent architecture (Programmer + Reviewer + Model Checker) is directly relevant to NEXUS.
- **Verdict:** **LEARN FROM THIS.** Their agent decomposition pattern is a validated starting point.

### MCP4IFC
- **Paper:** [arXiv:2511.05533](https://arxiv.org/abs/2511.05533)
- **What it does:** MCP server that lets LLMs read, create, and edit IFC models via tool calls. Uses IfcOpenShell + Bonsai/Blender. Has predefined tools + dynamic code generation with RAG.
- **Key insight:** This is exactly the "Headless Geometry API for agents" concept in NEXUS. They've already defined tool schemas for BIM operations and shown it works.
- **Verdict:** **STUDY AND ADAPT.** Their MCP tool schema design is directly reusable.

### GIS MCP Server
- **GitHub:** [mahdin75/gis-mcp](https://github.com/mahdin75/gis-mcp)
- **What it does:** MCP server connecting LLMs to GIS operations — coordinate transforms, spatial analysis, geometry operations.
- **Verdict:** **EVALUATE** for the GIS agent layer.

### CAD MCP Server
- **GitHub:** [daobataotie/CAD-MCP](https://github.com/daobataotie/CAD-MCP)
- **What it does:** MCP server for CAD operations.
- **Verdict:** STUDY their tool schema definitions.

### Revit MCP Server
- **Source:** [archilabs.ai](https://archilabs.ai/posts/revit-model-context-protocol)
- **What it does:** AI interaction with Revit via MCP + WebSocket.
- **Verdict:** STUDY for BIM agent integration patterns.

### Zoo.dev (formerly KittyCAD)
- **Website:** [zoo.dev](https://zoo.dev)
- **What it does:** Text-to-CAD API. ML model (ML-ephant) generates 3D CAD from text prompts. Exports STEP, STL, glTF, etc.
- **License:** Application is open-source (SvelteKit), **geometry engine is proprietary**, ML models are proprietary.
- **Key insight:** They've proven text-to-CAD works commercially. Their SvelteKit frontend is open. But the core AI + geometry engine is closed.
- **Verdict:** **COMPETITOR/REFERENCE.** Can't use their engine, but their UX patterns and API design are worth studying. Their open-source frontend code is instructive.

### Manifold (Google)
- **GitHub:** [elalish/manifold](https://github.com/elalish/manifold)
- **License:** Apache-2.0
- **What it does:** Guaranteed-manifold mesh booleans. WASM build available. "First of its kind" algorithm for guaranteed-correct mesh booleans.
- **Verdict:** **USE** for mesh operations alongside OCCT for B-Rep.

---

## 7. Civil Engineering — THE GAP

**There is NO open-source browser-based civil engineering tool for road design, alignment, grading, or earthworks.** This is the biggest gap in the landscape and represents NEXUS's strongest differentiation opportunity.

The only things that exist:
- Commercial desktop tools (Civil 3D, OpenRoads Designer, RoadEng)
- Lima VVA (Windows desktop, basic, SourceForge)
- awesome-civil-engineering list on GitHub (mostly calculation tools, not design platforms)

**This means:** For Domain 1 (Civil), NEXUS must build from scratch. But it can build ON TOP of proven foundations (OCCT for geometry, CesiumJS for terrain, PROJ for coordinates).

---

## Summary: Build vs. Reuse Decision Matrix

| Domain | Build or Reuse? | Foundation Project | What We Build On Top |
|--------|----------------|-------------------|---------------------|
| BIM/IFC Parsing | **REUSE** | That Open Engine (web-ifc) | Authoring workflows, agent integration |
| B-Rep Geometry | **REUSE** | opencascade.js + Manifold | Civil-specific operations, agent API |
| 2D Constraints | **REUSE** | planegcs (FreeCAD WASM) | Sketch UI, parametric modeling |
| GIS/Globe | **REUSE** | CesiumJS + TerriaJS | Domain integration, agent queries |
| Point Clouds | **REUSE** | Potree / Potree-Next | Live streaming, deviation analysis |
| Coordinates | **REUSE** | PROJ WASM | Domain-specific transforms |
| File I/O | **REUSE** | web-ifc, geotiff.js, dxf-parser | Unified import pipeline |
| Civil Engineering | **BUILD** | Nothing exists | Alignment, grading, earthworks, drainage |
| AI Agent Layer | **BUILD + ADAPT** | Text2BIM, MCP4IFC patterns | Multi-domain orchestration, geometric RAG |
| Agent Protocol | **ADAPT** | MCP standard + existing servers | NEXUS-specific geometric MCP tools |
| Digital Twin | **ADAPT** | iTwin.js / Eclipse Ditto | Browser-native, local-first twin |
| Unified Platform | **BUILD** | Nothing exists | The integration layer that ties it all together |
| Collaboration | **REUSE** | Yjs or Automerge | Geometry-specific CRDT conflict resolution |

---

## Key Architectural Insights From Research

1. **That Open Engine's Fragments format** (FlatBuffers-based) should be studied as a model for NEXUS's internal BIM format. Don't invent a new binary format — adapt theirs.

2. **CADmium's architecture** (Rust/WASM + Svelte + Three.js) validates our stack choices. Their use of the Truck kernel (Rust-native B-Rep) instead of OCCT is an alternative worth evaluating.

3. **MCP is the right protocol** for AI agent integration. Multiple MCP servers for BIM, GIS, and CAD already exist. NEXUS should implement MCP natively rather than inventing a custom agent protocol.

4. **Text2BIM proves multi-agent BIM generation works** as a research prototype. The pattern of Programmer Agent + Reviewer Agent + Model Checker is directly applicable.

5. **TerriaJS proves large-scale web GIS works** at national scale. Evaluate whether to build on TerriaJS or just on CesiumJS directly.

6. **The civil engineering domain is wide open.** No browser-based competitor exists. This is where NEXUS creates unique value.

7. **FreeCAD's planegcs** is a hidden gem — a production-grade 2D constraint solver already compiled to WASM.
