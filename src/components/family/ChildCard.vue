<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import {
  CircleArrowRight,
  CircleArrowUp,
  ArrowLeftRight,
  Heart,
  FileText,
  FolderOpen,
  AlertTriangle,
  Clock,
  Check
} from 'lucide-vue-next'

const props = defineProps({
  child: { type: Object, required: true },
  expectedParentLabel: { type: String, default: null },
  canNudge: { type: Boolean, default: false },
  nudgeSending: { type: Boolean, default: false },
  nudgePending: { type: Boolean, default: false },
  colorIndex: { type: Number, default: 0 }
})

const emit = defineEmits(['open-pickup', 'open-dropoff', 'open-brief', 'open-documents', 'send-nudge', 'confirm-event-dropoff'])

const { t } = useI18n()
const dashboardStore = useSupabaseDashboardStore()

// Live next handoff: re-evaluates whenever events, custodySchedule, or the
// 60s nowTick change. Replaces the old snapshot fields on child.* that froze
// at loadFamilyData time and went stale once the calendar moved on.
const nextHandoff = computed(() => dashboardStore.getNextHandoff(props.child.id))

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

// Handoff actions are available all day on the day they're scheduled for.
// Parents may legitimately confirm earlier than the scheduled time — when
// they do, we route them through an "early pickup" confirmation popup so
// the action is intentional, then proceed normally (notify the co-parent).
function nextHandoffMoment() {
  const h = nextHandoff.value
  if (!h?.time || !h?.date) return null
  const [hh, mm] = h.time.split(':').map(Number)
  const moment = new Date(h.date)
  moment.setHours(hh, mm, 0, 0)
  return moment
}

function isSameLocalDay(a, b) {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

// VISUAL state — drives the tint, icon, and text container styling.
// Reflects what KIND of interaction is next (pickup / dropoff / event /
// nothing). Always set, regardless of whether action is currently due.
const cardState = computed(() => {
  const c = conflict.value
  if (c?.type === 'dropoff_overdue' || c?.type === 'dropoff_needed') return 'dropoff'
  if (c?.type === 'pickup_needed') return 'pickup'
  // `handoff_pending` from the store is *informational* — it fires on every
  // transition day regardless of clock. Do NOT use it to drive the action
  // affordance; nextHandoff already tells us the right scheduled time.
  const h = nextHandoff.value
  if (!h) return 'idle'
  if (h.type === 'pickup') return 'pickup'
  if (h.type === 'dropoff') return 'dropoff'
  if (h.type === 'takeToEvent') return 'event'
  return 'idle'
})

// ACTION state — set whenever the parent CAN take an action.
// Available all day on the day-of (no time-gating). Urgent conflicts
// (overdue / needed) always fire. null = just show text, no affordance.
const actionState = computed(() => {
  const c = conflict.value
  if (c?.type === 'dropoff_overdue' || c?.type === 'dropoff_needed') return 'eventDropoff'
  if (c?.type === 'pickup_needed') return 'pickup'

  const moment = nextHandoffMoment()
  if (!moment) return null
  // Only surface the slide on the day the handoff is scheduled. Tomorrow's
  // pickup waits until tomorrow.
  if (!isSameLocalDay(moment, new Date())) return null

  const h = nextHandoff.value
  if (h?.type === 'pickup') return 'pickup'
  if (h?.type === 'dropoff') return 'dropoff'
  return null
})

// True when the parent slides to confirm before the scheduled time. Drives
// the "you're confirming early" popup. Re-reads the moment so it stays
// reactive to nowTick.
function isBeforeScheduled() {
  const moment = nextHandoffMoment()
  if (!moment) return false
  return Date.now() < moment.getTime()
}

const isUrgent = computed(() => conflict.value?.type === 'dropoff_overdue')

// Early-pickup confirmation modal state. Set when the swipe completes
// before the scheduled time. Confirming fires the same emit a normal
// on-time swipe would — the partner notification follows the existing flow.
const showEarlyConfirm = ref(false)
const earlyConfirmType = ref(null) // 'pickup' | 'dropoff'
const earlyConfirmAction = ref(null) // function to run on confirm

function promptEarlyConfirm(type, action) {
  earlyConfirmType.value = type
  earlyConfirmAction.value = action
  showEarlyConfirm.value = true
}

function onEarlyConfirm() {
  showEarlyConfirm.value = false
  if (earlyConfirmAction.value) earlyConfirmAction.value()
  earlyConfirmAction.value = null
}

function onEarlyCancel() {
  showEarlyConfirm.value = false
  earlyConfirmAction.value = null
  // Roll the slide back so the user can try again or change their mind.
  swipeOffset.value = 0
  swipeConfirmed.value = false
}

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
  if (c.type === 'handoff_pending') {
    return c.isMyPickup
      ? `${t('handoffPendingPickup')} ${c.childName}`
      : `${t('handoffPendingDropoff')} ${c.childName}`
  }
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

// ===== Swipe-to-confirm pickup =====
// Pointer-driven slide-to-confirm: matches the teal pickup palette, stays
// inside the existing pill (border-radius 9999px). Releasing past ~80%
// fires the same emit a tap would have; releasing earlier snaps the thumb
// back. Tap (no drag) keeps the legacy behaviour of opening the modal.
const swipeTrack = ref(null)
const swipeOffset = ref(0)
const swipeDragging = ref(false)
const swipeConfirmed = ref(false)
const SWIPE_COMPLETE_RATIO = 0.78

let dragStartX = 0
let dragStartOffset = 0
let activePointerId = null

const swipeProgress = computed(() => {
  if (!swipeTrack.value) return 0
  const max = trackInnerWidth()
  if (!max) return 0
  return Math.min(1, Math.max(0, swipeOffset.value / max))
})

const swipeStyle = computed(() => ({
  // Combine horizontal drag with the CSS vertical centering — a single
  // inline transform overrides the stylesheet's translateY otherwise.
  transform: `translate(${swipeOffset.value}px, -50%)`,
  transition: swipeDragging.value ? 'none' : 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
}))

// Thumb is 3rem ≈ 48px — slightly larger than the 2.75rem track so it
// reads as a knob protruding above and below the rail. Track width minus
// the thumb is the available travel distance for the drag.
const SWIPE_THUMB_PX = 48

function trackInnerWidth() {
  if (!swipeTrack.value) return 0
  return swipeTrack.value.clientWidth - SWIPE_THUMB_PX
}

function onSwipeStart(e) {
  if (swipeConfirmed.value) return
  activePointerId = e.pointerId
  e.target.setPointerCapture?.(e.pointerId)
  swipeDragging.value = true
  dragStartX = e.clientX
  dragStartOffset = swipeOffset.value
}

function onSwipeMove(e) {
  if (!swipeDragging.value || e.pointerId !== activePointerId) return
  const max = trackInnerWidth()
  const delta = e.clientX - dragStartX
  swipeOffset.value = Math.min(max, Math.max(0, dragStartOffset + delta))
}

function onSwipeEnd(e) {
  if (!swipeDragging.value) return
  if (e.pointerId !== activePointerId) return
  swipeDragging.value = false
  activePointerId = null
  const max = trackInnerWidth()
  if (max && swipeOffset.value / max >= SWIPE_COMPLETE_RATIO) {
    swipeOffset.value = max
    swipeConfirmed.value = true

    const fire = () => {
      // Reset the slide UI after the pickup modal opens so the next pickup
      // starts fresh. Existing notification flow handles partner alert.
      emit('open-pickup', props.child)
      setTimeout(() => {
        swipeConfirmed.value = false
        swipeOffset.value = 0
      }, 350)
    }

    setTimeout(() => {
      if (isBeforeScheduled()) {
        // Picking up earlier than the scheduled time — gate behind a
        // confirmation popup so the parent acknowledges the early action.
        promptEarlyConfirm('pickup', fire)
      } else {
        fire()
      }
    }, 280)
  } else {
    swipeOffset.value = 0
  }
}

onBeforeUnmount(() => {
  swipeDragging.value = false
  activePointerId = null
})

function interp(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''))
}

const nextInteractionText = computed(() => {
  const h = nextHandoff.value
  if (!h?.time) return null
  const { type, time, location: loc, date } = h
  const when = getRelativeDay(date) || ''
  const childName = props.child.name || ''

  let key
  if (type === 'pickup') key = loc ? 'nextPickupAt' : 'nextPickupAtNoLoc'
  else if (type === 'dropoff') key = loc ? 'nextDropoffAt' : 'nextDropoffAtNoLoc'
  else if (type === 'takeToEvent') key = loc ? 'nextTakeToAt' : 'nextTakeToAtNoLoc'
  else return null

  return interp(t(key), { child: childName, location: loc || '', when, time })
    .replace(/\s+/g, ' ')
    .trim()
})

// Active conflicts describe an *immediate* state ("did you drop off Kai at
// swimming?") that overrides the scheduled handoff text. Otherwise show
// the next-handoff text. Falls back to the muted "nothing upcoming" line.
const nextDisplayText = computed(() => {
  if (conflict.value && (
    conflict.value.type === 'dropoff_needed' ||
    conflict.value.type === 'dropoff_overdue' ||
    conflict.value.type === 'pickup_needed'
  )) {
    return conflictText.value
  }
  return nextInteractionText.value
    || interp(t('noUpcomingHandoff'), { child: props.child.name || '' })
})

function handleDropoffAction() {
  const fire = () => {
    if (cardState.value === 'eventDropoff' && conflict.value) {
      emit('confirm-event-dropoff', {
        child: props.child,
        eventTitle: conflict.value.eventTitle,
        eventType: conflict.value.eventType
      })
    } else {
      emit('open-dropoff', props.child)
    }
  }
  // eventDropoff is by definition due now (the active-event conflict
  // fired) — never gate that behind "are you early". Only gate the
  // scheduled handoff dropoff when before its time.
  if (cardState.value !== 'eventDropoff' && isBeforeScheduled()) {
    promptEarlyConfirm('dropoff', fire)
  } else {
    fire()
  }
}
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

    <!-- ACTION ROW: CHECK-IN nudge pill (alone — pickup/dropoff action moved
         into the unified Next-Interaction container below). -->
    <div class="action-row">
      <button
        :class="['checkin-btn', { sending: nudgeSending, pending: nudgePending, inactive: !canNudge }]"
        :disabled="!canNudge || nudgePending"
        @click.stop="canNudge && !nudgePending && $emit('send-nudge', child)"
      >
        <Heart :size="15" />
        <span>{{ nudgePending ? t('nudgePending') : t('nudge') }}</span>
      </button>
    </div>

    <!-- NEXT-INTERACTION TEXT CONTAINER
         One stylized box per child showing THIS parent's next to-do.
         Always present (text only) — the action affordance lives in a
         separate container below and only appears when actually due. -->
    <div
      class="next-interaction"
      :class="[`state-${cardState}`, { urgent: isUrgent, idle: cardState === 'idle' }]"
    >
      <div class="next-text-row">
        <div :class="['next-icon', { 'icon-urgent': isUrgent }]">
          <AlertTriangle v-if="isUrgent" :size="14" />
          <ArrowLeftRight v-else :size="14" />
        </div>
        <div class="next-text bidi-isolate">{{ nextDisplayText }}</div>
      </div>
    </div>

    <!-- ACTION AFFORDANCE (separate box, only when an action is due).
         Renders only when actionState is set — i.e. urgent conflict, or
         the scheduled handoff time is within the action window. -->
    <div v-if="actionState" class="next-action">
      <div
        v-if="actionState === 'pickup'"
        ref="swipeTrack"
        :class="['swipe-track', { confirmed: swipeConfirmed }]"
        :style="{ '--swipe-progress': swipeProgress }"
      >
        <!-- Inner clip layer: keeps the fill + labels inside the pill while
             letting the larger thumb knob protrude above and below the track. -->
        <div class="swipe-rail">
          <div class="swipe-fill" :style="{ width: `calc(${swipeProgress * 100}% + 48px)` }"></div>
          <span class="swipe-label" :style="{ opacity: 1 - swipeProgress }">
            {{ t('swipeToConfirmPickup') }}
          </span>
          <span class="swipe-label swipe-label-done" :style="{ opacity: swipeConfirmed ? 1 : 0 }">
            {{ t('pickedUp') }}
          </span>
        </div>
        <div
          class="swipe-thumb"
          :style="swipeStyle"
          @pointerdown="onSwipeStart"
          @pointermove="onSwipeMove"
          @pointerup="onSwipeEnd"
          @pointercancel="onSwipeEnd"
        >
          <Check v-if="swipeConfirmed" :size="20" />
          <CircleArrowRight v-else :size="20" />
        </div>
      </div>

      <button
        v-else-if="actionState === 'dropoff' || actionState === 'eventDropoff'"
        :class="['next-action-btn', { urgent: isUrgent }]"
        @click.stop="handleDropoffAction"
      >
        <span class="next-action-icon-wrap">
          <CircleArrowUp :size="18" />
        </span>
        <span class="next-action-label">{{ t('confirmDropoff') }}</span>
      </button>
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

    <!-- Early-handoff confirmation. Fires when the parent confirms
         pickup/dropoff before the scheduled time. Confirming proceeds to
         the normal flow (modal + partner notification). -->
    <ConfirmModal
      :show="showEarlyConfirm"
      :icon="Clock"
      :title="earlyConfirmType === 'pickup' ? t('earlyPickupTitle') : t('earlyDropoffTitle')"
      :message="earlyConfirmType === 'pickup' ? t('earlyPickupMessage') : t('earlyDropoffMessage')"
      :confirm-text="t('continueAnyway')"
      :cancel-text="t('cancel')"
      confirm-color="bg-slate-900"
      @confirm="onEarlyConfirm"
      @close="onEarlyCancel"
    />
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

/* ===== Action Row (CHECK-IN only) ===== */
.action-row {
  position: relative;
  z-index: 1;
  padding: 0.125rem 0.75rem 0.5rem;
  display: flex;
  justify-content: flex-end;
}

/* ===== Swipe-to-confirm pickup (lives inside .next-interaction now,
   takes the full container width — no min-width / flex contention).
   The track itself does NOT clip — that way the thumb knob can sit
   proud of the rail above and below. The inner .swipe-rail handles
   fill + label clipping so those stay inside the pill. ===== */
.swipe-track {
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.75rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  border: 2px solid #0f766e;
  background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  direction: ltr;
}

.swipe-track::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.12) 2px,
    rgba(255, 255, 255, 0.12) 4px
  );
  pointer-events: none;
}

/* Inner clipping layer — keeps the growing teal fill and the labels
   inside the rounded pill while the thumb above is free to overflow. */
.swipe-rail {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 0;
}

.swipe-fill {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  background: linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%);
  border-radius: 9999px;
  z-index: 0;
  transition: width 0.05s linear;
  pointer-events: none;
}

.swipe-label {
  position: relative;
  z-index: 1;
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  pointer-events: none;
  transition: opacity 0.15s ease;
  white-space: nowrap;
  padding-inline-start: 3rem; /* keep label clear of the larger thumb */
}

.swipe-label-done {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-inline-start: 0;
}

.swipe-thumb {
  position: absolute;
  /* Vertically protruding: 3rem thumb in a 2.75rem track sits 0.125rem
     proud above and below the rail. Makes the knob feel grabbable. */
  top: 50%;
  inset-inline-start: 0.125rem;
  width: 3rem;
  height: 3rem;
  box-sizing: border-box;
  transform: translateY(-50%);
  border-radius: 50%;
  background: white;
  /* Frame: matches the track's deep-teal border for visual continuity. */
  border: 2px solid #0f766e;
  color: #0d9488;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.12);
  cursor: grab;
  z-index: 2;
  touch-action: none;
}

.swipe-thumb:active {
  cursor: grabbing;
}

.swipe-track.confirmed .swipe-thumb {
  background: #ecfdf5;
  color: #047857;
}

/* In RTL the inset-inline-* keeps thumb visually on the start side, and the
   transform uses positive X (LTR) because we force direction:ltr on the track. */

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

/* Sent + still waiting on the partner — calmer slate pill so the user
   knows the nudge is in-flight without re-triggering the urgent red glow. */
.checkin-btn.pending {
  background: linear-gradient(135deg, #475569, #64748b);
  border-color: #334155;
  animation: none;
  cursor: default;
  opacity: 0.85;
}

.checkin-btn.pending:hover {
  transform: none;
  box-shadow: 0 4px 14px rgba(71, 85, 105, 0.25);
}

/* ===== Unified Next-Interaction Container =====
   Shows ONE thing per child: this parent's next to-do regarding the kid.
   Either an actionable pickup/dropoff with affordance, or a passive
   upcoming-event line. The action lives inside the container at full
   width so the slide-to-confirm thumb is always visible. */
.next-interaction {
  position: relative;
  z-index: 1;
  margin: 0 0.75rem 0.5rem;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 1rem;
  padding: 0.625rem 0.75rem 0.75rem;
  border: 1.5px solid rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  transition: background 0.25s ease, border-color 0.25s ease;
}

.next-interaction.idle {
  opacity: 0.55;
}

/* Action affordance — separate sibling container.
   Sits below the text container with breathing room on both sides so the
   protruding thumb knob has clear air above and below it. */
.next-action {
  position: relative;
  z-index: 1;
  margin: 0.5rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Pickup state: subtle teal tint to foreshadow the slide action below. */
.next-interaction.state-pickup {
  background: rgba(204, 251, 241, 0.45);
  border-color: rgba(20, 184, 166, 0.35);
}

/* Dropoff state: warm-orange tint, matches the tap CTA. */
.next-interaction.state-dropoff,
.next-interaction.state-eventDropoff {
  background: rgba(255, 237, 213, 0.55);
  border-color: rgba(249, 115, 22, 0.35);
}

/* Urgent (overdue) state: red, pulsing border. */
.next-interaction.urgent {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.35);
  animation: nextUrgentPulse 2s ease-in-out infinite;
}

@keyframes nextUrgentPulse {
  0%, 100% { border-color: rgba(239, 68, 68, 0.35); }
  50% { border-color: rgba(239, 68, 68, 0.65); }
}

.next-text-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.next-icon {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.next-interaction.state-pickup .next-icon {
  background: rgba(13, 148, 136, 0.15);
  color: #0d9488;
}

.next-interaction.state-dropoff .next-icon,
.next-interaction.state-eventDropoff .next-icon {
  background: rgba(249, 115, 22, 0.15);
  color: #ea580c;
}

.next-icon.icon-urgent {
  background: rgba(239, 68, 68, 0.18);
  color: #ef4444;
}

.next-text {
  flex: 1;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
}

.next-interaction.urgent .next-text {
  color: #991b1b;
}

/* Tap CTA (dropoff / event-dropoff). Sits inside the container at full
   width — same orange palette as the legacy .action-dropoff button. */
.next-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  border-radius: 9999px;
  border: 2px solid #ea580c;
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  color: white;
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
  box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.next-action-btn::before {
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

.next-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(249, 115, 22, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.next-action-btn:active {
  transform: scale(0.97);
}

.next-action-btn.urgent {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  border-color: #b91c1c;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.next-action-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
}

.next-action-label {
  position: relative;
  z-index: 1;
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

  /* CHECK-IN pill occupies right side of first row */
  .action-row {
    grid-column: 2;
    align-items: center;
    justify-content: flex-end;
    padding: 0.75rem 0 0.5rem;
    padding-inline-end: 1rem;
    padding-inline-start: 0.25rem;
  }

  .checkin-btn {
    padding: 0.4rem 0.75rem;
    font-size: 0.5625rem;
    min-height: 2.5rem;
  }

  /* Text container + action container both span full width below header */
  .next-interaction {
    grid-column: 1 / -1;
    margin: 0 0.875rem 0.5rem;
  }

  .next-action {
    grid-column: 1 / -1;
    margin: 0.5rem 0.875rem 0.75rem;
  }

  .next-text {
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
