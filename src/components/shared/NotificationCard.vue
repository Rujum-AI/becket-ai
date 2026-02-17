<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import {
  ArrowUpDown,
  ClipboardList,
  MessageSquare,
  DollarSign,
  FileCheck,
  Calendar,
  Heart,
  Bell,
  X
} from 'lucide-vue-next'

const props = defineProps({
  item: { type: Object, required: true }
})

const emit = defineEmits(['dismiss', 'click', 'swipeDismiss', 'toastAction'])

const { t, isRTL } = useI18n()

const iconMap = {
  pickup_confirmed: ArrowUpDown,
  dropoff_confirmed: ArrowUpDown,
  task_assigned: ClipboardList,
  task_started: ClipboardList,
  task_completed: ClipboardList,
  task_failed: ClipboardList,
  task_rejected: ClipboardList,
  ask_received: MessageSquare,
  ask_accepted: MessageSquare,
  ask_rejected: MessageSquare,
  understanding_proposed: FileCheck,
  understanding_accepted: FileCheck,
  understanding_rejected: FileCheck,
  custody_override_requested: Calendar,
  custody_override_approved: Calendar,
  custody_override_rejected: Calendar,
  expense_pending: DollarSign,
  expense_added: DollarSign,
  nudge_request: Heart,
  nudge_response: Heart
}

const categoryLabelMap = {
  handoff: 'handoffs',
  task: 'tasks',
  ask: 'asks',
  approval: 'approvals',
  expense: 'expenses',
  nudge: 'nudge',
  event: 'events',
  photo: 'photos'
}

const accentMap = {
  nudge: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
  approval: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  ask: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316' },
  handoff: { bg: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' },
  task: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' },
  expense: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
  event: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }
}

const fallbackAccent = { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }

// Toast action labels per notification type
const TOAST_ACTION_MAP = {
  'ask_received': { label: 'accept', action: 'accept' },
  'expense_pending': { label: 'approve', action: 'approve' },
  'understanding_proposed': { label: 'accept', action: 'accept' },
  'custody_override_requested': { label: 'approve', action: 'approve' },
  'nudge_request': { label: 'respond', action: 'respond' },
}

const icon = computed(() => iconMap[props.item.notification.type] || Bell)
const accent = computed(() => accentMap[props.item.notification.category] || fallbackAccent)
const isUrgent = computed(() => props.item.urgent)
const isNudge = computed(() => props.item.notification.category === 'nudge')
const fadeDuration = computed(() => isUrgent.value ? 15000 : 8000)
const categoryLabel = computed(() => {
  const key = categoryLabelMap[props.item.notification.category]
  return key ? t(key) : props.item.notification.category
})

const primaryAction = computed(() => TOAST_ACTION_MAP[props.item.notification.type]?.action)
const actionLabel = computed(() => {
  const key = TOAST_ACTION_MAP[props.item.notification.type]?.label
  return key && props.item.notification.requires_action && !props.item.notification.action_taken
    ? t(key) : null
})

function formatTime(timestamp) {
  const date = new Date(timestamp || Date.now())
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(diff / 86400000)}d`
}

// Swipe-to-dismiss
const touchStartX = ref(0)
const swipeOffsetX = ref(0)
const isSwiping = ref(false)

function onTouchStart(e) {
  touchStartX.value = e.touches[0].clientX
  isSwiping.value = true
}

function onTouchMove(e) {
  if (!isSwiping.value) return
  const diff = e.touches[0].clientX - touchStartX.value
  // LTR: swipe right to dismiss. RTL: swipe left to dismiss
  swipeOffsetX.value = isRTL.value ? Math.min(0, diff) : Math.max(0, diff)
}

function onTouchEnd() {
  const threshold = 100
  if (Math.abs(swipeOffsetX.value) > threshold) {
    emit('swipeDismiss', props.item.id)
  }
  swipeOffsetX.value = 0
  isSwiping.value = false
}

const swipeStyle = computed(() => {
  if (swipeOffsetX.value === 0) return {}
  return {
    transform: `translateX(${swipeOffsetX.value}px)`,
    opacity: 1 - (Math.abs(swipeOffsetX.value) / 200),
    transition: isSwiping.value ? 'none' : 'all 0.3s ease'
  }
})
</script>

<template>
  <div
    class="notif-wrap"
    @click="$emit('click', item)"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
    :style="swipeStyle"
  >
    <!-- Dismiss X -->
    <button class="notif-dismiss" @click.stop="$emit('dismiss', item.id)">
      <X :size="12" />
    </button>

    <div class="notif-card" :class="{ 'notif-urgent': isUrgent }">
      <!-- Icon -->
      <div class="notif-icon-wrap">
        <img v-if="isNudge" src="/assets/check.png" class="notif-icon-img" alt="" />
        <div v-else class="notif-icon-circle" :style="{ background: accent.bg, color: accent.color }">
          <component :is="icon" :size="16" />
        </div>
      </div>

      <!-- Content -->
      <div class="notif-content">
        <div class="notif-top-row">
          <span class="notif-category">{{ categoryLabel }}</span>
          <span class="notif-time">{{ formatTime(item.notification.created_at) }}</span>
        </div>
        <p class="notif-message">{{ item.notification.message }}</p>
      </div>

      <!-- Inline action button -->
      <button
        v-if="actionLabel"
        class="notif-action-btn"
        @click.stop="$emit('toastAction', item, primaryAction)"
      >
        {{ actionLabel }}
      </button>

      <!-- Auto-fade progress bar -->
      <div class="notif-fade-bar">
        <div class="notif-fade-progress" :style="{ animationDuration: fadeDuration + 'ms' }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notif-wrap {
  position: relative;
  max-width: 320px;
  cursor: pointer;
}

.notif-wrap:hover .notif-card {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.notif-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(26, 28, 30, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 1.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  border: 1.5px solid transparent;
}

/* Urgent tier: teal border pulse */
.notif-urgent {
  border-color: rgba(13, 148, 136, 0.5);
  animation: urgentBorderPulse 2s ease-in-out infinite;
}

@keyframes urgentBorderPulse {
  0%, 100% { border-color: rgba(13, 148, 136, 0.3); }
  50% { border-color: rgba(13, 148, 136, 0.8); }
}

/* Dismiss X */
.notif-dismiss {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: 2px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s;
  z-index: 1;
}

.notif-dismiss:hover {
  transform: scale(1.15);
}

[dir="rtl"] .notif-dismiss {
  right: auto;
  left: -6px;
}

/* Icon */
.notif-icon-wrap {
  flex-shrink: 0;
}

.notif-icon-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: contain;
}

.notif-icon-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Content */
.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.15rem;
}

.notif-category {
  font-size: 0.85rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.notif-time {
  font-size: 0.6rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}

.notif-message {
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
  line-height: 1.3;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

/* Inline action button */
.notif-action-btn {
  flex-shrink: 0;
  padding: 0.3rem 0.65rem;
  border-radius: 9999px;
  background: #0D9488;
  color: white;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  align-self: center;
}

.notif-action-btn:hover {
  transform: scale(1.05);
  background: #0b8479;
}

/* Fade progress bar */
.notif-fade-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 0 0 1.5rem 1.5rem;
  overflow: hidden;
}

.notif-fade-progress {
  height: 100%;
  width: 100%;
  background: rgba(255, 255, 255, 0.5);
  animation: fadeProgress linear forwards;
}

@keyframes fadeProgress {
  from { width: 100%; }
  to { width: 0%; }
}

[dir="rtl"] .notif-fade-bar {
  direction: ltr;
}
</style>
