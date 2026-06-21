<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'

const props = defineProps({
  mood: {
    type: String,
    required: true,
    validator: v => ['loved', 'fun', 'ok', 'tired', 'upset', 'sick'].includes(v)
  }
})

const { t } = useI18n()

const moodLabels = {
  loved: 'moodLoved',
  fun: 'moodFun',
  ok: 'moodOk',
  tired: 'moodTired',
  upset: 'moodUpset',
  sick: 'moodSick'
}

const moodEmojis = {
  loved: '😍',
  fun: '😊',
  ok: '🙂',
  tired: '😴',
  upset: '😢',
  sick: '🤒'
}

const label = computed(() => t(moodLabels[props.mood]))
const emoji = computed(() => moodEmojis[props.mood])
</script>

<template>
  <span class="brief-mood" :class="`brief-mood--${mood}`">
    <span class="brief-mood__emoji" aria-hidden="true">{{ emoji }}</span>
    <span class="brief-mood__text">{{ label }}</span>
  </span>
</template>
