<script lang="ts">
  let { onNew, onOpen, onSave, onSaveAs, onExportDxf, onImportDxf, projectName, autoSaveStatus } = $props<{
    onNew: () => void;
    onOpen: () => void;
    onSave: () => void;
    onSaveAs: () => void;
    onExportDxf: () => void;
    onImportDxf: () => void;
    projectName: string;
    autoSaveStatus: string;
  }>();

  let open = $state(false);

  function handleAction(action: () => void) {
    action();
    open = false;
  }
</script>

<div class="file-menu">
  <button class="menu-trigger" onclick={() => open = !open}>
    File ▾
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="backdrop" onclick={() => open = false}></div>
    <div class="dropdown">
      <button onclick={() => handleAction(onNew)}>New Project</button>
      <button onclick={() => handleAction(onOpen)}>Open...</button>
      <hr />
      <button onclick={() => handleAction(onSave)}>Save <span class="shortcut">Ctrl+S</span></button>
      <button onclick={() => handleAction(onSaveAs)}>Save As...</button>
      <hr />
      <button onclick={() => handleAction(onImportDxf)}>Import DXF...</button>
      <button onclick={() => handleAction(onExportDxf)}>Export DXF</button>
      <hr />
      <div class="menu-info">
        <span class="label">Project:</span> {projectName || 'untitled'}
      </div>
      <div class="menu-info">
        <span class="label">Auto-save:</span> {autoSaveStatus}
      </div>
    </div>
  {/if}
</div>

<style>
  .file-menu {
    position: relative;
  }

  .menu-trigger {
    background: #1a1a2e;
    border: 1px solid #333;
    color: #ccc;
    padding: 4px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.78rem;
  }

  .menu-trigger:hover {
    background: #2a2a4e;
    border-color: #555;
  }

  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 4px;
    min-width: 220px;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .dropdown button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    color: #ccc;
    padding: 8px 16px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    text-align: left;
  }

  .dropdown button:hover {
    background: #0f3460;
    color: #fff;
  }

  .shortcut {
    color: #666;
    font-size: 0.7rem;
  }

  hr {
    border: none;
    border-top: 1px solid #0f3460;
    margin: 2px 0;
  }

  .menu-info {
    padding: 6px 16px;
    font-size: 0.72rem;
    color: #666;
  }

  .menu-info .label {
    color: #888;
  }
</style>
