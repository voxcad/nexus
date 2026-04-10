import * as THREE from 'three';

export interface SelectionState {
  selectedIds: Set<string>;
}

export class SelectionManager {
  public selectedIds: Set<string> = new Set();
  private highlightMeshes: Map<string, THREE.Object3D> = new Map();
  private gripMeshes: THREE.Object3D[] = [];
  private scene: THREE.Scene;

  // Colors
  private highlightColor = new THREE.Color(0x00bfff); // cyan
  private gripColor = new THREE.Color(0x00bfff);
  private gripSize = 0.4; // world units, will be adjusted by zoom

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  select(id: string) {
    this.selectedIds.add(id);
  }

  deselect(id: string) {
    this.selectedIds.delete(id);
  }

  clear() {
    this.selectedIds.clear();
    this.clearVisuals();
  }

  toggle(id: string) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  hitTest(worldX: number, worldY: number, entityMeshes: Map<string, THREE.Object3D>, threshold: number): string | null {
    let closestId: string | null = null;
    let closestDist = threshold;

    const point = new THREE.Vector3(worldX, worldY, 0);

    for (const [id, obj] of entityMeshes) {
      const box = new THREE.Box3().setFromObject(obj);
      const boxDist = box.distanceToPoint(point);

      if (boxDist < closestDist) {
        if (obj instanceof THREE.Line) {
          const positions = (obj.geometry as THREE.BufferGeometry).getAttribute('position');
          if (positions) {
            for (let i = 0; i < positions.count - 1; i++) {
              const ax = positions.getX(i), ay = positions.getY(i);
              const bx = positions.getX(i + 1), by = positions.getY(i + 1);
              const d = this.pointToSegmentDist(worldX, worldY, ax, ay, bx, by);
              if (d < closestDist) {
                closestDist = d;
                closestId = id;
              }
            }
          }
        }
      }
    }

    return closestId;
  }

  private pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx, projY = ay + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  updateVisuals(entityMeshes: Map<string, THREE.Object3D>, entities: any[], zoom: number) {
    this.clearVisuals();

    const gripSize = zoom * 0.008;

    for (const id of this.selectedIds) {
      const mesh = entityMeshes.get(id);
      if (!mesh || !(mesh instanceof THREE.Line)) continue;

      const highlight = mesh.clone();
      (highlight as THREE.Line).material = new THREE.LineBasicMaterial({
        color: this.highlightColor,
        linewidth: 2,
      });
      highlight.position.z = 0.1;
      this.scene.add(highlight);
      this.highlightMeshes.set(id, highlight);

      const entity = entities.find((e: any) => e.id === id);
      if (!entity) continue;

      const gripPoints = this.getGripPoints(entity);
      for (const gp of gripPoints) {
        const geo = new THREE.BoxGeometry(gripSize, gripSize, 0.01);
        const mat = new THREE.MeshBasicMaterial({ color: this.gripColor });
        const grip = new THREE.Mesh(geo, mat);
        grip.position.set(gp.x, gp.y, 0.2);
        this.scene.add(grip);
        this.gripMeshes.push(grip);
      }
    }
  }

  private getGripPoints(entity: any): { x: number; y: number }[] {
    const g = entity.geometry;
    const points: { x: number; y: number }[] = [];

    if (g.Line) {
      points.push(g.Line.start, g.Line.end);
      points.push({
        x: (g.Line.start.x + g.Line.end.x) / 2,
        y: (g.Line.start.y + g.Line.end.y) / 2,
      });
    } else if (g.Circle) {
      const c = g.Circle.center, r = g.Circle.radius;
      points.push(c);
      points.push({ x: c.x + r, y: c.y }, { x: c.x - r, y: c.y });
      points.push({ x: c.x, y: c.y + r }, { x: c.x, y: c.y - r });
    } else if (g.Arc) {
      const c = g.Arc.center, r = g.Arc.radius;
      points.push(c);
      points.push({ x: c.x + r * Math.cos(g.Arc.start_angle), y: c.y + r * Math.sin(g.Arc.start_angle) });
      points.push({ x: c.x + r * Math.cos(g.Arc.end_angle), y: c.y + r * Math.sin(g.Arc.end_angle) });
    } else if (g.Rectangle) {
      const o = g.Rectangle.origin, w = g.Rectangle.width, h = g.Rectangle.height;
      points.push(o, { x: o.x + w, y: o.y }, { x: o.x + w, y: o.y + h }, { x: o.x, y: o.y + h });
      points.push({ x: o.x + w / 2, y: o.y + h / 2 });
    } else if (g.Polyline) {
      for (const v of g.Polyline.vertices) points.push(v);
    }

    return points;
  }

  clearVisuals() {
    for (const obj of this.highlightMeshes.values()) {
      this.scene.remove(obj);
    }
    this.highlightMeshes.clear();
    for (const obj of this.gripMeshes) {
      this.scene.remove(obj);
    }
    this.gripMeshes = [];
  }
}
