<script setup>
import { ref } from 'vue'
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
import AiChat from './AiChat.vue'
import PhotoCaptureModal from '@/components/shared/PhotoCaptureModal.vue'
import { Camera } from 'lucide-vue-next'
import { useCamera } from '@/composables/useCamera'

const { capturePhoto } = useCamera()

const showPhotoModal = ref(false)
const capturedBlob = ref(null)
const capturedDataUrl = ref(null)

async function openCamera() {
  const result = await capturePhoto()
  if (!result) return
  capturedBlob.value = result.blob
  capturedDataUrl.value = result.dataUrl
  showPhotoModal.value = true
}

function closePhotoModal() {
  showPhotoModal.value = false
  capturedBlob.value = null
  capturedDataUrl.value = null
}
</script>

<template>
  <div>
    <AppHeader />
    <AiChat />

    <!-- Floating camera button (opposite side of AI chat) -->
    <div class="floating-camera" @click="openCamera">
      <Camera :size="28" color="white" />
    </div>

    <main class="content-wrap px-6 sm:px-8">
      <slot />
    </main>
    <AppFooter />

    <!-- Photo review modal -->
    <PhotoCaptureModal
      v-if="showPhotoModal"
      :photoBlob="capturedBlob"
      :photoDataUrl="capturedDataUrl"
      @close="closePhotoModal"
      @saved="closePhotoModal"
    />
  </div>
</template>
