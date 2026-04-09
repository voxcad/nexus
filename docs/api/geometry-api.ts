/**
 * NEXUS — Headless Geometry API Type Definitions
 *
 * REST/GraphQL API wrapping the WASM geometry kernels (Layer 4).
 * Every geometric operation is callable by AI agents and external systems
 * without touching the GUI.
 *
 * Base URL: /api/v1/geometry
 * Protocol: REST (JSON) + WebSocket (FlatBuffers for streaming)
 * Auth: Bearer token with domain-scoped permissions
 */

// ---------------------------------------------------------------------------
// API Response Envelope
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
  /** Request duration in ms (WASM kernel time, not network) */
  kernelTimeMs: number;
  /** Entity IDs created or modified */
  affectedEntities: string[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Entity CRUD
// ---------------------------------------------------------------------------

/** POST /api/v1/geometry/entities */
export interface CreateEntityRequest {
  entityType: string;
  domain: string;
  geometry: GeometryInput;
  coordinateRef: CoordinateRefInput;
  propertySets?: PropertySetInput[];
  layers?: string[];
  tags?: string[];
}

/** GET /api/v1/geometry/entities/:id */
export interface GetEntityResponse {
  entity: SpatialEntitySummary;
  /** Geometry available as: 'brep', 'mesh', 'glb_url', 'geojson' */
  availableFormats: string[];
}

/** PATCH /api/v1/geometry/entities/:id */
export interface UpdateEntityRequest {
  geometry?: GeometryInput;
  propertySets?: PropertySetInput[];
  layers?: string[];
  tags?: string[];
}

/** DELETE /api/v1/geometry/entities/:id */
export interface DeleteEntityResponse {
  deletedId: string;
  /** Cascade-deleted dependents */
  cascadeDeleted: string[];
}

// ---------------------------------------------------------------------------
// Geometry Input Types
// ---------------------------------------------------------------------------

export type GeometryInput =
  | { type: 'wkt'; wkt: string; crs?: string }
  | { type: 'geojson'; geojson: GeoJSON.Geometry }
  | { type: 'brep_step'; step: string }
  | { type: 'mesh_glb'; glb: ArrayBuffer }
  | { type: 'parametric'; schema: string; parameters: Record<string, unknown> }
  | { type: 'points'; coordinates: number[][]; crs?: string };

export interface CoordinateRefInput {
  crs: string;
  localOrigin?: [number, number, number];
  verticalDatum?: string;
}

export interface PropertySetInput {
  name: string;
  properties: Record<string, { value: unknown; unit?: string }>;
}

// ---------------------------------------------------------------------------
// B-Rep Operations (OpenCASCADE WASM)
// ---------------------------------------------------------------------------

/** POST /api/v1/geometry/brep/boolean */
export interface BRepBooleanRequest {
  operation: 'union' | 'intersection' | 'difference';
  entityA: string; // entity ID
  entityB: string; // entity ID
  /** Fuzzy tolerance for near-coincident faces (meters) */
  tolerance?: number;
}

export interface BRepBooleanResponse {
  resultEntityId: string;
  /** Topological validity of result */
  isValid: boolean;
  /** Number of faces/edges/vertices in result */
  topology: { faces: number; edges: number; vertices: number };
  kernelTimeMs: number;
}

/** POST /api/v1/geometry/brep/fillet */
export interface BRepFilletRequest {
  entityId: string;
  edgeIndices: number[];
  radius: number; // meters
}

/** POST /api/v1/geometry/brep/extrude */
export interface BRepExtrudeRequest {
  profileEntityId: string; // 2D wire/face entity
  direction: [number, number, number];
  distance: number; // meters
}

/** POST /api/v1/geometry/brep/sweep */
export interface BRepSweepRequest {
  profileEntityId: string; // 2D cross-section
  pathEntityId: string; // 3D curve/alignment
  /** Maintain profile orientation relative to path tangent */
  maintainOrientation: boolean;
}

// ---------------------------------------------------------------------------
// Spatial Query Operations
// ---------------------------------------------------------------------------

/** POST /api/v1/geometry/query/spatial */
export interface SpatialQueryRequest {
  /** Spatial predicate */
  predicate: 'intersects' | 'contains' | 'within' | 'crosses' | 'overlaps' | 'touches' | 'nearest';
  /** Query geometry (WKT, GeoJSON, or entity ID reference) */
  geometry?: GeometryInput;
  entityId?: string;
  /** Filter by layer */
  layers?: string[];
  /** Filter by entity type */
  entityTypes?: string[];
  /** Buffer distance (meters) */
  buffer?: number;
  /** For 'nearest': max results */
  limit?: number;
  /** For 'nearest': max search distance (meters) */
  maxDistance?: number;
}

export interface SpatialQueryResponse {
  matches: Array<{
    entityId: string;
    entityType: string;
    distance?: number; // for 'nearest'
    intersectionArea?: number; // m²
    intersectionLength?: number; // m
  }>;
  totalMatches: number;
  queryTimeMs: number;
}

/** POST /api/v1/geometry/query/within-bbox */
export interface BBoxQueryRequest {
  minX: number;
  minY: number;
  minZ?: number;
  maxX: number;
  maxY: number;
  maxZ?: number;
  crs: string;
  layers?: string[];
  entityTypes?: string[];
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Coordinate Transformation
// ---------------------------------------------------------------------------

/** POST /api/v1/geometry/transform/reproject */
export interface ReprojectRequest {
  entityIds?: string[];
  coordinates?: number[][]; // [x, y, z?][]
  sourceCrs: string;
  targetCrs: string;
}

export interface ReprojectResponse {
  transformedCoordinates?: number[][];
  transformedEntityIds?: string[];
  /** Max positional error estimate (meters) */
  estimatedErrorM: number;
}

// ---------------------------------------------------------------------------
// Measurement / Analysis
// ---------------------------------------------------------------------------

/** POST /api/v1/geometry/measure/distance */
export interface MeasureDistanceRequest {
  entityA: string;
  entityB: string;
  /** 'euclidean' (3D straight), 'geodesic' (surface), 'projected' (2D) */
  method: 'euclidean' | 'geodesic' | 'projected';
}

export interface MeasureDistanceResponse {
  distance: number; // meters
  closestPointA: [number, number, number];
  closestPointB: [number, number, number];
}

/** POST /api/v1/geometry/measure/area */
export interface MeasureAreaRequest {
  entityId: string;
  /** For 3D: project to horizontal plane or measure surface area? */
  projection: 'horizontal' | 'surface';
}

/** POST /api/v1/geometry/measure/volume */
export interface MeasureVolumeRequest {
  entityId: string;
  /** For cut/fill: reference surface entity ID */
  referenceSurfaceId?: string;
}

export interface MeasureVolumeResponse {
  volume: number; // m³
  cutVolume?: number; // m³ (if reference surface provided)
  fillVolume?: number; // m³
  netVolume?: number; // m³ (cut - fill)
}

// ---------------------------------------------------------------------------
// Streaming (WebSocket Protocol)
// ---------------------------------------------------------------------------

/**
 * WebSocket endpoint: ws://host/api/v1/geometry/stream
 *
 * Messages use FlatBuffers encoding (EntityBatch schema from uses.fbs).
 * Text-mode fallback uses JSON with the following envelope:
 */

export interface StreamMessage {
  type: 'entity_created' | 'entity_updated' | 'entity_deleted' | 'batch';
  sequenceNumber: number;
  timestamp: number;
  source: string; // agent_id, user_id, or 'sync'
  payload: unknown; // SpatialEntity | EntityId | EntityBatch
}

export interface StreamSubscription {
  /** Subscribe to changes in specific layers */
  layers?: string[];
  /** Subscribe to changes of specific entity types */
  entityTypes?: string[];
  /** Subscribe to changes within a bounding box */
  bbox?: { minX: number; minY: number; maxX: number; maxY: number; crs: string };
  /** Binary (FlatBuffers) or JSON encoding */
  encoding: 'flatbuffers' | 'json';
}

// ---------------------------------------------------------------------------
// Permissions Model
// ---------------------------------------------------------------------------

export interface AgentPermission {
  agentId: string;
  /** Domains this agent can read */
  readDomains: string[];
  /** Domains this agent can write */
  writeDomains: string[];
  /** Layers this agent can modify */
  writeLayers: string[];
  /** Maximum entities this agent can create per request */
  maxEntitiesPerRequest: number;
  /** Whether agent can delete entities */
  canDelete: boolean;
  /** Whether agent proposals require human approval before commit */
  requiresApproval: boolean;
}

// ---------------------------------------------------------------------------
// Batch Operations
// ---------------------------------------------------------------------------

/** POST /api/v1/geometry/batch */
export interface BatchOperationRequest {
  operations: Array<{
    method: 'create' | 'update' | 'delete' | 'boolean' | 'transform';
    params: unknown;
  }>;
  /** Atomic: all succeed or all fail */
  atomic: boolean;
}

export interface BatchOperationResponse {
  results: Array<{
    index: number;
    ok: boolean;
    entityId?: string;
    error?: ApiError;
  }>;
  totalKernelTimeMs: number;
}

// ---------------------------------------------------------------------------
// Summary Entity Type (for list/query responses — excludes heavy geometry)
// ---------------------------------------------------------------------------

export interface SpatialEntitySummary {
  id: string;
  projectId: string;
  entityType: string;
  domain: string;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  layers: string[];
  tags: string[];
  propertyCount: number;
  annotationCount: number;
  version: number;
  phase: string;
  createdBy: string;
  createdAt: number;
  approvalStatus: string;
}
