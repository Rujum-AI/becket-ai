<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useManagementStore } from '@/stores/management'
import { Send } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  itemType: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const managementStore = useManagementStore()

const newComment = ref('')

const headerColor = computed(() => {
  return props.itemType === 'ask' ? 'bg-teal-600' : 'bg-slate-800'
})

function addComment() {
  if (!newComment.value.trim()) return
  managementStore.addComment(props.item, newComment.value)
  newComment.value = ''
}

function handleAskAction(action) {
  managementStore.handleAskAction(props.item, action)
  emit('close')
}

function getProfileImage(person) {
  return person === 'Dad' ? '/assets/profile/king_profile.png' : '/assets/profile/queen_profile.png'
}
</script>

<template>
  <BaseModal
    :headerColor="headerColor"
    maxWidth="500px"
    :showFooter="false"
    @close="$emit('close')"
  >
    <template #header>
      <div class="header-top">
        <span class="urgency-badge">{{ t(item.urgency) }}</span>
      </div>
      <h2 class="modal-title">{{ item.name }}</h2>
      <span class="type-badge-bottom">{{ t(itemType) }}</span>
    </template>
        <!-- Claim Task (for unassigned tasks) -->
        <div
          v-if="itemType === 'task' && !item.owner"
          class="claim-section"
        >
          <p class="claim-message">{{ t('claimTaskMsg') }}</p>
          <div class="claim-options">
            <button @click="item.owner = 'Dad'" class="claim-btn">
              <img src="/assets/profile/king_profile.png" class="claim-avatar" />
              {{ t('Dad') }}
            </button>
            <button @click="item.owner = 'Mom'" class="claim-btn">
              <img src="/assets/profile/queen_profile.png" class="claim-avatar" />
              {{ t('Mom') }}
            </button>
          </div>
        </div>

        <!-- Status & Due Date -->
        <div class="details-grid">
          <div class="detail-field">
            <label class="field-label">{{ t('status') }}</label>
            <select
              v-model="item.status"
              class="field-select"
              :disabled="itemType === 'ask' && item.status === 'pending'"
            >
              <option value="pending">{{ t('pending') }}</option>
              <option value="in progress">{{ t('in progress') }}</option>
              <option value="completed">{{ t('completed') }}</option>
              <option value="failed">{{ t('failed') }}</option>
            </select>
          </div>

          <div class="detail-field">
            <label class="field-label">{{ t('dueDate') }}</label>
            <input
              v-model="item.dueDate"
              type="date"
              class="field-input"
            />
          </div>
        </div>

        <!-- Ask Action Buttons -->
        <div
          v-if="itemType === 'ask' && item.status === 'pending'"
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
              class="chat-message"
            >
              <img
                :src="getProfileImage(comment.author === 'Me' ? 'Dad' : 'Mom')"
                class="chat-avatar"
                alt="Avatar"
              />
              <div :class="['chat-bubble', { me: comment.author === 'Me' }]">
                <p class="chat-text">{{ comment.text }}</p>
                <span class="chat-time bidi-isolate">{{ comment.time }}</span>
              </div>
            </div>
          </div>

          <div class="chat-input-container">
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
  align-items: flex-start;
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

.type-badge-bottom {
  font-size: 0.625rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  margin-top: 0.5rem;
  display: block;
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
  gap: 1rem;
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
  border-radius: 1rem;
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
