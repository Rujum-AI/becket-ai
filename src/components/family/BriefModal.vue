<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { useSnapshotsStore } from '@/stores/supabaseSnapshots'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  child: {
    type: Object,
    required: true
  }
})

defineEmits(['close'])

const { t } = useI18n()
const dashboardStore = useSupabaseDashboardStore()
const snapshotsStore = useSnapshotsStore()

const viewMode = ref('since-last-seen')
const briefData = ref(null)
const briefLoading = ref(true)
const briefError = ref(null)
const fullSizePhoto = ref(null)
const signedUrls = ref({})

async function loadBrief() {
  briefLoading.value = true
  briefError.value = null
  try {
    briefData.value = await dashboardStore.generateBrief(
      props.child.id,
      viewMode.value
    )
    // Resolve signed URLs for snapshot items
    const photoItems = (briefData.value?.items || []).filter(i => i.photoUrl)
    const urls = {}
    await Promise.all(photoItems.map(async (item) => {
      urls[item.id] = await snapshotsStore.getSignedUrl(item.photoUrl)
    }))
    signedUrls.value = urls
  } catch (err) {
    briefError.value = err.message || 'Failed to load brief'
  } finally {
    briefLoading.value = false
  }
}

onMounted(loadBrief)

watch(viewMode, loadBrief)

function toggleViewMode() {
  viewMode.value = viewMode.value === 'since-last-seen' ? 'today' : 'since-last-seen'
}

function getEventIcon(type) {
  const icons = {
    activity: '⚽',
    school: '📚',
    dropoff: '🚗',
    pickup: '👋',
    appointment: '🏥',
    friend_visit: '🏠',
    manual: '📝',
    snapshot: '📸'
  }
  return icons[type] || '📌'
}

function formatSinceDate(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today - dateDay) / 86400000)
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  if (diffDays === 0) return `${t('today')} ${t('at')} ${time}`
  if (diffDays === 1) return `${t('yesterday')} ${t('at')} ${time}`
  return `${diffDays} ${t('daysAgo')}`
}
</script>

<template>
  <BaseModal
    headerStyle="#FCD34D"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <img
        :src="child.gender === 'boy' ? '/assets/brief_boy.png' : '/assets/brief_girl.png'"
        class="brief-hero-img"
        :alt="child.name"
      />
      <h2 class="modal-title">{{ child.name }}'s {{ t('recap') }}</h2>
      <p class="modal-subtitle">
        <template v-if="briefLoading">{{ t('sinceLastSeen') }}</template>
        <template v-else-if="viewMode === 'today'">{{ t('todayOnly') }}</template>
        <template v-else-if="briefData?.sinceDate">
          {{ t('sinceLastSeen') }} &mdash; {{ formatSinceDate(briefData.sinceDate) }}
        </template>
        <template v-else>{{ t('sinceLastSeen') }}</template>
      </p>
    </template>

    <!-- Toggle button -->
    <div class="view-toggle">
      <button @click="toggleViewMode" class="toggle-btn" :disabled="briefLoading">
        {{ viewMode === 'since-last-seen' ? t('showTodayOnly') : t('showSinceLastSeen') }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="briefLoading" class="timeline-loading">
      <div v-for="i in 3" :key="i" class="skeleton-item">
        <div class="skeleton-dot"></div>
        <div class="skeleton-content">
          <div class="skeleton-line skeleton-line-short"></div>
          <div class="skeleton-line skeleton-line-long"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="briefError" class="brief-empty">
      <p class="empty-icon">⚠️</p>
      <p class="empty-text">{{ briefError }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!briefData?.items?.length" class="brief-empty">
      <p class="empty-icon">📭</p>
      <p class="empty-text">{{ t('noEventsInBrief') }}</p>
      <p v-if="!briefData?.hadHandoff" class="empty-subtext">{{ t('noHandoffFound') }}</p>
    </div>

    <!-- Timeline -->
    <div v-else class="timeline">
      <div
        v-for="(event, index) in briefData.items"
        :key="event.id || index"
        class="timeline-item"
      >
        <div class="timeline-dot">
          <span class="event-icon">{{ getEventIcon(event.type) }}</span>
        </div>
        <div class="timeline-content">
          <div class="timeline-header">
            <h3 class="timeline-title">{{ event.title }}</h3>
            <span class="timeline-time">{{ event.time }}</span>
          </div>
          <img
            v-if="event.photoUrl && signedUrls[event.id]"
            :src="signedUrls[event.id]"
            class="timeline-photo"
            alt="Snapshot"
            @click="fullSizePhoto = signedUrls[event.id]"
          />
          <p v-if="event.description" class="timeline-description">{{ event.description }}</p>
          <span class="timeline-timestamp">{{ event.timestamp }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="modal-primary-btn" @click="$emit('close')">
        {{ t('close') }}
      </button>
    </template>
  </BaseModal>

  <!-- Full-size photo overlay -->
  <Teleport to="body">
    <div v-if="fullSizePhoto" class="fullsize-overlay" @click="fullSizePhoto = null">
      <img :src="fullSizePhoto" class="fullsize-img" alt="Full size photo" />
    </div>
  </Teleport>
</template>

<style scoped>
.brief-hero-img {
  width: 6rem;
  height: 6rem;
  object-fit: contain;
}

.modal-subtitle {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.view-toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.toggle-btn {
  padding: 0.75rem 1.5rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 2rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.timeline {
  position: relative;
  padding-left: 3rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 1.25rem;
  top: 0;
  bottom: 3rem;
  width: 3px;
  background: linear-gradient(to bottom, #cbd5e1 0%, #cbd5e1 100%);
}

.timeline-item {
  position: relative;
  padding-left: 2.5rem;
  margin-bottom: 2rem;
}

.timeline-dot {
  position: absolute;
  left: -2.75rem;
  top: 0;
  width: 2.5rem;
  height: 2.5rem;
  background: white;
  border: 3px solid #0d9488;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.2);
  z-index: 2;
}

.event-icon {
  font-size: 1.125rem;
}

.timeline-content {
  background: #f8fafc;
  border-radius: 1rem;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
}

.timeline-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1A1C1E;
  margin: 0;
  flex: 1;
}

.timeline-time {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.timeline-description {
  font-size: 0.9375rem;
  color: #475569;
  line-height: 1.5;
  margin: 0 0 0.5rem 0;
}

.timeline-timestamp {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #94a3b8;
}

/* Loading skeleton */
.timeline-loading {
  padding-left: 3rem;
}

.skeleton-item {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
  align-items: flex-start;
}

.skeleton-dot {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-line {
  height: 1rem;
  border-radius: 0.5rem;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-line-short { width: 40%; }
.skeleton-line-long { width: 80%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty / Error state */
.brief-empty {
  text-align: center;
  padding: 3rem 1rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-text {
  font-size: 1rem;
  font-weight: 700;
  color: #64748b;
}

.empty-subtext {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-top: 0.5rem;
}

.timeline-photo {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 0.75rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.timeline-photo:hover {
  opacity: 0.85;
}

.fullsize-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.fullsize-img {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
  border-radius: 1rem;
}
</style>
