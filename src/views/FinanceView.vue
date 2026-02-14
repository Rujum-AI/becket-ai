<script setup>
import { ref, onMounted, watch } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import ExpenseChart from '@/components/finance/ExpenseChart.vue'
import ExpenseList from '@/components/finance/ExpenseList.vue'
import BalanceBar from '@/components/finance/BalanceBar.vue'
import AddExpenseModal from '@/components/finance/AddExpenseModal.vue'
import FinanceSetup from '@/components/finance/FinanceSetup.vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import { useFamily } from '@/composables/useFamily'

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()
const { family } = useFamily()

const showAddExpenseModal = ref(false)
const showSetupPanel = ref(false)

// Load data when family becomes available
function loadData() {
  if (family.value) {
    financeStore.loadExpenses()
    financeStore.loadExpenseRules()
    financeStore.loadChildren()
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
        @action="toggleSetup"
      />

      <!-- Child Filter Pills (if >1 child) -->
      <div v-if="financeStore.children.length > 1" class="child-filter">
        <button
          @click="financeStore.setChildFilter(null)"
          :class="['filter-pill', { active: financeStore.childFilter === null }]"
        >
          {{ t('all') }}
        </button>
        <button
          v-for="child in financeStore.children"
          :key="child.id"
          @click="financeStore.setChildFilter(child.id)"
          :class="['filter-pill', { active: financeStore.childFilter === child.id }]"
        >
          {{ child.name }}
        </button>
      </div>

      <!-- Setup Panel (Collapsible) -->
      <FinanceSetup v-if="showSetupPanel" @close="closeSetup" />

      <ExpenseChart />

      <!-- Balance Bar -->
      <div class="mt-6">
        <BalanceBar />
      </div>
    </div>

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
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-pill {
  padding: 0.625rem 1.25rem;
  border: 2px solid #e2e8f0;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-pill:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.filter-pill.active {
  border-color: #1e293b;
  background: #1e293b;
  color: white;
}

</style>
