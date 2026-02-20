<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
import AiChat from './AiChat.vue'
import PhotoCaptureModal from '@/components/shared/PhotoCaptureModal.vue'
import NotificationOverlay from '@/components/shared/NotificationOverlay.vue'
import NudgeResponseModal from '@/components/family/NudgeResponseModal.vue'
import CheckInDetailModal from '@/components/family/CheckInDetailModal.vue'
import SuccessToast from '@/components/shared/SuccessToast.vue'
import { useCamera } from '@/composables/useCamera'
import { useI18n } from '@/composables/useI18n'
import { useUpdatesStore } from '@/stores/supabaseUpdates'
import { useFooterMenu } from '@/composables/useFooterMenu'

const { capturePhoto } = useCamera()
const { t } = useI18n()
const updatesStore = useUpdatesStore()
const { isWheelOpen } = useFooterMenu()

// Start realtime subscription
onMounted(() => {
  updatesStore.subscribeToRealtime()
})

onUnmounted(() => {
  updatesStore.unsubscribeRealtime()
})

// Camera system
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

// Check-in system (formerly "nudge")
const nudgeToRespond = ref(null)
const showNudgeToast = ref(false)
const checkInNotification = ref(null)

function openNudgeResponse(nudge) {
  nudgeToRespond.value = nudge
}

function closeNudgeResponse() {
  nudgeToRespond.value = null
}

function onNudgeSent() {
  nudgeToRespond.value = null
  showNudgeToast.value = true
}

function onToastDone() {
  showNudgeToast.value = false
}

function openCheckInDetail(notification) {
  checkInNotification.value = notification
}

function closeCheckInDetail() {
  checkInNotification.value = null
}
</script>

<template>
  <div>
    <AppHeader />
    <AiChat :menuOpen="isWheelOpen" />

    <main class="content-wrap px-6 sm:px-8">
      <slot />
    </main>

    <!-- Floating side buttons — flanking the wheel -->
    <div class="floating-camera" :class="{'menu-dismiss': isWheelOpen}" @click="openCamera">
      <img src="/assets/camera.png" class="w-full h-full object-contain" />
    </div>

    <AppFooter />

    <!-- Photo review modal -->
    <PhotoCaptureModal
      v-if="showPhotoModal"
      :photoBlob="capturedBlob"
      :photoDataUrl="capturedDataUrl"
      @close="closePhotoModal"
      @saved="closePhotoModal"
    />

    <!-- Live Notification Overlay (replaces NudgeBubble) -->
    <NotificationOverlay
      @openNudgeResponse="openNudgeResponse"
      @openCheckInDetail="openCheckInDetail"
    />

    <!-- Check-in response modal -->
    <NudgeResponseModal
      v-if="nudgeToRespond"
      :nudge="nudgeToRespond"
      @close="closeNudgeResponse"
      @sent="onNudgeSent"
    />

    <!-- Check-in detail modal (view response) -->
    <CheckInDetailModal
      v-if="checkInNotification"
      :notification="checkInNotification"
      @close="closeCheckInDetail"
    />

    <SuccessToast
      :show="showNudgeToast"
      :message="t('nudgeSentSuccess')"
      @done="onToastDone"
    />

    <!-- Copyright bar — always visible -->
    <div class="copyright-bar">
      <span>All rights reserved to Rujum 2026 &copy;</span>
      <span class="version-tag">v1.09</span>
    </div>
  </div>
</template>
