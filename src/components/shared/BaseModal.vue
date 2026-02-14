<script setup>
import { onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  headerColor: {
    type: String,
    default: 'bg-slate-800'
  },
  headerStyle: {
    type: String,
    default: null
  },
  maxWidth: {
    type: String,
    default: '640px'
  },
  title: {
    type: String,
    default: ''
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  showFooter: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close'])

// Lock body scroll when modal is open
onMounted(() => {
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.body.style.overflow = ''
})

function handleEscape(e) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <Teleport to="body">
    <div class="base-modal-overlay" @click.self="$emit('close')">
      <div class="base-modal-container" :style="{ maxWidth }">

        <!-- Close Button -->
        <button class="base-modal-close" @click="$emit('close')">
          <X :size="24" />
        </button>

        <!-- Header Banner (optional) -->
        <div
          v-if="showHeader"
          class="base-modal-header"
          :class="!headerStyle ? headerColor : ''"
          :style="headerStyle ? { background: headerStyle } : {}"
        >
          <slot name="header">
            <h2 class="modal-title">{{ title }}</h2>
          </slot>
        </div>

        <!-- Scrollable Body -->
        <div class="base-modal-body">
          <slot />
        </div>

        <!-- Fixed Footer (optional) -->
        <div v-if="showFooter && $slots.footer" class="base-modal-footer">
          <slot name="footer" />
        </div>

      </div>
    </div>
  </Teleport>
</template>
