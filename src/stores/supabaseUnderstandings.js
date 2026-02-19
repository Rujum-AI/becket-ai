import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'

export const useUnderstandingsStore = defineStore('understandings', () => {
  const { user } = useAuth()
  const { family, children } = useFamily()

  // Custody Cycle State
  const cycleLength = ref(14)
  const cycleDays = ref([])
  const isCycleEditing = ref(false)
  const originalCycleDays = ref([])
  const activeCycleId = ref(null)
  const activeCycleVersion = ref(1)
  const defaultHandoffTime = ref('17:00')

  // Understandings State
  const understandings = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Expense Rules State
  const expenseRules = ref(null)
  const pendingExpenseRules = ref(null)
  const expenseRulesHistory = ref([])

  // ========== FETCH OPERATIONS ==========

  async function init() {
    await loadAll()
  }

  async function loadAll() {
    if (!family.value?.id) return

    loading.value = true
    error.value = null

    try {
      await Promise.all([
        fetchAllUnderstandings(),
        fetchCustodyCycle()
      ])
    } catch (err) {
      error.value = err.message
      console.error('Error loading understandings:', err)
    } finally {
      loading.value = false
    }
  }

  // Single fetch for all understandings, then split into regular + expense rules
  async function fetchAllUnderstandings() {
    if (!family.value?.id) return

    try {
      const { data, error: fetchError } = await supabase
        .from('understandings')
        .select(`
          *,
          proposer:proposed_by(display_name)
        `)
        .eq('family_id', family.value.id)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      // Split: expense rules (has expense_rules JSONB) vs regular text understandings
      const regularRows = data.filter(d => !(d.category === 'expenses' && d.expense_rules))
      const expenseRulesRows = data.filter(d => d.category === 'expenses' && d.expense_rules)

      processRegularUnderstandings(regularRows)
      processExpenseRules(expenseRulesRows)
    } catch (err) {
      console.error('Error fetching understandings:', err)
      throw err
    }
  }

  function processRegularUnderstandings(rows) {
    // Group by group_id to build version chains
    const groupMap = new Map()
    rows.forEach(row => {
      if (!groupMap.has(row.group_id)) {
        groupMap.set(row.group_id, [])
      }
      groupMap.get(row.group_id).push(row)
    })

    const items = []

    groupMap.forEach((versions) => {
      // Sort by version_number descending (latest first)
      versions.sort((a, b) => b.version_number - a.version_number)

      // Check for pending termination request
      const pendingTermination = versions.find(v =>
        v.status === 'pending' && v.rejection_reason === 'termination_requested'
      )
      const activeVersion = versions.find(v => v.status === 'active')
      const latestPending = versions.find(v =>
        v.status === 'pending' && v.rejection_reason !== 'termination_requested'
      )

      // Determine which row to show and how
      let displayRow, isTermination = false

      if (activeVersion && pendingTermination) {
        // Show active content but with termination flag, use pending ID for actions
        displayRow = { ...activeVersion, id: pendingTermination.id }
        isTermination = true
      } else if (latestPending) {
        displayRow = latestPending
      } else if (activeVersion) {
        displayRow = activeVersion
      } else {
        // Show the latest version (could be rejected, terminated, etc.)
        displayRow = versions[0]
      }

      if (!displayRow) return

      // Skip superseded-only groups
      if (displayRow.status === 'superseded') return

      // Build history from older versions
      const historyVersions = versions.filter(v =>
        v.id !== displayRow.id &&
        v.id !== pendingTermination?.id &&
        (v.status === 'superseded' || v.status === 'active')
      )
      const history = historyVersions.map(v => ({
        content: v.content,
        date: v.accepted_at
          ? new Date(v.accepted_at).toISOString().split('T')[0]
          : v.proposed_at
            ? new Date(v.proposed_at).toISOString().split('T')[0]
            : ''
      })).reverse() // oldest first

      // Map DB status to UI status
      let uiStatus
      if (displayRow.status === 'active') uiStatus = 'agreed'
      else if (displayRow.status === 'pending') uiStatus = isTermination ? 'pending' : 'pending'
      else if (displayRow.status === 'rejected') uiStatus = 'rejected'
      else if (displayRow.status === 'terminated') uiStatus = 'rejected'
      else uiStatus = displayRow.status

      const isMe = displayRow.proposed_by === user.value?.id
      const creatorName = isTermination
        ? (pendingTermination.proposed_by === user.value?.id ? 'Me' : (pendingTermination.proposer?.display_name || 'Partner'))
        : (isMe ? 'Me' : (displayRow.proposer?.display_name || 'Partner'))

      // Map DB category back to UI subject (DB 'other' → UI 'others')
      const uiSubject = displayRow.category === 'other' ? 'others' : displayRow.category

      items.push({
        id: displayRow.id,
        group_id: displayRow.group_id,
        subject: uiSubject,
        content: isTermination ? activeVersion.content : displayRow.content,
        status: uiStatus,
        creator: creatorName,
        proposed_by: isTermination ? pendingTermination.proposed_by : displayRow.proposed_by,
        history,
        expiration: displayRow.expires_on || '',
        approvedDate: (activeVersion || displayRow).accepted_at
          ? new Date((activeVersion || displayRow).accepted_at).toISOString().split('T')[0]
          : null,
        isHistoryOpen: false,
        terminationRequested: isTermination,
        terminatedDate: displayRow.status === 'terminated' && displayRow.valid_until
          ? displayRow.valid_until
          : null,
        version_number: displayRow.version_number,
        replaces_id: displayRow.replaces_id,
        is_temporary: displayRow.is_temporary,
        db_status: displayRow.status,
        _activeId: activeVersion?.id || null // Keep for termination operations
      })
    })

    understandings.value = items
  }

  function processExpenseRules(rows) {
    // Group by group_id
    const groupMap = new Map()
    rows.forEach(row => {
      if (!groupMap.has(row.group_id)) {
        groupMap.set(row.group_id, [])
      }
      groupMap.get(row.group_id).push(row)
    })

    let activeRule = null
    let pendingRule = null
    const historyRules = []

    // Find across all groups
    rows.forEach(row => {
      const isMe = row.proposed_by === user.value?.id

      if (row.status === 'active') {
        activeRule = {
          id: row.id,
          group_id: row.group_id,
          rules: row.expense_rules || {},
          status: 'agreed',
          creator: isMe ? 'Me' : (row.proposer?.display_name || 'Partner'),
          approvedDate: row.accepted_at
            ? new Date(row.accepted_at).toISOString().split('T')[0]
            : null,
          version_number: row.version_number
        }
      } else if (row.status === 'pending') {
        pendingRule = {
          id: row.id,
          group_id: row.group_id,
          rules: row.expense_rules || {},
          status: 'pending',
          creator: isMe ? 'Me' : (row.proposer?.display_name || 'Partner'),
          proposedDate: row.proposed_at
            ? new Date(row.proposed_at).toISOString().split('T')[0]
            : null,
          version_number: row.version_number,
          replaces_id: row.replaces_id
        }
      } else if (row.status === 'superseded') {
        historyRules.push({
          id: row.id,
          rules: row.expense_rules || {},
          supersededDate: row.valid_until || null
        })
      }
    })

    expenseRules.value = activeRule
    pendingExpenseRules.value = pendingRule
    expenseRulesHistory.value = historyRules
  }

  async function fetchCustodyCycle() {
    if (!family.value?.id) return

    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error: fetchError } = await supabase
        .from('custody_cycles')
        .select('*')
        .eq('family_id', family.value.id)
        .lte('valid_from', today)
        .or(`valid_until.gte.${today},valid_until.is.null`)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (data) {
        activeCycleId.value = data.id
        activeCycleVersion.value = data.version_number
        cycleLength.value = data.cycle_length
        defaultHandoffTime.value = data.default_handoff_time || '17:00'

        // Convert DB cycle_data to UI format
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        cycleDays.value = Array.from({ length: data.cycle_length }, (_, i) => {
          const dbDay = data.cycle_data?.[i]
          return {
            index: i,
            dayName: weekDays[i % 7],
            allocation: dbDay?.allocations || []
          }
        })
      } else {
        activeCycleId.value = null
        activeCycleVersion.value = 1
        initCycle()
      }
    } catch (err) {
      console.error('Error fetching custody cycle:', err)
      initCycle()
    }
  }

  // ========== COMPUTED ==========

  const groupedUnderstandings = computed(() => {
    // Always show expenses section so the ExpenseRulesPanel is permanently visible
    const groups = { expenses: [] }

    understandings.value.forEach(u => {
      if (u.status !== 'rejected') {
        if (!groups[u.subject]) groups[u.subject] = []
        groups[u.subject].push(u)
      }
    })
    return groups
  })

  const rejectedItems = computed(() => {
    return understandings.value.filter(u => u.status === 'rejected')
  })

  const isFullyAssigned = computed(() => {
    if (cycleDays.value.length === 0) return false
    const childrenList = children.value
    if (!childrenList || childrenList.length === 0) return false
    return cycleDays.value.every(day => {
      return childrenList.every(child =>
        day.allocation && day.allocation.find(a => a.childId === child.id)
      )
    })
  })

  // ========== CUSTODY CYCLE ACTIONS ==========

  function initCycle() {
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    cycleDays.value = Array.from({ length: cycleLength.value }, (_, i) => ({
      index: i,
      dayName: weekDays[i % 7],
      allocation: []
    }))
  }

  function setCycleLength(len) {
    cycleLength.value = len
    initCycle()
  }

  function startEditingCycle() {
    originalCycleDays.value = JSON.parse(JSON.stringify(cycleDays.value))
    isCycleEditing.value = true
  }

  function discardCycleChanges() {
    cycleDays.value = JSON.parse(JSON.stringify(originalCycleDays.value))
    isCycleEditing.value = false
  }

  async function saveCycle() {
    if (!family.value?.id || !user.value?.id) return

    try {
      // Convert UI cycle data to DB format (hybrid: parent_label + allocations)
      const cycleData = cycleDays.value.map((day, i) => {
        const allocs = day.allocation || []
        // Determine dominant parent for get_custody_parent() function
        let parentLabel = null
        if (allocs.length > 0) {
          const allDad = allocs.every(a => a.parent === 'dad')
          const allMom = allocs.every(a => a.parent === 'mom')
          parentLabel = allDad ? 'dad' : allMom ? 'mom' : 'split'
        }
        return {
          day: i,
          parent_label: parentLabel,
          allocations: allocs
        }
      })

      const today = new Date().toISOString().split('T')[0]

      if (activeCycleId.value) {
        // Supersede current cycle
        await supabase
          .from('custody_cycles')
          .update({ valid_until: today })
          .eq('id', activeCycleId.value)

        // Insert new version
        const { data, error: insertError } = await supabase
          .from('custody_cycles')
          .insert({
            family_id: family.value.id,
            cycle_length: cycleLength.value,
            cycle_data: cycleData,
            default_handoff_time: defaultHandoffTime.value,
            valid_from: today,
            valid_until: null,
            version_number: activeCycleVersion.value + 1,
            replaces_cycle_id: activeCycleId.value,
            created_by: user.value.id
          })
          .select()
          .single()

        if (insertError) throw insertError

        activeCycleId.value = data.id
        activeCycleVersion.value = data.version_number
      } else {
        // First cycle ever
        const { data, error: insertError } = await supabase
          .from('custody_cycles')
          .insert({
            family_id: family.value.id,
            cycle_length: cycleLength.value,
            cycle_data: cycleData,
            default_handoff_time: defaultHandoffTime.value,
            valid_from: today,
            valid_until: null,
            version_number: 1,
            created_by: user.value.id
          })
          .select()
          .single()

        if (insertError) throw insertError

        activeCycleId.value = data.id
        activeCycleVersion.value = 1
      }

      isCycleEditing.value = false
    } catch (err) {
      error.value = err.message
      console.error('Error saving custody cycle:', err)
      throw err
    }
  }

  function assignDayAllocation(dayIndex, selectedChildren, parent, repeat = false) {
    const indices = [dayIndex]
    if (repeat) {
      const target = dayIndex % 7
      cycleDays.value.forEach(day => {
        if (day.index % 7 === target && day.index !== dayIndex) {
          indices.push(day.index)
        }
      })
    }

    indices.forEach(idx => {
      const day = cycleDays.value[idx]
      if (!day.allocation) day.allocation = []

      selectedChildren.forEach(child => {
        day.allocation = day.allocation.filter(a => a.childId !== child.id)
        day.allocation.push({
          childId: child.id,
          childGender: child.gender,
          parent
        })
      })
    })
  }

  // ========== UNDERSTANDING ACTIONS ==========

  // Map UI subject to DB category (DB CHECK: parenting, expenses, holidays, other)
  function mapCategory(subject) {
    const validCategories = ['parenting', 'expenses', 'holidays', 'other']
    if (subject === 'others') return 'other'
    if (validCategories.includes(subject)) return subject
    return 'other' // Custom subjects → 'other' category
  }

  async function addUnderstanding(data) {
    if (!family.value?.id || !user.value?.id) return

    try {
      const subject = data.content.substring(0, 100)

      const { error: insertError } = await supabase
        .from('understandings')
        .insert({
          family_id: family.value.id,
          group_id: crypto.randomUUID(),
          category: mapCategory(data.subject),
          subject: subject,
          content: data.content,
          proposed_by: user.value.id,
          status: 'pending',
          version_number: 1,
          is_temporary: !!data.expiration,
          expires_on: data.expiration || null
        })

      if (insertError) throw insertError

      // Refresh data (notification created by DB trigger)
      await fetchAllUnderstandings()
    } catch (err) {
      error.value = err.message
      console.error('Error adding understanding:', err)
      throw err
    }
  }

  async function updateUnderstanding(id, data) {
    if (!family.value?.id || !user.value?.id) return

    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    try {
      if (item.db_status === 'active') {
        // Create new pending version, supersede old
        const today = new Date().toISOString().split('T')[0]

        await supabase
          .from('understandings')
          .update({
            status: 'superseded',
            valid_until: today
          })
          .eq('id', id)

        const { error: insertError } = await supabase
          .from('understandings')
          .insert({
            family_id: family.value.id,
            group_id: item.group_id,
            category: mapCategory(data.subject),
            subject: data.content.substring(0, 100),
            content: data.content,
            proposed_by: user.value.id,
            status: 'pending',
            version_number: item.version_number + 1,
            replaces_id: id,
            is_temporary: !!data.expiration,
            expires_on: data.expiration || null
          })

        if (insertError) throw insertError
      } else {
        // If pending, update in place
        const { error: updateError } = await supabase
          .from('understandings')
          .update({
            category: mapCategory(data.subject),
            subject: data.content.substring(0, 100),
            content: data.content,
            is_temporary: !!data.expiration,
            expires_on: data.expiration || null
          })
          .eq('id', id)

        if (updateError) throw updateError
      }

      await fetchAllUnderstandings()
    } catch (err) {
      error.value = err.message
      console.error('Error updating understanding:', err)
      throw err
    }
  }

  async function approveUnderstanding(id) {
    if (!user.value?.id) return

    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    try {
      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()

      if (item.terminationRequested) {
        // Approve termination: terminate the active version
        if (item._activeId) {
          await supabase
            .from('understandings')
            .update({
              status: 'terminated',
              valid_until: today
            })
            .eq('id', item._activeId)
        }

        // Mark the termination request row as superseded (it served its purpose)
        await supabase
          .from('understandings')
          .update({
            status: 'superseded',
            accepted_by: user.value.id,
            accepted_at: now
          })
          .eq('id', id)
      } else {
        // Normal approval: activate the pending understanding
        // If this replaces another version, that's already superseded
        if (item.replaces_id) {
          await supabase
            .from('understandings')
            .update({
              status: 'superseded',
              valid_until: today
            })
            .eq('id', item.replaces_id)
        }

        const { error: updateError } = await supabase
          .from('understandings')
          .update({
            status: 'active',
            accepted_by: user.value.id,
            accepted_at: now,
            valid_from: today
          })
          .eq('id', id)

        if (updateError) throw updateError
      }

      // Refresh data (notification created by DB trigger)
      await fetchAllUnderstandings()
    } catch (err) {
      error.value = err.message
      console.error('Error approving understanding:', err)
      throw err
    }
  }

  async function rejectUnderstanding(id) {
    if (!user.value?.id) return

    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    try {
      const now = new Date().toISOString()

      if (item.terminationRequested) {
        // Reject termination: remove the termination request, active stays
        await supabase
          .from('understandings')
          .update({
            status: 'rejected',
            rejected_by: user.value.id,
            rejected_at: now
          })
          .eq('id', id)

        // Ensure active version is still active (restore if needed)
        if (item._activeId) {
          await supabase
            .from('understandings')
            .update({
              status: 'active',
              valid_until: null
            })
            .eq('id', item._activeId)
        }
      } else {
        // Normal rejection
        // If this was an edit (has replaces_id), restore the previous version
        if (item.replaces_id) {
          await supabase
            .from('understandings')
            .update({
              status: 'active',
              valid_until: null
            })
            .eq('id', item.replaces_id)
        }

        const { error: updateError } = await supabase
          .from('understandings')
          .update({
            status: 'rejected',
            rejected_by: user.value.id,
            rejected_at: now
          })
          .eq('id', id)

        if (updateError) throw updateError
      }

      // Refresh data (notification created by DB trigger)
      await fetchAllUnderstandings()
    } catch (err) {
      error.value = err.message
      console.error('Error rejecting understanding:', err)
      throw err
    }
  }

  async function requestTermination(id) {
    if (!user.value?.id || !family.value?.id) return

    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    try {
      // Create a new pending row that represents the termination request
      // The active row stays active (important for expense rules etc.)
      const { error: insertError } = await supabase
        .from('understandings')
        .insert({
          family_id: family.value.id,
          group_id: item.group_id,
          category: mapCategory(item.subject),
          subject: item.content.substring(0, 100),
          content: item.content,
          proposed_by: user.value.id,
          status: 'pending',
          version_number: item.version_number + 1,
          replaces_id: id,
          rejection_reason: 'termination_requested'
        })

      if (insertError) throw insertError

      await fetchAllUnderstandings()
    } catch (err) {
      error.value = err.message
      console.error('Error requesting termination:', err)
      throw err
    }
  }

  async function cancelProposal(id) {
    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    try {
      // If it replaced an active version, restore it
      if (item.replaces_id) {
        await supabase
          .from('understandings')
          .update({
            status: 'active',
            valid_until: null
          })
          .eq('id', item.replaces_id)
      }

      // Mark the pending proposal as rejected (can't delete due to no DELETE policy)
      const { error: updateError } = await supabase
        .from('understandings')
        .update({
          status: 'rejected',
          rejected_by: user.value?.id,
          rejected_at: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) throw updateError

      await fetchAllUnderstandings()
    } catch (err) {
      error.value = err.message
      console.error('Error cancelling proposal:', err)
      throw err
    }
  }

  function reviveUnderstanding(id) {
    const item = understandings.value.find(u => u.id === id)
    if (item) {
      item.terminatedDate = null
    }
  }

  function toggleHistory(id) {
    const item = understandings.value.find(u => u.id === id)
    if (item) {
      item.isHistoryOpen = !item.isHistoryOpen
    }
  }

  // ========== EXPENSE RULES ACTIONS ==========

  async function proposeExpenseRules(rules) {
    if (!family.value?.id || !user.value?.id) return

    try {
      const groupId = expenseRules.value?.group_id || crypto.randomUUID()
      const versionNumber = expenseRules.value
        ? (expenseRules.value.version_number || 0) + 1
        : 1

      const { error: insertError } = await supabase
        .from('understandings')
        .insert({
          family_id: family.value.id,
          group_id: groupId,
          category: 'expenses',
          subject: 'Expense Sharing Rules',
          content: 'Expense sharing rules configuration',
          expense_rules: rules,
          proposed_by: user.value.id,
          status: 'pending',
          version_number: versionNumber,
          replaces_id: expenseRules.value?.id || null
        })

      if (insertError) throw insertError

      // Refresh data (notification created by DB trigger)
      await fetchAllUnderstandings()
    } catch (err) {
      error.value = err.message
      console.error('Error proposing expense rules:', err)
      throw err
    }
  }

  async function approveExpenseRules() {
    if (!pendingExpenseRules.value || !user.value?.id) return

    try {
      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()

      // If there's an active version, supersede it
      if (expenseRules.value?.id) {
        await supabase
          .from('understandings')
          .update({
            status: 'superseded',
            valid_until: today
          })
          .eq('id', expenseRules.value.id)
      }

      // Activate the pending rules
      const { error: updateError } = await supabase
        .from('understandings')
        .update({
          status: 'active',
          accepted_by: user.value.id,
          accepted_at: now,
          valid_from: today
        })
        .eq('id', pendingExpenseRules.value.id)

      if (updateError) throw updateError

      await fetchAllUnderstandings()
    } catch (err) {
      error.value = err.message
      console.error('Error approving expense rules:', err)
      throw err
    }
  }

  async function rejectExpenseRules() {
    if (!pendingExpenseRules.value || !user.value?.id) return

    try {
      // If it was replacing an active version, restore it
      if (pendingExpenseRules.value.replaces_id) {
        await supabase
          .from('understandings')
          .update({
            status: 'active',
            valid_until: null
          })
          .eq('id', pendingExpenseRules.value.replaces_id)
      }

      const { error: updateError } = await supabase
        .from('understandings')
        .update({
          status: 'rejected',
          rejected_by: user.value.id,
          rejected_at: new Date().toISOString()
        })
        .eq('id', pendingExpenseRules.value.id)

      if (updateError) throw updateError

      await fetchAllUnderstandings()
    } catch (err) {
      error.value = err.message
      console.error('Error rejecting expense rules:', err)
      throw err
    }
  }

  return {
    // State
    cycleLength,
    cycleDays,
    isCycleEditing,
    defaultHandoffTime,
    understandings,
    expenseRules,
    pendingExpenseRules,
    expenseRulesHistory,
    loading,
    error,

    // Computed
    groupedUnderstandings,
    rejectedItems,
    isFullyAssigned,

    // Actions
    init,
    loadAll,
    initCycle,
    setCycleLength,
    startEditingCycle,
    discardCycleChanges,
    saveCycle,
    assignDayAllocation,
    addUnderstanding,
    updateUnderstanding,
    approveUnderstanding,
    rejectUnderstanding,
    requestTermination,
    cancelProposal,
    reviveUnderstanding,
    toggleHistory,
    proposeExpenseRules,
    approveExpenseRules,
    rejectExpenseRules,
    fetchAllUnderstandings,
    fetchCustodyCycle
  }
})
