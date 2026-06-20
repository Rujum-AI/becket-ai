<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import { useUnderstandingsStore } from '@/stores/supabaseUnderstandings'
import { Plus, X, Check, AlertCircle } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const emit = defineEmits(['close'])

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()
const understandingsStore = useUnderstandingsStore()

// ===== Form state =====
const dadPercent = ref(50)
const momPercent = ref(50)
const sameRulesForAllChildren = ref(true)
const showPerChildRules = ref(false)

const fixedTransfers = ref([])
const categoryOverrides = ref([])
const cycleStartDate = ref('')

// Included categories — every known category is "in" by default; parents can
// opt-out individually. An empty set means *all* (legacy / not-yet-touched
// rule); a present array is the explicit included list.
const includedCategories = ref(null)

const saving = ref(false)

const allCategories = computed(() => financeStore.categories)

// ===== Load existing rules (active rule first, fall back to local copy) =====
function loadFromRule(rule) {
  if (!rule) return
  if (rule.default_split) {
    dadPercent.value = rule.default_split.dad_percent ?? 50
    momPercent.value = rule.default_split.mom_percent ?? 50
  }
  cycleStartDate.value = rule.cycle_start_date || ''
  fixedTransfers.value = (rule.fixed_transfers || []).map(ft => ({
    ...ft,
    due_day: ft.due_day || 1,
    expires: ft.expires || ''
  }))
  categoryOverrides.value = JSON.parse(JSON.stringify(rule.categories || []))
  includedCategories.value = Array.isArray(rule.included_categories)
    ? [...rule.included_categories]
    : null
}

onMounted(async () => {
  financeStore.loadChildren()
  await understandingsStore.loadAll()
  const rule = understandingsStore.expenseRules?.rules || financeStore.expenseRules?.expense_rules
  if (rule) loadFromRule(rule)
})

// Re-hydrate if the active rule changes mid-session (e.g. partner just approved).
watch(() => understandingsStore.expenseRules, (rule) => {
  if (rule?.rules) loadFromRule(rule.rules)
})

// ===== Pending change (banner) =====
const pendingChange = computed(() => understandingsStore.pendingExpenseRules)
const hasPending = computed(() => !!pendingChange.value)

async function approvePending() {
  await understandingsStore.approveExpenseRules()
  // Re-hydrate form from the now-active rule.
  const rule = understandingsStore.expenseRules?.rules
  if (rule) loadFromRule(rule)
}

async function rejectPending() {
  await understandingsStore.rejectExpenseRules()
}

// ===== Slider helpers =====
function onSliderInput() {
  dadPercent.value = Math.round(dadPercent.value / 10) * 10
  momPercent.value = 100 - dadPercent.value
}
function onDadTyped() {
  dadPercent.value = Math.max(0, Math.min(100, dadPercent.value))
  momPercent.value = 100 - dadPercent.value
}
function onMomTyped() {
  momPercent.value = Math.max(0, Math.min(100, momPercent.value))
  dadPercent.value = 100 - momPercent.value
}

// ===== Recurring payments =====
function addFixedTransfer() {
  fixedTransfers.value.push({
    from: 'dad', to: 'mom', amount: 0, label: '',
    period: 'monthly', due_day: 1, expires: ''
  })
}
function removeFixedTransfer(idx) {
  fixedTransfers.value.splice(idx, 1)
}

// ===== Category overrides (unique rules outside the base split) =====
function addCategoryOverride() {
  const unused = allCategories.value
    .map(c => c.id)
    .find(id => !categoryOverrides.value.some(o => o.name === id))
  if (!unused) return
  categoryOverrides.value.push({
    name: unused,
    dad_percent: dadPercent.value,
    mom_percent: momPercent.value,
    budget_limit: null,
    limit_count: null
  })
}
function removeCategoryOverride(idx) {
  categoryOverrides.value.splice(idx, 1)
}
function onCategorySliderInput(override) {
  override.dad_percent = Math.round(override.dad_percent / 10) * 10
  override.mom_percent = 100 - override.dad_percent
}

// ===== Included / excluded categories =====
// Default behaviour (when includedCategories is null): everything is included.
// First toggle materializes the explicit list.
function isIncluded(catId) {
  if (includedCategories.value === null) return true
  return includedCategories.value.includes(catId)
}
function materializeIfNeeded() {
  if (includedCategories.value === null) {
    includedCategories.value = allCategories.value.map(c => c.id)
  }
}
function excludeCategory(catId) {
  materializeIfNeeded()
  includedCategories.value = includedCategories.value.filter(c => c !== catId)
  // Remove any override for the now-excluded category (rule no longer applies)
  categoryOverrides.value = categoryOverrides.value.filter(o => o.name !== catId)
}
function includeCategory(catId) {
  materializeIfNeeded()
  if (!includedCategories.value.includes(catId)) {
    includedCategories.value.push(catId)
  }
}

const excludedList = computed(() =>
  allCategories.value.filter(c => !isIncluded(c.id))
)
const includedList = computed(() =>
  allCategories.value.filter(c => isIncluded(c.id))
)

// ===== Save (propose) =====
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
      included_categories: includedCategories.value, // null = all (back-compat)
      other_requires_approval: true
    }
    // Use the understandings store so the version chain forms correctly and
    // the partner sees the same pending-approval banner here & in /understandings.
    await understandingsStore.proposeExpenseRules(rules)
    await financeStore.loadExpenseRules()
    emit('close')
  } catch (err) {
    console.error('Failed to propose rules:', err)
  } finally {
    saving.value = false
  }
}

function discard() {
  emit('close')
}
</script>

<template>
  <BaseModal
    headerStyle="#94A3B8"
    :title="t('expenseSettings')"
    maxWidth="700px"
    :showFooter="true"
    @close="$emit('close')"
  >
    <div class="setup-body">
      <!-- Pending banner: surfaces here too, not only in /understandings (D) -->
      <div v-if="hasPending" class="pending-banner">
        <div class="pending-header">
          <div class="pending-icon"><AlertCircle :size="16" /></div>
          <div>
            <div class="pending-label">{{ t('pendingExpenseRules') }}</div>
            <div class="pending-creator">{{ t('proposedBy') }}: {{ pendingChange.creator }}</div>
          </div>
        </div>
        <div class="pending-actions">
          <button @click="approvePending" class="pending-approve">
            <Check :size="14" /> {{ t('approve') }}
          </button>
          <button @click="rejectPending" class="pending-reject">
            <X :size="14" /> {{ t('reject') }}
          </button>
        </div>
      </div>

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

      <!-- Section B: Recurring Payments (C — inline list, no drawer; "+" button) -->
      <div class="setup-section">
        <div class="section-row">
          <div>
            <h3 class="section-title">{{ t('fixedPayments') }}</h3>
            <p class="section-desc">{{ t('fixedPaymentsDesc') }}</p>
          </div>
          <button @click="addFixedTransfer" class="add-icon-btn" :title="t('addFixedPayment')">
            <Plus :size="18" />
          </button>
        </div>

        <div v-if="fixedTransfers.length" class="section-content">
          <div
            v-for="(transfer, idx) in fixedTransfers"
            :key="idx"
            class="transfer-form"
          >
            <button @click="removeFixedTransfer(idx)" class="remove-btn remove-btn-corner">
              <X :size="16" />
            </button>
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
        </div>
      </div>

      <!-- Section C: Included / excluded categories (B) -->
      <div class="setup-section">
        <h3 class="section-title">{{ t('includedCategories') }}</h3>
        <p class="section-desc">{{ t('includedCategoriesDesc') }}</p>

        <div class="cat-chip-grid">
          <button
            v-for="cat in includedList"
            :key="`in-${cat.id}`"
            class="cat-chip cat-chip-in"
            @click="excludeCategory(cat.id)"
            :title="t('excluded')"
          >
            <img :src="`/assets/${cat.icon}`" class="cat-chip-icon" />
            <span class="cat-chip-label">{{ t(cat.name) }}</span>
            <X :size="12" class="cat-chip-x" />
          </button>
        </div>

        <div v-if="excludedList.length" class="excluded-tray">
          <span class="tray-label">{{ t('excludedCategories') }}</span>
          <button
            v-for="cat in excludedList"
            :key="`ex-${cat.id}`"
            class="cat-chip cat-chip-out"
            @click="includeCategory(cat.id)"
            :title="t('pushToInclude')"
          >
            <img :src="`/assets/${cat.icon}`" class="cat-chip-icon" />
            <span class="cat-chip-label">{{ t(cat.name) }}</span>
            <span class="cat-chip-add">
              <Plus :size="12" /> {{ t('pushToInclude') }}
            </span>
          </button>
        </div>
      </div>

      <!-- Section D: Category Overrides (BB — unique rules outside base) -->
      <div class="setup-section">
        <div class="section-row">
          <div>
            <h3 class="section-title">{{ t('categoryOverrides') }}</h3>
            <p class="section-desc">{{ t('categoryOverridesDesc') }}</p>
          </div>
          <button
            @click="addCategoryOverride"
            class="add-icon-btn"
            :disabled="categoryOverrides.length >= includedList.length"
            :title="t('addCategoryOverride')"
          >
            <Plus :size="18" />
          </button>
        </div>

        <div v-if="categoryOverrides.length" class="section-content">
          <div
            v-for="(override, idx) in categoryOverrides"
            :key="idx"
            class="category-override-form"
          >
            <select v-model="override.name" class="form-select">
              <option v-for="cat in includedList" :key="cat.id" :value="cat.id">
                {{ t(cat.name) }}
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
                <div class="limit-field">
                  <span class="limit-prefix">₪</span>
                  <input
                    v-model.number="override.budget_limit.amount"
                    type="number"
                    class="form-input budget-input"
                    :placeholder="t('budgetLimit')"
                  />
                </div>
              </template>
              <button
                @click="override.budget_limit = override.budget_limit ? null : { amount: 0, period: 'monthly' }"
                class="budget-toggle-btn"
              >
                {{ override.budget_limit ? t('removeBudget') : t('addBudget') }}
              </button>

              <template v-if="override.limit_count">
                <div class="limit-field">
                  <span class="limit-prefix limit-prefix-icon">×</span>
                  <input
                    v-model.number="override.limit_count.max"
                    type="number"
                    min="1"
                    class="form-input budget-input"
                    :placeholder="t('itemLimit')"
                  />
                </div>
              </template>
              <button
                @click="override.limit_count = override.limit_count ? null : { max: 1, period: 'monthly' }"
                class="budget-toggle-btn"
              >
                {{ override.limit_count ? t('removeItemLimit') : t('addItemLimit') }}
              </button>
            </div>

            <button @click="removeCategoryOverride(idx)" class="remove-btn">
              <X :size="18" />
            </button>
          </div>
        </div>
      </div>

      <!-- Section E: Per-Child Rules (only if >1 child) -->
      <div v-if="financeStore.children.length > 1" class="setup-section">
        <button
          @click="showPerChildRules = !showPerChildRules"
          class="section-toggle"
        >
          <span class="toggle-text">{{ t('perChildRules') }}</span>
          <span class="toggle-state">{{ showPerChildRules ? '−' : '+' }}</span>
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
            <p class="notice-text">{{ t('perChildRulesNotice') }}</p>
            <p class="notice-subtext">{{ t('perChildRulesSubtext') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer with Propose / Discard (D — both parents must agree) -->
    <template #footer>
      <div class="modal-action-bar">
        <button @click="discard" class="modal-secondary-btn">
          {{ t('discardChanges') }}
        </button>
        <button @click="saveRules" class="modal-primary-btn" :disabled="saving">
          {{ saving ? t('saving') : t('proposeChanges') }}
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

/* Pending banner */
.pending-banner {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border: 2px solid #fbbf24;
  border-radius: 1rem;
}
.pending-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
.pending-label {
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #92400e;
}
.pending-creator {
  font-size: 0.7rem;
  color: #a16207;
  font-weight: 600;
}
.pending-actions {
  display: flex;
  gap: 0.5rem;
}
.pending-approve,
.pending-reject {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: 0.625rem;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  flex: 1;
  justify-content: center;
}
.pending-approve { background: #0f172a; color: white; }
.pending-approve:hover { background: #1e293b; }
.pending-reject { background: white; color: #64748b; border: 2px solid #e2e8f0; }
.pending-reject:hover { border-color: #dc2626; color: #dc2626; }

/* Sections */
.setup-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
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
  margin: 0.25rem 0 0 0;
}

/* Inline "+" button (replaces the old chevron drawer) */
.add-icon-btn {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: #0f172a;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
}
.add-icon-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.3);
}
.add-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
.toggle-state {
  font-size: 1.25rem;
  font-weight: 900;
  color: #94a3b8;
  width: 1.5rem;
  text-align: center;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 1rem;
}

/* Category chips */
.cat-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 9999px;
  border: 1.5px solid transparent;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  background: white;
  transition: all 0.2s;
}
.cat-chip-icon {
  width: 1.1rem;
  height: 1.1rem;
  object-fit: contain;
}
.cat-chip-in {
  background: #ecfdf5;
  border-color: #6ee7b7;
  color: #065f46;
}
.cat-chip-in:hover {
  background: #d1fae5;
}
.cat-chip-x {
  color: #ef4444;
  opacity: 0.6;
}
.cat-chip-in:hover .cat-chip-x {
  opacity: 1;
}
.cat-chip-out {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #94a3b8;
  filter: grayscale(60%);
}
.cat-chip-out .cat-chip-icon {
  opacity: 0.5;
}
.cat-chip-out:hover {
  background: white;
  filter: grayscale(0);
  color: #0f172a;
  border-color: #0f172a;
}
.cat-chip-add {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #0f766e;
  margin-inline-start: 0.25rem;
}
.excluded-tray {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.75rem;
  border: 1px dashed #cbd5e1;
}
.tray-label {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin-inline-end: 0.25rem;
}

/* Split Control */
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

/* Slider */
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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  padding-inline-end: 2.75rem; /* leave room for the corner X */
  background: white;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
}

.remove-btn-corner {
  position: absolute;
  top: 0.5rem;
  inset-inline-end: 0.5rem;
  width: 1.75rem;
  height: 1.75rem;
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
.form-select { min-width: 100px; }
.amount-input { width: 100px; }
.label-input { flex: 1; min-width: 150px; }
.budget-input { width: 120px; }
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
.split-label-small.dad-color { color: #0f766e; }
.split-label-small.mom-color { color: #9a3412; }
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
  flex-wrap: wrap;
}

.limit-field {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
}

.limit-field .form-input.budget-input {
  border: none;
  background: transparent;
  padding: 0.35rem 0;
}

.limit-prefix {
  font-size: 0.75rem;
  font-weight: 800;
  color: #94a3b8;
}

.limit-prefix-icon {
  font-size: 0.875rem;
  color: #0f172a;
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

.modal-action-bar {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}
.modal-action-bar .modal-secondary-btn,
.modal-action-bar .modal-primary-btn {
  flex: 1;
}
</style>
