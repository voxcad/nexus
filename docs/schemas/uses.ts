/**
 * NEXUS — Universal Spatial Entity Schema (USES)
 *
 * Canonical TypeScript interfaces for cross-domain spatial entity representation.
 * All domain kernels (BIM, GIS, CAD, Civil, Survey, Point Cloud) produce and
 * consume entities conforming to this schema. AI agents reason over this
 * unified representation.
 */

// ---------------------------------------------------------------------------
// Core Identifiers
// ---------------------------------------------------------------------------

/** UUID v7 (time-sortable) for all entity IDs */
export type EntityId = string & { readonly __brand: 'EntityId' };
export type AgentId = string & { readonly __brand: 'AgentId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type ProjectId = string & { readonly __brand: 'ProjectId' };

// ---------------------------------------------------------------------------
// Entity Type Taxonomy
// ---------------------------------------------------------------------------

export enum EntityDomain {
  BIM = 'bim',
  GIS = 'gis',
  CAD = 'cad',
  Civil = 'civil',
  Survey = 'survey',
  PointCloud = 'pointcloud',
  Construction = 'construction',
}

export enum EntityType {
  // BIM
  Wall = 'bim.wall',
  Slab = 'bim.slab',
  Column = 'bim.column',
  Beam = 'bim.beam',
  Door = 'bim.door',
  Window = 'bim.window',
  Roof = 'bim.roof',
  Stair = 'bim.stair',
  Space = 'bim.space',
  MEPSegment = 'bim.mep_segment',
  MEPFitting = 'bim.mep_fitting',

  // GIS
  Parcel = 'gis.parcel',
  Building2D = 'gis.building_2d',
  Road2D = 'gis.road_2d',
  Waterway = 'gis.waterway',
  LandUseZone = 'gis.land_use_zone',
  Contour = 'gis.contour',
  RasterCell = 'gis.raster_cell',

  // CAD
  Line = 'cad.line',
  Arc = 'cad.arc',
  Polyline = 'cad.polyline',
  Circle = 'cad.circle',
  Spline = 'cad.spline',
  Solid3D = 'cad.solid_3d',
  Surface = 'cad.surface',
  Block = 'cad.block',
  Dimension = 'cad.dimension',
  Text = 'cad.text',

  // Civil
  Alignment = 'civil.alignment',
  Profile = 'civil.profile',
  Corridor = 'civil.corridor',
  GradingSurface = 'civil.grading_surface',
  Pipe = 'civil.pipe',
  Structure = 'civil.structure',
  Catchment = 'civil.catchment',

  // Survey
  SurveyPoint = 'survey.point',
  Traverse = 'survey.traverse',
  ControlNetwork = 'survey.control_network',
  Boundary = 'survey.boundary',

  // Point Cloud
  PointCloudRegion = 'pointcloud.region',
  ClassifiedSegment = 'pointcloud.classified_segment',

  // Construction
  ActivityZone = 'construction.activity_zone',
  TemporaryStructure = 'construction.temporary_structure',
  ProgressMarker = 'construction.progress_marker',
}

// ---------------------------------------------------------------------------
// Geometry Representation (multi-rep: an entity can have B-Rep + mesh + parametric)
// ---------------------------------------------------------------------------

export interface BRepReference {
  type: 'brep';
  /** Serialized OpenCASCADE BREP string or binary offset */
  kernelFormat: 'occt_brep' | 'step' | 'iges';
  dataRef: string; // OPFS path or inline base64
  boundingBox: AABB;
}

export interface MeshReference {
  type: 'mesh';
  format: 'glb' | 'indexed_buffer';
  vertexCount: number;
  triangleCount: number;
  dataRef: string;
  lod: number; // 0 = highest detail
  boundingBox: AABB;
}

export interface PointCloudReference {
  type: 'pointcloud';
  format: 'copc' | 'laz' | 'las';
  pointCount: number;
  dataRef: string;
  octreeDepth: number;
  boundingBox: AABB;
  classifications: number[]; // ASPRS codes present
}

export interface ParametricDefinition {
  type: 'parametric';
  /** Domain-specific parametric representation */
  schema: string; // e.g., 'aashto_alignment', 'ifc_wall', 'cogo_traverse'
  parameters: Record<string, number | string | boolean | number[]>;
  constraints: ParametricConstraint[];
}

export interface ParametricConstraint {
  name: string;
  type: 'equality' | 'inequality' | 'range' | 'reference';
  expression: string;
  source: string; // e.g., 'AASHTO 2018 Table 3-7'
}

export type GeometryRepresentation =
  | BRepReference
  | MeshReference
  | PointCloudReference
  | ParametricDefinition;

export interface AABB {
  min: [number, number, number]; // float64
  max: [number, number, number]; // float64
}

// ---------------------------------------------------------------------------
// Coordinate Reference
// ---------------------------------------------------------------------------

export interface CoordinateReference {
  /** EPSG code or WKT2 string */
  crs: string;
  /** 4x4 column-major affine transform from local to CRS */
  localToCrs: Float64Array; // length 16
  /** Local origin offset for floating-origin rendering */
  floatingOrigin: [number, number, number];
  /** Vertical datum (e.g., 'EGM2008', 'NAVD88') */
  verticalDatum?: string;
  /** Geoid separation at this location (meters) */
  geoidSeparation?: number;
}

// ---------------------------------------------------------------------------
// Property System (domain-agnostic key-value with provenance)
// ---------------------------------------------------------------------------

export interface PropertySet {
  /** Matches IFC Pset naming, GIS feature class, or custom */
  name: string;
  source: PropertySource;
  properties: Record<string, PropertyValue>;
}

export interface PropertyValue {
  value: string | number | boolean | number[] | string[];
  unit?: string; // SI unit string (e.g., 'm', 'kg', 'Pa', 'm²')
  dataType: 'string' | 'real' | 'integer' | 'boolean' | 'array';
  confidence?: number; // 0..1, for AI-inferred properties
  provenance?: string; // which agent/parser set this
}

export type PropertySource =
  | { type: 'ifc_pset'; psetName: string; ifcClass: string }
  | { type: 'gis_attribute'; featureClass: string; fieldName: string }
  | { type: 'las_classification'; code: number; description: string }
  | { type: 'agent_inferred'; agentId: AgentId; confidence: number }
  | { type: 'user_defined'; userId: UserId }
  | { type: 'standard'; standardRef: string }; // e.g., 'AASHTO 2018 §3.4'

// ---------------------------------------------------------------------------
// AI Annotations
// ---------------------------------------------------------------------------

export interface AIAnnotation {
  agentId: AgentId;
  timestamp: number; // Unix ms
  annotationType:
    | 'classification'
    | 'compliance_check'
    | 'cost_estimate'
    | 'clash_detection'
    | 'design_suggestion'
    | 'deviation_alert'
    | 'risk_flag';
  label: string;
  confidence: number; // 0..1
  reasoning: string; // human-readable explanation
  toolCalls?: string[]; // IDs of tool calls that produced this
  relatedEntities?: EntityId[];
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded';
}

// ---------------------------------------------------------------------------
// Lineage (provenance chain)
// ---------------------------------------------------------------------------

export interface LineageRecord {
  createdBy: AgentId | UserId;
  createdAt: number; // Unix ms
  sourceFormat?: string; // e.g., 'IFC 4', 'DXF R2018', 'LAS 1.4'
  sourceFile?: string; // original filename
  transformationChain: TransformationStep[];
  parentEntities?: EntityId[]; // entities this was derived from
  approvalStatus: 'draft' | 'proposed' | 'approved' | 'archived';
  approvedBy?: UserId;
  approvedAt?: number;
}

export interface TransformationStep {
  operation: string; // e.g., 'ifc_parse', 'crs_reproject', 'boolean_union'
  tool: string; // e.g., 'web-ifc 0.0.57', 'PROJ WASM 9.4'
  inputHash: string; // SHA-256 of input
  outputHash: string; // SHA-256 of output
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Temporal State (Digital Twin versioning)
// ---------------------------------------------------------------------------

export interface TemporalState {
  version: number; // monotonic within entity
  validFrom: number; // Unix ms — when this state became reality
  validTo?: number; // Unix ms — undefined = current
  eventId: string; // reference to EventStore event
  /** For construction: planned vs as-built vs as-inspected */
  phase: 'design' | 'planned' | 'as_built' | 'as_inspected' | 'demolished';
}

// ---------------------------------------------------------------------------
// The Universal Spatial Entity
// ---------------------------------------------------------------------------

export interface SpatialEntity {
  id: EntityId;
  projectId: ProjectId;
  entityType: EntityType;
  domain: EntityDomain;

  /** Multiple geometry representations (B-Rep, mesh, point cloud, parametric) */
  geometry: GeometryRepresentation[];

  /** Coordinate reference for this entity's geometry */
  coordinateRef: CoordinateReference;

  /** Domain-specific and cross-domain properties */
  propertySets: PropertySet[];

  /** AI-generated annotations and analysis results */
  aiAnnotations: AIAnnotation[];

  /** Full provenance chain */
  lineage: LineageRecord;

  /** Digital twin temporal state */
  temporal: TemporalState;

  /** Layer/group membership */
  layers: string[];

  /** Tags for semantic search */
  tags: string[];

  /** Relations to other entities (spatial, logical, hierarchical) */
  relations: EntityRelation[];
}

export interface EntityRelation {
  type:
    | 'contains'
    | 'contained_by'
    | 'adjacent_to'
    | 'intersects'
    | 'references'
    | 'derived_from'
    | 'clashes_with'
    | 'depends_on';
  targetId: EntityId;
  metadata?: Record<string, unknown>;
}
