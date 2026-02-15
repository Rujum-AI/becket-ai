<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { Eye, Plus, ArrowLeftRight, Check, X } from 'lucide-vue-next'

const props = defineProps({
  date: { type: Date, required: true },
  position: { type: Object, required: true }, // { x, y }
  pendingOverride: { type: Object, default: null }
})

const emit = defineEmits(['close', 'viewDay', 'addEvent', 'changeCustody', 'approveOverride', 'rejectOverride'])

const { t } = useI18n()

function handleClickOutside(e) {
  if (!e.target.closest('.day-action-menu')) {
    emit('close')
  }
}

function handleEscape(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
  }, 50)
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('touchstart', handleClickOutside)
  window.removeEventListener('keydown', handleEscape)
})

function getStyle() {
  const x = props.position.x
  const y = props.position.y
  const style = { position: 'fixed', zIndex: 9999 }

  // Center horizontally on tap point, clamp to edges
  const menuWidth = 220
  let left = x - menuWidth / 2
  if (left < 12) left = 12
  if (left + menuWidth > window.innerWidth - 12) left = window.innerWidth - 12 - menuWidth
  style.left = left + 'px'

  // Prefer above tap point, flip below if near top
  const menuHeight = 200
  if (y - menuHeight - 12 < 0) {
    style.top = (y + 12) + 'px'
  } else {
    style.bottom = (window.innerHeight - y + 12) + 'px'
  }

  return style
}
</script>

<template>
  <Teleport to="body">
    <div class="day-menu-backdrop" @click="emit('close')" />

    <div class="day-action-menu" :style="getStyle()">
      <button class="action-btn" @click="emit('addEvent')">
        <div class="action-circle">
          <Plus :size="22" />
        </div>
        <span class="action-label">{{ t('addEvent') }}</span>
      </button>

      <button class="action-btn" @click="emit('viewDay')">
        <div class="action-circle">
          <Eye :size="22" />
        </div>
        <span class="action-label">{{ t('viewDay') }}</span>
      </button>

      <button class="action-btn" @click="emit('changeCustody')">
        <div class="action-circle">
          <ArrowLeftRight :size="22" />
        </div>
        <span class="action-label">{{ t('switchParent') }}</span>
      </button>

      <!-- Pending override section -->
      <template v-if="pendingOverride">
        <div class="override-divider"></div>
        <div class="override-label">{{ t('pendingCustodyChange') }}</div>
        <div class="override-row">
          <button class="override-btn approve" @click="emit('approveOverride')">
            <Check :size="20" />
            {{ t('approve') }}
          </button>
          <button class="override-btn reject" @click="emit('rejectOverride')">
            <X :size="20" />
            {{ t('reject') }}
          </button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.day-menu-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
  z-index: 9998;
  animation: backdropIn 0.2s ease-out;
}

@keyframes backdropIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.day-action-menu {
  background: white;
  border-radius: 1.5rem;
  border: 2px solid var(--deep-slate);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  animation: menuPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes menuPop {
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 1rem;
  transition: background 0.15s;
  width: 100%;
}

.action-btn:active {
  background: #f1f5f9;
}

.action-circle {
  width: 42px;
  height: 42px;
  min-width: 42px;
  min-height: 42px;
  border-radius: 50%;
  background: white;
  border: 2.5px solid var(--deep-slate);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--deep-slate);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.1s;
}

.action-btn:active .action-circle {
  transform: scale(0.92);
}

.action-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--deep-slate);
  white-space: nowrap;
}

.override-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 1rem 0 0.75rem;
}

.override-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #92400e;
  background: #fef3c7;
  border-radius: 0.5rem;
  padding: 0.4rem 0.75rem;
  text-align: center;
  margin-bottom: 0.75rem;
}

.override-row {
  display: flex;
  gap: 0.5rem;
}

.override-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  border: 2px solid;
}

.override-btn.approve {
  background: #16a34a;
  color: white;
  border-color: #16a34a;
}

.override-btn.approve:active {
  background: #15803d;
}

.override-btn.reject {
  background: white;
  color: #dc2626;
  border-color: #fca5a5;
}

.override-btn.reject:active {
  background: #fef2f2;
}
</style>
