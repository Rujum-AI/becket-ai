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
  const URGENT_FADE_MS = 15000
  const MAX_OVERLAY_ITEMS = 4

  // Types that get urgent treatment (extended timeout + pulse border)
  const URGENT_TYPES = new Set([
    'nudge_request',
    'nudge_response',
    'expense_pending',
    'understanding_proposed',
    'custody_override_requested',
    'ask_received'
  ])

  // Types that support inline actions
  const ACTIONABLE_TYPES = {
    'ask_received':                { actions: ['accept', 'reject'], domain: 'management' },
    'expense_pending':             { actions: ['approve'],          domain: 'finance' },
    'understanding_proposed':      { actions: ['accept', 'reject'], domain: 'understandings' },
    'custody_override_requested':  { actions: ['approve', 'reject'], domain: 'family' },
    'nudge_request':               { actions: ['respond'],          domain: 'nudge' },
  }

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

  // Computed: time-grouped updates (Today, Yesterday, This Week, Older)
  const timeGroupedUpdates = computed(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart - 86400000)
    const weekStart = new Date(todayStart - 6 * 86400000)

    const groups = { today: [], yesterday: [], thisWeek: [], older: [] }

    for (const u of filteredUpdates.value) {
      const created = new Date(u.created_at)
      if (created >= todayStart) groups.today.push(u)
      else if (created >= yesterdayStart) groups.yesterday.push(u)
      else if (created >= weekStart) groups.thisWeek.push(u)
      else groups.older.push(u)
    }

    return groups
  })

  // Helper: group items by related_entity_id
  function groupByEntity(items) {
    const entityMap = new Map()
    const ungrouped = []

    for (const item of items) {
      const key = item.related_entity_id
      if (key) {
        if (!entityMap.has(key)) entityMap.set(key, [])
        entityMap.get(key).push(item)
      } else {
        ungrouped.push(item)
      }
    }

    const result = []
    for (const [entityId, group] of entityMap) {
      if (group.length >= 2) {
        result.push({
          type: 'group',
          entityId,
          lead: group[0],
          children: group.slice(1),
          category: group[0].category,
          unreadCount: group.filter(g => !g.read).length
        })
      } else {
        result.push({ type: 'single', ...group[0] })
      }
    }

    for (const item of ungrouped) {
      result.push({ type: 'single', ...item })
    }

    // Sort by most recent created_at descending
    result.sort((a, b) => {
      const aTime = new Date(a.type === 'group' ? a.lead.created_at : a.created_at)
      const bTime = new Date(b.type === 'group' ? b.lead.created_at : b.created_at)
      return bTime - aTime
    })

    return result
  }

  // Computed: grouped notifications within each time section
  const groupedNotifications = computed(() => {
    const result = {}
    for (const [section, items] of Object.entries(timeGroupedUpdates.value)) {
      result[section] = groupByEntity(items)
    }
    return result
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

  // Helpers: actionable notification checks
  function isActionable(notification) {
    return !!ACTIONABLE_TYPES[notification.type]
      && notification.requires_action
      && !notification.action_taken
  }

  function getActions(notification) {
    return ACTIONABLE_TYPES[notification.type]?.actions || []
  }

  function isUrgent(notification) {
    return URGENT_TYPES.has(notification.type)
      || notification.priority === 'high'
      || notification.priority === 'urgent'
  }

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

      updates.value = (data || []).map(notification => ({
        ...notification,
        timestamp: notification.created_at
      }))

      console.log(`Fetched ${updates.value.length} notifications`)
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
    } catch (err) {
      console.error('Error marking all as read:', err)
      await fetchUpdates()
    }
  }

  /**
   * Send a nudge to co-parent requesting a child update.
   */
  async function sendNudge(childId, childName) {
    if (!user.value?.id) return null

    addToOverlay({
      id: `nudge-sent-${Date.now()}`,
      type: 'nudge_request',
      category: 'nudge',
      message: `Check-in sent for ${childName}`,
      created_at: new Date().toISOString(),
      priority: 'normal'
    })

    try {
      const { data, error: rpcError } = await supabase
        .rpc('send_nudge', {
          p_child_id: childId,
          p_child_name: childName
        })

      if (rpcError) throw rpcError
      return data
    } catch (err) {
      console.error('Error sending nudge:', err)
      return null
    }
  }

  /**
   * Respond to a nudge with mood emoji, message, and optional photo.
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

  /**
   * Handle inline action from notification feed or toast.
   * Dispatches to the correct domain store via dynamic import.
   * Returns true on success, 'open-modal' for nudge, false on error.
   */
  async function handleInlineAction(notification, action) {
    const config = ACTIONABLE_TYPES[notification.type]
    if (!config) return false

    try {
      if (config.domain === 'nudge') {
        return 'open-modal'
      }

      if (config.domain === 'management') {
        const { useManagementStore } = await import('./supabaseManagement')
        const mgmt = useManagementStore()
        await mgmt.handleAskAction({ id: notification.related_entity_id }, action)
      } else if (config.domain === 'family') {
        const { useSupabaseDashboardStore } = await import('./supabaseDashboard')
        const dash = useSupabaseDashboardStore()
        await dash.respondToCustodyOverride(notification.related_entity_id, action)
      } else if (config.domain === 'understandings') {
        const { useUnderstandingsStore } = await import('./supabaseUnderstandings')
        const us = useUnderstandingsStore()
        if (action === 'accept') await us.approveUnderstanding(notification.related_entity_id)
        else await us.rejectUnderstanding(notification.related_entity_id)
      } else if (config.domain === 'finance') {
        const { useFinanceStore } = await import('./supabaseFinance')
        const fin = useFinanceStore()
        await fin.approveExpense(notification.related_entity_id)
      }

      // Mark notification as actioned
      notification.action_taken = true
      notification.action_taken_at = new Date().toISOString()
      await supabase
        .from('notifications')
        .update({ action_taken: true, action_taken_at: new Date().toISOString() })
        .eq('id', notification.id)

      await markAsRead(notification.id)
      return true
    } catch (err) {
      console.error('Inline action failed:', err)
      return false
    }
  }

  // === Overlay Queue Management ===

  function addToOverlay(notification) {
    if (overlayQueue.value.some(item => item.id === notification.id)) return

    const urgent = isUrgent(notification)
    const item = {
      id: notification.id,
      notification,
      urgent,
      fadeTimerId: null,
      addedAt: Date.now()
    }

    overlayQueue.value.unshift(item)
    trimOverlayQueue()
    startFadeTimer(item)
  }

  function dismissOverlay(itemId) {
    const idx = overlayQueue.value.findIndex(i => i.id === itemId)
    if (idx === -1) return
    const item = overlayQueue.value[idx]
    if (item.fadeTimerId) clearTimeout(item.fadeTimerId)
    overlayQueue.value.splice(idx, 1)
  }

  function startFadeTimer(item) {
    if (item.fadeTimerId) clearTimeout(item.fadeTimerId)
    const timeout = item.urgent ? URGENT_FADE_MS : AUTO_FADE_MS
    item.fadeTimerId = setTimeout(() => {
      dismissOverlay(item.id)
    }, timeout)
  }

  function trimOverlayQueue() {
    while (overlayQueue.value.length > MAX_OVERLAY_ITEMS) {
      const removed = overlayQueue.value.pop()
      if (removed.fadeTimerId) clearTimeout(removed.fadeTimerId)
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
          if (!updates.value.some(u => u.id === notification.id)) {
            updates.value.unshift(notification)
          }
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

  function setCategory(category) {
    selectedCategory.value = category
  }

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
    timeGroupedUpdates,
    groupedNotifications,
    categories,
    pendingNudges,
    fetchUpdates,
    markAsRead,
    markAllAsRead,
    sendNudge,
    respondToNudge,
    dismissNudge,
    handleInlineAction,
    isActionable,
    getActions,
    isUrgent,
    setCategory,
    setTimeFilter,
    overlayQueue,
    addToOverlay,
    dismissOverlay,
    subscribeToRealtime,
    unsubscribeRealtime
  }
})
