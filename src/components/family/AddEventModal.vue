<script setup>
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import BaseModal from '@/components/shared/BaseModal.vue'

const emit = defineEmits(['close', 'save'])

const { t } = useI18n()

const eventData = ref({
  title: '',
  date: '',
  time: '',
  location: '',
  notes: ''
})

function saveEvent() {
  emit('save', { ...eventData.value })
  emit('close')
}
</script>

<template>
  <BaseModal
    headerColor="bg-slate-800"
    :title="'Add Event'"
    @close="$emit('close')"
  >
    <div class="modal-form-group">
      <label class="modal-form-label">Event Title</label>
      <input
        v-model="eventData.title"
        type="text"
        class="modal-form-input"
        placeholder="e.g., Soccer Practice"
      />
    </div>

    <div class="modal-form-row">
      <div class="modal-form-group">
        <label class="modal-form-label">Date</label>
        <input
          v-model="eventData.date"
          type="date"
          class="modal-form-input"
        />
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label">Time</label>
        <input
          v-model="eventData.time"
          type="time"
          class="modal-form-input"
        />
      </div>
    </div>

    <div class="modal-form-group">
      <label class="modal-form-label">Location</label>
      <input
        v-model="eventData.location"
        type="text"
        class="modal-form-input"
        placeholder="e.g., School"
      />
    </div>

    <div class="modal-form-group">
      <label class="modal-form-label">Notes (Optional)</label>
      <textarea
        v-model="eventData.notes"
        class="modal-form-textarea"
        rows="3"
        placeholder="Additional details..."
      ></textarea>
    </div>

    <template #footer>
      <div class="modal-action-bar">
        <button class="modal-secondary-btn" @click="$emit('close')">
          {{ t('cancel') }}
        </button>
        <button class="modal-primary-btn" @click="saveEvent">
          {{ t('save') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
