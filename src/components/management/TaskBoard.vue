<script setup>
import { useI18n } from '@/composables/useI18n'
import { useManagementStore } from '@/stores/management'
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-vue-next'

const emit = defineEmits(['openDetail'])

const { t } = useI18n()
const managementStore = useManagementStore()

function getProfileImage(person) {
  return person === 'Dad' ? '/assets/profile/king_profile.png' : '/assets/profile/queen_profile.png'
}

function getStatusClass(status) {
  return `st-${status.replace(' ', '-')}`
}

function getUrgencyClass(urgency) {
  return `u-${urgency}`
}
</script>

<template>
  <div>
    <!-- Unassigned Tasks -->
    <div v-if="managementStore.unassignedTasks.length > 0" class="mb-8">
      <h4 class="section-label warning">
        <div class="pulse-dot"></div>
        {{ t('waitingForOwner') }}
      </h4>
      <div class="board-container">
        <div class="board-grid">
          <div class="board-header">
            <div class="header-cell">{{ t('task') }}</div>
            <div class="header-cell cell-center">{{ t('status') }}</div>
            <div class="header-cell cell-center">{{ t('urgency') }}</div>
            <div class="header-cell">{{ t('dueDate') }}</div>
            <div class="header-cell cell-center">{{ t('action') }}</div>
            <div class="header-cell cell-center">{{ t('creator') }}</div>
          </div>

          <div
            v-for="task in managementStore.unassignedTasks"
            :key="task.id"
            @click="$emit('openDetail', task, 'task')"
            class="board-row unassigned-row"
          >
            <div class="row-cell cell-name">
              <span class="truncate font-bold text-slate-700">{{ task.name }}</span>
            </div>
            <div class="row-cell cell-center">
              <div class="status-block bg-white text-slate-400 border border-slate-200">{{ t('pending') }}</div>
            </div>
            <div class="row-cell cell-center">
              <div class="urgency-dot" :class="getUrgencyClass(task.urgency)"></div>
              <span class="urgency-label">{{ t(task.urgency) }}</span>
            </div>
            <div class="row-cell">
              <span class="date-text bidi-isolate">{{ task.dueDate || '-' }}</span>
            </div>
            <div class="row-cell cell-center">
              <div class="avatar-unassigned">?</div>
            </div>
            <div class="row-cell cell-center avatar-cell">
              <img v-if="task.creator" :src="getProfileImage(task.creator)" alt="Creator" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Assigned Tasks -->
    <h4 class="section-label">{{ t('assignedTasks') }}</h4>
    <div class="board-container">
      <div class="board-grid">
        <div class="board-header">
          <div
            class="header-cell sortable"
            :class="{ active: managementStore.sortKey === 'name' }"
            @click="managementStore.setSortKey('name')"
          >
            {{ t('task') }}
            <ChevronDown
              v-if="managementStore.sortKey === 'name' && managementStore.sortOrder === 1"
              :size="12"
              class="sort-icon"
            />
            <ChevronUp
              v-if="managementStore.sortKey === 'name' && managementStore.sortOrder === -1"
              :size="12"
              class="sort-icon"
            />
          </div>
          <div
            class="header-cell cell-center sortable"
            :class="{ active: managementStore.sortKey === 'status' }"
            @click="managementStore.setSortKey('status')"
          >
            {{ t('status') }}
            <ChevronDown
              v-if="managementStore.sortKey === 'status' && managementStore.sortOrder === 1"
              :size="12"
              class="sort-icon"
            />
            <ChevronUp
              v-if="managementStore.sortKey === 'status' && managementStore.sortOrder === -1"
              :size="12"
              class="sort-icon"
            />
          </div>
          <div
            class="header-cell cell-center sortable"
            :class="{ active: managementStore.sortKey === 'urgency' }"
            @click="managementStore.setSortKey('urgency')"
          >
            {{ t('urgency') }}
            <ChevronDown
              v-if="managementStore.sortKey === 'urgency' && managementStore.sortOrder === 1"
              :size="12"
              class="sort-icon"
            />
            <ChevronUp
              v-if="managementStore.sortKey === 'urgency' && managementStore.sortOrder === -1"
              :size="12"
              class="sort-icon"
            />
          </div>
          <div
            class="header-cell sortable"
            :class="{ active: managementStore.sortKey === 'dueDate' }"
            @click="managementStore.setSortKey('dueDate')"
          >
            {{ t('dueDate') }}
            <ChevronDown
              v-if="managementStore.sortKey === 'dueDate' && managementStore.sortOrder === 1"
              :size="12"
              class="sort-icon"
            />
            <ChevronUp
              v-if="managementStore.sortKey === 'dueDate' && managementStore.sortOrder === -1"
              :size="12"
              class="sort-icon"
            />
          </div>
          <div
            class="header-cell cell-center sortable"
            :class="{ active: managementStore.sortKey === 'owner' }"
            @click="managementStore.setSortKey('owner')"
          >
            {{ t('owner') }}
            <ChevronDown
              v-if="managementStore.sortKey === 'owner' && managementStore.sortOrder === 1"
              :size="12"
              class="sort-icon"
            />
            <ChevronUp
              v-if="managementStore.sortKey === 'owner' && managementStore.sortOrder === -1"
              :size="12"
              class="sort-icon"
            />
          </div>
          <div
            class="header-cell cell-center sortable"
            :class="{ active: managementStore.sortKey === 'creator' }"
            @click="managementStore.setSortKey('creator')"
          >
            {{ t('creator') }}
            <ChevronDown
              v-if="managementStore.sortKey === 'creator' && managementStore.sortOrder === 1"
              :size="12"
              class="sort-icon"
            />
            <ChevronUp
              v-if="managementStore.sortKey === 'creator' && managementStore.sortOrder === -1"
              :size="12"
              class="sort-icon"
            />
          </div>
        </div>

        <div
          v-for="task in managementStore.sortedAssignedTasks"
          :key="task.id"
          @click="$emit('openDetail', task, 'task')"
          class="board-row is-task"
        >
          <div class="row-cell cell-name">
            <span class="truncate">{{ task.name }}</span>
            <MessageSquare
              v-if="task.comments.length"
              :size="12"
              class="comment-icon"
            />
          </div>
          <div class="row-cell cell-center">
            <div class="status-block" :class="getStatusClass(task.status)">{{ t(task.status) }}</div>
          </div>
          <div class="row-cell cell-center">
            <div class="urgency-dot" :class="getUrgencyClass(task.urgency)"></div>
            <span class="urgency-label">{{ t(task.urgency) }}</span>
          </div>
          <div class="row-cell">
            <span class="date-text bidi-isolate">{{ task.dueDate || '-' }}</span>
          </div>
          <div class="row-cell cell-center avatar-cell">
            <img :src="getProfileImage(task.owner)" alt="Owner" />
          </div>
          <div class="row-cell cell-center avatar-cell">
            <img v-if="task.creator" :src="getProfileImage(task.creator)" alt="Creator" />
          </div>
        </div>

        <div v-if="managementStore.sortedAssignedTasks.length === 0" class="empty-state">
          {{ t('noTasks') }}
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-label.warning {
  color: #fb923c;
}

.pulse-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #fb923c;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
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

.header-cell.sortable {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.25rem;
}

.header-cell.sortable.cell-center {
  justify-content: center;
}

.header-cell.sortable:hover {
  background: #f1f5f9;
  color: #475569;
}

.header-cell.sortable.active {
  color: #1e293b;
  background: #e2e8f0;
}

.sort-icon {
  flex-shrink: 0;
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

.unassigned-row {
  background: #fffbeb;
  border-left: 4px solid #fb923c;
}

.unassigned-row:hover {
  background: #fef3c7;
}

.row-cell.cell-name {
  font-weight: 700;
  position: relative;
}

.comment-icon {
  position: absolute;
  right: 0.5rem;
  color: #94a3b8;
  opacity: 0;
  transition: opacity 0.2s;
}

.board-row:hover .comment-icon {
  opacity: 1;
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

.st-in-progress {
  background: #dbeafe;
  color: #1e40af;
}

.st-completed {
  background: #d1fae5;
  color: #065f46;
}

.st-failed {
  background: #fee2e2;
  color: #991b1b;
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
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
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

.avatar-unassigned {
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
