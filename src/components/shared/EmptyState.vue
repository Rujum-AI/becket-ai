<script setup>
defineProps({
  icon: { type: [Object, Function], default: null },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  cta: { type: Object, default: null }
})

const emit = defineEmits(['cta'])

function handleCta() {
  emit('cta')
}
</script>

<template>
  <div class="empty-state">
    <div v-if="icon" class="empty-state-icon">
      <component :is="icon" :size="28" />
    </div>
    <h3 class="empty-state-title">{{ title }}</h3>
    <p v-if="message" class="empty-state-message">{{ message }}</p>
    <button
      v-if="cta && cta.label"
      class="empty-state-cta"
      @click="cta.action ? cta.action() : handleCta()"
    >
      {{ cta.label }}
    </button>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2.5rem 1.5rem;
  background: white;
  border-radius: 1.5rem;
  border: 2px dashed #e2e8f0;
  gap: 0.5rem;
}

.empty-state-icon {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: #f1f5f9;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.empty-state-title {
  font-family: 'Fraunces', serif;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  line-height: 1.3;
}

:global(.lang-he) .empty-state-title {
  font-family: 'Assistant', sans-serif;
  font-weight: 800;
}

.empty-state-message {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
  margin: 0;
  line-height: 1.45;
  max-width: 28rem;
}

.empty-state-cta {
  margin-top: 0.75rem;
  padding: 0.55rem 1.25rem;
  border-radius: 9999px;
  border: none;
  background: #0f172a;
  color: white;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
}

.empty-state-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.25);
}

.empty-state-cta:active {
  transform: scale(0.97);
}

@media (max-width: 479px) {
  .empty-state {
    padding: 2rem 1rem;
  }
  .empty-state-icon {
    width: 3.25rem;
    height: 3.25rem;
  }
}
</style>
