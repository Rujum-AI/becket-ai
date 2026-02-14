<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { Check, X, Trash2, Pencil, ChevronUp, ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'approve', 'reject', 'cancel', 'toggleHistory'])

const { t } = useI18n()

const statusClass = computed(() => {
  if (props.item.status === 'agreed') return 'u-status-agreed'
  if (props.item.terminationRequested) return 'u-status-rejected'
  return 'u-status-pending'
})

const shouldStrobe = computed(() => {
  return props.item.status === 'pending' && props.item.creator !== 'Me'
})

const showApproveReject = computed(() => {
  return props.item.status === 'pending' && props.item.creator !== 'Me'
})

const showCancel = computed(() => {
  return props.item.status === 'pending' && props.item.creator === 'Me'
})
</script>

<template>
  <div class="understanding-item">
    <div class="item-main-row">
      <div
        class="u-status-icon"
        :class="[statusClass, { 'strobe-anim': shouldStrobe }]"
      >
        <Check v-if="item.status === 'agreed'" class="w-3 h-3" />
        <Trash2 v-else-if="item.terminationRequested" class="w-3 h-3" />
        <span v-else-if="item.status === 'pending'" class="font-bold">?</span>
      </div>

      <div class="u-content w-full">
        <div class="flex justify-between items-start">
          <p class="u-text text-start" :class="{ 'line-through text-slate-400': item.terminationRequested }">
            {{ item.content }}
          </p>
          <button @click="$emit('edit', item)" class="u-btn-edit flex items-center justify-center flex-shrink-0 hover:bg-slate-200">
            <Pencil class="w-3 h-3" />
          </button>
        </div>

        <div class="u-meta flex-wrap">
          <span v-if="item.terminationRequested" class="text-red-500 font-bold uppercase text-[10px]">
            {{ t('terminationRequested') }}
          </span>
          <span v-else-if="item.status === 'pending'" class="text-orange-500 font-bold uppercase text-[10px]">
            {{ item.creator === 'Me' ? t('waitingForPartner') : t('waitingForYou') }}
          </span>

          <span v-if="item.status === 'agreed' && item.approvedDate" class="text-teal-600 bidi-isolate">
            {{ t('approved') }}: {{ item.approvedDate }}
          </span>

          <span v-if="item.expiration" class="bidi-isolate text-slate-400"> • EXP: {{ item.expiration }}</span>

          <div
            v-if="item.history && item.history.length"
            class="history-badge flex items-center gap-1 ms-auto"
            @click="$emit('toggleHistory', item.id)"
          >
            <span>v{{ item.history.length + 1 }}</span>
            <component :is="item.isHistoryOpen ? ChevronUp : ChevronDown" class="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>

    <transition name="pop">
      <div v-if="item.isHistoryOpen" class="history-container">
        <p class="text-[10px] font-black uppercase text-slate-300">{{ t('versionHistory') }}</p>
        <div v-for="(hist, idx) in item.history" :key="idx" class="history-row">
          <p class="history-text text-start">{{ hist.content }}</p>
          <span class="history-date bidi-isolate">{{ hist.date }}</span>
        </div>
      </div>
    </transition>

    <div v-if="showApproveReject" class="u-actions">
      <button @click="$emit('reject', item)" class="u-btn u-btn-reject">
        <X class="w-3 h-3" />
        {{ item.terminationRequested ? t('keepAgreement') : t('reject') }}
      </button>
      <button @click="$emit('approve', item)" class="u-btn u-btn-approve">
        <Check class="w-3 h-3" />
        {{ item.terminationRequested ? t('confirmTermination') : t('accept') }}
      </button>
    </div>

    <div v-if="showCancel" class="u-actions">
      <button @click="$emit('cancel', item)" class="u-btn u-btn-reject w-full">
        <Trash2 class="w-3 h-3" />
        {{ t('cancelProposal') }}
      </button>
    </div>
  </div>
</template>
