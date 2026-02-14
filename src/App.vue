<script setup>
import { watch, onMounted } from 'vue'
import { useLanguageStore } from '@/stores/language'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'

const langStore = useLanguageStore()
const { initAuth, user, loading } = useAuth()
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
  <!-- Loading spinner during initial session restore -->
  <div v-if="loading" class="app-loading">
    <div class="loading-content">
      <img src="/assets/becket_logo.png" alt="Becket AI" class="loading-logo">
      <div class="loading-spinner"></div>
    </div>
  </div>

  <RouterView v-else />
</template>

<style scoped>
.app-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FAF6F1;
}

.loading-content {
  text-align: center;
}

.loading-logo {
  height: 4rem;
  margin-bottom: 1.5rem;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e2e8f0;
  border-top-color: #C2571A;
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
