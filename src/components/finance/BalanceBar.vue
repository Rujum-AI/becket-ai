<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()

const balanceData = computed(() => financeStore.balanceData)
const fixedTransfers = computed(() => financeStore.fixedTransfers)

// Calculate bar segment widths as percentages
const momBarWidth = computed(() => {
  const { totalShared, momPaid } = balanceData.value
  if (totalShared === 0) return 50
  return (momPaid / totalShared) * 100
})

const dadBarWidth = computed(() => {
  return 100 - momBarWidth.value
})

// Calculate target marker position
const targetPosition = computed(() => {
  const { totalShared, targetMom } = balanceData.value
  if (totalShared === 0) return 50
  return (targetMom / totalShared) * 100
})

function formatAmount(amount) {
  return amount.toLocaleString('en-US')
}
</script>

<template>
  <div class="balance-container">
    <!-- Fixed Transfers (if any) -->
    <div v-if="fixedTransfers.length > 0" class="fixed-transfers">
      <div
        v-for="(transfer, idx) in fixedTransfers"
        :key="idx"
        class="transfer-indicator"
      >
        <span class="transfer-icon">📌</span>
        <span class="transfer-label">{{ transfer.label }}:</span>
        <span class="transfer-amount bidi-isolate">{{ formatAmount(transfer.amount) }} ₪/{{ t(transfer.period) }}</span>
        <span class="transfer-direction">
          ({{ t(transfer.from) }} → {{ t(transfer.to) }})
        </span>
      </div>
    </div>

    <!-- Balance Section -->
    <div class="balance-section">
      <div class="balance-header">
        <span class="balance-title">{{ t('balance') }}</span>
        <span v-if="balanceData.totalShared > 0" class="balance-total bidi-isolate">
          {{ t('totalShared') }}: {{ formatAmount(balanceData.totalShared) }} ₪
        </span>
      </div>

      <!-- Empty State -->
      <div v-if="balanceData.totalShared === 0" class="empty-bar">
        <p class="empty-text">{{ t('noSharedExpenses') }}</p>
      </div>

      <!-- Balance Bar -->
      <div v-else class="balance-bar-wrapper">
        <div class="balance-bar">
          <!-- Mom Segment -->
          <div
            class="bar-segment mom"
            :style="{ width: momBarWidth + '%' }"
          >
            <span v-if="momBarWidth > 15" class="segment-label">
              {{ t('mom') }} {{ formatAmount(balanceData.momPaid) }} ₪
            </span>
          </div>

          <!-- Dad Segment -->
          <div
            class="bar-segment dad"
            :style="{ width: dadBarWidth + '%' }"
          >
            <span v-if="dadBarWidth > 15" class="segment-label">
              {{ t('dad') }} {{ formatAmount(balanceData.dadPaid) }} ₪
            </span>
          </div>

          <!-- Target Marker -->
          <div
            class="target-marker"
            :style="{ left: targetPosition + '%' }"
          >
            <div class="marker-line"></div>
            <div class="marker-label bidi-isolate">
              {{ targetPosition.toFixed(0) }}%
            </div>
          </div>
        </div>

        <!-- Gap Indicator -->
        <div v-if="balanceData.gap > 0" class="gap-indicator">
          <span class="gap-icon">💡</span>
          <span class="gap-text">
            <span v-if="balanceData.oweDirection === 'dad_owes_mom'">
              {{ t('dadOwesMom') }} <span class="bidi-isolate">{{ formatAmount(balanceData.gap) }} ₪</span>
            </span>
            <span v-else>
              {{ t('momOwesDad') }} <span class="bidi-isolate">{{ formatAmount(balanceData.gap) }} ₪</span>
            </span>
          </span>
        </div>

        <!-- Balanced State -->
        <div v-else class="balanced-indicator">
          <span class="balanced-icon">✓</span>
          <span class="balanced-text">{{ t('balanced') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.balance-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Fixed Transfers */
.fixed-transfers {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.transfer-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  background: #f8fafc;
  border-radius: 1.5rem;
  border: 2px solid #e2e8f0;
}

.transfer-icon {
  font-size: 1.25rem;
}

.transfer-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
}

.transfer-amount {
  font-size: 1rem;
  font-weight: 900;
  color: #1e293b;
}

.transfer-direction {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

/* Balance Section */
.balance-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0.25rem;
  /* Force LTR so labels match bar segment order */
  direction: ltr;
}

.balance-title {
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.balance-total {
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

/* Empty State */
.empty-bar {
  padding: 2rem;
  text-align: center;
  background: #f8fafc;
  border-radius: 1.5rem;
  border: 2px dashed #cbd5e1;
}

.empty-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #94a3b8;
  margin: 0;
}

/* Balance Bar */
.balance-bar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.balance-bar {
  position: relative;
  display: flex;
  height: 2.5rem;
  border-radius: 1.5rem;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  /* Force LTR so bar segments don't flip in Hebrew RTL mode */
  direction: ltr;
}

.bar-segment {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
}

/* Textured diagonal stripes overlay */
.bar-segment::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    rgba(255, 255, 255, 0.1) 3px,
    rgba(255, 255, 255, 0.1) 6px
  );
}

.bar-segment.mom {
  background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%);
}

.bar-segment.dad {
  background: linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%);
}

.segment-label {
  font-size: 0.75rem;
  font-weight: 900;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  position: relative;
  z-index: 1;
}

/* Target Marker */
.target-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}

.marker-line {
  width: 3px;
  height: 100%;
  background: #1e293b;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
}

.marker-label {
  position: absolute;
  top: -1.5rem;
  background: #1e293b;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  font-weight: 900;
  white-space: nowrap;
}

/* Gap Indicator */
.gap-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #fff7ed;
  border-radius: 1.5rem;
  border: 1px solid #fed7aa;
}

.gap-icon {
  font-size: 0.875rem;
}

.gap-text {
  font-size: 0.6875rem;
  font-weight: 900;
  color: #92400e;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Balanced Indicator */
.balanced-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #ecfdf5;
  border-radius: 1.5rem;
  border: 1px solid #a7f3d0;
}

.balanced-icon {
  font-size: 0.875rem;
  color: #059669;
}

.balanced-text {
  font-size: 0.6875rem;
  font-weight: 900;
  color: #065f46;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
