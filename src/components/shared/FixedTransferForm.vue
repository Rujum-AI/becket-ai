<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { X } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Object, required: true }
})

const emit = defineEmits(['update:modelValue', 'remove'])

const transfer = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

function update(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="transfer-form">
    <button @click="emit('remove')" class="remove-btn remove-btn-corner" type="button">
      <X :size="14" />
    </button>
    <div class="transfer-top-row">
      <div class="direction-flow">
        <select :value="transfer.from" @change="update('from', $event.target.value)" class="form-select">
          <option value="dad">{{ t('dad') }}</option>
          <option value="mom">{{ t('mom') }}</option>
        </select>
        <span class="arrow">→</span>
        <select :value="transfer.to" @change="update('to', $event.target.value)" class="form-select">
          <option value="dad">{{ t('dad') }}</option>
          <option value="mom">{{ t('mom') }}</option>
        </select>
      </div>
      <input
        :value="transfer.amount"
        @input="update('amount', Number($event.target.value))"
        type="number"
        class="form-input amount-input"
        placeholder="0"
      />
      <span class="currency">₪</span>
    </div>
    <div class="transfer-bottom-row">
      <input
        :value="transfer.label"
        @input="update('label', $event.target.value)"
        type="text"
        class="form-input label-input"
        :placeholder="t('labelPlaceholder')"
      />
      <div class="due-day-group">
        <label class="due-day-label">{{ t('paymentDueDay') }}</label>
        <input
          :value="transfer.due_day"
          @input="update('due_day', Number($event.target.value))"
          type="number"
          min="1"
          max="31"
          class="form-input due-day-input"
        />
      </div>
      <div class="expiry-group">
        <label class="expiry-label">{{ t('paymentExpiry') }}</label>
        <input
          :value="transfer.expires"
          @input="update('expires', $event.target.value)"
          type="date"
          class="form-input expiry-input"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.transfer-form {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  padding-inline-end: 2.75rem;
  background: white;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
}

.remove-btn-corner {
  position: absolute;
  top: 0.5rem;
  inset-inline-end: 0.5rem;
  width: 1.75rem;
  height: 1.75rem;
}

.transfer-top-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.transfer-bottom-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.form-select,
.form-input {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  background: white;
}
.form-select { min-width: 100px; }
.amount-input { width: 100px; }
.label-input { flex: 1; min-width: 150px; }

.due-day-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 70px;
}
.due-day-label {
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
}
.due-day-input {
  width: 70px;
  text-align: center;
}
.expiry-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.expiry-label {
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #d97706;
  letter-spacing: 0.05em;
}
.expiry-input {
  min-width: 130px;
  font-size: 0.8rem;
}

.direction-flow {
  direction: ltr;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.arrow {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 700;
}
.currency {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 700;
}

.remove-btn {
  border-radius: 50%;
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.remove-btn:hover {
  background: #fecaca;
  transform: scale(1.1);
}

@media (max-width: 380px) {
  .form-select { min-width: 80px; }
  .amount-input { width: 80px; }
  .label-input { min-width: 100px; }
  .expiry-input { min-width: 110px; }
}
</style>
