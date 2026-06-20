<script setup>
defineProps({
  noSummaryCard: { type: Boolean, default: false }
})
</script>

<template>
  <div class="module-dashboard">
    <div v-if="$slots.header" class="module-dashboard-header">
      <slot name="header" />
    </div>

    <template v-if="$slots.summary">
      <div v-if="noSummaryCard" class="module-summary-plain">
        <slot name="summary" />
      </div>
      <div v-else class="module-summary-card">
        <slot name="summary" />
      </div>
    </template>

    <slot />
  </div>
</template>

<style scoped>
.module-dashboard {
  display: flex;
  flex-direction: column;
}

.module-dashboard-header {
  margin-bottom: 0.75rem;
}

.module-summary-plain {
  margin-bottom: 1.5rem;
}

.module-summary-card {
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  border-radius: 1.5rem;
  border: 1px solid #f1f5f9;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

@media (max-width: 479px) {
  .module-summary-card {
    padding: 1rem;
  }
}
</style>
