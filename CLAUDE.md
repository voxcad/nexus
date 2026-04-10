# NEXUS — Browser-Native 2D/3D CAD + BIM + GIS Platform

## Project Overview
NEXUS is a unified, browser-based spatial engineering platform that will replace desktop AEC suites (AutoCAD, Civil 3D, Revit, ArcGIS Pro, QGIS) by unifying Civil Engineering, BIM, GIS, Surveying, Remote Sensing, and Construction in one browser tab. Currently building the 2D CAD vertical slice (v0.1).

---

## NON-NEGOTIABLE ARCHITECTURAL RULES

These rules are binding for ALL agents — human or AI — working on this codebase. Violating them creates technical debt that compounds across the entire platform lifecycle.

### Rule 1: Every Operation Is a Command
Every geometric or data operation MUST be an independent command object that can be executed by GUI click, keyboard shortcut, command line input, API call, OR AI agent tool call — identically. NEVER bury logic inside UI event handlers. If a human can do it, an agent must be able to do it programmatically with the same result.

**Why:** The platform is designed for human-AI-robot co-engineering. If drawing a line requires clicking a button, AI agents are locked out. Every future domain (BIM, GIS, Civil) will add commands — they all flow through the same command system.

**How to apply:** Create a command in the kernel or command layer. The UI dispatches it. The AI dispatches the same command via MCP tool call. The renderer reacts to state changes, never to UI events directly.

### Rule 2: Event-Sourced State — No Direct Mutation
Every state change MUST produce an immutable event appended to the event log. Current state is derived by replaying events. NEVER mutate entity state directly without emitting an event.

**Why:** Event sourcing gives us: unlimited undo/redo, full audit trail (who/what changed what and when), AI replay (agents can study how a human designed something), time-travel debugging, forensic liability tracking for AI-generated geometry. All future domains need this — BIM compliance, construction progress tracking, ISO 19650 audit requirements.

**How to apply:** Command → validate → emit Event → apply to state → notify renderer. Undo = move cursor back. Redo = move cursor forward. Never delete events.

### Rule 3: ECS Data Model — No Class Inheritance for Entities
All spatial entities (CAD, BIM, GIS, survey, point cloud, construction) MUST use Entity-Component-System architecture. An entity is an ID. Components are data bags. Systems operate on component queries. NEVER create class hierarchies like `Wall extends BIMEntity extends SpatialEntity extends Entity`.

**Why:** ECS is the ONLY data model that scales to 500k+ entities without performance collapse AND allows adding new domains without breaking existing code. A BIM Wall is `{EntityId, Geometry, BIMProperties, Layer}`. A GIS Feature is `{EntityId, Geometry, GISAttributes, Layer}`. Same world, same queries, same renderer. Class inheritance makes cross-domain queries impossible. This decision is IRREVERSIBLE once systems depend on the ECS layout — get it right from day one.

**How to apply:** Add new entity types by composing components, never by subclassing. Systems query by component presence (e.g., "all entities with Geometry + BIMProperties"). New domains add new component types, not new entity base classes.

### Rule 4: Additive Expansion — Never Rewrite, Always Extend
Every new domain (3D, BIM, GIS, Civil, Point Cloud, Digital Twin) MUST be added as new components, new commands, new renderers, and new file parsers plugged into the EXISTING ECS world, event store, command system, and MCP protocol. NEVER restructure the core to accommodate a new domain.

**Why:** The expansion path is:
```
2D CAD → 3D CAD (add OCCT kernel, extrude/revolve commands)
       → BIM (add web-ifc parser, BIMProperties component, IFC commands)
       → GIS (add CesiumJS renderer, CRS component, PROJ transforms)
       → Civil (add alignment/grading commands, terrain surface component)
       → Point Cloud (add Potree renderer, PointCloud component)
       → Digital Twin (add IoT ingestion, streaming state component)
```
Each step adds to the platform. Nothing from previous steps is thrown away or rewritten. If adding a domain requires restructuring the core, the core abstraction is wrong — fix the abstraction, don't rewrite.

### Rule 5: Rust/WASM for Computation, TypeScript for Interaction
Geometry computation, spatial queries, constraint solving, and heavy data processing MUST live in Rust compiled to WASM. UI, rendering orchestration, and user interaction MUST live in TypeScript/Svelte. The boundary is the wasm-bindgen bridge.

**Why:** Rust/WASM gives near-native performance for geometry math (boolean ops, offset, fillet, intersection) while TypeScript/Svelte gives the best developer experience for reactive UI. Both compile to browser-native code. This dual-stack carries through every future domain — OCCT in WASM, Parry in WASM, planegcs in WASM, while Three.js/CesiumJS/Potree render in JS.

**How to apply:** Ask "is this computation or interaction?" Computation → Rust. Interaction → TypeScript. The bridge passes serialized data (JSON or SharedArrayBuffer), not live object references.

### Rule 6: AI Agents Are First-Class Users
The MCP tool schema for every operation MUST be defined at the same time as the operation itself — not bolted on later. Every command must have: name, typed parameters, typed return value, and be callable without any GUI context.

**Why:** The platform's core thesis is human-AI-robot co-engineering. If AI integration is an afterthought, the tool schemas will be inconsistent, incomplete, and leak GUI assumptions. Future agents (Structural Agent, MEP Agent, Civil Agent, Compliance Agent) all call through the same MCP protocol. Design it now.

**How to apply:** When adding a new command (e.g., `offset_curve`), simultaneously define: (1) the Rust kernel function, (2) the WASM binding, (3) the MCP tool schema with JSON Schema parameters, (4) the command line alias. All four or the feature is incomplete.

### Rule 7: Research Before Building
Before implementing any significant feature, check if an open-source project already solves it. Prefer importing proven libraries over building from scratch. Only build custom where genuine gaps exist.

**Why:** The open-source AEC/spatial ecosystem has strong components (web-ifc, opencascade.js, CesiumJS, Potree, planegcs, Rapier, Yjs, LangGraph). Rebuilding what they already do wastes months. NEXUS's unique value is the INTEGRATION — connecting these projects through a unified ECS + command + MCP architecture, plus building the civil engineering domain that nobody has built in the browser.

**How to apply:** Check docs/research/02-open-source-tools-catalog.md before starting work. If a library exists with a compatible license (MIT/Apache 2.0/BSD), use it. If it's close but needs adaptation, fork/wrap it. Only build from scratch if nothing exists (e.g., civil engineering alignment tools).

---

## Architecture

- **Dual stack:** TypeScript (UI, rendering) + Rust/WASM (geometry kernel, ECS)
- **Frontend:** Svelte 5 (runes syntax) + SvelteKit + Three.js
- **Kernel:** Rust compiled to WASM via wasm-pack + wasm-bindgen
- **Monorepo:** pnpm workspaces + Turborepo
- **AI:** MCP tool schemas, LangGraph.js for orchestration

## Package Structure
```
packages/
├── @nexus/core          # Shared types, events, entity IDs
├── @nexus/kernel         # Rust/WASM geometry kernel + ECS
├── @nexus/renderer       # Three.js 2D rendering
├── @nexus/ui             # Svelte 5 shell
├── @nexus/file-io        # DXF parser/writer, OPFS
├── @nexus/ai             # MCP server, tool schemas
└── @nexus/app            # SvelteKit app
```

## Commands
- `pnpm install` — install all dependencies
- `pnpm build` — build all packages (Rust WASM + TypeScript)
- `pnpm dev` — start dev server
- `pnpm test` — run all tests (vitest + cargo test)
- `pnpm build:kernel` — build Rust WASM only

## Conventions
- Always use pnpm, never npm
- Always use cargo for Rust
- Conventional commits: feat:, fix:, refactor:, docs:, chore:, test:
- TypeScript strict mode
- Svelte 5 runes syntax ($state, $derived, $effect)
- Rust: idiomatic, thiserror for lib errors, anyhow in binaries
- No unnecessary comments or docstrings
- Small functions, single responsibility
- Integration tests over mocks for external services

## Key Dependencies
- planegcs (WASM) — 2D geometric constraint solver
- dxf-parser — DXF file parsing
- parry2d (Rust) — collision detection, spatial queries
- wasm-bindgen — Rust↔JS bridge
- Three.js — 2D/3D rendering

## Key Research Documents
- `docs/research/00-landscape-analysis.md` — What exists, what to build vs reuse
- `docs/research/02-open-source-tools-catalog.md` — 100+ projects with links
- `docs/research/03-tiered-study-plan.md` — Which repos to study deeply
- `docs/research/04-adjacent-technology.md` — Game engine patterns applicable to CAD
- `PRD.md` — Product requirements for v0.1 (2D CAD)
- `SPRINTS.md` — Sprint plan
