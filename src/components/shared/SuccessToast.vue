<script setup>
import { watch } from 'vue'

const props = defineProps({
  message: { type: String, required: true },
  duration: { type: Number, default: 3000 },
  show: { type: Boolean, default: false }
})

const emit = defineEmits(['done'])

watch(() => props.show, (val) => {
  if (val) {
    setTimeout(() => emit('done'), props.duration)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="toast-fade">
      <div v-if="show" class="success-toast">
        <span class="toast-check">&#10003;</span>
        <span class="toast-text">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.success-toast {
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(16, 185, 129, 0.95);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 0.9rem;
  z-index: 4000;
  box-shadow: 0 8px 30px rgba(16, 185, 129, 0.4);
  pointer-events: none;
}

.toast-check {
  font-size: 1.1rem;
  font-weight: 900;
}

.toast-text {
  white-space: nowrap;
}

.toast-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px) scale(0.9);
}

.toast-fade-leave-active {
  transition: all 0.3s ease-in;
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}
</style>
