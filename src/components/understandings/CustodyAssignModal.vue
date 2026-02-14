<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore as useDashboardStore } from '@/stores/supabaseDashboard'
import { Check } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  dayIndex: {
    type: Number,
    default: null
  },
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

const { t, lang } = useI18n()
const dashboardStore = useDashboardStore()

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const selectedKids = ref([])
const selectedParent = ref(null)
const isRepeat = ref(false)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    // Reset and select all kids by default
    selectedKids.value = dashboardStore.children.map(c => c.id)
    selectedParent.value = null
    isRepeat.value = false
  }
})

const dayName = computed(() => {
  if (props.dayIndex === null) return ''
  return t(weekDays[props.dayIndex % 7])
})

const toggleSwitch = computed(() => {
  const translateX = isRepeat.value ? (lang.value === 'he' ? '-16px' : '16px') : '0'
  return { transform: translateX }
})

function toggleChildSelection(id) {
  if (selectedKids.value.includes(id)) {
    selectedKids.value = selectedKids.value.filter(k => k !== id)
  } else {
    selectedKids.value.push(id)
  }
}

function selectAllKids() {
  selectedKids.value = dashboardStore.children.map(c => c.id)
}

function confirmAssignment() {
  if (!selectedParent.value || selectedKids.value.length === 0) return

  const selectedChildren = dashboardStore.children.filter(c => selectedKids.value.includes(c.id))
  emit('confirm', {
    dayIndex: props.dayIndex,
    children: selectedChildren,
    parent: selectedParent.value,
    repeat: isRepeat.value
  })
}

function getChildImg(child) {
  return child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'
}
</script>

<template>
  <BaseModal
    v-if="isOpen"
    headerStyle="#F472B6"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <h2 class="modal-title text-2xl text-white">{{ t('assignCustody') }}</h2>
      <p class="text-white/60 text-sm font-bold uppercase tracking-widest mt-2">
        {{ dayName }}
        <span class="bidi-isolate">({{ t('day') }} {{ dayIndex + 1 }})</span>
      </p>
    </template>
          <div class="mb-6">
            <label class="modal-form-label">{{ t('who') }}</label>
            <div class="grid grid-cols-2 gap-3">
              <div
                v-for="child in dashboardStore.children"
                :key="child.id"
                @click="toggleChildSelection(child.id)"
                class="kid-toggle"
                :class="{ active: selectedKids.includes(child.id) }"
              >
                <img :src="getChildImg(child)" class="w-8 h-8 object-contain">
                <span class="font-bold text-sm text-slate-700">{{ child.name }}</span>
                <div v-if="selectedKids.includes(child.id)" class="ms-auto text-teal-600">
                  <Check class="w-4 h-4" />
                </div>
              </div>
            </div>
            <div class="mt-2 text-center">
              <button @click="selectAllKids" class="text-[10px] font-bold text-slate-400 uppercase underline">
                {{ t('selectAll') }}
              </button>
            </div>
          </div>
          <div class="mb-6">
            <label class="modal-form-label">{{ t('where') }}</label>
            <div class="flex gap-4">
              <div
                @click="selectedParent = 'dad'"
                class="parent-select-btn bg-cyan-50"
                :class="{ selected: selectedParent === 'dad' }"
              >
                <img src="/assets/profile/king_profile.png" class="w-12 h-12 rounded-full">
                <span class="font-bold text-slate-800">{{ t('Dad') }}</span>
              </div>
              <div
                @click="selectedParent = 'mom'"
                class="parent-select-btn bg-orange-50"
                :class="{ selected: selectedParent === 'mom' }"
              >
                <img src="/assets/profile/queen_profile.png" class="w-12 h-12 rounded-full">
                <span class="font-bold text-slate-800">{{ t('Mom') }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer mb-6" @click="isRepeat = !isRepeat">
            <div class="w-10 h-6 rounded-full relative transition-colors duration-200" :class="isRepeat ? 'bg-slate-800' : 'bg-slate-300'">
              <div class="absolute top-1 start-1 w-4 h-4 bg-white rounded-full transition-transform duration-200" :style="toggleSwitch"></div>
            </div>
            <span class="text-xs font-bold text-slate-600">{{ t('repeatFor') }} {{ dayName }}</span>
          </div>

    <template #footer>
      <div class="modal-action-bar">
        <button
          @click="confirmAssignment"
          :disabled="!selectedParent || selectedKids.length === 0"
          class="modal-primary-btn"
        >
          {{ t('confirm') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
