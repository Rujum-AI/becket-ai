<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { Eye, Plus, ArrowLeftRight, Check, X } from 'lucide-vue-next'

const props = defineProps({
  date: { type: Date, required: true },
  position: { type: Object, required: true }, // { x, y }
  pendingOverride: { type: Object, default: null } // override object if day has pending override
})

const emit = defineEmits(['close', 'viewDay', 'addEvent', 'changeCustody', 'approveOverride', 'rejectOverride'])

const { t } = useI18n()

function handleClickOutside(e) {
  // Small delay to avoid closing immediately from the same click
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
    document.addEventListener('touchstart', handleClickOutside)
  }, 50)
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('touchstart', handleClickOutside)
  window.removeEventListener('keydown', handleEscape)
})

// Position: ensure menu stays within viewport
function getStyle() {
  const x = props.position.x
  const y = props.position.y
  const style = { position: 'fixed', zIndex: 9999 }

  // Horizontal: prefer right of click, but flip if near right edge
  if (x + 200 > window.innerWidth) {
    style.right = (window.innerWidth - x) + 'px'
  } else {
    style.left = x + 'px'
  }

  // Vertical: prefer below click, but flip if near bottom
  if (y + 160 > window.innerHeight) {
    style.bottom = (window.innerHeight - y) + 'px'
  } else {
    style.top = y + 'px'
  }

  return style
}
</script>

<template>
  <Teleport to="body">
    <div class="day-action-menu" :style="getStyle()">
      <button class="action-item" @click="emit('viewDay')">
        <Eye :size="18" />
        <span>{{ t('viewDay') }}</span>
      </button>
      <button class="action-item" @click="emit('addEvent')">
        <Plus :size="18" />
        <span>{{ t('addEvent') }}</span>
      </button>
      <div class="action-divider"></div>
      <button class="action-item custody-action" @click="emit('changeCustody')">
        <ArrowLeftRight :size="18" />
        <span>{{ t('changeCustody') }}</span>
      </button>

      <!-- Pending override approval section -->
      <template v-if="pendingOverride">
        <div class="action-divider"></div>
        <div class="override-info">
          {{ t('pendingCustodyChange') }}
        </div>
        <div class="override-actions">
          <button class="action-btn reject-btn" @click="emit('rejectOverride')">
            <X :size="16" />
            {{ t('reject') }}
          </button>
          <button class="action-btn approve-btn" @click="emit('approveOverride')">
            <Check :size="16" />
            {{ t('approve') }}
          </button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.day-action-menu {
  background: white;
  border-radius: 1rem;
  border: 2px solid #e2e8f0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 0.5rem;
  min-width: 180px;
  animation: menuFadeIn 0.15s ease-out;
}

@keyframes menuFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.action-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1A1C1E;
  cursor: pointer;
  transition: background 0.15s;
}

.action-item:hover {
  background: #f1f5f9;
}

.action-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 0.25rem 0.5rem;
}

.custody-action {
  color: #d97706;
}

.custody-action:hover {
  background: #fffbeb;
}

.override-info {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #92400e;
  background: #fef3c7;
  border-radius: 0.5rem;
  margin: 0.25rem 0;
  text-align: center;
}

.override-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.action-btn {
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
  transition: all 0.2s;
  border: 2px solid;
}

.reject-btn {
  background: white;
  color: #dc2626;
  border-color: #fca5a5;
}

.reject-btn:hover {
  background: #fef2f2;
}

.approve-btn {
  background: #16a34a;
  color: white;
  border-color: #16a34a;
}

.approve-btn:hover {
  background: #15803d;
}
</style>
