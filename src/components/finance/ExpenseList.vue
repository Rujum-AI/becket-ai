<script setup>
import { ref } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import { useFamilyMode } from '@/composables/useFamilyMode'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'

const { t } = useI18n()
const { user } = useAuth()
const financeStore = useSupabaseFinanceStore()
const { isSeparated } = useFamilyMode()

// Two-lane viz: only meaningful when separated families have a contract
// drawing the line between shared and personal categories. Solo/together
// families treat every expense the same — no badge, no lane tint.
function isShared(expense) {
  return financeStore.isSharedCategory(expense.category, expense.child_id)
}

const pendingDelete = ref(null) // expense object queued for deletion
const deleting = ref(false)

function payerLabel(expense) {
  if (!user.value) return ''
  return expense.payer_id === user.value.id ? t('me') : t('partner')
}

function getCategoryIcon(category) {
  const cat = financeStore.categories.find(c => c.id === category)
  return cat ? cat.icon : 'finance.png'
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function canDelete(expense) {
  return !!user.value && expense.created_by === user.value.id
}

function askDelete(expense) {
  pendingDelete.value = expense
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  deleting.value = true
  try {
    await financeStore.deleteExpense(pendingDelete.value.id)
    pendingDelete.value = null
  } catch (err) {
    console.error('Delete failed:', err)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="expense-list">
    <div
      v-for="expense in financeStore.filteredExpenses"
      :key="expense.id"
      class="expense-row"
      :class="{
        'lane-pending': expense.status === 'pending_approval',
        'lane-personal': expense.status === 'counted' && isSeparated && !isShared(expense)
      }"
    >
      <div class="expense-left">
        <div class="expense-icon">
          <img :src="`/assets/${getCategoryIcon(expense.category)}`" :alt="expense.category" />
        </div>
        <div class="expense-details">
          <span class="expense-title">
            {{ expense.title }}
            <span
              v-if="expense.status === 'pending_approval'"
              class="lane-badge lane-badge-pending"
            >
              {{ t('pending') }}
            </span>
            <span
              v-else-if="isSeparated"
              :class="['lane-badge', isShared(expense) ? 'lane-badge-shared' : 'lane-badge-personal']"
            >
              {{ isShared(expense) ? t('laneShared') : t('lanePersonal') }}
            </span>
          </span>
          <span class="expense-meta">
            {{ payerLabel(expense) }} • <span class="bidi-isolate">{{ formatDate(expense.date) }}</span>
          </span>
        </div>
      </div>
      <div class="expense-right">
        <div class="expense-amount bidi-isolate">{{ expense.amount }} ₪</div>
        <button
          v-if="canDelete(expense)"
          class="expense-delete-btn"
          :title="t('delete')"
          @click="askDelete(expense)"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <ConfirmModal
      :show="!!pendingDelete"
      :title="t('deleteExpenseTitle')"
      :message="t('deleteExpenseMsg')"
      :confirmText="deleting ? t('saving') : t('delete')"
      @close="pendingDelete = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.expense-list {
  background: white;
  border-radius: 2rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  margin-top: 1rem;
}

.expense-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.2s;
}

.expense-row:last-child {
  border-bottom: none;
}

.expense-row:hover {
  background: #f8fafc;
}

.expense-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.expense-icon {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  background: white;
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

.expense-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.expense-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: start;
  min-width: 0;
}

.expense-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
}

.expense-meta {
  font-size: 0.625rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.expense-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.expense-amount {
  font-size: 1.125rem;
  font-weight: 900;
  color: #1e293b;
}

.expense-delete-btn {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 2px solid #fecaca;
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.35) 2px,
      rgba(255, 255, 255, 0.35) 4px
    ),
    linear-gradient(135deg, #ef4444, #b91c1c);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3);
}

.expense-delete-btn:hover {
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 4px 10px rgba(220, 38, 38, 0.45);
}

.expense-delete-btn:active {
  transform: scale(0.95);
}

/* === Two-lane visualization (separated families only) === */
/* Pulled from BalanceBar's exact palette: same warm-orange and
   teal gradients used for the dad/mom segments, paired with the
   #9a3412 / #0f766e text accents BalanceBar uses for ahead/behind. */
.lane-personal {
  background: #F0FDFA;
}
.lane-personal:hover {
  background: #CCFBF1;
}

.lane-badge {
  display: inline-block;
  margin-inline-start: 0.5rem;
  padding: 0.1rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  vertical-align: middle;
  line-height: 1.4;
}

.lane-badge-shared {
  background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%);
  color: #9a3412;
  border: 1px solid #FED7AA;
}

.lane-badge-personal {
  background: linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%);
  color: #0f766e;
  border: 1px solid #99F6E4;
}

/* Pending = waiting for partner approval. Amber stripe matches the
   PendingSection container so the row, the section, and the popup
   all read as one thread. */
.lane-pending {
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.35) 2px,
      rgba(255, 255, 255, 0.35) 4px
    ),
    linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
}

.lane-badge-pending {
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  color: #92400E;
  border: 1px solid #FCD34D;
}
</style>
