import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUpdatesStore = defineStore('updates', () => {
  const updates = ref([
    // Sample updates - in Phase 4 these will be dynamic
    {
      id: 1,
      type: 'pickup',
      title: 'Pickup Confirmation',
      message: 'Mom picked up Rom from school',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      read: false,
      category: 'handoff'
    },
    {
      id: 2,
      type: 'task',
      title: 'New Task Assigned',
      message: 'Buy soccer shoes for Rom',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      read: false,
      category: 'task'
    },
    {
      id: 3,
      type: 'ask',
      title: 'New Ask Received',
      message: 'Can you take Kai to dentist on Thursday?',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      read: false,
      category: 'ask'
    },
    {
      id: 4,
      type: 'understanding',
      title: 'Pending Approval',
      message: 'New understanding proposal: Extended vacation time',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      read: false,
      category: 'approval'
    },
    {
      id: 5,
      type: 'event',
      title: 'Upcoming Birthday',
      message: "Rom's birthday in 3 days",
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      read: true,
      category: 'event'
    },
    {
      id: 6,
      type: 'dropoff',
      title: 'Dropoff Completed',
      message: 'Dad dropped off Kai at soccer practice',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
      read: true,
      category: 'handoff'
    },
    {
      id: 7,
      type: 'expense',
      title: 'New Expense Added',
      message: 'School supplies - $45',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      read: true,
      category: 'expense'
    }
  ])

  const selectedCategory = ref('all')
  const selectedTimeFilter = ref('all')

  // Computed
  const unreadCount = computed(() => {
    return updates.value.filter(u => !u.read).length
  })

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
        filtered = filtered.filter(u => new Date(u.timestamp) >= oneDayAgo)
      } else if (selectedTimeFilter.value === 'week') {
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
        filtered = filtered.filter(u => new Date(u.timestamp) >= oneWeekAgo)
      }
    }

    return filtered
  })

  const categories = computed(() => {
    const cats = new Set(updates.value.map(u => u.category))
    return ['all', ...Array.from(cats)]
  })

  // Actions
  function markAsRead(id) {
    const update = updates.value.find(u => u.id === id)
    if (update) {
      update.read = true
    }
  }

  function markAllAsRead() {
    updates.value.forEach(u => {
      u.read = true
    })
  }

  function setCategory(category) {
    selectedCategory.value = category
  }

  function setTimeFilter(filter) {
    selectedTimeFilter.value = filter
  }

  function addUpdate(update) {
    updates.value.unshift({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      read: false,
      ...update
    })
  }

  return {
    updates,
    selectedCategory,
    selectedTimeFilter,
    unreadCount,
    filteredUpdates,
    categories,
    markAsRead,
    markAllAsRead,
    setCategory,
    setTimeFilter,
    addUpdate
  }
})
