/**
 * NEXUS — LLM Agent Tool Schemas
 *
 * These are the JSON Schema tool definitions that LLMs use to call
 * geometric and spatial operations via the Headless Geometry API.
 * Each tool is callable by any agent with appropriate permissions.
 */

// ---------------------------------------------------------------------------
// Tool Schema Type (matches OpenAI/Anthropic function calling format)
// ---------------------------------------------------------------------------

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
  returns: ReturnSchema;
}

interface ParameterSchema {
  type: string;
  description: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: ParameterSchema;
  properties?: Record<string, ParameterSchema>;
  required?: string[];
  default?: unknown;
}

interface ReturnSchema {
  type: string;
  description: string;
  properties?: Record<string, ParameterSchema>;
}

// ---------------------------------------------------------------------------
// Civil Engineering Tools
// ---------------------------------------------------------------------------

export const createRoadAlignment: ToolSchema = {
  name: 'create_road_alignment',
  description:
    'Create a horizontal road alignment from a start point to an end point, ' +
    'applying design standards for the specified speed. Generates tangent ' +
    'segments and circular/spiral curves that respect minimum radius and ' +
    'superelevation requirements.',
  parameters: {
    type: 'object',
    properties: {
      start_point: {
        type: 'object',
        description: 'Start point in WGS84',
        properties: {
          lat: { type: 'number', description: 'Latitude (decimal degrees)', minimum: -90, maximum: 90 },
          lon: { type: 'number', description: 'Longitude (decimal degrees)', minimum: -180, maximum: 180 },
          elevation: { type: 'number', description: 'Elevation above datum (meters)' },
        },
        required: ['lat', 'lon'],
      },
      end_point: {
        type: 'object',
        description: 'End point in WGS84',
        properties: {
          lat: { type: 'number', description: 'Latitude (decimal degrees)', minimum: -90, maximum: 90 },
          lon: { type: 'number', description: 'Longitude (decimal degrees)', minimum: -180, maximum: 180 },
          elevation: { type: 'number', description: 'Elevation above datum (meters)' },
        },
        required: ['lat', 'lon'],
      },
      design_speed_kmh: {
        type: 'number',
        description: 'Design speed in km/h. Determines minimum curve radius and sight distance.',
        enum: [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130],
      },
      road_class: {
        type: 'string',
        description: 'Road classification per AASHTO Green Book',
        enum: ['local', 'collector', 'minor_arterial', 'major_arterial', 'freeway'],
      },
      lanes: {
        type: 'number',
        description: 'Number of lanes (total, both directions)',
        minimum: 1,
        maximum: 8,
        default: 2,
      },
      lane_width_m: {
        type: 'number',
        description: 'Lane width in meters',
        minimum: 2.7,
        maximum: 4.5,
        default: 3.6,
      },
      avoidance_layers: {
        type: 'array',
        description: 'Layer names containing polygons the alignment must avoid',
        items: { type: 'string' },
      },
      max_gradient_pct: {
        type: 'number',
        description: 'Maximum gradient (%). Steeper segments flagged for review.',
        minimum: 0.5,
        maximum: 15,
        default: 8,
      },
      design_standard: {
        type: 'string',
        description: 'Design standard to apply',
        enum: ['AASHTO_2018', 'AASHTO_2011', 'DMRB_UK', 'Austroads', 'IRC_India'],
        default: 'AASHTO_2018',
      },
      terrain_surface_id: {
        type: 'string',
        description: 'Entity ID of the terrain surface for vertical alignment design',
      },
    },
    required: ['start_point', 'end_point', 'design_speed_kmh', 'road_class'],
  },
  returns: {
    type: 'object',
    description: 'Created alignment entity with geometry and compliance report',
    properties: {
      entity_id: { type: 'string', description: 'UUID of the created alignment entity' },
      total_length_m: { type: 'number', description: 'Total alignment length in meters' },
      num_curves: { type: 'number', description: 'Number of horizontal curves' },
      min_radius_m: { type: 'number', description: 'Minimum curve radius used (meters)' },
      gradient_flags: {
        type: 'array',
        description: 'Stations where gradient exceeds max_gradient_pct',
        items: {
          type: 'object',
          properties: {
            station_start: { type: 'number' },
            station_end: { type: 'number' },
            gradient_pct: { type: 'number' },
          },
        },
      },
      avoidance_violations: {
        type: 'array',
        description: 'Any avoidance zone intersections (empty if clean)',
        items: {
          type: 'object',
          properties: {
            layer_name: { type: 'string' },
            station: { type: 'number' },
            offset_m: { type: 'number' },
          },
        },
      },
      compliance: {
        type: 'object',
        description: 'Design standard compliance summary',
        properties: {
          standard: { type: 'string' },
          passed: { type: 'boolean' },
          violations: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export const analyzeTerrainGradient: ToolSchema = {
  name: 'analyze_terrain_gradient',
  description:
    'Analyze terrain gradient along a polyline path or within a polygon area. ' +
    'Returns gradient statistics and identifies segments exceeding a threshold.',
  parameters: {
    type: 'object',
    properties: {
      path_entity_id: {
        type: 'string',
        description: 'Entity ID of the alignment or polyline to analyze along',
      },
      area_entity_id: {
        type: 'string',
        description: 'Entity ID of a polygon to analyze within (alternative to path)',
      },
      terrain_surface_id: {
        type: 'string',
        description: 'Entity ID of the terrain surface (TIN/DEM)',
      },
      sample_interval_m: {
        type: 'number',
        description: 'Distance between sample points along path (meters)',
        minimum: 0.5,
        maximum: 100,
        default: 10,
      },
      gradient_threshold_pct: {
        type: 'number',
        description: 'Flag segments steeper than this value (%)',
        minimum: 0.1,
        maximum: 100,
        default: 8,
      },
    },
    required: ['terrain_surface_id'],
  },
  returns: {
    type: 'object',
    description: 'Gradient analysis results',
    properties: {
      min_gradient_pct: { type: 'number', description: 'Minimum gradient found' },
      max_gradient_pct: { type: 'number', description: 'Maximum gradient found' },
      mean_gradient_pct: { type: 'number', description: 'Mean gradient' },
      exceeded_segments: {
        type: 'array',
        description: 'Segments exceeding threshold',
        items: {
          type: 'object',
          properties: {
            station_start: { type: 'number' },
            station_end: { type: 'number' },
            gradient_pct: { type: 'number' },
            lat: { type: 'number' },
            lon: { type: 'number' },
          },
        },
      },
      profile_samples: {
        type: 'array',
        description: 'Sampled elevation profile',
        items: {
          type: 'object',
          properties: {
            station: { type: 'number' },
            elevation: { type: 'number' },
            gradient_pct: { type: 'number' },
          },
        },
      },
    },
  },
};

export const checkSpatialIntersection: ToolSchema = {
  name: 'check_spatial_intersection',
  description:
    'Check whether a geometry entity intersects with entities in a specified ' +
    'layer or set of entities. Returns intersection details including area, ' +
    'length, and locations.',
  parameters: {
    type: 'object',
    properties: {
      source_entity_id: {
        type: 'string',
        description: 'Entity ID to check for intersections',
      },
      target_layer: {
        type: 'string',
        description: 'Layer name to check against (all entities in layer)',
      },
      target_entity_ids: {
        type: 'array',
        description: 'Specific entity IDs to check against (alternative to layer)',
        items: { type: 'string' },
      },
      buffer_m: {
        type: 'number',
        description: 'Buffer distance around source geometry (meters). 0 = exact intersection.',
        minimum: 0,
        maximum: 10000,
        default: 0,
      },
      intersection_type: {
        type: 'string',
        description: 'Type of spatial predicate to evaluate',
        enum: ['intersects', 'contains', 'within', 'crosses', 'overlaps', 'touches'],
        default: 'intersects',
      },
    },
    required: ['source_entity_id'],
  },
  returns: {
    type: 'object',
    description: 'Intersection analysis results',
    properties: {
      has_intersection: { type: 'boolean' },
      intersections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            target_entity_id: { type: 'string' },
            target_layer: { type: 'string' },
            intersection_area_m2: { type: 'number' },
            intersection_length_m: { type: 'number' },
            intersection_geometry_id: { type: 'string', description: 'Entity ID of computed intersection geometry' },
            centroid: {
              type: 'object',
              properties: {
                lat: { type: 'number' },
                lon: { type: 'number' },
              },
            },
          },
        },
      },
    },
  },
};

export const flagForReview: ToolSchema = {
  name: 'flag_for_review',
  description:
    'Flag an entity or a specific aspect of an entity for human review. ' +
    'Creates a review item in the project review queue with severity and context.',
  parameters: {
    type: 'object',
    properties: {
      entity_id: {
        type: 'string',
        description: 'Entity ID to flag',
      },
      severity: {
        type: 'string',
        description: 'Review urgency level',
        enum: ['info', 'warning', 'critical', 'safety'],
      },
      category: {
        type: 'string',
        description: 'Review category',
        enum: [
          'gradient_exceedance',
          'zone_violation',
          'structural_concern',
          'code_noncompliance',
          'clash_detected',
          'cost_overrun',
          'deviation_detected',
          'design_ambiguity',
          'agent_uncertainty',
        ],
      },
      title: {
        type: 'string',
        description: 'Short description of the issue (< 100 chars)',
      },
      detail: {
        type: 'string',
        description: 'Detailed explanation including relevant numbers and standards',
      },
      location: {
        type: 'object',
        description: 'Location of the issue for camera navigation',
        properties: {
          lat: { type: 'number' },
          lon: { type: 'number' },
          elevation: { type: 'number' },
          station: { type: 'number', description: 'Chainage/station if on alignment' },
        },
      },
      suggested_action: {
        type: 'string',
        description: 'What the agent recommends the human do',
      },
      related_entities: {
        type: 'array',
        description: 'Other entities relevant to this review',
        items: { type: 'string' },
      },
    },
    required: ['entity_id', 'severity', 'category', 'title', 'detail'],
  },
  returns: {
    type: 'object',
    description: 'Created review item',
    properties: {
      review_id: { type: 'string' },
      status: { type: 'string', description: 'Always "pending" on creation' },
      created_at: { type: 'string', description: 'ISO 8601 timestamp' },
    },
  },
};

// ---------------------------------------------------------------------------
// BIM / Structural Tools
// ---------------------------------------------------------------------------

export const generateStructuralFrame: ToolSchema = {
  name: 'generate_structural_frame',
  description:
    'Generate a structural frame (columns + beams) for a rectangular floor ' +
    'plate with specified grid spacing. Applies structural standards for ' +
    'member sizing based on span and load assumptions.',
  parameters: {
    type: 'object',
    properties: {
      floor_boundary_id: {
        type: 'string',
        description: 'Entity ID of the floor plate boundary polygon',
      },
      grid_spacing_x_m: {
        type: 'number',
        description: 'Column grid spacing in X direction (meters)',
        minimum: 3,
        maximum: 20,
        default: 8,
      },
      grid_spacing_y_m: {
        type: 'number',
        description: 'Column grid spacing in Y direction (meters)',
        minimum: 3,
        maximum: 20,
        default: 8,
      },
      num_floors: {
        type: 'number',
        description: 'Number of floors',
        minimum: 1,
        maximum: 200,
      },
      floor_height_m: {
        type: 'number',
        description: 'Floor-to-floor height (meters)',
        minimum: 2.5,
        maximum: 6,
        default: 3.5,
      },
      material: {
        type: 'string',
        description: 'Primary structural material',
        enum: ['steel', 'reinforced_concrete', 'composite', 'timber'],
      },
      design_code: {
        type: 'string',
        description: 'Structural design code',
        enum: ['AISC_360', 'Eurocode_3', 'ACI_318', 'Eurocode_2', 'AS_4100'],
        default: 'AISC_360',
      },
      live_load_kpa: {
        type: 'number',
        description: 'Design live load (kPa)',
        minimum: 1.5,
        maximum: 25,
        default: 2.5,
      },
    },
    required: ['floor_boundary_id', 'num_floors', 'material'],
  },
  returns: {
    type: 'object',
    description: 'Generated structural frame',
    properties: {
      frame_entity_id: { type: 'string', description: 'Root entity ID for the frame group' },
      column_count: { type: 'number' },
      beam_count: { type: 'number' },
      total_steel_tonnage_kg: { type: 'number' },
      column_sections: {
        type: 'array',
        description: 'Column section sizes used',
        items: { type: 'string' },
      },
      beam_sections: {
        type: 'array',
        description: 'Beam section sizes used',
        items: { type: 'string' },
      },
      compliance: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          passed: { type: 'boolean' },
          utilization_max: { type: 'number', description: 'Max member utilization ratio' },
        },
      },
    },
  },
};

export const analyzeFloodRisk: ToolSchema = {
  name: 'analyze_flood_risk',
  description:
    'Analyze flood risk for a site or entity by intersecting with flood zone ' +
    'layers and computing inundation depth at a given return period.',
  parameters: {
    type: 'object',
    properties: {
      site_entity_id: {
        type: 'string',
        description: 'Entity ID of the site boundary or building footprint',
      },
      flood_layer: {
        type: 'string',
        description: 'Layer name containing flood zone polygons',
        default: 'flood_zones',
      },
      return_periods: {
        type: 'array',
        description: 'Return periods to evaluate (years)',
        items: { type: 'number' },
        default: [10, 50, 100, 500],
      },
      terrain_surface_id: {
        type: 'string',
        description: 'Entity ID of the terrain DEM for depth calculation',
      },
    },
    required: ['site_entity_id', 'flood_layer'],
  },
  returns: {
    type: 'object',
    description: 'Flood risk analysis results',
    properties: {
      in_flood_zone: { type: 'boolean' },
      flood_zone_class: { type: 'string', description: 'FEMA zone (A, AE, V, X) or equivalent' },
      results_by_return_period: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            return_period_years: { type: 'number' },
            max_depth_m: { type: 'number' },
            affected_area_pct: { type: 'number' },
            base_flood_elevation_m: { type: 'number' },
          },
        },
      },
      recommended_ffl_m: {
        type: 'number',
        description: 'Recommended finished floor level (meters above datum)',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Clash Detection Tools
// ---------------------------------------------------------------------------

export const detectClashes: ToolSchema = {
  name: 'detect_clashes',
  description:
    'Run clash detection between two sets of entities (e.g., structural vs MEP). ' +
    'Uses BVH acceleration for O(n log n) performance.',
  parameters: {
    type: 'object',
    properties: {
      set_a_layer: {
        type: 'string',
        description: 'Layer name for first clash set (e.g., "structural")',
      },
      set_b_layer: {
        type: 'string',
        description: 'Layer name for second clash set (e.g., "mep_hvac")',
      },
      tolerance_m: {
        type: 'number',
        description: 'Minimum clearance required (meters). Clashes within this distance are flagged.',
        minimum: 0,
        maximum: 1,
        default: 0.025,
      },
      clash_type: {
        type: 'string',
        description: 'Type of clash to detect',
        enum: ['hard', 'clearance', 'duplicate'],
        default: 'hard',
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of clashes to return (sorted by severity)',
        minimum: 1,
        maximum: 10000,
        default: 100,
      },
    },
    required: ['set_a_layer', 'set_b_layer'],
  },
  returns: {
    type: 'object',
    description: 'Clash detection results',
    properties: {
      total_clashes: { type: 'number' },
      clashes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            clash_id: { type: 'string' },
            entity_a_id: { type: 'string' },
            entity_b_id: { type: 'string' },
            clash_type: { type: 'string' },
            overlap_volume_m3: { type: 'number' },
            clash_point: {
              type: 'object',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Quantity / Cost Tools
// ---------------------------------------------------------------------------

export const computeQuantityTakeoff: ToolSchema = {
  name: 'compute_quantity_takeoff',
  description:
    'Compute quantity takeoff (volumes, areas, lengths, counts) for entities ' +
    'in specified layers. Returns structured BOQ data.',
  parameters: {
    type: 'object',
    properties: {
      layers: {
        type: 'array',
        description: 'Layers to include in takeoff',
        items: { type: 'string' },
      },
      entity_types: {
        type: 'array',
        description: 'Filter by entity types (e.g., ["bim.wall", "bim.slab"])',
        items: { type: 'string' },
      },
      group_by: {
        type: 'string',
        description: 'How to group quantities',
        enum: ['entity_type', 'layer', 'material', 'floor', 'zone'],
        default: 'entity_type',
      },
      include_materials: {
        type: 'boolean',
        description: 'Include material breakdown',
        default: true,
      },
    },
    required: ['layers'],
  },
  returns: {
    type: 'object',
    description: 'Quantity takeoff results',
    properties: {
      groups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            group_key: { type: 'string' },
            count: { type: 'number' },
            total_volume_m3: { type: 'number' },
            total_area_m2: { type: 'number' },
            total_length_m: { type: 'number' },
            total_weight_kg: { type: 'number' },
            materials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  material: { type: 'string' },
                  volume_m3: { type: 'number' },
                  weight_kg: { type: 'number' },
                },
              },
            },
          },
        },
      },
      totals: {
        type: 'object',
        properties: {
          total_entities: { type: 'number' },
          total_volume_m3: { type: 'number' },
          total_area_m2: { type: 'number' },
        },
      },
    },
  },
};
