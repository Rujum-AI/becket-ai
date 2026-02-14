<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { Plus, Pencil, Check, X } from 'lucide-vue-next'

const props = defineProps({
  title: String,
  icon: String,
  hasAction: Boolean,
  actionType: { type: String, default: 'add' },
  isEditing: Boolean
})

const emit = defineEmits(['action', 'save', 'discard'])

const { t, lang } = useI18n()

const iconSrc = computed(() => {
  if (!props.icon) return ''
  // Use public folder path which Vite serves directly
  return `/assets/${props.icon}`
})

const actionText = computed(() => {
  if (props.actionType === 'edit') {
    return lang.value === 'he' ? 'עריכה' : 'EDIT'
  }
  return lang.value === 'he' ? 'הוסף חדש' : 'ADD NEW'
})

const actionIcon = computed(() => {
  return props.actionType === 'edit' ? Pencil : Plus
})
</script>

<template>
  <div class="section-box justify-between">
    <div class="flex items-center gap-6">
      <img v-if="icon" :src="iconSrc" class="section-img" :alt="title" @error="(e) => console.error('Failed to load icon:', iconSrc)">
      <h3 class="text-3xl text-slate-800 font-serif m-0">{{ title }}</h3>
    </div>

    <div v-if="isEditing" class="flex items-center gap-3">
      <div @click="$emit('discard')" class="flex items-center gap-2 cursor-pointer group select-none bg-red-50 hover:bg-red-100 py-2 px-4 rounded-full border border-red-100 transition-colors">
        <span class="text-[10px] font-black text-red-400 uppercase tracking-widest hidden sm:block">{{ t('discard') }}</span>
        <X class="w-4 h-4 text-red-500" />
      </div>

      <div @click="$emit('save')" class="flex items-center gap-2 cursor-pointer group select-none bg-teal-50 hover:bg-teal-100 py-2 px-4 rounded-full border border-teal-100 transition-colors">
        <span class="text-[10px] font-black text-teal-600 uppercase tracking-widest hidden sm:block">{{ t('save') }}</span>
        <Check class="w-4 h-4 text-teal-600" />
      </div>
    </div>

    <div v-else-if="hasAction" @click="$emit('action')" class="flex items-center gap-3 cursor-pointer group select-none">
      <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors hidden sm:block">
        {{ actionText }}
      </span>
      <div class="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center shadow-lg text-white group-active:scale-90 transition-transform flex-shrink-0">
        <component :is="actionIcon" class="w-6 h-6" />
      </div>
    </div>
  </div>
</template>
