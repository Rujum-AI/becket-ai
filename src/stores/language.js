import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import en from '@/lib/translations/en'
import he from '@/lib/translations/he'

const STORAGE_KEY = 'becket_language'

export const useLanguageStore = defineStore('language', () => {
  // Load from localStorage or default to Hebrew
  const savedLang = localStorage.getItem(STORAGE_KEY)
  const lang = ref(savedLang || 'he')

  const translations = { en, he }

  function t(key) {
    return translations[lang.value]?.[key] || key
  }

  function toggleLang() {
    lang.value = lang.value === 'en' ? 'he' : 'en'
  }

  function setLang(l) {
    lang.value = l
  }

  const isRTL = computed(() => lang.value === 'he')

  // Watch for language changes and persist to localStorage
  watch(lang, (newLang) => {
    localStorage.setItem(STORAGE_KEY, newLang)
  })

  return { lang, t, toggleLang, setLang, isRTL }
})
