# NEXUS -- Executive Summary

## Vision

NEXUS is a browser-native spatial engineering platform that collapses Civil Engineering, BIM, GIS, Surveying, Remote Sensing, and Construction Management into a single zero-install web application. It treats AI agents, LLMs, and autonomous robots as first-class users with the same API surface as human operators. By fusing local-first persistence with real-time IoT ingestion, NEXUS eliminates the data-silo tax that costs AEC firms 30%+ of project budgets in rework, re-export, and reconciliation.

## Non-Negotiable Architectural Decisions

### 1. Browser-Native Compute (WASM + WebGPU, Zero Installs)

All geometry, spatial analysis, and rendering execute inside the browser via WebAssembly and WebGPU. No plugins, no Electron, no desktop installs. The server is optional -- a sync peer, never a compute gatekeeper. We reject Electron wrappers, Java applets, and server-side geometry processing as architectural dead ends.

### 2. Agentic UI -- AI Agents as First-Class Users

Every operation available to a human through the GUI is available to an AI agent through a headless geometry API. Agents do not screen-scrape; they call the same WASM kernel functions through a typed, permissioned interface. This is not a chatbot bolted onto a CAD tool -- the agent orchestration layer is a core architectural plane.

### 3. Event-Driven Digital Twin with Real-Time IoT/Robot Ingestion

The platform ingests ROS 2 telemetry, drone surveys, LiDAR scans, and IoT sensor streams in real time via WebSocket and WebRTC bridges. The geometry model is a living digital twin, not a static export. We reject batch-upload workflows as fundamentally incompatible with construction-site reality.

### 4. Local-First with OPFS + SQLite WASM, Cloud-Optional

All project data lives on the user's device first. OPFS stores raw files (IFC, LAS, DXF, GeoJSON). SQLite WASM with SpatiaLite handles spatial queries locally. Cloud sync is additive -- PostGIS + S3-compatible object storage -- never required. We reject cloud-dependent architectures that fail on a job site with no connectivity.

### 5. Open-Source Strict (MIT / Apache 2.0 Only)

Every dependency must be MIT or Apache 2.0 licensed. No AGPL, no LGPL, no BSL, no SSPL, no "source-available" imposters. This is a hard gate in CI. We reject copyleft in a platform intended for commercial embedding and government procurement.

## Highest-Risk Technical Bet

**OpenCASCADE WASM as the B-Rep kernel.** The opencascade.js build produces a 200MB+ WASM binary. Cold startup on a median mobile connection is catastrophic. This is the single decision most likely to force an architecture revision.

**Mitigations (all three are required, not optional):**

- **Lazy module loading:** Split OpenCASCADE into ~15 feature modules (boolean ops, fillet/chamfer, STEP import, IGES import, etc.). Load only what the active workflow demands. Target: < 20MB initial payload.
- **Pre-compiled geometry cache:** Store tessellated meshes and B-Rep snapshots in OPFS. Repeat opens skip the kernel entirely for unchanged geometry.
- **Manifold WASM as mesh-only fallback:** For view-only, clash-detection, and quantity-takeoff workflows that do not require parametric editing, route through Manifold (~2MB WASM) instead of OpenCASCADE. Degrade gracefully, never block the user.

If all three mitigations fail to bring perceived startup under 3 seconds on a 2023 mid-range laptop, we fall back to a thin server-side OpenCASCADE process with geometry streaming -- but that path surrenders Decision #1 and is treated as a last resort.
