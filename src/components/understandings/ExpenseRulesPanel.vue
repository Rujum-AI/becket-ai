<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useUnderstandingsStore } from '@/stores/supabaseUnderstandings'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import { Plus, Edit3 } from 'lucide-vue-next'
import CategoryBadge from '@/components/shared/CategoryBadge.vue'
import CategoryEditorList from '@/components/shared/CategoryEditorList.vue'
import SplitSlider from '@/components/shared/SplitSlider.vue'
import FixedTransferForm from '@/components/shared/FixedTransferForm.vue'
import PendingApprovalBanner from '@/components/shared/PendingApprovalBanner.vue'

const { t } = useI18n()
const store = useUnderstandingsStore()
const financeStore = useSupabaseFinanceStore()

const isEditing = ref(false)

// Form state
const dadPercent = ref(50)
const momPercent = ref(50)
const fixedTransfers = ref([])
const categoryOverrides = ref([])
// included_categories: null = all (legacy/default); array = explicit list
const includedCategories = ref(null)

const allCategoryMeta = computed(() => financeStore.categories)

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
  // Strip legacy budget_limit on read — category_budgets table is the
  // sole source of truth (migration 039+); the JSONB field is dead weight.
  categoryOverrides.value = rules.categories
    ? rules.categories.map(({ budget_limit, ...rest }) => JSON.parse(JSON.stringify(rest)))
    : []
  includedCategories.value = Array.isArray(rules.included_categories)
    ? [...rules.included_categories]
    : null
  isEditing.value = true
}

// Read-mode view of included/excluded for active rules
const activeIncluded = computed(() => {
  const ids = activeRules.value?.rules?.included_categories
  if (!Array.isArray(ids)) return allCategoryMeta.value // legacy = all in
  return allCategoryMeta.value.filter(c => ids.includes(c.id))
})
const activeExcluded = computed(() => {
  const ids = activeRules.value?.rules?.included_categories
  if (!Array.isArray(ids)) return []
  return allCategoryMeta.value.filter(c => !ids.includes(c.id))
})

function discardEditing() {
  isEditing.value = false
}

function addFixedTransfer() {
  fixedTransfers.value.push({
    from: 'dad', to: 'mom', amount: 0, label: '', period: 'monthly', due_day: 1, expires: ''
  })
}

function removeFixedTransfer(index) {
  fixedTransfers.value.splice(index, 1)
}


function saveRules() {
  const rules = {
    default_split: {
      dad_percent: dadPercent.value,
      mom_percent: momPercent.value
    },
    fixed_transfers: fixedTransfers.value,
    categories: categoryOverrides.value,
    included_categories: includedCategories.value,
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
    <PendingApprovalBanner
      v-if="hasPending && !isEditing"
      :pending="pendingRules"
      @approve="approveRules"
      @reject="rejectRules"
    />

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

        <!-- Included / Excluded categories -->
        <div class="rule-row">
          <span class="rule-label">{{ t('includedCategories') }}</span>
          <div class="cat-badge-grid">
            <CategoryBadge
              v-for="cat in activeIncluded"
              :key="`in-${cat.id}`"
              :category="cat.id"
              size="sm"
              state="included"
            />
          </div>
          <div v-if="activeExcluded.length" class="excluded-tray">
            <span class="rule-label">{{ t('excludedCategories') }}</span>
            <div class="cat-badge-grid">
              <CategoryBadge
                v-for="cat in activeExcluded"
                :key="`ex-${cat.id}`"
                :category="cat.id"
                size="sm"
                state="excluded"
              />
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
        <SplitSlider
          v-model:dadPercent="dadPercent"
          v-model:momPercent="momPercent"
        />
      </div>

      <!-- Section B: Recurring Payments (inline "+" — no drawer) -->
      <div class="editor-section">
        <div class="section-row-inline">
          <label class="editor-label">{{ t('fixedPayments') }}</label>
          <button @click="addFixedTransfer" class="add-icon-btn-sm" :title="t('addFixedPayment')">
            <Plus :size="16" />
          </button>
        </div>

        <div v-if="fixedTransfers.length" class="section-content">
          <FixedTransferForm
            v-for="(transfer, idx) in fixedTransfers"
            :key="idx"
            v-model="fixedTransfers[idx]"
            @remove="removeFixedTransfer(idx)"
          />
        </div>
      </div>

      <!-- Categories & Budgets: tap a thumbnail to edit budget / split / exclude.
           Replaces the old Included/Excluded grid + Category Overrides section. -->
      <div class="editor-section">
        <label class="editor-label">{{ t('categoriesAndBudgets') }}</label>
        <p class="editor-desc">{{ t('categoriesAndBudgetsDesc') }}</p>

        <CategoryEditorList
          :dad-percent="dadPercent"
          :mom-percent="momPercent"
          v-model:overrides="categoryOverrides"
          v-model:included="includedCategories"
        />
      </div>

      <!-- Editor Actions -->
      <div class="editor-actions">
        <button @click="discardEditing" class="discard-btn">{{ t('discardChanges') }}</button>
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

.section-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.75rem;
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

/* Inline section row used in edit mode (replaces chevron drawer) */
.section-row-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.add-icon-btn-sm {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: #0f172a;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}
.add-icon-btn-sm:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(15, 23, 42, 0.25);
}
.add-icon-btn-sm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Category badges (read-mode included / excluded grids) */
.cat-badge-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}
.excluded-tray {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 0.75rem;
  border: 1px dashed #cbd5e1;
}
</style>
