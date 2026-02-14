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

  /**
   * Create a new notification (used by other stores when events happen)
   * This inserts into the notifications table
   */
  async function addUpdate(notification) {
    if (!user.value?.id) {
      console.warn('Cannot add notification: no authenticated user')
      return
    }

    try {
      const { data, error: insertError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: notification.recipient_id || user.value.id,
          family_id: notification.family_id,
          type: notification.type,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          priority: notification.priority || 'normal',
          related_entity_type: notification.related_entity_type || null,
          related_entity_id: notification.related_entity_id || null,
          requires_action: notification.requires_action || false,
          read: false
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Add to local state with timestamp alias
      updates.value.unshift({
        ...data,
        timestamp: data.created_at
      })

      console.log('✓ Created notification:', data.type)
      return data
    } catch (err) {
      console.error('Error creating notification:', err)
      throw err
    }
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
    fetchUpdates,
    markAsRead,
    markAllAsRead,
    setCategory,
    setTimeFilter,
    addUpdate
  }
})
