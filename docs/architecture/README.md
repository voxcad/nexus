# NEXUS — Technical Architecture Document Index

> **Version:** 1.0.0
> **Date:** 2026-04-09
> **Status:** Binding Architectural Decisions
> **Classification:** Internal — Engineering Leadership

## Document Structure

| # | Document | Section | Description |
|---|----------|---------|-------------|
| 0 | [Executive Summary](00-executive-summary.md) | §1 | Vision, non-negotiable decisions, highest-risk bet |
| 1 | [System Architecture](01-system-architecture.md) | §2 | 7-layer architecture (L0–L6) with ASCII diagrams |
| 2 | [Tech Stack Matrix](02-tech-stack-matrix.md) | §3 | 12-category library evaluation with verdicts |
| 3 | [Data Interoperability](03-data-interoperability.md) | §4 | Coordinate systems, USES schema, streaming formats |
| 4 | [Design Patterns](04-design-patterns.md) | §5 | 8 patterns with TypeScript interfaces |
| 5 | [Agentic UI Design](05-agentic-ui-design.md) | §6 | NL→geometry pipeline, multi-agent, generative design |
| 6 | [MVP Roadmap](06-mvp-roadmap.md) | §7 | Sprint 0–5 + post-MVP Q3–Q6 roadmap |
| 7 | [Performance Benchmarks](07-benchmarks.md) | §8 | Rendering, WASM, memory, AI, latency benchmarks |
| 8 | [Security & Compliance](08-security-compliance.md) | §9 | Trust boundaries, GDPR, ITAR, ISO 19650, audit trail |
| 9 | [Architectural Risks](09-risks.md) | §10 | Top 5 risks, irreversible decisions, mitigations |

## Research

| Document | Description |
|----------|-------------|
| [Research Summary](NEXUS-research-summary.md) | Consolidated research findings — all sections A–H in one document with key divergences from detailed specs noted |

## Supporting Artifacts

| Artifact | Location | Description |
|----------|----------|-------------|
| USES Schema (TypeScript) | [schemas/uses.ts](../schemas/uses.ts) | Universal Spatial Entity Schema interfaces |
| USES Schema (FlatBuffers) | [schemas/uses.fbs](../schemas/uses.fbs) | Binary wire format for high-frequency updates |
| Headless Geometry API | [api/geometry-api.ts](../api/geometry-api.ts) | OpenAPI-aligned type definitions for geometry ops |
| Agent Tool Schemas | [api/agent-tools.ts](../api/agent-tools.ts) | LLM tool-calling JSON schemas |

## How to Read This Document

1. **Executives / PMs:** Start with §1 (Executive Summary), then §7 (Roadmap), then §10 (Risks)
2. **Backend / Platform Engineers:** §2 (Architecture) → §5 (Patterns) → §4 (Interop) → §8 (Benchmarks)
3. **AI / ML Engineers:** §6 (Agentic UI) → §2 Layer 3 (AI Orchestration) → §5 D5 (Agent Negotiation)
4. **Frontend / Graphics Engineers:** §3 (Tech Stack) → §5 D7 (Flyweight) → §8 G1 (Rendering)
5. **Security / Compliance:** §9 (Security) → §10 (Risks)
