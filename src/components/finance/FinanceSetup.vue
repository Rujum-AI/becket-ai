<script setup>
import { ref, onMounted } from 'vue'
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
  financeStore.loadChildren()

  if (financeStore.expenseRules?.expense_rules) {
    const rules = financeStore.expenseRules.expense_rules

    if (rules.default_split) {
      dadPercent.value = rules.default_split.dad_percent || 50
      momPercent.value = rules.default_split.mom_percent || 50
    }

    if (rules.cycle_start_date) {
      cycleStartDate.value = rules.cycle_start_date
    }

    if (rules.fixed_transfers && rules.fixed_transfers.length > 0) {
      fixedTransfers.value = rules.fixed_transfers.map(t => ({
        ...t,
        due_day: t.due_day || 1,
        expires: t.expires || ''
      }))
      showFixedPayments.value = true
    }

    if (rules.categories && rules.categories.length > 0) {
      categoryOverrides.value = [...rules.categories]
      showCategoryOverrides.value = true
    }
  }
})

// Slider snaps to nearest 10%
function onSliderInput() {
  dadPercent.value = Math.round(dadPercent.value / 10) * 10
  momPercent.value = 100 - dadPercent.value
}

// Typed inputs allow any value 0-100
function onDadTyped() {
  dadPercent.value = Math.max(0, Math.min(100, dadPercent.value))
  momPercent.value = 100 - dadPercent.value
}

function onMomTyped() {
  momPercent.value = Math.max(0, Math.min(100, momPercent.value))
  dadPercent.value = 100 - momPercent.value
}

function addFixedTransfer() {
  fixedTransfers.value.push({
    from: 'dad',
    to: 'mom',
    amount: 0,
    label: '',
    period: 'monthly',
    due_day: 1,
    expires: ''
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

// Category slider also snaps to 10%
function onCategorySliderInput(override) {
  override.dad_percent = Math.round(override.dad_percent / 10) * 10
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

        <div class="split-control">
          <div class="split-typed-row">
            <div class="typed-input-group dad-input-group">
              <span class="typed-label">{{ t('dad') }}</span>
              <div class="typed-field">
                <input type="number" v-model.number="dadPercent" @input="onDadTyped" min="0" max="100" class="percent-input" />
                <span class="percent-sign">%</span>
              </div>
            </div>
            <div class="typed-input-group mom-input-group">
              <span class="typed-label">{{ t('mom') }}</span>
              <div class="typed-field">
                <input type="number" v-model.number="momPercent" @input="onMomTyped" min="0" max="100" class="percent-input" />
                <span class="percent-sign">%</span>
              </div>
            </div>
          </div>
          <div class="slider-wrapper">
            <div class="tick-marks">
              <div v-for="i in 11" :key="i" class="tick" :style="{ left: ((i - 1) * 10) + '%' }">
                <div class="tick-line"></div>
                <span v-if="(i - 1) % 2 === 0" class="tick-label">{{ (i - 1) * 10 }}</span>
              </div>
            </div>
            <input
              type="range"
              v-model.number="dadPercent"
              @input="onSliderInput"
              min="0"
              max="100"
              step="1"
              class="split-slider"
            />
          </div>
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
            <div class="transfer-top-row">
              <div class="direction-flow">
                <select v-model="transfer.from" class="form-select">
                  <option value="dad">{{ t('dad') }}</option>
                  <option value="mom">{{ t('mom') }}</option>
                </select>
                <span class="arrow">→</span>
                <select v-model="transfer.to" class="form-select">
                  <option value="dad">{{ t('dad') }}</option>
                  <option value="mom">{{ t('mom') }}</option>
                </select>
              </div>
              <input
                v-model.number="transfer.amount"
                type="number"
                class="form-input amount-input"
                placeholder="0"
              />
              <span class="currency">₪</span>
              <button @click="removeFixedTransfer(idx)" class="remove-btn">
                <X :size="18" />
              </button>
            </div>
            <div class="transfer-bottom-row">
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
              <div class="expiry-group">
                <label class="expiry-label">{{ t('paymentExpiry') }}</label>
                <input
                  v-model="transfer.expires"
                  type="date"
                  class="form-input expiry-input"
                />
              </div>
            </div>
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
              <span class="split-label-small bidi-isolate dad-color">{{ t('dad') }}: {{ override.dad_percent }}%</span>
              <input
                type="range"
                v-model.number="override.dad_percent"
                @input="onCategorySliderInput(override)"
                min="0"
                max="100"
                step="1"
                class="split-slider-small"
              />
              <span class="split-label-small bidi-isolate mom-color">{{ t('mom') }}: {{ override.mom_percent }}%</span>
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

/* Split Control with typed inputs + snapping slider */
.split-control {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.split-typed-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.typed-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dad-input-group .typed-label {
  color: #0f766e;
  background: #CCFBF1;
  padding: 0.25rem 0.625rem;
  border-radius: 0.5rem;
}

.mom-input-group .typed-label {
  color: #9a3412;
  background: #FFEDD5;
  padding: 0.25rem 0.625rem;
  border-radius: 0.5rem;
}

.typed-label {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.typed-field {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.25rem 0.5rem;
}

.percent-input {
  width: 3.5rem;
  border: none;
  background: transparent;
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
}

.percent-input::-webkit-inner-spin-button,
.percent-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.percent-sign {
  font-size: 0.875rem;
  font-weight: 700;
  color: #94a3b8;
}

/* Slider with tick marks */
.slider-wrapper {
  position: relative;
  padding: 0.5rem 0 1.75rem 0;
  direction: ltr;
}

.tick-marks {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.tick {
  position: absolute;
  top: 0.25rem;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tick-line {
  width: 2px;
  height: 0.75rem;
  background: #cbd5e1;
  border-radius: 1px;
}

.tick-label {
  font-size: 0.6rem;
  font-weight: 700;
  color: #94a3b8;
  margin-top: 0.75rem;
}

.split-slider {
  width: 100%;
  height: 0.75rem;
  border-radius: 0.5rem;
  background: linear-gradient(to right, #CCFBF1 0%, #FFEDD5 100%);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  position: relative;
  z-index: 1;
  margin: 0;
}

.split-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #1e293b;
  cursor: pointer;
  border: 3px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.split-slider::-moz-range-thumb {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #1e293b;
  cursor: pointer;
  border: 3px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

/* Forms */
.transfer-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
}

.transfer-top-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.transfer-bottom-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

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

.expiry-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.expiry-label {
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #d97706;
  letter-spacing: 0.05em;
}

.expiry-input {
  min-width: 130px;
  font-size: 0.8rem;
}

/* Direction flow — always LTR so From → To reads correctly */
.direction-flow {
  direction: ltr;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.arrow {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 700;
}

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
  direction: ltr;
}

.split-label-small {
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.split-label-small.dad-color {
  color: #0f766e;
}

.split-label-small.mom-color {
  color: #9a3412;
}

.split-slider-small {
  flex: 1;
  height: 0.5rem;
  border-radius: 0.25rem;
  background: linear-gradient(to right, #CCFBF1 0%, #FFEDD5 100%);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
}

.split-slider-small::-webkit-slider-thumb {
  -webkit-appearance: none;
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
