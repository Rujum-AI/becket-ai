<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import {
  CircleArrowDown,
  CircleArrowUp,
  ArrowLeftRight,
  Heart,
  FileText,
  FolderOpen,
  AlertTriangle
} from 'lucide-vue-next'

const props = defineProps({
  child: { type: Object, required: true },
  expectedParentLabel: { type: String, default: null },
  canNudge: { type: Boolean, default: false },
  nudgeSending: { type: Boolean, default: false },
  colorIndex: { type: Number, default: 0 }
})

defineEmits(['open-pickup', 'open-dropoff', 'open-brief', 'open-documents', 'send-nudge', 'confirm-event-dropoff'])

const { t } = useI18n()

// Color palette inspired by dashboard/pie chart categories
const CARD_PALETTE = [
  { bg: 'linear-gradient(155deg, #dbeafe 0%, #eff6ff 40%, #f0f9ff 100%)', border: 'rgba(96, 165, 250, 0.5)', shadow: '0 3px 12px rgba(59, 130, 246, 0.08), 0 1px 4px rgba(0,0,0,0.04)', glow: '0 3px 10px rgba(59, 130, 246, 0.2), 0 0 20px rgba(59, 130, 246, 0.08)' },
  { bg: 'linear-gradient(155deg, #fce7f3 0%, #fdf2f8 40%, #fff1f2 100%)', border: 'rgba(244, 114, 182, 0.5)', shadow: '0 3px 12px rgba(236, 72, 153, 0.08), 0 1px 4px rgba(0,0,0,0.04)', glow: '0 3px 10px rgba(236, 72, 153, 0.2), 0 0 20px rgba(236, 72, 153, 0.08)' },
  { bg: 'linear-gradient(155deg, #ede9fe 0%, #f5f3ff 40%, #faf5ff 100%)', border: 'rgba(167, 139, 250, 0.5)', shadow: '0 3px 12px rgba(139, 92, 246, 0.08), 0 1px 4px rgba(0,0,0,0.04)', glow: '0 3px 10px rgba(139, 92, 246, 0.2), 0 0 20px rgba(139, 92, 246, 0.08)' },
  { bg: 'linear-gradient(155deg, #d1fae5 0%, #ecfdf5 40%, #f0fdfa 100%)', border: 'rgba(52, 211, 153, 0.5)', shadow: '0 3px 12px rgba(16, 185, 129, 0.08), 0 1px 4px rgba(0,0,0,0.04)', glow: '0 3px 10px rgba(16, 185, 129, 0.2), 0 0 20px rgba(16, 185, 129, 0.08)' },
  { bg: 'linear-gradient(155deg, #fef3c7 0%, #fffbeb 40%, #fefce8 100%)', border: 'rgba(252, 211, 77, 0.5)', shadow: '0 3px 12px rgba(245, 158, 11, 0.08), 0 1px 4px rgba(0,0,0,0.04)', glow: '0 3px 10px rgba(245, 158, 11, 0.2), 0 0 20px rgba(245, 158, 11, 0.08)' },
  { bg: 'linear-gradient(155deg, #ffedd5 0%, #fff7ed 40%, #fffbf5 100%)', border: 'rgba(251, 146, 60, 0.5)', shadow: '0 3px 12px rgba(249, 115, 22, 0.08), 0 1px 4px rgba(0,0,0,0.04)', glow: '0 3px 10px rgba(249, 115, 22, 0.2), 0 0 20px rgba(249, 115, 22, 0.08)' }
]

const cardTheme = computed(() => CARD_PALETTE[props.colorIndex % CARD_PALETTE.length])
const cardColorVars = computed(() => ({
  '--card-bg': cardTheme.value.bg,
  '--card-border': cardTheme.value.border,
  '--card-shadow': cardTheme.value.shadow,
  '--card-glow': cardTheme.value.glow
}))

const isPickup = computed(() => props.child.nextAction === 'pick')
const actionLabel = computed(() => isPickup.value ? t('pickup') : t('dropoff'))
const actionEvent = computed(() => isPickup.value ? 'open-pickup' : 'open-dropoff')

// Dynamic status dot color class
const statusDotClass = computed(() => {
  const s = props.child.status
  if (s === 'at_school' || s === 'at_activity') return 'dot-location'
  if (s === 'with_dad' || s === 'with_mom') return 'dot-parent'
  return 'dot-unknown'
})

// Conflict banner
const conflict = computed(() => props.child.conflict)
const conflictText = computed(() => {
  if (!conflict.value) return ''
  const c = conflict.value
  if (c.type === 'dropoff_needed' || c.type === 'dropoff_overdue') {
    return `${t('didYouDropOff')} ${c.childName} ${t('atPlace')} ${c.eventTitle}?`
  }
  if (c.type === 'pickup_needed') {
    return `${c.childName} ${t('pickupNeeded')} ${c.eventTitle}`
  }
  return ''
})

function getRelativeDay(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((target - today) / 86400000)

  if (diffDays === 0) return t('today')
  if (diffDays === 1) return t('tomorrow')

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  if (diffDays > 1 && diffDays < 7) {
    return `${t('onDay')} ${t(dayNames[date.getDay()])}`
  }
  return date.toLocaleDateString()
}

const nextInteractionText = computed(() => {
  if (!props.child.nextHandoffTime) return null
  const type = props.child.nextHandoffType
  const time = props.child.nextHandoffTime
  const loc = props.child.nextHandoffLoc
  const date = props.child.nextHandoffDate

  let text
  if (type === 'takeToEvent') {
    text = `${t('takeToEvent')} ${loc || ''}`
  } else {
    text = t(type)
    if (loc) {
      text += ` ${t('fromPlace')} ${loc}`
    }
  }
  const relDay = getRelativeDay(date)
  if (relDay) {
    text += ` ${relDay}`
  }
  text += ` ${t('atTime')} ${time}`
  return text
})
</script>

<template>
  <div class="child-card" :style="cardColorVars">
    <!-- Hatching texture overlay -->
    <div class="card-texture"></div>

    <!-- HEADER: Avatar + Info -->
    <div class="card-header">
      <div class="avatar-ring">
        <img
          :src="child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'"
          class="avatar-img"
          :alt="child.name"
        />
      </div>
      <div class="card-info">
        <h3 class="child-name">{{ child.name }}</h3>
        <div class="status-pill" :title="child.statusSource === 'custody_cycle' ? t('statusFromSchedule') : ''">
          <div :class="['status-dot', statusDotClass]"></div>
          <span>{{ t(child.status) }}</span>
        </div>
      </div>
    </div>

    <!-- ACTION ROW: Check-in + Smart Button -->
    <div class="action-row">
      <button
        :class="['checkin-btn', { sending: nudgeSending, inactive: !canNudge }]"
        :disabled="!canNudge"
        @click.stop="canNudge && $emit('send-nudge', child)"
      >
        <Heart :size="15" />
        <span>{{ t('nudge') }}</span>
      </button>
      <button
        :class="['action-btn', isPickup ? 'action-pickup' : 'action-dropoff']"
        @click.stop="$emit(actionEvent, child)"
      >
        <span class="action-icon-wrap">
          <CircleArrowDown v-if="isPickup" :size="20" />
          <CircleArrowUp v-else :size="20" />
        </span>
        <span class="action-label">{{ actionLabel }}</span>
      </button>
    </div>

    <!-- CONFLICT BANNER: status vs expected mismatch -->
    <div v-if="conflict" :class="['conflict-banner', conflict.type === 'dropoff_overdue' ? 'conflict-urgent' : 'conflict-warn']">
      <div class="conflict-row">
        <AlertTriangle :size="14" class="conflict-icon" />
        <span class="conflict-text">{{ conflictText }}</span>
      </div>
      <button
        v-if="conflict.type === 'dropoff_needed' || conflict.type === 'dropoff_overdue'"
        class="conflict-action-btn"
        @click.stop="$emit('confirm-event-dropoff', { child, eventTitle: conflict.eventTitle, eventType: conflict.eventType })"
      >
        {{ t('confirmDropoff') }}
      </button>
      <button
        v-else-if="conflict.type === 'pickup_needed'"
        class="conflict-action-btn"
        @click.stop="$emit('open-pickup', child)"
      >
        {{ t('pickup') }}
      </button>
    </div>

    <!-- NEXT INTERACTION -->
    <div class="schedule-section" :class="{ inactive: !nextInteractionText }">
      <div class="schedule-row">
        <div class="schedule-icon icon-amber">
          <ArrowLeftRight :size="13" />
        </div>
        <div class="schedule-text bidi-isolate">
          {{ nextInteractionText || t('noUpcomingHandoff') }}
        </div>
      </div>
    </div>

    <!-- QUICK ACTIONS -->
    <div class="quick-actions">
      <button class="quick-btn quick-brief" @click.stop="$emit('open-brief', child)">
        <FileText :size="15" />
        <span>{{ t('brief') }}</span>
      </button>
      <button class="quick-btn quick-docs" @click.stop="$emit('open-documents', child)">
        <FolderOpen :size="15" />
        <span>{{ t('documents') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ===== Card Shell ===== */
.child-card {
  position: relative;
  border-radius: 1.75rem;
  overflow: hidden;
  border: 2px solid var(--card-border);
  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  transition: box-shadow 0.3s ease, transform 0.2s ease;
}

.child-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

/* Signature 45-degree hatching texture */
.card-texture {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    rgba(255, 255, 255, 0.35) 3px,
    rgba(255, 255, 255, 0.35) 5px
  );
  pointer-events: none;
  z-index: 0;
}

/* ===== Header ===== */
.card-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1rem 0.5rem;
  -webkit-tap-highlight-color: transparent;
}

.avatar-ring {
  position: relative;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 3px solid white;
  box-shadow: var(--card-glow);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: relative;
  z-index: 1;
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  position: relative;
  z-index: 1;
}

.child-name {
  font-family: 'Fraunces', serif;
  font-size: 1.3rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

[dir="rtl"] .child-name {
  font-family: 'Assistant', sans-serif;
  font-weight: 800;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  width: fit-content;
  background: rgba(255, 255, 255, 0.5);
  padding: 0.15rem 0.5rem 0.15rem 0.35rem;
  border-radius: 9999px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.status-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-parent {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
  animation: statusPulseGreen 2s ease-in-out infinite;
}

.dot-location {
  background: #3b82f6;
  box-shadow: 0 0 6px rgba(59, 130, 246, 0.4);
  animation: statusPulseBlue 2s ease-in-out infinite;
}

.dot-unknown {
  background: #94a3b8;
}

@keyframes statusPulseGreen {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(34, 197, 94, 0.4); }
  50% { opacity: 0.5; box-shadow: 0 0 2px rgba(34, 197, 94, 0.2); }
}

@keyframes statusPulseBlue {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(59, 130, 246, 0.4); }
  50% { opacity: 0.5; box-shadow: 0 0 2px rgba(59, 130, 246, 0.2); }
}

.status-pill span {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #475569;
  white-space: nowrap;
}

/* ===== Action Row ===== */
.action-row {
  position: relative;
  z-index: 1;
  padding: 0.125rem 0.75rem 0.75rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  border-radius: 9999px;
  border: 2px solid;
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 2.75rem;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.12) 2px,
    rgba(255, 255, 255, 0.12) 4px
  );
  pointer-events: none;
}

.action-btn:hover {
  transform: translateY(-2px);
}

.action-btn:active {
  transform: scale(0.97);
}

.action-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
}

/* Pickup: teal theme */
.action-pickup {
  background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
  border-color: #0f766e;
  color: white;
  box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.action-pickup:hover {
  box-shadow: 0 6px 20px rgba(13, 148, 136, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* Dropoff: warm orange theme */
.action-dropoff {
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  border-color: #ea580c;
  color: white;
  box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.action-dropoff:hover {
  box-shadow: 0 6px 20px rgba(249, 115, 22, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.action-label {
  position: relative;
  z-index: 1;
}

/* ===== Check-in Button (collapsed — red pill) ===== */
.checkin-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.55rem 0.75rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, #ef4444, #f87171);
  border: 2px solid #dc2626;
  color: white;
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  min-height: 2.75rem;
  position: relative;
  overflow: hidden;
  animation: checkinGlow 2s ease-in-out infinite;
}

.checkin-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.1) 2px,
    rgba(255, 255, 255, 0.1) 4px
  );
  pointer-events: none;
}

.checkin-btn span {
  position: relative;
  z-index: 1;
}

.checkin-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
}

.checkin-btn:active {
  transform: scale(0.97);
}

@keyframes checkinGlow {
  0%, 100% { box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15); }
  50% { box-shadow: 0 4px 20px rgba(239, 68, 68, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15); }
}

.checkin-btn.inactive {
  background: linear-gradient(135deg, #cbd5e1, #94a3b8);
  border-color: #94a3b8;
  cursor: default;
  animation: none;
  opacity: 0.5;
}

.checkin-btn.inactive:hover {
  transform: none;
  box-shadow: none;
}

.checkin-btn.sending {
  opacity: 0.6;
  pointer-events: none;
  animation: nudgePulse 0.6s ease-in-out infinite;
}

/* ===== Conflict Banner ===== */
.conflict-banner {
  position: relative;
  z-index: 1;
  margin: 0 0.75rem 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.conflict-warn {
  background: rgba(245, 158, 11, 0.12);
  border: 1.5px solid rgba(245, 158, 11, 0.3);
}

.conflict-urgent {
  background: rgba(239, 68, 68, 0.12);
  border: 1.5px solid rgba(239, 68, 68, 0.3);
  animation: conflictPulse 2s ease-in-out infinite;
}

@keyframes conflictPulse {
  0%, 100% { border-color: rgba(239, 68, 68, 0.3); }
  50% { border-color: rgba(239, 68, 68, 0.6); }
}

.conflict-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.conflict-icon {
  flex-shrink: 0;
}

.conflict-warn .conflict-icon { color: #f59e0b; }
.conflict-urgent .conflict-icon { color: #ef4444; }

.conflict-text {
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.3;
}

.conflict-warn .conflict-text { color: #92400e; }
.conflict-urgent .conflict-text { color: #991b1b; }

.conflict-action-btn {
  align-self: flex-end;
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  border: none;
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
}

.conflict-warn .conflict-action-btn {
  background: #f59e0b;
  color: white;
}

.conflict-warn .conflict-action-btn:hover {
  background: #d97706;
}

.conflict-urgent .conflict-action-btn {
  background: #ef4444;
  color: white;
}

.conflict-urgent .conflict-action-btn:hover {
  background: #dc2626;
}

/* ===== Schedule Section ===== */
.schedule-section {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 1rem;
  padding: 0.125rem 0;
  margin: 0 0.75rem 0.5rem;
  border: 1.5px solid rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(4px);
}

.schedule-section.inactive {
  opacity: 0.45;
}

.schedule-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.625rem;
}

.schedule-icon {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: rgba(13, 148, 136, 0.12);
  color: #0D9488;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.schedule-icon.icon-amber {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.schedule-text {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 700;
  color: #1e293b;
}

/* ===== Quick Actions ===== */
.quick-actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 0.375rem;
  padding: 0 0.75rem 0.875rem;
}

.quick-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.5rem 0.25rem;
  border-radius: 0.75rem;
  border: 1.5px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 2.75rem;
  -webkit-tap-highlight-color: transparent;
}

.quick-btn span {
  font-size: 0.5rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quick-brief { color: #8b5cf6; }
.quick-docs { color: #3b82f6; }

.quick-btn:hover {
  background: rgba(255, 255, 255, 0.85);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.quick-btn:active {
  transform: scale(0.96);
}

.quick-btn.sending {
  opacity: 0.5;
  pointer-events: none;
  animation: nudgePulse 0.6s ease-in-out infinite;
}

@keyframes nudgePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* ===== Mobile: Single-column full-width card ===== */
@media (max-width: 640px) {

  /* Card becomes a 2-column grid: [header | actions] over [conflict?] over [schedule] over [quick-actions] */
  .child-card {
    display: grid;
    grid-template-columns: 1fr auto;
    border-radius: 1.5rem;
  }

  /* Header occupies left side of first row */
  .card-header {
    grid-column: 1;
    padding: 1rem 0 0.5rem;
    padding-inline-start: 1rem;
    gap: 0.75rem;
    align-self: center;
  }

  .avatar-ring {
    width: 3.5rem;
    height: 3.5rem;
  }

  .child-name {
    font-size: 1.25rem;
  }

  .status-pill span {
    font-size: 0.6875rem;
  }

  /* Action buttons occupy right side of first row, stacked vertically */
  .action-row {
    grid-column: 2;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    padding: 0.75rem 0 0.5rem;
    padding-inline-end: 1rem;
    padding-inline-start: 0.25rem;
    gap: 0.375rem;
  }

  .action-btn {
    flex: none;
    padding: 0.55rem 1rem;
    font-size: 0.6875rem;
    min-height: 2.5rem;
    gap: 0.4rem;
  }

  .checkin-btn {
    padding: 0.4rem 0.75rem;
    font-size: 0.5625rem;
    min-height: 2.5rem;
  }

  /* Conflict banner spans full width */
  .conflict-banner {
    grid-column: 1 / -1;
    margin: 0 0.875rem 0.5rem;
  }

  /* Schedule spans full width */
  .schedule-section {
    grid-column: 1 / -1;
    margin: 0 0.875rem 0.5rem;
  }

  .schedule-row {
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
  }

  .schedule-text {
    font-size: 0.8125rem;
  }

  /* Quick actions span full width, horizontal pill layout */
  .quick-actions {
    grid-column: 1 / -1;
    padding: 0 0.875rem 0.875rem;
    gap: 0.5rem;
  }

  .quick-btn {
    flex-direction: row;
    padding: 0.5rem 0.875rem;
    border-radius: 9999px;
    min-height: 2.5rem;
    gap: 0.375rem;
  }

  .quick-btn span {
    font-size: 0.625rem;
  }
}
</style>
