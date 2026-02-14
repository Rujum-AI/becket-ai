<script setup>
import { AlertCircle } from 'lucide-vue-next'
import { useI18n } from '@/composables/useI18n'
import BaseModal from './BaseModal.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  icon: {
    type: [Object, Function],
    default: () => AlertCircle
  },
  confirmText: {
    type: String,
    default: null
  },
  cancelText: {
    type: String,
    default: null
  },
  confirmColor: {
    type: String,
    default: 'bg-red-500'
  }
})

const emit = defineEmits(['close', 'confirm'])

const { t } = useI18n()
</script>

<template>
  <BaseModal
    v-if="show"
    :showHeader="false"
    maxWidth="400px"
    @close="$emit('close')"
  >
    <div class="text-center">
      <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
        <component :is="icon" class="w-8 h-8" />
      </div>
      <h2 class="text-xl font-serif font-bold text-slate-900 mb-2">{{ title }}</h2>
      <p class="text-slate-500 text-sm leading-relaxed mb-8">{{ message }}</p>
    </div>

    <template #footer>
      <div class="modal-action-bar">
        <button @click="$emit('close')" class="modal-secondary-btn">
          {{ cancelText || t('cancel') }}
        </button>
        <button @click="$emit('confirm')" class="modal-primary-btn" :class="confirmColor">
          {{ confirmText || t('confirm') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
