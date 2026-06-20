<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import CategoryBadge from '@/components/shared/CategoryBadge.vue'

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()

const props = defineProps({
  dadPercent: { type: Number, required: true },
  momPercent: { type: Number, required: true },
  overrides: { type: Array, required: true },
  included: { type: [Array, null], default: null }
})
const emit = defineEmits(['update:overrides', 'update:included'])

const expandedId = ref(null)

onMounted(() => {
  financeStore.loadCategoryBudgets()
})

function toggleExpand(catId) {
  expandedId.value = expandedId.value === catId ? null : catId
}

// Flush any in-progress budget edit before the input is unmounted.
watch(expandedId, (_, prev) => {
  if (prev && budgetDraft.value[prev] !== undefined) commitBudget(prev)
})

const expandedCat = computed(() =>
  financeStore.categories.find(c => c.id === expandedId.value) || null
)

function isIncluded(catId) {
  if (props.included === null) return true
  return props.included.includes(catId)
}

function setIncluded(catId, include) {
  // Materialize null → full list before mutating.
  const base = props.included === null
    ? financeStore.categories.map(c => c.id)
    : [...props.included]
  if (include) {
    if (!base.includes(catId)) base.push(catId)
    emit('update:included', base)
  } else {
    emit('update:included', base.filter(c => c !== catId))
    // Excluded categories can't carry overrides — strip any.
    emit('update:overrides', props.overrides.filter(o => o.name !== catId))
  }
}

function getOverride(catId) {
  return props.overrides.find(o => o.name === catId) || null
}

function effectiveSplit(catId) {
  const ov = getOverride(catId)
  if (ov) return { dad: ov.dad_percent, mom: ov.mom_percent, hasOverride: true }
  return { dad: props.dadPercent, mom: props.momPercent, hasOverride: false }
}

function setSplit(catId, dadRaw) {
  const dad = Math.round(Number(dadRaw) / 10) * 10
  const mom = 100 - dad
  const existing = getOverride(catId)
  // Matches base → strip the override (keeps the rule terse).
  if (dad === props.dadPercent && mom === props.momPercent) {
    if (existing) emit('update:overrides', props.overrides.filter(o => o.name !== catId))
    return
  }
  if (existing) {
    emit('update:overrides', props.overrides.map(o =>
      o.name === catId ? { ...o, dad_percent: dad, mom_percent: mom } : o
    ))
  } else {
    emit('update:overrides', [...props.overrides, { name: catId, dad_percent: dad, mom_percent: mom }])
  }
}

// Budget: live save to category_budgets table (no rule-approval flow).
const budgetDraft = ref({})

function budgetFor(catId) {
  if (budgetDraft.value[catId] !== undefined) return budgetDraft.value[catId]
  const b = financeStore.getCategoryBudget(catId, null, 'monthly')
  return b ? String(b.limit_amount) : ''
}

function onBudgetInput(catId, value) {
  budgetDraft.value[catId] = value
}

async function commitBudget(catId) {
  const val = budgetDraft.value[catId]
  if (val === undefined) return
  const num = Number(val)
  if (val === '' || isNaN(num) || num <= 0) {
    await financeStore.removeCategoryBudget({ category: catId, period: 'monthly' })
  } else {
    await financeStore.saveCategoryBudget({ category: catId, period: 'monthly', amount: num })
  }
  delete budgetDraft.value[catId]
}
</script>

<template>
  <div class="cat-editor">
    <div class="cat-editor-grid">
      <button
        v-for="cat in financeStore.categories"
        :key="cat.id"
        @click="toggleExpand(cat.id)"
        class="cat-editor-btn"
        :aria-expanded="expandedId === cat.id"
      >
        <CategoryBadge
          :category="cat.id"
          size="lg"
          :state="isIncluded(cat.id) ? 'included' : 'excluded'"
          :selected="expandedId === cat.id"
        />
      </button>
    </div>

    <div v-if="expandedCat" class="cat-editor-panel">
      <div class="panel-header">
        <CategoryBadge :category="expandedCat.id" size="md" :show-label="false" />
        <span class="panel-cat-name">{{ t(expandedCat.name) }}</span>
      </div>

      <!-- Budget -->
      <div class="panel-field">
        <label class="panel-label">{{ t('monthlyBudget') }}</label>
        <div class="panel-input-row">
          <input
            type="number"
            min="0"
            inputmode="numeric"
            :value="budgetFor(expandedCat.id)"
            @input="onBudgetInput(expandedCat.id, $event.target.value)"
            @blur="commitBudget(expandedCat.id)"
            @keydown.enter="commitBudget(expandedCat.id)"
            class="panel-input"
            :placeholder="t('addBudget')"
          />
          <span class="panel-input-suffix bidi-isolate">₪ / {{ t('monthly').toLowerCase() }}</span>
        </div>
      </div>

      <!-- Split -->
      <div class="panel-field">
        <label class="panel-label">{{ t('splitOverride') }}</label>
        <div class="panel-split-row">
          <span class="split-tag dad-color bidi-isolate">{{ t('dad') }}: {{ effectiveSplit(expandedCat.id).dad }}%</span>
          <input
            type="range"
            :value="effectiveSplit(expandedCat.id).dad"
            @input="setSplit(expandedCat.id, $event.target.value)"
            min="0" max="100" step="10"
            class="panel-slider"
            :disabled="!isIncluded(expandedCat.id)"
          />
          <span class="split-tag mom-color bidi-isolate">{{ t('mom') }}: {{ effectiveSplit(expandedCat.id).mom }}%</span>
        </div>
        <p v-if="!effectiveSplit(expandedCat.id).hasOverride" class="panel-hint">
          {{ t('splitUsingBase') }}
        </p>
      </div>

      <!-- Exclude / Include toggle -->
      <button
        v-if="isIncluded(expandedCat.id)"
        @click="setIncluded(expandedCat.id, false)"
        class="panel-toggle-btn panel-toggle-exclude"
      >
        {{ t('excludeAction') }}
      </button>
      <button
        v-else
        @click="setIncluded(expandedCat.id, true)"
        class="panel-toggle-btn panel-toggle-include"
      >
        {{ t('includeAction') }}
      </button>

      <p v-if="!isIncluded(expandedCat.id)" class="panel-excluded-note">
        {{ t('excludedNote') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.cat-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cat-editor-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  justify-items: center;
}

@media (max-width: 380px) {
  .cat-editor-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.cat-editor-btn {
  background: transparent;
  border: none;
  padding: 0.4rem;
  cursor: pointer;
  border-radius: 0.75rem;
  transition: background 0.2s;
}
.cat-editor-btn:hover {
  background: #f1f5f9;
}
.cat-editor-btn:hover :deep(.circle) {
  transform: scale(1.05);
}

/* Expanded panel */
.cat-editor-panel {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.panel-cat-name {
  font-size: 1rem;
  font-weight: 800;
  color: #1e293b;
  text-transform: capitalize;
}

.panel-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.panel-label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.panel-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.panel-input {
  flex: 1;
  min-width: 0;
  padding: 0.6rem 0.75rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  font-weight: 700;
  background: white;
}
.panel-input:focus {
  outline: none;
  border-color: #1e293b;
}
.panel-input-suffix {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  white-space: nowrap;
}

.panel-split-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
}
.split-tag {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.dad-color { color: #c2410c; }
.mom-color { color: #0f766e; }
.panel-slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(to right, #FED7AA, #99F6E4);
  border-radius: 9999px;
  outline: none;
}
.panel-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #1e293b;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  cursor: pointer;
}
.panel-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #1e293b;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  cursor: pointer;
}
.panel-slider:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.panel-hint {
  font-size: 0.65rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.panel-toggle-btn {
  align-self: stretch;
  padding: 0.7rem 1rem;
  border-radius: 0.6rem;
  border: 1.5px solid transparent;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
}
.panel-toggle-exclude {
  background: white;
  border-color: #fecaca;
  color: #b91c1c;
}
.panel-toggle-exclude:hover {
  background: #fef2f2;
}
.panel-toggle-include {
  background: white;
  border-color: #6ee7b7;
  color: #065f46;
}
.panel-toggle-include:hover {
  background: #ecfdf5;
}

.panel-excluded-note {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
  text-align: center;
  margin: 0;
  font-style: italic;
}
</style>
