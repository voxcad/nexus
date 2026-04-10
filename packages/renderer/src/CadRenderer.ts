import * as THREE from 'three';

export interface RenderableEntity {
  id: string;
  type: string;
  geometry: any;
  layerId: string;
  color?: string;
}

export class CadRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private gridHelper: THREE.Group;
  private entityMeshes: Map<string, THREE.Object3D> = new Map();

  private viewCenter = { x: 0, y: 0 };
  private zoom = 50;
  private container: HTMLElement;
  private width = 0;
  private height = 0;

  private isPanning = false;
  private lastMouse = { x: 0, y: 0 };

  public cursorWorld = { x: 0, y: 0 };

  public onCursorMove?: (x: number, y: number) => void;
  public onClick?: (worldX: number, worldY: number) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    const aspect = this.width / this.height;
    this.camera = new THREE.OrthographicCamera(
      -this.zoom * aspect, this.zoom * aspect,
      this.zoom, -this.zoom,
      -1000, 1000
    );
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.gridHelper = this.createGrid();
    this.scene.add(this.gridHelper);

    this.renderer.domElement.addEventListener('wheel', this.onWheel.bind(this));
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.renderer.domElement.addEventListener('click', this.onClickHandler.bind(this));

    const resizeObserver = new ResizeObserver(() => this.onResize());
    resizeObserver.observe(container);

    this.render();
  }

  private createGrid(): THREE.Group {
    const group = new THREE.Group();
    const gridSize = 1000;
    const step = this.getGridStep();
    const color = new THREE.Color(0x2a2a3e);
    const majorColor = new THREE.Color(0x3a3a4e);

    const material = new THREE.LineBasicMaterial({ color });
    const majorMaterial = new THREE.LineBasicMaterial({ color: majorColor });

    for (let i = -gridSize; i <= gridSize; i += step) {
      const isMajor = Math.abs(i % (step * 5)) < 0.001;
      const mat = isMajor ? majorMaterial : material;

      const vGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, -gridSize, 0),
        new THREE.Vector3(i, gridSize, 0),
      ]);
      group.add(new THREE.Line(vGeo, mat));

      const hGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-gridSize, i, 0),
        new THREE.Vector3(gridSize, i, 0),
      ]);
      group.add(new THREE.Line(hGeo, mat));
    }

    const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-gridSize, 0, 0),
      new THREE.Vector3(gridSize, 0, 0),
    ]);
    group.add(new THREE.Line(xAxisGeo, new THREE.LineBasicMaterial({ color: 0x4a2020 })));

    const yAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -gridSize, 0),
      new THREE.Vector3(0, gridSize, 0),
    ]);
    group.add(new THREE.Line(yAxisGeo, new THREE.LineBasicMaterial({ color: 0x204a20 })));

    return group;
  }

  private getGridStep(): number {
    if (this.zoom > 500) return 100;
    if (this.zoom > 200) return 50;
    if (this.zoom > 100) return 10;
    if (this.zoom > 50) return 5;
    if (this.zoom > 20) return 2;
    if (this.zoom > 5) return 1;
    return 0.5;
  }

  private updateCamera() {
    const aspect = this.width / this.height;
    this.camera.left = this.viewCenter.x - this.zoom * aspect;
    this.camera.right = this.viewCenter.x + this.zoom * aspect;
    this.camera.top = this.viewCenter.y + this.zoom;
    this.camera.bottom = this.viewCenter.y - this.zoom;
    this.camera.updateProjectionMatrix();
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;
    const aspect = this.width / this.height;
    return {
      x: this.viewCenter.x + ndcX * this.zoom * aspect,
      y: this.viewCenter.y + ndcY * this.zoom,
    };
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

    const before = this.screenToWorld(e.clientX, e.clientY);
    this.zoom *= zoomFactor;
    this.zoom = Math.max(1, Math.min(10000, this.zoom));
    this.updateCamera();
    const after = this.screenToWorld(e.clientX, e.clientY);

    this.viewCenter.x += before.x - after.x;
    this.viewCenter.y += before.y - after.y;
    this.updateCamera();
    this.render();
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      this.isPanning = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.renderer.domElement.style.cursor = 'grabbing';
    }
  }

  private onMouseMove(e: MouseEvent) {
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.cursorWorld = world;
    this.onCursorMove?.(world.x, world.y);

    if (this.isPanning) {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      const aspect = this.width / this.height;

      this.viewCenter.x -= (dx / this.width) * 2 * this.zoom * aspect;
      this.viewCenter.y += (dy / this.height) * 2 * this.zoom;

      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.updateCamera();
      this.render();
    }
  }

  private onMouseUp(_e: MouseEvent) {
    if (this.isPanning) {
      this.isPanning = false;
      this.renderer.domElement.style.cursor = 'crosshair';
    }
  }

  private onClickHandler(e: MouseEvent) {
    if (e.shiftKey) return;
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.onClick?.(world.x, world.y);
  }

  private onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.renderer.setSize(this.width, this.height);
    this.updateCamera();
    this.render();
  }

  public syncEntities(entitiesJson: string, layerColors: Map<string, string>) {
    let entities: any[];
    try {
      entities = JSON.parse(entitiesJson);
    } catch {
      return;
    }

    for (const [_id, obj] of this.entityMeshes) {
      this.scene.remove(obj);
    }
    this.entityMeshes.clear();

    for (const entity of entities) {
      const colorHex = layerColors.get(entity.layer_id) || '#00ff88';
      const color = new THREE.Color(colorHex);
      const material = new THREE.LineBasicMaterial({ color });

      let object: THREE.Object3D | null = null;
      const geom = entity.geometry;

      if (geom.Line) {
        const { start, end } = geom.Line;
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(start.x, start.y, 0),
          new THREE.Vector3(end.x, end.y, 0),
        ]);
        object = new THREE.Line(geo, material);
      } else if (geom.Circle) {
        const { center, radius } = geom.Circle;
        const curve = new THREE.EllipseCurve(center.x, center.y, radius, radius, 0, Math.PI * 2, false, 0);
        const points = curve.getPoints(64);
        const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, p.y, 0)));
        object = new THREE.Line(geo, material);
      } else if (geom.Arc) {
        const { center, radius, start_angle, end_angle } = geom.Arc;
        const curve = new THREE.EllipseCurve(center.x, center.y, radius, radius, start_angle, end_angle, false, 0);
        const points = curve.getPoints(64);
        const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, p.y, 0)));
        object = new THREE.Line(geo, material);
      } else if (geom.Polyline) {
        const { vertices, closed } = geom.Polyline;
        const pts = vertices.map((v: any) => new THREE.Vector3(v.x, v.y, 0));
        if (closed && pts.length > 0) pts.push(pts[0].clone());
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        object = new THREE.Line(geo, material);
      } else if (geom.Rectangle) {
        const { origin, width, height, rotation } = geom.Rectangle;
        const pts = [
          new THREE.Vector3(origin.x, origin.y, 0),
          new THREE.Vector3(origin.x + width, origin.y, 0),
          new THREE.Vector3(origin.x + width, origin.y + height, 0),
          new THREE.Vector3(origin.x, origin.y + height, 0),
          new THREE.Vector3(origin.x, origin.y, 0),
        ];
        if (rotation !== 0) {
          const cx = origin.x + width / 2;
          const cy = origin.y + height / 2;
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          for (const p of pts) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            p.x = cx + dx * cos - dy * sin;
            p.y = cy + dx * sin + dy * cos;
          }
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        object = new THREE.Line(geo, material);
      }

      if (object) {
        object.userData.entityId = entity.id;
        this.scene.add(object);
        this.entityMeshes.set(entity.id, object);
      }
    }

    this.render();
  }

  public zoomExtents() {
    if (this.entityMeshes.size === 0) return;

    const box = new THREE.Box3();
    for (const obj of this.entityMeshes.values()) {
      box.expandByObject(obj);
    }

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.viewCenter = { x: center.x, y: center.y };
    this.zoom = Math.max(size.x / 2, size.y / 2) * 1.2;
    this.zoom = Math.max(this.zoom, 5);

    this.updateCamera();
    this.render();
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  public getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
