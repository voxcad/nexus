# NEXUS — Security, Compliance & Enterprise Readiness

---

### H1 — Data Security for Engineering IP

NEXUS operates on a **local-first trust boundary model**. Geometry is sovereign to the browser tab by default. Every outbound data path is explicit, user-consented, and minimally scoped.

#### Core Principles

- **Geometry NEVER leaves the browser tab** unless the user explicitly enables cloud sync for a specific project workspace.
- **AI coordinate masking**: before any LLM API call, absolute geo-coordinates are stripped and replaced with local-origin-relative values. The LLM sees topology and relative dimensions, never real-world coordinates. Reverse transform is applied to the response on the client.
- **Coordinate anonymization pipeline**: `[absolute WGS84] → subtract project origin → rotate to arbitrary local frame → send to LLM → receive response → inverse transform → apply to scene`. The LLM cannot reconstruct the physical location.
- **In-transit encryption**: all cloud sync uses TLS 1.3 (minimum). No fallback to TLS 1.2.
- **At-rest encryption**: cloud-stored project data uses AES-256-GCM with per-project encryption keys. Key management via AWS KMS or equivalent.
- **OPFS browser storage**: encrypted at the OS/browser sandbox level. No additional application-layer encryption needed (Chrome encrypts profile data at rest on macOS/Windows).
- **WebWorker isolation**: geometry kernels (OCCT, Manifold, GDAL) run in dedicated Worker contexts. A compromised worker cannot access the main thread's DOM, cookies, or other workers' memory without SharedArrayBuffer (which is scoped).

#### Trust Boundary Architecture

```
┌─────────────────────────────────────────────────────────┐
│  ZONE 1 — Browser Tab (FULLY TRUSTED)                   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ ECS Store│  │OPFS Cache│  │ WASM     │              │
│  │ (memory) │  │ (disk)   │  │ Kernels  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Renderers│  │LangGraph │  │ Yjs CRDT │              │
│  │ (GPU)    │  │ Agent    │  │ (local)  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
├─────────────────────────────────────────────────────────┤
│  ZONE 2 — Local Network (AUTHENTICATED, TLS)            │
│                                                         │
│  rosbridge (WebSocket/TLS) ←→ ROS 2 nodes              │
│  MQTT broker (TLS + client certs) ←→ IoT sensors        │
│  Local Yjs WebSocket server ←→ peer browser tabs        │
├─────────────────────────────────────────────────────────┤
│  ZONE 3 — Cloud Sync (ENCRYPTED, USER-CONSENTED)        │
│                                                         │
│  PostGIS (TLS 1.3, AES-256-GCM at rest)                │
│  S3/R2 object storage (SSE-S256, bucket policies)       │
│  Yjs cloud relay (encrypted WebSocket)                  │
│  ── User must explicitly enable per-project ──          │
├─────────────────────────────────────────────────────────┤
│  ZONE 4 — External AI API (COORDINATE-MASKED)           │
│                                                         │
│  LLM providers (Claude, GPT-4o, etc.)                   │
│  ── NO raw geometry, NO absolute coordinates ──         │
│  ── Only: relative dims, topology, text descriptions ── │
│  ── API keys stored in browser credential store ──      │
└─────────────────────────────────────────────────────────┘
```

#### Data Flow Controls

| Data Type | Zone 1 → Zone 2 | Zone 1 → Zone 3 | Zone 1 → Zone 4 |
|---|---|---|---|
| Raw B-Rep geometry | Allowed (local ROS) | User-consented only | **NEVER** |
| Point cloud data | Allowed (local ROS) | User-consented only | **NEVER** |
| Absolute coordinates | Allowed | Encrypted only | **NEVER** (masked) |
| Relative geometry + topology | Allowed | Allowed | Allowed (masked) |
| Entity metadata (text) | Allowed | Allowed | Allowed (sanitized) |
| User PII | N/A | GDPR-compliant only | **NEVER** |

---

### H2 — Regulatory Compliance

#### GDPR (EU General Data Protection Regulation)

- **Data residency**: all personal data (site workers, project managers, access logs) stored either locally in OPFS or in EU-region PostGIS (eu-west-1). No personal data transits to US regions unless user explicitly configures otherwise.
- **Right to erasure**: deletion request triggers: (1) purge from local OPFS, (2) sync deletion event to cloud, (3) cascade delete across all replicas within 72 hours, (4) cryptographic verification of deletion via signed receipt.
- **Data minimization**: NEXUS stores only the minimum personal data needed for collaboration (display name, email, role). No telemetry or usage analytics collected without explicit opt-in.
- **Data Processing Agreement (DPA)**: required template provided for all cloud deployment customers. Covers sub-processors (AWS, LLM providers).

#### US ITAR (International Traffic in Arms Regulations)

- **Default posture**: local-first architecture means defense infrastructure projects NEVER sync to any cloud by default. ITAR compliance is the default, not a special mode.
- **ITAR build flag**: compile-time flag (`NEXUS_ITAR=true`) that completely removes all cloud sync endpoints, external API calls, and telemetry code paths from the build. Not a runtime toggle — the code is physically absent from the binary.
- **Verification**: ITAR builds include a build manifest listing all outbound network endpoints (should be zero). Auditable via static analysis of the compiled WASM and JS bundles.

#### ISO 19650 (BIM Information Management)

- **Audit trail**: the event-sourced architecture provides a complete, immutable record of every design change, satisfying ISO 19650-1 Clause 12 (information management process).
- **Information containers**: map directly to NEXUS project workspaces. Each workspace is a self-contained unit with its own event log, access control, and versioning.
- **CDE workflow states**: implemented as entity lifecycle states in the ECS:

| CDE State | NEXUS Entity Status | Transition Rule |
|---|---|---|
| Work in Progress (WIP) | `DRAFT` | Default state for new/modified entities |
| Shared | `SHARED` | Author explicitly publishes; triggers Yjs sync to collaborators |
| Published | `PUBLISHED` | Requires reviewer approval; entity becomes read-only |
| Archived | `ARCHIVED` | Retained in event log; excluded from active queries |

#### Legal Admissibility

- **Tamper-evident event log**: every event in the store is linked via SHA-256 hash chain. Each event's hash includes the previous event's hash, creating an append-only chain. Any modification to a historical event breaks the chain and is detectable.
- **Agent reasoning traces**: every AI-generated geometry change includes the full reasoning trace (input context, tool calls, confidence scores). This provides forensic evidence for liability determination.
- **Timestamp authority**: events are timestamped with both local clock and (when online) a trusted timestamp authority (RFC 3161) for legal non-repudiation.

---

### H3 — Audit Trail for AI-Generated Geometry

Every agent action produces an `AgentDecisionEvent` in the immutable event store. This provides complete chain-of-custody for all AI-generated geometry.

#### AgentDecisionEvent Interface

```typescript
interface AgentDecisionEvent {
  readonly eventId: string;                // UUIDv7 (time-sortable)
  readonly prevEventHash: string;          // SHA-256 of previous event (chain link)
  readonly timestamp: number;              // Unix ms, supplemented by RFC 3161 TSA
  readonly agentId: string;                // Unique agent instance identifier
  readonly agentModel: string;             // e.g. "claude-sonnet-4-20250514", "gpt-4o-2024-08-06"
  readonly sessionId: string;              // Links to user's editing session
  readonly actionType: AgentActionType;    // "CREATE" | "MODIFY" | "DELETE" | "VALIDATE" | "REPAIR"
  readonly inputContext: {
    userPrompt: string;                    // Sanitized user request
    selectedEntityIds: string[];           // Entities the agent was given access to
    sceneSnapshot: string;                 // Hash of ECS state at decision time
  };
  readonly toolCalls: Array<{
    toolName: string;                      // e.g. "occt_boolean_union", "set_component"
    parameters: Record<string, unknown>;   // Sanitized (no absolute coords)
    result: "SUCCESS" | "FAILED" | "PARTIAL";
    durationMs: number;
  }>;
  readonly geometryDelta: {
    entitiesCreated: string[];             // Entity IDs
    entitiesModified: string[];
    entitiesDeleted: string[];
    componentChanges: number;              // Total ECS component mutations
  };
  readonly reasoningTrace: string;         // Full chain-of-thought (sanitized)
  readonly confidenceScore: number;        // 0.0–1.0, self-assessed by agent
  readonly validationResults: {
    topologyValid: boolean;
    constraintsSatisfied: boolean;
    collisionFree: boolean;
  };
  readonly humanApprovalStatus: "PROPOSED" | "APPROVED" | "REJECTED" | "AUTO_APPROVED";
  readonly approvedBy?: string;            // User ID who approved, if applicable
  readonly approvedAt?: number;            // Timestamp of approval
}

type AgentActionType = "CREATE" | "MODIFY" | "DELETE" | "VALIDATE" | "REPAIR";
```

#### Chain of Custody

Every entity carries a `lineage` component that tracks its full creation and modification chain:

```
Entity #4821 lineage:
  [1] HUMAN:user-0042      → Created base sketch          (2026-04-09T10:02:14Z)
  [2] AGENT:claude-sonnet   → Extruded to 3D solid         (2026-04-09T10:02:31Z)  PROPOSED
  [3] HUMAN:user-0042      → Approved extrusion            (2026-04-09T10:02:45Z)  APPROVED
  [4] AGENT:claude-sonnet   → Added fillet to edges         (2026-04-09T10:03:12Z)  PROPOSED
  [5] AGENT:validation      → Topology check passed         (2026-04-09T10:03:13Z)
  [6] HUMAN:user-0042      → Approved fillet                (2026-04-09T10:03:20Z)  APPROVED
```

#### Liability Model

- All AI-generated geometry enters the system with status **`PROPOSED`**. It is rendered with a distinct visual indicator (dashed outline, amber highlight) so users always know what is agent-generated and unapproved.
- Only a human user can change status to **`APPROVED`**. Approval is itself an event in the log.
- **`AUTO_APPROVED`** status is available only for low-risk operations (cosmetic changes, metadata updates) as configured by project policy. Structural geometry always requires human approval.
- In the event of a failure (e.g., structural element underperformance), the forensic process is:
  1. Identify the failed entity by ID.
  2. Query the event log for all `AgentDecisionEvent` records referencing that entity.
  3. For each agent decision: inspect `inputContext`, `toolCalls`, `reasoningTrace`, and `confidenceScore`.
  4. Determine whether the agent acted within its authorized parameters and whether a human approved the result.
  5. The immutable hash chain proves the log has not been tampered with post-facto.
