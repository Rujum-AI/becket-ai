import { useLanguageStore } from '@/stores/language'

export function useI18n() {
  const langStore = useLanguageStore()
  return {
    t: langStore.t,
    lang: langStore.lang,
    toggleLang: langStore.toggleLang,
    setLang: langStore.setLang,
    isRTL: langStore.isRTL
  }
}
