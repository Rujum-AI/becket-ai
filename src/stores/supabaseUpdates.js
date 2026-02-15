import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'

export const useUpdatesStore = defineStore('supabaseUpdates', () => {
  const { user } = useAuth()

  const updates = ref([])
  const loading = ref(false)
  const error = ref(null)

  // UI filter state (local, not persisted)
  const selectedCategory = ref('all')
  const selectedTimeFilter = ref('all')

  // === Live Overlay System ===
  const overlayQueue = ref([])
  const realtimeChannel = ref(null)
  const AUTO_FADE_MS = 8000
  const MAX_OVERLAY_ITEMS = 4

  // Types that are auto-pinned (urgent tier)
  const AUTO_PIN_TYPES = new Set([
    'nudge_request',
    'nudge_response',
    'expense_pending',
    'understanding_proposed',
    'custody_override_requested',
    'ask_received'
  ])

  // Computed: unread count
  const unreadCount = computed(() => {
    return updates.value.filter(u => !u.read).length
  })

  // Computed: available categories from data
  const categories = computed(() => {
    const cats = new Set(updates.value.map(u => u.category))
    return ['all', ...Array.from(cats)]
  })

  // Computed: filtered updates by category + time
  const filteredUpdates = computed(() => {
    let filtered = updates.value

    // Filter by category
    if (selectedCategory.value !== 'all') {
      filtered = filtered.filter(u => u.category === selectedCategory.value)
    }

    // Filter by time
    if (selectedTimeFilter.value !== 'all') {
      const now = new Date()

      if (selectedTimeFilter.value === 'unread') {
        filtered = filtered.filter(u => !u.read)
      } else if (selectedTimeFilter.value === 'day') {
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000)
        filtered = filtered.filter(u => new Date(u.created_at) >= oneDayAgo)
      } else if (selectedTimeFilter.value === 'week') {
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
        filtered = filtered.filter(u => new Date(u.created_at) >= oneWeekAgo)
      }
    }

    return filtered
  })

  // Computed: pending nudges (received, awaiting response)
  const pendingNudges = computed(() => {
    return updates.value.filter(u =>
      u.category === 'nudge' &&
      u.type === 'nudge_request' &&
      u.requires_action &&
      !u.action_taken
    )
  })

  // Actions

  /**
   * Fetch notifications for the current user
   * Ordered by created_at DESC, limited to most recent 100
   */
  async function fetchUpdates() {
    if (!user.value?.id) {
      console.warn('Cannot fetch updates: no authenticated user')
      updates.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.value.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (fetchError) throw fetchError

      // Map DB fields to UI format (timestamp → created_at)
      updates.value = (data || []).map(notification => ({
        ...notification,
        timestamp: notification.created_at // Add timestamp alias for UI compatibility
      }))

      console.log(`📬 Fetched ${updates.value.length} notifications`)
    } catch (err) {
      console.error('Error fetching updates:', err)
      error.value = err.message
      updates.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Mark a single notification as read
   */
  async function markAsRead(id) {
    // Optimistic update
    const update = updates.value.find(u => u.id === id)
    if (update && !update.read) {
      update.read = true
      update.read_at = new Date().toISOString()

      try {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', id)

        if (updateError) throw updateError
      } catch (err) {
        console.error('Error marking notification as read:', err)
        // Revert optimistic update on error
        update.read = false
        update.read_at = null
      }
    }
  }

  /**
   * Mark all unread notifications as read
   */
  async function markAllAsRead() {
    if (!user.value?.id) return

    // Optimistic update
    const now = new Date().toISOString()
    updates.value.forEach(u => {
      if (!u.read) {
        u.read = true
        u.read_at = now
      }
    })

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: now
        })
        .eq('recipient_id', user.value.id)
        .eq('read', false)

      if (updateError) throw updateError

      console.log('✓ Marked all notifications as read')
    } catch (err) {
      console.error('Error marking all as read:', err)
      // Revert on error — re-fetch to get true state
      await fetchUpdates()
    }
  }

  /**
   * Send a nudge to co-parent requesting a child update.
   * Uses server-side SECURITY DEFINER function to bypass RLS.
   */
  async function sendNudge(childId, childName) {
    if (!user.value?.id) return null

    try {
      const { data, error: rpcError } = await supabase
        .rpc('send_nudge', {
          p_child_id: childId,
          p_child_name: childName
        })

      if (rpcError) throw rpcError
      return data // returns the notification ID
    } catch (err) {
      console.error('Error sending nudge:', err)
      return null
    }
  }

  /**
   * Respond to a nudge with mood emoji, message, and optional photo.
   * Uses server-side SECURITY DEFINER function to bypass RLS.
   */
  async function respondToNudge(nudgeId, { mood = '', message = '', snapshotId = null }) {
    if (!user.value?.id) return false

    const nudge = updates.value.find(u => u.id === nudgeId)

    try {
      const { data, error: rpcError } = await supabase
        .rpc('respond_to_nudge', {
          p_nudge_id: nudgeId,
          p_mood: mood || '',
          p_message: message || '',
          p_snapshot_id: snapshotId
        })

      if (rpcError) throw rpcError

      // Optimistic local update
      if (nudge) {
        nudge.action_taken = true
        nudge.action_taken_at = new Date().toISOString()
      }

      return true
    } catch (err) {
      console.error('Error responding to nudge:', err)
      return false
    }
  }

  /**
   * Dismiss a nudge bubble without responding (marks as read).
   */
  async function dismissNudge(nudgeId) {
    await markAsRead(nudgeId)
  }

  // === Overlay Queue Management ===

  function shouldAutoPin(notification) {
    return AUTO_PIN_TYPES.has(notification.type)
      || notification.priority === 'high'
      || notification.priority === 'urgent'
  }

  function addToOverlay(notification) {
    if (overlayQueue.value.some(item => item.id === notification.id)) return

    const isPinned = shouldAutoPin(notification)
    const item = {
      id: notification.id,
      notification,
      pinned: isPinned,
      fadeTimerId: null,
      addedAt: Date.now()
    }

    overlayQueue.value.unshift(item)
    trimOverlayQueue()

    if (!isPinned) {
      startFadeTimer(item)
    }
  }

  function dismissOverlay(itemId) {
    const idx = overlayQueue.value.findIndex(i => i.id === itemId)
    if (idx === -1) return
    const item = overlayQueue.value[idx]
    if (item.fadeTimerId) clearTimeout(item.fadeTimerId)
    overlayQueue.value.splice(idx, 1)
  }

  function togglePin(itemId) {
    const item = overlayQueue.value.find(i => i.id === itemId)
    if (!item) return

    item.pinned = !item.pinned
    if (item.pinned) {
      if (item.fadeTimerId) {
        clearTimeout(item.fadeTimerId)
        item.fadeTimerId = null
      }
    } else {
      startFadeTimer(item)
    }
  }

  function startFadeTimer(item) {
    if (item.fadeTimerId) clearTimeout(item.fadeTimerId)
    item.fadeTimerId = setTimeout(() => {
      dismissOverlay(item.id)
    }, AUTO_FADE_MS)
  }

  function trimOverlayQueue() {
    while (overlayQueue.value.length > MAX_OVERLAY_ITEMS) {
      const unpinnedIdx = [...overlayQueue.value]
        .reverse()
        .findIndex(i => !i.pinned)
      if (unpinnedIdx === -1) break
      const actualIdx = overlayQueue.value.length - 1 - unpinnedIdx
      const removed = overlayQueue.value[actualIdx]
      if (removed.fadeTimerId) clearTimeout(removed.fadeTimerId)
      overlayQueue.value.splice(actualIdx, 1)
    }
  }

  // === Supabase Realtime ===

  function subscribeToRealtime() {
    if (!user.value?.id) return
    if (realtimeChannel.value) return

    realtimeChannel.value = supabase
      .channel('notifications-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.value.id}`
        },
        (payload) => {
          const notification = {
            ...payload.new,
            timestamp: payload.new.created_at
          }
          // Add to main updates (dedupe)
          if (!updates.value.some(u => u.id === notification.id)) {
            updates.value.unshift(notification)
          }
          // Add to live overlay
          addToOverlay(notification)
        }
      )
      .subscribe()
  }

  function unsubscribeRealtime() {
    if (realtimeChannel.value) {
      supabase.removeChannel(realtimeChannel.value)
      realtimeChannel.value = null
    }
    overlayQueue.value.forEach(item => {
      if (item.fadeTimerId) clearTimeout(item.fadeTimerId)
    })
    overlayQueue.value = []
  }

  /**
   * Set category filter (local state only)
   */
  function setCategory(category) {
    selectedCategory.value = category
  }

  /**
   * Set time filter (local state only)
   */
  function setTimeFilter(filter) {
    selectedTimeFilter.value = filter
  }

  return {
    updates,
    loading,
    error,
    selectedCategory,
    selectedTimeFilter,
    unreadCount,
    filteredUpdates,
    categories,
    pendingNudges,
    fetchUpdates,
    markAsRead,
    markAllAsRead,
    sendNudge,
    respondToNudge,
    dismissNudge,
    setCategory,
    setTimeFilter,
    overlayQueue,
    addToOverlay,
    dismissOverlay,
    togglePin,
    shouldAutoPin,
    subscribeToRealtime,
    unsubscribeRealtime
  }
})
