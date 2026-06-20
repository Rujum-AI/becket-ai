import { ref } from 'vue'
import { useLanguageStore } from '@/stores/language'

// Module-scoped reactive ref so stores can fire toasts without prop drilling.
// AppLayout reads `toastState` and renders a single SuccessToast.
const toastState = ref({ visible: false, message: '', token: 0 })

function resolveMessage(key) {
  if (!key) return ''
  try {
    const langStore = useLanguageStore()
    return langStore.t(key)
  } catch {
    return key
  }
}

export function showToast(messageKey) {
  toastState.value = {
    visible: true,
    message: resolveMessage(messageKey),
    token: toastState.value.token + 1
  }
}

export function hideToast() {
  toastState.value = { ...toastState.value, visible: false }
}

// Run `action`, fire a success toast on resolve, swallow errors silently
// after logging — stores already track `error.value`, callers can branch
// on the awaited return (null = failed). Keeps every store action one
// line away from "user sees confirmation + reading component refreshes".
export async function withToast(action, successKey) {
  try {
    const result = await action()
    showToast(successKey)
    return result
  } catch (err) {
    console.error('[withToast] action failed:', err)
    return null
  }
}

export function useToast() {
  return { toastState, showToast, hideToast, withToast }
}
