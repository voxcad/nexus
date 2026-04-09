# NEXUS — Open-Source Tools, Apps & Repos Catalog

> **Date:** 2026-04-10
> **Purpose:** Every open-source project that can help build NEXUS

---

## 1. BIM / IFC

| Project | Description | Links |
|---------|-------------|-------|
| **web-ifc** | C++ IFC parser compiled to WASM. Reads & writes IFC at native speed in browser. | [GitHub](https://github.com/ThatOpen/engine_web-ifc) · [Docs](https://thatopen.github.io/engine_web-ifc/docs/) |
| **That Open Engine Components** | High-level BIM component toolkit built on web-ifc + Three.js. Viewer, property inspector, spatial trees, measurements, BCF. | [GitHub](https://github.com/ThatOpen/engine_components) · [Docs](https://docs.thatopen.com/) |
| **xeokit-sdk** | High-performance WebGL BIM viewer. Full double-precision coordinates. Loads IFC, glTF, LAZ, CityJSON. | [GitHub](https://github.com/xeokit/xeokit-sdk) · [Homepage](https://xeokit.io/) |
| **BIMROCKET** | Web-based BIM platform with viewing, editing, and BCF/IFC management. | [GitHub](https://github.com/bimrocket/bimrocket) |
| **BIMserver** | Server-side BIM collaboration. Versioning, merge, query (BimQL). | [GitHub](https://github.com/opensourceBIM/BIMserver) |
| **BIMsurfer** | WebGL IFC viewer for browser. | [GitHub](https://github.com/opensourceBIM/BIMsurfer) |
| **IfcOpenShell** | C++ IFC geometry engine with Python bindings. Most complete open-source IFC toolkit. | [GitHub](https://github.com/IfcOpenShell/IfcOpenShell) · [Homepage](https://ifcopenshell.org/) |
| **Bonsai (BlenderBIM)** | Full BIM authoring addon for Blender. Creates, edits, exports native IFC. Desktop only. | [Homepage](https://bonsaibim.org/) · [Docs](https://docs.bonsaibim.org/) |
| **Speckle** | AEC data interoperability platform. Versioned object graph storage. Connectors for Revit, Rhino, Grasshopper, AutoCAD, Civil 3D, QGIS, Blender, etc. | [GitHub](https://github.com/specklesystems/speckle-server) · [Homepage](https://speckle.systems/) |
| **OpenProject BIM** | Project management with integrated xeokit IFC viewer. | [Homepage](https://www.openproject.org/docs/bim-guide/ifc-viewer/) |
| **Open IFC Viewer** | Simple browser-based IFC viewer. | [Homepage](https://openifcviewer.com/) |
| **xeokit-convert** | CLI tool to batch-convert IFC, CityJSON, LAZ, glTF to xeokit's XKT format. | [GitHub](https://github.com/xeokit/xeokit-convert) |

---

## 2. CAD / Parametric Modeling

| Project | Description | Links |
|---------|-------------|-------|
| **CADmium** | Browser-based parametric CAD. Rust/WASM + SvelteKit + Three.js. Uses Truck B-Rep kernel. | [GitHub](https://github.com/CADmium-Co/CADmium) · [Demo](https://cadmium-co.github.io/CADmium/) |
| **VCAD** | Parametric CAD in Rust. 35k+ LOC BRep kernel. Browser-native via WASM. | [GitHub](https://github.com/ecto/vcad) · [Homepage](https://vcad.io) |
| **replicad** | TypeScript CAD library built on opencascade.js. B-Rep operations, STEP export, fillets, lofts. MIT. | [GitHub](https://github.com/sgenoud/replicad) · [Homepage](https://replicad.xyz/) |
| **JSCAD** | Code-based parametric 3D modeling in browser. Pure JavaScript CSG engine. MIT. | [GitHub](https://github.com/jscad/OpenJSCAD.org) · [Homepage](https://openjscad.xyz/) |
| **CascadeStudio** | Live-scripted CAD kernel in browser using opencascade.js. | [GitHub](https://github.com/zalo/CascadeStudio) |
| **CADAM** | AI-powered text-to-CAD web app with parametric controls. Browser-native WASM. | [GitHub](https://github.com/Adam-CAD/CADAM) |
| **FreeCAD** | Full-featured desktop parametric CAD. v1.1 released March 2026. LGPL. | [GitHub](https://github.com/FreeCAD/FreeCAD) · [Homepage](https://www.freecad.org/) |
| **SolveSpace** | Lightweight parametric 2D/3D CAD with constraint solver. Experimental WASM port exists. | [GitHub](https://github.com/solvespace/solvespace) · [Homepage](https://solvespace.com/) |
| **Dune3D** | Parametric 3D CAD with constraint solver. C++/GTK4/OpenCASCADE. Desktop only. | [GitHub](https://github.com/dune3d/dune3d) |
| **Zoo Design Studio** | Browser CAD by Zoo.dev. Code-first (KCL language). AI text-to-CAD. MIT (app), proprietary engine. | [GitHub](https://github.com/KittyCAD/modeling-app) · [Homepage](https://zoo.dev/) |

---

## 3. Geometry Kernels (WASM)

| Project | Description | Links |
|---------|-------------|-------|
| **opencascade.js** | Full OpenCASCADE B-Rep kernel compiled to WASM. Boolean ops, NURBS, fillets, STEP I/O. | [GitHub](https://github.com/donalffons/opencascade.js) · [Homepage](https://ocjs.org/) |
| **Manifold** | Ultra-fast guaranteed-manifold mesh booleans. Google-backed. Apache 2.0. WASM build. | [GitHub](https://github.com/elalish/manifold) · [Homepage](https://manifoldcad.org/) |
| **Truck** | Rust B-Rep kernel. NURBS, booleans, STEP I/O. Compiles to WASM. Used by CADmium. | [GitHub](https://github.com/ricosjp/truck) |
| **opencascade-rs** | Rust bindings to OpenCASCADE. Can compile to WASM. | [GitHub](https://github.com/bschwind/opencascade-rs) |
| **occt-import-js** | Emscripten interface for OpenCASCADE import. Reads BREP, STEP, IGES in browser. | [GitHub](https://github.com/kovacsv/occt-import-js) |
| **planegcs** | FreeCAD's 2D geometric constraint solver ported to WASM. | [GitHub](https://github.com/Salusoft89/planegcs) |

---

## 4. GIS / Geospatial

| Project | Description | Links |
|---------|-------------|-------|
| **CesiumJS** | 3D globe, terrain streaming, 3D Tiles, satellite imagery. Apache 2.0. WebGPU branch landing 2025. | [GitHub](https://github.com/CesiumGS/cesium) · [Homepage](https://cesium.com/platform/cesiumjs/) |
| **TerriaJS** | Full web-based geospatial data explorer. Built on CesiumJS. Powers national-scale digital twins. Apache 2.0. | [GitHub](https://github.com/TerriaJS/terriajs) · [Homepage](https://terria.io/) |
| **MapLibre GL JS** | Open-source fork of Mapbox GL JS. Vector tiles, 2D/2.5D maps. BSD-3. | [GitHub](https://github.com/maplibre/maplibre-gl-js) · [Homepage](https://maplibre.org/) |
| **Deck.gl** | WebGL/WebGPU data visualization framework. Large-scale point clouds, geospatial layers. MIT. | [GitHub](https://github.com/visgl/deck.gl) · [Homepage](https://deck.gl/) |
| **OpenLayers** | Foundational web mapping library. All OGC standards, vector tiles, WebGL rendering. BSD-2. | [GitHub](https://github.com/openlayers/openlayers) · [Homepage](https://openlayers.org/) |
| **GeoNode** | Web geospatial CMS. Upload, share, manage spatial data. Built on GeoServer + Django. | [GitHub](https://github.com/GeoNode/geonode) · [Homepage](https://geonode.org/) |
| **MapStore** | Modern web mapping framework. 2D/3D viewer, dashboards. React + OpenLayers + CesiumJS. | [GitHub](https://github.com/geosolutions-it/MapStore2) · [Homepage](https://mapstore.geosolutionsgroup.com/) |
| **loaders.gl** | Framework for loading and parsing 3D Tiles, point clouds, geospatial formats. vis.gl ecosystem. | [GitHub](https://github.com/visgl/loaders.gl) · [Homepage](https://loaders.gl/) |

---

## 5. Coordinate Systems & Spatial Processing

| Project | Description | Links |
|---------|-------------|-------|
| **PROJ** | Cartographic projections and coordinate transformations. 6000+ CRS. MIT. | [GitHub](https://github.com/OSGeo/PROJ) · [Homepage](https://proj.org/) |
| **proj4js** | JavaScript port of PROJ. Lightweight CRS transforms in browser. | [GitHub](https://github.com/proj4js/proj4js) |
| **GDAL3.js** | GDAL + PROJ + GEOS + SpatiaLite compiled to WASM. Full geospatial conversion in browser. | [GitHub](https://github.com/bugra9/gdal3.js) |
| **Loam** | JavaScript wrapper for GDAL in the browser. Reprojection, format conversion. | [GitHub](https://github.com/azavea/loam) |
| **GDAL** | The universal geospatial translator library. Raster + vector. MIT. | [GitHub](https://github.com/OSGeo/gdal) · [Homepage](https://gdal.org/) |
| **Turf.js** | Advanced geospatial analysis in JavaScript. Spatial joins, buffers, measurements. MIT. | [GitHub](https://github.com/Turfjs/turf) · [Homepage](https://turfjs.org/) |
| **H3-js** | Uber's hexagonal hierarchical spatial index. JavaScript binding. Apache 2.0. | [GitHub](https://github.com/uber/h3-js) |
| **Flatbush** | Really fast static spatial index (R-tree) for 2D points/rectangles. ISC. | [GitHub](https://github.com/mourner/flatbush) |
| **RBush** | High-performance 2D spatial index (R-tree). MIT. | [GitHub](https://github.com/mourner/rbush) |

---

## 6. Point Cloud

| Project | Description | Links |
|---------|-------------|-------|
| **Potree** | WebGL point cloud viewer. Renders billions of points via octree LOD. BSD-2. | [GitHub](https://github.com/potree/potree) · [Homepage](https://potree.github.io/) |
| **Potree-Next** | WebGPU rewrite of Potree. Compute shaders for GPU-based decode. Research stage. | [GitHub](https://github.com/m-schuetz/Potree-Next) |
| **COPC.js** | JavaScript reader for Cloud-Optimized Point Clouds. Stream LAZ from cloud storage. MIT. | [GitHub](https://github.com/connormanning/copc.js) · [Spec](https://copc.io/) |
| **laz-perf** | LAZ decompression in JavaScript/WASM. Fast point cloud decode. | [GitHub](https://github.com/hobu/laz-perf) |
| **LASViewer** | Web app to view LiDAR LAS files. Renders up to 250M points without thinning. | [GitHub](https://github.com/lasviewer/lasviewer.github.io) |
| **Plasio** | Drag-and-drop in-browser LAS/LAZ viewer. | [GitHub](https://github.com/verma/plasio) · [Homepage](http://plas.io) |
| **COPC Viewer** | Browser-based COPC point cloud viewer. | [Homepage](https://viewer.copc.io/) |
| **PotreeConverter** | Convert LAS/LAZ to Potree format for streaming. | [GitHub](https://github.com/potree/PotreeConverter) |

---

## 7. File Format Parsers

| Project | Description | Links |
|---------|-------------|-------|
| **dxf-parser** | JavaScript DXF file parser. Reads into structured JS objects. | [GitHub](https://github.com/gdsestimating/dxf-parser) |
| **dxf-viewer** | DXF 2D viewer in JavaScript for browser. | [GitHub](https://github.com/vagran/dxf-viewer) |
| **libredwg-web** | DWG/DXF parser using libredwg compiled to WASM. Browser-native. | [npm](https://www.npmjs.com/search?q=libredwg) |
| **geotiff.js** | Parse GeoTIFF/COG files in browser. Pure JavaScript. Production-ready. | [GitHub](https://github.com/geotiffjs/geotiff.js) · [Homepage](https://geotiffjs.github.io/) |
| **COGeoTiff** | High-performance Cloud Optimized GeoTIFF reader. | [GitHub](https://github.com/blacha/cogeotiff) |
| **shpjs** | Shapefile parser for JavaScript. | [GitHub](https://github.com/calvinmetcalf/shapefile-js) |

---

## 8. 3D Rendering

| Project | Description | Links |
|---------|-------------|-------|
| **Three.js** | The standard JavaScript 3D library. WebGL + WebGPU renderer. 100k+ GitHub stars. MIT. | [GitHub](https://github.com/mrdoob/three.js) · [Homepage](https://threejs.org/) |
| **Threlte** | Declarative Three.js for Svelte. Scene graph via Svelte components. | [GitHub](https://github.com/threlte/threlte) · [Homepage](https://threlte.xyz/) |
| **Babylon.js** | Full 3D engine. WebGL + WebGPU. Game-oriented but capable. Apache 2.0. | [GitHub](https://github.com/BabylonJS/Babylon.js) · [Homepage](https://www.babylonjs.com/) |
| **Zephyr3D** | TypeScript WebGL + WebGPU rendering engine. Lightweight, modular. | [GitHub](https://github.com/gavinyork/zephyr3d) |
| **PlayCanvas** | WebGL/WebGPU game engine. Open source runtime. MIT. | [GitHub](https://github.com/playcanvas/engine) · [Homepage](https://playcanvas.com/) |

---

## 9. AI / LLM / Agent Orchestration

| Project | Description | Links |
|---------|-------------|-------|
| **LangGraph** | Agent orchestration as stateful directed cyclic graphs. MIT. v1.0+. | [GitHub](https://github.com/langchain-ai/langgraph) · [Homepage](https://www.langchain.com/langgraph) |
| **LangChain.js** | LLM application framework for JavaScript. 90k+ stars (Python + JS). MIT. | [GitHub](https://github.com/langchain-ai/langchainjs) · [Homepage](https://js.langchain.com/) |
| **Open Agent Platform** | No-code web UI for creating and managing LangGraph agents. | [GitHub](https://github.com/langchain-ai/open-agent-platform) |
| **Transformers.js** | Run HuggingFace models in browser. Embeddings, NLP, vision. ONNX Runtime + WebGPU. Apache 2.0. | [GitHub](https://github.com/huggingface/transformers.js) · [Docs](https://huggingface.co/docs/transformers.js/) |
| **WebLLM** | High-performance in-browser LLM inference via WebGPU. Llama, Phi, Gemma, Mistral. Apache 2.0. | [GitHub](https://github.com/mlc-ai/web-llm) · [Homepage](https://webllm.mlc.ai/) |
| **CrewAI** | Role-based multi-agent framework. Python. MIT. | [GitHub](https://github.com/crewAIInc/crewAI) · [Homepage](https://www.crewai.com/) |
| **AutoGen** | Multi-agent conversation framework by Microsoft. MIT. | [GitHub](https://github.com/microsoft/autogen) |
| **Vectra** | In-memory vector database for JavaScript. Local vector search. MIT. | [GitHub](https://github.com/Stevenic/vectra) |

---

## 10. MCP Servers (AI ↔ CAD/BIM/GIS)

| Project | Description | Links |
|---------|-------------|-------|
| **GIS MCP Server** | MCP server for GIS operations — coordinate transforms, spatial analysis, geometry ops. | [GitHub](https://github.com/mahdin75/gis-mcp) · [Homepage](https://gis-mcp.com/) |
| **CAD-MCP** | MCP server for CAD operations. Draw lines, circles, text. | [GitHub](https://github.com/daobataotie/CAD-MCP) |
| **ifcMCP** | MCP server for LLM agents to work with IFC files. | [Info](https://skywork.ai/skypage/en/ai-bim-ifc-mcp-server/1981196614946226176) |
| **FreeCAD MCP** | AI-driven CAD modeling via RPC server controlling FreeCAD. | Search "freecad-mcp" on GitHub |
| **Revit MCP** | AI assistant connection to Autodesk Revit via MCP + WebSocket. | [Info](https://archilabs.ai/posts/revit-model-context-protocol) |
| **AutoCAD LT MCP** | Translates natural language into AutoLISP instructions for AutoCAD. | Search "autocad-mcp" on GitHub |
| **MCP Protocol Spec** | The Model Context Protocol standard. Adopted by Anthropic, OpenAI, Microsoft, Google. | [GitHub](https://github.com/modelcontextprotocol/servers) · [Spec](https://modelcontextprotocol.io/) |

---

## 11. Digital Twin / IoT

| Project | Description | Links |
|---------|-------------|-------|
| **iTwin.js** | Bentley's open-source digital twin visualization. BIM + GIS + reality data. MIT. | [GitHub](https://github.com/iTwin/itwinjs-core) · [Homepage](https://www.itwinjs.org/) |
| **Eclipse Ditto** | IoT digital twin framework. REST/WS APIs, "Things" state management. EPL-2.0. | [GitHub](https://github.com/eclipse-ditto/ditto) · [Homepage](https://eclipse.dev/ditto/) |
| **Eclipse BaSyx** | Asset Administration Shell (AAS) for industrial digital twins. MQTT, OPC-UA. | [Homepage](https://www.eclipse.org/basyx/) |
| **DTCC Platform** | City planning digital twins. Python. MIT. From Sweden's Digital Twin Cities Centre. | [Homepage](https://dtcc.chalmers.se/) |
| **OpenTwins** | Open-source compositional digital twin platform. | [GitHub](https://github.com/ertis-research/opentwins) |
| **3DCityDB** | Database + web viewer for CityGML/CityJSON. CesiumJS-based viewer. Apache 2.0. | [GitHub](https://github.com/3dcitydb/3dcitydb) |

---

## 12. Collaboration / CRDT

| Project | Description | Links |
|---------|-------------|-------|
| **Yjs** | CRDT for real-time collaboration. P2P via WebRTC. Fastest CRDT implementation. MIT. | [GitHub](https://github.com/yjs/yjs) · [Homepage](https://yjs.dev/) |
| **Automerge** | JSON CRDT built in Rust with WASM JS bindings. Full document history. MIT. | [GitHub](https://github.com/automerge/automerge) · [Homepage](https://automerge.org/) |
| **Loro** | Rust CRDT supporting rich text, list, map, movable tree. Newer alternative. | [GitHub](https://github.com/loro-dev/loro) · [Homepage](https://loro.dev/) |

---

## 13. In-Browser Database

| Project | Description | Links |
|---------|-------------|-------|
| **DuckDB-WASM** | Analytical SQL database in browser. Parquet, CSV, JSON, Arrow, spatial. MIT. | [GitHub](https://github.com/duckdb/duckdb-wasm) · [Homepage](https://duckdb.org/) |
| **SQLite WASM** | Official SQLite compiled to WASM. Public domain. | [GitHub](https://github.com/sqlite/sqlite-wasm) |
| **sql.js** | SQLite compiled to JS via Emscripten. Runs in browser. MIT. | [GitHub](https://github.com/sql-js/sql.js) |

---

## 14. Robotics / ROS 2 / Telemetry

| Project | Description | Links |
|---------|-------------|-------|
| **Robot Web Tools** | Suite of open-source libraries for web-based robot apps with ROS. | [Homepage](https://robotwebtools.github.io/) |
| **ros2-web-bridge** | JSON interface to ROS 2 via rosbridge v2 protocol over WebSockets. | [GitHub](https://github.com/RobotWebTools/ros2-web-bridge) |
| **roslibjs** | JavaScript library for interacting with ROS from the browser. | [GitHub](https://github.com/RobotWebTools/roslibjs) |
| **opentera-webrtc-ros** | WebRTC teleoperation for ROS 2. Video + data channel. | [GitHub](https://github.com/introlab/opentera-webrtc-ros) |
| **webrtc-ros2-streamer** | WebRTC integration for streaming ROS 2 topics to browser. | [GitHub](https://github.com/nicolecll/webrtc_ros2_streamer) |

---

## 15. Photogrammetry / Drone Processing

| Project | Description | Links |
|---------|-------------|-------|
| **OpenDroneMap (ODM)** | Command line toolkit for drone imagery → maps, point clouds, 3D models, DEMs. | [GitHub](https://github.com/OpenDroneMap/ODM) · [Homepage](https://opendronemap.org/) |
| **WebODM** | Web UI for OpenDroneMap. User-friendly drone image processing. AGPL-3.0. | [GitHub](https://github.com/OpenDroneMap/WebODM) · [Homepage](https://webodm.org/) |

---

## 16. Frontend / UI Framework

| Project | Description | Links |
|---------|-------------|-------|
| **Svelte 5** | Compiler-based UI framework. Runes for fine-grained reactivity. No virtual DOM. MIT. | [GitHub](https://github.com/sveltejs/svelte) · [Homepage](https://svelte.dev/) |
| **SvelteKit** | Full-stack framework for Svelte. Routing, SSR, adapters. MIT. | [GitHub](https://github.com/sveltejs/kit) · [Homepage](https://kit.svelte.dev/) |
| **shadcn-svelte** | Beautiful, customizable components for Svelte. Open source. | [Homepage](https://shadcn-svelte.com/) |
| **Threlte** | Declarative Three.js for Svelte 5. 3D scenes as Svelte components. | [GitHub](https://github.com/threlte/threlte) · [Homepage](https://threlte.xyz/) |
| **Flowbite Svelte** | Tailwind CSS component library for Svelte. | [Homepage](https://flowbite-svelte.com/) |

---

## 17. Build / Monorepo

| Project | Description | Links |
|---------|-------------|-------|
| **Turborepo** | High-performance monorepo build system. Smart caching. By Vercel. MIT. | [GitHub](https://github.com/vercel/turborepo) · [Homepage](https://turbo.build/) |
| **pnpm** | Fast, disk-efficient package manager. Workspace support for monorepos. MIT. | [GitHub](https://github.com/pnpm/pnpm) · [Homepage](https://pnpm.io/) |
| **Vitest** | Vite-native test framework. Fast, TypeScript-first. MIT. | [GitHub](https://github.com/vitest-dev/vitest) · [Homepage](https://vitest.dev/) |
| **Playwright** | Cross-browser E2E testing. By Microsoft. Apache 2.0. | [GitHub](https://github.com/microsoft/playwright) · [Homepage](https://playwright.dev/) |
| **esbuild** | Extremely fast JavaScript/TypeScript bundler. Go-based. MIT. | [GitHub](https://github.com/evanw/esbuild) · [Homepage](https://esbuild.github.io/) |
| **wasm-pack** | Build Rust → WASM packages for npm. | [GitHub](https://github.com/nicholaswyoung/wasm-pack) · [Homepage](https://rustwasm.github.io/wasm-pack/) |

---

## 18. AI + AEC Research

| Project | Description | Links |
|---------|-------------|-------|
| **Text2BIM** | Multi-agent LLM framework for generating 3D building models from natural language → IFC. | [GitHub](https://github.com/dcy0577/Text2BIM) · [Paper](https://arxiv.org/abs/2408.08054) |
| **MCP4IFC** | MCP server enabling LLMs to create/edit/query IFC models via tool calls. | [Paper](https://arxiv.org/abs/2511.05533) · [Homepage](https://show2instruct.github.io/mcp4ifc/) |
| **BIM LLM Code Agent** | LLM-powered BIM code agent. | [GitHub](https://github.com/mac999/BIM_LLM_code_agent) |
| **awesome-civil-engineering** | Curated list of civil engineering software and resources. | [GitHub](https://github.com/QuantumNovice/awesome-civil-engineering) |
| **awesome-frontend-gis** | Curated geospatial resources for web development. | [GitHub](https://github.com/joewdavies/awesome-frontend-gis) |
| **awesome-geospatial** | Comprehensive list of geospatial tools and resources. | [GitHub](https://github.com/sacridini/Awesome-Geospatial) |
