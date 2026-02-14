<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const emit = defineEmits(['close'])

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()

// Reactive form state
const dadPercent = ref(50)
const momPercent = ref(50)
const showFixedPayments = ref(false)
const showCategoryOverrides = ref(false)
const showPerChildRules = ref(false)
const sameRulesForAllChildren = ref(true)

const fixedTransfers = ref([])
const categoryOverrides = ref([])
const cycleStartDate = ref('')

const saving = ref(false)

// Preset split options
const presets = [
  { label: '50/50', dad: 50, mom: 50 },
  { label: '60/40', dad: 60, mom: 40 },
  { label: '70/30', dad: 70, mom: 30 },
  { label: '80/20', dad: 80, mom: 20 }
]

// All available categories
const allCategories = [
  'education',
  'activities',
  'healthcare',
  'clothing',
  'food',
  'legal',
  'events'
]

// Load existing rules on mount
onMounted(() => {
  // Load children
  financeStore.loadChildren()

  if (financeStore.expenseRules?.expense_rules) {
    const rules = financeStore.expenseRules.expense_rules

    // Load default split
    if (rules.default_split) {
      dadPercent.value = rules.default_split.dad_percent || 50
      momPercent.value = rules.default_split.mom_percent || 50
    }

    // Load cycle start date
    if (rules.cycle_start_date) {
      cycleStartDate.value = rules.cycle_start_date
    }

    // Load fixed transfers
    if (rules.fixed_transfers && rules.fixed_transfers.length > 0) {
      fixedTransfers.value = rules.fixed_transfers.map(t => ({
        ...t,
        due_day: t.due_day || 1
      }))
      showFixedPayments.value = true
    }

    // Load category overrides
    if (rules.categories && rules.categories.length > 0) {
      categoryOverrides.value = [...rules.categories]
      showCategoryOverrides.value = true
    }
  }
})

function setPreset(dad, mom) {
  dadPercent.value = dad
  momPercent.value = mom
}

function updateMomPercent() {
  momPercent.value = 100 - dadPercent.value
}

function addFixedTransfer() {
  fixedTransfers.value.push({
    from: 'dad',
    to: 'mom',
    amount: 0,
    label: 'Child Support',
    period: 'monthly',
    due_day: 1
  })
}

function removeFixedTransfer(index) {
  fixedTransfers.value.splice(index, 1)
}

function addCategoryOverride() {
  const unusedCategory = allCategories.find(
    cat => !categoryOverrides.value.some(override => override.name === cat)
  )

  if (unusedCategory) {
    categoryOverrides.value.push({
      name: unusedCategory,
      dad_percent: dadPercent.value,
      mom_percent: momPercent.value,
      budget_limit: null
    })
  }
}

function removeCategoryOverride(index) {
  categoryOverrides.value.splice(index, 1)
}

function updateCategoryMomPercent(override) {
  override.mom_percent = 100 - override.dad_percent
}

async function saveRules() {
  saving.value = true

  try {
    const rules = {
      default_split: {
        dad_percent: dadPercent.value,
        mom_percent: momPercent.value
      },
      cycle_start_date: cycleStartDate.value || null,
      fixed_transfers: fixedTransfers.value,
      categories: categoryOverrides.value,
      other_requires_approval: true
    }

    await financeStore.saveExpenseRules(rules)
    emit('close')
  } catch (err) {
    console.error('Failed to save rules:', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    headerColor="bg-slate-800"
    :title="t('expenseSetup')"
    maxWidth="700px"
    :showFooter="true"
    @close="$emit('close')"
  >
    <div class="setup-body">
      <!-- Section A: Base Split -->
      <div class="setup-section">
        <h3 class="section-title">{{ t('baseSplit') }}</h3>
        <p class="section-desc">{{ t('baseSplitDesc') }}</p>

        <!-- Preset Buttons -->
        <div class="preset-buttons">
          <button
            v-for="preset in presets"
            :key="preset.label"
            @click="setPreset(preset.dad, preset.mom)"
            :class="['preset-btn', { active: dadPercent === preset.dad }]"
          >
            {{ preset.label }}
          </button>
        </div>

        <!-- Split Slider -->
        <div class="split-control">
          <div class="split-labels">
            <span class="split-label bidi-isolate">{{ t('dad') }}: {{ dadPercent }}%</span>
            <span class="split-label bidi-isolate">{{ t('mom') }}: {{ momPercent }}%</span>
          </div>
          <input
            type="range"
            v-model.number="dadPercent"
            @input="updateMomPercent"
            min="0"
            max="100"
            class="split-slider"
          />
        </div>
      </div>

      <!-- Cycle Start Date -->
      <div class="setup-section">
        <h3 class="section-title">{{ t('cycleStartDate') }}</h3>
        <p class="section-desc">{{ t('cycleStartDesc') }}</p>
        <input
          v-model="cycleStartDate"
          type="date"
          class="form-input date-input"
        />
      </div>

      <!-- Section B: Fixed Payments -->
      <div class="setup-section">
        <button
          @click="showFixedPayments = !showFixedPayments"
          class="section-toggle"
        >
          <span class="toggle-text">{{ t('fixedPayments') }}</span>
          <ChevronDown v-if="!showFixedPayments" :size="20" />
          <ChevronUp v-else :size="20" />
        </button>

        <div v-if="showFixedPayments" class="section-content">
          <p class="section-desc">{{ t('fixedPaymentsDesc') }}</p>

          <div
            v-for="(transfer, idx) in fixedTransfers"
            :key="idx"
            class="transfer-form"
          >
            <select v-model="transfer.from" class="form-select">
              <option value="dad">{{ t('dad') }}</option>
              <option value="mom">{{ t('mom') }}</option>
            </select>
            <span class="arrow">→</span>
            <select v-model="transfer.to" class="form-select">
              <option value="dad">{{ t('dad') }}</option>
              <option value="mom">{{ t('mom') }}</option>
            </select>
            <input
              v-model.number="transfer.amount"
              type="number"
              class="form-input amount-input"
              placeholder="0"
            />
            <span class="currency">₪</span>
            <input
              v-model="transfer.label"
              type="text"
              class="form-input label-input"
              :placeholder="t('labelPlaceholder')"
            />
            <div class="due-day-group">
              <label class="due-day-label">{{ t('paymentDueDay') }}</label>
              <input
                v-model.number="transfer.due_day"
                type="number"
                min="1"
                max="31"
                class="form-input due-day-input"
              />
            </div>
            <button @click="removeFixedTransfer(idx)" class="remove-btn">
              <X :size="18" />
            </button>
          </div>

          <button @click="addFixedTransfer" class="add-btn">
            <Plus :size="18" />
            {{ t('addFixedPayment') }}
          </button>
        </div>
      </div>

      <!-- Section C: Category Overrides -->
      <div class="setup-section">
        <button
          @click="showCategoryOverrides = !showCategoryOverrides"
          class="section-toggle"
        >
          <span class="toggle-text">{{ t('categoryOverrides') }}</span>
          <ChevronDown v-if="!showCategoryOverrides" :size="20" />
          <ChevronUp v-else :size="20" />
        </button>

        <div v-if="showCategoryOverrides" class="section-content">
          <p class="section-desc">{{ t('categoryOverridesDesc') }}</p>

          <div
            v-for="(override, idx) in categoryOverrides"
            :key="idx"
            class="category-override-form"
          >
            <select v-model="override.name" class="form-select">
              <option v-for="cat in allCategories" :key="cat" :value="cat">
                {{ t(cat) }}
              </option>
            </select>

            <div class="split-control-small">
              <span class="split-label-small bidi-isolate">{{ t('dad') }}: {{ override.dad_percent }}%</span>
              <input
                type="range"
                v-model.number="override.dad_percent"
                @input="updateCategoryMomPercent(override)"
                min="0"
                max="100"
                class="split-slider-small"
              />
              <span class="split-label-small bidi-isolate">{{ t('mom') }}: {{ override.mom_percent }}%</span>
            </div>

            <div class="budget-control">
              <template v-if="override.budget_limit">
                <input
                  v-model.number="override.budget_limit.amount"
                  type="number"
                  class="form-input budget-input"
                  :placeholder="t('budgetLimit')"
                />
              </template>
              <button
                @click="override.budget_limit = override.budget_limit ? null : { amount: 0, period: 'monthly' }"
                class="budget-toggle-btn"
              >
                {{ override.budget_limit ? t('removeBudget') : t('addBudget') }}
              </button>
            </div>

            <button @click="removeCategoryOverride(idx)" class="remove-btn">
              <X :size="18" />
            </button>
          </div>

          <button
            @click="addCategoryOverride"
            class="add-btn"
            :disabled="categoryOverrides.length >= allCategories.length"
          >
            <Plus :size="18" />
            {{ t('addCategoryOverride') }}
          </button>
        </div>
      </div>

      <!-- Section D: Per-Child Rules (only if >1 child) -->
      <div v-if="financeStore.children.length > 1" class="setup-section">
        <button
          @click="showPerChildRules = !showPerChildRules"
          class="section-toggle"
        >
          <span class="toggle-text">{{ t('perChildRules') }}</span>
          <ChevronDown v-if="!showPerChildRules" :size="20" />
          <ChevronUp v-else :size="20" />
        </button>

        <div v-if="showPerChildRules" class="section-content">
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="sameRulesForAllChildren"
                class="checkbox-input"
              />
              <span>{{ t('sameRulesForAllChildren') }}</span>
            </label>
          </div>

          <div v-if="!sameRulesForAllChildren" class="per-child-notice">
            <p class="notice-text">
              {{ t('perChildRulesNotice') }}
            </p>
            <p class="notice-subtext">
              {{ t('perChildRulesSubtext') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer with Save Button -->
    <template #footer>
      <div class="modal-action-bar">
        <button @click="saveRules" class="modal-primary-btn" :disabled="saving">
          {{ saving ? t('saving') : t('saveRules') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.setup-body {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Sections */
.setup-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 900;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.section-desc {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

.section-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
  text-transform: uppercase;
}

.section-toggle:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 1rem;
}

/* Preset Buttons */
.preset-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.preset-btn {
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
  background: white;
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.preset-btn.active {
  border-color: #1e293b;
  background: #1e293b;
  color: white;
}

/* Split Control */
.split-control {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.split-labels {
  display: flex;
  justify-content: space-between;
}

.split-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
}

.split-slider {
  width: 100%;
  height: 0.5rem;
  border-radius: 0.25rem;
  background: linear-gradient(to right, #FFEDD5 0%, #CCFBF1 100%);
  outline: none;
  cursor: pointer;
}

.split-slider::-webkit-slider-thumb {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #1e293b;
  cursor: pointer;
  border: 3px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.split-slider::-moz-range-thumb {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #1e293b;
  cursor: pointer;
  border: 3px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Forms */
.transfer-form,
.category-override-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.form-select,
.form-input {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  background: white;
}

.form-select {
  min-width: 100px;
}

.amount-input {
  width: 100px;
}

.label-input {
  flex: 1;
  min-width: 150px;
}

.budget-input {
  width: 120px;
}

.date-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  background: white;
}

.date-input:focus {
  outline: none;
  border-color: #1e293b;
}

.due-day-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 70px;
}

.due-day-label {
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.due-day-input {
  width: 70px;
  text-align: center;
}

.arrow,
.currency {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 700;
}

.split-control-small {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 200px;
}

.split-label-small {
  font-size: 0.75rem;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
}

.split-slider-small {
  flex: 1;
  height: 0.375rem;
  border-radius: 0.25rem;
  background: linear-gradient(to right, #FFEDD5 0%, #CCFBF1 100%);
  outline: none;
  cursor: pointer;
}

.split-slider-small::-webkit-slider-thumb {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #1e293b;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.split-slider-small::-moz-range-thumb {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #1e293b;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.budget-control {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.budget-toggle-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  background: white;
  cursor: pointer;
  white-space: nowrap;
}

.budget-toggle-btn:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.remove-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.remove-btn:hover {
  background: #fecaca;
  transform: scale(1.1);
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 2px dashed #cbd5e1;
  border-radius: 1rem;
  background: white;
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover:not(:disabled) {
  border-color: #94a3b8;
  background: #f8fafc;
  color: #1e293b;
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Checkbox */
.checkbox-group {
  padding: 1rem;
  background: white;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
}

.checkbox-input {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: #1e293b;
}

/* Per-child notice */
.per-child-notice {
  padding: 1rem;
  background: #fef3c7;
  border: 2px solid #fbbf24;
  border-radius: 1rem;
}

.notice-text {
  font-size: 0.875rem;
  font-weight: 700;
  color: #92400e;
  margin: 0 0 0.5rem 0;
}

.notice-subtext {
  font-size: 0.75rem;
  color: #78350f;
  margin: 0;
}
</style>
