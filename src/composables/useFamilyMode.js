import { computed } from 'vue'
import { useFamily } from '@/composables/useFamily'

// Reactive view of the family's mode flags. Drives feature gating across the
// app: separated families get the full co-parent scope (balance, split,
// out-of-rule approvals, understandings); solo/together families get a
// lightweight tracker — same data, half the ceremony.
//
// One composable, one source of truth, so every view stays in sync if
// family_type changes mid-session.
export function useFamilyMode() {
  const { family } = useFamily()

  const familyType = computed(() => family.value?.family_type || null)
  const isSeparated = computed(() => familyType.value === 'separated')
  const isTogether = computed(() => familyType.value === 'together')
  const isSolo = computed(() => familyType.value === 'solo')

  return {
    familyType,
    isSeparated,
    isTogether,
    isSolo,
    showBalance: isSeparated,
    showSplit: isSeparated,
    requiresApproval: isSeparated,
    showUnderstandings: isSeparated
  }
}
