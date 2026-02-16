<script setup>
import { ref } from 'vue'
import { X, Mic, Send } from 'lucide-vue-next'

const props = defineProps({
  menuOpen: { type: Boolean, default: false }
})

const isOpen = ref(false)
const input = ref('')

function openChat() {
  isOpen.value = true
}

function closeChat() {
  isOpen.value = false
}

function autoResize(event) {
  const el = event.target
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function sendMessage() {
  if (!input.value.trim()) return
  console.log("Sending:", input.value)
  input.value = ''
}
</script>

<template>
  <div>
    <div class="floating-ai" :class="{'hidden-ai': isOpen, 'menu-dismiss': menuOpen}" @click="openChat">
      <img src="/assets/AI_CHAT.png" class="w-full h-full object-contain">
    </div>

    <div class="ai-chat-interface" :class="{'open': isOpen}">
      <div class="btn-close-chat" @click="closeChat">
        <X class="w-6 h-6" />
      </div>

      <div class="chat-input-wrapper">
        <div class="chat-action-btn btn-mic">
          <Mic class="w-6 h-6" />
        </div>
        <textarea
          v-model="input"
          class="chat-textarea"
          placeholder="Ask Becket AI..."
          rows="4"
          @input="autoResize"
          @keyup.enter.exact="sendMessage"
        ></textarea>
        <div class="chat-action-btn btn-send" @click="sendMessage">
          <Send class="w-5 h-5" />
        </div>
      </div>
    </div>
  </div>
</template>
