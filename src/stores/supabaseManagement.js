import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useFamily } from '@/composables/useFamily'
import { useAuth } from '@/composables/useAuth'

export const useManagementStore = defineStore('supabaseManagement', () => {
  const { family } = useFamily()
  const { user } = useAuth()

  const items = ref([]) // Combined tasks and asks
  const loading = ref(false)
  const error = ref(null)

  const sortKey = ref('urgency')
  const sortOrder = ref(-1)

  const TERMINAL_STATUSES = ['completed', 'failed', 'rejected']

  // Computed filters
  const tasks = computed(() => items.value.filter(item => item.type === 'task'))
  const asks = computed(() => items.value.filter(item => item.type === 'ask'))

  const activeTasks = computed(() => tasks.value.filter(t => !TERMINAL_STATUSES.includes(t.status)))
  const unassignedTasks = computed(() => activeTasks.value.filter(t => !t.owner_id))
  const assignedTasks = computed(() => activeTasks.value.filter(t => t.owner_id))
  const pendingAsks = computed(() => asks.value.filter(a => a.status === 'pending'))
  const completedItems = computed(() => items.value.filter(i => i.status === 'completed'))
  const rejectedItems = computed(() => items.value.filter(i => ['rejected', 'failed'].includes(i.status)))

  // Sorting logic
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
        const weights = { pending: 1, in_progress: 2, completed: 3, failed: 4, rejected: 5 }
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

  // ========== FETCH OPERATIONS ==========

  async function fetchAll() {
    if (!family.value?.id) return

    loading.value = true
    error.value = null

    try {
      // Fetch tasks with creator and owner profile names
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          creator:creator_id (id, display_name),
          owner:owner_id (id, display_name),
          child:child_id (id, name)
        `)
        .eq('family_id', family.value.id)
        .order('created_at', { ascending: false })

      if (tasksError) throw tasksError

      // Fetch comments for all tasks
      const enrichedItems = await Promise.all(
        tasksData.map(async (task) => {
          const { data: commentsData } = await supabase
            .from('task_comments')
            .select(`
              *,
              author:author_id (id, display_name)
            `)
            .eq('task_id', task.id)
            .order('created_at')

          return {
            id: task.id,
            type: task.type,
            name: task.name,
            description: task.description || '',
            urgency: task.urgency,
            status: task.status,
            dueDate: task.due_date || '',
            owner: task.owner?.display_name || null,
            owner_id: task.owner_id,
            creator: task.creator?.display_name || 'Unknown',
            creator_id: task.creator_id,
            child: task.child?.name || null,
            child_id: task.child_id,
            becomes_event: task.becomes_event || false,
            event_data: task.event_data || null,
            related_event_id: task.related_event_id,
            updated_at: task.updated_at || task.created_at,
            comments: commentsData?.map(c => ({
              id: c.id,
              text: c.text,
              author: c.author?.display_name || 'Unknown',
              author_id: c.author_id,
              action: c.action,
              time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestamp: c.created_at
            })) || []
          }
        })
      )

      items.value = enrichedItems
    } catch (err) {
      error.value = err.message
      console.error('Error fetching tasks:', err)
    } finally {
      loading.value = false
    }
  }

  // ========== CREATE OPERATIONS ==========

  async function createTask(taskData) {
    if (!family.value?.id || !user.value?.id) throw new Error('No family or user')

    try {
      const { error: taskError } = await supabase
        .from('tasks')
        .insert({
          family_id: family.value.id,
          type: 'task',
          name: taskData.name,
          description: taskData.description || null,
          urgency: taskData.urgency,
          status: 'pending',
          due_date: taskData.dueDate || null,
          owner_id: taskData.owner_id || null,
          creator_id: user.value.id,
          child_id: taskData.child_id || null
        })

      if (taskError) throw taskError

      // Refresh data (notification created by DB trigger)
      await fetchAll()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function createAsk(askData) {
    if (!family.value?.id || !user.value?.id) throw new Error('No family or user')

    try {
      const { error: askError } = await supabase
        .from('tasks')
        .insert({
          family_id: family.value.id,
          type: 'ask',
          name: askData.name,
          description: askData.description || null,
          urgency: askData.urgency,
          status: 'pending',
          due_date: askData.dueDate || null,
          creator_id: user.value.id,
          child_id: askData.child_id || null,
          becomes_event: askData.becomes_event || false,
          event_data: askData.event_data || null
        })

      if (askError) throw askError

      // Refresh data (notification created by DB trigger)
      await fetchAll()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function createSwitchDaysAsk({ switchFromDate, switchToDate, reason, urgency }) {
    if (!family.value?.id || !user.value?.id) throw new Error('No family or user')

    // Auto-generate name from dates
    const fromLabel = new Date(switchFromDate + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })
    const name = switchToDate
      ? `Switch: ${fromLabel} ↔ ${new Date(switchToDate + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
      : `Request: ${fromLabel}`

    // Determine requester's role (dad/mom)
    const { data: memberData } = await supabase
      .from('family_members')
      .select('role')
      .eq('family_id', family.value.id)
      .eq('profile_id', user.value.id)
      .single()

    const requestedParent = memberData?.role || 'dad'

    try {
      const { error: askError } = await supabase
        .from('tasks')
        .insert({
          family_id: family.value.id,
          type: 'ask',
          name,
          description: reason || null,
          urgency: urgency || 'mid',
          status: 'pending',
          due_date: switchFromDate,
          creator_id: user.value.id,
          becomes_event: false,
          event_data: {
            switchType: 'day_swap',
            switchFromDate,
            switchToDate: switchToDate || null,
            requestedParent
          }
        })

      if (askError) throw askError
      await fetchAll()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // ========== COMMENT OPERATIONS ==========

  async function addComment(itemId, commentText) {
    if (!user.value?.id) throw new Error('No user')

    try {
      const { error: commentError } = await supabase
        .from('task_comments')
        .insert({
          task_id: itemId,
          author_id: user.value.id,
          text: commentText,
          action: 'comment'
        })

      if (commentError) throw commentError

      await fetchAll()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // ========== ASK ACTIONS ==========

  async function handleAskAction(ask, action) {
    if (!user.value?.id) throw new Error('No user')

    try {
      if (action === 'reject') {
        // Update ask status to rejected
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ status: 'rejected' })
          .eq('id', ask.id)

        if (updateError) throw updateError

        // Add system comment
        await supabase
          .from('task_comments')
          .insert({
            task_id: ask.id,
            author_id: user.value.id,
            text: 'Request rejected',
            action: 'rejected'
          })

      } else if (action === 'accept') {
        // Switch-days ask: create custody overrides
        if (ask.event_data?.switchType === 'day_swap') {
          const ed = ask.event_data
          const oppositeParent = ed.requestedParent === 'dad' ? 'mom' : 'dad'

          // Override 1: requester gets switchFromDate
          const { error: override1Error } = await supabase
            .from('custody_overrides')
            .insert({
              family_id: family.value.id,
              from_date: ed.switchFromDate,
              to_date: ed.switchFromDate,
              override_parent: ed.requestedParent,
              reason: `Switch days: ${ask.name}`,
              status: 'approved',
              requested_by: ask.creator_id,
              responded_by: user.value.id,
              responded_at: new Date().toISOString()
            })

          if (override1Error) throw override1Error

          // Override 2 (swap): co-parent gets switchToDate
          if (ed.switchToDate) {
            const { error: override2Error } = await supabase
              .from('custody_overrides')
              .insert({
                family_id: family.value.id,
                from_date: ed.switchToDate,
                to_date: ed.switchToDate,
                override_parent: oppositeParent,
                reason: `Switch days: ${ask.name}`,
                status: 'approved',
                requested_by: ask.creator_id,
                responded_by: user.value.id,
                responded_at: new Date().toISOString()
              })

            if (override2Error) throw override2Error
          }

          // Mark ask as completed
          await supabase
            .from('tasks')
            .update({ status: 'completed' })
            .eq('id', ask.id)

        // If ask should become an event, create the event
        } else if (ask.becomes_event && ask.event_data) {
          const { data: eventData, error: eventError } = await supabase
            .from('events')
            .insert({
              family_id: family.value.id,
              type: ask.event_data.type || 'manual',
              title: ask.event_data.title || ask.name,
              description: ask.event_data.description || ask.description,
              start_time: ask.event_data.start_time,
              end_time: ask.event_data.end_time,
              all_day: ask.event_data.all_day || false,
              location_name: ask.event_data.location_name,
              status: 'scheduled',
              created_by: user.value.id,
              generated_from_type: 'ask_approved',
              generated_from_id: ask.id
            })
            .select()
            .single()

          if (eventError) throw eventError

          // If event has children, link them
          if (ask.child_id) {
            await supabase
              .from('event_children')
              .insert({
                event_id: eventData.id,
                child_id: ask.child_id
              })
          }

          // Update ask with related event
          await supabase
            .from('tasks')
            .update({
              status: 'completed',
              related_event_id: eventData.id
            })
            .eq('id', ask.id)
        } else {
          // Just mark as completed
          await supabase
            .from('tasks')
            .update({ status: 'completed' })
            .eq('id', ask.id)
        }

        // Add system comment
        await supabase
          .from('task_comments')
          .insert({
            task_id: ask.id,
            author_id: user.value.id,
            text: 'Request accepted',
            action: 'approved'
          })
      }

      await fetchAll()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // ========== UPDATE OPERATIONS ==========

  async function updateTaskStatus(taskId, newStatus) {
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)

      if (updateError) throw updateError

      // Add system comment
      await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: user.value.id,
          text: `Status changed to ${newStatus}`,
          action: 'status_change'
        })

      await fetchAll()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function assignTask(taskId, ownerId) {
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ owner_id: ownerId })
        .eq('id', taskId)

      if (updateError) throw updateError

      // Add system comment
      await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: user.value.id,
          text: 'Task assigned',
          action: 'assigned'
        })

      await fetchAll()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // ========== DELETE OPERATIONS ==========

  async function deleteTask(taskId) {
    try {
      // Comments will be cascade deleted
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (deleteError) throw deleteError

      await fetchAll()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // ========== ACTIVITY LOG ==========

  async function fetchActivityLog(taskId) {
    try {
      const { data, error: logError } = await supabase
        .from('activity_log')
        .select('*')
        .eq('entity_type', 'task')
        .eq('entity_id', taskId)
        .order('timestamp', { ascending: true })

      if (logError) throw logError
      return data || []
    } catch (err) {
      console.error('Error fetching activity log:', err)
      return []
    }
  }

  return {
    items,
    tasks,
    asks,
    loading,
    error,
    sortKey,
    sortOrder,
    activeTasks,
    unassignedTasks,
    assignedTasks,
    pendingAsks,
    completedItems,
    rejectedItems,
    sortedAssignedTasks,
    sortedPendingAsks,
    setSortKey,
    fetchAll,
    createTask,
    createAsk,
    createSwitchDaysAsk,
    addComment,
    handleAskAction,
    updateTaskStatus,
    assignTask,
    deleteTask,
    fetchActivityLog
  }
})
