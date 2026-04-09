# NEXUS — AI + Spatial Engineering Landscape

> **Date:** 2026-04-10
> **Source:** Web search + training data analysis

---

## The Dominant Pattern: LLM as Code Generator, Not Geometry Predictor

The single most important finding across all AI + spatial projects:

> **Every successful AI+CAD/BIM/GIS system uses LLMs to generate CODE targeting a geometry kernel — not to predict geometry directly.**

This means:
1. The quality of the target DSL/API matters enormously
2. Tool-calling schemas for spatial operations are the critical missing infrastructure
3. Validation after LLM generation is essential
4. The geometry kernel remains a traditional computational geometry system — AI sits on top

---

## Key Projects

### Zoo.dev (formerly KittyCAD) — Most Advanced AI+CAD
- **Model:** LLM → KCL (KittyCAD Language) → Geometry Engine → STEP/STL/glTF
- **Open source parts:** Modeling app (MIT, SvelteKit), KCL language (open source)
- **Proprietary:** Geometry engine, ML models (ML-ephant)
- **Key insight:** Text-to-CAD works commercially. Their two-stage approach (semantic understanding via LLM, geometric execution via kernel) is the validated architecture pattern.
- [Zoo.dev Text-to-CAD](https://zoo.dev/blog/introducing-text-to-cad)

### Text2BIM — Multi-Agent BIM Generation (Research)
- **Paper:** [arXiv:2408.08054](https://arxiv.org/abs/2408.08054)
- **GitHub:** [dcy0577/Text2BIM](https://github.com/dcy0577/Text2BIM)
- **Model:** Multi-agent LLM framework → generates code → BIM authoring API → IFC export
- **Agents:** Programmer Agent + Reviewer Agent (reads BCF files) + Model Checker
- **Key insight:** Multi-agent decomposition works for BIM. The Reviewer agent that interprets quality reports and feeds back is directly applicable to NEXUS.

### MCP4IFC — MCP Server for IFC (Research)
- **Paper:** [arXiv:2511.05533](https://arxiv.org/abs/2511.05533)
- **What:** First MCP server enabling LLMs to create, edit, and query IFC models via tool calls
- **Stack:** IfcOpenShell + Bonsai/Blender as backend, MCP protocol
- **Features:** Predefined BIM tools + dynamic code generation with RAG
- **Key insight:** MCP is the right protocol for AI-BIM integration. They've defined working tool schemas.

### GIS MCP Server
- **GitHub:** [mahdin75/gis-mcp](https://github.com/mahdin75/gis-mcp)
- **What:** MCP server for GIS operations — coordinate transforms, spatial analysis, geometry ops
- [GIS MCP Server](https://gis-mcp.com/)

### CAD MCP Server
- **GitHub:** [daobataotie/CAD-MCP](https://github.com/daobataotie/CAD-MCP)

### Revit MCP Server
- **Source:** [archilabs.ai](https://archilabs.ai/posts/revit-model-context-protocol)
- **What:** AI ↔ Revit via MCP + WebSocket

### Autodesk MCP for Construction
- [Autodesk blog on MCP in construction](https://www.autodesk.com/blogs/construction/mcp-servers-in-construction/)
- **Key insight:** Even Autodesk is embracing MCP for AI integration

---

## AI + GIS
- LLM → SQL/Python geospatial code generation is the most mature pattern
- Natural language to PostGIS SQL queries works reliably
- Multi-step GIS workflows via LLM agents (geocoding → buffer → spatial join) proven in research
- GIS is the most LLM-ready spatial domain due to well-defined APIs

## AI + Generative Design
- **NSGA-II** remains the standard for multi-objective AEC optimization
- **Ladybug Tools** (GPL): Environmental analysis backend for generative design
- **DEAP/Platypus:** Python evolutionary optimization libraries
- No integrated open-source generative design package for AEC exists
- **Hypar** was acquired by McNeel (Rhino) in 2023, cloud platform wound down

## Digital Twin + AI
- **Eclipse Ditto:** IoT twin state management, not 3D
- Computer vision (YOLO) for site monitoring (PPE, progress) — some OSS implementations
- LLMs add value as natural language query layer over twin data
- No open-source AI-driven construction digital twin exists

---

## What Does NOT Exist Yet (NEXUS Opportunities)

1. An MCP server exposing unified CAD+BIM+GIS operations as callable tools
2. An open-source integrated AI-assisted BIM authoring tool in browser
3. A multi-agent system with specialized AEC roles and shared spatial context
4. An open-source alternative to Zoo.dev's text-to-CAD pipeline
5. LLM-driven IFC generation/editing with compliance validation in browser
6. AI-driven civil engineering design (road alignment, grading) — completely open field
7. Browser-native point cloud editing/classification with AI assistance
