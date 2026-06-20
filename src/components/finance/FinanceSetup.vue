<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import { useUnderstandingsStore } from '@/stores/supabaseUnderstandings'
import { Plus } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'
import CategoryEditorList from '@/components/shared/CategoryEditorList.vue'
import SplitSlider from '@/components/shared/SplitSlider.vue'
import FixedTransferForm from '@/components/shared/FixedTransferForm.vue'
import PendingApprovalBanner from '@/components/shared/PendingApprovalBanner.vue'

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
  // Strip legacy budget_limit on read — category_budgets table is the
  // sole source of truth (migration 039+); the JSONB field is dead weight.
  categoryOverrides.value = (rule.categories || []).map(({ budget_limit, ...rest }) =>
    JSON.parse(JSON.stringify(rest))
  )
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
      <PendingApprovalBanner
        v-if="hasPending"
        :pending="pendingChange"
        @approve="approvePending"
        @reject="rejectPending"
      />

      <!-- Section A: Base Split -->
      <div class="setup-section">
        <h3 class="section-title">{{ t('baseSplit') }}</h3>
        <p class="section-desc">{{ t('baseSplitDesc') }}</p>
        <SplitSlider
          v-model:dadPercent="dadPercent"
          v-model:momPercent="momPercent"
        />
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
          <FixedTransferForm
            v-for="(transfer, idx) in fixedTransfers"
            :key="idx"
            v-model="fixedTransfers[idx]"
            @remove="removeFixedTransfer(idx)"
          />
        </div>
      </div>

      <!-- Categories & Budgets: tap a thumbnail to set its budget,
           change its split vs the base, or exclude it. Replaces
           the old Included/Excluded grid + Category Overrides section. -->
      <div class="setup-section">
        <h3 class="section-title">{{ t('categoriesAndBudgets') }}</h3>
        <p class="section-desc">{{ t('categoriesAndBudgetsDesc') }}</p>

        <CategoryEditorList
          :dad-percent="dadPercent"
          :mom-percent="momPercent"
          v-model:overrides="categoryOverrides"
          v-model:included="includedCategories"
        />
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

/* Cycle start date input */
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
