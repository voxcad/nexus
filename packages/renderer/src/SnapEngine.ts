export interface SnapPoint {
  x: number;
  y: number;
  type: 'endpoint' | 'midpoint' | 'center' | 'intersection' | 'grid' | 'nearest';
}

export interface SnapConfig {
  enabled: boolean;
  gridSize: number;
  threshold: number; // in world units (will be computed from screen pixels)
  types: {
    endpoint: boolean;
    midpoint: boolean;
    center: boolean;
    intersection: boolean;
    grid: boolean;
  };
}

interface EntityData {
  id: string;
  geometry: any;
}

export class SnapEngine {
  public config: SnapConfig = {
    enabled: true,
    gridSize: 1,
    threshold: 2, // world units
    types: {
      endpoint: true,
      midpoint: true,
      center: true,
      intersection: true,
      grid: true,
    },
  };

  findSnap(worldX: number, worldY: number, entities: EntityData[]): SnapPoint | null {
    if (!this.config.enabled) return null;

    let best: SnapPoint | null = null;
    let bestDist = this.config.threshold;

    const check = (x: number, y: number, type: SnapPoint['type']) => {
      const d = Math.sqrt((worldX - x) ** 2 + (worldY - y) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = { x, y, type };
      }
    };

    for (const ent of entities) {
      const g = ent.geometry;

      if (g.Line && this.config.types.endpoint) {
        check(g.Line.start.x, g.Line.start.y, 'endpoint');
        check(g.Line.end.x, g.Line.end.y, 'endpoint');
        if (this.config.types.midpoint) {
          const mx = (g.Line.start.x + g.Line.end.x) / 2;
          const my = (g.Line.start.y + g.Line.end.y) / 2;
          check(mx, my, 'midpoint');
        }
      }

      if (g.Circle && this.config.types.center) {
        check(g.Circle.center.x, g.Circle.center.y, 'center');
        if (this.config.types.endpoint) {
          const c = g.Circle.center;
          const r = g.Circle.radius;
          check(c.x + r, c.y, 'endpoint');
          check(c.x - r, c.y, 'endpoint');
          check(c.x, c.y + r, 'endpoint');
          check(c.x, c.y - r, 'endpoint');
        }
      }

      if (g.Arc && this.config.types.center) {
        check(g.Arc.center.x, g.Arc.center.y, 'center');
        if (this.config.types.endpoint) {
          const c = g.Arc.center;
          const r = g.Arc.radius;
          check(c.x + r * Math.cos(g.Arc.start_angle), c.y + r * Math.sin(g.Arc.start_angle), 'endpoint');
          check(c.x + r * Math.cos(g.Arc.end_angle), c.y + r * Math.sin(g.Arc.end_angle), 'endpoint');
        }
      }

      if (g.Rectangle && this.config.types.endpoint) {
        const o = g.Rectangle.origin;
        const w = g.Rectangle.width;
        const h = g.Rectangle.height;
        check(o.x, o.y, 'endpoint');
        check(o.x + w, o.y, 'endpoint');
        check(o.x + w, o.y + h, 'endpoint');
        check(o.x, o.y + h, 'endpoint');
        if (this.config.types.center) {
          check(o.x + w / 2, o.y + h / 2, 'center');
        }
        if (this.config.types.midpoint) {
          check(o.x + w / 2, o.y, 'midpoint');
          check(o.x + w, o.y + h / 2, 'midpoint');
          check(o.x + w / 2, o.y + h, 'midpoint');
          check(o.x, o.y + h / 2, 'midpoint');
        }
      }

      if (g.Polyline && this.config.types.endpoint) {
        for (const v of g.Polyline.vertices) {
          check(v.x, v.y, 'endpoint');
        }
        if (this.config.types.midpoint) {
          const verts = g.Polyline.vertices;
          for (let i = 0; i < verts.length - 1; i++) {
            check((verts[i].x + verts[i + 1].x) / 2, (verts[i].y + verts[i + 1].y) / 2, 'midpoint');
          }
        }
      }
    }

    // Grid snap as fallback
    if (!best && this.config.types.grid) {
      const gs = this.config.gridSize;
      best = {
        x: Math.round(worldX / gs) * gs,
        y: Math.round(worldY / gs) * gs,
        type: 'grid',
      };
    }

    return best;
  }
}
