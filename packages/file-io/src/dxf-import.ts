/**
 * Parse a DXF file string and convert to kernel-compatible entity data.
 * Uses dxf-parser library for parsing, then maps to our entity format.
 */

// dxf-parser default export
// @ts-ignore — dxf-parser has no proper type defs
import DxfParser from 'dxf-parser';

export interface ImportedEntity {
  type: string;
  geometry: any;
  layer: string;
}

export function parseDxf(dxfString: string): ImportedEntity[] {
  const parser = new DxfParser();
  let dxf: any;
  try {
    dxf = parser.parseSync(dxfString);
  } catch (e) {
    console.error('DXF parse error:', e);
    return [];
  }

  if (!dxf || !dxf.entities) return [];

  const entities: ImportedEntity[] = [];

  for (const ent of dxf.entities) {
    const layer = ent.layer || 'default';

    switch (ent.type) {
      case 'LINE':
        if (ent.vertices && ent.vertices.length >= 2) {
          entities.push({
            type: 'line',
            geometry: {
              Line: {
                start: { x: ent.vertices[0].x || 0, y: ent.vertices[0].y || 0 },
                end: { x: ent.vertices[1].x || 0, y: ent.vertices[1].y || 0 },
              },
            },
            layer,
          });
        }
        break;

      case 'CIRCLE':
        entities.push({
          type: 'circle',
          geometry: {
            Circle: {
              center: { x: ent.center?.x || 0, y: ent.center?.y || 0 },
              radius: ent.radius || 1,
            },
          },
          layer,
        });
        break;

      case 'ARC':
        entities.push({
          type: 'arc',
          geometry: {
            Arc: {
              center: { x: ent.center?.x || 0, y: ent.center?.y || 0 },
              radius: ent.radius || 1,
              start_angle: (ent.startAngle || 0) * Math.PI / 180,
              end_angle: (ent.endAngle || 360) * Math.PI / 180,
            },
          },
          layer,
        });
        break;

      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (ent.vertices && ent.vertices.length >= 2) {
          entities.push({
            type: 'polyline',
            geometry: {
              Polyline: {
                vertices: ent.vertices.map((v: any) => ({ x: v.x || 0, y: v.y || 0 })),
                closed: ent.shape || false,
              },
            },
            layer,
          });
        }
        break;

      // POINT, TEXT, DIMENSION etc. — skip for now
      default:
        break;
    }
  }

  return entities;
}
