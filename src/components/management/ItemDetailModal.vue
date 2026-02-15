<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useManagementStore } from '@/stores/supabaseManagement'
import { useSupabaseDashboardStore as useDashboardStore } from '@/stores/supabaseDashboard'
import { useAuth } from '@/composables/useAuth'
import { Send, ArrowLeftRight, Clock } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  itemType: {
    type: String,
    required: true
  },
  readOnly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const managementStore = useManagementStore()
const dashboardStore = useDashboardStore()
const { user } = useAuth()

const newComment = ref('')
const activityLog = ref([])
const activityLoading = ref(false)

const headerBg = computed(() => {
  if (isSwitchDays.value) return '#F59E0B'
  return props.itemType === 'ask' ? '#34D399' : '#60A5FA'
})

const isSwitchDays = computed(() => props.item.event_data?.switchType === 'day_swap')

onMounted(async () => {
  activityLoading.value = true
  activityLog.value = await managementStore.fetchActivityLog(props.item.id)
  activityLoading.value = false
})

function addComment() {
  if (!newComment.value.trim()) return
  managementStore.addComment(props.item.id, newComment.value)
  newComment.value = ''
}

function handleAskAction(action) {
  managementStore.handleAskAction(props.item, action)
  emit('close')
}

function handleStatusChange(e) {
  managementStore.updateTaskStatus(props.item.id, e.target.value)
}

function claimTask(ownerId) {
  managementStore.assignTask(props.item.id, ownerId)
}

function getProfileImage(person) {
  return person === 'Dad' ? '/assets/profile/king_profile.png' : '/assets/profile/queen_profile.png'
}

function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function formatLogTime(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <BaseModal
    :headerStyle="headerBg"
    maxWidth="500px"
    :showFooter="false"
    @close="$emit('close')"
  >
    <template #header>
      <div class="header-top">
        <span class="urgency-badge">{{ t(item.urgency) }}</span>
        <span v-if="readOnly" class="readonly-badge">{{ t(item.status) }}</span>
      </div>
      <h2 class="modal-title">{{ item.name }}</h2>
      <span class="type-badge-bottom">
        <ArrowLeftRight v-if="isSwitchDays" :size="12" style="display: inline" />
        {{ isSwitchDays ? t('switchDaysRequest') : t(itemType) }}
      </span>
    </template>

    <!-- Switch-Days Detail -->
    <div v-if="isSwitchDays" class="switch-detail">
      <h4 class="switch-detail-title">{{ t('switchPreview') }}</h4>
      <div class="preview-row">
        <span class="preview-label you">{{ t('youGet') }}</span>
        <span class="preview-date">{{ formatDateLabel(item.event_data.switchFromDate) }}</span>
      </div>
      <div v-if="item.event_data.switchToDate" class="preview-row">
        <span class="preview-label they">{{ t('theyGet') }}</span>
        <span class="preview-date">{{ formatDateLabel(item.event_data.switchToDate) }}</span>
      </div>
    </div>

    <!-- Claim Task (for unassigned active tasks) -->
    <div
      v-if="itemType === 'task' && !item.owner_id && !readOnly"
      class="claim-section"
    >
      <p class="claim-message">{{ t('claimTaskMsg') }}</p>
      <div class="claim-options">
        <button @click="claimTask(user?.id)" class="claim-btn">
          <img src="/assets/profile/king_profile.png" class="claim-avatar" />
          {{ t('me') }}
        </button>
        <button v-if="dashboardStore.partnerId" @click="claimTask(dashboardStore.partnerId)" class="claim-btn">
          <img src="/assets/profile/queen_profile.png" class="claim-avatar" />
          {{ t('partner') }}
        </button>
      </div>
    </div>

    <!-- Status & Due Date -->
    <div class="details-grid">
      <div class="detail-field">
        <label class="field-label">{{ t('status') }}</label>
        <select
          v-if="!readOnly && itemType === 'task'"
          :value="item.status"
          @change="handleStatusChange"
          class="field-select"
        >
          <option value="pending">{{ t('pending') }}</option>
          <option value="in_progress">{{ t('in_progress') }}</option>
          <option value="completed">{{ t('completed') }}</option>
          <option value="failed">{{ t('failed') }}</option>
        </select>
        <span v-else class="field-value">{{ t(item.status) }}</span>
      </div>

      <div class="detail-field">
        <label class="field-label">{{ t('dueDate') }}</label>
        <span class="field-value bidi-isolate">{{ item.dueDate || '-' }}</span>
      </div>
    </div>

    <!-- Ask Action Buttons (not read-only) -->
    <div
      v-if="itemType === 'ask' && item.status === 'pending' && !readOnly"
      class="ask-action-section"
    >
      <p class="ask-action-message">{{ t('askActionMsg') }}</p>
      <div class="ask-action-buttons">
        <button @click="handleAskAction('reject')" class="btn-reject">
          {{ t('reject') }}
        </button>
        <button @click="handleAskAction('accept')" class="btn-accept">
          {{ t('accept') }}
        </button>
      </div>
    </div>

    <!-- Comments Thread -->
    <div class="comments-section">
      <h4 class="comments-title">{{ t('activityComments') }}</h4>

      <div class="chat-thread">
        <div
          v-if="item.comments.length === 0"
          class="no-comments"
        >
          {{ t('noComments') }}
        </div>

        <div
          v-for="(comment, index) in item.comments"
          :key="index"
          :class="['chat-message', { system: comment.action && comment.action !== 'comment' }]"
        >
          <template v-if="comment.action && comment.action !== 'comment'">
            <!-- System/action entry -->
            <div class="system-entry">
              <Clock :size="12" class="system-icon" />
              <span class="system-text">{{ comment.text }}</span>
              <span class="system-time bidi-isolate">{{ comment.time }}</span>
            </div>
          </template>
          <template v-else>
            <img
              :src="getProfileImage(comment.author_id === user?.id ? 'Dad' : 'Mom')"
              class="chat-avatar"
              alt="Avatar"
            />
            <div :class="['chat-bubble', { me: comment.author_id === user?.id }]">
              <p class="chat-text">{{ comment.text }}</p>
              <span class="chat-time bidi-isolate">{{ comment.time }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- Activity Log Timeline -->
      <div v-if="activityLog.length > 0" class="activity-log">
        <h4 class="log-title">{{ t('archive') }}</h4>
        <div
          v-for="entry in activityLog"
          :key="entry.id"
          class="log-entry"
        >
          <Clock :size="12" class="log-icon" />
          <span class="log-text">
            {{ entry.changes?.old_status }} → {{ entry.changes?.new_status }}
          </span>
          <span class="log-time bidi-isolate">{{ formatLogTime(entry.created_at) }}</span>
        </div>
      </div>

      <!-- Comment Input (not read-only) -->
      <div v-if="!readOnly" class="chat-input-container">
        <input
          v-model="newComment"
          type="text"
          :placeholder="t('addCommentPlaceholder')"
          @keyup.enter="addComment"
          class="chat-input"
        />
        <div @click="addComment" class="chat-send-btn">
          <Send :size="16" />
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.header-top {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.urgency-badge {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.readonly-badge {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.type-badge-bottom {
  font-size: 0.625rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  margin-top: 0.5rem;
  display: block;
}

/* Switch-days detail */
.switch-detail {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 1rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.switch-detail-title {
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #92400e;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.preview-row:last-child {
  margin-bottom: 0;
}

.preview-label {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
}

.preview-label.you {
  background: #d1fae5;
  color: #065f46;
}

.preview-label.they {
  background: #dbeafe;
  color: #1e40af;
}

.preview-date {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
}

.claim-section {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  padding: 1rem;
  border-radius: 1.5rem;
  margin-bottom: 1rem;
}

.claim-message {
  font-size: 0.75rem;
  font-weight: 700;
  color: #9a3412;
  margin-bottom: 0.75rem;
  text-align: center;
}

.claim-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.claim-btn {
  padding: 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.claim-btn:hover {
  border-color: #1e293b;
  background: #f8fafc;
}

.claim-avatar {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.detail-field {
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 1.5rem;
}

.field-label {
  display: block;
  font-size: 0.5625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 0.25rem;
  text-align: start;
}

.field-select,
.field-input {
  background: transparent;
  font-weight: 700;
  font-size: 0.875rem;
  width: 100%;
  outline: none;
  border: none;
  text-align: start;
  color: #1e293b;
}

.field-value {
  font-weight: 700;
  font-size: 0.875rem;
  color: #1e293b;
  text-transform: capitalize;
}

.ask-action-section {
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  padding: 1rem;
  border-radius: 1.5rem;
  margin-bottom: 1rem;
}

.ask-action-message {
  font-size: 0.75rem;
  font-weight: 700;
  color: #115e59;
  margin-bottom: 0.75rem;
  text-align: center;
}

.ask-action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.btn-reject,
.btn-accept {
  padding: 0.75rem;
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-reject {
  background: white;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.btn-reject:hover {
  background: #fef2f2;
}

.btn-accept {
  background: #0d9488;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.btn-accept:hover {
  background: #0f766e;
}

.comments-section {
  margin-top: 1rem;
}

.comments-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
  text-align: start;
}

.chat-thread {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.no-comments {
  text-align: center;
  font-size: 0.625rem;
  color: #94a3b8;
  font-style: italic;
  padding: 1rem;
}

.chat-message {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.chat-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  background: white;
  flex-shrink: 0;
}

.chat-bubble {
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 1rem 1rem 1rem 0.25rem;
  max-width: 70%;
}

.chat-bubble.me {
  background: #0d9488;
  color: white;
  border-radius: 1rem 1rem 0.25rem 1rem;
  margin-left: auto;
}

.chat-text {
  font-size: 0.875rem;
  line-height: 1.4;
  text-align: start;
  margin: 0;
}

.chat-time {
  font-size: 0.5625rem;
  opacity: 0.5;
  display: block;
  margin-top: 0.25rem;
}

/* System entries (status changes, assignments) */
.system-entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.375rem 0;
}

.system-icon {
  color: #94a3b8;
  flex-shrink: 0;
}

.system-text {
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
}

.system-time {
  font-size: 0.625rem;
  color: #cbd5e1;
  margin-left: auto;
}

/* Activity log timeline */
.activity-log {
  border-top: 1px solid #e2e8f0;
  padding-top: 0.75rem;
  margin-top: 0.5rem;
  margin-bottom: 1rem;
}

.log-title {
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.log-entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid #f8fafc;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-icon {
  color: #cbd5e1;
  flex-shrink: 0;
}

.log-text {
  font-size: 0.75rem;
  color: #64748b;
}

.log-time {
  font-size: 0.625rem;
  color: #cbd5e1;
  margin-left: auto;
}

.chat-input-container {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 1.5rem;
  outline: none;
  font-size: 0.875rem;
  text-align: start;
  transition: all 0.2s;
}

.chat-input:focus {
  border-color: #1e293b;
  background: white;
}

.chat-send-btn {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: #0d9488;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.chat-send-btn:hover {
  background: #0f766e;
  transform: scale(1.05);
}

.chat-send-btn:active {
  transform: scale(0.95);
}
</style>
