<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { useSnapshotsStore } from '@/stores/supabaseSnapshots'
import BaseModal from '@/components/shared/BaseModal.vue'
import BriefStoryCard from './BriefStoryCard.vue'
import { SECTION_COLORS } from '@/lib/modalColors'

const props = defineProps({
  child: { type: Object, required: true }
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

    const urls = {}
    const photoArtifacts = (briefData.value?.events || [])
      .flatMap(e => e.artifacts || [])
      .filter(a => a.photo_url)
    await Promise.all(photoArtifacts.map(async (a) => {
      urls[a.id] = await snapshotsStore.getSignedUrl(a.photo_url)
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

// Group events by calendar day. Returns ordered groups [{ dayKey, dayLabel, events }].
const dayGroups = computed(() => {
  const events = briefData.value?.events || []
  if (!events.length) return []

  const dayKeyToLabel = ['briefDaySunday', 'briefDayMonday', 'briefDayTuesday',
                        'briefDayWednesday', 'briefDayThursday', 'briefDayFriday',
                        'briefDaySaturday']

  const groups = new Map()
  for (const ev of events) {
    const d = new Date(ev.start_time)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!groups.has(key)) {
      groups.set(key, {
        dayKey: key,
        dayLabel: t(dayKeyToLabel[d.getDay()]),
        sortAt: d.getTime(),
        events: []
      })
    }
    groups.get(key).events.push(ev)
  }
  return Array.from(groups.values()).sort((a, b) => a.sortAt - b.sortAt)
})

const flatIndexLookup = computed(() => {
  const map = new Map()
  let i = 0
  for (const group of dayGroups.value) {
    for (const ev of group.events) {
      map.set(ev.event_id, i++)
    }
  }
  return map
})

const hasContent = computed(() => (briefData.value?.events || []).length > 0)
</script>

<template>
  <BaseModal
    :headerStyle="SECTION_COLORS.family"
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

    <div class="brief-paper brief-modal-body">
      <!-- Toggle button -->
      <div class="view-toggle">
        <button @click="toggleViewMode" class="toggle-btn" :disabled="briefLoading">
          {{ viewMode === 'since-last-seen' ? t('showTodayOnly') : t('showSinceLastSeen') }}
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="briefLoading" class="brief-skeleton-list">
        <div v-for="i in 2" :key="i" class="brief-skeleton-card">
          <div class="brief-skeleton-photo"></div>
          <div class="brief-skeleton-title"></div>
          <div class="brief-skeleton-line"></div>
          <div class="brief-skeleton-line brief-skeleton-line--short"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="briefError" class="brief-empty-warm">
        <p class="brief-empty-warm__hero">{{ briefError }}</p>
      </div>

      <!-- Empty (warm, named) -->
      <div v-else-if="!hasContent" class="brief-empty-warm">
        <p class="brief-empty-warm__hero">
          {{ t('briefEmptyHeroPrefix') }} {{ child.name }}.
        </p>
        <p class="brief-empty-warm__sub">
          {{ briefData?.hadHandoff ? t('briefEmptySub') : t('noHandoffFound') }}
        </p>
      </div>

      <!-- Storyboard -->
      <div v-else class="brief-storyboard">
        <template v-for="group in dayGroups" :key="group.dayKey">
          <div class="brief-day-spine">{{ group.dayLabel }}</div>
          <BriefStoryCard
            v-for="event in group.events"
            :key="event.event_id"
            :event="event"
            :index="flatIndexLookup.get(event.event_id)"
            :signed-urls="signedUrls"
            @open-photo="(src) => fullSizePhoto = src"
          />
        </template>
      </div>
    </div>

    <template #footer>
      <button class="modal-primary-btn" @click="$emit('close')">
        {{ t('close') }}
      </button>
    </template>
  </BaseModal>

  <Teleport to="body">
    <div v-if="fullSizePhoto" class="brief-lightbox" @click="fullSizePhoto = null">
      <img :src="fullSizePhoto" alt="" />
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

.brief-modal-body {
  padding-top: 8px;
  margin: -8px -16px 0;
  padding: 8px 16px 16px;
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
.toggle-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }
.toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.brief-storyboard {
  padding-bottom: 8px;
}

/* Skeleton card shape mirrors the storyboard card for consistency on load */
.brief-skeleton-list { padding: 8px 0; }
.brief-skeleton-card {
  background: #FAF6EE;
  border-radius: 18px;
  padding: 18px;
  margin-bottom: 28px;
  border: 1px solid rgba(26, 28, 30, 0.06);
  box-shadow: 0 8px 16px -8px rgba(141, 117, 80, 0.20);
}
.brief-skeleton-photo {
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(26,28,30,0.06) 25%, rgba(26,28,30,0.10) 50%, rgba(26,28,30,0.06) 75%);
  background-size: 200% 100%;
  animation: brief-shimmer 1.6s infinite;
  margin-bottom: 14px;
}
.brief-skeleton-title {
  height: 22px;
  width: 60%;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(26,28,30,0.06) 25%, rgba(26,28,30,0.10) 50%, rgba(26,28,30,0.06) 75%);
  background-size: 200% 100%;
  animation: brief-shimmer 1.6s infinite;
  margin-bottom: 12px;
}
.brief-skeleton-line {
  height: 12px;
  width: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(26,28,30,0.04) 25%, rgba(26,28,30,0.08) 50%, rgba(26,28,30,0.04) 75%);
  background-size: 200% 100%;
  animation: brief-shimmer 1.6s infinite;
  margin-bottom: 6px;
}
.brief-skeleton-line--short { width: 40%; }
@keyframes brief-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
