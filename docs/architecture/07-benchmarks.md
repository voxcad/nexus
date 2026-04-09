# NEXUS — Performance Benchmarks & Limits

All figures reflect 2024–2025 measurements on mainstream hardware (M2/M3 Mac, RTX 4070-class desktop, 16–32 GB RAM) running Chrome 120+ unless noted. Where no public benchmark exists, values are marked **engineering estimate** with stated assumptions.

---

### G1 — Rendering Ceiling

| Metric | Value | Conditions | Source |
|---|---|---|---|
| WebGL2 max triangles @ 60 fps (simple shading) | 2–5 M | Flat/Gouraud, single draw call via merged geometry | Khronos WebGL conformance tests; Three.js community benchmarks (2024) |
| WebGL2 max triangles @ 60 fps (PBR) | 500 K–1 M | glTF PBR metallic-roughness, 4 lights, shadow maps | Three.js r160 perf reports; engineering estimate |
| WebGPU instanced geometry improvement over WebGL2 | 2–4× | Same triangle count, instanced draw, Chrome 120+ | Google "WebGPU — All of the cores, none of the canvas" (2024); Babylon.js WebGPU benchmarks |
| CesiumJS simultaneous terrain tiles (4K viewport) | ~2 000 tiles | Quantized-mesh, 16 px SSE, 3840×2160 | CesiumJS GitHub issue #11%..; engineering estimate based on tile shader budget |
| Potree 2 max points @ 60 fps (LOD streaming) | 50–100 M | Octree LOD, RTX 4070, Chrome, 1080p | Potree 2.0 release notes (2024); TU Wien benchmarks |
| Three.js BatchedMesh draw calls / frame | 1–4 | Merges thousands of objects into single multi-draw | Three.js r162 changelog; engineering estimate |

### G2 — WASM Compute Performance

| Operation | WASM Time | Native Time | Ratio | Source |
|---|---|---|---|---|
| OCCT boolean union (two moderate B-Rep solids, ~10 K faces) | 200–500 ms | 50–100 ms | 4–5× | OpenCASCADE.js benchmarks (Sebastian Alff, 2024); engineering estimate for native baseline |
| GDAL WASM reproject 100 K points (EPSG:4326 → 3857) | ~150 ms | ~30 ms (native Python/C) | 5× | Engineering estimate; GDAL WASM port by Loaders.gl team |
| PROJ WASM coordinate transform throughput | ~2 M pts/sec | ~10 M pts/sec | 5× | Engineering estimate based on proj4js benchmarks |
| LAZ decode 10 M points (copc.js / laz-perf WASM) | 3–5 s | ~1 s (native LAStools) | 3–5× | copc.js benchmarks (2024); engineering estimate |
| Manifold WASM mesh boolean (two 50 K-tri meshes) | 30–80 ms | 10–20 ms | 3–4× | Manifold GitHub benchmarks (Emmett Lalish, 2024) |
| IFC.js parsing 50 MB IFC file | 4–8 s | ~1.5 s (native IfcOpenShell) | 3–5× | web-ifc benchmarks (That Open Company, 2024) |

### G3 — Memory Limits

| Limit | Chrome | Firefox | Safari | Notes |
|---|---|---|---|---|
| WASM linear memory max | 4 GB | 4 GB | **2 GB** | Safari is the binding constraint; WebKit bug 244354 |
| SharedArrayBuffer max per buffer | 2 GB | 2 GB | 1 GB | Requires COOP/COEP headers; Safari further restricted |
| OPFS sequential read throughput | 200–500 MB/s | 150–300 MB/s | 100–200 MB/s | Engineering estimate; Chrome leads due to Blink optimizations |
| IndexedDB sequential read throughput | 50–100 MB/s | 30–80 MB/s | 20–50 MB/s | Widely benchmarked; Nolan Lawson (2023) |
| WebGPU buffer size (default) | 256 MB | 256 MB | N/A (no WebGPU <18) | Can request larger via `requestDevice({ requiredLimits })` |
| Total tab memory before OOM kill | ~4 GB | ~4 GB | ~2–3 GB | OS-dependent; Chrome uses per-process limit |
| Web Worker count (practical) | 8–16 | 8–16 | 4–8 | Hardware-thread dependent; diminishing returns past core count |

### G4 — AI Inference in Browser

| Model / Task | Throughput | Hardware | Source |
|---|---|---|---|
| Transformers.js MiniLM-L6 384-d embedding | 100–200 tokens/sec | M2 Mac, Chrome, WASM SIMD | Xenova/transformers.js benchmarks (2024) |
| Transformers.js all-MiniLM-L6-v2 embedding (WebGPU) | 300–500 tokens/sec | M2 Mac, Chrome 120+ WebGPU | Engineering estimate; 2–3× over WASM path |
| WebLLM Llama 3.2 3B (q4f16_1) | 15–30 tokens/sec | M2 Mac, Chrome WebGPU | mlc-ai/web-llm benchmarks (2024) |
| WebLLM Phi-3 mini 3.8B (q4f16_1) | 20–40 tokens/sec | M2 Mac, Chrome WebGPU | mlc-ai/web-llm benchmarks (2024) |
| LangGraph.js agent loop (no LLM call) | ~1–2 ms/step | Any modern CPU | Engineering estimate; pure JS graph traversal |
| ONNX Runtime Web (YOLOv8-nano, 640×640) | 15–25 ms/frame | M2 Mac, Chrome WebGPU | Engineering estimate; ONNX Runtime Web benchmarks |

### G5 — Real-Time Pipeline Latency

| Hop | Latency | Conditions |
|---|---|---|
| rosbridge WebSocket → browser | 10–20 ms | LAN, JSON serialization, <1 KB payload |
| rosbridge WebSocket → browser (CBOR binary) | 5–10 ms | LAN, binary serialization |
| Point cloud delta compression (octree diff) | 60–70% bandwidth reduction | Engineering estimate; octree-based spatial differencing |
| Yjs CRDT sync (entity updates) | Usable up to ~10 K updates/sec | Beyond 10 K/sec, merge latency exceeds 100 ms |
| Yjs CRDT document size limit (practical) | ~10–50 MB | Larger docs degrade sync perf; engineering estimate |
| WebSocket round-trip (cloud, same region) | 20–50 ms | AWS us-east to browser in same region |
| WebRTC data channel (peer-to-peer) | 5–15 ms | LAN; useful for local multi-device sync |
| MQTT over WebSocket (IoT sensor → browser) | 15–30 ms | LAN, QoS 0, <256 byte payload |

---

## Practical Implications

These numbers drive five critical NEXUS architecture decisions:

1. **The 2 GB Safari wall dictates aggressive memory management.** With OCCT WASM alone consuming 35 MB+ of code and potentially hundreds of MB of B-Rep data, Safari users hit the ceiling fast. NEXUS must implement per-browser memory budgets, aggressive LOD eviction, and OPFS-backed virtual memory (page geometry in/out of WASM heap). Chrome users get the full experience; Safari gets a gracefully degraded one.

2. **WASM compute is 3–5× slower than native — fast enough for interactive editing, too slow for batch processing.** A single boolean union at 200–500 ms is acceptable for a user clicking "subtract." Running 500 booleans to regenerate a parametric assembly is not. NEXUS needs a hybrid strategy: WASM for interactive single-op edits, server-side OCCT (or Manifold as a fast mesh path) for batch regeneration, with OPFS caching the results.

3. **The 16 ms frame budget must be split across four renderers.** At 60 fps, each frame gets 16.67 ms. With four sub-renderers (GIS terrain, BIM models, point clouds, CAD overlays), each gets ~4 ms. This is tight but achievable if renderers share a single WebGPU context and coordinate via a frame-budget allocator that dynamically reallocates time based on viewport focus. Any renderer exceeding its budget gets LOD-reduced next frame.

4. **Browser-local AI is viable for embeddings and small models, not for frontier reasoning.** MiniLM embeddings at 100–200 tokens/sec are fast enough for real-time semantic search over entity descriptions. Llama 3.2 3B at 15–30 tokens/sec is usable for simple code generation and parameter suggestion. But complex multi-step geometric reasoning requires server-side frontier models (Claude, GPT-4o) via API — the browser is the agent runtime (LangGraph.js), not the LLM host.

5. **CRDT sync works for collaborative editing up to ~10 K entity mutations/sec.** This covers the typical multi-user design session (3–5 users, each making 10–50 edits/sec). Beyond that — e.g., automated agent making thousands of parametric changes — NEXUS must batch agent mutations into single CRDT transactions to avoid flooding the sync layer.
