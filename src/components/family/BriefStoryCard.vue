<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import BriefMoodChip from './BriefMoodChip.vue'

const props = defineProps({
  event: { type: Object, required: true },
  index: { type: Number, default: 0 },
  signedUrls: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['openPhoto'])

const { t } = useI18n()

const artifacts = computed(() => props.event.artifacts || [])

const moods = computed(() =>
  artifacts.value.map(a => a.mood).filter(Boolean)
)

// Quiet mode when the day's tone is hard — halves rotation, hides ink-pen
// underline, calms the washi tape. Triggered by any artifact with upset/sick.
const isQuiet = computed(() =>
  moods.value.some(m => m === 'upset' || m === 'sick')
)

// Gallery: every artifact with a photo, in capture order. First one is the
// hero by default; user can tap a thumb to swap which is shown.
const photoArtifacts = computed(() =>
  artifacts.value.filter(a => a.photo_url)
)

const hasPhoto = computed(() => photoArtifacts.value.length > 0)

const heroIndex = ref(0)

// Reset hero to first photo when the event's photos change (parent prop change).
watch(photoArtifacts, () => { heroIndex.value = 0 })

const heroPhoto = computed(() => photoArtifacts.value[heroIndex.value] || null)

const heroSrc = computed(() => {
  if (!heroPhoto.value) return null
  return props.signedUrls[heroPhoto.value.id] || null
})

const hasMultiplePhotos = computed(() => photoArtifacts.value.length > 1)

// Photo aspect: square for activity / friend_visit events, portrait otherwise.
const photoAspectClass = computed(() =>
  ['activity', 'friend_visit'].includes(props.event.type)
    ? 'brief-card__photo--square'
    : ''
)

function formatRelativeTime(iso) {
  const date = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today - dateDay) / 86400000)
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', hour12: false
  })

  if (diffDays === 0) return `${t('today')} · ${time}`
  if (diffDays === 1) return `${t('yesterday')} · ${time}`
  return `${diffDays} ${t('daysAgo')}`
}

function selectThumb(i) {
  heroIndex.value = i
}

function openHero() {
  if (heroSrc.value) emit('openPhoto', heroSrc.value)
}
</script>

<template>
  <article
    class="brief-card"
    :class="{ 'brief-card--quiet': isQuiet, 'brief-card--no-photo': !hasPhoto }"
    :data-index="index % 6"
    :style="{ '--brief-card-index': index }"
  >
    <!-- Hero photo with mood stack overlay -->
    <div v-if="hasPhoto" class="brief-card__photo-wrap">
      <button
        type="button"
        class="brief-card__photo"
        :class="photoAspectClass"
        @click="openHero"
        :aria-label="event.title"
      >
        <img v-if="heroSrc" :src="heroSrc" :alt="event.title" :key="heroPhoto.id" />
        <div v-else class="brief-card__photo-placeholder"></div>
      </button>

      <div class="brief-mood-stack">
        <BriefMoodChip
          v-for="(m, i) in moods"
          :key="`m-${i}`"
          :mood="m"
        />
      </div>
    </div>

    <!-- Thumb strip (gallery navigation) when 2+ photos exist -->
    <div v-if="hasMultiplePhotos" class="brief-card__thumbs" role="tablist" :aria-label="event.title">
      <button
        v-for="(a, i) in photoArtifacts"
        :key="a.id"
        type="button"
        class="brief-card__thumb"
        :class="{ 'brief-card__thumb--active': i === heroIndex }"
        :aria-selected="i === heroIndex"
        role="tab"
        @click="selectThumb(i)"
      >
        <img v-if="signedUrls[a.id]" :src="signedUrls[a.id]" :alt="`photo ${i + 1}`" />
        <div v-else class="brief-card__thumb-placeholder"></div>
      </button>
    </div>

    <!-- Mood row inline for no-photo cards -->
    <div v-if="!hasPhoto && moods.length" class="brief-mood-stack">
      <BriefMoodChip
        v-for="(m, i) in moods"
        :key="`m-${i}`"
        :mood="m"
      />
    </div>

    <h3 class="brief-card__title">{{ event.title }}</h3>

    <div
      v-for="artifact in artifacts.filter(a => a.note)"
      :key="artifact.id"
      class="brief-card__note"
    >
      <p class="brief-note-body">{{ artifact.note }}</p>
      <p class="brief-byline">
        {{ t('briefFrom') }} {{ artifact.author_label || '' }}
        <span class="brief-byline__time">{{ formatRelativeTime(artifact.captured_at) }}</span>
      </p>
    </div>
  </article>
</template>
