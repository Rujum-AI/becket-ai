<script setup>
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'

const { t } = useI18n()
const { user } = useAuth()
const financeStore = useSupabaseFinanceStore()

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
</script>

<template>
  <div class="expense-list">
    <div
      v-for="expense in financeStore.filteredExpenses"
      :key="expense.id"
      class="expense-row"
    >
      <div class="expense-left">
        <div class="expense-icon">
          <img :src="`/assets/${getCategoryIcon(expense.category)}`" :alt="expense.category" />
        </div>
        <div class="expense-details">
          <span class="expense-title">{{ expense.title }}</span>
          <span class="expense-meta">
            {{ payerLabel(expense) }} • <span class="bidi-isolate">{{ formatDate(expense.date) }}</span>
          </span>
        </div>
      </div>
      <div class="expense-amount bidi-isolate">{{ expense.amount }} ₪</div>
    </div>
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

.expense-amount {
  font-size: 1.125rem;
  font-weight: 900;
  color: #1e293b;
  flex-shrink: 0;
}
</style>