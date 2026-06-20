<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import ExpenseChart from '@/components/finance/ExpenseChart.vue'
import ExpenseList from '@/components/finance/ExpenseList.vue'
import BalanceBar from '@/components/finance/BalanceBar.vue'
import AddExpenseModal from '@/components/finance/AddExpenseModal.vue'
import FinanceSetup from '@/components/finance/FinanceSetup.vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import { useSupabasePendingActionsStore } from '@/stores/supabasePendingActions'
import { useFamily } from '@/composables/useFamily'
import { useFamilyMode } from '@/composables/useFamilyMode'
import PendingSection from '@/components/shared/PendingSection.vue'

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()
const pendingStore = useSupabasePendingActionsStore()
const { family } = useFamily()
const { showBalance, requiresApproval } = useFamilyMode()

// Resolve a pending_actions row → the actual expense row, so the
// PendingSection can show title/amount/category instead of just an id.
function resolvePendingExpense(action) {
  return financeStore.expenses.find(e => e.id === action.target_id) || null
}

function fmtAmount(amount) {
  if (amount == null) return '0'
  return Number(amount).toLocaleString('en-US')
}

function getCategoryIcon(categoryId) {
  if (!categoryId) return 'finance.png'
  const cat = financeStore.categories.find(c => c.id === categoryId)
  return cat ? cat.icon : 'finance.png'
}

const showAddExpenseModal = ref(false)
const showSetupPanel = ref(false)

// Load data when family becomes available
function loadData() {
  if (family.value) {
    financeStore.loadExpenses()
    financeStore.loadExpenseRules()
    financeStore.loadChildren()
    if (requiresApproval.value) pendingStore.load()
    // Live-sync: partner edits propagate without manual refresh.
    financeStore.subscribeToRealtime()
    if (requiresApproval.value) pendingStore.subscribeToRealtime()
  }
}

// Load data on mount (if family is already loaded)
onMounted(() => {
  loadData()
})

// Watch for family to be loaded (handles refresh race condition)
watch(family, (newFamily) => {
  if (newFamily) {
    loadData()
  }
})

// Tear down realtime channels when leaving /finance to avoid leaks.
onBeforeUnmount(() => {
  financeStore.unsubscribeRealtime()
  pendingStore.unsubscribeRealtime()
})

function openAddModal() {
  showAddExpenseModal.value = true
}

function closeAddModal() {
  showAddExpenseModal.value = false
}

function toggleSetup() {
  showSetupPanel.value = !showSetupPanel.value
}

function closeSetup() {
  showSetupPanel.value = false
}

function getChildImg(child) {
  return child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'
}
</script>

<template>
  <AppLayout>
    <!-- Overview Section -->
    <div class="mb-12">
      <SectionHeader
        :title="t('overview')"
        icon="finance.png"
        :hasAction="true"
        actionType="edit"
        :actionLabel="t('expenseSettings')"
        @action="toggleSetup"
      />

      <!-- Child Filter Thumbnails (if >1 child) -->
      <div v-if="financeStore.children.length > 1" class="child-filter">
        <div
          @click="financeStore.setChildFilter(null)"
          class="child-toggle"
          :class="{ active: financeStore.childFilter === null }"
        >
          <img src="/assets/family.png" class="child-toggle-img" alt="All" />
          <span class="child-toggle-name">{{ t('all') }}</span>
        </div>
        <div
          v-for="child in financeStore.children"
          :key="child.id"
          @click="financeStore.setChildFilter(child.id)"
          class="child-toggle"
          :class="{ active: financeStore.childFilter === child.id }"
        >
          <img :src="getChildImg(child)" class="child-toggle-img" :alt="child.name" />
          <span class="child-toggle-name">{{ child.name }}</span>
        </div>
      </div>

      <!-- Setup Panel (Collapsible) -->
      <FinanceSetup v-if="showSetupPanel" @close="closeSetup" />

      <ExpenseChart />

      <!-- Balance Bar — separated families only (solo/together = tracking, no balance) -->
      <div v-if="showBalance" class="mt-6">
        <BalanceBar />
      </div>
    </div>

    <!-- Pending Approvals — separated families only, shows up only when there's something to decide -->
    <PendingSection
      v-if="requiresApproval"
      target-type="expense"
    >
      <template #default="{ action, reasonText }">
        <div class="pending-expense-row">
          <div class="pending-expense-icon">
            <img
              :src="`/assets/${getCategoryIcon(resolvePendingExpense(action)?.category)}`"
              :alt="resolvePendingExpense(action)?.category"
            />
          </div>
          <div class="pending-expense-details">
            <span class="pending-expense-title">
              {{ resolvePendingExpense(action)?.title || t('newExpense') }}
            </span>
            <span class="pending-expense-meta">
              <span class="bidi-isolate">{{ fmtAmount(resolvePendingExpense(action)?.amount) }} ₪</span>
              <span v-if="reasonText" class="pending-expense-reason"> · {{ reasonText }}</span>
            </span>
          </div>
        </div>
      </template>
    </PendingSection>

    <!-- Transactions Section -->
    <div class="mb-24">
      <SectionHeader
        :title="t('transactions')"
        icon="finance.png"
        :hasAction="true"
        @action="openAddModal"
      />
      <ExpenseList />
    </div>

    <!-- Add Expense Modal -->
    <AddExpenseModal
      v-if="showAddExpenseModal"
      @close="closeAddModal"
    />
  </AppLayout>
</template>

<style scoped>
.child-filter {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.child-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  opacity: 0.4;
  filter: grayscale(100%);
  transition: all 0.2s;
  transform: scale(0.9);
}

.child-toggle.active {
  opacity: 1;
  filter: grayscale(0);
  transform: scale(1);
}

.child-toggle-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  margin-bottom: 0.3rem;
}

.child-toggle.active .child-toggle-img {
  border-color: #1e293b;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

.child-toggle-name {
  font-size: 0.625rem;
  font-weight: 800;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.pending-expense-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
  text-align: start;
}

.pending-expense-icon {
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

.pending-expense-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pending-expense-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}

.pending-expense-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.1;
}

.pending-expense-meta {
  font-size: 0.625rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pending-expense-reason {
  text-transform: none;
  letter-spacing: 0;
  color: #64748b;
}

@media (max-width: 479px) {
  .pending-expense-icon { width: 2.5rem; height: 2.5rem; }
  .pending-expense-row { gap: 0.75rem; }
}

</style>
