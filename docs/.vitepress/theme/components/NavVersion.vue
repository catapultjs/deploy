<script setup lang="ts">
import { version } from '../../../../package.json'
</script>

<template>
  <span class="nav-version">v{{ version }}</span>
</template>

<style scoped>
.nav-version {
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  margin-left: 0.5rem;
  align-self: center;
}
</style>
