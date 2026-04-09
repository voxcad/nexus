# NEXUS -- Data Interoperability Strategy

> Binding architectural decisions for coordinate translation, universal entity schema, and streaming format strategy across all NEXUS domain kernels (Civil, BIM, GIS, Surveying, Remote Sensing, Construction).

---

## C1 -- Coordinate System Translation

### Problem Statement

NEXUS ingests geometry from BIM models (IFC, DWG) in local Cartesian coordinates (origin at 0,0,0, meters) and GIS datasets in global geographic coordinates (WGS84 lat/lon or projected CRS with eastings/northings in the millions). WebGL/WebGPU use float32 internally, which gives ~7 decimal digits of precision -- at easting 500,000 m this means jitter of ~0.06 m. Unacceptable for engineering.

### Decision: Five-Stage Transformation Pipeline

All coordinate transformations flow through exactly five stages. Every stage has a defined numeric precision.

```
Stage 1: Parse Source Georef       (float64)
Stage 2: Build Local-to-Projected  (float64, 4x4 affine)
Stage 3: Reproject to WGS84        (float64, PROJ WASM)
Stage 4: Floating-Origin Rebase    (float64 -> float32)
Stage 5: GPU Submission             (float32, camera-relative)
```

### Stage 1 -- Parse IFC Georeferencing

IFC4 provides `IfcMapConversion` and `IfcProjectedCRS` entities. We extract:

- `Eastings`, `Northings`, `OrthogonalHeight` (float64, meters)
- `XAxisAbscissa`, `XAxisOrdinate` (rotation of local axes relative to projected CRS grid north)
- `Scale` (usually 1.0, but some surveyors embed combined scale factor)
- Target CRS from `IfcProjectedCRS.Name` (e.g., `"EPSG:32632"`)

For DWG files, we extract the `AcDbGeoData` object which stores a similar transformation plus a source CRS EPSG code.

```typescript
// coordinate-pipeline.ts

interface IfcMapConversion {
  eastings: number;       // float64 -- projected CRS easting of local origin
  northings: number;      // float64 -- projected CRS northing of local origin
  orthogonalHeight: number;
  xAxisAbscissa: number;  // cos(rotation angle from east to local X)
  xAxisOrdinate: number;  // sin(rotation angle from east to local X)
  scale: number;          // combined scale factor, typically 1.0
}

interface IfcProjectedCRS {
  name: string;           // e.g. "EPSG:32632"
  geodeticDatum: string;  // e.g. "ETRS89"
  verticalDatum?: string; // e.g. "DHHN2016"
}

interface DwgGeoData {
  designPoint: [number, number, number];    // local origin in DWG
  referencePoint: [number, number, number]; // projected CRS coordinates
  upDirection: [number, number, number];
  northDirection: [number, number];         // 2D north vector in XY plane
  scaleFactor: number;
  sourceCrsEpsg: number;
}

function parseIfcGeoref(
  ifc: { mapConversion: IfcMapConversion; projectedCrs: IfcProjectedCRS }
): GeorefParams {
  const { eastings, northings, orthogonalHeight, xAxisAbscissa, xAxisOrdinate, scale } =
    ifc.mapConversion;

  // Rotation angle: angle from projected CRS east axis to local BIM X axis
  const rotationRad = Math.atan2(xAxisOrdinate, xAxisAbscissa);

  return {
    originEasting: eastings,
    originNorthing: northings,
    originHeight: orthogonalHeight,
    rotationRad,
    scale,
    targetCrs: ifc.projectedCrs.name,
  };
}

function parseDwgGeoref(geo: DwgGeoData): GeorefParams {
  const northAngle = Math.atan2(geo.northDirection[0], geo.northDirection[1]);
  // DWG stores north direction; we need rotation from east to local X
  const rotationRad = -(Math.PI / 2 - northAngle);

  return {
    originEasting: geo.referencePoint[0],
    originNorthing: geo.referencePoint[1],
    originHeight: geo.referencePoint[2],
    rotationRad,
    scale: geo.scaleFactor,
    targetCrs: `EPSG:${geo.sourceCrsEpsg}`,
  };
}
```

### Stage 2 -- Build the 4x4 Affine Matrix (Local BIM to Projected CRS)

This matrix encodes: scale, rotate (2D in XY plane), translate to projected coordinates.

```typescript
interface GeorefParams {
  originEasting: number;    // float64
  originNorthing: number;   // float64
  originHeight: number;     // float64
  rotationRad: number;      // radians, float64
  scale: number;            // float64
  targetCrs: string;
}

/**
 * Builds a column-major 4x4 matrix transforming local BIM coordinates
 * to projected CRS coordinates. All math in float64 (native JS number).
 *
 * localBIM [x,y,z] --> projectedCRS [easting, northing, height]
 *
 * M = T * R * S
 *   where S = uniform scale
 *         R = 2D rotation (Z-up preserved)
 *         T = translation to projected origin
 */
function buildLocalToProjectedMatrix(params: GeorefParams): Float64Array {
  const { originEasting, originNorthing, originHeight, rotationRad, scale } = params;
  const c = Math.cos(rotationRad) * scale;
  const s = Math.sin(rotationRad) * scale;

  // Column-major 4x4:
  //  [ c  -s   0   Tx ]
  //  [ s   c   0   Ty ]
  //  [ 0   0   S   Tz ]
  //  [ 0   0   0   1  ]
  const m = new Float64Array(16);
  m[0]  = c;    m[4]  = -s;   m[8]  = 0;     m[12] = originEasting;
  m[1]  = s;    m[5]  = c;    m[9]  = 0;     m[13] = originNorthing;
  m[2]  = 0;    m[6]  = 0;    m[10] = scale; m[14] = originHeight;
  m[3]  = 0;    m[7]  = 0;    m[11] = 0;     m[15] = 1;

  return m;
}

/** Transform a point from local BIM to projected CRS (float64 throughout). */
function transformPoint(m: Float64Array, x: number, y: number, z: number): [number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8]  * z + m[12],
    m[1] * x + m[5] * y + m[9]  * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}
```

**Precision**: JavaScript `number` is IEEE 754 float64 (53-bit mantissa). At easting 500,000 m, float64 gives precision to ~1e-10 m. No precision concern at this stage.

### Stage 3 -- Reproject to WGS84 via PROJ WASM

We use `proj4` compiled to WASM (or the `proj-wasm` package) for datum transformations. This handles grid shifts (e.g., NTv2 for NAD83), geoid models, and complex projections.

```typescript
import initProj, { ProjTransform } from '@nexus/proj-wasm';

let projReady: Promise<void> | null = null;
const transformCache = new Map<string, ProjTransform>();

async function ensureProj(): Promise<void> {
  if (!projReady) {
    projReady = initProj({ wasmUrl: '/proj.wasm', gridDir: '/proj-grids/' });
  }
  return projReady;
}

function getTransform(fromCrs: string, toCrs: string): ProjTransform {
  const key = `${fromCrs}|${toCrs}`;
  let t = transformCache.get(key);
  if (!t) {
    t = new ProjTransform(fromCrs, toCrs);
    transformCache.set(key, t);
  }
  return t;
}

/**
 * Reproject projected CRS coordinates to WGS84 (EPSG:4326).
 * Input: easting, northing, height in projected CRS (float64).
 * Output: longitude, latitude, ellipsoidal height (float64).
 */
async function reprojectToWgs84(
  easting: number,
  northing: number,
  height: number,
  sourceCrs: string,
): Promise<[number, number, number]> {
  await ensureProj();
  const transform = getTransform(sourceCrs, 'EPSG:4326');
  // PROJ convention: input order matches CRS axis order
  const [lon, lat, h] = transform.forward(easting, northing, height);
  return [lon, lat, h];
}

/**
 * Batch reprojection for streaming point clouds.
 * Operates on a Float64Array in-place for zero-copy performance.
 * Layout: [x0, y0, z0, x1, y1, z1, ...]
 */
async function reprojectBatchInPlace(
  coords: Float64Array,
  sourceCrs: string,
): Promise<void> {
  await ensureProj();
  const transform = getTransform(sourceCrs, 'EPSG:4326');
  transform.forwardBatch(coords); // Operates on the buffer directly in WASM memory
}
```

**Precision**: PROJ internally uses float64. Datum transformations (e.g., ETRS89 to WGS84) introduce sub-centimeter differences that are correctly captured.

### Stage 4 -- Floating-Origin Rebase (The Critical Step)

The floating-origin technique subtracts a reference point (typically the camera position or a scene centroid) from all coordinates before converting to float32. This ensures all GPU-visible geometry is expressed as small offsets from a nearby reference, preserving sub-millimeter precision.

```typescript
interface FloatingOrigin {
  /** Current origin in WGS84 [lon, lat, height] -- float64 */
  wgs84: [number, number, number];
  /** Current origin in ECEF meters -- float64 */
  ecef: [number, number, number];
  /** Current origin in projected CRS [easting, northing, height] -- float64 */
  projected: [number, number, number];
  /** The projected CRS identifier */
  crs: string;
}

class FloatingOriginManager {
  private origin: FloatingOrigin;
  private rebaseThreshold = 5000; // meters -- rebase when camera moves this far

  constructor(initialOrigin: FloatingOrigin) {
    this.origin = initialOrigin;
  }

  /**
   * Convert a WGS84 coordinate to camera-relative float32.
   * The subtraction happens in ECEF (Cartesian, meters) to avoid
   * angular arithmetic at varying latitudes.
   */
  toRenderCoords(lon: number, lat: number, h: number): Float32Array {
    const ecef = wgs84ToEcef(lon, lat, h); // float64

    // Subtract origin -- now values are small (< rebaseThreshold)
    const dx = ecef[0] - this.origin.ecef[0]; // float64 subtraction
    const dy = ecef[1] - this.origin.ecef[1];
    const dz = ecef[2] - this.origin.ecef[2];

    // Safe to truncate to float32: values are < 10km, so precision ~0.001m
    return new Float32Array([dx, dy, dz]);
  }

  /**
   * Batch convert for point clouds. Input: Float64Array of ECEF [x,y,z,...].
   * Output: Float32Array of camera-relative [dx,dy,dz,...].
   */
  toRenderCoordsBatch(ecefCoords: Float64Array): Float32Array {
    const out = new Float32Array(ecefCoords.length);
    const [ox, oy, oz] = this.origin.ecef;
    for (let i = 0; i < ecefCoords.length; i += 3) {
      out[i]     = ecefCoords[i]     - ox;
      out[i + 1] = ecefCoords[i + 1] - oy;
      out[i + 2] = ecefCoords[i + 2] - oz;
    }
    return out;
  }

  /**
   * Check if camera has moved far enough to warrant a rebase.
   * Called each frame by the render loop.
   */
  shouldRebase(cameraEcef: [number, number, number]): boolean {
    const dx = cameraEcef[0] - this.origin.ecef[0];
    const dy = cameraEcef[1] - this.origin.ecef[1];
    const dz = cameraEcef[2] - this.origin.ecef[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz) > this.rebaseThreshold;
  }

  /**
   * Rebase: update origin to new camera position.
   * All GPU buffers must be invalidated (tile manager handles this via
   * generation counter, not by re-uploading -- tiles re-upload lazily on
   * next visibility).
   */
  rebase(newOriginWgs84: [number, number, number], crs: string): void {
    const ecef = wgs84ToEcef(newOriginWgs84[0], newOriginWgs84[1], newOriginWgs84[2]);
    this.origin = {
      wgs84: newOriginWgs84,
      ecef: [ecef[0], ecef[1], ecef[2]],
      projected: [0, 0, 0], // recomputed lazily
      crs,
    };
  }
}

/** WGS84 (lon, lat, h) to ECEF (x, y, z) -- all float64. */
function wgs84ToEcef(lon: number, lat: number, h: number): [number, number, number] {
  const a = 6378137.0;             // WGS84 semi-major axis
  const f = 1 / 298.257223563;    // WGS84 flattening
  const e2 = 2 * f - f * f;       // eccentricity squared

  const lonRad = (lon * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat); // radius of curvature

  const x = (N + h) * cosLat * cosLon;
  const y = (N + h) * cosLat * sinLon;
  const z = (N * (1 - e2) + h) * sinLat;

  return [x, y, z];
}
```

### Stage 5 -- GPU Submission

```typescript
interface RenderTileUniforms {
  /** Model-view-projection matrix -- float32, camera-relative */
  mvp: Float32Array;       // 16 elements
  /** Origin offset for this frame (ECEF, float64 encoded as 2x float32) */
  originHigh: Float32Array; // 3 elements -- high bits
  originLow: Float32Array;  // 3 elements -- low bits
}

/**
 * Double-precision emulation on GPU via high/low float32 split.
 * Used only for the model matrix translation component when
 * rendering tiles that haven't been rebased yet (hybrid approach).
 */
function splitFloat64(value: number): [number, number] {
  const high = Math.fround(value);          // float32 truncation
  const low = Math.fround(value - high);    // remainder, also float32
  return [high, low];
}

function buildGpuUniforms(
  modelMatrix: Float64Array,    // 4x4 float64, camera-relative
  viewMatrix: Float64Array,     // 4x4 float64
  projectionMatrix: Float64Array,
): RenderTileUniforms {
  // Multiply on CPU in float64, then truncate final MVP to float32.
  // Because all translations are camera-relative (small values),
  // the float32 truncation loses < 0.001m precision.
  const mv = mat4Multiply64(viewMatrix, modelMatrix);
  const mvp = mat4Multiply64(projectionMatrix, mv);

  return {
    mvp: new Float32Array(mvp),
    originHigh: new Float32Array(3),
    originLow: new Float32Array(3),
  };
}
```

### Precision Budget Summary

| Stage | Numeric Type | Max Coordinate Magnitude | Precision | Error Budget |
|-------|-------------|-------------------------|-----------|-------------|
| 1. Parse Georef | float64 | 10,000,000 m | ~1e-9 m | negligible |
| 2. Local-to-Projected | float64 | 10,000,000 m | ~1e-9 m | negligible |
| 3. Reproject (PROJ) | float64 | ~6,400,000 m (ECEF) | ~1e-9 m | < 0.001 m |
| 4. Floating-Origin Subtract | float64 -> float32 | < 10,000 m offset | ~0.001 m | < 0.001 m |
| 5. GPU MVP | float32 | < 10,000 m | ~0.001 m | < 0.001 m |
| **Total** | | | | **< 0.003 m** |

### Streaming Point Cloud Handling

For real-time LiDAR streams, the pipeline runs in a Web Worker with zero-copy transfers:

```typescript
// point-cloud-worker.ts
self.onmessage = async (e: MessageEvent<{
  coords: Float64Array;     // Transferable -- [x,y,z,...] in source CRS
  sourceCrs: string;
  originEcef: [number, number, number];
}>) => {
  const { coords, sourceCrs, originEcef } = e.data;

  // Stage 2-3: Reproject in-place (source CRS -> ECEF via WGS84)
  await reprojectBatchInPlace(coords, sourceCrs);
  const ecefCoords = await batchWgs84ToEcef(coords); // reuses same buffer concept

  // Stage 4: Floating-origin subtract -> float32
  const renderCoords = new Float32Array(ecefCoords.length);
  for (let i = 0; i < ecefCoords.length; i += 3) {
    renderCoords[i]     = ecefCoords[i]     - originEcef[0];
    renderCoords[i + 1] = ecefCoords[i + 1] - originEcef[1];
    renderCoords[i + 2] = ecefCoords[i + 2] - originEcef[2];
  }

  // Transfer back to main thread -- zero copy
  self.postMessage({ renderCoords }, [renderCoords.buffer]);
};
```

---

## C2 -- Universal Spatial Entity Schema (USES)

### Design Rationale

Every domain kernel in NEXUS (BIM, GIS, CAD, Surveying, Point Cloud, Construction) operates on entities with fundamentally different native schemas. AI agents must reason across these boundaries without lossy translation. USES is the canonical internal representation -- a superset schema that preserves all domain semantics while providing a uniform query surface.

Two wire formats:
- **JSON-LD**: For API responses, AI agent reasoning, human inspection, and semantic web interoperability.
- **FlatBuffers**: For high-frequency GPU pipeline updates, real-time collaboration deltas, and worker-to-main-thread transfers.

### TypeScript Interface Definition

```typescript
// uses-schema.ts -- Universal Spatial Entity Schema

import type { UUID } from 'crypto';

/** Top-level entity types spanning all domain kernels. */
export enum EntityType {
  // BIM
  BIM_WALL              = 'bim.wall',
  BIM_SLAB              = 'bim.slab',
  BIM_COLUMN            = 'bim.column',
  BIM_BEAM              = 'bim.beam',
  BIM_DOOR              = 'bim.door',
  BIM_WINDOW            = 'bim.window',
  BIM_ROOF              = 'bim.roof',
  BIM_STAIR             = 'bim.stair',
  BIM_SPACE             = 'bim.space',
  BIM_BUILDING          = 'bim.building',
  BIM_STOREY            = 'bim.storey',
  BIM_SITE              = 'bim.site',
  BIM_MEP_SEGMENT       = 'bim.mep_segment',
  BIM_FITTING           = 'bim.fitting',
  // GIS
  GIS_PARCEL            = 'gis.parcel',
  GIS_ROAD_CENTERLINE   = 'gis.road_centerline',
  GIS_BUILDING_FOOTPRINT= 'gis.building_footprint',
  GIS_CONTOUR           = 'gis.contour',
  GIS_UTILITY_LINE      = 'gis.utility_line',
  GIS_LAND_USE_ZONE     = 'gis.land_use_zone',
  GIS_VEGETATION        = 'gis.vegetation',
  GIS_HYDRO_FEATURE     = 'gis.hydro_feature',
  // CAD
  CAD_LINE              = 'cad.line',
  CAD_ARC               = 'cad.arc',
  CAD_POLYLINE          = 'cad.polyline',
  CAD_SURFACE           = 'cad.surface',
  CAD_SOLID             = 'cad.solid',
  CAD_BLOCK_REF         = 'cad.block_ref',
  CAD_ANNOTATION        = 'cad.annotation',
  // Civil
  CIVIL_ALIGNMENT       = 'civil.alignment',
  CIVIL_PROFILE         = 'civil.profile',
  CIVIL_CORRIDOR        = 'civil.corridor',
  CIVIL_SURFACE_TIN     = 'civil.surface_tin',
  CIVIL_PIPE_NETWORK    = 'civil.pipe_network',
  // Point Cloud
  PC_CLASSIFIED_REGION  = 'pc.classified_region',
  PC_SCAN_POSITION      = 'pc.scan_position',
  // Survey
  SURVEY_CONTROL_POINT  = 'survey.control_point',
  SURVEY_BOUNDARY       = 'survey.boundary',
  SURVEY_MONUMENT       = 'survey.monument',
  // Construction
  CONSTRUCTION_ACTIVITY = 'construction.activity',
  CONSTRUCTION_ZONE     = 'construction.zone',
}

/** How geometry is represented. Multiple representations can coexist. */
export interface GeometryRepresentation {
  /** Primary representation type. */
  type: 'brep' | 'mesh' | 'point_cloud' | 'parametric' | 'alignment_2d' | 'tin' | 'none';
  /** Reference to B-Rep kernel object (OpenCascade handle or similar). */
  brepRef?: string;
  /** Indexed mesh: vertex buffer + index buffer references in the GPU tile store. */
  meshRef?: { vertexBufferId: string; indexBufferId: string; vertexCount: number; indexCount: number };
  /** Point cloud tile reference (COPC/3D Tiles octree node). */
  pointCloudRef?: { tilesetId: string; nodeIds: string[] };
  /** Parametric definition for civil alignments, profiles, etc. */
  parametric?: { definition: string; format: 'landxml' | 'ifc_alignment' | 'nexus_native' };
  /** Bounding box in local coordinates [minX, minY, minZ, maxX, maxY, maxZ]. */
  boundingBox: [number, number, number, number, number, number];
  /** LOD level this representation targets (0 = full detail). */
  lod: number;
}

/** Coordinate reference binding for this entity. */
export interface CoordinateReference {
  crs: string;                           // e.g. "EPSG:32632" or "local"
  localOrigin?: [number, number, number]; // if local, the georef origin in projected CRS
  transformToProjected?: Float64Array;    // 4x4 column-major, local -> projected
  verticalDatum?: string;                 // e.g. "DHHN2016", "EGM2008"
}

export interface PropertyValue {
  value: string | number | boolean | null;
  unit?: string;                          // SI unit string, e.g. "m", "kg/m3", "degC"
  source: 'native' | 'computed' | 'ai_inferred' | 'user_override';
  confidence?: number;                    // 0-1, only for ai_inferred
}

/** Domain-specific property sets. Keys follow IFC Pset naming where applicable. */
export interface PropertySet {
  name: string;                           // e.g. "Pset_WallCommon", "gis.parcel_attrs"
  properties: Record<string, PropertyValue>;
}

export interface AIAnnotation {
  agentId: string;                        // which AI agent produced this
  annotationType: 'classification' | 'defect_detection' | 'clash' | 'compliance' | 'suggestion';
  content: string;                        // structured annotation payload (JSON string)
  confidence: number;                     // 0-1
  reasoningTrace?: string;                // chain-of-thought or tool-use log
  modelVersion: string;                   // e.g. "nexus-bim-classifier-v3.2"
  createdAt: string;                      // ISO 8601
}

export interface LineageRecord {
  sourceFormat: string;                   // e.g. "IFC4", "SHP", "LAS 1.4", "DWG 2024"
  sourceFile?: string;                    // original filename
  sourceEntityId?: string;                // ID in the source format (e.g. IFC GlobalId)
  importedAt: string;                     // ISO 8601
  importPipelineVersion: string;          // NEXUS importer version
  transformationChain: string[];          // ordered list of transforms applied
  parentEntityIds?: UUID[];               // if derived from other USES entities
}

export interface TemporalState {
  version: number;                        // monotonic version counter
  validFrom: string;                      // ISO 8601 -- when this state became active
  validTo?: string;                       // ISO 8601 -- null means "current"
  editedBy: string;                       // user ID or agent ID
  changeDescription?: string;
}

/** Point cloud ASPRS classification attached to regions. */
export interface PointCloudClassification {
  asprsCode: number;                      // ASPRS LAS 1.4 classification code
  asprsLabel: string;                     // e.g. "Ground", "Building", "Vegetation"
  customLabel?: string;                   // project-specific override
  pointCount: number;
}

/**
 * Universal Spatial Entity -- the canonical internal representation
 * for every spatial object in NEXUS.
 *
 * JSON-LD context: "https://nexus.dev/schemas/uses/v1"
 */
export interface UniversalSpatialEntity {
  '@context'?: string;
  '@type'?: string;

  id: UUID;
  entityType: EntityType;
  name?: string;
  description?: string;

  geometry: GeometryRepresentation[];      // multiple LODs / representations
  coordinateRef: CoordinateReference;

  propertySets: PropertySet[];             // all domain properties
  pointCloudClassification?: PointCloudClassification[];

  aiAnnotations: AIAnnotation[];
  lineage: LineageRecord;
  temporal: TemporalState;

  /** Parent in spatial hierarchy (e.g., storey -> building -> site). */
  parentId?: UUID;
  /** IDs of child entities. */
  childIds?: UUID[];
  /** Cross-domain relationships (e.g., BIM wall <-> GIS footprint edge). */
  relatedEntities?: Array<{ entityId: UUID; relationshipType: string }>;

  /** Arbitrary extension point for domain kernels. */
  extensions?: Record<string, unknown>;
}
```

### FlatBuffers Binary Wire Format

Used for high-frequency updates (point cloud streaming, real-time collaboration, GPU pipeline).

```fbs
// uses.fbs -- Universal Spatial Entity Schema (binary wire format)

namespace Nexus.Uses;

enum EntityTypeCode : uint16 {
  BIM_WALL = 0,
  BIM_SLAB = 1,
  BIM_COLUMN = 2,
  BIM_BEAM = 3,
  BIM_DOOR = 4,
  BIM_WINDOW = 5,
  BIM_ROOF = 6,
  BIM_STAIR = 7,
  BIM_SPACE = 8,
  BIM_BUILDING = 9,
  BIM_STOREY = 10,
  BIM_SITE = 11,
  BIM_MEP_SEGMENT = 12,
  BIM_FITTING = 13,
  GIS_PARCEL = 100,
  GIS_ROAD_CENTERLINE = 101,
  GIS_BUILDING_FOOTPRINT = 102,
  GIS_CONTOUR = 103,
  GIS_UTILITY_LINE = 104,
  GIS_LAND_USE_ZONE = 105,
  CAD_LINE = 200,
  CAD_ARC = 201,
  CAD_POLYLINE = 202,
  CAD_SURFACE = 203,
  CAD_SOLID = 204,
  CAD_BLOCK_REF = 205,
  CIVIL_ALIGNMENT = 300,
  CIVIL_PROFILE = 301,
  CIVIL_CORRIDOR = 302,
  CIVIL_SURFACE_TIN = 303,
  CIVIL_PIPE_NETWORK = 304,
  PC_CLASSIFIED_REGION = 400,
  PC_SCAN_POSITION = 401,
  SURVEY_CONTROL_POINT = 500,
  SURVEY_BOUNDARY = 501,
  CONSTRUCTION_ACTIVITY = 600,
  CONSTRUCTION_ZONE = 601
}

enum GeomType : uint8 {
  BREP = 0,
  MESH = 1,
  POINT_CLOUD = 2,
  PARAMETRIC = 3,
  ALIGNMENT_2D = 4,
  TIN = 5,
  NONE = 6
}

enum PropertySource : uint8 {
  NATIVE = 0,
  COMPUTED = 1,
  AI_INFERRED = 2,
  USER_OVERRIDE = 3
}

struct Vec3f64 {
  x: float64;
  y: float64;
  z: float64;
}

struct BBox {
  min: Vec3f64;
  max: Vec3f64;
}

table MeshRef {
  vertex_buffer_id: string;
  index_buffer_id: string;
  vertex_count: uint32;
  index_count: uint32;
}

table PointCloudRef {
  tileset_id: string;
  node_ids: [string];
}

table GeometryRep {
  type: GeomType;
  brep_ref: string;
  mesh_ref: MeshRef;
  pc_ref: PointCloudRef;
  parametric_def: string;
  bbox: BBox;
  lod: uint8;
}

table CoordRef {
  crs: string;
  local_origin: Vec3f64;
  transform_to_projected: [float64:16];  // 4x4 column-major
  vertical_datum: string;
}

table Property {
  key: string;
  str_value: string;
  num_value: float64;
  bool_value: bool;
  is_null: bool;
  unit: string;
  source: PropertySource;
  confidence: float32;
}

table PropertySet {
  name: string;
  properties: [Property];
}

table AIAnnotation {
  agent_id: string;
  annotation_type: uint8;  // maps to enum in application layer
  content: string;
  confidence: float32;
  reasoning_trace: string;
  model_version: string;
  created_at: int64;       // unix millis
}

table Lineage {
  source_format: string;
  source_file: string;
  source_entity_id: string;
  imported_at: int64;      // unix millis
  pipeline_version: string;
  transformation_chain: [string];
  parent_entity_ids: [string]; // UUID strings
}

table TemporalState {
  version: uint64;
  valid_from: int64;       // unix millis
  valid_to: int64;         // 0 = current
  edited_by: string;
  change_description: string;
}

table Relationship {
  entity_id: string;       // UUID
  relationship_type: string;
}

table PointCloudClass {
  asprs_code: uint8;
  asprs_label: string;
  custom_label: string;
  point_count: uint64;
}

table UniversalSpatialEntity {
  id: string;              // UUID
  entity_type: EntityTypeCode;
  name: string;
  description: string;
  geometry: [GeometryRep];
  coord_ref: CoordRef;
  property_sets: [PropertySet];
  pc_classification: [PointCloudClass];
  ai_annotations: [AIAnnotation];
  lineage: Lineage;
  temporal: TemporalState;
  parent_id: string;
  child_ids: [string];
  related_entities: [Relationship];
}

/// Batch message for streaming updates (point clouds, collab deltas).
table EntityBatch {
  entities: [UniversalSpatialEntity];
  origin_ecef: Vec3f64;    // floating origin for this batch
  timestamp: int64;        // unix millis
  sequence: uint64;        // monotonic for ordering
}

root_type EntityBatch;
```

### JSON-LD Context

The JSON-LD `@context` maps USES fields to established ontologies where possible:

```json
{
  "@context": {
    "@vocab": "https://nexus.dev/schemas/uses/v1#",
    "id": "@id",
    "entityType": "uses:entityType",
    "geometry": "uses:geometry",
    "geo": "http://www.opengis.net/ont/geosparql#",
    "ifc": "https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2_TC1/OWL#",
    "schema": "http://schema.org/",
    "name": "schema:name",
    "description": "schema:description",
    "propertySets": "uses:propertySets",
    "lineage": {
      "@id": "uses:lineage",
      "@type": "prov:Activity"
    },
    "prov": "http://www.w3.org/ns/prov#"
  }
}
```

---

## C3 -- 3D Tiles & Streaming Format Strategy

### Canonical Format Decision Matrix

| Data Type | Canonical Internal Format | External Formats Supported | Conversion Path | Metadata Loss Risk |
|---|---|---|---|---|
| **Building Models (BIM)** | 3D Tiles 1.1 (glTF + EXT_structural_metadata) | IFC2x3, IFC4, IFC4.3, Revit (via IFC), DWG | IFC -> USES -> glTF mesh + 3D Tiles tileset.json; property sets encoded in EXT_structural_metadata | **Low**: IFC property sets fully preserved in structural metadata. B-Rep topology lost (tessellated to mesh); original B-Rep stored separately in kernel cache for editing. |
| **Terrain (DEM/DSM)** | Quantized Mesh (CesiumJS format) + 3D Tiles terrain | GeoTIFF, DTED, LandXML TIN, ASCII Grid, USGS 3DEP | Raster -> heightmap tiles -> quantized mesh; TIN -> direct quantized mesh conversion | **Low**: Elevation values preserved. Source raster metadata (NoData semantics, acquisition date) preserved in USES lineage. |
| **Road/Civil Alignments** | 3D Tiles 1.1 (glTF with custom extension) + LandXML parametric backup | LandXML, IFC4.3 IfcAlignment, InfraGML, OpenDrive | Parse parametric definition -> tessellate to 3D mesh at LOD levels -> 3D Tiles; parametric source stored in USES `parametric` field | **Medium**: Tessellation loses exact parametric curves. Mitigated by storing original parametric definition in USES and re-tessellating on demand. Stationing/chainage preserved as structural metadata. |
| **Point Clouds** | COPC (Cloud-Optimized Point Cloud) for storage; 3D Tiles 1.1 (PNTS -> glTF points) for rendering | LAS 1.2-1.4, LAZ, E57, PTS, PLY, Potree | LAS/LAZ -> COPC (lossless); COPC -> 3D Tiles octree for GPU streaming | **None**: COPC is lossless superset of LAS. All ASPRS classification, RGB, intensity, return number preserved. Extra bytes dimensions retained. |
| **Vector GIS Features** | GeoParquet (storage) + 3D Tiles vector (rendering) | Shapefile, GeoJSON, GML, GPKG, FileGDB, OGC API Features, KML | Ingest -> GeoParquet (lossless attribute preservation); GeoParquet -> tessellated 3D Tiles for 3D rendering, or direct vector render for 2D | **Low**: GeoParquet preserves all attributes and geometry types. Domain-coded values mapped to USES property sets. Topology (polygon adjacency) must be explicitly reconstructed if needed. |
| **Raster Imagery** | Cloud-Optimized GeoTIFF (COG) for storage; 3D Tiles raster (terrain drape) for rendering | GeoTIFF, JPEG2000, MrSID, ECW, WMS/WMTS, Sentinel-2 | Ingest -> COG (internal tiling + overview pyramids); COG -> texture tiles draped on terrain mesh | **None**: COG is lossless for source raster. Band structure, bit depth, and CRS preserved. Lossy only if user requests JPEG compression for display tiles. |

### Conversion Architecture

```typescript
// format-registry.ts

type DataType =
  | 'building_model'
  | 'terrain'
  | 'civil_alignment'
  | 'point_cloud'
  | 'vector_gis'
  | 'raster_imagery';

type ExternalFormat =
  | 'ifc2x3' | 'ifc4' | 'ifc4.3'
  | 'dwg' | 'dxf'
  | 'shp' | 'geojson' | 'gml' | 'gpkg' | 'fgdb' | 'kml'
  | 'las' | 'laz' | 'e57' | 'pts' | 'ply'
  | 'geotiff' | 'jpeg2000' | 'mrsid' | 'ecw'
  | 'landxml' | 'infragml' | 'opendrive'
  | 'citygml'
  | '3dtiles' | 'i3s' | 'gltf' | 'glb'
  | 'ogc_api_features' | 'wms' | 'wmts'
  | 'copc' | 'geoparquet' | 'cog';

type CanonicalFormat = '3dtiles_gltf' | 'quantized_mesh' | 'copc' | 'geoparquet' | 'cog';

interface ConversionPath {
  from: ExternalFormat;
  to: CanonicalFormat;
  steps: ConversionStep[];
  lossless: boolean;
  metadataPreservation: 'full' | 'partial' | 'geometry_only';
  estimatedThroughput: string; // e.g. "50 MB/s" on reference hardware
}

interface ConversionStep {
  name: string;
  engine: 'web-ifc' | 'proj-wasm' | 'pdal-wasm' | 'gdal-wasm' | 'ogr2ogr-wasm' | 'nexus-native';
  description: string;
}

const CONVERSION_REGISTRY: ConversionPath[] = [
  // IFC -> 3D Tiles
  {
    from: 'ifc4',
    to: '3dtiles_gltf',
    steps: [
      { name: 'parse', engine: 'web-ifc', description: 'Parse IFC into memory, extract geometry + property sets' },
      { name: 'tessellate', engine: 'web-ifc', description: 'Tessellate B-Rep to indexed triangle mesh' },
      { name: 'georef', engine: 'nexus-native', description: 'Apply IfcMapConversion transform (C1 pipeline)' },
      { name: 'tile', engine: 'nexus-native', description: 'Spatial partition into 3D Tiles hierarchy (implicit tiling)' },
      { name: 'encode', engine: 'nexus-native', description: 'Encode as glTF 2.0 + EXT_structural_metadata per tile' },
    ],
    lossless: false, // tessellation loses B-Rep
    metadataPreservation: 'full',
    estimatedThroughput: '30 MB/s',
  },
  // LAS -> COPC
  {
    from: 'laz',
    to: 'copc',
    steps: [
      { name: 'decompress', engine: 'pdal-wasm', description: 'Decompress LAZ to LAS point records' },
      { name: 'reproject', engine: 'pdal-wasm', description: 'Reproject to project CRS if needed' },
      { name: 'organize', engine: 'pdal-wasm', description: 'Build COPC octree with VLR metadata' },
    ],
    lossless: true,
    metadataPreservation: 'full',
    estimatedThroughput: '80 MB/s',
  },
  // Shapefile -> GeoParquet
  {
    from: 'shp',
    to: 'geoparquet',
    steps: [
      { name: 'parse', engine: 'ogr2ogr-wasm', description: 'Read SHP + DBF + PRJ into feature collection' },
      { name: 'reproject', engine: 'proj-wasm', description: 'Reproject to WGS84 if needed' },
      { name: 'encode', engine: 'nexus-native', description: 'Write GeoParquet with row group spatial indexing' },
    ],
    lossless: true,
    metadataPreservation: 'full',
    estimatedThroughput: '100 MB/s',
  },
  // GeoTIFF -> COG
  {
    from: 'geotiff',
    to: 'cog',
    steps: [
      { name: 'validate', engine: 'gdal-wasm', description: 'Verify CRS, NoData, band structure' },
      { name: 'retile', engine: 'gdal-wasm', description: 'Internal tiling (256x256 or 512x512) + overview pyramids' },
      { name: 'compress', engine: 'gdal-wasm', description: 'Apply DEFLATE/LZW compression, emit COG layout' },
    ],
    lossless: true,
    metadataPreservation: 'full',
    estimatedThroughput: '60 MB/s',
  },
  // I3S -> 3D Tiles (Esri interop)
  {
    from: 'i3s',
    to: '3dtiles_gltf',
    steps: [
      { name: 'fetch', engine: 'nexus-native', description: 'Traverse I3S scene layer, fetch nodes + shared resources' },
      { name: 'convert_geometry', engine: 'nexus-native', description: 'Convert I3S geometry (Draco-compressed) to glTF' },
      { name: 'convert_attributes', engine: 'nexus-native', description: 'Map I3S attribute storage to EXT_structural_metadata' },
      { name: 'rebuild_tileset', engine: 'nexus-native', description: 'Reconstruct bounding volume hierarchy as 3D Tiles tileset.json' },
    ],
    lossless: false, // minor precision differences in Draco re-encode
    metadataPreservation: 'full',
    estimatedThroughput: '20 MB/s',
  },
  // CityGML -> 3D Tiles
  {
    from: 'citygml',
    to: '3dtiles_gltf',
    steps: [
      { name: 'parse', engine: 'nexus-native', description: 'Parse CityGML XML, resolve xlinks and implicit geometries' },
      { name: 'tessellate', engine: 'nexus-native', description: 'Triangulate CityGML solids/surfaces per LOD' },
      { name: 'georef', engine: 'proj-wasm', description: 'Transform from source CRS (often ETRS89/UTM) to project CRS' },
      { name: 'tile', engine: 'nexus-native', description: 'Build 3D Tiles hierarchy respecting CityGML LOD levels' },
      { name: 'encode', engine: 'nexus-native', description: 'Emit glTF + structural metadata (CityGML attributes)' },
    ],
    lossless: false,
    metadataPreservation: 'full',
    estimatedThroughput: '15 MB/s',
  },
  // LandXML -> 3D Tiles + parametric backup
  {
    from: 'landxml',
    to: '3dtiles_gltf',
    steps: [
      { name: 'parse', engine: 'nexus-native', description: 'Parse LandXML alignments, profiles, surfaces' },
      { name: 'store_parametric', engine: 'nexus-native', description: 'Store original parametric defs in USES entity' },
      { name: 'tessellate', engine: 'nexus-native', description: 'Tessellate alignments to 3D ribbon meshes, surfaces to TIN' },
      { name: 'tile', engine: 'nexus-native', description: 'Build 3D Tiles with stationing encoded in metadata' },
    ],
    lossless: false,
    metadataPreservation: 'partial', // parametric fidelity preserved in USES, not in tile
    estimatedThroughput: '40 MB/s',
  },
];
```

### 3D Tiles 1.1 Streaming Strategy

3D Tiles 1.1 is the canonical rendering format. Key decisions:

**Implicit Tiling**: All new tilesets use implicit tiling (octree or quadtree subdivision template) rather than explicit `tileset.json` trees. This reduces metadata overhead by 95%+ for large datasets and enables predictable URL patterns for HTTP/2 multiplexing.

**Content Format**: All tile content is glTF 2.0 with the following extensions:
- `EXT_structural_metadata` -- property tables for BIM/GIS attributes queryable at render time
- `EXT_mesh_gpu_instancing` -- for repeated elements (columns, trees, fixtures)
- `KHR_mesh_quantization` -- reduce vertex attribute size
- `KHR_draco_mesh_compression` -- geometry compression (70-90% size reduction)
- `EXT_meshopt_compression` -- alternative to Draco for faster decode on GPU

**LOD Strategy by Data Type**:

```typescript
interface TilesetConfig {
  dataType: DataType;
  subdivision: 'octree' | 'quadtree';
  maxDepth: number;
  geometricErrorRoot: number;     // meters -- screen-space error at root
  geometricErrorLeaf: number;     // meters -- screen-space error at leaves
  contentEncoding: string[];
  refinement: 'ADD' | 'REPLACE';
}

const TILESET_CONFIGS: Record<DataType, TilesetConfig> = {
  building_model: {
    dataType: 'building_model',
    subdivision: 'octree',
    maxDepth: 8,
    geometricErrorRoot: 100,
    geometricErrorLeaf: 0.05,
    contentEncoding: ['draco', 'meshopt'],
    refinement: 'REPLACE',        // swap LODs
  },
  terrain: {
    dataType: 'terrain',
    subdivision: 'quadtree',
    maxDepth: 22,                  // ~1cm resolution at max zoom
    geometricErrorRoot: 10000,
    geometricErrorLeaf: 0.5,
    contentEncoding: ['quantized_mesh'],
    refinement: 'REPLACE',
  },
  civil_alignment: {
    dataType: 'civil_alignment',
    subdivision: 'quadtree',
    maxDepth: 6,
    geometricErrorRoot: 50,
    geometricErrorLeaf: 0.1,
    contentEncoding: ['draco'],
    refinement: 'REPLACE',
  },
  point_cloud: {
    dataType: 'point_cloud',
    subdivision: 'octree',
    maxDepth: 16,
    geometricErrorRoot: 500,
    geometricErrorLeaf: 0.01,
    contentEncoding: ['draco'],   // point attributes compressed via Draco
    refinement: 'ADD',            // additive refinement for progressive density
  },
  vector_gis: {
    dataType: 'vector_gis',
    subdivision: 'quadtree',
    maxDepth: 12,
    geometricErrorRoot: 5000,
    geometricErrorLeaf: 1,
    contentEncoding: ['meshopt'],
    refinement: 'REPLACE',
  },
  raster_imagery: {
    dataType: 'raster_imagery',
    subdivision: 'quadtree',
    maxDepth: 20,
    geometricErrorRoot: 10000,
    geometricErrorLeaf: 0.3,
    contentEncoding: ['jpeg', 'webp'],
    refinement: 'REPLACE',
  },
};
```

### Cross-Format Interop Guarantees

1. **No format lock-in**: Every entity stored in USES can be exported back to its source format via the conversion registry. Round-trip fidelity is tracked per-entity in `LineageRecord.transformationChain`.

2. **COPC as point cloud source-of-truth**: We never store raw LAS/LAZ as canonical. COPC is a strict superset that adds spatial indexing without losing any LAS fields. All point cloud queries (spatial, classification, intensity range) go through COPC first, then 3D Tiles for rendering only.

3. **GeoParquet as vector source-of-truth**: Column-oriented storage with spatial indexing. Supports predicate pushdown for AI agent queries ("find all parcels where zoning = 'R1' within 500m of alignment"). Rendering goes through 3D Tiles vector tiles.

4. **Parametric preservation**: For civil alignments and BIM elements, the original parametric definition is always stored alongside the tessellated rendering mesh. Editing operations operate on the parametric form; the mesh is regenerated. This avoids the "mesh editing" antipattern.

5. **Esri I3S interop**: Bidirectional conversion between 3D Tiles 1.1 and I3S Scene Layers. Attribute mapping is 1:1 for standard field types. Complex Esri domains (coded values, range domains) are mapped to USES `PropertySet` entries with `source: 'native'`.
