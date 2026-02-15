<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useLanguageStore } from '@/stores/language'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import BaseModal from '@/components/shared/BaseModal.vue'
import { Clock, MapPin, Calendar, User, Tag, Pencil, Trash2, PackageOpen } from 'lucide-vue-next'

const props = defineProps({
  event: { type: Object, required: true }
})

const emit = defineEmits(['close', 'edit', 'delete'])

const dashboardStore = useSupabaseDashboardStore()
const showDeleteConfirm = ref(false)

const { t } = useI18n()
const langStore = useLanguageStore()
const locale = computed(() => langStore.lang === 'he' ? 'he-IL' : 'en-US')

const startDate = computed(() => new Date(props.event.start_time))
const endDate = computed(() => props.event.end_time ? new Date(props.event.end_time) : null)

const dateFormatted = computed(() => {
  return startDate.value.toLocaleDateString(locale.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const startTimeFormatted = computed(() => {
  return startDate.value.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit', hour12: false })
})

const endTimeFormatted = computed(() => {
  if (!endDate.value) return null
  return endDate.value.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit', hour12: false })
})

const typeLabel = computed(() => {
  const typeMap = {
    pickup: 'Pickup',
    dropoff: 'dropoff',
    school: 'School',
    activity: 'activity',
    friend_visit: 'friend_visit',
    appointment: 'appointment',
    manual: 'manual'
  }
  return t(typeMap[props.event.type] || props.event.type)
})

const statusLabel = computed(() => {
  return t(props.event.status || 'scheduled')
})

const statusColor = computed(() => {
  const colors = {
    scheduled: '#64748b',
    confirmed: '#16a34a',
    pending_approval: '#d97706',
    missed: '#dc2626',
    cancelled: '#9ca3af'
  }
  return colors[props.event.status] || '#64748b'
})

const headerColor = computed(() => {
  const colors = {
    pickup: 'linear-gradient(135deg, #CCFBF1 0%, #5EEAD4 100%)',
    dropoff: 'linear-gradient(135deg, #FFEDD5 0%, #FDBA74 100%)',
    school: 'linear-gradient(135deg, #DBEAFE 0%, #93C5FD 100%)',
    activity: 'linear-gradient(135deg, #F3E8FF 0%, #C084FC 100%)',
    appointment: 'linear-gradient(135deg, #FEE2E2 0%, #FCA5A5 100%)',
    friend_visit: 'linear-gradient(135deg, #FEF9C3 0%, #FDE047 100%)',
    manual: 'linear-gradient(135deg, #F1F5F9 0%, #CBD5E1 100%)'
  }
  return colors[props.event.type] || colors.manual
})

const locationName = computed(() => {
  return props.event.location_name || ''
})

const parsedDescription = computed(() => {
  return dashboardStore.parseBackpackItems(props.event.description)
})

const backpackItems = computed(() => parsedDescription.value.items)
const eventNotes = computed(() => parsedDescription.value.notes)

function confirmDelete() {
  showDeleteConfirm.value = true
}

function handleDelete() {
  emit('delete', props.event)
}
</script>

<template>
  <BaseModal
    :headerStyle="headerColor"
    :title="t(event.title || event.type)"
    maxWidth="480px"
    @close="emit('close')"
  >
    <div class="event-detail">
      <!-- Date -->
      <div class="detail-row">
        <Calendar :size="20" class="detail-icon" />
        <div class="detail-content">
          <div class="detail-label">{{ t('date') }}</div>
          <div class="detail-value">{{ dateFormatted }}</div>
        </div>
      </div>

      <!-- Time -->
      <div class="detail-row">
        <Clock :size="20" class="detail-icon" />
        <div class="detail-content">
          <div class="detail-label">{{ t('time') }}</div>
          <div class="detail-value time-value">
            <span>{{ startTimeFormatted }}</span>
            <span v-if="endTimeFormatted"> — {{ endTimeFormatted }}</span>
          </div>
        </div>
      </div>

      <!-- Type -->
      <div class="detail-row">
        <Tag :size="20" class="detail-icon" />
        <div class="detail-content">
          <div class="detail-label">{{ t('eventType') }}</div>
          <div class="detail-value">{{ typeLabel }}</div>
        </div>
      </div>

      <!-- Status -->
      <div class="detail-row">
        <div class="status-dot" :style="{ background: statusColor }"></div>
        <div class="detail-content">
          <div class="detail-label">{{ t('status') }}</div>
          <div class="detail-value" :style="{ color: statusColor }">{{ statusLabel }}</div>
        </div>
      </div>

      <!-- Location -->
      <div v-if="locationName" class="detail-row">
        <MapPin :size="20" class="detail-icon" />
        <div class="detail-content">
          <div class="detail-label">{{ t('location') }}</div>
          <div class="detail-value">{{ t(locationName) }}</div>
        </div>
      </div>

      <!-- Backpack Items -->
      <div v-if="backpackItems.length > 0" class="detail-row">
        <PackageOpen :size="20" class="detail-icon" />
        <div class="detail-content">
          <div class="detail-label">{{ t('backpack') }}</div>
          <div class="backpack-list">
            <span v-for="item in backpackItems" :key="item" class="backpack-tag">{{ item }}</span>
          </div>
        </div>
      </div>

      <!-- Description / Notes -->
      <div v-if="eventNotes" class="detail-row">
        <div class="detail-content full">
          <div class="detail-label">{{ t('description') }}</div>
          <div class="detail-value description">{{ eventNotes }}</div>
        </div>
      </div>

      <!-- Children linked to this event -->
      <div v-if="event.event_children?.length" class="detail-row">
        <User :size="20" class="detail-icon" />
        <div class="detail-content">
          <div class="detail-label">{{ t('children') }}</div>
          <div class="detail-value">
            {{ event.event_children.length }} {{ event.event_children.length === 1 ? t('child') : t('children') }}
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <!-- Delete Confirmation -->
      <div v-if="showDeleteConfirm" class="delete-confirm">
        <p class="delete-confirm-msg">{{ t('deleteEventConfirm') }}</p>
        <div class="delete-confirm-actions">
          <button class="modal-secondary-btn" @click="showDeleteConfirm = false">
            {{ t('cancel') }}
          </button>
          <button class="modal-delete-btn" @click="handleDelete">
            <Trash2 :size="16" />
            {{ t('delete') }}
          </button>
        </div>
      </div>

      <!-- Normal Footer -->
      <div v-else class="modal-action-bar">
        <button class="modal-secondary-btn" @click="emit('close')">
          {{ t('close') }}
        </button>
        <button class="modal-edit-btn" @click="emit('edit', event)">
          <Pencil :size="16" />
          {{ t('edit') }}
        </button>
        <button class="modal-delete-btn" @click="confirmDelete">
          <Trash2 :size="16" />
          {{ t('delete') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.event-detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.detail-icon {
  color: #64748b;
  margin-top: 2px;
  flex-shrink: 0;
}

.status-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}

.detail-content {
  flex: 1;
}

.detail-content.full {
  width: 100%;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.125rem;
}

.detail-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1A1C1E;
}

.time-value {
  direction: ltr;
  unicode-bidi: isolate;
}

.description {
  font-weight: 400;
  color: #475569;
  line-height: 1.5;
}

.modal-action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.modal-secondary-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 1.5rem;
  font-weight: 700;
  font-size: 0.875rem;
  background: #f1f5f9;
  color: #64748b;
  border: 2px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-secondary-btn:hover {
  background: #e2e8f0;
}

.modal-edit-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 1.25rem;
  border-radius: 1.5rem;
  font-weight: 700;
  font-size: 0.875rem;
  background: #1A1C1E;
  color: white;
  border: 2px solid #1A1C1E;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-edit-btn:hover {
  background: #334155;
  border-color: #334155;
}

.modal-delete-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 1.25rem;
  border-radius: 1.5rem;
  font-weight: 700;
  font-size: 0.875rem;
  background: white;
  color: #dc2626;
  border: 2px solid #fca5a5;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-delete-btn:hover {
  background: #fef2f2;
}

.backpack-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

.backpack-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  background: #f0fdf4;
  border: 1.5px solid #86efac;
  border-radius: 1.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #166534;
}

.delete-confirm {
  text-align: center;
}

.delete-confirm-msg {
  font-size: 0.875rem;
  font-weight: 700;
  color: #dc2626;
  margin-bottom: 0.75rem;
}

.delete-confirm-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}
</style>
