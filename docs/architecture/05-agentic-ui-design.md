# NEXUS -- Agentic UI Deep Design

This document specifies the binding architectural decisions for NEXUS's agentic UI layer: how AI agents interpret natural language, call geometry APIs, collaborate with each other, drive generative design loops, and maintain digital twin fidelity. Every interface defined here is a contract. Implementations that diverge from these schemas are bugs.

---

## E1 -- Natural Language to Geometric Intent to API Call Pipeline

### Reference Prompt

> "Design a 2-lane rural road from point A (lat: 34.0522, lon: -118.2437) to point B (lat: 34.0622, lon: -118.2337), avoid the wetland zone in layer 'ecology_sensitive', apply AASHTO standards for 80km/h design speed, and flag any gradient steeper than 8% for human review."

### Stage 1: NLP Parsing and Intent Extraction

The LLM receives the prompt with a system message containing the full tool schema catalog. It produces a structured intent object before any tool calls:

```json
{
  "intent": "road_design",
  "entities": {
    "road_type": "rural",
    "lanes": 2,
    "start_point": { "lat": 34.0522, "lon": -118.2437, "label": "A" },
    "end_point": { "lat": 34.0622, "lon": -118.2337, "label": "B" },
    "avoidance_zones": [
      { "layer_id": "ecology_sensitive", "type": "wetland" }
    ],
    "design_standard": "AASHTO",
    "design_speed_kmh": 80,
    "gradient_limit_pct": 8.0,
    "review_trigger": "gradient_exceeds_limit"
  },
  "confidence": 0.97,
  "ambiguities": []
}
```

The LLM extracts this via function-calling mode. If `confidence < 0.85` or `ambiguities` is non-empty, the agent asks the user for clarification before proceeding. No geometry is created on ambiguous input.

### Stage 2: Constraint Formulation

The agent translates extracted entities into formal constraints consumed by downstream tools:

| Constraint | Type | Value | Source |
|---|---|---|---|
| Lane count | `integer` | `2` | User prompt |
| Lane width | `float (m)` | `3.65` | AASHTO Table 3-1, 80 km/h rural |
| Shoulder width | `float (m)` | `1.8` | AASHTO Table 3-1 |
| Min curve radius | `float (m)` | `280` | AASHTO Table 3-7, 80 km/h, e_max=0.06 |
| Max superelevation | `float` | `0.06` | AASHTO rural default |
| Max gradient | `float (%)` | `8.0` | User prompt (overrides AASHTO 9% default) |
| Avoidance polygon | `GeoJSON Polygon` | Fetched from `ecology_sensitive` layer | User prompt |
| Design standard | `enum` | `AASHTO_2018` | User prompt |

### Stage 3: Tool Call Schemas

#### `create_road_alignment`

```json
{
  "name": "create_road_alignment",
  "description": "Generate a 3D road alignment (horizontal + vertical profile) between two geographic points, respecting geometric design standards, terrain, and spatial avoidance constraints. Returns a B-Rep solid of the road corridor and its centerline as a 3D polyline.",
  "parameters": {
    "type": "object",
    "required": ["start_point", "end_point", "lanes", "design_standard", "design_speed_kmh"],
    "properties": {
      "start_point": {
        "type": "object",
        "properties": {
          "lat": { "type": "number", "minimum": -90, "maximum": 90 },
          "lon": { "type": "number", "minimum": -180, "maximum": 180 },
          "elevation_m": { "type": "number", "description": "Optional. If omitted, sampled from active terrain model." }
        },
        "required": ["lat", "lon"]
      },
      "end_point": {
        "type": "object",
        "properties": {
          "lat": { "type": "number", "minimum": -90, "maximum": 90 },
          "lon": { "type": "number", "minimum": -180, "maximum": 180 },
          "elevation_m": { "type": "number" }
        },
        "required": ["lat", "lon"]
      },
      "lanes": { "type": "integer", "minimum": 1, "maximum": 8 },
      "lane_width_m": { "type": "number", "default": 3.65 },
      "shoulder_width_m": { "type": "number", "default": 1.8 },
      "design_standard": {
        "type": "string",
        "enum": ["AASHTO_2018", "AASHTO_2011", "DMRB_UK", "IRC_INDIA", "AUSTROADS"]
      },
      "design_speed_kmh": { "type": "integer", "minimum": 20, "maximum": 130 },
      "max_gradient_pct": { "type": "number", "minimum": 0, "maximum": 25, "default": 9.0 },
      "max_superelevation": { "type": "number", "minimum": 0, "maximum": 0.12, "default": 0.06 },
      "min_curve_radius_m": { "type": "number", "description": "Overrides standard-derived value if provided." },
      "avoidance_zones": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "layer_id": { "type": "string" },
            "buffer_m": { "type": "number", "default": 10.0, "description": "Clearance buffer around the zone polygon." }
          },
          "required": ["layer_id"]
        }
      },
      "terrain_model_id": { "type": "string", "description": "ID of the active DTM. Uses project default if omitted." },
      "optimization": {
        "type": "string",
        "enum": ["shortest_path", "min_earthwork", "min_gradient", "balanced"],
        "default": "balanced"
      }
    }
  },
  "returns": {
    "type": "object",
    "properties": {
      "alignment_id": { "type": "string", "format": "uuid" },
      "centerline_geojson": { "type": "object", "description": "GeoJSON LineString Z of the centerline." },
      "corridor_brep_id": { "type": "string", "description": "Handle to the B-Rep solid in the OCCT WASM kernel." },
      "horizontal_elements": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["tangent", "circular_curve", "spiral"] },
            "start_station_m": { "type": "number" },
            "end_station_m": { "type": "number" },
            "radius_m": { "type": "number" },
            "length_m": { "type": "number" }
          }
        }
      },
      "vertical_elements": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["grade", "vertical_curve"] },
            "start_station_m": { "type": "number" },
            "end_station_m": { "type": "number" },
            "gradient_pct": { "type": "number" },
            "k_value": { "type": "number" }
          }
        }
      },
      "total_length_m": { "type": "number" },
      "max_gradient_pct": { "type": "number" },
      "earthwork_estimate_m3": { "type": "object", "properties": { "cut": { "type": "number" }, "fill": { "type": "number" } } }
    }
  }
}
```

#### `analyze_terrain_gradient`

```json
{
  "name": "analyze_terrain_gradient",
  "description": "Analyze gradient along a road alignment or arbitrary polyline against a terrain model. Returns per-segment gradient values and flags segments exceeding a threshold.",
  "parameters": {
    "type": "object",
    "required": ["alignment_id"],
    "properties": {
      "alignment_id": { "type": "string", "format": "uuid" },
      "threshold_pct": { "type": "number", "minimum": 0, "maximum": 25, "default": 8.0 },
      "sample_interval_m": { "type": "number", "minimum": 1, "maximum": 100, "default": 10.0 }
    }
  },
  "returns": {
    "type": "object",
    "properties": {
      "segments": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "station_start_m": { "type": "number" },
            "station_end_m": { "type": "number" },
            "gradient_pct": { "type": "number" },
            "exceeds_threshold": { "type": "boolean" },
            "midpoint": { "type": "object", "properties": { "lat": { "type": "number" }, "lon": { "type": "number" }, "elevation_m": { "type": "number" } } }
          }
        }
      },
      "max_gradient_pct": { "type": "number" },
      "total_exceeding_length_m": { "type": "number" },
      "exceeding_segment_count": { "type": "integer" }
    }
  }
}
```

#### `check_spatial_intersection`

```json
{
  "name": "check_spatial_intersection",
  "description": "Check whether a geometry (alignment corridor, building footprint, etc.) intersects with features in a specified layer. Returns intersection regions as GeoJSON and a boolean pass/fail.",
  "parameters": {
    "type": "object",
    "required": ["geometry_id", "layer_id"],
    "properties": {
      "geometry_id": { "type": "string", "format": "uuid", "description": "ID of the geometry to test (alignment corridor, footprint, etc.)." },
      "layer_id": { "type": "string", "description": "Layer containing features to test against." },
      "buffer_m": { "type": "number", "default": 0.0, "description": "Buffer distance applied to the test geometry before intersection." },
      "intersection_type": {
        "type": "string",
        "enum": ["intersects", "contains", "within", "touches", "overlaps"],
        "default": "intersects"
      }
    }
  },
  "returns": {
    "type": "object",
    "properties": {
      "intersects": { "type": "boolean" },
      "intersection_count": { "type": "integer" },
      "intersecting_features": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "feature_id": { "type": "string" },
            "feature_name": { "type": "string" },
            "intersection_area_m2": { "type": "number" },
            "intersection_geojson": { "type": "object" }
          }
        }
      }
    }
  }
}
```

#### `flag_for_review`

```json
{
  "name": "flag_for_review",
  "description": "Create a human review flag attached to a specific geometry element, station range, or coordinate. Appears in the review panel and blocks automated approval until resolved.",
  "parameters": {
    "type": "object",
    "required": ["geometry_id", "severity", "category", "message"],
    "properties": {
      "geometry_id": { "type": "string", "format": "uuid" },
      "severity": {
        "type": "string",
        "enum": ["info", "warning", "critical"],
        "description": "info: logged only. warning: appears in review panel. critical: blocks pipeline."
      },
      "category": {
        "type": "string",
        "enum": ["gradient", "curvature", "intersection_conflict", "code_violation", "cost_overrun", "structural", "custom"]
      },
      "message": { "type": "string", "maxLength": 500 },
      "station_range": {
        "type": "object",
        "properties": {
          "start_m": { "type": "number" },
          "end_m": { "type": "number" }
        }
      },
      "location": {
        "type": "object",
        "properties": {
          "lat": { "type": "number" },
          "lon": { "type": "number" }
        }
      },
      "metadata": {
        "type": "object",
        "description": "Arbitrary key-value pairs for context (e.g., actual gradient value, design standard reference).",
        "additionalProperties": true
      }
    }
  },
  "returns": {
    "type": "object",
    "properties": {
      "flag_id": { "type": "string", "format": "uuid" },
      "created_at": { "type": "string", "format": "date-time" },
      "status": { "type": "string", "enum": ["pending", "acknowledged", "resolved", "dismissed"] }
    }
  }
}
```

### Stage 4: Full Tool Call Sequence

The LLM emits the following tool calls in order. Each call depends on the return value of the previous.

**Call 1 -- Check avoidance zone geometry exists:**

```json
{
  "tool": "check_spatial_intersection",
  "call_id": "call_001",
  "arguments": {
    "geometry_id": "00000000-0000-0000-0000-000000000000",
    "layer_id": "ecology_sensitive",
    "buffer_m": 10.0,
    "intersection_type": "intersects"
  },
  "note": "geometry_id is a placeholder; this is a pre-flight check to confirm the ecology_sensitive layer exists and has features. The agent uses a synthetic bounding-box geometry covering the A-B corridor."
}
```

**Call 2 -- Generate road alignment:**

```json
{
  "tool": "create_road_alignment",
  "call_id": "call_002",
  "arguments": {
    "start_point": { "lat": 34.0522, "lon": -118.2437 },
    "end_point": { "lat": 34.0622, "lon": -118.2337 },
    "lanes": 2,
    "lane_width_m": 3.65,
    "shoulder_width_m": 1.8,
    "design_standard": "AASHTO_2018",
    "design_speed_kmh": 80,
    "max_gradient_pct": 8.0,
    "max_superelevation": 0.06,
    "avoidance_zones": [
      { "layer_id": "ecology_sensitive", "buffer_m": 10.0 }
    ],
    "optimization": "balanced"
  }
}
```

**Call 3 -- Verify no intersection with avoidance zone (post-generation validation):**

```json
{
  "tool": "check_spatial_intersection",
  "call_id": "call_003",
  "arguments": {
    "geometry_id": "{{call_002.result.alignment_id}}",
    "layer_id": "ecology_sensitive",
    "buffer_m": 0.0,
    "intersection_type": "intersects"
  }
}
```

**Call 4 -- Analyze gradient along generated alignment:**

```json
{
  "tool": "analyze_terrain_gradient",
  "call_id": "call_004",
  "arguments": {
    "alignment_id": "{{call_002.result.alignment_id}}",
    "threshold_pct": 8.0,
    "sample_interval_m": 10.0
  }
}
```

**Call 5 -- Flag exceeding segments (emitted once per exceeding segment):**

```json
{
  "tool": "flag_for_review",
  "call_id": "call_005",
  "arguments": {
    "geometry_id": "{{call_002.result.alignment_id}}",
    "severity": "warning",
    "category": "gradient",
    "message": "Gradient of {{segment.gradient_pct}}% exceeds 8.0% limit at station {{segment.station_start_m}}m - {{segment.station_end_m}}m. AASHTO maximum for 80 km/h rural is 9%; user-specified limit is 8%. Review required.",
    "station_range": {
      "start_m": "{{segment.station_start_m}}",
      "end_m": "{{segment.station_end_m}}"
    },
    "location": {
      "lat": "{{segment.midpoint.lat}}",
      "lon": "{{segment.midpoint.lon}}"
    },
    "metadata": {
      "actual_gradient_pct": "{{segment.gradient_pct}}",
      "threshold_pct": 8.0,
      "design_standard": "AASHTO_2018",
      "design_speed_kmh": 80
    }
  }
}
```

If `call_003` returns `intersects: true`, the agent re-invokes `create_road_alignment` with a tighter avoidance buffer or an alternative optimization strategy before proceeding to gradient analysis. This retry loop has a max of 3 attempts before escalating to the human.

### Stage 5: Geometry Generation (OCCT WASM Operations)

Inside `create_road_alignment`, the WASM kernel executes:

1. **Horizontal alignment** -- `BRepBuilderAPI_MakeEdge` for tangent segments, `GC_MakeArcOfCircle` for curves, connected via `BRepBuilderAPI_MakeWire`.
2. **Vertical profile** -- Sampled onto the wire as a `Geom_BSplineCurve` with Z values from the DTM plus design grades.
3. **Cross-section sweep** -- `BRepOffsetAPI_MakePipeShell` sweeps the road cross-section (lane + shoulder profile) along the 3D wire to produce the corridor solid.
4. **Boolean subtraction** -- `BRepAlgoAPI_Cut` removes any geometry intersecting avoidance zone polygons extruded to full corridor height.
5. **Tessellation** -- `BRepMesh_IncrementalMesh` at LOD appropriate for current zoom. Mesh stored in GPU buffer via WebGPU.

### Stage 6: Result Rendering (Scene Update)

The corridor solid is added to the Three.js/WebGPU scene graph:

- **Layer**: `road_design` (auto-created if absent)
- **Material**: Semi-transparent phong with road-surface texture
- **Selectability**: Each horizontal element (tangent, curve, spiral) is a separate selectable sub-mesh
- **Metadata overlay**: Station markers every 100m, gradient labels at inflection points

The camera auto-frames to the bounding box of the new alignment with 20% padding.

### Stage 7: Agent Annotation

Every geometry element created by an agent carries:

```json
{
  "created_by": "agent:road_design_v2",
  "created_at": "2026-04-09T14:32:01Z",
  "prompt_hash": "sha256:a1b2c3...",
  "tool_calls": ["call_002"],
  "design_standard": "AASHTO_2018",
  "confidence": 0.94,
  "editable_by": ["human", "agent:road_design_v2"],
  "review_status": "pending",
  "provenance_chain": [
    { "step": "nlp_parse", "model": "claude-opus-4-6", "timestamp": "2026-04-09T14:31:58Z" },
    { "step": "alignment_gen", "kernel": "occt_wasm_7.7", "timestamp": "2026-04-09T14:32:01Z" }
  ]
}
```

### Stage 8: Human Review Flag Generation

Flags appear in the **Review Panel** (right sidebar). Each flag renders:

- A pulsing marker on the 3D geometry at the flagged station range
- A card in the review panel with: severity icon, message, station range, actual vs. threshold values
- Action buttons: **Approve** (accept gradient), **Modify** (opens vertical profile editor at that station), **Reject** (deletes alignment segment, agent re-routes)

Flags with `severity: "critical"` block the alignment from being committed to the project model until resolved.

---

## E2 -- Multi-Agent Collaboration Scenario

### Scenario

High-rise building design with four concurrent agents operating on shared geometry:

| Agent | Role | Write Scope |
|---|---|---|
| Structural Agent | Column grid, floor plates, shear walls | `structural/*` layers |
| MEP Agent | HVAC ducts, plumbing risers, electrical conduit | `mep/*` layers |
| Code Compliance Agent | Setback checks, fire egress, accessibility | Read-only; writes flags only |
| Cost Agent | Quantity takeoff, unit pricing | Read-only; writes cost annotations |

### 2.1 Message Bus Schema

```typescript
type AgentId = `agent:${string}`;
type TaskId = `task:${string}`;
type GeometryId = string; // UUID

interface AgentMessage {
  id: string;
  timestamp: string; // ISO 8601
  source: AgentId;
  target: AgentId | "broadcast" | "orchestrator";
  type: AgentMessageType;
  payload: AgentTask | AgentResult | AgentConflict | AgentHeartbeat;
  correlation_id?: string; // Links request to response
  ttl_ms: number; // Message expires after this duration; default 30000
}

type AgentMessageType =
  | "task_assign"
  | "task_accept"
  | "task_reject"
  | "task_progress"
  | "task_result"
  | "conflict_detected"
  | "conflict_resolution"
  | "heartbeat"
  | "geometry_lock_request"
  | "geometry_lock_granted"
  | "geometry_lock_denied"
  | "flag_created"
  | "agent_recall";

interface AgentTask {
  task_id: TaskId;
  type: string; // e.g., "optimize_column_grid", "route_hvac_main"
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
  assigned_to: AgentId;
  assigned_by: AgentId | "human";
  geometry_scope: GeometryScope;
  constraints: Record<string, unknown>;
  deadline_ms: number; // Max wall-clock time for this task
  depends_on: TaskId[]; // Tasks that must complete before this one starts
}

interface GeometryScope {
  layer_patterns: string[]; // Glob patterns, e.g., ["structural/columns/*"]
  bounding_box?: BoundingBox3D;
  floor_range?: { min: number; max: number }; // Floor indices
}

interface BoundingBox3D {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

interface AgentResult {
  task_id: TaskId;
  status: "completed" | "failed" | "partial";
  geometry_ids_created: GeometryId[];
  geometry_ids_modified: GeometryId[];
  geometry_ids_deleted: GeometryId[];
  metrics: Record<string, number>; // e.g., { "steel_tonnage": 342.5, "cost_usd": 1250000 }
  duration_ms: number;
  error?: string;
}

interface AgentConflict {
  conflict_id: string;
  type: "spatial_overlap" | "constraint_violation" | "resource_contention";
  agents_involved: AgentId[];
  geometry_ids: GeometryId[];
  description: string;
  proposals: ConflictProposal[];
}

interface ConflictProposal {
  proposed_by: AgentId;
  geometry_diff: GeometryDiff;
  fitness_scores: Record<string, number>;
  rationale: string;
}

interface GeometryDiff {
  before: { geometry_id: GeometryId; snapshot_hash: string };
  after: { geometry_id: GeometryId; snapshot_hash: string };
  affected_volume: BoundingBox3D;
}

interface AgentHeartbeat {
  agent_id: AgentId;
  status: "idle" | "working" | "waiting_for_lock" | "waiting_for_dependency" | "error";
  current_task?: TaskId;
  progress_pct?: number; // 0-100
  memory_usage_mb: number;
  uptime_ms: number;
}
```

### 2.2 Agent Registration and Lifecycle

```typescript
interface AgentRegistration {
  agent_id: AgentId;
  agent_type: string; // "structural", "mep", "code_compliance", "cost"
  capabilities: string[]; // Tool names this agent can invoke
  write_layers: string[]; // Layers this agent may modify (empty = read-only)
  max_concurrent_tasks: number;
  model_id: string; // LLM model backing this agent
  timeout_ms: number; // Agent is killed if unresponsive beyond this
}

type AgentLifecycleState =
  | "registered"   // Agent definition exists, not running
  | "spawning"     // WASM worker being initialized
  | "ready"        // Idle, accepting tasks
  | "working"      // Executing a task
  | "suspended"    // Paused by orchestrator (conflict resolution, resource limits)
  | "recalled"     // Ordered to stop; completing current operation then shutting down
  | "terminated";  // Dead; all locks released

interface AgentLifecycleEvent {
  agent_id: AgentId;
  from_state: AgentLifecycleState;
  to_state: AgentLifecycleState;
  reason: string;
  timestamp: string;
}
```

**Lifecycle protocol:**

1. **Spawn**: Orchestrator creates a dedicated Web Worker, loads the agent's LLM context and tool schemas, transitions to `ready`.
2. **Assign**: Orchestrator sends `task_assign` message. Agent replies `task_accept` or `task_reject` (with reason). On accept, state transitions to `working`.
3. **Monitor**: Orchestrator expects `heartbeat` every 5 seconds. Two missed heartbeats trigger `suspended` state. Five missed heartbeats trigger `terminated` with all locks force-released.
4. **Recall**: Orchestrator sends `agent_recall`. Agent has `timeout_ms / 2` to finish current atomic operation and reply with a partial result. After timeout, force-terminated.

### 2.3 Conflict Detection

Conflict detection is geometry-level, not layer-level. The system maintains an **occupancy octree** over the building volume, updated after every geometry write.

```typescript
interface OccupancyCell {
  cell_id: string;
  bounds: BoundingBox3D;
  occupants: Array<{
    geometry_id: GeometryId;
    agent_id: AgentId;
    layer: string;
    timestamp: string;
  }>;
}
```

**Detection rules:**

1. **Spatial overlap**: When agent A writes geometry that intersects any cell already occupied by agent B's geometry, a `spatial_overlap` conflict is raised. Intersection is tested via axis-aligned bounding box first (fast), then exact B-Rep intersection (OCCT `BRepAlgoAPI_Section`) for confirmed overlaps.
2. **Constraint violation**: Code Compliance Agent continuously monitors all geometry writes. If a new column placement reduces a fire egress corridor below minimum width, a `constraint_violation` conflict is raised.
3. **Resource contention**: Two agents requesting a write lock on overlapping geometry scopes simultaneously. Resolved by priority, then by timestamp.

### 2.4 Conflict Resolution Protocol

```typescript
interface ConflictResolutionRound {
  round_number: number; // Starts at 1
  conflict_id: string;
  proposals: ConflictProposal[];
  evaluation: {
    proposal_rankings: Array<{
      proposed_by: AgentId;
      score: number; // Weighted multi-objective score
      violations: string[]; // Any hard constraints violated
    }>;
  };
  outcome: "resolved" | "next_round" | "escalate_to_human";
}
```

**Protocol:**

1. **Round 1 -- Automated negotiation**: Both conflicting agents independently propose a resolution (modified geometry that avoids the overlap). Each proposal is scored against all active objectives (structural performance, cost, code compliance, MEP clearance). If one proposal dominates on all objectives, it wins automatically.
2. **Round 2 -- Priority-weighted**: If no dominant proposal, the higher-priority agent's proposal is selected, provided it violates zero hard constraints. Priority order: Structural > Code Compliance > MEP > Cost.
3. **Round 3 -- Hybrid**: Orchestrator attempts to merge proposals (e.g., move the column 200mm east AND reroute the duct 150mm south). Merger tested for spatial validity.
4. **Escalation**: If no resolution after 3 rounds, the conflict is escalated to a human. Both proposals are presented as a **Conflict Card** in the UI. All affected geometry is locked until the human decides.

Max wall-clock time per round: 10 seconds. Total conflict resolution budget: 30 seconds before mandatory escalation.

### 2.5 UI for Surfacing Agent Activity

#### Agent Activity Feed

A vertical timeline in the left panel showing real-time agent actions:

```typescript
interface ActivityFeedEntry {
  id: string;
  timestamp: string;
  agent_id: AgentId;
  agent_type: string;
  action: string; // Human-readable, e.g., "Placed column C-14 at grid intersection D/7"
  geometry_ids: GeometryId[];
  task_id: TaskId;
  severity: "info" | "warning" | "error";
  expandable_detail?: string; // Full tool call JSON, shown on click
}
```

Feed entries are color-coded by agent type. Clicking an entry flies the camera to the affected geometry and highlights it.

#### Conflict Cards

```typescript
interface ConflictCard {
  conflict_id: string;
  title: string; // e.g., "HVAC duct intersects column C-14"
  agents: Array<{ agent_id: AgentId; agent_type: string; proposal_summary: string }>;
  affected_geometry_screenshot: string; // Base64 PNG of the clash region
  proposals: Array<{
    agent_id: AgentId;
    description: string;
    impact_summary: Record<string, string>; // e.g., { "cost": "+$2,400", "structural": "no change" }
    preview_geometry_id: GeometryId; // Rendered as ghost geometry in the viewport
  }>;
  resolution_deadline: string; // ISO 8601
  status: "open" | "resolved" | "expired";
}
```

Each proposal renders as translucent ghost geometry in the viewport. The human clicks one to accept, or drags to modify.

#### Approval Workflow

```typescript
interface ApprovalRequest {
  id: string;
  type: "geometry_commit" | "flag_resolution" | "conflict_resolution" | "cost_threshold";
  agent_id: AgentId;
  summary: string;
  geometry_ids: GeometryId[];
  created_at: string;
  expires_at: string;
  actions: Array<{
    label: string; // "Approve", "Reject", "Modify", "Defer"
    action_id: string;
    requires_comment: boolean;
  }>;
  status: "pending" | "approved" | "rejected" | "modified" | "expired";
}
```

Approvals queue in the top bar as a badge count. Critical approvals trigger a toast notification. Expired approvals auto-reject and notify the originating agent.

#### Agent Dashboard

A modal overlay showing:

| Column | Source |
|---|---|
| Agent name + type | `AgentRegistration` |
| State (color dot) | `AgentLifecycleState` |
| Current task | `AgentHeartbeat.current_task` |
| Progress bar | `AgentHeartbeat.progress_pct` |
| Geometry created (count) | Accumulated from `AgentResult` |
| Conflicts (active/resolved) | `AgentConflict` aggregation |
| CPU/Memory | `AgentHeartbeat.memory_usage_mb` |
| Uptime | `AgentHeartbeat.uptime_ms` |

---

## E3 -- Generative Design Loop

### Input Interfaces

```typescript
interface DesignConstraints {
  budget_usd: number; // Hard cap. e.g., 50_000_000
  site_area_m2: number; // e.g., 10_000
  max_height_m: number; // Zoning limit
  max_floors: number;
  min_floor_area_m2: number; // Per floor
  program_requirements: ProgramRequirement[];
  structural_system: "steel_frame" | "concrete_frame" | "hybrid" | "timber" | "any";
  seismic_zone: "0" | "1" | "2A" | "2B" | "3" | "4";
  wind_speed_ms: number; // Basic wind speed for structural design
  fire_rating_hours: number;
  parking_spaces: number;
  accessibility_standard: "ADA" | "DDA" | "EN_17210" | "local";
}

interface ProgramRequirement {
  space_type: string; // e.g., "office_open_plan", "retail", "lobby", "parking", "mechanical"
  area_m2: number; // Required area for this program
  floor_preference?: "ground" | "upper" | "below_grade" | "any";
  adjacency_requirements?: string[]; // Space types this must be adjacent to
  daylight_required: boolean;
}

interface DesignObjectives {
  objectives: DesignObjective[];
  pareto_preference?: "spread" | "knee_point"; // Prefer diverse frontier or focus near balanced point
}

interface DesignObjective {
  id: string;
  name: string; // e.g., "construction_cost", "daylight_factor", "steel_tonnage"
  direction: "minimize" | "maximize";
  weight: number; // Relative importance; sums need not equal 1 (normalized internally)
  unit: string; // "USD", "percentage", "tonnes"
  soft_target?: number; // Desirable but not hard-constrained threshold
}

interface DesignAnchors {
  site_boundary: GeoJSONPolygon; // Fixed site boundary polygon
  entry_points: Array<{
    location: { lat: number; lon: number };
    type: "vehicular" | "pedestrian" | "service";
    required: boolean;
  }>;
  fixed_elements: Array<{
    geometry_id: GeometryId;
    description: string; // e.g., "existing heritage facade to retain"
    immutable: boolean; // Cannot be moved or modified by the optimizer
  }>;
  setback_rules: Array<{
    edge: "north" | "south" | "east" | "west" | "all";
    distance_m: number;
  }>;
  terrain_model_id: string;
}

type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};
```

### Generative Algorithm Architecture

```
                     +------------------+
                     |  Human Inputs    |
                     |  Constraints +   |
                     |  Objectives +    |
                     |  Anchors         |
                     +--------+---------+
                              |
                              v
                   +----------+----------+
                   | LLM Seed Generator  |
                   | (Claude Opus)       |
                   | Produces 20 initial |
                   | parametric configs  |
                   +----------+----------+
                              |
                              v
                   +----------+----------+
                   | NSGA-II Engine      |
                   | Population: 100     |
                   | Generations: 200    |
                   | Crossover: SBX      |
                   | Mutation: PM        |
                   +----------+----------+
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
   +------+------+    +------+------+    +-------+-----+
   | Structural   |    | Daylight    |    | Cost        |
   | FEA Solver   |    | Simulation  |    | Estimator   |
   | (WASM)       |    | (Ray-trace) |    | (Unit-rate) |
   +--------------+    +-------------+    +-------------+
          |                   |                   |
          +-------------------+-------------------+
                              |
                              v
                   +----------+----------+
                   | Shape Grammar Rules |
                   | (Massing validity,  |
                   |  circulation logic) |
                   +----------+----------+
                              |
                              v
                   +----------+----------+
                   | Pareto Front        |
                   | Top N variants      |
                   | presented to human  |
                   +---------------------+
```

**NSGA-II parameters (binding):**

- Population size: 100
- Max generations: 200
- Crossover: Simulated Binary Crossover (SBX), distribution index = 20
- Mutation: Polynomial Mutation (PM), distribution index = 20
- Selection: Binary tournament
- Constraint handling: penalty-based with adaptive penalty coefficients
- Termination: 200 generations or hypervolume convergence (delta < 0.1% over 10 generations)

### Variant Interfaces

```typescript
interface GenerativeVariant {
  variant_id: string; // UUID
  generation: number; // NSGA-II generation this was produced in
  parent_ids: string[]; // Variant IDs of parents (empty for seed population)

  // Parametric genome -- the decision variables NSGA-II optimizes
  genome: {
    floor_count: number;
    floor_to_floor_height_m: number;
    footprint_vertices: Array<{ x: number; y: number }>; // 2D polygon in site-local coords
    column_grid_spacing_x_m: number;
    column_grid_spacing_y_m: number;
    core_position: { x: number; y: number }; // Structural/circulation core centroid
    core_dimensions: { width_m: number; depth_m: number };
    facade_type: "curtain_wall" | "punched_window" | "double_skin" | "opaque";
    window_to_wall_ratio: number; // 0.0 - 1.0
    structural_system: "steel_frame" | "concrete_frame" | "hybrid";
    program_allocation: Array<{
      space_type: string;
      floor_indices: number[];
      area_pct: number; // Percentage of floor area allocated
    }>;
  };

  // Fitness scores -- one per objective
  fitness: Record<string, number>; // Keyed by DesignObjective.id

  // Derived metrics (computed, not optimized directly)
  metrics: {
    total_floor_area_m2: number;
    gross_to_net_ratio: number;
    estimated_cost_usd: number;
    steel_tonnage: number;
    concrete_volume_m3: number;
    avg_daylight_factor_pct: number;
    energy_use_intensity_kwh_m2_yr: number;
    parking_spaces_achieved: number;
    code_violations: string[]; // Empty if compliant
  };

  // Geometry handle for 3D preview
  geometry_id: GeometryId;
  thumbnail_url: string; // 256x256 rendered preview

  // NSGA-II metadata
  crowding_distance: number;
  rank: number; // Pareto front rank (1 = first front)
  feasible: boolean; // All hard constraints satisfied
}
```

### Variant Comparison View

```typescript
interface VariantComparisonView {
  session_id: string;
  variants: GenerativeVariant[]; // Typically 4-8 selected from the Pareto front
  comparison_mode: "side_by_side" | "overlay" | "table" | "radar_chart";

  // Parallel coordinates plot data
  parallel_coordinates: {
    axes: Array<{
      objective_id: string;
      label: string;
      unit: string;
      direction: "minimize" | "maximize";
      range: { min: number; max: number };
    }>;
    lines: Array<{
      variant_id: string;
      values: number[]; // One per axis, normalized 0-1
      highlighted: boolean;
    }>;
  };

  // Radar chart for quick multi-objective comparison
  radar_chart: {
    axes: string[]; // Objective names
    series: Array<{
      variant_id: string;
      label: string;
      values: number[]; // Normalized 0-1 (higher = better for all)
    }>;
  };

  // Visual diff between two selected variants
  diff_view?: {
    variant_a: string;
    variant_b: string;
    geometry_diff: GeometryDiff;
    metric_deltas: Record<string, { a: number; b: number; delta: number; unit: string }>;
  };
}
```

### Selection Feedback Loop

```typescript
interface SelectionFeedback {
  session_id: string;
  feedback_type: "select_preferred" | "reject_variant" | "adjust_weight" | "add_constraint" | "pin_parameter";

  // Human selects one or more preferred variants
  selected_variant_ids?: string[];

  // Human explicitly rejects variants (excluded from future breeding)
  rejected_variant_ids?: string[];

  // Human adjusts objective weights mid-run
  weight_adjustments?: Array<{
    objective_id: string;
    new_weight: number;
  }>;

  // Human adds a new hard constraint mid-run
  new_constraints?: Array<{
    parameter: string; // Genome key, e.g., "floor_count"
    operator: "eq" | "lt" | "gt" | "lte" | "gte" | "in_range";
    value: number | [number, number];
  }>;

  // Human pins a parameter to a specific value (removes it from optimization)
  pinned_parameters?: Array<{
    parameter: string;
    value: number | string;
  }>;
}
```

**Feedback integration into NSGA-II:**

1. **`select_preferred`**: Selected variants are injected as elite individuals in the next generation with rank 0. Their genome neighborhoods are over-sampled (mutation centered on their parameter values with reduced variance).
2. **`reject_variant`**: Rejected variants and their children are removed from the population. A rejection penalty is applied to similar genomes (Euclidean distance in normalized genome space < 0.1).
3. **`adjust_weight`**: Objective weights are updated in the fitness function. The Pareto front is re-ranked immediately.
4. **`add_constraint`**: New constraint added to the penalty function. Infeasible variants in the current population are penalized. If > 50% become infeasible, the LLM seed generator produces 20 replacement individuals satisfying the new constraint.
5. **`pin_parameter`**: Parameter removed from the genome. All individuals have that parameter set to the pinned value. Effectively reduces the search space dimensionality.

---

## E4 -- Digital Twin Live Update UX

### 4.1 Data Pipeline

```
Drone (2 Hz LiDAR)
      |
      | WebSocket (binary protobuf, ~2MB/frame)
      v
[rosbridge_suite]  <-- ROS 2 topic: /drone/pointcloud
      |
      | WebSocket to browser (roslib.js)
      v
[WASM Decoder]  -- Decodes protobuf PointCloud2 to Float32Array
      |
      v
[Octree Builder]  -- Inserts points into persistent octree (potree-like)
      |
      v
[Octree Diff Engine]  -- Compares new scan against BIM reference octree
      |
      v
[Deviation Analyzer]  -- Classifies per-element deviations
      |
      v
[Agent Classifier]  -- LLM-backed; categorizes deviations
      |
      v
[UI Renderer]  -- Updates BIM element colors, fires notifications
```

### 4.2 Latency Budget

| Stage | Operation | Budget (ms) | Notes |
|---|---|---|---|
| 1 | Drone to rosbridge | 50 | Network latency; assumed site WiFi |
| 2 | rosbridge to browser WS | 30 | Binary protobuf, no JSON overhead |
| 3 | WASM protobuf decode | 15 | ~500K points/frame, pre-allocated buffers |
| 4 | Octree insertion | 40 | Incremental update, not full rebuild |
| 5 | Octree diff | 80 | Compare against BIM reference; spatial hashing |
| 6 | Deviation analysis | 50 | Per-element distance computation |
| 7 | Agent classification | 200 | LLM inference (batched, cached for repeat patterns) |
| 8 | UI render update | 35 | Color swap + notification; no geometry rebuild |
| **Total** | | **500** | **Target: under 500ms end-to-end** |

Stage 7 is the bottleneck. Mitigation: the agent classifier runs one frame behind (pipelined). The UI shows deviation magnitude immediately (stage 6 output) with a "classifying..." badge. Classification badge resolves 200ms later. For critical deviations (> 50mm), the classifier is invoked synchronously and the pipeline stalls.

### 4.3 UI Update Strategy

#### BIM Element Color Coding

```typescript
interface DeviationColorMap {
  within_tolerance: string;   // "#22c55e" -- green, deviation < threshold_mm
  warning: string;            // "#f59e0b" -- amber, threshold_mm <= deviation < critical_mm
  critical: string;           // "#ef4444" -- red, deviation >= critical_mm
  not_scanned: string;        // "#6b7280" -- gray, no scan data for this element
  scanning_in_progress: string; // "#3b82f6" -- blue pulse, currently being scanned
}

// Default thresholds (configurable per project)
interface DeviationThresholds {
  tolerance_mm: number;  // Default: 25
  warning_mm: number;    // Default: 25 (same as tolerance; warning = any deviation beyond tolerance)
  critical_mm: number;   // Default: 50
}
```

When a BIM element's deviation state changes, the renderer updates its material in place (no scene graph rebuild). The element's outline weight increases proportional to deviation magnitude.

#### Notifications

| Deviation Class | UI Action |
|---|---|
| Within tolerance | Silent. Green color applied. Counter incremented in dashboard. |
| Warning | Amber color. Entry added to deviation feed (left panel). Soft chime. |
| Critical | Red color + pulsing outline. Toast notification with element ID and deviation value. Audible alert. Auto-creates a `flag_for_review` with `severity: "critical"`. |

### 4.4 Engineer Actions

```typescript
type DeviationAction =
  | { type: "acknowledge"; comment?: string }
  | { type: "delegate_to_agent"; agent_type: string; instruction: string }
  | { type: "escalate"; escalation_level: "project_manager" | "structural_engineer" | "site_supervisor"; message: string }
  | { type: "override_tolerance"; new_tolerance_mm: number; justification: string }
  | { type: "create_rfi"; subject: string; body: string; assigned_to: string }
  | { type: "dismiss"; reason: "scan_artifact" | "temporary_condition" | "already_resolved" | "other"; comment?: string };
```

- **Acknowledge**: Deviation is noted. Status changes to `acknowledged`. Remains visible but stops generating repeat notifications.
- **Delegate to agent**: Spawns or instructs an existing agent. Example: "Structural Agent, assess whether this 35mm column deviation affects load path. Report within 60 seconds."
- **Escalate**: Sends notification to the specified role via the project communication channel. Creates a time-stamped audit log entry.
- **Override tolerance**: Changes the threshold for this specific element. Requires justification (logged). Useful for elements where construction sequence means temporary deviation is expected.
- **Create RFI**: Generates a Request for Information linked to the deviation, with scan snapshots and BIM model comparison attached.
- **Dismiss**: Removes the deviation from active monitoring. Audit-logged with reason.

### 4.5 Deviation Report Schema

```typescript
interface DeviationReport {
  report_id: string; // UUID
  project_id: string;
  scan_session_id: string;
  generated_at: string; // ISO 8601
  scan_timestamp: string; // When the drone scan was captured
  drone_id: string;

  summary: {
    total_elements_scanned: number;
    within_tolerance: number;
    warning: number;
    critical: number;
    not_scanned: number;
    scan_coverage_pct: number; // Percentage of BIM elements with scan data
  };

  deviations: DeviationEntry[];

  scan_metadata: {
    point_count: number;
    point_density_pts_per_m2: number;
    scan_duration_seconds: number;
    coordinate_system: string; // e.g., "EPSG:4326" or project-local
    registration_rmse_mm: number; // Scan-to-BIM registration accuracy
  };

  comparison_baseline: {
    bim_model_version: string; // Commit hash or version ID of the BIM model used as reference
    last_scan_session_id?: string; // Previous scan for delta-over-delta analysis
  };
}

interface DeviationEntry {
  element_id: string; // BIM element IFC GUID
  element_type: string; // e.g., "IfcColumn", "IfcBeam", "IfcSlab"
  element_name: string; // Human-readable, e.g., "Column C-14, Level 3"

  classification: "within_tolerance" | "warning" | "critical";

  deviation: {
    max_mm: number; // Maximum point-to-surface distance
    mean_mm: number; // Average deviation
    std_dev_mm: number;
    direction: {
      primary_axis: "x" | "y" | "z"; // Axis of largest deviation component
      vector: { x: number; y: number; z: number }; // Normalized deviation direction
    };
  };

  location: {
    centroid: { x: number; y: number; z: number }; // In project coordinates
    floor: number;
    grid_reference?: string; // e.g., "D/7"
  };

  scan_points: {
    count: number;
    coverage_pct: number; // How much of the element surface was scanned
  };

  agent_assessment?: {
    agent_id: AgentId;
    assessed_at: string;
    cause_hypothesis: string; // e.g., "Formwork shifted during pour"
    structural_impact: "none" | "minor" | "major" | "unknown";
    recommended_action: string;
    confidence: number; // 0.0 - 1.0
  };

  history: Array<{
    scan_session_id: string;
    timestamp: string;
    deviation_max_mm: number;
    classification: string;
  }>;

  actions_taken: Array<{
    action: DeviationAction;
    taken_by: string; // User ID or AgentId
    timestamp: string;
  }>;

  flag_id?: string; // If a review flag was auto-created
}
```

### End-to-End Timing Example

```
T+0ms     Drone publishes PointCloud2 on /drone/pointcloud
T+50ms    rosbridge forwards to browser WebSocket
T+80ms    WASM decoder outputs Float32Array (487,231 points)
T+95ms    Octree incremental insert complete
T+175ms   Octree diff identifies 14 BIM elements with new scan data
T+225ms   Deviation analyzer: 11 within tolerance, 2 warning, 1 critical
T+260ms   UI: 11 elements turn green, 2 turn amber, 1 turns red + pulse
T+260ms   Toast: "CRITICAL: Column C-14, Level 3 -- 62mm deviation detected"
T+260ms   flag_for_review auto-created for Column C-14
T+460ms   Agent classifier confirms: "Probable formwork shift. Structural impact: minor. Recommend survey verification."
T+460ms   Classification badge on Column C-14 resolves from "classifying..." to "formwork shift (minor)"
```

Total perceived latency for the engineer: 260ms to see the problem. 460ms to see the AI assessment. Both well under the 500ms budget.
