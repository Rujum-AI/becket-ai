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

</style>
