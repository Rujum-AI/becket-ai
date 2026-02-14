<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { Check, Trash2 } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  item: {
    type: Object,
    default: null
  },
  preselectedSubject: {
    type: String,
    default: null
  },
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'save', 'terminate'])

const { t } = useI18n()

const subjects = ['expenses', 'parenting', 'holidays', 'others']

const form = ref({
  subject: 'expenses',
  customSubject: '',
  content: '',
  expiration: '',
  hasExpiration: false
})

const isCustomSubject = ref(false)

const isEditing = computed(() => !!props.item)

const modalTitle = computed(() => {
  return isEditing.value ? t('editUnderstanding') : t('newUnderstanding')
})

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.item) {
      // Editing existing
      form.value = {
        subject: props.item.subject,
        customSubject: '',
        content: props.item.content,
        expiration: props.item.expiration || '',
        hasExpiration: !!props.item.expiration
      }
      isCustomSubject.value = !subjects.includes(props.item.subject)
      if (isCustomSubject.value) {
        form.value.customSubject = props.item.subject
      }
    } else {
      // Creating new
      const defaultSub = props.preselectedSubject || 'expenses'
      form.value = {
        subject: defaultSub,
        customSubject: '',
        content: '',
        expiration: '',
        hasExpiration: false
      }
      isCustomSubject.value = false
    }
  }
})

function handleSave() {
  if (!form.value.content.trim()) return

  const finalSubject = isCustomSubject.value ? form.value.customSubject : form.value.subject
  if (!finalSubject) return

  emit('save', {
    subject: finalSubject,
    content: form.value.content,
    expiration: form.value.hasExpiration ? form.value.expiration : ''
  })
}

function handleTerminate() {
  emit('terminate')
}
</script>

<template>
  <BaseModal
    v-if="isOpen"
    :showHeader="false"
    maxWidth="600px"
    @close="$emit('close')"
  >
    <h2 class="text-2xl font-serif font-bold text-slate-900 mb-6">
      {{ modalTitle }}
    </h2>

          <div class="mb-6">
            <label class="modal-form-label">{{ t('subject') }}</label>
            <div class="flex flex-wrap gap-2 mb-2">
              <button
                v-for="sub in subjects"
                :key="sub"
                @click="form.subject = sub; isCustomSubject = false"
                class="modal-pill-btn"
                :class="{ selected: form.subject === sub && !isCustomSubject }"
              >
                {{ t(sub) }}
              </button>
              <button
                @click="isCustomSubject = true; form.subject = ''"
                class="modal-pill-btn"
                :class="{ selected: isCustomSubject }"
              >
                + {{ t('new') }}
              </button>
            </div>
            <input
              v-if="isCustomSubject"
              v-model="form.customSubject"
              type="text"
              :placeholder="t('enterSubject')"
              class="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm text-start outline-none focus:border-slate-800"
            />
          </div>

          <div class="mb-6">
            <label class="modal-form-label">{{ t('theUnderstanding') }}</label>
            <textarea
              v-model="form.content"
              rows="4"
              class="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 focus:outline-none font-medium text-slate-800 text-start"
              :placeholder="t('typeHere')"
            ></textarea>
          </div>

          <div class="mb-8">
            <div class="flex items-center gap-3 mb-4 cursor-pointer group" @click="form.hasExpiration = !form.hasExpiration">
              <div
                class="w-6 h-6 rounded-md border-2 border-slate-300 flex items-center justify-center transition-colors group-hover:border-slate-500"
                :class="{ 'bg-slate-800 border-slate-800 group-hover:border-slate-800': form.hasExpiration }"
              >
                <Check v-if="form.hasExpiration" class="w-4 h-4 text-white" />
              </div>
              <span class="text-sm font-bold text-slate-600 select-none">{{ t('isTemporary') }}</span>
            </div>

            <transition name="pop">
              <div v-if="form.hasExpiration">
                <label class="modal-form-label">{{ t('expirationDate') }}</label>
                <input
                  type="date"
                  v-model="form.expiration"
                  class="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm text-slate-600 outline-none"
                />
              </div>
            </transition>
          </div>

    <template #footer>
      <div class="flex flex-col gap-3 w-full">
        <div class="modal-action-bar">
          <button @click="$emit('close')" class="modal-secondary-btn">{{ t('cancel') }}</button>
          <button @click="handleSave" class="modal-primary-btn">{{ t('save') }}</button>
        </div>
        <button
          v-if="isEditing && item && item.status === 'agreed'"
          @click="handleTerminate"
          class="modal-danger-btn flex items-center justify-center"
        >
          <Trash2 class="w-4 h-4 inline me-2" /> {{ t('terminateAgreement') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
