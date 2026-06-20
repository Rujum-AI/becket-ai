<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()

const props = defineProps({
  category: { type: String, required: true },
  size: { type: String, default: 'md' },
  state: { type: String, default: 'neutral' },
  showLabel: { type: Boolean, default: true },
  selected: { type: Boolean, default: false }
})

const cat = computed(() =>
  financeStore.categories.find(c => c.id === props.category)
)
const icon = computed(() => cat.value?.icon || 'finance.png')
const label = computed(() => (cat.value ? t(cat.value.name) : props.category))
</script>

<template>
  <div
    class="category-badge"
    :class="[`size-${size}`, `state-${state}`, { selected }]"
    :aria-label="label"
  >
    <div class="circle">
      <img :src="`/assets/${icon}`" :alt="label" />
    </div>
    <span v-if="showLabel" class="label">{{ label }}</span>
  </div>
</template>

<style scoped>
.category-badge {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  text-align: center;
  line-height: 1;
  transition: opacity 0.2s, filter 0.2s;
}

.circle {
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  background: white;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.label {
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Sizes */
.size-sm .circle { width: 2.75rem;  height: 2.75rem; }
.size-sm .label  { font-size: 0.6rem; }
.size-sm        { gap: 0.3rem; }

.size-md .circle { width: 3.25rem;  height: 3.25rem; }
.size-md .label  { font-size: 0.625rem; }

.size-lg .circle { width: 4rem;     height: 4rem; }
.size-lg .label  { font-size: 0.625rem; }

/* States */
.state-excluded .circle {
  filter: grayscale(1);
  opacity: 0.55;
  border-style: dashed;
  border-color: #cbd5e1;
  box-shadow: none;
}
.state-excluded .label {
  color: #94a3b8;
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

/* state-included and state-neutral both render full-color; the
   distinction matters only when paired with an excluded sibling. */

/* Selected (used by AddExpenseModal category picker) */
.selected .circle {
  border-color: var(--deep-slate, #1e293b);
  border-width: 3px;
  box-shadow: 0 4px 16px rgba(30, 41, 59, 0.2);
}
</style>
