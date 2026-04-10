/**
 * Export kernel entities to DXF format string.
 * Generates a minimal but valid DXF R12/R2000 file.
 */

export function exportDxf(entitiesJson: string): string {
  let entities: any[];
  try {
    entities = JSON.parse(entitiesJson);
  } catch {
    return '';
  }

  const lines: string[] = [];

  // Header section
  lines.push('0', 'SECTION');
  lines.push('2', 'HEADER');
  lines.push('9', '$ACADVER');
  lines.push('1', 'AC1015'); // AutoCAD 2000
  lines.push('9', '$INSUNITS');
  lines.push('70', '6'); // meters
  lines.push('0', 'ENDSEC');

  // Tables section (minimal — layers)
  lines.push('0', 'SECTION');
  lines.push('2', 'TABLES');

  // Layer table
  lines.push('0', 'TABLE');
  lines.push('2', 'LAYER');
  lines.push('70', '1');

  lines.push('0', 'LAYER');
  lines.push('2', 'default');
  lines.push('70', '0');
  lines.push('62', '7'); // white
  lines.push('6', 'CONTINUOUS');

  lines.push('0', 'ENDTAB');
  lines.push('0', 'ENDSEC');

  // Entities section
  lines.push('0', 'SECTION');
  lines.push('2', 'ENTITIES');

  for (const ent of entities) {
    const g = ent.geometry;
    const layer = ent.layer_id || 'default';

    if (g.Line) {
      lines.push('0', 'LINE');
      lines.push('8', layer);
      lines.push('10', String(g.Line.start.x));
      lines.push('20', String(g.Line.start.y));
      lines.push('30', '0.0');
      lines.push('11', String(g.Line.end.x));
      lines.push('21', String(g.Line.end.y));
      lines.push('31', '0.0');
    }

    if (g.Circle) {
      lines.push('0', 'CIRCLE');
      lines.push('8', layer);
      lines.push('10', String(g.Circle.center.x));
      lines.push('20', String(g.Circle.center.y));
      lines.push('30', '0.0');
      lines.push('40', String(g.Circle.radius));
    }

    if (g.Arc) {
      lines.push('0', 'ARC');
      lines.push('8', layer);
      lines.push('10', String(g.Arc.center.x));
      lines.push('20', String(g.Arc.center.y));
      lines.push('30', '0.0');
      lines.push('40', String(g.Arc.radius));
      lines.push('50', String(g.Arc.start_angle * 180 / Math.PI));
      lines.push('51', String(g.Arc.end_angle * 180 / Math.PI));
    }

    if (g.Rectangle) {
      // DXF doesn't have a rectangle entity — emit as LWPOLYLINE
      const o = g.Rectangle.origin;
      const w = g.Rectangle.width;
      const h = g.Rectangle.height;
      lines.push('0', 'LWPOLYLINE');
      lines.push('8', layer);
      lines.push('90', '4'); // vertex count
      lines.push('70', '1'); // closed
      lines.push('10', String(o.x));
      lines.push('20', String(o.y));
      lines.push('10', String(o.x + w));
      lines.push('20', String(o.y));
      lines.push('10', String(o.x + w));
      lines.push('20', String(o.y + h));
      lines.push('10', String(o.x));
      lines.push('20', String(o.y + h));
    }

    if (g.Polyline) {
      lines.push('0', 'LWPOLYLINE');
      lines.push('8', layer);
      lines.push('90', String(g.Polyline.vertices.length));
      lines.push('70', g.Polyline.closed ? '1' : '0');
      for (const v of g.Polyline.vertices) {
        lines.push('10', String(v.x));
        lines.push('20', String(v.y));
      }
    }
  }

  lines.push('0', 'ENDSEC');

  // EOF
  lines.push('0', 'EOF');

  return lines.join('\n');
}
