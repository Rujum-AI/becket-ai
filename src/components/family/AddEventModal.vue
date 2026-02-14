<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  initialDate: { type: String, default: '' }
})

const emit = defineEmits(['close', 'save'])

const { t } = useI18n()
const dashboardStore = useSupabaseDashboardStore()

const title = ref('')
const date = ref(props.initialDate || '')
const time = ref('')
const location = ref('')
const notes = ref('')
const type = ref('manual')
const selectedChildIds = ref([])
const saving = ref(false)
const errorMsg = ref('')

const children = computed(() => dashboardStore.children)

onMounted(() => {
  if (children.value.length > 0) {
    selectedChildIds.value = children.value.map(c => c.id)
  }
  if (!date.value) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    date.value = `${y}-${m}-${d}`
  }
})

function toggleChild(childId) {
  const idx = selectedChildIds.value.indexOf(childId)
  if (idx === -1) {
    selectedChildIds.value.push(childId)
  } else {
    selectedChildIds.value.splice(idx, 1)
  }
}

const canSave = computed(() => {
  return title.value.trim() && date.value && selectedChildIds.value.length > 0
})

async function saveEvent() {
  if (!canSave.value) return

  saving.value = true
  errorMsg.value = ''

  try {
    await dashboardStore.createEvent({
      title: title.value.trim(),
      date: date.value,
      time: time.value || null,
      endTime: null,
      location: location.value.trim() || null,
      notes: notes.value.trim() || null,
      type: type.value,
      childIds: selectedChildIds.value
    })
    emit('save')
    emit('close')
  } catch (err) {
    errorMsg.value = err.message || 'Failed to save event'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    :showHeader="false"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <h2 class="text-2xl font-serif font-bold text-slate-900 mb-6 text-center">{{ t('addEvent') }}</h2>

    <!-- Event Type -->
    <div class="modal-icon-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 1rem;">
      <button
        v-for="et in ['manual', 'school', 'activity', 'appointment']"
        :key="et"
        @click="type = et"
        :class="['modal-icon-btn', { selected: type === et }]"
      >
        <div class="icon-circle">
          <img :src="`/assets/${et === 'manual' ? 'calendar' : et === 'school' ? 'school' : et === 'activity' ? 'activities' : 'tasks'}.png`" :alt="t('eventType_' + et)" />
        </div>
        <span class="icon-label">{{ t('eventType_' + et) }}</span>
      </button>
    </div>

    <!-- Title -->
    <div class="modal-form-group">
      <input
        v-model="title"
        type="text"
        :placeholder="t('eventTitlePlaceholder')"
        class="modal-form-input"
      />
    </div>

    <!-- Date & Time -->
    <div class="modal-form-row">
      <input v-model="date" type="date" class="modal-form-input" />
      <input v-model="time" type="time" class="modal-form-input" />
    </div>

    <!-- Location -->
    <div class="modal-form-group">
      <input
        v-model="location"
        type="text"
        class="modal-form-input"
        :placeholder="t('eventLocationPlaceholder')"
      />
    </div>

    <!-- Children -->
    <div class="child-section">
      <label class="child-section-label">{{ t('eventChildren') }}</label>
      <div class="child-options">
        <div
          v-for="child in children"
          :key="child.id"
          @click="toggleChild(child.id)"
          :class="['assign-btn', { active: selectedChildIds.includes(child.id) }]"
        >
          <img
            :src="child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'"
            class="assign-avatar"
            :alt="child.name"
          />
          <span class="assign-text">{{ child.name }}</span>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div class="modal-form-group">
      <textarea
        v-model="notes"
        class="modal-form-textarea"
        rows="2"
        :placeholder="t('eventNotesPlaceholder')"
      ></textarea>
    </div>

    <!-- Error -->
    <div v-if="errorMsg" class="event-error">{{ errorMsg }}</div>

    <template #footer>
      <button class="modal-primary-btn" :disabled="!canSave || saving" @click="saveEvent">
        {{ saving ? t('saving') + '...' : t('addEvent') }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.child-section {
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
}

.child-section-label {
  display: block;
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 0.5rem;
  margin-left: 0.5rem;
}

.child-options {
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
  object-fit: cover;
}

.assign-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: #1e293b;
}

.assign-btn:not(.active) .assign-text {
  color: #94a3b8;
}

.event-error {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.625rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: center;
  margin-top: 0.5rem;
}
</style>
