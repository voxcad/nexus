<script lang="ts">
  let { entity, onUpdate } = $props<{
    entity: any | null;
    onUpdate: (id: string, changes: any) => void;
  }>();

  let collapsed = $state(false);
</script>

{#if !collapsed}
<aside class="properties-panel">
  <div class="panel-header">
    <span>Properties</span>
    <button onclick={() => collapsed = true} title="Collapse">x</button>
  </div>

  {#if entity}
    <div class="prop-group">
      <div class="prop-label">ID</div>
      <div class="prop-value">{entity.id}</div>
    </div>
    <div class="prop-group">
      <div class="prop-label">Type</div>
      <div class="prop-value">{Object.keys(entity.geometry)[0]}</div>
    </div>
    <div class="prop-group">
      <div class="prop-label">Layer</div>
      <div class="prop-value">{entity.layer_id}</div>
    </div>

    <hr />

    {#if entity.geometry.Line}
      <div class="prop-group">
        <div class="prop-label">Start X</div>
        <div class="prop-value">{entity.geometry.Line.start.x.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Start Y</div>
        <div class="prop-value">{entity.geometry.Line.start.y.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">End X</div>
        <div class="prop-value">{entity.geometry.Line.end.x.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">End Y</div>
        <div class="prop-value">{entity.geometry.Line.end.y.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Length</div>
        <div class="prop-value">
          {Math.sqrt(
            (entity.geometry.Line.end.x - entity.geometry.Line.start.x) ** 2 +
            (entity.geometry.Line.end.y - entity.geometry.Line.start.y) ** 2
          ).toFixed(3)}
        </div>
      </div>
    {:else if entity.geometry.Circle}
      <div class="prop-group">
        <div class="prop-label">Center X</div>
        <div class="prop-value">{entity.geometry.Circle.center.x.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Center Y</div>
        <div class="prop-value">{entity.geometry.Circle.center.y.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Radius</div>
        <div class="prop-value">{entity.geometry.Circle.radius.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Area</div>
        <div class="prop-value">{(Math.PI * entity.geometry.Circle.radius ** 2).toFixed(3)}</div>
      </div>
    {:else if entity.geometry.Rectangle}
      <div class="prop-group">
        <div class="prop-label">Origin X</div>
        <div class="prop-value">{entity.geometry.Rectangle.origin.x.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Origin Y</div>
        <div class="prop-value">{entity.geometry.Rectangle.origin.y.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Width</div>
        <div class="prop-value">{entity.geometry.Rectangle.width.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Height</div>
        <div class="prop-value">{entity.geometry.Rectangle.height.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Area</div>
        <div class="prop-value">{(entity.geometry.Rectangle.width * entity.geometry.Rectangle.height).toFixed(3)}</div>
      </div>
    {:else if entity.geometry.Arc}
      <div class="prop-group">
        <div class="prop-label">Center X</div>
        <div class="prop-value">{entity.geometry.Arc.center.x.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Center Y</div>
        <div class="prop-value">{entity.geometry.Arc.center.y.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Radius</div>
        <div class="prop-value">{entity.geometry.Arc.radius.toFixed(3)}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">Start Angle</div>
        <div class="prop-value">{(entity.geometry.Arc.start_angle * 180 / Math.PI).toFixed(1)}&deg;</div>
      </div>
      <div class="prop-group">
        <div class="prop-label">End Angle</div>
        <div class="prop-value">{(entity.geometry.Arc.end_angle * 180 / Math.PI).toFixed(1)}&deg;</div>
      </div>
    {/if}
  {:else}
    <div class="no-selection">No entity selected</div>
  {/if}
</aside>
{:else}
<button class="expand-btn" onclick={() => collapsed = false} title="Show Properties">
  &#9776;
</button>
{/if}

<style>
  .properties-panel {
    width: 240px;
    background: #16213e;
    border-left: 1px solid #0f3460;
    padding: 0;
    overflow-y: auto;
    font-size: 0.8rem;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #0f3460;
    font-weight: 600;
    color: #e0e0e0;
  }

  .panel-header button {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 1rem;
  }

  .prop-group {
    display: flex;
    justify-content: space-between;
    padding: 4px 12px;
    border-bottom: 1px solid #1a1a2e;
  }

  .prop-label {
    color: #888;
  }

  .prop-value {
    color: #00ff88;
    font-family: 'JetBrains Mono', monospace;
  }

  hr {
    border: none;
    border-top: 1px solid #0f3460;
    margin: 4px 0;
  }

  .no-selection {
    padding: 12px;
    color: #555;
    text-align: center;
  }

  .expand-btn {
    position: absolute;
    right: 8px;
    top: 52px;
    background: #16213e;
    border: 1px solid #0f3460;
    color: #888;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    z-index: 10;
  }
</style>
