import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'

// Single source of truth for items awaiting the OTHER parent's decision.
// Backed by the pending_actions table; the decide-side DB trigger
// (migration 036) handles updating the target row's status atomically
// when status flips to approved/rejected.
//
// Consumers (Pending Expenses, Pending Events sections) filter by
// target_type. AI plugs in here later — it can decide() on a row just
// like a parent would.
export const useSupabasePendingActionsStore = defineStore('supabasePendingActions', () => {
  const { user } = useAuth()
  const { family } = useFamily()

  const pending = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function load() {
    if (!family.value) return
    loading.value = true
    error.value = null
    try {
      const { data, error: fetchError } = await supabase
        .from('pending_actions')
        .select('*')
        .eq('family_id', family.value.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      pending.value = data || []
    } catch (err) {
      console.error('Error loading pending_actions:', err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // Rows the CURRENT user needs to decide on (i.e., the OTHER parent
  // proposed them). The requester's own pending rows don't show up here.
  const incoming = computed(() => {
    const uid = user.value?.id
    if (!uid) return []
    return pending.value.filter(a => a.requested_by !== uid)
  })

  function incomingByType(targetType) {
    return computed(() => incoming.value.filter(a => a.target_type === targetType))
  }

  async function decide(actionId, decision, decisionReason = null) {
    if (!['approved', 'rejected'].includes(decision)) {
      throw new Error(`Invalid decision: ${decision}`)
    }
    const { error: updateError } = await supabase
      .from('pending_actions')
      .update({
        status: decision,
        decided_by: user.value.id,
        decided_at: new Date().toISOString(),
        decision_reason: decisionReason
      })
      .eq('id', actionId)
    if (updateError) throw updateError
    await load()
  }

  return {
    pending,
    incoming,
    incomingByType,
    loading,
    error,
    load,
    decide
  }
})
