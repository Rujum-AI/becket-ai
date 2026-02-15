<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useCamera } from '@/composables/useCamera'
import { useUpdatesStore } from '@/stores/supabaseUpdates'
import { useSupabaseDashboardStore as useDashboardStore } from '@/stores/supabaseDashboard'
import { useSnapshotsStore } from '@/stores/supabaseSnapshots'
import { Camera } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  nudge: { type: Object, required: true }
})

const emit = defineEmits(['close', 'sent'])

const { t } = useI18n()
const { capturePhoto } = useCamera()
const updatesStore = useUpdatesStore()
const dashboardStore = useDashboardStore()
const snapshotsStore = useSnapshotsStore()

const selectedMood = ref(null)
const messageText = ref('')
const photoBlob = ref(null)
const photoDataUrl = ref(null)
const sending = ref(false)

const moods = [
  { key: 'happy', emoji: '\u{1F60A}', labelKey: 'moodHappy' },
  { key: 'excited', emoji: '\u{1F929}', labelKey: 'moodExcited' },
  { key: 'playing', emoji: '\u{1F3AE}', labelKey: 'moodPlaying' },
  { key: 'sad', emoji: '\u{1F622}', labelKey: 'moodSad' },
  { key: 'sleeping', emoji: '\u{1F634}', labelKey: 'moodSleeping' },
  { key: 'sick', emoji: '\u{1F912}', labelKey: 'moodSick' }
]

const nudgeChild = computed(() => {
  if (!props.nudge?.related_entity_id) return null
  return dashboardStore.children.find(c => c.id === props.nudge.related_entity_id)
})

const canSend = computed(() => {
  return selectedMood.value || messageText.value.trim() || photoBlob.value
})

function selectMood(mood) {
  selectedMood.value = selectedMood.value === mood.key ? null : mood.key
}

async function takePhoto() {
  const result = await capturePhoto()
  if (result) {
    photoBlob.value = result.blob
    photoDataUrl.value = result.dataUrl
  }
}

function removePhoto() {
  photoBlob.value = null
  photoDataUrl.value = null
}

async function sendUpdate() {
  if (sending.value || !canSend.value) return
  sending.value = true

  try {
    let snapshotId = null

    // Upload photo if present
    if (photoBlob.value && nudgeChild.value) {
      const snapshot = await snapshotsStore.uploadSnapshot(photoBlob.value, {
        childIds: [nudgeChild.value.id],
        caption: messageText.value.trim() || null,
        category: 'photo'
      })
      snapshotId = snapshot.id
    }

    const moodObj = moods.find(m => m.key === selectedMood.value)
    const moodEmoji = moodObj?.emoji || ''

    const success = await updatesStore.respondToNudge(props.nudge.id, {
      mood: moodEmoji,
      message: messageText.value.trim(),
      snapshotId
    })

    if (success) {
      emit('sent')
    }
  } catch (err) {
    console.error('Error sending nudge response:', err)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <BaseModal
    headerStyle="linear-gradient(135deg, #BD5B39 0%, #9A3412 100%)"
    maxWidth="420px"
    @close="$emit('close')"
  >
    <template #header>
      <h2 class="modal-title">{{ t('quickUpdate') }}</h2>
    </template>

    <!-- Child info -->
    <div v-if="nudgeChild" class="nudge-child-info">
      <img
        :src="nudgeChild.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'"
        class="nudge-child-avatar"
        :alt="nudgeChild.name"
      />
      <span class="nudge-child-name">{{ nudgeChild.name }}</span>
    </div>

    <!-- Mood selector -->
    <div class="nudge-section">
      <label class="field-label center">{{ t('howAreThey') }}</label>
      <div class="mood-grid">
        <button
          v-for="mood in moods"
          :key="mood.key"
          class="mood-btn"
          :class="{ selected: selectedMood === mood.key }"
          @click="selectMood(mood)"
        >
          <span class="mood-emoji">{{ mood.emoji }}</span>
          <span class="mood-label">{{ t(mood.labelKey) }}</span>
        </button>
      </div>
    </div>

    <!-- Message -->
    <div class="nudge-section">
      <label class="field-label">{{ t('nudgeMessageLabel') }}</label>
      <input
        v-model="messageText"
        type="text"
        :placeholder="t('nudgeMessagePlaceholder')"
        class="modal-form-input"
      />
    </div>

    <!-- Photo -->
    <div class="nudge-section">
      <div v-if="photoDataUrl" class="photo-preview-wrap">
        <img :src="photoDataUrl" class="nudge-photo-preview" />
        <button class="photo-remove-btn" @click="removePhoto">{{ t('photoRemove') }}</button>
      </div>
      <button v-else class="nudge-camera-btn" @click="takePhoto">
        <Camera :size="18" />
        {{ t('takePhoto') }}
      </button>
    </div>

    <template #footer>
      <div class="modal-action-bar">
        <button class="modal-secondary-btn" @click="$emit('close')">
          {{ t('cancel') }}
        </button>
        <button
          class="modal-primary-btn nudge-send-btn"
          :disabled="!canSend || sending"
          @click="sendUpdate"
        >
          {{ sending ? t('sending') : t('sendUpdate') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.nudge-child-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.nudge-child-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  object-fit: cover;
}

.nudge-child-name {
  font-size: 1.1rem;
  font-weight: 800;
  color: #0f172a;
}

.nudge-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.field-label.center {
  text-align: center;
  display: block;
}

.mood-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
}

@media (max-width: 400px) {
  .mood-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.mood-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.25rem;
  border-radius: 1rem;
  border: 2px solid #e2e8f0;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.mood-btn:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.mood-btn.selected {
  border-color: #0f172a;
  background: #f0f9ff;
  transform: scale(1.05);
}

.mood-emoji {
  font-size: 1.75rem;
  line-height: 1;
}

.mood-label {
  font-size: 0.55rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #64748b;
}

.photo-preview-wrap {
  position: relative;
}

.nudge-photo-preview {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
}

.photo-remove-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 0.4rem 0.8rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.photo-remove-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

[dir="rtl"] .photo-remove-btn {
  right: auto;
  left: 8px;
}

.nudge-camera-btn {
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  border: 2px dashed #e2e8f0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #64748b;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.nudge-camera-btn:hover {
  border-color: #94a3b8;
  background: #f8fafc;
}

.nudge-send-btn {
  background: linear-gradient(135deg, #0D9488 0%, #0E7490 100%);
}

.nudge-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
