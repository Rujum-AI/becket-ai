<script setup>
import { useI18n } from '@/composables/useI18n'
import { useManagementStore } from '@/stores/supabaseManagement'
import { ArrowLeftRight } from 'lucide-vue-next'

const emit = defineEmits(['openDetail'])

const { t } = useI18n()
const managementStore = useManagementStore()

function getProfileImage(person) {
  return person === 'Dad' ? '/assets/profile/king_profile.png' : '/assets/profile/queen_profile.png'
}

function getUrgencyClass(urgency) {
  return `u-${urgency}`
}

function isSwitchDays(ask) {
  return ask.event_data?.switchType === 'day_swap'
}
</script>

<template>
  <div>
    <h4 class="section-label">{{ t('pendingRequests') }}</h4>
    <div class="board-container">
      <div class="board-grid">
        <div class="board-header">
          <div class="header-cell">{{ t('ask') }}</div>
          <div class="header-cell cell-center">{{ t('status') }}</div>
          <div class="header-cell cell-center">{{ t('urgency') }}</div>
          <div class="header-cell">{{ t('dueDate') }}</div>
          <div class="header-cell cell-center">{{ t('owner') }}</div>
          <div class="header-cell cell-center">{{ t('creator') }}</div>
        </div>

        <div
          v-for="ask in managementStore.sortedPendingAsks"
          :key="ask.id"
          @click="$emit('openDetail', ask, 'ask')"
          :class="['board-row', 'is-ask', { 'switch-row': isSwitchDays(ask) }]"
        >
          <div class="row-cell cell-name">
            <ArrowLeftRight v-if="isSwitchDays(ask)" :size="14" class="switch-icon" />
            <span class="truncate">{{ ask.name }}</span>
          </div>
          <div class="row-cell cell-center">
            <div class="status-block st-pending">{{ t('pending') }}</div>
          </div>
          <div class="row-cell cell-center">
            <div class="urgency-dot" :class="getUrgencyClass(ask.urgency)"></div>
            <span class="urgency-label">{{ t(ask.urgency) }}</span>
          </div>
          <div class="row-cell">
            <span class="date-text bidi-isolate">{{ ask.dueDate }}</span>
          </div>
          <div class="row-cell cell-center avatar-cell">
            <img :src="getProfileImage(ask.owner)" alt="Owner" />
          </div>
          <div class="row-cell cell-center avatar-cell">
            <img :src="getProfileImage(ask.creator)" alt="Creator" />
          </div>
        </div>

        <div v-if="managementStore.sortedPendingAsks.length === 0" class="empty-state">
          {{ t('noItems') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-label {
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
  padding: 0 0.5rem;
}

.board-container {
  background: white;
  border-radius: 2rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.board-grid {
  display: flex;
  flex-direction: column;
}

.board-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 0.8fr 0.8fr;
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  padding: 0.875rem 1.5rem;
}

.header-cell {
  font-size: 0.6875rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
}

.cell-center {
  text-align: center;
  justify-content: center;
}

.board-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 0.8fr 0.8fr;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: all 0.2s;
  align-items: center;
}

.board-row:last-child {
  border-bottom: none;
}

.board-row:hover {
  background: #f8fafc;
}

.board-row .row-cell {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: #1e293b;
}

.switch-row {
  border-left: 4px solid #f59e0b;
}

.switch-row:hover {
  background: #fffbeb;
}

.switch-icon {
  color: #f59e0b;
  margin-right: 0.5rem;
  flex-shrink: 0;
}

.row-cell.cell-name {
  font-weight: 700;
}

.status-block {
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  position: relative;
  overflow: hidden;
}

.status-block::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.1) 2px,
    rgba(255, 255, 255, 0.1) 4px
  );
  pointer-events: none;
}

.st-pending {
  background: #fef3c7;
  color: #92400e;
}

.urgency-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

.u-low {
  background: #94a3b8;
}

.u-mid {
  background: #fbbf24;
}

.u-high {
  background: #f97316;
}

.u-urgent {
  background: #dc2626;
}

.urgency-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
}

.date-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
}

.avatar-cell img {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  background: white;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #cbd5e1;
  font-weight: 700;
  font-style: italic;
  background: white;
  border-radius: 1rem;
  border: 2px dashed #e2e8f0;
}
</style>
