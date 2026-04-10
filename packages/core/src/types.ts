export type EntityId = string & { readonly __brand: 'EntityId' };

export interface Point2D {
  x: number;
  y: number;
}

export enum EntityType {
  Line = 'line',
  Circle = 'circle',
  Arc = 'arc',
  Polyline = 'polyline',
  Rectangle = 'rectangle',
  Text = 'text',
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export interface BaseEntity {
  id: EntityId;
  type: EntityType;
  layerId: string;
}

export interface LineEntity extends BaseEntity {
  type: EntityType.Line;
  start: Point2D;
  end: Point2D;
}

export interface CircleEntity extends BaseEntity {
  type: EntityType.Circle;
  center: Point2D;
  radius: number;
}

export interface ArcEntity extends BaseEntity {
  type: EntityType.Arc;
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface PolylineEntity extends BaseEntity {
  type: EntityType.Polyline;
  vertices: Point2D[];
  closed: boolean;
}

export interface RectangleEntity extends BaseEntity {
  type: EntityType.Rectangle;
  origin: Point2D;
  width: number;
  height: number;
  rotation: number;
}

export type CadEntity = LineEntity | CircleEntity | ArcEntity | PolylineEntity | RectangleEntity;
