<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useTrusteesStore } from '@/stores/supabaseTrustees'
import { useSupabaseDashboardStore as useDashboardStore } from '@/stores/supabaseDashboard'
import { Plus } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  entity: {
    type: Object,
    default: null
  },
  entityType: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const trusteesStore = useTrusteesStore()
const dashboardStore = useDashboardStore()

const isEditing = computed(() => !!props.entity)
const newItemInput = ref('')
const errors = ref({})

const form = ref({
  id: null,
  name: '',
  address: '',
  contact: '',
  children: [],
  items: [],
  relationship: 'Family',
  schedule: {
    days: Array(7).fill(null).map(() => ({ active: false, start: '', end: '' })),
    repeatFreq: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  }
})

const weekDaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const hasActiveDays = computed(() => {
  return form.value.schedule.days.some(d => d.active)
})

const modalTitle = computed(() => {
  if (props.entityType === 'school') {
    return isEditing.value ? t('editSchool') : t('addSchool')
  }
  if (props.entityType === 'activity') {
    return isEditing.value ? t('editActivity') : t('addActivity')
  }
  return isEditing.value ? t('editPerson') : t('addPerson')
})

const headerBg = computed(() => {
  if (props.entityType === 'school') return '#FCD34D'
  if (props.entityType === 'activity') return '#F87171'
  return '#60A5FA'
})

const iconSrc = computed(() => {
  if (props.entityType === 'school') return '/assets/school.png'
  if (props.entityType === 'activity') return '/assets/activities.png'
  return '/assets/trustees.png'
})

const saveButtonClass = computed(() => {
  if (props.entityType === 'school') return 'bg-slate-900'
  if (props.entityType === 'activity') return 'bg-slate-900'
  return 'bg-orange-500'
})

// Initialize form with entity data if editing
watch(() => props.entity, (entity) => {
  if (entity) {
    form.value = {
      id: entity.id,
      name: entity.name || '',
      address: entity.address || '',
      contact: entity.contact || '',
      children: entity.children ? [...entity.children] : [],
      items: entity.items ? [...entity.items] : [],
      relationship: entity.relationship || 'Family',
      schedule: entity.schedule ? JSON.parse(JSON.stringify(entity.schedule)) : {
        days: Array(7).fill(null).map(() => ({ active: false, start: '', end: '' })),
        repeatFreq: 1,
        startDate: new Date().toISOString().split('T')[0],
        endDate: ''
      }
    }
  }
}, { immediate: true })

function toggleDay(idx) {
  const d = form.value.schedule.days[idx]
  d.active = !d.active
  if (d.active && !d.start && !d.end) {
    const first = form.value.schedule.days.find(x => x.active && x !== d && x.start)
    if (first) {
      d.start = first.start
      d.end = first.end
    } else {
      d.start = '08:00'
      d.end = '13:00'
    }
  }
}

function syncTimes() {
  const firstActive = form.value.schedule.days.find(d => d.active)
  if (firstActive) {
    const { start, end } = firstActive
    form.value.schedule.days.forEach(d => {
      if (d.active) {
        d.start = start
        d.end = end
      }
    })
  }
}

function toggleChild(id) {
  if (form.value.children.includes(id)) {
    form.value.children = form.value.children.filter(c => c !== id)
  } else {
    form.value.children.push(id)
  }
}

function addItem() {
  if (newItemInput.value.trim()) {
    form.value.items.push(newItemInput.value.trim())
    newItemInput.value = ''
  }
}

function removeItem(idx) {
  form.value.items.splice(idx, 1)
}

function validate() {
  const e = {}

  if (!form.value.name.trim()) e.name = t('requiredName')
  if (!form.value.address.trim()) e.address = t('requiredAddress')
  if (!form.value.contact.trim()) e.contact = t('requiredContact')

  if (props.entityType !== 'person') {
    if (form.value.children.length === 0) e.children = t('requiredChildren')

    const hasValidDay = form.value.schedule.days.some(d => d.active && d.start && d.end)
    if (!hasValidDay) e.schedule = t('requiredSchedule')
  }

  errors.value = e
  return Object.keys(e).length === 0
}

function handleSave() {
  if (!validate()) return

  const data = {
    name: form.value.name,
    address: form.value.address,
    contact: form.value.contact
  }

  if (props.entityType === 'person') {
    data.relationship = form.value.relationship
  } else {
    data.children = form.value.children
    data.schedule = form.value.schedule
    data.items = form.value.items
  }

  if (isEditing.value) {
    if (props.entityType === 'school') {
      trusteesStore.updateSchool(props.entity.id, data)
    } else if (props.entityType === 'activity') {
      trusteesStore.updateActivity(props.entity.id, data)
    } else {
      trusteesStore.updatePerson(props.entity.id, data)
    }
  } else {
    if (props.entityType === 'school') {
      trusteesStore.addSchool(data)
    } else if (props.entityType === 'activity') {
      trusteesStore.addActivity(data)
    } else {
      trusteesStore.addPerson(data)
    }
  }

  emit('close')
}

function getChildImg(child) {
  return child.gender === 'boy'
    ? '/assets/thumbnail_boy.png'
    : '/assets/thumbnail_girl.png'
}
</script>

<template>
  <BaseModal
    :headerStyle="headerBg"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <img :src="iconSrc" class="w-20 h-20 object-contain mb-4" />
      <h2 class="modal-title">{{ modalTitle }}</h2>
    </template>

        <!-- Child Toggles (for schools/activities only) -->
        <div v-if="entityType !== 'person'">
          <div class="child-toggles">
            <div
              v-for="child in dashboardStore.children"
              :key="child.id"
              @click="toggleChild(child.id)"
              class="c-tog"
              :class="{selected: form.children.includes(child.id)}"
            >
              <img :src="getChildImg(child)" class="c-img" />
              <span class="c-name">{{ child.name }}</span>
            </div>
          </div>
          <div v-if="errors.children" class="field-error">{{ errors.children }}</div>
        </div>

        <!-- Name -->
        <div>
          <label class="modal-form-label">{{ t('nameLabel') }}</label>
          <input
            v-model="form.name"
            type="text"
            :class="['modal-form-input', { 'input-error': errors.name }]"
            :placeholder="entityType === 'school' ? 'e.g. Rainbow Kindergarten' : entityType === 'activity' ? 'e.g. Judo Class' : 'e.g. Grandma Ruth'"
          />
          <div v-if="errors.name" class="field-error">{{ errors.name }}</div>
        </div>

        <!-- Schedule Builder (for schools/activities only) -->
        <div v-if="entityType !== 'person'" :class="['bg-white border rounded-2xl p-4 shadow-sm', errors.schedule ? 'border-red-300' : 'border-slate-200']">
          <label class="modal-form-label mb-3 text-center">{{ t('scheduleLabel') }}</label>

          <div class="day-toggle-row">
            <div
              v-for="(day, idx) in weekDaysShort"
              :key="idx"
              class="day-bubble"
              :class="{active: form.schedule.days[idx].active}"
              @click="toggleDay(idx)"
            >
              {{ day.charAt(0) }}
            </div>
          </div>

          <div v-if="hasActiveDays">
            <div class="flex justify-between items-center mb-2 px-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase">{{ t('setTimes') }}</span>
              <span @click="syncTimes" class="copy-all-btn">{{ t('syncTimes') }}</span>
            </div>

            <div class="flex flex-col gap-1">
              <div v-for="(day, idx) in form.schedule.days" :key="idx">
                <transition name="pop">
                  <div v-if="day.active" class="time-row-edit">
                    <span class="time-row-label">{{ weekDaysShort[idx] }}</span>
                    <input type="time" v-model="day.start" class="compact-time" />
                    <span class="text-slate-300 font-bold">-</span>
                    <input type="time" v-model="day.end" class="compact-time" />
                  </div>
                </transition>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-4 text-slate-400 text-xs italic">
            {{ t('selectDaysMsg') }}
          </div>

          <div class="mt-4 pt-4 border-t border-dashed border-slate-200 grid grid-cols-2 gap-4">
            <div>
              <label class="modal-form-label">{{ t('frequency') }}</label>
              <div class="flex items-center gap-2">
                <input type="number" v-model="form.schedule.repeatFreq" min="1" class="modal-form-input text-center h-10 py-1" />
                <span class="text-xs font-bold text-slate-400">{{ t('weeks') }}</span>
              </div>
            </div>
            <div>
              <label class="modal-form-label">{{ t('untilDate') }}</label>
              <input type="date" v-model="form.schedule.endDate" class="modal-form-input h-10 py-1 text-xs" />
            </div>
          </div>
        </div>
        <div v-if="errors.schedule" class="field-error">{{ errors.schedule }}</div>

        <!-- Relationship (for trustees only) -->
        <div v-if="entityType === 'person'">
          <label class="modal-form-label">{{ t('relationLabel') }}</label>
          <select v-model="form.relationship" class="modal-form-select">
            <option value="Family">{{ t('Family') }}</option>
            <option value="Friend">{{ t('Friend') }}</option>
            <option value="Babysitter">{{ t('Babysitter') }}</option>
          </select>
        </div>

        <!-- Address and Contact -->
        <div class="grid grid-cols-1 gap-4" :class="entityType !== 'person' ? 'md:grid-cols-2' : ''">
          <div>
            <label class="modal-form-label">{{ t('addressLabel') }}</label>
            <input v-model="form.address" type="text" :class="['modal-form-input', { 'input-error': errors.address }]" />
            <div v-if="errors.address" class="field-error">{{ errors.address }}</div>
          </div>
          <div>
            <label class="modal-form-label">{{ t('contactLabel') }}</label>
            <input v-model="form.contact" type="tel" :class="['modal-form-input', { 'input-error': errors.contact }]" />
            <div v-if="errors.contact" class="field-error">{{ errors.contact }}</div>
          </div>
        </div>

        <!-- Backpack (for schools/activities only) -->
        <div v-if="entityType !== 'person'">
          <div class="backpack-label">
            <img src="/assets/backpack.png" class="backpack-icon" />
            <label class="modal-form-label mb-0">{{ t('itemsLabel') }}</label>
          </div>
          <div class="flex gap-2 mb-3">
            <input
              v-model="newItemInput"
              @keyup.enter="addItem"
              type="text"
              :placeholder="t('addItemPlace')"
              class="modal-form-input"
            />
            <button @click="addItem" class="w-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform">
              <Plus class="w-5 h-5" />
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <div v-for="(tag, idx) in form.items" :key="idx" class="item-pill border-slate-200">
              {{ tag }}
              <span @click="removeItem(idx)" class="ms-1 cursor-pointer text-slate-400 hover:text-red-500 font-black">×</span>
            </div>
          </div>
        </div>

    <template #footer>
      <div class="modal-action-bar">
        <button @click="$emit('close')" class="modal-secondary-btn">
          {{ t('discard') }}
        </button>
        <button @click="handleSave" class="modal-primary-btn" :style="entityType === 'person' ? { background: '#fb923c' } : {}">
          {{ t('save') }}
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
  margin-bottom: 1rem;
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
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
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

.modal-action-bar {
  display: flex;
  gap: 1rem;
}

/* Schedule UI */
.day-toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: 0.5rem;
  border-radius: 99px;
  margin-bottom: 1rem;
}

.day-bubble {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 800;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.day-bubble:hover {
  background: #f1f5f9;
}

.day-bubble.active {
  background: #0f172a;
  color: white;
  box-shadow: 0 4px 6px rgba(15, 23, 42, 0.2);
}

.time-row-edit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  background: #f8fafc;
  border-radius: 0.8rem;
  margin-bottom: 0.5rem;
  border: 1px solid #f1f5f9;
}

.time-row-label {
  width: 30px;
  font-weight: 800;
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
}

.compact-time {
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.3rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #1e293b;
  text-align: center;
  width: 85px;
  outline: none;
}

.compact-time:focus {
  border-color: #0f172a;
}

.copy-all-btn {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #0d9488;
  cursor: pointer;
  text-decoration: underline;
  margin-inline-start: auto;
}

.item-pill {
  font-size: 0.65rem;
  font-weight: 700;
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

/* Backpack label */
.backpack-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.backpack-icon {
  width: 1.5rem;
  height: 1.5rem;
  object-fit: contain;
}

.mb-0 {
  margin-bottom: 0 !important;
}

/* Validation */
.field-error {
  font-size: 0.7rem;
  font-weight: 700;
  color: #ef4444;
  margin-top: 0.25rem;
  padding-inline-start: 0.25rem;
}

.input-error {
  border-color: #fca5a5 !important;
  background: #fef2f2 !important;
}
</style>
