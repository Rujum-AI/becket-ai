<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useLanguageStore } from '@/stores/language'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import BaseModal from '@/components/shared/BaseModal.vue'
import { SECTION_COLORS } from '@/lib/modalColors'

const props = defineProps({
  initialDate: { type: String, required: true } // YYYY-MM-DD
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const langStore = useLanguageStore()
const dashboardStore = useSupabaseDashboardStore()

const locale = computed(() => langStore.lang === 'he' ? 'he-IL' : 'en-US')

const fromDate = ref(props.initialDate)
const toDate = ref(props.initialDate)
const overrideParent = ref(suggestParent())
const reason = ref('')
const submitting = ref(false)
const submitError = ref(null)

// Suggest the opposite parent of who has custody on the clicked date
function suggestParent() {
  const current = dashboardStore.custodySchedule[props.initialDate]
  return current === 'dad' ? 'mom' : 'dad'
}

// Preview: affected days
const previewDays = computed(() => {
  if (!fromDate.value || !toDate.value) return []
  const days = []
  const start = new Date(fromDate.value + 'T00:00:00')
  const end = new Date(toDate.value + 'T00:00:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${day}`
    days.push({
      dateKey: key,
      dayOfWeek: d.toLocaleDateString(locale.value, { weekday: 'short' }),
      dayNum: d.getDate(),
      currentParent: dashboardStore.custodySchedule[key] || 'unknown'
    })
  }
  return days
})

const dayCount = computed(() => previewDays.value.length)

const isValid = computed(() => {
  return fromDate.value && toDate.value && fromDate.value <= toDate.value && overrideParent.value
})

async function submit() {
  if (!isValid.value || submitting.value) return

  submitting.value = true
  submitError.value = null

  try {
    await dashboardStore.requestCustodyOverride({
      fromDate: fromDate.value,
      toDate: toDate.value,
      overrideParent: overrideParent.value,
      reason: reason.value
    })
    emit('close')
  } catch (err) {
    submitError.value = err.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :headerStyle="SECTION_COLORS.family"
    :title="t('changeCustody')"
    maxWidth="480px"
    @close="emit('close')"
  >
    <div class="custody-form">
      <!-- Date Range -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ t('overrideFromDate') }}</label>
          <input v-model="fromDate" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('overrideToDate') }}</label>
          <input v-model="toDate" type="date" class="form-input" />
        </div>
      </div>

      <!-- Parent Selector -->
      <div class="form-group">
        <label class="form-label">{{ t('assignTo') }}</label>
        <div class="parent-toggle">
          <button
            :class="['toggle-btn', 'dad-btn', { active: overrideParent === 'dad' }]"
            @click="overrideParent = 'dad'"
          >
            👨 {{ t('dad') }}
          </button>
          <button
            :class="['toggle-btn', 'mom-btn', { active: overrideParent === 'mom' }]"
            @click="overrideParent = 'mom'"
          >
            👩 {{ t('mom') }}
          </button>
        </div>
      </div>

      <!-- Preview Strip -->
      <div v-if="previewDays.length > 0" class="preview-section">
        <div class="preview-header">
          <span class="preview-label">{{ t('overridePreview') }}</span>
          <span class="preview-count">{{ dayCount }} {{ t('daysAffected') }}</span>
        </div>
        <div class="preview-strip">
          <div
            v-for="day in previewDays"
            :key="day.dateKey"
            class="preview-day"
          >
            <div class="preview-day-name">{{ day.dayOfWeek }}</div>
            <div class="preview-day-num">{{ day.dayNum }}</div>
            <div class="preview-arrows">
              <span :class="['preview-dot', day.currentParent]"></span>
              <span class="preview-arrow">→</span>
              <span :class="['preview-dot', overrideParent]"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Reason -->
      <div class="form-group">
        <label class="form-label">{{ t('overrideReason') }}</label>
        <textarea
          v-model="reason"
          class="form-textarea"
          rows="2"
          :placeholder="t('overrideReasonPlaceholder')"
        ></textarea>
      </div>

      <!-- Error -->
      <div v-if="submitError" class="error-msg">{{ submitError }}</div>
    </div>

    <template #footer>
      <div class="modal-action-bar">
        <button class="modal-secondary-btn" @click="emit('close')">
          {{ t('cancel') }}
        </button>
        <button
          class="modal-primary-btn"
          :disabled="!isValid || submitting"
          @click="submit"
        >
          {{ submitting ? t('sending') : t('sendRequest') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.custody-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-input {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 2px solid #e2e8f0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1A1C1E;
  background: #f8fafc;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #1A1C1E;
}

.parent-toggle {
  display: flex;
  gap: 0.75rem;
}

.toggle-btn {
  flex: 1;
  padding: 1rem;
  border-radius: 1rem;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;
  border: 3px solid #e2e8f0;
  background: #f8fafc;
  color: #94a3b8;
}

.toggle-btn.dad-btn.active {
  border-color: #5EEAD4;
  background: linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%);
  color: #1A1C1E;
}

.toggle-btn.mom-btn.active {
  border-color: #FDBA74;
  background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%);
  color: #1A1C1E;
}

.preview-section {
  background: #f8fafc;
  border-radius: 1rem;
  padding: 1rem;
  border: 2px solid #e2e8f0;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.preview-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-count {
  font-size: 0.75rem;
  font-weight: 700;
  color: #d97706;
}

.preview-strip {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.preview-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 48px;
  padding: 0.5rem;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
}

.preview-day-name {
  font-size: 0.625rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
}

.preview-day-num {
  font-size: 1rem;
  font-weight: 900;
  color: #1A1C1E;
}

.preview-arrows {
  display: flex;
  align-items: center;
  gap: 2px;
}

.preview-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.preview-dot.dad {
  background: #5EEAD4;
}

.preview-dot.mom {
  background: #FDBA74;
}

.preview-dot.unknown {
  background: #cbd5e1;
}

.preview-arrow {
  font-size: 0.625rem;
  color: #94a3b8;
}

.form-textarea {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 2px solid #e2e8f0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1A1C1E;
  background: #f8fafc;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: #1A1C1E;
}

.error-msg {
  color: #dc2626;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.75rem;
  background: #fef2f2;
  border-radius: 0.75rem;
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

.modal-primary-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 1.5rem;
  font-weight: 700;
  font-size: 0.875rem;
  background: #d97706;
  color: white;
  border: 2px solid #d97706;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-primary-btn:hover:not(:disabled) {
  background: #b45309;
  border-color: #b45309;
}

.modal-primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
