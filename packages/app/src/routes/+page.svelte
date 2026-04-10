<script lang="ts">
  import { onMount } from 'svelte';
  import { CadRenderer } from '@nexus/renderer';

  // Tool state
  type Tool = 'select' | 'line' | 'circle' | 'rectangle';
  let currentTool = $state<Tool>('line');
  let cursorX = $state(0);
  let cursorY = $state(0);
  let entityCount = $state(0);
  let statusText = $state('Ready');

  // Drawing state machine
  let drawStep = $state(0); // 0 = waiting for first click, 1 = waiting for second click
  let firstPoint = $state<{x: number; y: number} | null>(null);

  // Kernel + renderer refs
  let kernel: any = null;
  let renderer: CadRenderer | null = null;
  let canvasContainer: HTMLElement;
  let commandInput: HTMLInputElement;
  let commandText = $state('');

  const layerColors = new Map([['default', '#00ff88']]);

  function syncView() {
    if (!kernel || !renderer) return;
    const json = kernel.get_entities_json();
    renderer.syncEntities(json, layerColors);
    entityCount = kernel.entity_count();
  }

  function handleClick(worldX: number, worldY: number) {
    if (!kernel) return;

    // Snap to grid (1 unit)
    const snap = 1;
    const sx = Math.round(worldX / snap) * snap;
    const sy = Math.round(worldY / snap) * snap;

    if (currentTool === 'line') {
      if (drawStep === 0) {
        firstPoint = { x: sx, y: sy };
        drawStep = 1;
        statusText = 'Line: click end point (Esc to cancel)';
      } else {
        kernel.create_line(firstPoint!.x, firstPoint!.y, sx, sy, 'default');
        syncView();
        // Stay in line mode for continuous drawing
        firstPoint = { x: sx, y: sy };
        statusText = 'Line: click next point (Esc to finish)';
      }
    } else if (currentTool === 'circle') {
      if (drawStep === 0) {
        firstPoint = { x: sx, y: sy };
        drawStep = 1;
        statusText = 'Circle: click edge point for radius (Esc to cancel)';
      } else {
        const dx = sx - firstPoint!.x;
        const dy = sy - firstPoint!.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        if (radius > 0.01) {
          kernel.create_circle(firstPoint!.x, firstPoint!.y, radius, 'default');
          syncView();
        }
        drawStep = 0;
        firstPoint = null;
        statusText = 'Circle: click center point';
      }
    } else if (currentTool === 'rectangle') {
      if (drawStep === 0) {
        firstPoint = { x: sx, y: sy };
        drawStep = 1;
        statusText = 'Rectangle: click opposite corner (Esc to cancel)';
      } else {
        const x = Math.min(firstPoint!.x, sx);
        const y = Math.min(firstPoint!.y, sy);
        const w = Math.abs(sx - firstPoint!.x);
        const h = Math.abs(sy - firstPoint!.y);
        if (w > 0.01 && h > 0.01) {
          kernel.create_rectangle(x, y, w, h, 'default');
          syncView();
        }
        drawStep = 0;
        firstPoint = null;
        statusText = 'Rectangle: click first corner';
      }
    }
  }

  function setTool(tool: Tool) {
    currentTool = tool;
    drawStep = 0;
    firstPoint = null;

    const msgs: Record<Tool, string> = {
      select: 'Select: click to select entities',
      line: 'Line: click start point',
      circle: 'Circle: click center point',
      rectangle: 'Rectangle: click first corner',
    };
    statusText = msgs[tool];
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      drawStep = 0;
      firstPoint = null;
      statusText = `${currentTool}: operation cancelled`;
    }
    // Focus command line on any letter key when not focused
    if (e.key === '/' && document.activeElement !== commandInput) {
      e.preventDefault();
      commandInput?.focus();
    }
  }

  function handleCommand() {
    const cmd = commandText.trim().toLowerCase();
    commandText = '';

    if (cmd === 'l' || cmd === 'line') setTool('line');
    else if (cmd === 'c' || cmd === 'circle') setTool('circle');
    else if (cmd === 'r' || cmd === 'rect' || cmd === 'rectangle') setTool('rectangle');
    else if (cmd === 'ze' || cmd === 'zoom extents') renderer?.zoomExtents();
    else if (cmd === 'esc') { drawStep = 0; firstPoint = null; }
    else statusText = `Unknown command: ${cmd}`;
  }

  onMount(async () => {
    try {
      // Dynamic import for WASM
      const wasmModule = await import('@nexus/kernel');
      await wasmModule.default();
      kernel = new wasmModule.Kernel();

      // Init renderer
      renderer = new CadRenderer(canvasContainer);
      renderer.onCursorMove = (x: number, y: number) => {
        cursorX = x;
        cursorY = y;
      };
      renderer.onClick = handleClick;

      statusText = 'Ready — select a tool to begin drawing';

      // Draw some demo geometry
      kernel.create_line(-10, -10, 10, -10, 'default');
      kernel.create_line(10, -10, 10, 10, 'default');
      kernel.create_line(10, 10, -10, 10, 'default');
      kernel.create_line(-10, 10, -10, -10, 'default');
      kernel.create_circle(0, 0, 5, 'default');
      syncView();
      renderer.zoomExtents();

    } catch (e) {
      statusText = `Init error: ${e}`;
      console.error(e);
    }

    return () => renderer?.dispose();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app">
  <header class="toolbar">
    <span class="logo">NEXUS</span>
    <div class="tools">
      <button class:active={currentTool === 'select'} onclick={() => setTool('select')} title="Select (S)">
        ◇ Select
      </button>
      <button class:active={currentTool === 'line'} onclick={() => setTool('line')} title="Line (L)">
        / Line
      </button>
      <button class:active={currentTool === 'circle'} onclick={() => setTool('circle')} title="Circle (C)">
        O Circle
      </button>
      <button class:active={currentTool === 'rectangle'} onclick={() => setTool('rectangle')} title="Rectangle (R)">
        [] Rect
      </button>
    </div>
    <span class="spacer"></span>
    <span class="entity-count">{entityCount} entities</span>
  </header>

  <main class="workspace">
    <div class="canvas-container" bind:this={canvasContainer}></div>
  </main>

  <footer class="status-bar">
    <div class="command-line">
      <span class="prompt">&gt;</span>
      <input
        bind:this={commandInput}
        bind:value={commandText}
        onkeydown={(e) => e.key === 'Enter' && handleCommand()}
        placeholder="Type command (L=line, C=circle, R=rect, /=focus)"
        spellcheck="false"
      />
    </div>
    <span class="status-text">{statusText}</span>
    <span class="coordinates">{cursorX.toFixed(2)}, {cursorY.toFixed(2)}</span>
  </footer>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    user-select: none;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
    height: 44px;
  }

  .logo {
    font-weight: 700;
    font-size: 1.1rem;
    color: #e94560;
    letter-spacing: 2px;
    margin-right: 1rem;
  }

  .tools {
    display: flex;
    gap: 4px;
  }

  .tools button {
    background: #1a1a2e;
    border: 1px solid #333;
    color: #ccc;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
  }

  .tools button:hover {
    background: #2a2a4e;
    border-color: #555;
  }

  .tools button.active {
    background: #0f3460;
    border-color: #e94560;
    color: #fff;
  }

  .spacer { flex: 1; }

  .entity-count {
    font-size: 0.75rem;
    color: #888;
  }

  .workspace {
    flex: 1;
    overflow: hidden;
  }

  .canvas-container {
    width: 100%;
    height: 100%;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 0.5rem;
    background: #16213e;
    border-top: 1px solid #0f3460;
    height: 32px;
    font-size: 0.75rem;
  }

  .command-line {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 0 0 300px;
  }

  .prompt {
    color: #e94560;
    font-weight: bold;
  }

  .command-line input {
    background: #1a1a2e;
    border: 1px solid #333;
    color: #fff;
    padding: 2px 8px;
    border-radius: 3px;
    font-family: inherit;
    font-size: 0.75rem;
    width: 100%;
    outline: none;
  }

  .command-line input:focus {
    border-color: #e94560;
  }

  .status-text {
    flex: 1;
    color: #888;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .coordinates {
    color: #00ff88;
    font-family: 'JetBrains Mono', monospace;
    flex: 0 0 150px;
    text-align: right;
  }
</style>
