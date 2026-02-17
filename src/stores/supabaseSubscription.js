import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useFamily } from '@/composables/useFamily'

export const useSupabaseSubscriptionStore = defineStore('supabaseSubscription', () => {
  const { family } = useFamily()

  const subscription = ref(null)
  const paymentEvents = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Load active subscription for the family
  async function loadSubscription() {
    if (!family.value) return

    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('family_id', family.value.id)
        .maybeSingle()

      if (fetchError) throw fetchError

      subscription.value = data
    } catch (err) {
      console.error('Error loading subscription:', err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // Load payment history (billing events)
  async function loadPaymentHistory() {
    if (!family.value) return

    try {
      const { data, error: fetchError } = await supabase
        .from('payment_events')
        .select('*')
        .eq('family_id', family.value.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchError) throw fetchError

      paymentEvents.value = data || []
    } catch (err) {
      console.error('Error loading payment history:', err)
      error.value = err.message
    }
  }

  // Is the subscription currently active or trialing?
  const isActive = computed(() => {
    if (!subscription.value) return false
    return ['active', 'trialing'].includes(subscription.value.status)
  })

  // Is the user on the free plan (no active subscription)?
  const isFree = computed(() => {
    return !subscription.value || !isActive.value
  })

  // Current plan name key (for translation)
  const planKey = computed(() => {
    if (!subscription.value || !isActive.value) return 'planEssential'
    const map = {
      'essential': 'planEssential',
      'ai-assistant': 'planAiAssistant',
      'ai-mediator': 'planAiMediator',
      'full': 'planFull'
    }
    return map[subscription.value.plan] || 'planEssential'
  })

  // Current status key (for translation)
  const statusKey = computed(() => {
    if (!subscription.value) return 'statusNone'
    const map = {
      'active': 'statusActive',
      'cancelled': 'statusCancelled',
      'paused': 'statusPaused',
      'past_due': 'statusPastDue',
      'expired': 'statusExpired',
      'trialing': 'statusTrialing',
      'unpaid': 'statusUnpaid'
    }
    return map[subscription.value.status] || 'statusNone'
  })

  // Days remaining in current billing period
  const daysRemaining = computed(() => {
    if (!subscription.value?.current_period_end) return null
    const end = new Date(subscription.value.current_period_end)
    const now = new Date()
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  })

  // Renewal date formatted
  const renewalDate = computed(() => {
    if (!subscription.value?.renews_at) return null
    return new Date(subscription.value.renews_at)
  })

  // Card display string (e.g. "Visa •••• 4242")
  const cardDisplay = computed(() => {
    if (!subscription.value?.card_brand || !subscription.value?.card_last_four) return null
    const brand = subscription.value.card_brand.charAt(0).toUpperCase() +
      subscription.value.card_brand.slice(1)
    return `${brand} •••• ${subscription.value.card_last_four}`
  })

  return {
    subscription,
    paymentEvents,
    loading,
    error,
    isActive,
    isFree,
    planKey,
    statusKey,
    daysRemaining,
    renewalDate,
    cardDisplay,
    loadSubscription,
    loadPaymentHistory
  }
})
