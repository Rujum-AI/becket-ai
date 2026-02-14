import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useManagementStore = defineStore('management', () => {
  const tasks = ref([
    { id: 1, name: 'Fix kitchen faucet', urgency: 'high', status: 'pending', dueDate: '2026-02-10', owner: 'Dad', creator: 'Mom', comments: [{ text: 'Urgent before Friday', author: 'Mom', time: '10:00' }] },
    { id: 2, name: 'Soccer registration', urgency: 'mid', status: 'completed', dueDate: '2026-01-30', owner: 'Mom', creator: 'Mom', comments: [] },
    { id: 3, name: 'Weekend shopping', urgency: 'low', status: 'in progress', dueDate: '2026-02-05', owner: 'Dad', creator: 'Dad', comments: [] },
    { id: 4, name: 'Plan summer vacation', urgency: 'mid', status: 'pending', dueDate: '', owner: null, creator: 'Mom', comments: [] } // Unassigned
  ])

  const asks = ref([
    { id: 101, name: 'Can you take Kai on Tuesday?', urgency: 'mid', status: 'pending', dueDate: '2026-02-12', owner: 'Mom', creator: 'Dad', comments: [] },
    { id: 102, name: 'Switch weekends?', urgency: 'low', status: 'rejected', dueDate: '2026-02-20', owner: 'Dad', creator: 'Mom', comments: [{ text: 'Can\'t, have work', author: 'Dad', time: '09:00' }] }
  ])

  const sortKey = ref('urgency')
  const sortOrder = ref(-1)

  const unassignedTasks = computed(() => tasks.value.filter(t => !t.owner))
  const assignedTasks = computed(() => tasks.value.filter(t => t.owner))
  const pendingAsks = computed(() => asks.value.filter(a => a.status === 'pending'))
  const rejectedAsks = computed(() => asks.value.filter(a => a.status === 'rejected'))

  function sortList(list) {
    return [...list].sort((a, b) => {
      let valA = a[sortKey.value]
      let valB = b[sortKey.value]

      if (sortKey.value === 'urgency') {
        const weights = { urgent: 4, high: 3, mid: 2, low: 1 }
        valA = weights[valA] || 0
        valB = weights[valB] || 0
      }
      if (sortKey.value === 'status') {
        const weights = { pending: 1, 'in progress': 2, completed: 3, failed: 4 }
        valA = weights[valA] || 0
        valB = weights[valB] || 0
      }
      if (!valA) valA = ''
      if (!valB) valB = ''

      if (valA < valB) return -1 * sortOrder.value
      if (valA > valB) return 1 * sortOrder.value
      return 0
    })
  }

  const sortedAssignedTasks = computed(() => sortList(assignedTasks.value))
  const sortedPendingAsks = computed(() => sortList(pendingAsks.value))

  function setSortKey(key) {
    if (sortKey.value === key) {
      sortOrder.value = sortOrder.value * -1
    } else {
      sortKey.value = key
      sortOrder.value = 1
    }
  }

  function createTask(taskData) {
    const task = {
      id: Date.now(),
      name: taskData.name,
      urgency: taskData.urgency,
      status: 'pending',
      dueDate: taskData.dueDate,
      owner: taskData.owner,
      creator: 'Me',
      comments: []
    }
    tasks.value.unshift(task)
  }

  function createAsk(askData) {
    const ask = {
      id: Date.now(),
      name: askData.name,
      urgency: askData.urgency,
      status: 'pending',
      dueDate: askData.dueDate,
      owner: 'Mom',
      creator: 'Dad',
      comments: []
    }
    asks.value.unshift(ask)
  }

  function addComment(item, commentText) {
    item.comments.push({
      text: commentText,
      author: 'Me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })
  }

  function handleAskAction(ask, action) {
    if (action === 'reject') {
      ask.status = 'rejected'
      ask.comments.push({ text: 'Request rejected', author: 'System', time: 'Now' })
    } else {
      // Accept: convert ask to task
      const taskCopy = JSON.parse(JSON.stringify(ask))
      taskCopy.status = 'pending'
      asks.value = asks.value.filter(a => a.id !== ask.id)
      tasks.value.unshift(taskCopy)
    }
  }

  return {
    tasks,
    asks,
    sortKey,
    sortOrder,
    unassignedTasks,
    assignedTasks,
    pendingAsks,
    rejectedAsks,
    sortedAssignedTasks,
    sortedPendingAsks,
    setSortKey,
    createTask,
    createAsk,
    addComment,
    handleAskAction
  }
})
