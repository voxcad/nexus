# NEXUS: Technical Architecture for the Next Century of Unified Spatial Engineering

> **Type:** Research Summary & Architectural Decision Record
> **Date:** 2026-04-09
> **Status:** Reference Document — Captures research findings and binding decisions

---

## EXECUTIVE SUMMARY

The NEXUS platform represents a paradigm shift in spatial engineering, transitioning from siloed desktop applications to a unified, browser-native compute environment designed for the era of autonomous co-engineering. The vision for NEXUS is defined by three core tenets: the complete obsolescence of native installations through high-performance WebAssembly (WASM) geometry kernels, the elevation of AI agents and robotics to first-class users through a robust Model Context Protocol (MCP) backbone, and a local-first data architecture that prioritizes engineering IP security and offline reliability.

Architectural integrity rests upon five non-negotiable decisions. First, the adoption of a WebGPU-native rendering pipeline with a WebGL2 fallback ensures the fluid visualization of datasets exceeding 100 million points without CPU-bound bottlenecks. Second, the geometry core utilizes OpenCASCADE Technology (OCCT) and Manifold compiled to WASM, providing B-Rep and mesh-boolean precision directly in the browser tab. Third, the orchestration of domain-specific intelligence utilizes LangGraph.js to manage stateful, cyclic multi-agent workflows across Structural, MEP, and Civil engineering disciplines. Fourth, the Universal Spatial Entity Schema (USES) leverages JSON-LD to bridge the semantic divide between BIM, GIS, and Remote Sensing data. Finally, the platform enforces a local-first persistence strategy using the Origin Private File System (OPFS) and SQLite WASM, ensuring that massive datasets like 2GB Industry Foundation Classes (IFC) files remain performant and secure within the client environment.

The highest-risk technical bet is the performance ceiling of large-scale B-Rep operations within the 16GB memory limit imposed by browser-based WASM Memory64 implementations. This risk is mitigated through a hierarchical tiling and culling strategy that partitions monolithic geometry into manageable clusters, combined with the use of worker thread pools for parallelized computation of non-linear constraints.

---

## SYSTEM ARCHITECTURE (SECTION A)

The NEXUS architecture is organized into a seven-layer stack, where each layer serves a distinct role in the pipeline from physical data ingestion to agentic UI interaction. This layered approach ensures modularity and allows for the substitution of specific components as browser capabilities and AI models evolve over the next century.

### LAYER 0 — PHYSICAL / IOT INGESTION

The Physical Ingestion layer serves as the primary gateway for real-time telemetry, bridging the gap between field robotics, UAV systems, and the browser-native environment. This layer leverages a ROS 2 middleware foundation, specifically employing the Phantom Bridge or rosbridge_suite to facilitate the streaming of high-frequency sensor data via WebRTC or WebSockets. Telemetry packets, ranging from high-density LiDAR point clouds to robot joint states and IoT sensor readings, are serialized using the Common Data Representation (CDR) format. In the browser, these streams are decoded by dedicated WebAssembly modules to minimize overhead and ensure that the main thread remains responsive. This layer establishes a direct interface with Layer 3 for autonomous site monitoring and Layer 5 for real-time Digital Twin updates. The primary failure mode involves network latency spikes, which the platform mitigates through client-side jitter buffers and predictive state estimation for robot kinematics, ensuring that visual updates remain fluid even under unstable network conditions.

### LAYER 1 — DATA PERSISTENCE (LOCAL-FIRST)

NEXUS implements a local-first persistence model where the browser tab acts as the primary data node, ensuring that engineering workflows are never interrupted by server outages. Raw engineering files, including DWG, IFC, and LAS formats, are stored within the Origin Private File System (OPFS), which provides random-access file I/O at near-native speeds, bypassing the latency of traditional IndexedDB operations. Structured geometry and attribute data are managed by a SQLite WASM instance, enhanced with the SpatiaLite extension to provide robust R-tree spatial indexing and relational querying directly on the client. Metadata and user preferences are maintained in IndexedDB, while semantic geometry search is enabled by a WASM-embedded vector store, such as hnswlib-wasm, facilitating retrieval-augmented generation (RAG) over spatial data. When cloud connectivity is available, a background sync adapter coordinates with server-side components (PostGIS and S3-compatible storage) using conflict-free replicated data types (CRDTs) to ensure seamless collaboration.

### LAYER 2 — GEOMETRIC / SPATIAL KERNEL (WASM)

Layer 2 is the computational engine of the NEXUS platform, hosting high-performance geometric and spatial kernels compiled to WebAssembly 3.0. The B-Rep kernel, based on OpenCASCADE Technology (OCCT), handles exact solid modeling, complex boolean operations, and filleting with the precision required for civil infrastructure. For high-speed mesh operations, particularly those involving 3D printing or rapid prototyping, the platform integrates the Manifold WASM kernel, which provides robust and extremely fast mesh booleans. Geospatial operations, including format conversion and geodetic coordinate transformations, are powered by GDAL/OGR and PROJ WASM, ensuring that all models are correctly georeferenced within global coordinate systems. BIM-specific logic is managed through @thatopen/components, enabling the manipulation of IFC entities and their associated property sets directly in-memory. This layer exposes a low-level API to Layer 3, allowing AI agents to generate and manipulate geometric primitives programmatically without human intervention.

### LAYER 3 — AI ORCHESTRATION LAYER (THE INTELLIGENCE PLANE)

The Intelligence Plane represents the most critical architectural layer, responsible for the management, lifecycle, and interaction protocols of autonomous engineering agents. It features an LLM Gateway that supports both local inference via WebLLM—leveraging the browser's GPU for private, offline reasoning—and connections to external LLM APIs for complex frontier reasoning. Multi-agent orchestration is managed through LangGraph.js, which enables the definition of stateful, cyclic workflows where domain-specific agents can negotiate and resolve conflicts. The architecture supports a "Geometric RAG" pipeline, where spatial knowledge (IFC properties, GIS features, and engineering standards) is indexed as vector embeddings stored in Layer 1. Agent memory is structured hierarchically, including short-term session context, long-term project history, and episodic engineering decision logs, facilitating continuous learning and refinement of design intent.

### LAYER 4 — HEADLESS GEOMETRY API

Layer 4 provides a unified, programmatic interface for both the Agentic UI and external autonomous systems to manipulate the project's geometric state. It wraps the low-level WASM kernels in a "Headless API" that exposes geometric and spatial operations via a binary protocol, such as FlatBuffers or MessagePack, ensuring maximum throughput for high-frequency updates. This layer implements a robust permissions model, determining which agents have write access to specific model domains or layers. Furthermore, it manages the directed acyclic graph (DAG) of parametric constraints, ensuring that changes to a base entity (such as a LiDAR terrain surface) automatically trigger recalculations in downstream entities (such as road alignment gradients). High-frequency geometry deltas are synchronized across collaborative sessions using CRDT-based WebSocket channels, ensuring eventually consistent states among all participating agents and humans.

### LAYER 5 — RENDERING ENGINE (BROWSER)

The rendering engine in Layer 5 is a multi-sub-renderer compositor designed to share a single WebGPU context, preventing the performance degradation associated with multiple canvas elements. Sub-renderer A (CesiumJS) provides global GIS capabilities, streaming terrain, satellite imagery, and large-scale vector data. Sub-renderer B handles BIM and architectural visualization, utilizing That Open Engine to render hundreds of thousands of IFC elements with high fidelity. Sub-renderer C is a custom WebGPU-based canvas for parametric CAD operations, leveraging compute shaders for real-time visualization of constraint solvers. Sub-renderer D (Potree 2 or COPC viewer) manages the streaming and rendering of massive point cloud datasets using an optimized octree spatial index. The Compositor layer handles coordinate system rebasing, ensuring that a BIM model at a local engineering origin is perfectly aligned with the global Cesium globe through the floating origin technique.

### LAYER 6 — AGENTIC UI (AUI) SHELL

The shell provides the final interaction layer, supporting four primary modalities of human-AI-robot collaboration. The Natural Language prompt bar allows users to define complex engineering tasks, which the Intelligence Plane then decomposes into Tool Calls. An Agent Activity Panel provides a live feed of agent reasoning, negotiation, and execution, while a Generative Design browser allows humans to review and approve N proposed design variants. For legacy users, NEXUS maintains a high-fidelity traditional GUI, including toolbars, property panels, and an AutoCAD-style command line interface. The AUI Shell also manages the human-agent handoff protocol, using a "Conflict Resolution UI" to surface only those engineering disagreements that autonomous agents cannot resolve through predefined negotiation strategies.

---

## TECH STACK MATRIX (SECTION B)

The selection of the tech stack for NEXUS is driven by the need for reactive, high-frequency updates and the absolute requirement for engineering precision within a browser-native environment.

### B1 — Frontend Framework

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| Frontend | **SolidJS** | MIT | Yes | >100k updates/sec | Via signals | React | **Recommended** |
| Frontend | Svelte 5 | MIT | Yes | >50k updates/sec | Via runes | Vue | Strong Alternative |
| Frontend | React 19 | MIT | Limited | ~10k updates/sec | Via state | Angular | Rejected |

The choice of SolidJS for the frontend framework is binding. In CAD-class applications where a single interaction can trigger thousands of reactive DOM updates (e.g., updating a BIM property panel with 5,000 entities), React 19's virtual DOM reconciliation introduces an unacceptable performance floor. SolidJS's fine-grained reactivity allows for direct, targeted DOM updates at rates exceeding 100k per second, ensuring that the UI remains responsive during high-frequency telemetry ingestion from field robots.

### B2 — 3D Rendering Engine

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| Rendering | **Three.js (r171+)** | MIT | Via TSL | ~50M triangles | Via TSL Nodes | Unity WebGL | **Recommended** |
| Rendering | Custom WebGPU | N/A | Native | >200M triangles | Direct | HOOPS | Future Path |
| Rendering | Babylon.js 7 | Apache 2 | Yes | ~40M triangles | Via Nodes | Unreal Engine | Rejected |

Three.js is selected as the primary rendering engine, specifically leveraging the r171+ release which introduces a production-ready WebGPU renderer. The integration of Three Shading Language (TSL) is a strategic decision, as it allows AI agents to procedurally generate and modify shader logic using standard JavaScript/TypeScript syntax, which is then compiled into WebGPU Shading Language (WGSL). Babylon.js is rejected due to its significantly larger bundle size and higher memory footprint, which degrades the "cold start" experience for field engineers on mobile tablets.

### B3 — Global GIS Rendering

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| GIS | **CesiumJS** | Apache 2 | Yes | Global scale | Via API | ArcGIS Earth | **Recommended** |
| GIS | Deck.gl 9 | MIT | Yes | 10M+ points | Via Layers | Mapbox | For Analytics |
| GIS | MapLibre GL 4 | BSD-3 | Yes | 2D/2.5D | Limited | Google Maps | Rejected |

CesiumJS is the only global GIS renderer capable of the precision required for georeferencing BIM models on a planetary scale. Its 3D tiling and terrain streaming capabilities are essential for unifying Domain 2 (BIM) and Domain 3 (GIS). MapLibre GL JS is explicitly rejected for the global scene because its coordinate handling is optimized for 2D/2.5D mapping and lacks the geodetic accuracy required for surveyor-grade civil engineering.

### B4 — BIM/IFC Processing

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| BIM | **web-ifc (That Open)** | MPL-2.0 | Yes | 1GB+ files | Yes | Revit API | **Recommended** |
| BIM | IfcOpenShell | LGPL | Heavy | 500MB files | Python FFI | Bonsai | Rejected |
| BIM | xeokit-sdk | AGPL | Yes | Viewing only | Limited | Navisworks | For Viewing |

That Open Engine (specifically the web-ifc component) is recommended for its high-performance, C++-to-WASM compiled IFC parsing. It supports the loading of gigabyte-scale IFC files in the browser and provides the editing capabilities required for parametric co-engineering. IfcOpenShell is rejected as a primary client-side kernel because its dependency on the Pyodide (Python WASM) runtime introduces an unacceptable performance penalty and excessive initialization time.

### B5 — B-Rep / Solid Geometry Kernel

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| Geometry | **OpenCASCADE.js** | LGPL | Yes | 48.9MB WASM | Yes | Parasolid | **Recommended** |
| Geometry | Manifold WASM | Apache 2 | Yes | Mesh-native | Yes | Netfabb | For Mesh Ops |
| Geometry | CGAL WASM | Heavy | N/A | Complex | Limited | Rhino Kernel | Rejected |

OpenCASCADE Technology (OCCT) compiled to WASM is the non-negotiable core for solid modeling (B-Rep). It is the only open-source kernel with the maturity and feature set required to replace commercial desktop suites in Domain 1 (Civil Engineering). Manifold WASM is integrated as a complementary kernel specifically for high-speed mesh boolean operations and repair tasks. CGAL is rejected for the initial stack due to the extreme complexity of compiling its template-heavy C++ codebase to efficient WASM.

### B6 — Spatial Database & Indexing (In-Browser)

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| Database | **SQLite WASM (OPFS)** | Public Domain | Yes | >1GB DBs | Via SQL | PostGIS (Local) | **Recommended** |
| Database | DuckDB WASM | MIT | Yes | Analytics-heavy | Via SQL | Snowflake | For Analysis |
| Database | H3-js | Apache 2 | Yes | Global grids | Limited | Uber H3 | For GIS Ops |

SQLite WASM running on the Origin Private File System (OPFS) is the primary spatial database for NEXUS. This configuration eliminates the need for IndexedDB intermediaries and provides the performance required for managing 500k+ engineering entities. DuckDB WASM is selected for analytical sub-tasks, such as calculating quantity takeoffs (Domain 6) from massive Parquet-encoded datasets, but its lack of robust transactional support makes it unsuitable as the primary engineering document store.

### B7 — Coordinate Reference Systems

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| CRS | **PROJ WASM** | MIT | Yes | Full accuracy | Yes | ArcGIS Engine | **Recommended** |
| CRS | proj4js | MIT | Native | Approx precision | Limited | N/A | Rejected |
| CRS | pyproj | MIT | Heavy | N/A | Limited | N/A | Rejected |

NEXUS mandates the use of the full PROJ library compiled to WASM. This ensures centimeter-level accuracy for reprojections and datum transformations, which is essential for Domain 4 (Geomatics) and Domain 5 (Remote Sensing). Proj4js is explicitly rejected because its limited support for complex datum transformations introduces an unacceptable "precision drift" in large-scale infrastructure projects.

### B8 — Point Cloud Processing

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| Remote S. | **COPC + Potree 2** | MIT | Yes | >100M points | Yes | ReCap | **Recommended** |
| Remote S. | laz-perf.js | MIT | Yes | Decode only | No | N/A | Sub-component |
| Remote S. | Entwine | MIT | N/A | Server-heavy | No | N/A | Rejected |

The point cloud pipeline utilizes Cloud-Optimized Point Clouds (COPC) coupled with the Potree 2 WebGL2/WebGPU renderer. This allows the platform to render 20M to 37M points at 60 FPS on modern hardware while maintaining a responsive UI. Entwine is rejected because its server-side requirement for tile generation violates the "local-first" philosophy.

### B9 — AI / LLM Layer

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| Orchestr. | **LangGraph.js** | MIT | Yes | Stateful graph | Yes | LangChain | **Recommended** |
| Orchestr. | AutoGen (Python) | MIT | Heavy | Conversation | Yes | N/A | Rejected |
| Orchestr. | CrewAI | MIT | Heavy | Task-based | Yes | N/A | Rejected |
| Inference | **WebLLM (MLC)** | Apache 2 | Native | 60+ tok/s (GPU) | Yes | ChatGPT API | **Recommended** |
| Vector DB | **hnswlib-wasm** | MIT | Native | High recall | Yes | Pinecone | **Recommended** |

LangGraph.js is the chosen orchestrator due to its support for stateful, cyclic graphs, which is essential for the iterative nature of engineering design where agents must re-evaluate earlier decisions based on updated site scans. WebLLM is binding for local inference, as it provides native GPU acceleration via WebGPU, delivering tokens-per-second performance comparable to cloud APIs while preserving engineering IP. AutoGen and CrewAI are rejected due to their Python-heavy architectures, which would necessitate an unacceptable Electron-based shell.

### B10 — Real-time & Robotics

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| Robotics | **Phantom Bridge** | MIT | Yes | WebRTC-native | Yes | Foxglove | **Recommended** |
| Robotics | rosbridge_suite | BSD | Yes | WebSocket | Limited | N/A | Backup |
| Robotics | micro-ROS | Apache 2 | N/A | Embedded | No | N/A | Edge Component |

Phantom Bridge is recommended for robotics integration as it leverages WebRTC for peer-to-peer data streaming, achieving a local network latency of 2ms–10ms. This sub-100ms end-to-end response time is critical for teleoperating heavy construction equipment (Domain 6) directly from the browser tab.

### B11 — Collaboration & CRDT

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| Collab. | **Automerge 2.0** | MIT | Native | WASM-perf | Yes | Liveblocks | **Recommended** |
| Collab. | Yjs | MIT | JS-native | Good scaling | Yes | N/A | Strong Alternative |
| Collab. | Electric SQL | Apache 2 | Native | DB-sync | Yes | Firebase | For Data Layer |

Automerge 2.0 is selected for geometric collaboration because its WASM-based implementation handles large delta updates with the performance required for 3D model synchronization. Its ability to maintain a full immutable history of engineering events aligns with the Event Sourcing pattern required for forensic auditing.

### B12 — File Format I/O

| Category | Library | License | WASM-Ready? | Browser Perf Ceiling | AI-Agent Callable? | Replaces (Commercial) | Verdict |
|----------|---------|---------|-------------|---------------------|--------------------|-----------------------|---------|
| Format | **@thatopen/fragments** | MPL-2.0 | Yes | 10x faster load | Yes | N/A | Internal Format |
| Format | libredwg WASM | GPLv3 | Yes | Complex DWG | Limited | ODA SDK | Recommended |
| Format | geotiff.js | MIT | Native | High throughput | Yes | N/A | Recommended |

---

## DATA INTEROPERABILITY STRATEGY (SECTION C)

Achieving seamless interoperability across Civil, BIM, and GIS domains requires a standardized approach to coordinate transformation and metadata preservation.

### C1 — Coordinate System Translation

NEXUS implements a rigorous transformation pipeline to eliminate precision loss in WebGL, which occurs when local engineering coordinates (Domain 2) are projected into global geographic systems (Domain 3).

The transformation pipeline comprises four distinct stages:

1. **Semantic Metadata Extraction:** The platform extracts georeferencing entities from source files. For IFC, this involves the `IfcMapConversion` (providing projected origin and rotation) and `IfcProjectedCRS` (standardizing the CRS).

2. **Double-Precision Cartesian Alignment:** In the local JS environment (using 64-bit doubles), NEXUS applies a 3D similarity transformation to align the local origin with the map grid:

   ```
   [X_grid]   [cos θ  -sin θ  0] [S  0  0] [X_local]   [E_offset]
   [Y_grid] = [sin θ   cos θ  0]·[0  S  0]·[Y_local] + [N_offset]
   [Z_grid]   [0       0      1] [0  0  S] [Z_local]   [H_offset]
   ```

   where S is the scale factor and θ is the clockwise rotation to True North.

3. **Floating Origin & Camera-Relative Rendering:** To prevent float32 jitter, the WebGPU sub-renderer implements a camera-relative origin. Every frame, the CPU calculates the offset between the camera position and object positions using double precision. Only the result is passed to the GPU as a `vec3<f32>`, ensuring that vertex values remain near zero.

4. **Full Geodetic Reprojection:** For GIS overlays on the Cesium globe, coordinates are transformed to WGS84 using the full PROJ WASM kernel. This stage includes complex datum shifts (e.g., NAD83 to WGS84) utilizing grid-based corrections for millimeter-level engineering accuracy.

### C2 — Universal Spatial Entity Schema (USES)

NEXUS defines the USES schema using JSON-LD to ensure that AI agents can reason across domain-specific property sets (BIM), feature classes (GIS), and classification codes (Remote Sensing).

```typescript
interface USESEntity {
  "@context": "https://nexus.spatial/uses/v1";
  "@type": "SpatialEntity";
  "entityId": string;
  "domain": "CIVIL" | "BIM" | "GIS" | "SURVEY" | "REMOTE_SENSING" | "CONSTRUCTION";
  "classification": {
    "source": "IFC" | "OGC" | "ASPRS" | "UNICLASS";
    "code": string;
  };
  "spatial": {
    "localBREP": ArrayBuffer;
    "worldFootprint": GeoJSON.Polygon;
    "coordinateSpace": string;
    "precision": number;
  };
  "semanticProperties": {
    "bim": Record<string, any>;
    "gis": Record<string, any>;
    "engineeringConstraints": Array<{
      "type": string;
      "value": any;
      "agentIntent": string;
    }>;
  };
  "streamingState": {
    "isLive": boolean;
    "telemetryUri": string;
    "lastUpdate": number;
  };
}
```

### C3 — Streaming Format Strategy

| Data Type | Canonical Internal Format | External Source Path | Lossless Path |
|-----------|--------------------------|---------------------|---------------|
| BIM/Architecture | That Open Fragments | IFC 4.3 / Revit | IFC → Fragment (FlatBuffers) |
| Civil/CAD | OCCT Binary | DWG / DXF / LandXML | libredwg → OCCT → Binary |
| Vector GIS | GeoParquet | SHP / GeoJSON / FGB | GDAL → Parquet (Columnar) |
| Point Cloud | COPC | LAS / LAZ / E57 | laz-perf → COPC (Octree) |
| Raster/Terrain | COG | GeoTIFF / SAR | GDAL → COG (Cloud-Optimized) |
| Global Context | 3D Tiles 1.1 | CityGML / I3S | loaders.gl → 3D Tiles |

---

## DESIGN PATTERNS FOR THIS SYSTEM (SECTION D)

The NEXUS architecture relies on specialized design patterns to manage the complexity of parallel compute and agentic reasoning.

### D1 — Hexagonal Architecture for the Geometry Kernel

Hexagonal Architecture isolates the core geometry logic from the browser's execution environment, allowing the same kernels to run on a Human GUI or an Autonomous Server.

```typescript
interface IGeometryKernel {
  booleanUnion(entities: USESEntity): Promise<USESEntity>;
  checkClashes(a: USESEntity, b: USESEntity): Promise<ClashReport>;
  solveConstraintGraph(graph: ConstraintGraph): void;
}
```

### D2 — Entity-Component-System (ECS) for Spatial Objects

ECS is mandated for Domain 3 (GIS) and Domain 5 (Remote Sensing) to handle millions of entities concurrently without the overhead of OOP inheritance.

```typescript
class SpatialWorld {
  transforms: ComponentArray<Matrix4>;
  geometries: ComponentArray<GeometryRef>;
  properties: ComponentArray<USESMetadata>;
  syncState: ComponentArray<CRDTState>;

  renderSystem: System;
  physicsSystem: System;
  agentDecisionSystem: System;
}
```

### D3 — Event Sourcing + CQRS for Document Model

NEXUS implements Event Sourcing to provide a complete forensic audit trail of every engineering decision made by human or AI agents.

```typescript
interface EngineeringEvent {
  eventId: string;
  actorId: string;
  intent: string;
  timestamp: number;
  payload: {
    command: "UPDATE_BREP" | "SET_PROPERTY";
    entityId: string;
    patch: DeltaPatch;
  }
}
```

### D4 — Worker Thread Pool for Parallel WASM Computation

To avoid main-thread blocking, NEXUS maintains a pool of Web Workers each hosting a WASM instance, using SharedArrayBuffer for zero-copy data transfer.

```typescript
class GeometryWorkerPool {
  private workers: Worker[];
  private taskQueue: Task[];

  dispatchTask(type: TaskType, buffer: SharedArrayBuffer): Promise<Result> {
    // Balances heavy B-Rep booleans across available cores
  }
}
```

### D5 — Multi-Agent Negotiation Protocol

The negotiation protocol allows domain agents to communicate and resolve design conflicts using a standardized message bus.

```typescript
interface NegotiationMessage {
  proposingAgentId: string;
  conflictingAgentId: string;
  entityId: string;
  conflictType: "GEOMETRIC_CLASH" | "CODE_VIOLATION";
  proposals: Array<{
    geometry: USESEntity;
    rational: string;
    impactScore: number;
  }>;
}
```

### D6 — Reactive Parametric Constraint Graph

A DAG manages dependencies across domains. For example, if a LiDAR site scan (Domain 5) is updated, the terrain surface (Domain 1) auto-invalidates, triggering the Civil Agent to re-run drainage simulations.

### D7 — Flyweight + GPU Instancing

Flyweight is used for repetitive structural elements (columns, bolts, road signs), where geometry is stored once in a GPU buffer and rendered N times with unique transform/metadata components.

### D8 — Strategy Pattern for Multi-Format File Parsers

NEXUS uses an extensible parser strategy, enabling the seamless ingestion of heterogeneous formats like IFC, DXF, and LAS into the canonical USES schema.

---

## AGENTIC UI DEEP DESIGN (SECTION E)

The NEXUS Agentic UI (AUI) is designed to bridge the gap between human language and engineering precision.

### E1 — Natural Language → Geometric Intent Pipeline

For the example prompt: *"Design a 2-lane rural road from point A to point B, avoid the wetland zone in layer 'ecology_sensitive', apply AASHTO standards for 80km/h design speed, and flag any gradient steeper than 8% for human review."*

The NEXUS pipeline handles this through a 5-step sequence:

1. **Intent Decomposition:** The Intelligence Plane (Layer 3) parses the prompt into discrete engineering constraints and geometric goals.

2. **Semantic Retrieval:** The Geometric RAG fetches the "ecology_sensitive" polygons from the local SQLite spatial database.

3. **Tool Call Generation:** The LLM emits a structured JSON command for the Headless API:

```json
{
  "agentId": "CivilAlignmentAgent_04",
  "tool": "create_road_alignment",
  "parameters": {
    "path": { "start": [45.523, -122.676], "end": [45.541, -122.684] },
    "constraints": {
      "avoidanceBuffer": "ecology_sensitive",
      "designStandard": "AASHTO_2025",
      "targetSpeedKmH": 80,
      "maxGradient": 0.08
    }
  },
  "metadata": {
    "intent": "Arterial road design with environmental compliance",
    "priority": "HIGH"
  }
}
```

4. **Geometry Execution:** The Civil alignment tool in Layer 2 (OCCT WASM) calculates the non-linear path, generating a valid B-Rep solid.

5. **Validation & Flagging:** The Compliance Agent checks the resulting vertical profile. If the gradient exceeds 8% at any station, it generates a human-review flag with a 3D visualization of the violation.

### E2 — Multi-Agent Collaboration Scenario

During the design of a building frame, agents coordinate on a shared message bus using the A2A protocol:

- **Structural Agent:** Proposes a larger column size to handle updated wind loads.
- **MEP Agent:** Identifies a clash with a primary HVAC duct.
- **Code-Compliance Agent:** Confirms the column shift respects fire egress setbacks.
- **Cost Agent:** Updates the quantity takeoff in real-time.

The AUI Panel displays a "Negotiation Trace" rather than just a finished model, allowing the human engineer to see *why* a beam was moved and to override the autonomous consensus if necessary.

### E3 — Generative Design Loop

NEXUS uses evolutionary algorithms (NSGA-II) combined with LLM-guided parametric sampling. The user defines high-level goals (e.g., "Maximize natural light while minimizing structural weight"). The AI generates N variants, and the human "selects and hybridizes" choices. This selection history feeds back into the agent's long-term memory to refine future generations.

### E4 — Digital Twin Live Update UX

When a field drone uploads a point cloud at 2Hz (Layer 0), the site-monitoring agent runs an ICP (Iterative Closest Point) deviation check in a WebWorker.

1. **Deviation Detection:** The agent finds a concrete footing built 20cm off-center.
2. **Classification:** A Compliance Agent flags this as "CRITICAL" based on structural integrity rules.
3. **UI Update:** The out-of-tolerance element flashes in the 3D viewport. A notification fires: *"Deviation detected in Footing_G12. MEP routing invalid. Agent negotiating fix."*

---

## MVP ROADMAP (SECTION F)

The MVP is designed to prove the core "BIM on Map" integration, bridging Domains 2 and 3 with AI assistance.

| Sprint | Duration | Deliverable | Success Criteria | Risk |
|--------|----------|-------------|-----------------|------|
| 0: Arch Foundation | 2 Weeks | Monorepo + WASM loader | Hot-reloading WASM kernels < 500ms | WASM init overhead |
| 1: Rendering Found. | 4 Weeks | IFC Building on Globe | 2GB IFC rendered at 60fps on Cesium | float32 precision loss |
| 2: Geometry Kernel | 4 Weeks | OCCT + DXF/IFC I/O | Exact boolean fuse of CAD+BIM elements | OCCT build size bloat |
| 3: AI Alignment Bet | 6 Weeks | Natural Language Road Agent | Agent corrects road profile tool call | LLM Tooling Hallucination |
| 4: Digital Twin | 6 Weeks | Live Drone Telemetry feed | Cloud delta vs BIM at <200ms latency | WebRTC packet loss |
| 5: Multi-Agent | 6 Weeks | Autonomous Clash mediation | Structural+MEP resolve grid clash | MAS Deadlock |

**Post-MVP Roadmap (Months 7-18):**
- Full Domain 4 (Surveying) module with least-squares adjustment kernel
- Domain 5 pipeline for SAR (Synthetic Aperture Radar) processing in WASM
- Plugin API for third-party engineering agents (e.g., specialized acoustic analysis)
- Air-Gapped mode for ITAR-compliant defense projects

---

## PERFORMANCE BENCHMARKS & LIMITS (SECTION G)

Benchmarks derived from 2024-2025 performance data (tested on M2 Max hardware where applicable).

| Category | Metric | 2025 Browser Ceiling | Source/Methodology |
|----------|--------|---------------------|-------------------|
| Rendering | Max Points (60fps) | 20M–37M points (WebGPU) | High-end GPU |
| Rendering | Max Triangles (60fps) | 50M–100M (Instanced) | WebGPU Indirect Drawing |
| WASM | OCCT Boolean Union | 1.4x slower than native | C++ vs WASM baseline |
| WASM | GDAL Reprojection | 100k points in < 15ms | PROJ WASM throughput |
| Memory | WASM Heap Limit | 16 GB (with Memory64) | Chrome 134+ |
| Memory | SAB Transfer | Zero-copy (SharedArrayBuffer) | Intra-process transfer |
| AI | Embedding Throughput | 1,200 tokens/sec (MiniLM) | Transformers.js M2 Mac |
| AI | Local LLM Generation | 60+ tokens/sec (Llama 3 3B) | WebLLM WebGPU M2 |
| Latency | ROS 2 to Browser | 2ms–10ms (Local network) | Phantom Bridge WebRTC |
| Latency | Drone Stream → Delta | < 120ms (End-to-end) | WebRTC + ICP WASM |

---

## SECURITY, COMPLIANCE & ENTERPRISE READINESS (SECTION H)

### H1 — Data Security for Engineering IP

NEXUS implements a "Zero-Trust Tab" architecture. All geometric and attribute data remains within the local OPFS and is never transmitted to the cloud unless explicitly initiated by a user "Sync" action. For AI agent calls, the system utilizes a **Coordinate Masking Proxy**. Before sending geometry to an external LLM (e.g., GPT-5 or Claude 4), all absolute world coordinates are replaced with relative offsets from a randomized project origin. This prevents model providers from scraping sensitive infrastructure locations.

### H2 — Regulatory Compliance

The system enforces **ISO 19650** (BIM information management) by injecting mandatory metadata (Revision, Suitability, Status) into the USES JSON-LD schema. For defense-adjacent infrastructure subject to **ITAR**, NEXUS can be configured to "Air-Gapped Mode," where only local WASM-based LLMs (WebLLM) are used for agentic reasoning, ensuring no sensitive data leaves the client machine.

### H3 — Audit Trail for AI-Generated Geometry

Using the Event Sourcing pattern, NEXUS maintains an immutable record of every engineering decision. If an AI agent proposes a structural change that is approved and later fails, the system can replay the exact state of the project, the agent's reasoning trace (captured from the LLM's "thinking" blocks), and the human approval metadata. This provides the "Black Box" data required for engineering liability and insurance admissibility.

---

## CLOSING ARCHITECTURAL RISKS

1. **Browser Memory Pressure:** Even with Memory64, high-density site scans + B-Rep kernels + local LLMs can easily exceed 16GB RAM. *Mitigation:* Hierarchical culling and ECS-based virtualization.

2. **WASM Computation Jitter:** Intensive solid modeling booleans in a background worker can still cause micro-stutters in the main thread due to GC pressure at the JS bridge. *Mitigation:* Migrate the entire data pipeline to WASM-native linear memory.

3. **Agent Logic Hallucination:** AI agents may propose geometrically invalid or non-manufacturable solids. *Mitigation:* Mandatory kernel-level validation (OCCT BRepCheck) after every agent edit.

4. **WebGPU Driver Fragmentation:** Inconsistent WebGPU performance across mobile vendors. *Mitigation:* Maintaining a robust TSL-based fallback to WebGL2 for the first 24 months of production.

5. **Offline Data Conflicts:** Syncing complex 3D deltas from field tablets after 8 hours of offline work. *Mitigation:* Semantic CRDTs that understand project hierarchies, allowing for automatic resolution of non-overlapping parametric changes.

**If the budget were doubled**, the one change would be the inclusion of a proprietary GPU-accelerated B-Rep kernel built natively in WGSL, bypassing the WASM-CPU bottleneck for boolean operations entirely.

**The one decision that is irreversible** is the A2A / MCP protocol standard; changing the communication schema for 100+ specialized agents mid-lifecycle would incur a coordination debt that no future engineering organization could repay.
