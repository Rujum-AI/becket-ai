<script setup>
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useManagementStore } from '@/stores/management'
import { HelpCircle } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  initialType: {
    type: String,
    default: 'task'
  }
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const managementStore = useManagementStore()

const createType = ref(props.initialType)
const newItem = ref({
  name: '',
  urgency: 'mid',
  dueDate: '',
  owner: null
})

function confirmCreate() {
  if (!newItem.value.name) return

  if (createType.value === 'task') {
    managementStore.createTask(newItem.value)
  } else {
    managementStore.createAsk(newItem.value)
  }

  emit('close')
}
</script>

<template>
  <BaseModal
    :showHeader="false"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <h2 class="text-2xl font-serif font-bold text-slate-900 mb-6 text-center">{{ t('createNew') }}</h2>

    <!-- Type Toggle -->
    <div class="modal-icon-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 1rem;">
      <button
        @click="createType = 'task'"
        :class="['modal-icon-btn', { selected: createType === 'task' }]"
      >
        <div class="icon-circle">
          <img src="/assets/tasks.png" alt="Task" />
        </div>
        <span class="icon-label">{{ t('task') }}</span>
      </button>
      <button
        @click="createType = 'ask'"
        :class="['modal-icon-btn', { selected: createType === 'ask' }]"
      >
        <div class="icon-circle">
          <img src="/assets/asks.png" alt="Ask" />
        </div>
        <span class="icon-label">{{ t('ask') }}</span>
      </button>
    </div>

    <p class="type-description">
      {{ createType === 'task' ? t('taskDesc') : t('askDesc') }}
    </p>

    <!-- Form -->
    <div class="modal-form-group">
      <input
        v-model="newItem.name"
        type="text"
        :placeholder="t('namePlaceholder')"
        class="modal-form-input"
      />

      <div class="modal-form-row">
        <select v-model="newItem.urgency" class="modal-form-select">
          <option value="low">{{ t('low') }}</option>
          <option value="mid">{{ t('mid') }}</option>
          <option value="high">{{ t('high') }}</option>
          <option value="urgent">{{ t('urgent') }}</option>
        </select>

        <input
          v-model="newItem.dueDate"
          type="date"
          class="modal-form-input"
        />
      </div>

      <!-- Task Assignment -->
      <div v-if="createType === 'task'" class="assignment-section">
        <label class="assignment-label">{{ t('assignTo') }} ({{ t('optional') }})</label>
        <div class="assignment-options">
          <div
            @click="newItem.owner = newItem.owner === 'Dad' ? null : 'Dad'"
            :class="['assign-btn', { active: newItem.owner === 'Dad' }]"
          >
            <img src="/assets/profile/king_profile.png" class="assign-avatar" />
            <span class="assign-text">{{ t('me') }}</span>
          </div>
          <div
            @click="newItem.owner = newItem.owner === 'Mom' ? null : 'Mom'"
            :class="['assign-btn', { active: newItem.owner === 'Mom' }]"
          >
            <img src="/assets/profile/queen_profile.png" class="assign-avatar" />
            <span class="assign-text">{{ t('partner') }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button @click="confirmCreate" class="modal-primary-btn">
        {{ t('create') }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.type-description {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 700;
  text-align: center;
  margin-bottom: 1.5rem;
}

.assignment-section {
  margin-top: 0.5rem;
}

.assignment-label {
  display: block;
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 0.5rem;
  margin-left: 0.5rem;
}

.assignment-options {
  display: flex;
  gap: 0.5rem;
}

.assign-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 0.75rem;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.assign-btn:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.assign-btn.active {
  border-color: #1e293b;
  background: #f8fafc;
  box-shadow: 0 0 0 3px rgba(30, 41, 59, 0.1);
}

.assign-avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
}

.assign-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: #1e293b;
}

.assign-btn.active .assign-text {
  color: #1e293b;
}

.assign-btn:not(.active) .assign-text {
  color: #94a3b8;
}
</style>
