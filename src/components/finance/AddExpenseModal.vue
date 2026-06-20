<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import BaseModal from '@/components/shared/BaseModal.vue'
import { SECTION_COLORS } from '@/lib/modalColors'
import { AlertCircle, Repeat } from 'lucide-vue-next'

const emit = defineEmits(['close'])

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()

const today = new Date().toISOString().split('T')[0]

const expenseData = ref({
  title: '',
  amount: '',
  category: 'education',
  childId: null,
  notes: '',
  date: today,
  isRecurring: false,
  recurrencePeriod: 'monthly'
})

const saving = ref(false)
const errorMessage = ref('')
const confirming = ref(false) // true while showing "are you sure?" for the X path

onMounted(() => {
  financeStore.loadChildren()
})

// Deterministic router: V (rules match) → transactions; X (no match) → pendings after confirm.
// "Match" = category is in the included list AND a split rule exists (base or override).
const routeDecision = computed(() => financeStore.classifyExpense({
  amount: expenseData.value.amount,
  category: expenseData.value.category,
  childId: expenseData.value.childId
}))

async function attemptSave() {
  if (!expenseData.value.title || !expenseData.value.amount) {
    errorMessage.value = 'Please fill in title and amount'
    return
  }
  errorMessage.value = ''

  if (routeDecision.value.route === 'pending') {
    confirming.value = true
    return
  }
  await persist()
}

async function persist() {
  saving.value = true
  try {
    await financeStore.addExpense(expenseData.value)
    emit('close')
  } catch (err) {
    console.error('Failed to save expense:', err)
    errorMessage.value = err.message || 'Failed to save expense.'
  } finally {
    saving.value = false
    confirming.value = false
  }
}

function cancelConfirm() {
  confirming.value = false
}
</script>

<template>
  <BaseModal
    :headerStyle="SECTION_COLORS.finance"
    :title="t('newExpense')"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <!-- Title -->
    <div class="form-group">
      <label class="modal-form-label">{{ t('whatIsIt') }}</label>
      <input
        v-model="expenseData.title"
        type="text"
        class="modal-form-input"
        :placeholder="t('descPlaceholder')"
      />
    </div>

    <!-- Amount -->
    <div class="form-group">
      <label class="modal-form-label">{{ t('amount') }} (ILS)</label>
      <div class="amount-input-wrapper">
        <input
          v-model="expenseData.amount"
          type="number"
          class="form-input amount-input"
          placeholder="0"
        />
        <div class="currency-symbol">₪</div>
      </div>
    </div>

    <!-- Child Selector -->
    <div v-if="financeStore.children.length > 0" class="modal-form-group">
      <label class="modal-form-label">{{ t('forWhichChild') }}</label>
      <div class="flex flex-wrap gap-2">
        <button
          @click="expenseData.childId = null"
          :class="['modal-pill-btn', { selected: expenseData.childId === null }]"
        >
          {{ t('allChildren') }}
        </button>
        <button
          v-for="child in financeStore.children"
          :key="child.id"
          @click="expenseData.childId = child.id"
          :class="['modal-pill-btn', { selected: expenseData.childId === child.id }]"
        >
          {{ child.name }}
        </button>
      </div>
    </div>

    <!-- Category -->
    <div class="modal-form-group">
      <label class="modal-form-label">{{ t('category') }}</label>
      <div class="modal-icon-grid">
        <button
          v-for="cat in financeStore.categories"
          :key="cat.id"
          @click="expenseData.category = cat.id"
          :class="['modal-icon-btn', { selected: expenseData.category === cat.id }]"
        >
          <div class="icon-circle">
            <img :src="`/assets/${cat.icon}`" />
          </div>
          <span class="icon-label">{{ t(cat.name) }}</span>
        </button>
      </div>
    </div>

    <!-- Date + Recurring -->
    <div class="form-group">
      <label class="modal-form-label">{{ t('expenseDate') }}</label>
      <div class="date-recurring-row">
        <input
          v-model="expenseData.date"
          type="date"
          class="modal-form-input expense-date-input"
        />
        <label class="recurring-toggle" :class="{ active: expenseData.isRecurring }">
          <input
            type="checkbox"
            v-model="expenseData.isRecurring"
            class="recurring-checkbox"
          />
          <Repeat :size="16" />
          <span>{{ t('recurring') }}</span>
        </label>
      </div>
      <div v-if="expenseData.isRecurring" class="recurring-period">
        <button
          type="button"
          class="period-pill"
          :class="{ active: expenseData.recurrencePeriod === 'weekly' }"
          @click="expenseData.recurrencePeriod = 'weekly'"
        >{{ t('weekly') }}</button>
        <button
          type="button"
          class="period-pill"
          :class="{ active: expenseData.recurrencePeriod === 'monthly' }"
          @click="expenseData.recurrencePeriod = 'monthly'"
        >{{ t('monthly') }}</button>
        <button
          type="button"
          class="period-pill"
          :class="{ active: expenseData.recurrencePeriod === 'yearly' }"
          @click="expenseData.recurrencePeriod = 'yearly'"
        >{{ t('yearly') }}</button>
      </div>
    </div>

    <!-- Notes/Reason -->
    <div class="form-group">
      <label class="modal-form-label">{{ t('notesOptional') }}</label>
      <textarea
        v-model="expenseData.notes"
        class="modal-form-textarea"
        :placeholder="t('notesPlaceholder')"
        rows="3"
      ></textarea>
    </div>

    <!-- Receipt Photo -->
    <div class="snapshot-zone">
      <img src="@/assets/snapshot.png" alt="Receipt" />
      <span class="snapshot-text">Snap Receipt Photo</span>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="modal-error">
      {{ errorMessage }}
    </div>

    <!-- "Are you sure?" confirmation (X path: not auto-split, becomes a pending request) -->
    <div v-if="confirming" class="confirm-overlay">
      <div class="confirm-card">
        <div class="confirm-icon">
          <AlertCircle :size="24" />
        </div>
        <h3 class="confirm-title">{{ t('expenseRequestPendingTitle') }}</h3>
        <p class="confirm-desc">{{ t('expenseRequestPendingDesc') }}</p>
        <p v-if="routeDecision.reasonKey" class="confirm-reason">{{ t(routeDecision.reasonKey) }}</p>
        <div class="confirm-actions">
          <button @click="cancelConfirm" class="confirm-cancel">{{ t('cancel') }}</button>
          <button @click="persist" class="confirm-send" :disabled="saving">
            {{ saving ? t('saving') : t('sendRequest') }}
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <button @click="attemptSave" class="modal-primary-btn" :disabled="saving">
        {{ saving ? t('saving') : t('saveExpense') }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.amount-input-wrapper {
  position: relative;
}

.amount-input {
  font-size: 1.5rem;
  font-weight: 900;
  padding-right: 3rem;
}

.currency-symbol {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1rem;
  font-weight: 700;
  color: #94a3b8;
}

.date-recurring-row {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
  flex-wrap: wrap;
}

.expense-date-input {
  flex: 1;
  min-width: 160px;
}

.recurring-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  border: 2px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.recurring-toggle:hover {
  border-color: #cbd5e1;
}

.recurring-toggle.active {
  background: #0f172a;
  border-color: #0f172a;
  color: white;
}

.recurring-checkbox {
  display: none;
}

.recurring-period {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.period-pill {
  padding: 0.4rem 0.9rem;
  border-radius: 9999px;
  border: 1.5px solid #e2e8f0;
  background: white;
  font-size: 0.7rem;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
}

.period-pill.active {
  background: #0f172a;
  color: white;
  border-color: #0f172a;
}

.snapshot-zone {
  margin: 1.5rem 0;
  padding: 2rem;
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.snapshot-zone:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.snapshot-zone img {
  width: 4rem;
  height: 4rem;
  object-fit: contain;
}

.snapshot-text {
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* "Are you sure?" overlay sits over the modal body */
.confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
  backdrop-filter: blur(2px);
}

.confirm-card {
  background: white;
  border-radius: 1.25rem;
  padding: 1.5rem;
  max-width: 360px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.confirm-icon {
  display: inline-flex;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: #fef3c7;
  color: #d97706;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.confirm-title {
  font-size: 1rem;
  font-weight: 900;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.confirm-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0 0 0.5rem 0;
  line-height: 1.5;
}

.confirm-reason {
  font-size: 0.75rem;
  color: #92400e;
  background: #fef3c7;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin: 0 0 1rem 0;
  font-weight: 700;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.confirm-cancel,
.confirm-send {
  flex: 1;
  padding: 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.confirm-cancel {
  background: #f1f5f9;
  color: #64748b;
}

.confirm-cancel:hover {
  background: #e2e8f0;
}

.confirm-send {
  background: #0f172a;
  color: white;
}

.confirm-send:hover {
  background: #1e293b;
}

.confirm-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
