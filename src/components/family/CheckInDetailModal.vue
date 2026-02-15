<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSnapshotsStore } from '@/stores/supabaseSnapshots'
import { supabase } from '@/lib/supabase'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  notification: { type: Object, required: true }
})

defineEmits(['close'])

const { t } = useI18n()
const snapshotsStore = useSnapshotsStore()

const photoUrl = ref(null)
const loading = ref(false)

// Parse mood emoji from the message (first emoji character)
const moodEmoji = computed(() => {
  const msg = props.notification.message || ''
  const match = msg.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u)
  return match ? match[0] : null
})

// Message text (everything after the leading emoji)
const messageText = computed(() => {
  const msg = props.notification.message || ''
  return msg.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u, '').trim()
})

onMounted(async () => {
  if (
    props.notification.related_entity_type === 'snapshot' &&
    props.notification.related_entity_id
  ) {
    loading.value = true
    try {
      const { data } = await supabase
        .from('snapshots')
        .select('file_url')
        .eq('id', props.notification.related_entity_id)
        .maybeSingle()

      if (data?.file_url) {
        photoUrl.value = await snapshotsStore.getSignedUrl(data.file_url)
      }
    } catch (err) {
      console.error('Error fetching check-in photo:', err)
    } finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <BaseModal
    headerStyle="linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
    maxWidth="420px"
    @close="$emit('close')"
  >
    <template #header>
      <h2 class="modal-title">{{ t('checkInDetail') }}</h2>
    </template>

    <!-- Sender -->
    <div class="checkin-sender">
      <span>{{ notification.title }}</span>
    </div>

    <!-- Mood emoji (large) -->
    <div v-if="moodEmoji" class="checkin-mood">
      <span class="mood-large">{{ moodEmoji }}</span>
    </div>

    <!-- Message -->
    <div v-if="messageText" class="checkin-message">
      <p>{{ messageText }}</p>
    </div>

    <!-- No content fallback -->
    <div v-if="!moodEmoji && !messageText && !photoUrl" class="checkin-message">
      <p class="checkin-fallback">Update sent</p>
    </div>

    <!-- Photo -->
    <div v-if="loading" class="checkin-photo-loading">
      <div class="loading-spinner"></div>
    </div>
    <div v-else-if="photoUrl" class="checkin-photo">
      <img :src="photoUrl" class="checkin-photo-img" alt="" />
    </div>

    <template #footer>
      <div class="modal-action-bar">
        <button class="modal-primary-btn checkin-close-btn" @click="$emit('close')">
          {{ t('close') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.checkin-sender {
  text-align: center;
  font-size: 0.9rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 1rem;
}

.checkin-mood {
  text-align: center;
  margin-bottom: 1rem;
}

.mood-large {
  font-size: 4rem;
  line-height: 1;
}

.checkin-message {
  text-align: center;
  margin-bottom: 1rem;
}

.checkin-message p {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  margin: 0;
}

.checkin-fallback {
  color: #94a3b8 !important;
  font-style: italic;
}

.checkin-photo {
  border-radius: 1rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.checkin-photo-img {
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  display: block;
}

.checkin-photo-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #ef4444;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.checkin-close-btn {
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  width: 100%;
}
</style>
