<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { useTrusteesStore } from '@/stores/supabaseTrustees'
import { Plus } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'
import { SECTION_COLORS } from '@/lib/modalColors'

const props = defineProps({
  initialDate: { type: String, default: '' },
  editEvent: { type: Object, default: null }
})

const emit = defineEmits(['close', 'save'])

const { t } = useI18n()
const dashboardStore = useSupabaseDashboardStore()
const trusteesStore = useTrusteesStore()

const saving = ref(false)

// Form data
const form = ref({
  id: null,
  title: '',
  date: props.initialDate || '',
  time: '',
  endTime: '',
  location: '',
  notes: '',
  type: 'manual',
  childIds: [],
  schoolId: null,
  activityId: null,
  personId: null,
  rrule: null,
  backpackItems: [],
  saveForLater: false,
  recurring: false,
  recurringFreq: 'weekly'
})

const selectedPresetId = ref(null)
const newBackpackItem = ref('')

// Load trustees on mount
onMounted(() => {
  trusteesStore.loadAll()
})

// Pre-fill when editing
if (props.editEvent) {
  const ev = props.editEvent
  const parsed = dashboardStore.parseBackpackItems(ev.description)
  const startDate = new Date(ev.start_time)
  const endDate = ev.end_time ? new Date(ev.end_time) : null

  form.value = {
    id: ev.id,
    title: ev.title || '',
    date: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
    time: ev.all_day ? '' : `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
    endTime: endDate ? `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}` : '',
    location: ev.location_name || '',
    notes: parsed.notes,
    type: ev.type || 'manual',
    childIds: ev.event_children?.map(ec => ec.child_id) || [],
    schoolId: ev.school_id || null,
    activityId: ev.activity_id || null,
    personId: ev.person_id || null,
    rrule: ev.recurrence_rule || null,
    backpackItems: parsed.items,
    saveForLater: false,
    recurring: !!ev.recurrence_rule,
    recurringFreq: ev.recurrence_rule || 'weekly'
  }
}

// Existing trustees filtered by current category
const existingForCategory = computed(() => {
  switch (form.value.type) {
    case 'school':
      return trusteesStore.schools.map(s => ({ ...s, templateType: 'school' }))
    case 'activity':
      return trusteesStore.activities.map(a => ({ ...a, templateType: 'activity' }))
    case 'appointment':
      return trusteesStore.people.map(p => ({ ...p, templateType: 'person' }))
    case 'friend_visit':
      return trusteesStore.people.map(p => ({ ...p, templateType: 'person' }))
    default:
      return []
  }
})

// Header label for saved presets
const presetsLabel = computed(() => {
  switch (form.value.type) {
    case 'school': return t('savedSchools')
    case 'activity': return t('savedActivities')
    case 'appointment':
    case 'friend_visit': return t('savedPeople')
    default: return ''
  }
})

// Icon for preset items based on category
const presetIcon = computed(() => {
  switch (form.value.type) {
    case 'school': return '/assets/school.png'
    case 'activity': return '/assets/activities.png'
    case 'appointment':
    case 'friend_visit': return '/assets/healthcare.png'
    default: return '/assets/calendar.png'
  }
})

// Dynamic placeholder based on category
const titlePlaceholder = computed(() => {
  switch (form.value.type) {
    case 'school': return t('newSchoolPlaceholder')
    case 'activity': return t('newActivityPlaceholder')
    case 'appointment': return t('newAppointmentPlaceholder')
    default: return t('eventTitlePlaceholder')
  }
})

// When picking a preset tag
function selectPreset(item) {
  selectedPresetId.value = item.id
  form.value.title = item.name
  form.value.location = item.address || ''

  if (item.templateType === 'school') {
    form.value.schoolId = item.id
    form.value.activityId = null
    form.value.personId = null
  } else if (item.templateType === 'activity') {
    form.value.activityId = item.id
    form.value.schoolId = null
    form.value.personId = null
  } else {
    form.value.personId = item.id
    form.value.schoolId = null
    form.value.activityId = null
  }

  // Auto-fill children from trustee
  if (item.children && item.children.length > 0) {
    form.value.childIds = [...item.children]
  }

  // Auto-fill backpack items
  if (item.items && item.items.length > 0) {
    form.value.backpackItems = [...item.items]
  }

  // Smart time auto-fill from schedule
  if (item.schedule && item.schedule.days && form.value.date) {
    const d = new Date(form.value.date + 'T00:00:00')
    const dow = d.getDay()
    const daySchedule = item.schedule.days[dow]
    if (daySchedule && daySchedule.active) {
      form.value.time = daySchedule.start || ''
      form.value.endTime = daySchedule.end || ''
    }
  }
}

// Reset trustee link + preset selection when category changes
watch(() => form.value.type, () => {
  form.value.schoolId = null
  form.value.activityId = null
  form.value.personId = null
  selectedPresetId.value = null
})

// Smart time auto-fill: if school day, start after school ends
watch(() => form.value.date, (newDate) => {
  if (!newDate || form.value.time) return
  autoFillTimeFromSchool(newDate)
}, { immediate: true })

function autoFillTimeFromSchool(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()

  for (const school of trusteesStore.schools) {
    if (school.schedule && school.schedule.days) {
      const daySchedule = school.schedule.days[dow]
      if (daySchedule && daySchedule.active && daySchedule.end) {
        form.value.time = daySchedule.end
        return
      }
    }
  }
}

// Category types
const categories = [
  { id: 'manual', icon: '/assets/calendar.png', label: 'eventType_manual' },
  { id: 'school', icon: '/assets/school.png', label: 'eventType_school' },
  { id: 'activity', icon: '/assets/activities.png', label: 'eventType_activity' },
  { id: 'appointment', icon: '/assets/healthcare.png', label: 'eventType_appointment' }
]

function getChildImg(child) {
  return child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'
}

function toggleChild(id) {
  if (form.value.childIds.includes(id)) {
    form.value.childIds = form.value.childIds.filter(c => c !== id)
  } else {
    form.value.childIds.push(id)
  }
}

function addBackpackItem() {
  if (newBackpackItem.value.trim()) {
    form.value.backpackItems.push(newBackpackItem.value.trim())
    newBackpackItem.value = ''
  }
}

function removeBackpackItem(idx) {
  form.value.backpackItems.splice(idx, 1)
}

// Co-parent day warning
const isCoParentDay = computed(() => {
  if (!form.value.date || !dashboardStore.partnerId) return false
  const raw = dashboardStore.getExpectedParent(form.value.date)
  const label = dashboardStore.resolveCustodyLabel(raw)
  return label && label !== dashboardStore.parentLabel && label !== 'split'
})

// Display date nicely
const displayDate = computed(() => {
  if (!form.value.date) return ''
  const d = new Date(form.value.date + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
})

const isEditing = computed(() => !!props.editEvent)
const hasPreset = computed(() => !!selectedPresetId.value)

async function handleSave() {
  if (!form.value.title.trim()) return
  saving.value = true

  try {
    let rrule = null
    if (form.value.recurring) {
      rrule = form.value.recurringFreq
    }

    const eventData = {
      title: form.value.title,
      date: form.value.date,
      time: form.value.time,
      endTime: form.value.endTime,
      location: form.value.location,
      notes: form.value.notes,
      type: form.value.type,
      childIds: form.value.childIds,
      schoolId: form.value.schoolId,
      activityId: form.value.activityId,
      personId: form.value.personId,
      rrule,
      backpackItems: form.value.backpackItems
    }

    if (form.value.id) {
      await dashboardStore.updateEvent(form.value.id, eventData)
    } else {
      await dashboardStore.createEvent(eventData)
    }

    // Save as template if checked
    if (form.value.saveForLater && !form.value.id) {
      try {
        if (form.value.type === 'school') {
          await trusteesStore.addSchool({
            name: form.value.title,
            address: form.value.location,
            children: form.value.childIds,
            items: form.value.backpackItems
          })
        } else if (form.value.type === 'activity') {
          await trusteesStore.addActivity({
            name: form.value.title,
            address: form.value.location,
            children: form.value.childIds,
            items: form.value.backpackItems
          })
        } else {
          await trusteesStore.addPerson({
            name: form.value.title,
            address: form.value.location
          })
        }
      } catch (err) {
        console.error('Error saving template:', err)
      }
    }

    emit('save')
    emit('close')
  } catch (err) {
    console.error('Error saving event:', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    :headerStyle="SECTION_COLORS.family"
    :title="isEditing ? t('editEvent') : t('addEvent')"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <img src="/assets/calendar.png" class="w-16 h-16 object-contain mb-2" />
      <h2 class="modal-title">{{ isEditing ? t('editEvent') : t('addEvent') }}</h2>
    </template>

    <!-- 1. Children -->
    <div v-if="dashboardStore.children.length > 0" class="child-toggles">
      <div
        v-for="child in dashboardStore.children"
        :key="child.id"
        @click="toggleChild(child.id)"
        class="c-tog"
        :class="{ selected: form.childIds.includes(child.id) }"
      >
        <img :src="getChildImg(child)" class="c-img" />
        <span class="c-name">{{ child.name }}</span>
      </div>
    </div>

    <!-- 2. Category -->
    <div>
      <label class="modal-form-label">{{ t('category') }}</label>
      <div class="modal-icon-grid grid-4">
        <button
          v-for="cat in categories"
          :key="cat.id"
          @click="form.type = cat.id"
          :class="['modal-icon-btn', { selected: form.type === cat.id }]"
        >
          <div class="icon-circle">
            <img :src="cat.icon" />
          </div>
          <span class="icon-label">{{ t(cat.label) }}</span>
        </button>
      </div>

      <!-- Saved presets (horizontal scroll) -->
      <div v-if="existingForCategory.length > 0" class="presets-section">
        <label class="modal-form-label">{{ presetsLabel }}</label>
        <div class="presets-track">
          <button
            v-for="item in existingForCategory"
            :key="item.id"
            :class="['modal-icon-btn', { selected: selectedPresetId === item.id }]"
            @click="selectPreset(item)"
          >
            <div class="icon-circle">
              <img :src="presetIcon" />
            </div>
            <span class="icon-label">{{ item.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 3. Title (hidden when preset selected) -->
    <div v-if="!hasPreset">
      <label class="modal-form-label">{{ t('eventTitle') }}</label>
      <input
        v-model="form.title"
        type="text"
        class="modal-form-input"
        :placeholder="titlePlaceholder"
      />
    </div>

    <!-- 4. Date & Time -->
    <div v-if="!hasPreset">
      <label class="modal-form-label">{{ t('date') }}</label>
      <div class="date-display">{{ displayDate }}</div>
    </div>

    <div class="modal-form-row">
      <div>
        <label class="modal-form-label">{{ t('eventTime') }}</label>
        <input type="time" v-model="form.time" class="modal-form-input" />
      </div>
      <div>
        <label class="modal-form-label">{{ t('eventEndTime') }}</label>
        <input type="time" v-model="form.endTime" class="modal-form-input" />
      </div>
    </div>

    <!-- 5. Location (hidden when preset selected) -->
    <div v-if="!hasPreset">
      <label class="modal-form-label">{{ t('eventLocation') }}</label>
      <input
        v-model="form.location"
        type="text"
        class="modal-form-input"
        :placeholder="t('eventLocationPlaceholder')"
      />
    </div>

    <!-- 6. Backpack -->
    <div class="backpack-section">
      <div class="backpack-header">
        <img src="/assets/backpack.png" class="backpack-icon" />
        <label class="modal-form-label mb-0">{{ t('backpack') }}</label>
      </div>
      <div v-if="form.backpackItems.length > 0" class="backpack-tags">
        <div v-for="(item, idx) in form.backpackItems" :key="idx" class="tag-pill">
          {{ item }}
          <span class="tag-remove" @click="removeBackpackItem(idx)">&times;</span>
        </div>
      </div>
      <div class="backpack-add">
        <input
          v-model="newBackpackItem"
          @keyup.enter="addBackpackItem"
          type="text"
          class="modal-form-input"
          :placeholder="t('addCustom')"
        />
        <button @click="addBackpackItem" class="add-item-btn">
          <Plus :size="18" />
        </button>
      </div>
    </div>

    <!-- 7. Recurring (hidden when preset selected) -->
    <div v-if="!hasPreset" class="toggle-row">
      <label class="toggle-label">{{ t('recurringEvent') }}</label>
      <label class="switch">
        <input type="checkbox" v-model="form.recurring" />
        <span class="slider"></span>
      </label>
    </div>
    <div v-if="!hasPreset && form.recurring" class="freq-pills">
      <button
        v-for="freq in ['weekly', 'biweekly']"
        :key="freq"
        :class="['modal-pill-btn', { selected: form.recurringFreq === freq }]"
        @click="form.recurringFreq = freq"
      >
        {{ t(freq) }}
      </button>
    </div>

    <!-- 8. Save for later (hidden when preset selected) -->
    <div v-if="!isEditing && !hasPreset" class="toggle-row">
      <label class="toggle-label">{{ t('saveAsTemplate') }}</label>
      <label class="switch">
        <input type="checkbox" v-model="form.saveForLater" />
        <span class="slider"></span>
      </label>
    </div>

    <!-- 9. Notes -->
    <div>
      <label class="modal-form-label">{{ t('eventNotes') }}</label>
      <textarea
        v-model="form.notes"
        class="modal-form-textarea"
        :placeholder="t('eventNotesPlaceholder')"
        rows="2"
      ></textarea>
    </div>

    <!-- Co-parent warning -->
    <div v-if="isCoParentDay" class="approval-banner">
      {{ t('needsApproval') }}
    </div>

    <template #footer>
      <div class="modal-action-bar">
        <button @click="$emit('close')" class="modal-secondary-btn">
          {{ t('discard') }}
        </button>
        <button
          @click="handleSave"
          class="modal-primary-btn"
          :disabled="saving || !form.title.trim()"
        >
          {{ saving ? t('saving') : isEditing ? t('saveChanges') : t('confirm') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
/* Child Toggles */
.child-toggles {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 0.5rem;
}

.c-tog {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  opacity: 0.5;
  filter: grayscale(100%);
  transition: all 0.2s;
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
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 0.4rem;
}

.c-tog.selected .c-img {
  border-color: #0f172a;
}

.c-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
}

/* 4 column icon grid */
.grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

/* Saved presets section */
.presets-section {
  margin-top: 1rem;
}

.presets-track {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 0.5rem 0;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.presets-track::-webkit-scrollbar {
  display: none;
}

/* Date display */
.date-display {
  padding: 0.7rem 1rem;
  background: #f1f5f9;
  border-radius: 1rem;
  font-weight: 800;
  font-size: 0.9rem;
  color: #1e293b;
  text-align: center;
}

/* Backpack section */
.backpack-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 1.25rem;
  padding: 1rem;
}

.backpack-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.backpack-icon {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.mb-0 {
  margin-bottom: 0 !important;
}

.backpack-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
  background: #f0fdf4;
  border: 1.5px solid #86efac;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #166534;
}

.tag-remove {
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  color: #86efac;
  margin-inline-start: 0.25rem;
  font-weight: 900;
}

.tag-remove:hover {
  color: #ef4444;
}

.backpack-add {
  display: flex;
  gap: 0.5rem;
}

.backpack-add .modal-form-input {
  flex: 1;
}

.add-item-btn {
  width: 2.75rem;
  height: auto;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.add-item-btn:hover {
  background: #1e293b;
}

.add-item-btn:active {
  transform: scale(0.95);
}

/* Toggle row */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.toggle-label {
  font-size: 0.8rem;
  font-weight: 800;
  color: #475569;
}

/* iOS-style switch */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #cbd5e1;
  border-radius: 9999px;
  transition: 0.3s;
}

.slider::before {
  content: "";
  position: absolute;
  height: 18px;
  width: 18px;
  inset-inline-start: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.switch input:checked + .slider {
  background: #0f172a;
}

.switch input:checked + .slider::before {
  transform: translateX(20px);
}

[dir="rtl"] .switch input:checked + .slider::before {
  transform: translateX(-20px);
}

/* Frequency pills */
.freq-pills {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

/* Approval banner */
.approval-banner {
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fffbeb;
  border: 1.5px solid #fbbf24;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #92400e;
  text-align: center;
}

/* Action bar */
.modal-action-bar {
  display: flex;
  gap: 1rem;
}
</style>
