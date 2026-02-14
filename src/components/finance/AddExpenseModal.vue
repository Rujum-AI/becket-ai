<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import BaseModal from '@/components/shared/BaseModal.vue'

const emit = defineEmits(['close'])

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()

const expenseData = ref({
  title: '',
  amount: '',
  category: 'education',
  payer: 'me',
  childId: null, // null = all children
  notes: '' // Notes/reason for expense
})

const saving = ref(false)
const errorMessage = ref('')

// Load children on mount
onMounted(() => {
  financeStore.loadChildren()
})

async function saveExpense() {
  if (!expenseData.value.title || !expenseData.value.amount) {
    errorMessage.value = 'Please fill in title and amount'
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    console.log('Saving expense:', expenseData.value)
    await financeStore.addExpense(expenseData.value)
    console.log('Expense saved successfully')
    emit('close')
  } catch (err) {
    console.error('Failed to save expense:', err)
    errorMessage.value = err.message || 'Failed to save expense. Check console for details.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    headerStyle="#F87171"
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

        <!-- Child Selector (if family has multiple children) -->
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

        <!-- Payer -->
        <div class="form-group">
          <label class="modal-form-label">Paid By</label>
          <div class="payer-toggle">
            <button
              @click="expenseData.payer = 'me'"
              :class="['payer-btn', { active: expenseData.payer === 'me' }]"
            >
              {{ t('me') }}
            </button>
            <button
              @click="expenseData.payer = 'partner'"
              :class="['payer-btn', { active: expenseData.payer === 'partner' }]"
            >
              {{ t('partner') }}
            </button>
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

    <template #footer>
      <button @click="saveExpense" class="modal-primary-btn" :disabled="saving">
        {{ saving ? 'Saving...' : t('saveExpense') }}
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

.payer-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.payer-btn {
  padding: 0.875rem;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
}

.payer-btn:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.payer-btn.active {
  border-color: #1e293b;
  color: #1e293b;
  background: #f8fafc;
  box-shadow: 0 0 0 3px rgba(30, 41, 59, 0.1);
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
</style>
