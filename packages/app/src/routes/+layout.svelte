<script>
  let { children } = $props();
</script>

<svelte:head>
  <style>
    :global(body) {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #1a1a2e;
      color: #e0e0e0;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }
  </style>
</svelte:head>

{@render children()}
