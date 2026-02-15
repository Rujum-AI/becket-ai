<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useManagementStore } from '@/stores/supabaseManagement'
import { useSupabaseDashboardStore as useDashboardStore } from '@/stores/supabaseDashboard'
import { useAuth } from '@/composables/useAuth'
import { AlertTriangle } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  initialType: {
    type: String,
    default: 'task'
  },
  prefilledDate: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const managementStore = useManagementStore()
const dashboardStore = useDashboardStore()
const { user } = useAuth()

const createType = ref(props.initialType)
const showCoParentWarning = ref(false)

// Task/Ask form
const newItem = ref({
  name: '',
  description: '',
  urgency: 'mid',
  dueDate: props.prefilledDate || '',
  owner_id: null,
  child_id: null
})

// Switch-days form
const switchForm = ref({
  switchFromDate: props.prefilledDate || '',
  switchToDate: '',
  reason: '',
  urgency: 'mid'
})

// Header color per type
const headerColor = computed(() => {
  if (createType.value === 'task') return '#60A5FA'
  if (createType.value === 'ask') return '#34D399'
  return '#F59E0B'
})

// Type descriptions
const typeDesc = computed(() => {
  if (createType.value === 'task') return t('taskDesc')
  if (createType.value === 'ask') return t('askDesc')
  return t('switchDaysDesc')
})

function getChildImg(child) {
  return child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'
}

function toggleChild(childId) {
  newItem.value.child_id = newItem.value.child_id === childId ? null : childId
}

// Co-parent day warning: watch due date
watch(() => newItem.value.dueDate, (val) => {
  if (!val || createType.value === 'switch') return
  const expected = dashboardStore.getExpectedParent(val)
  if (expected && expected !== dashboardStore.parentLabel) {
    showCoParentWarning.value = true
    if (createType.value === 'task') {
      createType.value = 'ask'
    }
  } else {
    showCoParentWarning.value = false
  }
})

watch(createType, () => {
  showCoParentWarning.value = false
})

function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

const coParentName = computed(() => {
  if (dashboardStore.partnerLabel === 'dad') return t('dad')
  if (dashboardStore.partnerLabel === 'mom') return t('mom')
  return t('partner')
})

function confirmCreate() {
  if (createType.value === 'switch') {
    if (!switchForm.value.switchFromDate) return
    managementStore.createSwitchDaysAsk(switchForm.value)
  } else if (createType.value === 'task') {
    if (!newItem.value.name) return
    managementStore.createTask(newItem.value)
  } else {
    if (!newItem.value.name) return
    managementStore.createAsk(newItem.value)
  }
  emit('close')
}
</script>

<template>
  <BaseModal
    :headerStyle="headerColor"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <h2 class="modal-title">{{ t('createNew') }}</h2>
    </template>

    <!-- 1. TYPE TOGGLE -->
    <div class="type-grid">
      <div
        @click="createType = 'task'"
        :class="['type-tog', { selected: createType === 'task' }]"
      >
        <img src="/assets/tasks.png" alt="Task" class="type-img" style="--ring: #60A5FA" />
        <span class="type-label">{{ t('task') }}</span>
      </div>
      <div
        @click="createType = 'ask'"
        :class="['type-tog', { selected: createType === 'ask' }]"
      >
        <img src="/assets/asks.png" alt="Ask" class="type-img" style="--ring: #34D399" />
        <span class="type-label">{{ t('ask') }}</span>
      </div>
      <div
        @click="createType = 'switch'"
        :class="['type-tog', { selected: createType === 'switch' }]"
      >
        <img src="/assets/calendar.png" alt="Switch" class="type-img" style="--ring: #F59E0B" />
        <span class="type-label">{{ t('switchDays') }}</span>
      </div>
    </div>
    <p class="type-description">{{ typeDesc }}</p>

    <!-- 2. CHILD TOGGLES (hidden for switch-days) -->
    <div v-if="createType !== 'switch' && dashboardStore.children.length > 0" class="child-section">
      <label class="field-label center">{{ t('regardingChild') }}</label>
      <div class="child-row">
        <div
          v-for="child in dashboardStore.children"
          :key="child.id"
          @click="toggleChild(child.id)"
          class="c-tog"
          :class="{ selected: newItem.child_id === child.id }"
        >
          <img :src="getChildImg(child)" class="c-img" />
          <span class="c-name">{{ child.name }}</span>
        </div>
      </div>
    </div>

    <!-- 3. DETAILS SECTION -->
    <div class="form-section">
      <!-- TASK / ASK form -->
      <template v-if="createType !== 'switch'">
        <input
          v-model="newItem.name"
          type="text"
          :placeholder="t('namePlaceholder')"
          class="modal-form-input"
        />
        <textarea
          v-model="newItem.description"
          :placeholder="t('descriptionPlaceholder')"
          class="modal-form-input"
          rows="2"
          style="resize: none"
        ></textarea>
        <div class="form-row">
          <div class="form-col">
            <label class="field-label">{{ t('urgency') }}</label>
            <select v-model="newItem.urgency" class="modal-form-select">
              <option value="low">{{ t('low') }}</option>
              <option value="mid">{{ t('mid') }}</option>
              <option value="high">{{ t('high') }}</option>
              <option value="urgent">{{ t('urgent') }}</option>
            </select>
          </div>
          <div class="form-col">
            <label class="field-label">{{ t('dueDate') }}</label>
            <input
              v-model="newItem.dueDate"
              type="date"
              class="modal-form-input"
            />
          </div>
        </div>
      </template>

      <!-- SWITCH DAYS form -->
      <template v-else>
        <label class="field-label">{{ t('switchFromDate') }}</label>
        <input
          v-model="switchForm.switchFromDate"
          type="date"
          class="modal-form-input"
        />
        <label class="field-label">{{ t('switchToDateOptional') }}</label>
        <input
          v-model="switchForm.switchToDate"
          type="date"
          class="modal-form-input"
        />
        <textarea
          v-model="switchForm.reason"
          :placeholder="t('reasonPlaceholder')"
          class="modal-form-input"
          rows="2"
          style="resize: none"
        ></textarea>
        <label class="field-label">{{ t('urgency') }}</label>
        <select v-model="switchForm.urgency" class="modal-form-select">
          <option value="low">{{ t('low') }}</option>
          <option value="mid">{{ t('mid') }}</option>
          <option value="high">{{ t('high') }}</option>
          <option value="urgent">{{ t('urgent') }}</option>
        </select>
      </template>
    </div>

    <!-- 4. ASSIGNMENT (task only) -->
    <div v-if="createType === 'task'" class="assignment-section">
      <label class="field-label">{{ t('assignTo') }} ({{ t('optional') }})</label>
      <div class="assignment-options">
        <div
          @click="newItem.owner_id = newItem.owner_id === user?.id ? null : user?.id"
          :class="['assign-btn', { active: newItem.owner_id === user?.id }]"
        >
          <img src="/assets/profile/king_profile.png" class="assign-avatar" />
          <span class="assign-text">{{ t('me') }}</span>
        </div>
        <div
          v-if="dashboardStore.partnerId"
          @click="newItem.owner_id = newItem.owner_id === dashboardStore.partnerId ? null : dashboardStore.partnerId"
          :class="['assign-btn', { active: newItem.owner_id === dashboardStore.partnerId }]"
        >
          <img src="/assets/profile/queen_profile.png" class="assign-avatar" />
          <span class="assign-text">{{ t('partner') }}</span>
        </div>
      </div>
    </div>

    <!-- 5. CO-PARENT DAY WARNING -->
    <div v-if="showCoParentWarning" class="warning-banner">
      <AlertTriangle :size="18" />
      <span>{{ t('coParentDayWarning').replace('{name}', coParentName) }}</span>
    </div>

    <!-- 6. SWITCH PREVIEW -->
    <div v-if="createType === 'switch' && switchForm.switchFromDate" class="switch-preview">
      <h4 class="preview-title">{{ t('switchPreview') }}</h4>
      <div class="preview-row">
        <span class="preview-label you">{{ t('youGet') }}</span>
        <span class="preview-date">{{ formatDateLabel(switchForm.switchFromDate) }}</span>
      </div>
      <div v-if="switchForm.switchToDate" class="preview-row">
        <span class="preview-label they">{{ t('theyGet') }}</span>
        <span class="preview-date">{{ formatDateLabel(switchForm.switchToDate) }}</span>
      </div>
    </div>

    <template #footer>
      <div class="modal-action-bar">
        <button class="modal-secondary-btn" @click="$emit('close')">
          {{ t('cancel') }}
        </button>
        <button class="modal-primary-btn" :style="{ background: headerColor }" @click="confirmCreate">
          {{ t('create') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.type-grid {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 0.5rem;
}

.type-tog {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.45;
  filter: grayscale(100%);
}

.type-tog:hover {
  opacity: 0.7;
}

.type-tog.selected {
  opacity: 1;
  filter: grayscale(0);
}

.type-img {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  border: 3px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  object-fit: cover;
  background: white;
  margin-bottom: 0.5rem;
  transition: all 0.2s;
}

.type-tog.selected .type-img {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 25%, transparent), 0 4px 12px rgba(0, 0, 0, 0.1);
}

.type-label {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #1e293b;
}

.type-description {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 700;
  text-align: center;
  margin-bottom: 1.5rem;
}

.child-section {
  margin-bottom: 1.5rem;
}

.child-row {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 0.75rem;
}

.c-tog {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.5;
  filter: grayscale(100%);
  transform: scale(0.95);
}

.c-tog.selected {
  opacity: 1;
  filter: grayscale(0);
  transform: scale(1.1);
}

.c-img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  object-fit: cover;
  margin-bottom: 0.4rem;
}

.c-tog.selected .c-img {
  border-color: #0f172a;
}

.c-name {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #64748b;
}

.form-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field-label {
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.field-label.center {
  text-align: center;
  display: block;
}

.form-col {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.assignment-section {
  margin-bottom: 1rem;
}

.assignment-options {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
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
  color: #94a3b8;
}

.assign-btn.active .assign-text {
  color: #1e293b;
}

.warning-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: #fffbeb;
  border: 2px solid #fbbf24;
  border-radius: 0.75rem;
  color: #92400e;
  font-size: 0.8125rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.switch-preview {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 1rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.preview-title {
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
</style>
