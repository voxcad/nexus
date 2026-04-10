import type { EntityId } from './types';

export enum CommandType {
  CreateEntity = 'create_entity',
  DeleteEntity = 'delete_entity',
  MoveEntity = 'move_entity',
  ModifyEntity = 'modify_entity',
}

export interface CadEvent {
  id: string;
  timestamp: number;
  commandType: CommandType;
  entityId: EntityId;
  payload: unknown;
  source: 'user' | 'agent';
}

export interface EventStore {
  events: CadEvent[];
  cursor: number;
}
