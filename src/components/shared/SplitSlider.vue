<script setup>
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()

const props = defineProps({
  dadPercent: { type: Number, required: true },
  momPercent: { type: Number, required: true }
})

const emit = defineEmits(['update:dadPercent', 'update:momPercent'])

function setDad(value) {
  const clamped = Math.max(0, Math.min(100, value))
  emit('update:dadPercent', clamped)
  emit('update:momPercent', 100 - clamped)
}

function onSliderInput(e) {
  const raw = Number(e.target.value)
  const snapped = Math.round(raw / 10) * 10
  setDad(snapped)
}

function onDadTyped(e) {
  setDad(Number(e.target.value))
}

function onMomTyped(e) {
  const clamped = Math.max(0, Math.min(100, Number(e.target.value)))
  emit('update:momPercent', clamped)
  emit('update:dadPercent', 100 - clamped)
}
</script>

<template>
  <div class="split-control">
    <div class="split-typed-row">
      <div class="typed-input-group dad-input-group">
        <span class="typed-label">{{ t('dad') }}</span>
        <div class="typed-field">
          <input
            type="number"
            :value="dadPercent"
            @input="onDadTyped"
            min="0"
            max="100"
            class="percent-input"
          />
          <span class="percent-sign">%</span>
        </div>
      </div>
      <div class="typed-input-group mom-input-group">
        <span class="typed-label">{{ t('mom') }}</span>
        <div class="typed-field">
          <input
            type="number"
            :value="momPercent"
            @input="onMomTyped"
            min="0"
            max="100"
            class="percent-input"
          />
          <span class="percent-sign">%</span>
        </div>
      </div>
    </div>
    <div class="slider-wrapper">
      <div class="tick-marks">
        <div v-for="i in 11" :key="i" class="tick" :style="{ left: ((i - 1) * 10) + '%' }">
          <div class="tick-line"></div>
          <span v-if="(i - 1) % 2 === 0" class="tick-label">{{ (i - 1) * 10 }}</span>
        </div>
      </div>
      <input
        type="range"
        :value="dadPercent"
        @input="onSliderInput"
        min="0"
        max="100"
        step="1"
        class="split-slider"
      />
    </div>
  </div>
</template>

<style scoped>
.split-control {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.split-typed-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.typed-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.dad-input-group .typed-label {
  color: #0f766e;
  background: #CCFBF1;
  padding: 0.25rem 0.625rem;
  border-radius: 0.5rem;
}
.mom-input-group .typed-label {
  color: #9a3412;
  background: #FFEDD5;
  padding: 0.25rem 0.625rem;
  border-radius: 0.5rem;
}
.typed-label {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.typed-field {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.25rem 0.5rem;
}
.percent-input {
  width: 3.5rem;
  border: none;
  background: transparent;
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
}
.percent-input::-webkit-inner-spin-button,
.percent-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.percent-sign {
  font-size: 0.875rem;
  font-weight: 700;
  color: #94a3b8;
}

.slider-wrapper {
  position: relative;
  padding: 0.5rem 0 1.75rem 0;
  direction: ltr;
}
.tick-marks {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}
.tick {
  position: absolute;
  top: 0.25rem;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tick-line {
  width: 2px;
  height: 0.75rem;
  background: #cbd5e1;
  border-radius: 1px;
}
.tick-label {
  font-size: 0.6rem;
  font-weight: 700;
  color: #94a3b8;
  margin-top: 0.75rem;
}
.split-slider {
  width: 100%;
  height: 0.75rem;
  border-radius: 0.5rem;
  background: linear-gradient(to right, #CCFBF1 0%, #FFEDD5 100%);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  position: relative;
  z-index: 1;
  margin: 0;
}
.split-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #0f172a;
  cursor: pointer;
  border: 3px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}
.split-slider::-moz-range-thumb {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #0f172a;
  cursor: pointer;
  border: 3px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

@media (max-width: 380px) {
  .percent-input { width: 3rem; font-size: 0.9rem; }
  .typed-label { font-size: 0.7rem; }
}
</style>
