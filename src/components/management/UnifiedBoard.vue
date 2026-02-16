<script setup>
import { useI18n } from '@/composables/useI18n'
import { useManagementStore } from '@/stores/supabaseManagement'
import { ChevronDown, ChevronUp, Plus, ArrowLeftRight, MessageSquare } from 'lucide-vue-next'

const props = defineProps({
  items: { type: Array, required: true },
  groupTitle: { type: String, required: true },
  groupColor: { type: String, default: '#3b82f6' },
  sortable: { type: Boolean, default: false },
  collapsible: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
  showAddRow: { type: Boolean, default: false },
  emptyText: { type: String, default: '' }
})

const emit = defineEmits(['openDetail', 'addNew', 'toggleCollapse'])

const { t } = useI18n()
const managementStore = useManagementStore()

function getProfileImage(person) {
  return person === 'Dad' ? '/assets/profile/king_profile.png' : '/assets/profile/queen_profile.png'
}

function getStatusClass(status) {
  return `ub-st-${(status || '').replace(/[ _]/g, '-')}`
}

function getUrgencyClass(urgency) {
  return `ub-u-${urgency}`
}

function isSwitchDays(item) {
  return item.event_data?.switchType === 'day_swap'
}

function isOverdue(item) {
  if (!item.dueDate || ['completed', 'failed', 'rejected'].includes(item.status)) return false
  return new Date(item.dueDate + 'T23:59:59') < new Date()
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

// Card color themes per type (matching ChildCard pastel gradient style)
const CARD_THEMES = {
  task: {
    bg: 'linear-gradient(155deg, #dbeafe 0%, #eff6ff 50%, #f8faff 100%)',
    border: 'rgba(96, 165, 250, 0.4)',
    accent: '#3b82f6'
  },
  ask: {
    bg: 'linear-gradient(155deg, #d1fae5 0%, #ecfdf5 50%, #f0fdfa 100%)',
    border: 'rgba(52, 211, 153, 0.4)',
    accent: '#0d9488'
  },
  switch: {
    bg: 'linear-gradient(155deg, #fef3c7 0%, #fffbeb 50%, #fefce8 100%)',
    border: 'rgba(252, 211, 77, 0.5)',
    accent: '#f59e0b'
  },
  overdue: {
    bg: 'linear-gradient(155deg, #fee2e2 0%, #fef2f2 50%, #fff5f5 100%)',
    border: 'rgba(248, 113, 113, 0.4)',
    accent: '#dc2626'
  }
}

function getCardTheme(item) {
  if (isOverdue(item)) return CARD_THEMES.overdue
  if (isSwitchDays(item)) return CARD_THEMES.switch
  if (item.type === 'ask') return CARD_THEMES.ask
  return CARD_THEMES.task
}

function getCardVars(item) {
  const theme = getCardTheme(item)
  return {
    '--card-bg': theme.bg,
    '--card-border': theme.border,
    '--card-accent': theme.accent
  }
}
</script>

<template>
  <div class="ub-wrapper" :style="{ '--group-color': groupColor }">
    <!-- Group Header -->
    <div
      class="ub-group-header"
      :class="{ clickable: collapsible }"
      @click="collapsible ? $emit('toggleCollapse') : null"
    >
      <ChevronDown
        v-if="collapsible"
        :size="16"
        class="ub-collapse-chevron"
        :class="{ open: !collapsed }"
      />
      <span class="ub-group-title">{{ t(groupTitle) }}</span>
      <span class="ub-group-count">{{ items.length }}</span>
    </div>

    <!-- Content (hidden when collapsed) -->
    <div v-if="!collapsed" class="ub-container">

      <!-- ========== DESKTOP: Table View ========== -->
      <div class="ub-table">
        <!-- Column Headers -->
        <div class="ub-header">
          <div
            class="ub-hcell ub-hcell-name"
            :class="{ sortable: sortable, active: sortable && managementStore.sortKey === 'name' }"
            @click="sortable ? managementStore.setSortKey('name') : null"
          >
            {{ t('task') }}
            <ChevronDown v-if="sortable && managementStore.sortKey === 'name' && managementStore.sortOrder === 1" :size="12" />
            <ChevronUp v-if="sortable && managementStore.sortKey === 'name' && managementStore.sortOrder === -1" :size="12" />
          </div>
          <div
            class="ub-hcell ub-hcell-center"
            :class="{ sortable: sortable, active: sortable && managementStore.sortKey === 'status' }"
            @click="sortable ? managementStore.setSortKey('status') : null"
          >
            {{ t('status') }}
            <ChevronDown v-if="sortable && managementStore.sortKey === 'status' && managementStore.sortOrder === 1" :size="12" />
            <ChevronUp v-if="sortable && managementStore.sortKey === 'status' && managementStore.sortOrder === -1" :size="12" />
          </div>
          <div
            class="ub-hcell ub-hcell-center"
            :class="{ sortable: sortable, active: sortable && managementStore.sortKey === 'urgency' }"
            @click="sortable ? managementStore.setSortKey('urgency') : null"
          >
            {{ t('urgency') }}
            <ChevronDown v-if="sortable && managementStore.sortKey === 'urgency' && managementStore.sortOrder === 1" :size="12" />
            <ChevronUp v-if="sortable && managementStore.sortKey === 'urgency' && managementStore.sortOrder === -1" :size="12" />
          </div>
          <div
            class="ub-hcell"
            :class="{ sortable: sortable, active: sortable && managementStore.sortKey === 'dueDate' }"
            @click="sortable ? managementStore.setSortKey('dueDate') : null"
          >
            {{ t('dueDate') }}
            <ChevronDown v-if="sortable && managementStore.sortKey === 'dueDate' && managementStore.sortOrder === 1" :size="12" />
            <ChevronUp v-if="sortable && managementStore.sortKey === 'dueDate' && managementStore.sortOrder === -1" :size="12" />
          </div>
          <div class="ub-hcell ub-hcell-center">{{ t('child') || 'Child' }}</div>
          <div
            class="ub-hcell ub-hcell-center"
            :class="{ sortable: sortable, active: sortable && managementStore.sortKey === 'owner' }"
            @click="sortable ? managementStore.setSortKey('owner') : null"
          >
            {{ t('owner') }}
            <ChevronDown v-if="sortable && managementStore.sortKey === 'owner' && managementStore.sortOrder === 1" :size="12" />
            <ChevronUp v-if="sortable && managementStore.sortKey === 'owner' && managementStore.sortOrder === -1" :size="12" />
          </div>
          <div
            class="ub-hcell ub-hcell-center"
            :class="{ sortable: sortable, active: sortable && managementStore.sortKey === 'creator' }"
            @click="sortable ? managementStore.setSortKey('creator') : null"
          >
            {{ t('creator') }}
            <ChevronDown v-if="sortable && managementStore.sortKey === 'creator' && managementStore.sortOrder === 1" :size="12" />
            <ChevronUp v-if="sortable && managementStore.sortKey === 'creator' && managementStore.sortOrder === -1" :size="12" />
          </div>
        </div>

        <!-- Table Rows -->
        <div
          v-for="item in items"
          :key="item.id"
          class="ub-row"
          :style="getCardVars(item)"
          @click="$emit('openDetail', item, item.type)"
        >
          <!-- Name -->
          <div class="ub-cell ub-cell-name">
            <div class="ub-name-content">
              <div class="ub-name-row">
                <ArrowLeftRight v-if="isSwitchDays(item)" :size="13" class="ub-switch-icon" />
                <span class="ub-item-name">{{ item.name }}</span>
              </div>
              <span v-if="item.description" class="ub-item-desc">{{ item.description }}</span>
            </div>
            <MessageSquare v-if="item.comments && item.comments.length" :size="12" class="ub-comment-icon" />
          </div>

          <!-- Status -->
          <div class="ub-cell ub-cell-center">
            <div class="ub-status-pill" :class="getStatusClass(item.status)">{{ t(item.status) }}</div>
          </div>

          <!-- Urgency -->
          <div class="ub-cell ub-cell-center">
            <div class="ub-urgency-dot" :class="getUrgencyClass(item.urgency)"></div>
            <span class="ub-urgency-label">{{ t(item.urgency) }}</span>
          </div>

          <!-- Due Date -->
          <div class="ub-cell">
            <span class="ub-date bidi-isolate" :class="{ 'ub-overdue': isOverdue(item) }">
              {{ formatDate(item.dueDate) }}
            </span>
          </div>

          <!-- Child -->
          <div class="ub-cell ub-cell-center">
            <span v-if="item.child" class="ub-child-tag">{{ item.child }}</span>
            <span v-else class="ub-no-data">-</span>
          </div>

          <!-- Owner -->
          <div class="ub-cell ub-cell-center">
            <img v-if="item.owner" :src="getProfileImage(item.owner)" class="ub-avatar" alt="" />
            <div v-else class="ub-avatar-empty">?</div>
          </div>

          <!-- Creator -->
          <div class="ub-cell ub-cell-center">
            <img v-if="item.creator" :src="getProfileImage(item.creator)" class="ub-avatar" alt="" />
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="items.length === 0 && emptyText" class="ub-empty">{{ emptyText }}</div>

        <!-- Add row -->
        <div v-if="showAddRow" class="ub-add-row" @click="$emit('addNew')">
          <Plus :size="14" />
          <span>{{ t('addItem') || 'Add item' }}</span>
        </div>
      </div>

      <!-- ========== MOBILE: Card View ========== -->
      <div class="ub-cards">
        <div
          v-for="item in items"
          :key="item.id"
          class="ub-card"
          :style="getCardVars(item)"
          @click="$emit('openDetail', item, item.type)"
        >
          <!-- Row 1: name + type badge -->
          <div class="ub-card-top">
            <ArrowLeftRight v-if="isSwitchDays(item)" :size="12" class="ub-switch-icon" />
            <span class="ub-card-name">{{ item.name }}</span>
            <span v-if="isSwitchDays(item)" class="ub-type-badge ub-type-switch">{{ t('switchDays') }}</span>
            <span v-else class="ub-type-badge" :class="`ub-type-${item.type}`">{{ t(item.type) }}</span>
          </div>

          <!-- Row 2: compact metadata strip -->
          <div class="ub-card-strip">
            <div class="ub-status-pill ub-status-pill-sm" :class="getStatusClass(item.status)">{{ t(item.status) }}</div>
            <div class="ub-urgency-inline">
              <div class="ub-urgency-dot" :class="getUrgencyClass(item.urgency)"></div>
              <span class="ub-urgency-label">{{ t(item.urgency) }}</span>
            </div>
            <span class="ub-date bidi-isolate" :class="{ 'ub-overdue': isOverdue(item) }">{{ formatDate(item.dueDate) }}</span>
            <img v-if="item.owner" :src="getProfileImage(item.owner)" class="ub-strip-avatar" alt="" />
            <div v-else class="ub-avatar-empty ub-avatar-empty-sm">?</div>
            <span v-if="item.child" class="ub-child-tag">{{ item.child }}</span>
            <div v-if="item.comments && item.comments.length" class="ub-comment-badge">
              <MessageSquare :size="11" />
              <span>{{ item.comments.length }}</span>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="items.length === 0 && emptyText" class="ub-empty">{{ emptyText }}</div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ========== Wrapper & Group Header ========== */
.ub-wrapper {
  margin-bottom: 1.5rem;
}

.ub-group-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-inline-start: 4px solid var(--group-color);
  border-radius: 0.875rem 0.875rem 0 0;
  user-select: none;
}

.ub-group-header.clickable {
  cursor: pointer;
  transition: background 0.15s;
}

.ub-group-header.clickable:hover {
  background: #f1f5f9;
}

.ub-collapse-chevron {
  color: #94a3b8;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.ub-collapse-chevron.open {
  transform: rotate(180deg);
}

.ub-group-title {
  font-size: 0.8125rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #475569;
}

.ub-group-count {
  font-size: 0.6875rem;
  font-weight: 800;
  background: #e2e8f0;
  color: #64748b;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

/* ========== Container ========== */
.ub-container {
  background: white;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 1.25rem 1.25rem;
  overflow: hidden;
}

/* ========== Desktop Table ========== */
.ub-header,
.ub-row {
  display: grid;
  grid-template-columns: 2.5fr 1fr 0.8fr 0.8fr 0.7fr 0.6fr 0.6fr;
  align-items: center;
  padding: 0 1.25rem;
}

.ub-header {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.ub-hcell {
  font-size: 0.6875rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.375rem;
}

.ub-hcell.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s, background 0.15s;
  border-radius: 0.375rem;
}

.ub-hcell.sortable:hover {
  color: #475569;
  background: rgba(0, 0, 0, 0.03);
}

.ub-hcell.sortable.active {
  color: #1e293b;
}

.ub-hcell-center {
  justify-content: center;
}

.ub-hcell-name {
  padding-inline-start: 0.125rem;
}

/* ========== Table Rows ========== */
.ub-row {
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  margin: 0.375rem 0.5rem;
  border-radius: 0.875rem;
  background: var(--card-bg, white);
  border: 2px solid var(--card-border, #e2e8f0);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.15s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

/* 45-degree hatching texture overlay */
.ub-row::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.15) 2px,
    rgba(255, 255, 255, 0.15) 4px
  );
  pointer-events: none;
}

.ub-row:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.ub-row:first-child {
  margin-top: 0.5rem;
}

.ub-row:last-child {
  margin-bottom: 0.5rem;
}

/* ========== Cells ========== */
.ub-cell {
  display: flex;
  align-items: center;
  font-size: 0.8125rem;
  color: #1e293b;
  padding: 0 0.375rem;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.ub-cell-center {
  justify-content: center;
}

/* Name cell */
.ub-cell-name {
  gap: 0.5rem;
  position: relative;
}

.ub-name-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.ub-name-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}

.ub-item-name {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ub-item-desc {
  font-size: 0.6875rem;
  font-weight: 500;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ub-switch-icon {
  color: #f59e0b;
  flex-shrink: 0;
}

.ub-comment-icon {
  color: #cbd5e1;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.ub-row:hover .ub-comment-icon {
  opacity: 1;
}

/* Status pill */
.ub-status-pill {
  padding: 0.3rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  text-align: center;
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}

.ub-status-pill::before {
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

.ub-st-pending { background: #fef3c7; color: #92400e; }
.ub-st-in-progress { background: #dbeafe; color: #1e40af; }
.ub-st-completed { background: #d1fae5; color: #065f46; }
.ub-st-failed { background: #fee2e2; color: #991b1b; }
.ub-st-rejected { background: #fee2e2; color: #991b1b; }

/* Urgency */
.ub-urgency-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
  margin-inline-end: 0.375rem;
}

.ub-u-low { background: #94a3b8; }
.ub-u-mid { background: #fbbf24; }
.ub-u-high { background: #f97316; }
.ub-u-urgent { background: #dc2626; animation: ubPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

@keyframes ubPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.ub-urgency-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
}

.ub-urgency-inline {
  display: flex;
  align-items: center;
}

/* Date */
.ub-date {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #64748b;
}

.ub-overdue {
  color: #dc2626;
  background: #fef2f2;
  padding: 0.125rem 0.5rem;
  border-radius: 0.375rem;
}

/* Child tag */
.ub-child-tag {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #475569;
  background: #f1f5f9;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.ub-no-data {
  color: #cbd5e1;
  font-size: 0.75rem;
}

/* Avatars */
.ub-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  background: white;
}

.ub-avatar-empty {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: #f1f5f9;
  border: 2px dashed #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 900;
  color: #94a3b8;
}

/* Empty state */
.ub-empty {
  text-align: center;
  padding: 2rem 1.5rem;
  color: #cbd5e1;
  font-weight: 700;
  font-style: italic;
}

/* Add row */
.ub-add-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  color: #94a3b8;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  border-top: 1px solid #f1f5f9;
}

.ub-add-row:hover {
  color: #1e293b;
  background: #f8fafc;
}

/* ========== Mobile: Card View — Hidden by default ========== */
.ub-cards {
  display: none;
}

@media (max-width: 640px) {
  .ub-table {
    display: none;
  }

  .ub-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
  }

  .ub-card {
    background: var(--card-bg, white);
    border-radius: 1rem;
    border: 2px solid var(--card-border, #e2e8f0);
    padding: 0.625rem 0.75rem;
    cursor: pointer;
    transition: transform 0.1s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
  }

  /* 45-degree hatching texture overlay */
  .ub-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.15) 2px,
      rgba(255, 255, 255, 0.15) 4px
    );
    pointer-events: none;
  }

  .ub-card:active {
    transform: scale(0.98);
  }

  /* Row 1: name + type badge */
  .ub-card-top {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.375rem;
    position: relative;
    z-index: 1;
  }

  .ub-card-name {
    font-size: 0.875rem;
    font-weight: 800;
    color: #0f172a;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ub-type-badge {
    font-size: 0.5rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.4rem;
    border-radius: 9999px;
    flex-shrink: 0;
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.7);
    color: #475569;
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  .ub-type-task { background: rgba(59, 130, 246, 0.15); color: #1e40af; border-color: rgba(59, 130, 246, 0.2); }
  .ub-type-ask { background: rgba(13, 148, 136, 0.15); color: #065f46; border-color: rgba(13, 148, 136, 0.2); }
  .ub-type-switch { background: rgba(245, 158, 11, 0.15); color: #92400e; border-color: rgba(245, 158, 11, 0.2); }

  /* Row 2: compact horizontal metadata strip */
  .ub-card-strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    position: relative;
    z-index: 1;
  }

  .ub-status-pill-sm {
    padding: 0.175rem 0.5rem;
    font-size: 0.5625rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .ub-strip-avatar {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 1.5px solid #e2e8f0;
    flex-shrink: 0;
  }

  .ub-avatar-empty-sm {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.5rem;
  }

  .ub-comment-badge {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.625rem;
    font-weight: 700;
    color: #94a3b8;
    margin-inline-start: auto;
  }

  /* Smaller urgency dot/label in strip */
  .ub-card-strip .ub-urgency-dot {
    width: 0.4rem;
    height: 0.4rem;
  }

  .ub-card-strip .ub-urgency-label {
    font-size: 0.5625rem;
  }

  .ub-card-strip .ub-date {
    font-size: 0.75rem;
  }

  .ub-card-strip .ub-child-tag {
    font-size: 0.5625rem;
    padding: 0.1rem 0.375rem;
  }

  /* Group header mobile adjustments */
  .ub-group-header {
    border-radius: 0.75rem 0.75rem 0 0;
    padding: 0.625rem 1rem;
  }

  .ub-group-title {
    font-size: 0.75rem;
  }

  .ub-container {
    border-radius: 0 0 0.75rem 0.75rem;
  }
}
</style>
