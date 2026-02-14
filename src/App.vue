<script setup>
import { watch, onMounted } from 'vue'
import { useLanguageStore } from '@/stores/language'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'

const langStore = useLanguageStore()
const { initAuth, user } = useAuth()
const { checkUserFamily } = useFamily()

watch(() => langStore.lang, (newLang) => {
  document.documentElement.lang = newLang
  document.documentElement.dir = newLang === 'he' ? 'rtl' : 'ltr'
  document.body.className = newLang === 'en' ? 'lang-en' : 'lang-he'
}, { immediate: true })

// Initialize auth on app mount
onMounted(async () => {
  await initAuth()

  // After auth is initialized, load family data if user is logged in
  if (user.value) {
    await checkUserFamily(user.value.id)
  }
})

// Watch for auth changes and load family when user logs in
watch(user, async (newUser) => {
  if (newUser) {
    await checkUserFamily(newUser.id)
  }
})
</script>

<template>
  <RouterView />
</template>
