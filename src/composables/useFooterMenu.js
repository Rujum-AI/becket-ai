import { ref } from 'vue'

const isWheelOpen = ref(false)

export function useFooterMenu() {
  return { isWheelOpen }
}
