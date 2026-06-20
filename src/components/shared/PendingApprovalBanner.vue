<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { AlertCircle, Check, X } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps({
  pending: { type: Object, required: true }
})

const emit = defineEmits(['approve', 'reject'])

const rules = computed(() => props.pending?.rules || {})
</script>

<template>
  <div class="pending-banner">
    <div class="pending-content">
      <div class="pending-icon">
        <AlertCircle :size="16" />
      </div>
      <div class="pending-info">
        <span class="pending-label">{{ t('pendingExpenseRules') }}</span>
        <span class="pending-creator">{{ t('proposedBy') }}: {{ pending.creator }}</span>
      </div>
    </div>

    <div class="pending-summary">
      <div class="summary-item">
        <span class="summary-label">{{ t('baseSplit') }}:</span>
        <span class="summary-value bidi-isolate">
          {{ t('dad') }} {{ rules.default_split?.dad_percent || 50 }}% /
          {{ t('mom') }} {{ rules.default_split?.mom_percent || 50 }}%
        </span>
      </div>
      <div v-if="rules.fixed_transfers?.length" class="summary-item">
        <span class="summary-label">{{ t('fixedPayments') }}:</span>
        <span
          class="summary-value bidi-isolate"
          v-for="(ft, i) in rules.fixed_transfers"
          :key="i"
        >
          {{ ft.label || t('fixedPayment') }}: {{ ft.amount }} ₪/{{ t(ft.period) }}
        </span>
      </div>
      <div v-if="rules.categories?.length" class="summary-item">
        <span class="summary-label">{{ t('categoryOverrides') }}:</span>
        <span
          class="summary-value bidi-isolate"
          v-for="(cat, i) in rules.categories"
          :key="i"
        >
          {{ t(cat.name) }}: {{ cat.dad_percent }}/{{ cat.mom_percent }}
        </span>
      </div>
    </div>

    <div class="pending-actions">
      <button @click="emit('approve')" class="approve-btn" type="button">
        <Check :size="14" />
        {{ t('approve') }}
      </button>
      <button @click="emit('reject')" class="reject-btn" type="button">
        <X :size="14" />
        {{ t('reject') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pending-banner {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border: 2px solid #fbbf24;
  border-radius: 1rem;
}

.pending-content {
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

.pending-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.pending-label {
  font-size: 0.8rem;
  font-weight: 800;
  color: #92400e;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pending-creator {
  font-size: 0.7rem;
  color: #a16207;
  font-weight: 600;
}

.pending-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 0.75rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.summary-label {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #78350f;
  letter-spacing: 0.03em;
}

.summary-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: #451a03;
}

.pending-actions {
  display: flex;
  gap: 0.75rem;
}

.approve-btn,
.reject-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  flex: 1;
}

.approve-btn {
  background: #0f172a;
  color: white;
}

.approve-btn:hover {
  background: #1e293b;
  transform: translateY(-1px);
}

.reject-btn {
  background: white;
  color: #64748b;
  border: 2px solid #e2e8f0;
}

.reject-btn:hover {
  border-color: #dc2626;
  color: #dc2626;
}
</style>
