# NEXUS Design Patterns

> Architectural patterns for a browser-native spatial engineering platform unifying Civil, BIM, GIS, Surveying, Remote Sensing, and Construction. AI agents are first-class users.

Each pattern includes rationale, TypeScript interface sketches, and NEXUS-specific application.

---

## D1 -- Hexagonal Architecture for the Geometry Kernel

### Rationale

The geometry kernel is the most critical subsystem in NEXUS. It must be testable without a browser, callable by AI agents without DOM access, and swappable between WASM backends (OpenCASCADE, CGAL). Hexagonal architecture isolates the pure domain model behind port interfaces. Every adapter -- rendering, persistence, HTTP API, agent protocol -- plugs into the same ports. The kernel becomes a pure function layer: input geometry + operation = output geometry, zero side effects.

This is non-negotiable for a platform where AI agents and human users share the same geometry pipeline. An agent running in a Worker thread calls `IGeometryKernel.boolean()` through the exact same port as a UI button handler. No DOM, no WebGL context, no database connection required.

### Port Interfaces

```typescript
// --- Primary Ports (driven by application) ---

interface IGeometryKernel {
  boolean(op: BooleanOp, a: GeometryHandle, b: GeometryHandle): Result<GeometryHandle>;
  offset(geom: GeometryHandle, distance: number, tolerance: number): Result<GeometryHandle>;
  fillet(geom: GeometryHandle, edges: EdgeId[], radius: number): Result<GeometryHandle>;
  tessellate(geom: GeometryHandle, params: TessellationParams): Result<MeshData>;
  measure(geom: GeometryHandle, query: MeasureQuery): Result<MeasureResult>;
  transform(geom: GeometryHandle, matrix: Mat4): Result<GeometryHandle>;
}

interface ISpatialIndex {
  insert(id: EntityId, bounds: AABB): void;
  remove(id: EntityId): void;
  query(region: AABB): EntityId[];
  queryRay(origin: Vec3, direction: Vec3, maxDist: number): RayHit[];
  queryFrustum(frustum: Frustum): EntityId[];
  nearest(point: Vec3, k: number): EntityId[];
}

interface ICoordinateTransformer {
  register(crs: CRSDefinition): void;
  transform(coords: Float64Array, from: EPSG, to: EPSG): Float64Array;
  projectToLocal(coords: Float64Array, origin: GeodeticPoint): Float64Array;
  localToProject(coords: Float64Array, origin: GeodeticPoint): Float64Array;
}

// --- Secondary Ports (driven by infrastructure) ---

interface IPersistenceAdapter {
  saveSnapshot(projectId: string, state: SerializedState): Promise<void>;
  loadSnapshot(projectId: string): Promise<SerializedState | null>;
  appendEvents(projectId: string, events: DomainEvent[]): Promise<void>;
  streamEvents(projectId: string, after: EventSequence): AsyncIterable<DomainEvent>;
}

interface IRenderAdapter {
  submitMesh(id: EntityId, mesh: MeshData, material: MaterialHandle): void;
  submitInstances(proto: PrototypeId, transforms: Float32Array, count: number): void;
  removeMesh(id: EntityId): void;
  updateTransform(id: EntityId, matrix: Mat4): void;
  pick(screenX: number, screenY: number): EntityId | null;
}
```

### Hexagonal Wiring

```typescript
function createNexusKernel(config: KernelConfig): NexusApplication {
  // Pure domain -- no dependencies on adapters
  const kernel: IGeometryKernel = createWasmKernel(config.wasmModule);
  const spatialIndex: ISpatialIndex = createRTree({ maxEntries: 16 });
  const transformer: ICoordinateTransformer = createProj4Transformer();

  // Adapters -- plugged into ports, never imported by domain
  const persistence: IPersistenceAdapter = config.persistence === 'indexeddb'
    ? createIndexedDBAdapter(config.dbName)
    : createOpfsAdapter(config.opfsRoot);

  const renderer: IRenderAdapter = createWebGPUAdapter(config.canvas);

  // Application services orchestrate ports -- this is the only
  // layer that knows about both domain and adapters
  const commandBus = createCommandBus({ kernel, spatialIndex, transformer });
  const queryBus = createQueryBus({ spatialIndex, persistence });

  // AI agents connect through the same command/query bus
  // No DOM, no canvas, no browser API required
  const agentPort: IAgentPort = {
    execute: (cmd) => commandBus.dispatch(cmd),
    query: (q) => queryBus.handle(q),
    subscribe: (filter, cb) => commandBus.on(filter, cb),
  };

  return { commandBus, queryBus, agentPort, destroy: () => { /* teardown */ } };
}
```

### NEXUS Application

An AI structural analysis agent running in a dedicated Worker calls `agentPort.execute({ type: 'boolean', op: 'subtract', a: slabHandle, b: openingHandle })`. The command travels through the bus, hits `IGeometryKernel.boolean()`, produces a new `GeometryHandle`, emits an event, and the render adapter picks it up asynchronously. The agent never imports WebGPU, never touches the DOM. Swapping from OpenCASCADE to CGAL means replacing one `IGeometryKernel` implementation -- zero changes to agents, UI, or persistence.

---

## D2 -- Entity-Component-System for Spatial Objects

### Rationale

Traditional CAD uses deep OOP hierarchies: `Shape > Solid > BRepSolid > StructuralColumn`. This falls apart when a single entity is simultaneously a BIM column, a GIS feature, a collision body, an AI annotation target, and a streaming tile. You get diamond inheritance, fragile base classes, and objects that don't fit any single hierarchy.

ECS solves this with composition. An entity is just an integer ID. Behavior comes from components (data) and systems (logic). A structural column is `EntityId + Transform + Geometry + BIMProperties + CollisionMask + RenderState`. Adding AI annotations means attaching one more component -- no class hierarchy change.

For 500k concurrent spatial entities, ECS wins on raw performance. Components of the same type are stored in contiguous typed arrays (SoA layout). Systems iterate over these arrays linearly -- perfect cache locality. Sparse iteration via bitset masks means systems only touch entities that have the required components. This is the difference between 60fps and 15fps at scale.

### Interfaces

```typescript
type EntityId = number & { readonly __brand: unique symbol };

// Component storage -- struct-of-arrays for cache locality
interface ComponentStore<T> {
  readonly componentId: number;
  has(entity: EntityId): boolean;
  get(entity: EntityId): T | undefined;
  set(entity: EntityId, data: T): void;
  remove(entity: EntityId): void;
  /** Dense iteration over all entities holding this component */
  entries(): IterableIterator<[EntityId, T]>;
  /** Typed array backing store for numeric components (Transform, etc.) */
  raw(): ArrayBuffer | null;
}

interface Transform {
  position: Float64Array;  // [x, y, z] -- Float64 for survey-grade precision
  rotation: Float32Array;  // [qx, qy, qz, qw]
  scale: Float32Array;     // [sx, sy, sz]
  localToWorld: Float64Array; // 4x4 matrix, computed by TransformSystem
}

interface Geometry {
  kernelHandle: number;    // opaque handle into WASM geometry kernel
  meshVersion: number;     // incremented on re-tessellation
  boundingBox: Float64Array; // [minX, minY, minZ, maxX, maxY, maxZ]
  lod: LODLevel;
}

interface BIMProperties {
  ifcClass: string;        // e.g. "IfcColumn", "IfcSlab"
  psets: Map<string, Record<string, PropertyValue>>;
  level: EntityId;         // reference to IfcBuildingStorey entity
  system: DisciplineTag;   // structural | architectural | mep | civil
}

interface GISAttributes {
  featureId: string;
  layerId: string;
  crs: EPSG;
  attributes: Record<string, unknown>;
}

interface AIAnnotation {
  agentId: string;
  confidence: number;
  label: string;
  reasoning: string;
  timestamp: number;
  conflictsWith?: EntityId[];
}

interface StreamingState {
  tileKey: string;
  lodLevel: number;
  loadState: 'pending' | 'loading' | 'ready' | 'evicted';
  byteSize: number;
  lastAccessFrame: number;
}

interface RenderState {
  visible: boolean;
  selected: boolean;
  highlighted: boolean;
  materialOverride: MaterialHandle | null;
  layer: RenderLayer;
}

interface CollisionMask {
  group: number;    // bitfield
  filter: number;   // bitfield
  isStatic: boolean;
}
```

### ECS World and System Loop

```typescript
interface World {
  createEntity(): EntityId;
  destroyEntity(entity: EntityId): void;
  alive(entity: EntityId): boolean;

  registerComponent<T>(name: string): ComponentStore<T>;
  getStore<T>(name: string): ComponentStore<T>;

  registerSystem(system: System, phase: SystemPhase): void;
  tick(dt: number): void;

  /** Query builder -- cached archetypes for fast iteration */
  query(...components: string[]): QueryResult;
}

type SystemPhase = 'input' | 'simulation' | 'constraint' | 'render-prep' | 'sync';

interface System {
  readonly name: string;
  readonly phase: SystemPhase;
  readonly reads: string[];   // component names read
  readonly writes: string[];  // component names written
  execute(world: World, dt: number): void;
}

interface QueryResult {
  /** Iterate entity IDs matching the archetype */
  [Symbol.iterator](): IterableIterator<EntityId>;
  /** Count without allocation */
  count(): number;
  /** Parallel chunk iteration for worker distribution */
  chunks(size: number): IterableIterator<EntityId[]>;
}

// System implementations
const RenderSystem: System = {
  name: 'RenderSystem',
  phase: 'render-prep',
  reads: ['Transform', 'Geometry', 'RenderState'],
  writes: [],
  execute(world, _dt) {
    for (const eid of world.query('Transform', 'Geometry', 'RenderState')) {
      // submit draw calls from contiguous component arrays
    }
  },
};

const AgentQuerySystem: System = {
  name: 'AgentQuerySystem',
  phase: 'simulation',
  reads: ['Transform', 'BIMProperties', 'AIAnnotation'],
  writes: ['AIAnnotation'],
  execute(world, _dt) {
    // Process pending agent queries against spatial index
    // Agents query by BIM class, spatial region, or annotation label
    // Results streamed back via message port
  },
};
```

### NEXUS Application

A LiDAR point cloud import creates 200k entities each with `Transform + Geometry + GISAttributes + StreamingState`. A BIM import creates 50k entities each with `Transform + Geometry + BIMProperties + CollisionMask + RenderState`. An AI classification agent attaches `AIAnnotation` to 10k of those entities. All share the same world, iterable in the same frame. The `ConstraintSystem` can query entities that have both `BIMProperties` and `GISAttributes` to detect BIM-GIS alignment conflicts. No inheritance hierarchy could model this cross-domain composition.

---

## D3 -- Event Sourcing + CQRS for Engineering Document Model

### Rationale

Engineering design is inherently an append-only process. Every sketch, every dimension change, every structural modification is a decision. Traditional CRUD overwrites state -- you lose the reasoning chain. Event sourcing preserves every operation as an immutable event. The current state is a left-fold over the event log.

This gives NEXUS four capabilities no CRUD model can match:

1. **Infinite undo/redo** -- walk the event log backward/forward. No "undo stack limit."
2. **Audit trail** -- every change has a timestamp, author (human or agent), and context. Critical for engineering liability.
3. **AI replay** -- agents replay a human's design session event-by-event, learning the decision sequence. An agent can fork the event log at any point and explore alternative designs.
4. **Time-travel debugging** -- materialize the project state at any point in history. "Show me the structural model as of Tuesday 3pm before the MEP agent ran."

CQRS separates the write path (command handlers that validate and emit events) from the read path (projections optimized for specific queries). The spatial index, the BIM property database, and the render scene graph are all read-model projections rebuilt from events.

### Interfaces

```typescript
type EventSequence = number & { readonly __brand: unique symbol };

interface DomainEvent {
  readonly sequence: EventSequence;
  readonly timestamp: number;
  readonly projectId: string;
  readonly authorId: string;        // human user or agent ID
  readonly authorType: 'human' | 'agent';
  readonly correlationId: string;   // links related events
  readonly causationId: string;     // the command that caused this event
  readonly type: EventType;
  readonly payload: EventPayload;
}

type EventType =
  | 'EntityCreated'
  | 'EntityDeleted'
  | 'EntityTransformed'
  | 'GeometryModified'
  | 'PropertyChanged'
  | 'ConstraintApplied'
  | 'ConstraintRemoved'
  | 'AgentDecision'
  | 'AgentConflictDetected'
  | 'AgentConflictResolved'
  | 'SnapshotCreated';

interface EntityCreatedPayload {
  entityId: EntityId;
  components: Record<string, unknown>;
  sourceFormat?: string;  // 'IFC' | 'Shapefile' | 'LAS' | 'manual'
}

interface AgentDecisionPayload {
  entityId: EntityId;
  agentId: string;
  action: string;
  reasoning: string;
  confidence: number;
  alternatives: Array<{ action: string; score: number }>;
}

// --- Event Store ---

interface EventStore {
  append(projectId: string, events: DomainEvent[], expectedVersion: EventSequence): Promise<void>;
  read(projectId: string, after: EventSequence, limit: number): Promise<DomainEvent[]>;
  stream(projectId: string, after: EventSequence): AsyncIterable<DomainEvent>;
  /** Snapshot for fast reconstruction -- replayed from snapshot + subsequent events */
  saveSnapshot(projectId: string, state: SerializedState, atSequence: EventSequence): Promise<void>;
  loadLatestSnapshot(projectId: string): Promise<{ state: SerializedState; sequence: EventSequence } | null>;
}

// --- CQRS: Command Side ---

interface Command {
  readonly type: string;
  readonly authorId: string;
  readonly authorType: 'human' | 'agent';
  readonly correlationId: string;
  readonly payload: unknown;
}

interface CommandHandler<C extends Command = Command> {
  readonly commandType: string;
  validate(cmd: C, state: ReadonlyProjectState): Result<void>;
  execute(cmd: C, state: ReadonlyProjectState): DomainEvent[];
}

// --- CQRS: Query Side ---

interface Projection<TState> {
  readonly name: string;
  readonly initialState: TState;
  apply(state: TState, event: DomainEvent): TState;
}

interface QueryHandler<TQuery, TResult> {
  readonly queryType: string;
  handle(query: TQuery, projections: ProjectionRegistry): TResult;
}

interface ProjectionRegistry {
  register<T>(projection: Projection<T>): void;
  get<T>(name: string): T;
  /** Rebuild projection from event log -- used for new projection types */
  rebuild(name: string, events: AsyncIterable<DomainEvent>): Promise<void>;
}
```

### Materialization Pipeline

```typescript
// Projections are specialized read models

const SpatialIndexProjection: Projection<ISpatialIndex> = {
  name: 'spatialIndex',
  initialState: createRTree({ maxEntries: 16 }),
  apply(index, event) {
    switch (event.type) {
      case 'EntityCreated': {
        const p = event.payload as EntityCreatedPayload;
        if (p.components['Geometry']) {
          index.insert(p.entityId, computeAABB(p.components['Geometry']));
        }
        return index;
      }
      case 'EntityTransformed':
        index.remove(event.payload.entityId);
        index.insert(event.payload.entityId, event.payload.newBounds);
        return index;
      case 'EntityDeleted':
        index.remove(event.payload.entityId);
        return index;
      default:
        return index;
    }
  },
};

// AI replay: fork event log and explore alternatives
async function replayDesignSession(
  store: EventStore,
  projectId: string,
  fromSequence: EventSequence,
  toSequence: EventSequence,
  agentHandler: (event: DomainEvent, state: ReadonlyProjectState) => AgentDecisionPayload | null,
): Promise<DomainEvent[]> {
  const agentEvents: DomainEvent[] = [];
  let state = await rebuildState(store, projectId, fromSequence);

  for await (const event of store.stream(projectId, fromSequence)) {
    if (event.sequence > toSequence) break;
    state = applyEvent(state, event);
    const decision = agentHandler(event, state);
    if (decision) {
      agentEvents.push(createAgentEvent(decision, event.sequence));
    }
  }
  return agentEvents;
}
```

### NEXUS Application

An architect spends two hours detailing a floor plan. Every wall placement, every dimension snap, every constraint is an event. Later, the structural AI agent replays this session, observing that the architect placed a load-bearing wall at a specific location. The agent forks the event stream, applies structural analysis, and proposes a column grid that respects the architectural intent. The original event stream is untouched. The agent's proposed changes are a separate branch of events that can be merged, rejected, or compared side-by-side. Time-travel to "before the MEP agent ran" is a projection rebuild up to that event sequence.

---

## D4 -- Worker Thread Pool for Parallel WASM Computation

### Rationale

Browser main thread budget is 16ms per frame. A single boolean operation on complex BRep geometry takes 50-500ms. A terrain surface triangulation from a LiDAR point cloud takes seconds. GDAL raster reprojection takes seconds. None of this can run on the main thread.

NEXUS runs a pool of N Web Workers (typically `navigator.hardwareConcurrency` -- 4 to 16 on modern machines), each holding a pre-initialized WASM module instance. Tasks are submitted to a priority queue, routed to available workers, and results transferred back via `SharedArrayBuffer` for zero-copy geometry handoff.

The critical design decision: WASM module instances are expensive to initialize (100-500ms for OpenCASCADE). Workers are long-lived, not spawned per task. The pool pre-warms on application start. Tasks are message objects, not code -- the worker has the WASM module, it just needs the operation descriptor and input geometry handles.

### Interfaces

```typescript
type TaskId = string & { readonly __brand: unique symbol };

const enum TaskPriority {
  /** User-initiated operations (click, drag) -- must feel instant */
  Interactive = 0,
  /** AI agent requests -- high but below interactive */
  Agent = 1,
  /** Background computation (LOD generation, spatial indexing) */
  Background = 2,
  /** Prefetch and speculative computation */
  Speculative = 3,
}

interface Task<TResult = unknown> {
  readonly id: TaskId;
  readonly priority: TaskPriority;
  readonly module: 'opencascade' | 'gdal' | 'cgal' | 'custom';
  readonly operation: string;
  readonly params: Record<string, unknown>;
  /** Handles to SharedArrayBuffer regions for input geometry */
  readonly inputBuffers: SharedGeometryRef[];
  /** Abort signal propagated to worker */
  readonly signal?: AbortSignal;
  /** Estimated cost in ms -- used for load balancing */
  readonly estimatedMs?: number;
}

interface TaskResult<T = unknown> {
  readonly taskId: TaskId;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly value?: T;
  readonly error?: string;
  /** Handles to SharedArrayBuffer regions for output geometry */
  readonly outputBuffers: SharedGeometryRef[];
  readonly metrics: {
    queuedMs: number;
    executionMs: number;
    transferMs: number;
    workerIndex: number;
  };
}

interface SharedGeometryRef {
  /** Underlying SharedArrayBuffer */
  readonly buffer: SharedArrayBuffer;
  /** Byte offset into the buffer */
  readonly byteOffset: number;
  /** Byte length of this geometry region */
  readonly byteLength: number;
  /** Layout descriptor for interpreting the buffer */
  readonly layout: BufferLayout;
}

interface BufferLayout {
  readonly type: 'mesh' | 'pointcloud' | 'brep-serialized' | 'raster';
  readonly vertexStride?: number;
  readonly indexType?: 'uint16' | 'uint32';
  readonly vertexCount?: number;
  readonly indexCount?: number;
}

interface SharedGeometryBuffer {
  /** Pre-allocated SharedArrayBuffer pool to avoid allocation per task */
  allocate(byteLength: number): SharedGeometryRef;
  release(ref: SharedGeometryRef): void;
  /** Defragment the pool -- run during idle frames */
  compact(): void;
  readonly stats: { allocated: number; free: number; fragmentation: number };
}

interface WorkerPool {
  readonly size: number;
  readonly pending: number;
  readonly active: number;

  /** Submit a task -- returns a promise that resolves with the result */
  submit<T>(task: Task<T>): Promise<TaskResult<T>>;

  /** Submit and stream partial results (e.g., progressive tessellation) */
  submitStreaming<T>(task: Task<T>): AsyncIterable<Partial<TaskResult<T>>>;

  /** Cancel all tasks for a given correlation (e.g., user cancelled operation) */
  cancelCorrelation(correlationId: string): void;

  /** Drain queue -- wait for all pending tasks to complete */
  drain(): Promise<void>;

  /** Backpressure signal -- true when queue depth exceeds threshold */
  readonly saturated: boolean;

  destroy(): Promise<void>;
}
```

### Lifecycle

```typescript
async function createWorkerPool(config: PoolConfig): Promise<WorkerPool> {
  const workers = await Promise.all(
    Array.from({ length: config.size }, (_, i) =>
      spawnWorker(i, config.wasmModuleUrl, config.sharedMemory)
    )
  );

  const queue = createPriorityQueue<Task>();
  const sharedBuffer = createSharedGeometryBuffer(config.sharedBufferBytes);

  // Dispatch loop: pull highest-priority task, route to least-loaded worker
  async function dispatch() {
    while (true) {
      const task = await queue.take(); // blocks until task available
      const worker = selectWorker(workers); // least-loaded or affinity-based

      worker.postMessage({
        type: 'execute',
        taskId: task.id,
        operation: task.operation,
        params: task.params,
        inputBuffers: task.inputBuffers, // SharedArrayBuffer refs -- zero copy
      });
    }
  }

  // Worker sends result back -- SharedArrayBuffer refs point to output
  // Main thread reads directly from shared memory, no structured clone
  function onWorkerResult(workerIndex: number, msg: WorkerMessage) {
    if (msg.type === 'result') {
      resolveTask(msg.taskId, {
        status: 'completed',
        outputBuffers: msg.outputBuffers, // zero-copy -- same SharedArrayBuffer
        metrics: msg.metrics,
      });
    }
  }

  return { submit, submitStreaming, cancelCorrelation, drain, destroy, /* ... */ };
}
```

### NEXUS Application

A civil engineer imports a 2GB LiDAR point cloud. The parser splits it into chunks and submits 64 `Task<PointCloudChunk>` items at `Background` priority. Meanwhile, the engineer clicks to create a road alignment -- that boolean operation is `Interactive` priority and jumps the queue. The pool routes it to the first available worker. The WASM OpenCASCADE instance computes the boolean in 80ms in the worker. The result mesh is written directly into `SharedArrayBuffer`. The main thread reads the mesh data for rendering without any copy. The 64 point cloud tasks continue processing in the background across remaining workers.

---

## D5 -- Multi-Agent Negotiation Protocol

### Rationale

In a multi-discipline engineering project, AI agents representing different domains will inevitably conflict. The structural agent wants a column at grid intersection F6. The MEP agent wants to route ductwork through that exact location. The cost optimization agent flags both proposals as over-budget. These conflicts cannot be resolved by any single agent -- they require negotiation.

NEXUS treats agents as independent Workers communicating through a structured message-passing protocol. A Supervisor agent (or human) arbitrates conflicts using a priority hierarchy: life-safety > structural integrity > MEP routing > architectural intent > cost optimization. When constraint satisfaction is infeasible or confidence drops below 0.7, the system escalates to a human engineer with full context.

### Interfaces

```typescript
type AgentId = string & { readonly __brand: unique symbol };
type NegotiationId = string & { readonly __brand: unique symbol };

const enum AgentDiscipline {
  Structural = 'structural',
  MEP = 'mep',
  Architectural = 'architectural',
  Civil = 'civil',
  CostOptimization = 'cost',
  Surveying = 'surveying',
  Environmental = 'environmental',
}

/** Discipline priority -- higher number = higher authority in conflict */
const DISCIPLINE_PRIORITY: Record<AgentDiscipline, number> = {
  structural: 90,        // life-safety critical
  civil: 80,
  environmental: 70,
  mep: 60,
  architectural: 50,
  surveying: 40,
  cost: 30,
};

interface AgentMessage {
  readonly id: string;
  readonly from: AgentId;
  readonly to: AgentId | 'supervisor' | 'broadcast';
  readonly negotiationId?: NegotiationId;
  readonly type: AgentMessageType;
  readonly payload: unknown;
  readonly timestamp: number;
}

type AgentMessageType =
  | 'propose'           // agent proposes a design action
  | 'object'            // agent objects to another's proposal
  | 'counter-propose'   // agent offers alternative
  | 'accept'            // agent accepts a proposal
  | 'withdraw'          // agent withdraws its proposal
  | 'escalate'          // request human intervention
  | 'info-request'      // ask another agent for data
  | 'info-response';    // respond with requested data

interface Proposal {
  readonly entityId: EntityId;
  readonly action: string;
  readonly geometry?: GeometryHandle;
  readonly properties?: Record<string, unknown>;
  readonly constraints: ConstraintSpec[];
  readonly confidence: number;
  readonly reasoning: string;
}

interface ConflictReport {
  readonly negotiationId: NegotiationId;
  readonly detectedAt: number;
  readonly entityId: EntityId;
  readonly conflictType: ConflictType;
  readonly agentA: { id: AgentId; discipline: AgentDiscipline; proposal: Proposal };
  readonly agentB: { id: AgentId; discipline: AgentDiscipline; proposal: Proposal };
  readonly spatialOverlap?: AABB;
  readonly constraintViolations: string[];
}

type ConflictType =
  | 'spatial-collision'      // two proposals occupy same space
  | 'constraint-violation'   // proposal breaks existing constraint
  | 'resource-contention'    // budget, material, schedule conflict
  | 'code-violation'         // building code or regulation conflict
  | 'performance-degradation'; // structural, thermal, etc.

interface NegotiationRound {
  readonly roundNumber: number;
  readonly negotiationId: NegotiationId;
  readonly participants: AgentId[];
  readonly proposals: Map<AgentId, Proposal>;
  readonly objections: Map<AgentId, string[]>;
  readonly status: 'open' | 'converged' | 'deadlocked' | 'escalated';
  readonly deadline: number; // max time before escalation
}

interface SupervisorDecision {
  readonly negotiationId: NegotiationId;
  readonly decidedBy: 'supervisor-agent' | 'human';
  readonly resolution: ResolutionStrategy;
  readonly selectedProposal?: Proposal;
  readonly mergedProposal?: Proposal;
  readonly reasoning: string;
  readonly overriddenAgents: AgentId[];
  readonly humanEscalationReason?: string;
}

type ResolutionStrategy =
  | 'priority-override'     // higher-discipline agent wins
  | 'constraint-satisfaction' // solver finds mutually valid solution
  | 'pareto-optimal'        // multi-objective optimization
  | 'human-decision'        // human picks
  | 'deferred';             // postpone decision, flag for review
```

### Negotiation Flow

```typescript
async function runNegotiation(
  conflict: ConflictReport,
  agents: Map<AgentId, AgentWorkerPort>,
  supervisor: SupervisorPort,
  maxRounds: number = 5,
): Promise<SupervisorDecision> {
  const negotiationId = conflict.negotiationId;
  let round = 0;

  while (round < maxRounds) {
    round++;
    const roundState: NegotiationRound = {
      roundNumber: round,
      negotiationId,
      participants: [conflict.agentA.id, conflict.agentB.id],
      proposals: new Map(),
      objections: new Map(),
      status: 'open',
      deadline: Date.now() + 5000, // 5s per round
    };

    // Each agent submits a (possibly revised) proposal
    const [proposalA, proposalB] = await Promise.all([
      requestProposal(agents.get(conflict.agentA.id)!, roundState),
      requestProposal(agents.get(conflict.agentB.id)!, roundState),
    ]);

    // Check for convergence: proposals no longer conflict
    const stillConflicts = detectConflict(proposalA, proposalB);
    if (!stillConflicts) {
      return { negotiationId, decidedBy: 'supervisor-agent', resolution: 'constraint-satisfaction',
               mergedProposal: mergeProposals(proposalA, proposalB), reasoning: 'Agents converged',
               overriddenAgents: [] };
    }

    // Check confidence -- low confidence triggers escalation
    if (proposalA.confidence < 0.7 && proposalB.confidence < 0.7) {
      return supervisor.escalateToHuman(conflict, roundState);
    }
  }

  // Deadlocked after max rounds -- apply priority hierarchy
  const priorityA = DISCIPLINE_PRIORITY[conflict.agentA.discipline];
  const priorityB = DISCIPLINE_PRIORITY[conflict.agentB.discipline];

  if (Math.abs(priorityA - priorityB) < 10) {
    // Close priority -- escalate to human
    return supervisor.escalateToHuman(conflict, { roundNumber: round } as NegotiationRound);
  }

  const winner = priorityA > priorityB ? conflict.agentA : conflict.agentB;
  return {
    negotiationId, decidedBy: 'supervisor-agent', resolution: 'priority-override',
    selectedProposal: winner.proposal, reasoning: `${winner.discipline} overrides by discipline priority`,
    overriddenAgents: [priorityA > priorityB ? conflict.agentB.id : conflict.agentA.id],
  };
}
```

### NEXUS Application

The structural agent proposes a shear wall at grid line 7. The MEP agent proposes a main duct run through the same zone. Conflict detected: `spatial-collision` on entity `grid-7-zone`. Negotiation begins. Round 1: MEP agent counter-proposes rerouting the duct 600mm south. Structural agent accepts -- the spatial conflict resolves. Total negotiation time: under 2 seconds. If the duct reroute violates fire separation requirements (detected by the environmental agent joining round 2), the system escalates to the human engineer with: "Structural shear wall at grid 7 conflicts with MEP duct route. Rerouting violates fire separation. Three options attached with confidence scores."

---

## D6 -- Reactive Parametric Constraint Graph

### Rationale

Engineering design is a web of dependencies. A road alignment depends on the terrain surface. The terrain surface depends on the LiDAR point cloud. The point cloud updates when a new drone survey arrives. Stormwater drainage depends on road alignment and terrain slope. Change one input and a cascade of downstream recomputations must fire.

A reactive parametric constraint graph models these dependencies as a DAG. Each node holds a computation or a value. Edges represent data flow. When an upstream node changes, downstream nodes are invalidated (dirty-flagged) and lazily recomputed on demand, or eagerly recomputed if they're visible/active.

This is not a generic reactivity system like signals. It is engineering-specific: nodes carry geometric precision metadata, CRS information, and cost estimates. The graph supports topological sort for batch updates, cycle detection (invalid constraint), and partial invalidation (only recompute the subgraph affected by a change).

### Interfaces

```typescript
type NodeId = string & { readonly __brand: unique symbol };

interface ConstraintNode<T = unknown> {
  readonly id: NodeId;
  readonly name: string;
  readonly type: 'source' | 'computed' | 'parameter';
  /** For 'source' nodes: the raw value. For 'computed': the compute function */
  value: T | undefined;
  compute?: (inputs: Record<string, unknown>) => T | Promise<T>;
  /** Dirty flag -- set when any upstream changes */
  dirty: boolean;
  /** Metadata for engineering context */
  precision: PrecisionSpec;
  crs?: EPSG;
  /** Estimated computation cost in ms -- used for scheduling */
  estimatedCostMs: number;
  /** Last recomputation timestamp */
  lastUpdated: number;
}

interface PrecisionSpec {
  linearTolerance: number;    // meters -- e.g., 0.001 for mm precision
  angularTolerance: number;   // radians
  significantDigits: number;
}

interface ConstraintEdge {
  readonly from: NodeId;
  readonly to: NodeId;
  readonly inputName: string; // the named input on the target node's compute function
  readonly transform?: (value: unknown) => unknown; // optional edge transform
}

interface ConstraintGraph {
  addNode<T>(node: ConstraintNode<T>): void;
  removeNode(id: NodeId): void;
  addEdge(edge: ConstraintEdge): void;
  removeEdge(from: NodeId, to: NodeId): void;

  /** Set a source node's value -- triggers downstream invalidation */
  setValue<T>(id: NodeId, value: T): void;

  /** Get a node's current value -- recomputes if dirty */
  getValue<T>(id: NodeId): Promise<T>;

  /** Batch invalidation -- returns all affected node IDs in topological order */
  invalidateSubgraph(rootId: NodeId): NodeId[];

  /** Eagerly recompute all dirty nodes in topological order */
  recomputeAll(): Promise<Map<NodeId, unknown>>;

  /** Detect cycles -- returns the cycle path or null */
  detectCycle(): NodeId[] | null;

  /** Subgraph extraction for visualization / debugging */
  getUpstream(id: NodeId): Set<NodeId>;
  getDownstream(id: NodeId): Set<NodeId>;
}
```

### Update Propagation

```typescript
function topologicalRecompute(graph: ConstraintGraph, dirtyNodes: Set<NodeId>): NodeId[] {
  // Kahn's algorithm on the subgraph of dirty nodes + their downstream
  const affected = new Set<NodeId>();
  const queue: NodeId[] = [];

  // Expand dirty set to include all downstream nodes
  for (const nodeId of dirtyNodes) {
    for (const downstream of graph.getDownstream(nodeId)) {
      affected.add(downstream);
    }
  }

  // Topological sort of affected subgraph
  const inDegree = new Map<NodeId, number>();
  for (const nodeId of affected) {
    inDegree.set(nodeId, 0);
  }
  for (const nodeId of affected) {
    for (const downstream of graph.getDownstream(nodeId)) {
      if (affected.has(downstream)) {
        inDegree.set(downstream, (inDegree.get(downstream) ?? 0) + 1);
      }
    }
  }

  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const order: NodeId[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    order.push(nodeId);
    for (const downstream of graph.getDownstream(nodeId)) {
      if (!affected.has(downstream)) continue;
      const newDegree = (inDegree.get(downstream) ?? 1) - 1;
      inDegree.set(downstream, newDegree);
      if (newDegree === 0) queue.push(downstream);
    }
  }

  return order; // recompute nodes in this order -- guaranteed inputs ready before outputs
}

// Dirty-flag optimization: skip recomputation if inputs haven't actually changed
async function smartRecompute<T>(
  node: ConstraintNode<T>,
  inputs: Record<string, unknown>,
  previousInputHash: string,
): Promise<{ value: T; changed: boolean }> {
  const currentHash = hashInputs(inputs);
  if (currentHash === previousInputHash) {
    return { value: node.value as T, changed: false }; // short-circuit
  }
  const newValue = await node.compute!(inputs);
  return { value: newValue, changed: true };
}
```

### NEXUS Application

A surveyor uploads a new drone LiDAR scan. The constraint graph has:

```
DronePointCloud (source)
  -> TerrainSurface (computed: Delaunay triangulation)
    -> RoadAlignment (computed: horizontal + vertical alignment on surface)
      -> StormwaterDrainage (computed: slope analysis + pipe sizing)
      -> CutFillVolumes (computed: earthwork quantities)
    -> SlopeStability (computed: geotechnical analysis)
```

Setting the `DronePointCloud` source node dirty-flags `TerrainSurface`, which cascades to `RoadAlignment`, `StormwaterDrainage`, `CutFillVolumes`, and `SlopeStability`. The topological sort ensures `TerrainSurface` recomputes first (routed to the WASM worker pool), then `RoadAlignment` and `SlopeStability` in parallel (no dependency between them), then `StormwaterDrainage` and `CutFillVolumes` in parallel. Total cascade: 5 recomputations instead of recomputing the entire project. If the terrain surface hasn't materially changed (dirty-flag optimization detects identical output hash), downstream nodes skip entirely.

---

## D7 -- Flyweight + GPU Instancing for Large Scenes

### Rationale

A city-scale model has 100k trees, 50k road signs, 10k structural columns, 5k light poles. Storing unique geometry for each is insane -- there are maybe 15 tree species, 30 sign types, 4 column profiles. The flyweight pattern shares geometry prototypes on the CPU side. GPU instancing renders all instances of a prototype in a single draw call with per-instance transforms and attributes.

The challenge specific to NEXUS: instanced objects must be AI-queryable. An agent asking "find all columns in grid zone F5-G7" cannot iterate 10k instances linearly. The solution is a spatial index over instance transforms, decoupled from the GPU instance buffer. The spatial index maps `(region query) -> instance indices`, which map to `(prototype ID + per-instance transform)`. The agent never touches the GPU buffer.

### Interfaces

```typescript
type PrototypeId = string & { readonly __brand: unique symbol };
type InstanceIndex = number;

interface FlyweightPrototype {
  readonly id: PrototypeId;
  readonly category: string;                // 'tree' | 'sign' | 'column' | 'fixture'
  readonly mesh: MeshData;                  // shared geometry
  readonly material: MaterialHandle;
  readonly boundingBox: AABB;               // prototype-space AABB
  readonly lodMeshes: Map<LODLevel, MeshData>;
  readonly metadata: Record<string, unknown>; // shared properties
}

interface FlyweightRegistry {
  register(proto: FlyweightPrototype): void;
  get(id: PrototypeId): FlyweightPrototype | undefined;
  listByCategory(category: string): PrototypeId[];
  /** Memory stats */
  readonly stats: {
    prototypeCount: number;
    totalSharedGeometryBytes: number;
    instanceCounts: Map<PrototypeId, number>;
  };
}

interface InstanceBuffer {
  readonly prototypeId: PrototypeId;
  readonly capacity: number;
  readonly count: number;

  /** Per-instance data packed for GPU upload */
  readonly transforms: Float32Array;       // 4x4 matrices, tightly packed
  readonly attributes: Float32Array;       // per-instance color, scale, age, etc.
  readonly entityIds: Uint32Array;         // map instance index -> EntityId

  add(entityId: EntityId, transform: Mat4, attribs: Float32Array): InstanceIndex;
  remove(index: InstanceIndex): void;
  updateTransform(index: InstanceIndex, transform: Mat4): void;
  updateAttributes(index: InstanceIndex, attribs: Float32Array): void;

  /** Upload dirty region to GPU -- only transfers changed instances */
  readonly dirtyRange: { start: number; end: number } | null;
  clearDirty(): void;
}

interface SpatialInstanceQuery {
  /** Build spatial index from current instance transforms */
  rebuild(buffer: InstanceBuffer, prototype: FlyweightPrototype): void;
  /** Incremental update -- cheaper than full rebuild */
  update(index: InstanceIndex, oldBounds: AABB, newBounds: AABB): void;

  /** Region query -- returns instance indices within the AABB */
  queryRegion(region: AABB): InstanceIndex[];
  /** Named grid query -- "F5-G7" resolved via project grid definition */
  queryGrid(gridSpec: string, gridDef: GridDefinition): InstanceIndex[];
  /** Radius query from a point */
  queryRadius(center: Vec3, radius: number): InstanceIndex[];
  /** Frustum query for LOD selection */
  queryFrustum(frustum: Frustum): InstanceIndex[];

  /** Aggregate queries for AI agents */
  count(region: AABB): number;
  nearest(point: Vec3, k: number): InstanceIndex[];
}
```

### Usage

```typescript
// Scene setup: register 15 tree prototypes, create instance buffers
const registry = createFlyweightRegistry();
registry.register({
  id: 'oak-mature' as PrototypeId,
  category: 'tree',
  mesh: oakMeshData,
  material: treeMaterial,
  boundingBox: { min: [-3, 0, -3], max: [3, 12, 3] },
  lodMeshes: new Map([[0, oakHigh], [1, oakMedium], [2, oakLow], [3, oakBillboard]]),
  metadata: { species: 'Quercus robur', canopyDiameter: 6 },
});

const oakBuffer = createInstanceBuffer('oak-mature' as PrototypeId, 50_000);
const oakSpatialIndex = createSpatialInstanceQuery();

// Import 30k oak trees from GIS layer
for (const feature of gisOakFeatures) {
  const transform = computeTreeTransform(feature.geometry, feature.properties);
  const idx = oakBuffer.add(feature.entityId, transform, packTreeAttribs(feature));
}
oakSpatialIndex.rebuild(oakBuffer, registry.get('oak-mature' as PrototypeId)!);

// AI agent query: "How many mature oaks within 50m of the proposed road alignment?"
const roadBuffer = roadAlignment.getBufferGeometry();
const roadAABB = expandAABB(roadAlignment.boundingBox, 50);
const nearbyOaks = oakSpatialIndex.queryRegion(roadAABB);
// Result: instance indices -> can resolve to EntityIds -> can read GIS attributes
// Single draw call renders all 30k oaks. Query returns 847 nearby instances in <1ms.
```

### NEXUS Application

A city model with 200k instanced objects renders in 4 draw calls (one per prototype category at each LOD level) instead of 200k draw calls. Memory: 15 prototype meshes (~50MB) + 200k instance transforms (~25MB) = 75MB. Without flyweight: 200k unique meshes = ~50GB. The spatial instance index adds ~5MB for the R-tree over instance AABBs. An AI environmental agent queries "count all trees within the flood zone polygon" and gets an answer in 2ms from the spatial index without touching the GPU or iterating instance arrays.

---

## D8 -- Strategy Pattern for Multi-Format File Parsers

### Rationale

NEXUS must ingest files from every engineering discipline: IFC (BIM), Shapefile/GeoJSON/GeoPackage (GIS), LAS/LAZ (point clouds), DWG/DXF (CAD), GeoTIFF (rasters), CityGML (3D city models), and proprietary survey formats. Each format carries different metadata, geometry representations, and coordinate systems.

A naive approach: one monolithic parser with format-specific branches. This becomes unmaintainable at 15+ formats. The strategy pattern gives each format its own `IFileParser` implementation behind a common interface. A `ParserRegistry` selects the right parser by file extension, MIME type, or magic bytes. A capability matrix declares what each parser can and cannot extract, so the application knows what to expect.

### Interfaces

```typescript
interface ParsedEntity {
  readonly geometry: GeometryData;
  readonly properties: Record<string, PropertyValue>;
  readonly crs?: EPSG;
  readonly sourceLayer?: string;
  readonly sourceFormat: string;
}

type GeometryData =
  | { type: 'mesh'; vertices: Float64Array; indices: Uint32Array; normals?: Float32Array }
  | { type: 'brep'; serialized: ArrayBuffer; format: 'step' | 'iges' }
  | { type: 'pointcloud'; points: Float64Array; colors?: Uint8Array; classification?: Uint8Array }
  | { type: 'raster'; pixels: ArrayBuffer; width: number; height: number; bands: number; nodata: number }
  | { type: 'curve'; controlPoints: Float64Array; degree: number; knots: Float64Array };

interface ParseCapability {
  /** Can this parser extract 3D geometry? */
  geometry3D: boolean;
  /** Can this parser extract BIM properties (IfcPropertySets)? */
  bimProperties: boolean;
  /** Can this parser extract GIS attributes? */
  gisAttributes: boolean;
  /** Can this parser extract CRS information? */
  crs: boolean;
  /** Can this parser extract material/appearance data? */
  materials: boolean;
  /** Can this parser extract topological relationships? */
  topology: boolean;
  /** Can this parser handle incremental/streaming reads? */
  streaming: boolean;
  /** Estimated parse speed: entities per second */
  estimatedThroughput: number;
}

interface ParseOptions {
  /** Target CRS for reprojection during parse */
  targetCrs?: EPSG;
  /** Geometry simplification tolerance (0 = no simplification) */
  simplifyTolerance?: number;
  /** Layer/class filter -- only parse matching entities */
  filter?: ParseFilter;
  /** Progress callback */
  onProgress?: (parsed: number, total: number | null) => void;
  /** Abort signal */
  signal?: AbortSignal;
}

interface ParseFilter {
  layers?: string[];
  ifcClasses?: string[];
  boundingBox?: AABB;
  maxEntities?: number;
}

interface ParseResult {
  readonly format: string;
  readonly entities: ParsedEntity[];
  readonly metadata: {
    sourceFile: string;
    crs?: EPSG;
    boundingBox?: AABB;
    entityCount: number;
    parseTimeMs: number;
    warnings: string[];
  };
  /** Capabilities that were actually used/available in this file */
  readonly actualCapabilities: ParseCapability;
}

interface IFileParser {
  readonly formatName: string;
  readonly extensions: string[];          // ['.ifc', '.ifczip']
  readonly mimeTypes: string[];           // ['application/x-step']
  readonly magicBytes?: Uint8Array;       // first N bytes for sniffing
  readonly capabilities: ParseCapability;

  /** Quick check: can this parser handle the file? */
  canParse(header: Uint8Array, extension: string): boolean;

  /** Parse the file -- runs in a Worker via the WorkerPool */
  parse(data: ArrayBuffer | ReadableStream<Uint8Array>, options: ParseOptions): Promise<ParseResult>;

  /** Streaming parse -- yields entities as they're decoded */
  parseStreaming?(
    stream: ReadableStream<Uint8Array>,
    options: ParseOptions,
  ): AsyncIterable<ParsedEntity>;
}

interface ParserRegistry {
  register(parser: IFileParser): void;
  unregister(formatName: string): void;

  /** Select parser by extension, MIME, or magic bytes. Returns ranked candidates. */
  resolve(file: { name: string; mime?: string; header?: Uint8Array }): IFileParser[];

  /** Capability matrix for all registered parsers */
  capabilityMatrix(): Map<string, ParseCapability>;

  /** Parse with automatic format detection + fallback chain */
  autoParse(
    file: File | ArrayBuffer,
    fileName: string,
    options?: ParseOptions,
  ): Promise<ParseResult>;
}
```

### Strategy Selection and Fallback

```typescript
function createParserRegistry(): ParserRegistry {
  const parsers = new Map<string, IFileParser>();

  function resolve(file: { name: string; mime?: string; header?: Uint8Array }): IFileParser[] {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const candidates: Array<{ parser: IFileParser; score: number }> = [];

    for (const parser of parsers.values()) {
      let score = 0;

      // Magic bytes: highest confidence
      if (file.header && parser.magicBytes) {
        const match = parser.magicBytes.every((b, i) => file.header![i] === b);
        if (match) score += 100;
      }

      // Extension match
      if (parser.extensions.includes(`.${ext}`)) score += 50;

      // MIME match
      if (file.mime && parser.mimeTypes.includes(file.mime)) score += 30;

      if (score > 0) candidates.push({ parser, score });
    }

    // Sort by confidence descending -- first candidate is best guess
    candidates.sort((a, b) => b.score - a.score);
    return candidates.map(c => c.parser);
  }

  async function autoParse(
    file: File | ArrayBuffer,
    fileName: string,
    options?: ParseOptions,
  ): Promise<ParseResult> {
    const header = new Uint8Array(
      file instanceof File ? await file.slice(0, 64).arrayBuffer() : file.slice(0, 64)
    );
    const candidates = resolve({ name: fileName, header });

    if (candidates.length === 0) {
      throw new Error(`No parser registered for file: ${fileName}`);
    }

    // Try each candidate in order -- fallback on parse failure
    const data = file instanceof File ? await file.arrayBuffer() : file;
    for (const parser of candidates) {
      try {
        return await parser.parse(data, options ?? {});
      } catch (err) {
        console.warn(`Parser ${parser.formatName} failed for ${fileName}, trying next`);
        continue;
      }
    }

    throw new Error(`All parsers failed for file: ${fileName}`);
  }

  return { register, unregister, resolve, capabilityMatrix, autoParse };
}
```

### Parser Capability Matrix

| Format    | 3D Geometry | BIM Props | GIS Attrs | CRS | Materials | Topology | Streaming | Throughput |
|-----------|:-----------:|:---------:|:---------:|:---:|:---------:|:--------:|:---------:|:----------:|
| IFC       | yes         | yes       | no        | no  | yes       | yes      | yes       | ~5k/s     |
| Shapefile | partial     | no        | yes       | yes | no        | no       | yes       | ~50k/s    |
| GeoJSON   | partial     | no        | yes       | yes | no        | no       | yes       | ~30k/s    |
| LAS/LAZ   | yes (pts)   | no        | partial   | yes | no        | no       | yes       | ~500k/s   |
| DWG/DXF   | yes         | partial   | no        | no  | partial   | partial  | no        | ~10k/s    |
| GeoTIFF   | raster      | no        | yes       | yes | no        | no       | yes       | N/A       |
| CityGML   | yes         | partial   | yes       | yes | yes       | yes      | yes       | ~2k/s     |
| glTF      | yes         | no        | no        | no  | yes       | no       | yes       | ~20k/s    |
| STEP      | yes (brep)  | no        | no        | no  | partial   | yes      | no        | ~3k/s     |

### NEXUS Application

A user drags a `.ifc` file and a `.shp` file onto the canvas. The `ParserRegistry` resolves both by extension. The IFC parser runs in a Worker via the pool (D4), extracting BIM geometry and property sets. The Shapefile parser runs in another worker, extracting GIS features with CRS metadata. The capability matrix tells the application: IFC has BIM properties but no CRS; Shapefile has CRS but no BIM properties. The application prompts: "IFC file has no coordinate reference system. Align to Shapefile CRS (EPSG:32632) or specify manually?" An AI agent can inspect `actualCapabilities` on each `ParseResult` to decide what cross-referencing is possible between the two datasets.

---

## Summary

| Pattern | Core Problem | Key Mechanism |
|---------|-------------|---------------|
| D1 Hexagonal | Kernel coupling to browser APIs | Port/adapter isolation |
| D2 ECS | OOP inheritance explosion at scale | Composition + cache-friendly SoA |
| D3 Event Sourcing | Lost design history, no AI replay | Immutable event log + projections |
| D4 Worker Pool | Main thread blocked by WASM computation | Priority queue + SharedArrayBuffer zero-copy |
| D5 Agent Negotiation | Multi-discipline AI conflicts | Structured protocol + supervisor arbitration |
| D6 Constraint Graph | Manual cascade of dependent recomputations | Reactive DAG + topological propagation |
| D7 Flyweight + Instancing | 200k unique meshes = 50GB | Shared prototypes + spatial instance index |
| D8 Strategy Parsers | 15+ file formats, unmaintainable monolith | Per-format strategy + capability matrix |

These eight patterns form the structural backbone of NEXUS. They are not independent -- they compose: ECS entities (D2) emit events (D3) processed by workers (D4) through hexagonal ports (D1), while agents (D5) negotiate over constraint graphs (D6) querying flyweight instances (D7) parsed from multi-format files (D8).
