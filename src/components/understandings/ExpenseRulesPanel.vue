<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useUnderstandingsStore } from '@/stores/supabaseUnderstandings'
import { ChevronDown, ChevronUp, Plus, X, Check, AlertCircle, Edit3 } from 'lucide-vue-next'

const { t } = useI18n()
const store = useUnderstandingsStore()

const isEditing = ref(false)

// Form state
const dadPercent = ref(50)
const momPercent = ref(50)
const showFixedPayments = ref(false)
const showCategoryOverrides = ref(false)
const fixedTransfers = ref([])
const categoryOverrides = ref([])

const allCategories = [
  'education', 'activities', 'healthcare', 'clothing', 'food', 'legal', 'events'
]

// Computed: current active rules
const activeRules = computed(() => store.expenseRules)
const pendingRules = computed(() => store.pendingExpenseRules)
const hasRules = computed(() => !!activeRules.value)
const hasPending = computed(() => !!pendingRules.value)

// Initialize form from current rules when entering edit mode
function startEditing() {
  const rules = activeRules.value?.rules || {}
  dadPercent.value = rules.default_split?.dad_percent || 50
  momPercent.value = rules.default_split?.mom_percent || 50
  fixedTransfers.value = rules.fixed_transfers ? JSON.parse(JSON.stringify(rules.fixed_transfers)) : []
  categoryOverrides.value = rules.categories ? JSON.parse(JSON.stringify(rules.categories)) : []
  showFixedPayments.value = fixedTransfers.value.length > 0
  showCategoryOverrides.value = categoryOverrides.value.length > 0
  isEditing.value = true
}

function discardEditing() {
  isEditing.value = false
}

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
    from: 'dad', to: 'mom', amount: 0, label: '', period: 'monthly', due_day: 1, expires: ''
  })
}

function removeFixedTransfer(index) {
  fixedTransfers.value.splice(index, 1)
}

function addCategoryOverride() {
  const unused = allCategories.find(c => !categoryOverrides.value.some(o => o.name === c))
  if (unused) {
    categoryOverrides.value.push({
      name: unused,
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

function saveRules() {
  const rules = {
    default_split: {
      dad_percent: dadPercent.value,
      mom_percent: momPercent.value
    },
    fixed_transfers: fixedTransfers.value,
    categories: categoryOverrides.value,
    other_requires_approval: true
  }

  store.proposeExpenseRules(rules)
  isEditing.value = false
}

function approveRules() {
  store.approveExpenseRules()
}

function rejectRules() {
  store.rejectExpenseRules()
}
</script>

<template>
  <div class="rules-panel">
    <!-- Pending Banner -->
    <div v-if="hasPending && !isEditing" class="pending-banner">
      <div class="pending-content">
        <div class="pending-icon">
          <AlertCircle class="w-4 h-4" />
        </div>
        <div class="pending-info">
          <span class="pending-label">{{ t('pendingExpenseRules') }}</span>
          <span class="pending-creator">{{ t('proposedBy') }}: {{ pendingRules.creator }}</span>
        </div>
      </div>

      <!-- Show proposed changes summary -->
      <div class="pending-summary">
        <div class="summary-item">
          <span class="summary-label">{{ t('baseSplit') }}:</span>
          <span class="summary-value bidi-isolate">
            {{ t('dad') }} {{ pendingRules.rules.default_split?.dad_percent || 50 }}% /
            {{ t('mom') }} {{ pendingRules.rules.default_split?.mom_percent || 50 }}%
          </span>
        </div>
        <div v-if="pendingRules.rules.fixed_transfers?.length" class="summary-item">
          <span class="summary-label">{{ t('fixedPayments') }}:</span>
          <span class="summary-value bidi-isolate" v-for="(ft, i) in pendingRules.rules.fixed_transfers" :key="i">
            {{ ft.label || t('fixedPayment') }}: {{ ft.amount }} ₪/{{ t(ft.period) }}
          </span>
        </div>
        <div v-if="pendingRules.rules.categories?.length" class="summary-item">
          <span class="summary-label">{{ t('categoryOverrides') }}:</span>
          <span class="summary-value bidi-isolate" v-for="(cat, i) in pendingRules.rules.categories" :key="i">
            {{ t(cat.name) }}: {{ cat.dad_percent }}/{{ cat.mom_percent }}
          </span>
        </div>
      </div>

      <div class="pending-actions">
        <button @click="approveRules" class="approve-btn">
          <Check class="w-4 h-4" />
          {{ t('approve') }}
        </button>
        <button @click="rejectRules" class="reject-btn">
          <X class="w-4 h-4" />
          {{ t('reject') }}
        </button>
      </div>
    </div>

    <!-- Read Mode: Show current rules summary -->
    <div v-if="!isEditing" class="rules-summary">
      <div class="summary-header">
        <h3 class="summary-title">{{ t('expenseRules') }}</h3>
        <button @click="startEditing" class="edit-btn">
          <Edit3 class="w-4 h-4" />
          {{ t('edit') }}
        </button>
      </div>

      <div v-if="hasRules" class="rules-content">
        <!-- Base Split -->
        <div class="rule-row">
          <span class="rule-label">{{ t('baseSplit') }}</span>
          <div class="split-bar">
            <div
              class="split-dad"
              :style="{ width: (activeRules.rules.default_split?.dad_percent || 50) + '%' }"
            >
              {{ t('dad') }} {{ activeRules.rules.default_split?.dad_percent || 50 }}%
            </div>
            <div
              class="split-mom"
              :style="{ width: (activeRules.rules.default_split?.mom_percent || 50) + '%' }"
            >
              {{ t('mom') }} {{ activeRules.rules.default_split?.mom_percent || 50 }}%
            </div>
          </div>
        </div>

        <!-- Fixed Transfers -->
        <div v-if="activeRules.rules.fixed_transfers?.length" class="rule-row">
          <span class="rule-label">{{ t('fixedPayments') }}</span>
          <div class="transfers-list">
            <div v-for="(ft, i) in activeRules.rules.fixed_transfers" :key="i" class="transfer-chip">
              <span class="bidi-isolate">{{ ft.label || t('fixedPayment') }}</span>
              <span class="transfer-amount bidi-isolate">{{ ft.amount }} ₪/{{ t(ft.period) }}</span>
              <span class="transfer-direction" dir="ltr">({{ t(ft.from) }} → {{ t(ft.to) }})</span>
              <span v-if="ft.expires" class="transfer-expiry bidi-isolate">{{ t('paymentExpiry') }}: {{ ft.expires }}</span>
            </div>
          </div>
        </div>

        <!-- Category Overrides -->
        <div v-if="activeRules.rules.categories?.length" class="rule-row">
          <span class="rule-label">{{ t('categoryOverrides') }}</span>
          <div class="overrides-grid">
            <div v-for="(cat, i) in activeRules.rules.categories" :key="i" class="override-chip">
              <span class="override-name">{{ t(cat.name) }}</span>
              <span class="override-split bidi-isolate">{{ cat.dad_percent }}/{{ cat.mom_percent }}</span>
              <span v-if="cat.budget_limit" class="override-budget bidi-isolate">
                ({{ t('budgetLimit') }}: {{ cat.budget_limit.amount }} ₪)
              </span>
            </div>
          </div>
        </div>

        <!-- Agreed date -->
        <div v-if="activeRules.approvedDate" class="rule-meta">
          {{ t('agreed') }} {{ activeRules.approvedDate }}
        </div>
      </div>

      <!-- No rules yet -->
      <div v-else class="no-rules">
        <p class="no-rules-text">{{ t('noExpenseRules') }}</p>
        <button @click="startEditing" class="setup-btn">
          {{ t('setupExpenseRules') }}
        </button>
      </div>
    </div>

    <!-- Edit Mode -->
    <div v-else class="rules-editor">
      <div class="editor-header">
        <h3 class="editor-title">{{ t('editExpenseRules') }}</h3>
      </div>

      <!-- Section A: Base Split -->
      <div class="editor-section">
        <label class="editor-label">{{ t('baseSplit') }}</label>
        <p class="editor-desc">{{ t('baseSplitDesc') }}</p>

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

      <!-- Section B: Fixed Payments -->
      <div class="editor-section">
        <button @click="showFixedPayments = !showFixedPayments" class="section-toggle">
          <span>{{ t('fixedPayments') }}</span>
          <ChevronDown v-if="!showFixedPayments" :size="18" />
          <ChevronUp v-else :size="18" />
        </button>

        <div v-if="showFixedPayments" class="section-content">
          <div v-for="(transfer, idx) in fixedTransfers" :key="idx" class="transfer-form">
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
              <input v-model.number="transfer.amount" type="number" class="form-input amount-input" placeholder="0" />
              <span class="currency">₪</span>
              <button @click="removeFixedTransfer(idx)" class="remove-btn">
                <X :size="16" />
              </button>
            </div>
            <div class="transfer-bottom-row">
              <input v-model="transfer.label" type="text" class="form-input label-input" :placeholder="t('labelPlaceholder')" />
              <div class="due-day-group">
                <label class="due-day-label">{{ t('paymentDueDay') }}</label>
                <input v-model.number="transfer.due_day" type="number" min="1" max="31" class="form-input due-day-input" />
              </div>
              <div class="expiry-group">
                <label class="expiry-label">{{ t('paymentExpiry') }}</label>
                <input v-model="transfer.expires" type="date" class="form-input expiry-input" />
              </div>
            </div>
          </div>

          <button @click="addFixedTransfer" class="add-btn">
            <Plus :size="16" />
            {{ t('addFixedPayment') }}
          </button>
        </div>
      </div>

      <!-- Section C: Category Overrides -->
      <div class="editor-section">
        <button @click="showCategoryOverrides = !showCategoryOverrides" class="section-toggle">
          <span>{{ t('categoryOverrides') }}</span>
          <ChevronDown v-if="!showCategoryOverrides" :size="18" />
          <ChevronUp v-else :size="18" />
        </button>

        <div v-if="showCategoryOverrides" class="section-content">
          <div v-for="(override, idx) in categoryOverrides" :key="idx" class="category-form">
            <select v-model="override.name" class="form-select">
              <option v-for="cat in allCategories" :key="cat" :value="cat">{{ t(cat) }}</option>
            </select>

            <div class="split-control-small">
              <span class="split-label-sm bidi-isolate dad-color">{{ t('dad') }}: {{ override.dad_percent }}%</span>
              <input
                type="range"
                v-model.number="override.dad_percent"
                @input="onCategorySliderInput(override)"
                min="0" max="100" step="1"
                class="split-slider-sm"
              />
              <span class="split-label-sm bidi-isolate mom-color">{{ t('mom') }}: {{ override.mom_percent }}%</span>
            </div>

            <div class="budget-control">
              <template v-if="override.budget_limit">
                <input v-model.number="override.budget_limit.amount" type="number" class="form-input budget-input" :placeholder="t('budgetLimit')" />
              </template>
              <button
                @click="override.budget_limit = override.budget_limit ? null : { amount: 0, period: 'monthly' }"
                class="budget-toggle"
              >
                {{ override.budget_limit ? t('removeBudget') : t('addBudget') }}
              </button>
            </div>

            <button @click="removeCategoryOverride(idx)" class="remove-btn">
              <X :size="16" />
            </button>
          </div>

          <button @click="addCategoryOverride" class="add-btn" :disabled="categoryOverrides.length >= allCategories.length">
            <Plus :size="16" />
            {{ t('addCategoryOverride') }}
          </button>
        </div>
      </div>

      <!-- Editor Actions -->
      <div class="editor-actions">
        <button @click="discardEditing" class="discard-btn">{{ t('discard') }}</button>
        <button @click="saveRules" class="save-btn">{{ t('proposeChanges') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rules-panel {
  background: white;
  border-radius: 1.5rem;
  border: 2px solid #e2e8f0;
  overflow: hidden;
  margin-bottom: 1rem;
}

/* Pending Banner */
.pending-banner {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  padding: 1.25rem;
  border-bottom: 2px solid #fbbf24;
}

.pending-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.pending-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d97706;
  flex-shrink: 0;
}

.pending-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.pending-label {
  font-size: 0.8rem;
  font-weight: 800;
  color: #92400e;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pending-creator {
  font-size: 0.7rem;
  color: #a16207;
  font-weight: 600;
}

.pending-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 0.75rem;
  margin-bottom: 0.75rem;
}

.pending-actions {
  display: flex;
  gap: 0.75rem;
}

.approve-btn,
.reject-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.approve-btn {
  background: #0f172a;
  color: white;
  flex: 1;
}

.approve-btn:hover {
  background: #1e293b;
  transform: translateY(-1px);
}

.reject-btn {
  background: white;
  color: #64748b;
  border: 2px solid #e2e8f0;
  flex: 1;
}

.reject-btn:hover {
  border-color: #dc2626;
  color: #dc2626;
}

/* Summary View */
.rules-summary {
  padding: 1.25rem;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.summary-title {
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  margin: 0;
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  background: white;
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn:hover {
  border-color: #0f172a;
  color: #0f172a;
}

.rules-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rule-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rule-label {
  font-size: 0.65rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

/* Read-mode split bar — wider like expenses bar, flips with RTL */
.split-bar {
  display: flex;
  border-radius: 1.5rem;
  overflow: hidden;
  height: 2.5rem;
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.split-dad {
  background: linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%);
  color: #0f766e;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 3rem;
}

.split-mom {
  background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%);
  color: #9a3412;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 3rem;
}

.transfers-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.transfer-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
  flex-wrap: wrap;
}

.transfer-amount {
  font-weight: 800;
  color: #0f172a;
}

.transfer-direction {
  color: #94a3b8;
  font-size: 0.7rem;
}

.transfer-expiry {
  font-size: 0.65rem;
  font-weight: 600;
  color: #d97706;
  background: #fef3c7;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
}

/* Direction flow — always LTR so From → To reads correctly */
.direction-flow {
  direction: ltr;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.arrow {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 700;
}

.overrides-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.override-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.override-name {
  color: #64748b;
}

.override-split {
  font-weight: 800;
  color: #0f172a;
}

.override-budget {
  color: #d97706;
  font-size: 0.65rem;
}

.rule-meta {
  font-size: 0.65rem;
  font-weight: 700;
  color: #94a3b8;
  padding-top: 0.5rem;
  border-top: 1px solid #f1f5f9;
}

/* No rules */
.no-rules {
  text-align: center;
  padding: 1.5rem 0;
}

.no-rules-text {
  color: #94a3b8;
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
}

.setup-btn {
  padding: 0.75rem 1.5rem;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 0.75rem;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
}

.setup-btn:hover {
  background: #1e293b;
  transform: translateY(-1px);
}

/* Edit Mode */
.rules-editor {
  padding: 1.25rem;
}

.editor-header {
  margin-bottom: 1.5rem;
}

.editor-title {
  font-size: 0.8rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #0f172a;
  margin: 0;
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.editor-label {
  font-size: 0.65rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.editor-desc {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0;
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
  font-size: 0.7rem;
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
  width: 3rem;
  border: none;
  background: transparent;
  font-size: 0.9rem;
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
  font-size: 0.8rem;
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
  font-size: 0.55rem;
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
  background: #0f172a;
  cursor: pointer;
  border: 3px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.split-slider::-moz-range-thumb {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #0f172a;
  cursor: pointer;
  border: 3px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

/* Section Toggle */
.section-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 0.75rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
  color: #1e293b;
  text-transform: uppercase;
  transition: all 0.2s;
  width: 100%;
}

.section-toggle:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.75rem;
}

/* Transfer / Category Forms */
.transfer-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: white;
  border-radius: 0.75rem;
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

.category-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.form-select,
.form-input {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #1e293b;
  background: white;
}

.form-select { min-width: 80px; }
.amount-input { width: 80px; }
.label-input { flex: 1; min-width: 100px; }
.budget-input { width: 100px; }

.due-day-group {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 60px;
}

.due-day-label {
  font-size: 0.55rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #94a3b8;
}

.due-day-input {
  width: 60px;
  text-align: center;
}

.expiry-group {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.expiry-label {
  font-size: 0.55rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #d97706;
}

.expiry-input {
  min-width: 120px;
  font-size: 0.75rem;
}

.currency {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 700;
}

/* Category override split control */
.split-control-small {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 180px;
  direction: ltr;
}

.split-label-sm {
  font-size: 0.65rem;
  font-weight: 700;
  white-space: nowrap;
}

.split-label-sm.dad-color {
  color: #0f766e;
}

.split-label-sm.mom-color {
  color: #9a3412;
}

.split-slider-sm {
  flex: 1;
  height: 0.5rem;
  border-radius: 0.25rem;
  background: linear-gradient(to right, #CCFBF1 0%, #FFEDD5 100%);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
}

.split-slider-sm::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #0f172a;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.split-slider-sm::-moz-range-thumb {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #0f172a;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.budget-control {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.budget-toggle {
  padding: 0.375rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  background: white;
  cursor: pointer;
  white-space: nowrap;
}

.budget-toggle:hover {
  border-color: #cbd5e1;
}

.remove-btn {
  width: 1.75rem;
  height: 1.75rem;
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
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  border: 2px dashed #cbd5e1;
  border-radius: 0.75rem;
  background: white;
  font-size: 0.8rem;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover:not(:disabled) {
  border-color: #94a3b8;
  color: #1e293b;
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Summary item */
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.summary-label {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #78350f;
  letter-spacing: 0.03em;
}

.summary-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: #451a03;
}

/* Editor Actions */
.editor-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

.discard-btn {
  flex: 1;
  padding: 0.75rem;
  background: #f8fafc;
  color: #64748b;
  border: 2px solid #e2e8f0;
  border-radius: 0.75rem;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}

.discard-btn:hover {
  border-color: #cbd5e1;
}

.save-btn {
  flex: 2;
  padding: 0.75rem;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 0.75rem;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn:hover {
  background: #1e293b;
  transform: translateY(-1px);
}
</style>
