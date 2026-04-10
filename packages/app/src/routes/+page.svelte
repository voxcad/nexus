<script lang="ts">
  import { onMount } from 'svelte';
  import { CadRenderer } from '@nexus/renderer';
  import PropertiesPanel from '$lib/PropertiesPanel.svelte';
  import FileMenu from '$lib/FileMenu.svelte';

  type Tool = 'select' | 'line' | 'circle' | 'rectangle' | 'arc' | 'move' | 'copy' | 'rotate';

  let currentTool = $state<Tool>('select');
  let cursorX = $state(0);
  let cursorY = $state(0);
  let snapX = $state(0);
  let snapY = $state(0);
  let hasSnap = $state(false);
  let snapType = $state('');
  let entityCount = $state(0);
  let statusText = $state('Ready');
  let snapEnabled = $state(true);
  let canUndo = $state(false);
  let canRedo = $state(false);

  let drawStep = $state(0);
  let firstPoint = $state<{x: number; y: number} | null>(null);
  let selectedEntity = $state<any>(null);
  let projectName = $state('untitled');
  let autoSaveStatus = $state('');
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  let kernel: any = null;
  let renderer: CadRenderer | null = null;
  let canvasContainer: HTMLElement;
  let commandInput: HTMLInputElement;
  let commandText = $state('');
  let lastPoint = $state<{x: number; y: number}>({ x: 0, y: 0 });

  const layerColors = new Map([['default', '#00ff88']]);

  function syncView() {
    if (!kernel || !renderer) return;
    const json = kernel.get_entities_json();
    renderer.syncEntities(json, layerColors);
    entityCount = kernel.entity_count();
    canUndo = kernel.can_undo();
    canRedo = kernel.can_redo();

    if (renderer.selectionManager && renderer.selectionManager.selectedIds.size > 0) {
      renderer.updateSelection();
    }
    renderer.render();
  }

  function getSnapOrCursor(): { x: number; y: number } {
    return hasSnap ? { x: snapX, y: snapY } : { x: cursorX, y: cursorY };
  }

  function handleClick(worldX: number, worldY: number) {
    if (!kernel || !renderer) return;

    const pt = getSnapOrCursor();

    if (currentTool === 'select') {
      const hitId = renderer.hitTest(worldX, worldY);
      renderer.selectionManager.clear();
      if (hitId) {
        renderer.selectionManager.select(hitId);
        const json = kernel.get_entity_json(hitId);
        selectedEntity = json ? JSON.parse(json) : null;
        statusText = `Selected: ${hitId}`;
      } else {
        selectedEntity = null;
        statusText = 'Select: click to select entities';
      }
      renderer.updateSelection();
      renderer.render();
      return;
    }

    if (currentTool === 'line') {
      if (drawStep === 0) {
        firstPoint = { x: pt.x, y: pt.y };
        lastPoint = { x: pt.x, y: pt.y };
        drawStep = 1;
        statusText = 'Line: click end point or type coordinates (Esc to cancel)';
      } else {
        kernel.create_line(firstPoint!.x, firstPoint!.y, pt.x, pt.y, 'default');
        syncView();
        firstPoint = { x: pt.x, y: pt.y };
        lastPoint = { x: pt.x, y: pt.y };
        statusText = 'Line: click next point (Esc to finish)';
      }
    } else if (currentTool === 'circle') {
      if (drawStep === 0) {
        firstPoint = { x: pt.x, y: pt.y };
        drawStep = 1;
        statusText = 'Circle: click edge point or type radius (Esc to cancel)';
      } else {
        const r = Math.sqrt((pt.x - firstPoint!.x) ** 2 + (pt.y - firstPoint!.y) ** 2);
        if (r > 0.01) {
          kernel.create_circle(firstPoint!.x, firstPoint!.y, r, 'default');
          lastPoint = { x: pt.x, y: pt.y };
          syncView();
        }
        drawStep = 0;
        firstPoint = null;
        statusText = 'Circle: click center point';
      }
    } else if (currentTool === 'rectangle') {
      if (drawStep === 0) {
        firstPoint = { x: pt.x, y: pt.y };
        drawStep = 1;
        statusText = 'Rectangle: click opposite corner (Esc to cancel)';
      } else {
        const x = Math.min(firstPoint!.x, pt.x);
        const y = Math.min(firstPoint!.y, pt.y);
        const w = Math.abs(pt.x - firstPoint!.x);
        const h = Math.abs(pt.y - firstPoint!.y);
        if (w > 0.01 && h > 0.01) {
          kernel.create_rectangle(x, y, w, h, 'default');
          lastPoint = { x: pt.x, y: pt.y };
          syncView();
        }
        drawStep = 0;
        firstPoint = null;
        statusText = 'Rectangle: click first corner';
      }
    } else if (currentTool === 'arc') {
      if (drawStep === 0) {
        firstPoint = { x: pt.x, y: pt.y };
        drawStep = 1;
        statusText = 'Arc: click start point on arc (Esc to cancel)';
      } else if (drawStep === 1) {
        const r = Math.sqrt((pt.x - firstPoint!.x) ** 2 + (pt.y - firstPoint!.y) ** 2);
        const startAngle = Math.atan2(pt.y - firstPoint!.y, pt.x - firstPoint!.x);
        (firstPoint as any).radius = r;
        (firstPoint as any).startAngle = startAngle;
        drawStep = 2;
        statusText = 'Arc: click end point on arc (Esc to cancel)';
      } else {
        const r = (firstPoint as any).radius;
        const startAngle = (firstPoint as any).startAngle;
        const endAngle = Math.atan2(pt.y - firstPoint!.y, pt.x - firstPoint!.x);
        if (r > 0.01) {
          kernel.create_arc(firstPoint!.x, firstPoint!.y, r, startAngle, endAngle, 'default');
          lastPoint = { x: pt.x, y: pt.y };
          syncView();
        }
        drawStep = 0;
        firstPoint = null;
        statusText = 'Arc: click center point';
      }
    } else if (currentTool === 'move') {
      const ids = renderer.selectionManager.getSelectedIds();
      if (ids.length === 0) {
        statusText = 'Move: select entities first, then press M';
        return;
      }
      if (drawStep === 0) {
        firstPoint = { x: pt.x, y: pt.y };
        drawStep = 1;
        statusText = 'Move: click destination point';
      } else {
        const dx = pt.x - firstPoint!.x;
        const dy = pt.y - firstPoint!.y;
        for (const id of ids) {
          kernel.move_entity(id, dx, dy);
        }
        syncView();
        drawStep = 0;
        firstPoint = null;
        statusText = 'Move complete';
        setTool('select');
      }
    } else if (currentTool === 'copy') {
      const ids = renderer.selectionManager.getSelectedIds();
      if (ids.length === 0) {
        statusText = 'Copy: select entities first';
        return;
      }
      if (drawStep === 0) {
        firstPoint = { x: pt.x, y: pt.y };
        drawStep = 1;
        statusText = 'Copy: click destination point';
      } else {
        const dx = pt.x - firstPoint!.x;
        const dy = pt.y - firstPoint!.y;
        for (const id of ids) {
          const newId = kernel.copy_entity(id);
          if (newId) kernel.move_entity(newId, dx, dy);
        }
        syncView();
        drawStep = 0;
        firstPoint = null;
        statusText = 'Copy complete';
        setTool('select');
      }
    } else if (currentTool === 'rotate') {
      const ids = renderer.selectionManager.getSelectedIds();
      if (ids.length === 0) {
        statusText = 'Rotate: select entities first';
        return;
      }
      if (drawStep === 0) {
        firstPoint = { x: pt.x, y: pt.y };
        drawStep = 1;
        statusText = 'Rotate: click to set angle (or type degrees)';
      } else {
        const angle = Math.atan2(pt.y - firstPoint!.y, pt.x - firstPoint!.x);
        for (const id of ids) {
          kernel.rotate_entity(id, firstPoint!.x, firstPoint!.y, angle);
        }
        syncView();
        drawStep = 0;
        firstPoint = null;
        statusText = 'Rotate complete';
        setTool('select');
      }
    }
  }

  function handleCursorMove(worldX: number, worldY: number) {
    cursorX = worldX;
    cursorY = worldY;

    if (snapEnabled && renderer) {
      const entities = renderer.getEntitiesForSnap();
      const snap = renderer.snapEngine.findSnap(worldX, worldY, entities);
      if (snap && snap.type !== 'grid') {
        hasSnap = true;
        snapX = snap.x;
        snapY = snap.y;
        snapType = snap.type;
        renderer.setSnapIndicator(snap);
      } else if (snap && snap.type === 'grid' && drawStep > 0) {
        hasSnap = true;
        snapX = snap.x;
        snapY = snap.y;
        snapType = 'grid';
        renderer.setSnapIndicator(null);
      } else {
        hasSnap = false;
        renderer.setSnapIndicator(null);
      }
    }

    if (drawStep > 0 && firstPoint && renderer) {
      const pt = getSnapOrCursor();
      if (currentTool === 'line') {
        renderer.setPreview('line', firstPoint, pt);
      } else if (currentTool === 'circle') {
        renderer.setPreview('circle', firstPoint, pt);
      } else if (currentTool === 'rectangle') {
        renderer.setPreview('rectangle', firstPoint, pt);
      } else if (currentTool === 'move' || currentTool === 'copy') {
        renderer.setPreview('move', firstPoint, pt);
      }
    } else if (renderer) {
      renderer.clearPreview();
    }
  }

  function setTool(tool: Tool) {
    currentTool = tool;
    drawStep = 0;
    firstPoint = null;
    renderer?.clearPreview();

    const msgs: Record<Tool, string> = {
      select: 'Select: click to select entities',
      line: 'Line: click start point',
      circle: 'Circle: click center point',
      rectangle: 'Rectangle: click first corner',
      arc: 'Arc: click center point',
      move: 'Move: click base point',
      copy: 'Copy: click base point',
      rotate: 'Rotate: click center of rotation',
    };
    statusText = msgs[tool];
  }

  function doUndo() {
    if (kernel?.can_undo()) {
      kernel.undo();
      syncView();
      statusText = 'Undo';
    }
  }

  function doRedo() {
    if (kernel?.can_redo()) {
      kernel.redo();
      syncView();
      statusText = 'Redo';
    }
  }

  function doDelete() {
    if (!kernel || !renderer) return;
    const ids = renderer.selectionManager.getSelectedIds();
    for (const id of ids) {
      kernel.delete_entity(id);
    }
    renderer.selectionManager.clear();
    selectedEntity = null;
    syncView();
    statusText = `Deleted ${ids.length} entities`;
  }

  function parseCoordinateInput(input: string): { x: number; y: number } | null {
    const trimmed = input.trim();

    const polarMatch = trimmed.match(/^@([\d.]+)<([\d.]+)$/);
    if (polarMatch) {
      const dist = parseFloat(polarMatch[1]);
      const angleDeg = parseFloat(polarMatch[2]);
      const angleRad = angleDeg * Math.PI / 180;
      return {
        x: lastPoint.x + dist * Math.cos(angleRad),
        y: lastPoint.y + dist * Math.sin(angleRad),
      };
    }

    const relMatch = trimmed.match(/^@([-\d.]+),([-\d.]+)$/);
    if (relMatch) {
      return {
        x: lastPoint.x + parseFloat(relMatch[1]),
        y: lastPoint.y + parseFloat(relMatch[2]),
      };
    }

    const absMatch = trimmed.match(/^([-\d.]+),([-\d.]+)$/);
    if (absMatch) {
      return {
        x: parseFloat(absMatch[1]),
        y: parseFloat(absMatch[2]),
      };
    }

    return null;
  }

  function handleCommand() {
    const cmd = commandText.trim();
    commandText = '';

    if (!cmd) return;

    const coordPoint = parseCoordinateInput(cmd);
    if (coordPoint && drawStep > 0) {
      handleClick(coordPoint.x, coordPoint.y);
      return;
    }

    const lower = cmd.toLowerCase();
    if (lower === 'l' || lower === 'line') setTool('line');
    else if (lower === 'c' || lower === 'circle') setTool('circle');
    else if (lower === 'r' || lower === 'rect' || lower === 'rectangle') setTool('rectangle');
    else if (lower === 'a' || lower === 'arc') setTool('arc');
    else if (lower === 'm' || lower === 'move') setTool('move');
    else if (lower === 'co' || lower === 'copy') setTool('copy');
    else if (lower === 'ro' || lower === 'rotate') setTool('rotate');
    else if (lower === 'ze' || lower === 'zoom extents') renderer?.zoomExtents();
    else if (lower === 'u' || lower === 'undo') doUndo();
    else if (lower === 'redo') doRedo();
    else if (lower === 'del' || lower === 'delete' || lower === 'erase') doDelete();
    else if (lower === 'esc') { drawStep = 0; firstPoint = null; renderer?.clearPreview(); }
    else if (coordPoint) {
      setTool('line');
      handleClick(coordPoint.x, coordPoint.y);
    }
    else statusText = `Unknown: ${cmd}`;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (document.activeElement === commandInput) return;

    if (e.key === 'Escape') {
      if (drawStep > 0) {
        drawStep = 0;
        firstPoint = null;
        renderer?.clearPreview();
        statusText = 'Cancelled';
      } else {
        renderer?.selectionManager.clear();
        selectedEntity = null;
        renderer?.updateSelection();
        renderer?.render();
      }
    }
    else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); doRedo(); }
    else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doUndo(); }
    else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doRedo(); }
    else if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { doDelete(); }
    else if (e.key === 'l') setTool('line');
    else if (e.key === 'c') setTool('circle');
    else if (e.key === 'r') setTool('rectangle');
    else if (e.key === 'a') setTool('arc');
    else if (e.key === 'm') setTool('move');
    else if (e.key === 's') setTool('select');
    else if (e.key === 'F2') { e.preventDefault(); renderer?.zoomExtents(); }
    else if (e.key === '/') { e.preventDefault(); commandInput?.focus(); }
  }

  function handlePropertyUpdate(id: string, changes: any) {
    // Future: update entity properties via kernel
  }

  async function handleNew() {
    if (kernel) {
      const wasmModule = await import('@nexus/kernel');
      kernel = new wasmModule.Kernel();
      renderer?.selectionManager.clear();
      selectedEntity = null;
      projectName = 'untitled';
      syncView();
      statusText = 'New project created';
    }
  }

  async function handleOpen() {
    try {
      const { openFilePicker, deserializeProject, parseDxf } = await import('@nexus/file-io');
      const file = await openFilePicker('.dxf,.nexus,.json');
      if (!file || !kernel) return;

      if (file.name.endsWith('.nexus') || file.name.endsWith('.json')) {
        const project = deserializeProject(file.content);
        if (project) {
          const wasmModule = await import('@nexus/kernel');
          kernel = new wasmModule.Kernel();
          for (const ent of project.entities) {
            const g = ent.geometry;
            if (g.Line) kernel.create_line(g.Line.start.x, g.Line.start.y, g.Line.end.x, g.Line.end.y, ent.layer_id || 'default');
            else if (g.Circle) kernel.create_circle(g.Circle.center.x, g.Circle.center.y, g.Circle.radius, ent.layer_id || 'default');
            else if (g.Arc) kernel.create_arc(g.Arc.center.x, g.Arc.center.y, g.Arc.radius, g.Arc.start_angle, g.Arc.end_angle, ent.layer_id || 'default');
            else if (g.Rectangle) kernel.create_rectangle(g.Rectangle.origin.x, g.Rectangle.origin.y, g.Rectangle.width, g.Rectangle.height, ent.layer_id || 'default');
          }
          projectName = file.name.replace(/\.(nexus|json)$/, '');
          syncView();
          renderer?.zoomExtents();
          statusText = `Opened: ${file.name}`;
        }
      } else if (file.name.endsWith('.dxf')) {
        const imported = parseDxf(file.content);
        const wasmModule = await import('@nexus/kernel');
        kernel = new wasmModule.Kernel();
        for (const ent of imported) {
          const g = ent.geometry;
          if (g.Line) kernel.create_line(g.Line.start.x, g.Line.start.y, g.Line.end.x, g.Line.end.y, ent.layer || 'default');
          else if (g.Circle) kernel.create_circle(g.Circle.center.x, g.Circle.center.y, g.Circle.radius, ent.layer || 'default');
          else if (g.Arc) kernel.create_arc(g.Arc.center.x, g.Arc.center.y, g.Arc.radius, g.Arc.start_angle, g.Arc.end_angle, ent.layer || 'default');
          else if (g.Polyline) {
            const coords = g.Polyline.vertices.flatMap((v: any) => [v.x, v.y]);
            kernel.create_polyline(JSON.stringify(coords), g.Polyline.closed, ent.layer || 'default');
          }
        }
        projectName = file.name.replace('.dxf', '');
        syncView();
        renderer?.zoomExtents();
        statusText = `Imported DXF: ${imported.length} entities from ${file.name}`;
      }
    } catch (e) {
      statusText = `Open failed: ${e}`;
    }
  }

  async function handleSave() {
    if (!kernel) return;
    try {
      const { saveProject, serializeProject } = await import('@nexus/file-io');
      const data = serializeProject(
        kernel.get_entities_json(),
        kernel.get_constraints_json(),
        { name: projectName }
      );
      await saveProject(projectName, data);
      autoSaveStatus = `Saved ${new Date().toLocaleTimeString()}`;
      statusText = `Saved: ${projectName}`;
    } catch (e) {
      statusText = `Save failed: ${e}`;
    }
  }

  async function handleSaveAs() {
    const name = prompt('Project name:', projectName);
    if (name) {
      projectName = name;
      await handleSave();
    }
  }

  async function handleExportDxf() {
    if (!kernel) return;
    try {
      const { exportDxf, downloadFile } = await import('@nexus/file-io');
      const dxf = exportDxf(kernel.get_entities_json());
      downloadFile(dxf, `${projectName}.dxf`, 'application/dxf');
      statusText = `Exported: ${projectName}.dxf`;
    } catch (e) {
      statusText = `Export failed: ${e}`;
    }
  }

  async function handleImportDxf() {
    await handleOpen();
  }

  onMount(async () => {
    try {
      const wasmModule = await import('@nexus/kernel');
      await wasmModule.default();
      kernel = new wasmModule.Kernel();

      renderer = new CadRenderer(canvasContainer);
      renderer.onCursorMove = handleCursorMove;
      renderer.onClick = handleClick;
      renderer.getCanvas().style.cursor = 'crosshair';

      statusText = 'Ready — select a tool or press / for command line';

      kernel.create_line(-10, -10, 10, -10, 'default');
      kernel.create_line(10, -10, 10, 10, 'default');
      kernel.create_line(10, 10, -10, 10, 'default');
      kernel.create_line(-10, 10, -10, -10, 'default');
      kernel.create_circle(0, 0, 5, 'default');
      syncView();
      renderer.zoomExtents();

      // Auto-save every 30 seconds
      autoSaveTimer = setInterval(async () => {
        if (kernel && kernel.entity_count() > 0) {
          await handleSave();
          autoSaveStatus = `Auto-saved ${new Date().toLocaleTimeString()}`;
        }
      }, 30000);
    } catch (e) {
      statusText = `Init error: ${e}`;
      console.error(e);
    }

    return () => {
      renderer?.dispose();
      if (autoSaveTimer) clearInterval(autoSaveTimer);
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app">
  <header class="toolbar">
    <span class="logo">NEXUS</span>

    <FileMenu
      {projectName}
      {autoSaveStatus}
      onNew={handleNew}
      onOpen={handleOpen}
      onSave={handleSave}
      onSaveAs={handleSaveAs}
      onExportDxf={handleExportDxf}
      onImportDxf={handleImportDxf}
    />

    <div class="tool-group">
      <button class:active={currentTool === 'select'} onclick={() => setTool('select')} title="Select (S)">Select</button>
      <span class="separator">|</span>
      <button class:active={currentTool === 'line'} onclick={() => setTool('line')} title="Line (L)">Line</button>
      <button class:active={currentTool === 'circle'} onclick={() => setTool('circle')} title="Circle (C)">Circle</button>
      <button class:active={currentTool === 'rectangle'} onclick={() => setTool('rectangle')} title="Rectangle (R)">Rect</button>
      <button class:active={currentTool === 'arc'} onclick={() => setTool('arc')} title="Arc (A)">Arc</button>
      <span class="separator">|</span>
      <button class:active={currentTool === 'move'} onclick={() => setTool('move')} title="Move (M)">Move</button>
      <button class:active={currentTool === 'copy'} onclick={() => setTool('copy')} title="Copy (CO)">Copy</button>
      <button class:active={currentTool === 'rotate'} onclick={() => setTool('rotate')} title="Rotate (RO)">Rotate</button>
      <button onclick={doDelete} title="Delete (Del)">Delete</button>
      <span class="separator">|</span>
      <button onclick={() => { if (kernel && renderer) {
        const ids = renderer.selectionManager.getSelectedIds();
        if (ids.length === 1) { kernel.add_constraint_horizontal(ids[0]); syncView(); statusText = 'Added horizontal constraint'; }
      }}} title="Horizontal Constraint (H)">H&#x27F7;</button>
      <button onclick={() => { if (kernel && renderer) {
        const ids = renderer.selectionManager.getSelectedIds();
        if (ids.length === 1) { kernel.add_constraint_vertical(ids[0]); syncView(); statusText = 'Added vertical constraint'; }
      }}} title="Vertical Constraint (V)">V&#x2195;</button>
    </div>

    <span class="separator">|</span>

    <button onclick={doUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">&#8630;</button>
    <button onclick={doRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">&#8631;</button>

    <span class="separator">|</span>

    <button class:snap-on={snapEnabled} onclick={() => { snapEnabled = !snapEnabled; if (renderer) renderer.snapEngine.config.enabled = snapEnabled; }}>
      Snap: {snapEnabled ? 'ON' : 'OFF'}
    </button>

    <span class="spacer"></span>
    <span class="entity-count">{entityCount} entities</span>
  </header>

  <main class="workspace">
    <div class="canvas-container" bind:this={canvasContainer}></div>
    <PropertiesPanel entity={selectedEntity} onUpdate={handlePropertyUpdate} />
  </main>

  <footer class="status-bar">
    <div class="command-line">
      <span class="prompt">&gt;</span>
      <input
        bind:this={commandInput}
        bind:value={commandText}
        onkeydown={(e) => e.key === 'Enter' && handleCommand()}
        placeholder="Command (/ to focus, L/C/R/A/M, @x,y, @d<angle)"
        spellcheck="false"
      />
    </div>
    <span class="status-text">{statusText}</span>
    {#if autoSaveStatus}
      <span class="autosave-text">{autoSaveStatus}</span>
    {/if}
    <div class="coordinates">
      {#if hasSnap && snapType !== 'grid'}
        <span class="snap-indicator">[{snapType}]</span>
      {/if}
      <span class="coord-value">{(hasSnap ? snapX : cursorX).toFixed(2)}, {(hasSnap ? snapY : cursorY).toFixed(2)}</span>
    </div>
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
    gap: 4px;
    padding: 0 12px;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
    height: 44px;
    flex-shrink: 0;
  }

  .logo {
    font-weight: 700;
    font-size: 1.1rem;
    color: #e94560;
    letter-spacing: 2px;
    margin-right: 12px;
  }

  .tool-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .toolbar button {
    background: #1a1a2e;
    border: 1px solid #333;
    color: #ccc;
    padding: 4px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.78rem;
    white-space: nowrap;
  }

  .toolbar button:hover { background: #2a2a4e; border-color: #555; }
  .toolbar button:active { background: #0f3460; }
  .toolbar button.active, .toolbar button:global(.active) { background: #0f3460; border-color: #e94560; color: #fff; }
  .toolbar button:disabled { opacity: 0.4; cursor: default; }
  .toolbar button.snap-on { color: #00ff88; border-color: #00ff88; }

  .separator { color: #333; margin: 0 4px; }
  .spacer { flex: 1; }

  .entity-count { font-size: 0.75rem; color: #666; }

  .workspace {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .canvas-container {
    flex: 1;
    position: relative;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 8px;
    background: #16213e;
    border-top: 1px solid #0f3460;
    height: 32px;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .command-line {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 0 0 320px;
  }

  .prompt { color: #e94560; font-weight: bold; }

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

  .command-line input:focus { border-color: #e94560; }

  .status-text {
    flex: 1;
    color: #888;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .coordinates {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 200px;
    justify-content: flex-end;
  }

  .snap-indicator {
    color: #ffaa00;
    font-size: 0.7rem;
  }

  .coord-value {
    color: #00ff88;
    font-family: 'JetBrains Mono', monospace;
  }

  .autosave-text {
    color: #555;
    font-size: 0.7rem;
  }
</style>
