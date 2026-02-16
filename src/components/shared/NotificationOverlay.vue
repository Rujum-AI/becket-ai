<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUpdatesStore } from '@/stores/supabaseUpdates'
import NotificationCard from './NotificationCard.vue'

const router = useRouter()
const updatesStore = useUpdatesStore()
const emit = defineEmits(['openNudgeResponse', 'openCheckInDetail'])

const overlayItems = computed(() => updatesStore.overlayQueue)

function handleDismiss(itemId) {
  updatesStore.markAsRead(itemId)
  updatesStore.dismissOverlay(itemId)
}

function handleTogglePin(itemId) {
  updatesStore.togglePin(itemId)
}

// Route map for standard navigation
const routeMap = {
  pickup_confirmed: '/family',
  dropoff_confirmed: '/family',
  task_assigned: '/management',
  task_started: '/management',
  task_completed: '/management',
  task_failed: '/management',
  task_rejected: '/management',
  ask_received: '/management',
  ask_accepted: '/management',
  ask_rejected: '/management',
  understanding_proposed: '/understandings',
  understanding_accepted: '/understandings',
  understanding_rejected: '/understandings',
  custody_override_requested: '/family',
  custody_override_approved: '/family',
  custody_override_rejected: '/family',
  expense_pending: '/finance',
  expense_added: '/finance'
}

function handleCardClick(item) {
  const n = item.notification

  updatesStore.markAsRead(n.id)
  updatesStore.dismissOverlay(item.id)

  // Special: check-in request → open response modal
  if (n.type === 'nudge_request') {
    emit('openNudgeResponse', n)
    return
  }

  // Special: check-in response → open detail modal
  if (n.type === 'nudge_response') {
    emit('openCheckInDetail', n)
    return
  }

  // Standard: navigate to relevant page
  const target = routeMap[n.type] || '/updates'
  router.push(target)
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="overlay-slide" tag="div" class="notification-overlay-stack">
      <NotificationCard
        v-for="item in overlayItems"
        :key="item.id"
        :item="item"
        @dismiss="handleDismiss"
        @click="handleCardClick"
        @togglePin="handleTogglePin"
      />
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.notification-overlay-stack {
  position: fixed;
  top: calc(clamp(44px, 12vw, 56px) + 10px);
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 2900;
  pointer-events: none;
}

.notification-overlay-stack > * {
  pointer-events: auto;
}

[dir="rtl"] .notification-overlay-stack {
  right: auto;
  left: 20px;
}

/* Slide-in from right */
.overlay-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.overlay-slide-enter-from {
  transform: translateX(120%);
  opacity: 0;
}

.overlay-slide-leave-active {
  transition: all 0.3s ease-in;
}

.overlay-slide-leave-to {
  transform: translateX(120%);
  opacity: 0;
}

.overlay-slide-move {
  transition: transform 0.3s ease;
}

[dir="rtl"] .overlay-slide-enter-from,
[dir="rtl"] .overlay-slide-leave-to {
  transform: translateX(-120%);
}

@media (max-width: 440px) {
  .notification-overlay-stack {
    right: 10px;
    left: 10px;
  }

  [dir="rtl"] .notification-overlay-stack {
    right: 10px;
    left: 10px;
  }
}
</style>
