<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore as useDashboardStore } from '@/stores/supabaseDashboard'

const props = defineProps({
  cycleDays: {
    type: Array,
    required: true
  },
  cycleLength: {
    type: Number,
    required: true
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  defaultHandoffTime: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['setCycle', 'dayClick', 'update:defaultHandoffTime'])

const { t } = useI18n()
const dashboardStore = useDashboardStore()

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Resolve allocation parent field to a label ('dad'/'mom') for styling
// Supports both old format (parent='dad') and new format (parent=profile_id)
function resolveParentLabel(parentVal) {
  if (parentVal === 'dad' || parentVal === 'mom') return parentVal
  // Profile_id → label
  if (parentVal === dashboardStore.userId) return dashboardStore.parentLabel
  if (parentVal === dashboardStore.partnerId) return dashboardStore.partnerLabel
  return null
}

function getDayClass(day) {
  if (!day.allocation || day.allocation.length === 0) return ''

  const labels = day.allocation.map(a => resolveParentLabel(a.parent))
  const allSame = labels.every(l => l === labels[0])

  if (allSame && labels.length === dashboardStore.children.length) {
    return labels[0] === 'dad' ? 'bg-dad filled' : 'bg-mom filled'
  }
  if (day.allocation.length > 0) return 'bg-split filled'
  return ''
}

function isDayFilled(day) {
  return day.allocation && day.allocation.length > 0
}

// Returns the dominant parent label for the day ('dad', 'mom', or 'split')
function getDayDominantLabel(day) {
  if (!day.allocation || day.allocation.length === 0) return null
  const labels = day.allocation.map(a => resolveParentLabel(a.parent))
  const allSame = labels.every(l => l === labels[0])
  if (allSame && labels.length === dashboardStore.children.length) return labels[0]
  return 'split'
}

function handleDayClick(index) {
  if (props.isEditing) {
    emit('dayClick', index)
  }
}
</script>

<template>
  <div class="bg-slate-50 rounded-[2.5rem] p-6 border border-slate-100 shadow-sm mb-6 transition-colors" :class="{ 'ring-2 ring-slate-800 ring-offset-2': isEditing }">
    <div class="flex justify-between items-center mb-6 px-2">
      <span class="text-xs font-black text-slate-400 uppercase tracking-widest">
        {{ t('custodyCycle') }}
        <span v-if="isEditing" class="text-red-500 animate-pulse ms-2">● {{ t('editing') }}</span>
      </span>
      <div class="flex bg-white p-1 rounded-full border border-slate-200 shadow-sm">
        <button
          @click="$emit('setCycle', 7)"
          :class="cycleLength === 7 ? 'bg-slate-800 text-white' : 'text-slate-400'"
          class="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-colors"
          :disabled="!isEditing"
        >
          {{ t('1week') }}
        </button>
        <button
          @click="$emit('setCycle', 14)"
          :class="cycleLength === 14 ? 'bg-slate-800 text-white' : 'text-slate-400'"
          class="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-colors"
          :disabled="!isEditing"
        >
          {{ t('2weeks') }}
        </button>
      </div>
    </div>

    <div class="cycle-grid">
      <div v-for="d in 7" :key="`header-${d}`" class="day-header">{{ t(weekDays[d - 1]) }}</div>
      <div
        v-for="(day, index) in cycleDays"
        :key="index"
        @click="handleDayClick(index)"
        class="cycle-cell"
        :class="[getDayClass(day), { 'cursor-pointer hover:border-slate-400': isEditing, 'cursor-default opacity-90': !isEditing }]"
      >
        <span class="cell-label bidi-isolate">{{ index + 1 }}</span>
        <div class="cell-content">
          <div v-if="!isDayFilled(day)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
          <div v-else-if="getDayDominantLabel(day) === 'dad'" class="mini-icon-wrapper">
            <img src="/assets/profile/king_profile.png" class="mini-icon rounded-full">
          </div>
          <div v-else-if="getDayDominantLabel(day) === 'mom'" class="mini-icon-wrapper">
            <img src="/assets/profile/queen_profile.png" class="mini-icon rounded-full">
          </div>
          <div v-else class="split-icons">
            <div v-for="alloc in day.allocation" :key="`${day.index}-${alloc.childId}`" class="mini-split-avatar">
              <img :src="alloc.childGender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'">
              <div class="dot-indicator" :class="resolveParentLabel(alloc.parent) === 'dad' ? 'dot-dad' : 'dot-mom'"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Default Handoff Time -->
    <div class="mt-4 px-2">
      <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">
        {{ t('defaultHandoffTime') }}
      </label>
      <p class="text-[11px] text-slate-400 mt-0.5 mb-2">{{ t('defaultHandoffTimeDesc') }}</p>
      <input
        type="time"
        :value="defaultHandoffTime"
        @input="emit('update:defaultHandoffTime', $event.target.value)"
        :disabled="!isEditing"
        class="w-full px-4 py-2.5 rounded-xl border-2 text-sm font-semibold text-center transition-colors"
        :class="isEditing ? 'border-slate-300 bg-white text-slate-800' : 'border-slate-100 bg-slate-50 text-slate-400 cursor-default'"
      />
    </div>
  </div>
</template>
