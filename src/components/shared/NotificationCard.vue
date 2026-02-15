<script setup>
import { computed } from 'vue'
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
  Pin,
  X
} from 'lucide-vue-next'

const props = defineProps({
  item: { type: Object, required: true }
})

defineEmits(['dismiss', 'click', 'togglePin'])

const { t } = useI18n()

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

// Category labels for the tiny uppercase tag
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

// Accent color per category — used for icon bg tint + urgent glow
const accentMap = {
  nudge: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.25)' },
  approval: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.25)' },
  ask: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', glow: 'rgba(249, 115, 22, 0.25)' },
  handoff: { bg: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.2)' },
  task: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.2)' },
  expense: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', glow: 'rgba(16, 185, 129, 0.2)' },
  event: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.2)' }
}

const fallbackAccent = { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.15)' }

const icon = computed(() => iconMap[props.item.notification.type] || Bell)
const accent = computed(() => accentMap[props.item.notification.category] || fallbackAccent)
const isPinned = computed(() => props.item.pinned)
const isNudge = computed(() => props.item.notification.category === 'nudge')
const categoryLabel = computed(() => {
  const key = categoryLabelMap[props.item.notification.category]
  return key ? t(key) : props.item.notification.category
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
</script>

<template>
  <div class="notif-wrap" @click="$emit('click', item)">
    <!-- Dismiss X — sits outside overflow:hidden card -->
    <button class="notif-dismiss" @click.stop="$emit('dismiss', item.id)">
      <X :size="12" />
    </button>

    <div
      class="notif-card"
      :class="{ 'notif-urgent': isPinned }"
      :style="isPinned ? { boxShadow: `0 8px 30px rgba(0,0,0,0.3), 0 0 24px ${accent.glow}` } : {}"
    >
      <!-- Icon: check.png for nudge, lucide icon for others -->
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

      <!-- Pin toggle (inside card) -->
      <button
        class="notif-pin"
        :class="{ 'pin-active': isPinned }"
        :title="isPinned ? t('unpinNotification') : t('pinNotification')"
        @click.stop="$emit('togglePin', item.id)"
      >
        <Pin :size="12" />
      </button>

      <!-- Auto-fade progress bar (standard tier only) -->
      <div v-if="!isPinned" class="notif-fade-bar">
        <div class="notif-fade-progress"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Outer wrapper — no overflow clip, holds the X button */
.notif-wrap {
  position: relative;
  max-width: 320px;
  cursor: pointer;
}

.notif-wrap:hover .notif-card {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

/* Inner card — overflow hidden clips the fade bar to rounded corners */
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
}

/* Urgent tier: subtle pulsing ring */
.notif-urgent {
  animation: urgentPulse 3s ease-in-out infinite;
}

@keyframes urgentPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.92; }
}

/* Dismiss X — red circle with white border, on wrapper (not clipped) */
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
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Pin button — inside card, bottom-right corner */
.notif-pin {
  position: absolute;
  bottom: 8px;
  right: 10px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.35);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}

.notif-pin:hover {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  transform: scale(1.15);
}

.notif-pin.pin-active {
  background: rgba(251, 191, 36, 0.25);
  color: #fbbf24;
  transform: rotate(45deg);
}

[dir="rtl"] .notif-pin {
  right: auto;
  left: 10px;
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
  animation: fadeProgress 8s linear forwards;
}

@keyframes fadeProgress {
  from { width: 100%; }
  to { width: 0%; }
}

/* RTL */
[dir="rtl"] .notif-fade-bar {
  direction: ltr;
}
</style>
