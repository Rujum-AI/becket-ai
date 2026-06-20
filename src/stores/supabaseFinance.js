import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'
import { useFamilyMode } from '@/composables/useFamilyMode'

export const useSupabaseFinanceStore = defineStore('supabaseFinance', () => {
  const { user } = useAuth()
  const { family, userRole } = useFamily()
  const { requiresApproval } = useFamilyMode()

  const expenses = ref([])
  const expenseRules = ref(null) // Active understanding with category='expenses'
  const children = ref([]) // Family children for filter
  const childFilter = ref(null) // null = 'all', or child_id
  const loading = ref(false)
  const error = ref(null)
  const activeTimeframe = ref('month')

  // Fixed expense categories based on DATA_SCHEMA.md
  const categories = ref([
    { id: 'education', name: 'education', color: '#FCD34D', icon: 'education.png' },
    { id: 'activities', name: 'activities', color: '#F87171', icon: 'activities.png' },
    { id: 'healthcare', name: 'healthcare', color: '#34D399', icon: 'healthcare.png' },
    { id: 'clothing', name: 'clothing', color: '#60A5FA', icon: 'clothing.png' },
    { id: 'food', name: 'food', color: '#FB923C', icon: 'food_beverages.png' },
    { id: 'legal', name: 'legal', color: '#94A3B8', icon: 'legal_bills.png' },
    { id: 'events', name: 'events', color: '#F472B6', icon: 'birthday_events.png' },
    { id: 'other', name: 'other', color: '#A78BFA', icon: 'finance.png' }
  ])

  // Load expenses from Supabase
  async function loadExpenses() {
    if (!family.value) return

    loading.value = true
    error.value = null

    try {
      const now = new Date()
      let startDate

      if (activeTimeframe.value === 'month') {
        // Current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else {
        // Current year
        startDate = new Date(now.getFullYear(), 0, 1)
      }

      const { data, error: fetchError } = await supabase
        .from('expenses')
        .select('*')
        .eq('family_id', family.value.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false })

      if (fetchError) throw fetchError

      expenses.value = data || []
    } catch (err) {
      console.error('Error loading expenses:', err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // Classify a draft expense against the active rules.
  // Returns { route: 'counted' | 'pending', reasonKey: string | null, reason: string | null }
  // V (counted): category is in the included list, a split rule exists (base or override),
  //              AND any configured budget/item limit for the category isn't exceeded.
  // X (pending): everything else — needs the co-parent's approval.
  function classifyExpense({ amount, category, childId }) {
    // Non-separated families don't have a shared/not-shared contract — every
    // expense is just tracking. Skip the approval routing entirely.
    if (!requiresApproval.value) {
      return { route: 'counted', reasonKey: null, reason: null }
    }
    const rules = getChildRules(childId)
    const included = getIncludedCategories(rules)

    if (!included.includes(category)) {
      return { route: 'pending', reasonKey: 'expenseExcludedReason', reason: 'category_other' }
    }
    const hasBase = !!rules.default_split && (rules.default_split.dad_percent != null || rules.default_split.mom_percent != null)
    const override = (rules.categories || []).find(c => c.name === category)
    if (!hasBase && !override) {
      return { route: 'pending', reasonKey: 'expenseNoRuleReason', reason: 'no_rule' }
    }

    // Budget / item-count limit (override.budget_limit or override.limit_count)
    if (override) {
      const numAmount = parseFloat(amount) || 0
      const period = override.budget_limit?.period || override.limit_count?.period || 'monthly'
      const { spent, count } = currentCategoryUsage(category, childId, period)

      if (override.budget_limit?.amount != null && override.budget_limit.amount > 0) {
        if (spent + numAmount > override.budget_limit.amount) {
          return { route: 'pending', reasonKey: 'expenseOverBudgetReason', reason: 'exceeds_budget' }
        }
      }
      if (override.limit_count?.max != null && override.limit_count.max > 0) {
        if (count + 1 > override.limit_count.max) {
          return { route: 'pending', reasonKey: 'expenseOverItemLimitReason', reason: 'exceeds_count' }
        }
      }
    }
    return { route: 'counted', reasonKey: null, reason: null }
  }

  // Compute the current-period spend + item count for a category, used to
  // gate budget / item-count limits in classifyExpense.
  // Only "counted" expenses are tallied — pendings haven't been agreed.
  function currentCategoryUsage(category, childId, period) {
    const now = new Date()
    let startDate
    if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1)
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    const startIso = startDate.toISOString().split('T')[0]
    const matches = expenses.value.filter(e =>
      e.category === category &&
      e.status === 'counted' &&
      (childId == null || e.child_id === childId) &&
      e.date >= startIso
    )
    const spent = matches.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    return { spent, count: matches.length }
  }

  // Add new expense
  async function addExpense(expenseData) {
    if (!family.value || !user.value) return

    try {
      const amount = parseFloat(expenseData.amount)
      const childId = expenseData.childId || null
      const category = expenseData.category

      // Payer is always the current user (the "Paid by" toggle has been removed)
      const payerId = user.value.id

      // Compute split from rules
      const split = computeSplit(amount, childId, category)

      // Determine status from the deterministic router
      const decision = classifyExpense({ amount, category, childId })
      const isAdmin = userRole.value === 'admin'
      let status = decision.route === 'pending' ? 'pending_approval' : 'counted'
      // Fallback to 'no_rule' (a valid CHECK value) if reason ever goes missing,
      // so the insert doesn't fail a DB CHECK on an unknown sentinel.
      let requiresApprovalReason = decision.route === 'pending'
        ? (decision.reason || 'no_rule')
        : null

      if (isAdmin) {
        // Admin can bypass approval; everything counts
        status = 'counted'
        requiresApprovalReason = null
      }

      // TODO: Check budget limits (requires expense_budget_cache query)

      const expenseDate = expenseData.date || new Date().toISOString().split('T')[0]
      const isRecurring = !!expenseData.isRecurring
      const recurrencePeriod = isRecurring ? (expenseData.recurrencePeriod || 'monthly') : null

      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert({
          family_id: family.value.id,
          child_id: childId,
          understanding_id: expenseRules.value?.id || null,
          title: expenseData.title,
          amount: amount,
          category: category,
          payer_id: payerId,
          date: expenseDate,
          status: status,
          requires_approval_reason: requiresApprovalReason,
          split_dad_percent: split.dadPercent,
          split_mom_percent: split.momPercent,
          split_dad_amount: split.dadAmount,
          split_mom_amount: split.momAmount,
          is_recurring: isRecurring,
          recurrence_period: recurrencePeriod,
          created_by: user.value.id
        })
        .select()
        .single()

      if (insertError) throw insertError

      // If this expense was flagged for approval, also create a pending_actions
      // row so it surfaces in the unified Pending UI and triggers the partner's
      // notification. We key off the ACTUAL persisted status, not the route
      // decision — admin-bypass can flip it to counted, in which case no
      // approval is needed.
      if (data.status === 'pending_approval') {
        const { error: pendingError } = await supabase
          .from('pending_actions')
          .insert({
            family_id: family.value.id,
            target_type: 'expense',
            target_id: data.id,
            reason: requiresApprovalReason,
            requested_by: user.value.id
          })
        if (pendingError) {
          // Don't fail the whole expense over the pending_actions write —
          // the expense itself is the source of truth, the pending_actions
          // row is the notification/UI hook. Log so we can investigate.
          console.warn('pending_actions insert failed:', pendingError.message)
        }
      }

      // Reload expenses to refresh UI (notification created by DB trigger)
      await loadExpenses()

      return data
    } catch (err) {
      console.error('Error adding expense:', err)
      error.value = err.message
      throw err
    }
  }

  // Delete expense — only the creator may delete their own entry.
  async function deleteExpense(expenseId) {
    try {
      const target = expenses.value.find(e => e.id === expenseId)
      if (target && user.value && target.created_by && target.created_by !== user.value.id) {
        throw new Error('Only the creator can delete this expense')
      }

      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)

      if (deleteError) throw deleteError

      expenses.value = expenses.value.filter(e => e.id !== expenseId)
    } catch (err) {
      console.error('Error deleting expense:', err)
      error.value = err.message
      throw err
    }
  }

  // Computed: Total amount for current timeframe (respects filter)
  const totalAmount = computed(() => {
    return filteredExpenses.value.reduce((sum, expense) => sum + (expense.amount || 0), 0)
  })

  // Computed: Category breakdown with percentages (respects filter)
  const categoryStats = computed(() => {
    const total = totalAmount.value
    if (total === 0) return []

    const stats = categories.value.map(cat => {
      const categoryExpenses = filteredExpenses.value.filter(e => e.category === cat.id)
      const amount = categoryExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
      const percent = total > 0 ? Math.round((amount / total) * 100) : 0

      return {
        ...cat,
        amount,
        percent
      }
    }).filter(cat => cat.amount > 0) // Only show categories with expenses

    return stats
  })

  // Computed: Dad's share percentage (respects filter)
  const dadShare = computed(() => {
    if (!user.value || totalAmount.value === 0) return 0

    const dadExpenses = filteredExpenses.value
      .filter(e => e.payer_id === user.value.id)
      .reduce((sum, e) => sum + (e.amount || 0), 0)

    return Math.round((dadExpenses / totalAmount.value) * 100)
  })

  // Computed: Pie chart gradient
  const pieGradient = computed(() => {
    const stats = categoryStats.value
    if (stats.length === 0) return 'conic-gradient(#e2e8f0 0% 100%)'

    let currentPos = 0
    const segments = stats.map(cat => {
      const seg = `${cat.color} ${currentPos}% ${currentPos + cat.percent}%`
      currentPos += cat.percent
      return seg
    })

    return `conic-gradient(${segments.join(', ')})`
  })

  // Load children for filter
  async function loadChildren() {
    if (!family.value) return

    try {
      const { data, error: fetchError } = await supabase
        .from('children')
        .select('id, name, gender')
        .eq('family_id', family.value.id)
        .order('date_of_birth', { ascending: false })

      if (fetchError) throw fetchError

      children.value = data || []
    } catch (err) {
      console.error('Error loading children:', err)
    }
  }

  // Load expense rules (active understanding with category='expenses')
  async function loadExpenseRules() {
    if (!family.value) return

    try {
      const { data, error: fetchError } = await supabase
        .from('understandings')
        .select('*')
        .eq('family_id', family.value.id)
        .eq('category', 'expenses')
        .eq('status', 'active')
        .is('child_id', null) // Family-wide rules first
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fetchError) throw fetchError

      expenseRules.value = data
    } catch (err) {
      console.error('Error loading expense rules:', err)
    }
  }

  // Get rules for a specific child (child-specific → family-wide fallback)
  function getChildRules(childId) {
    // TODO: In Phase 2, query child-specific understandings
    // For now, return family-wide rules
    return expenseRules.value?.expense_rules || {
      default_split: { dad_percent: 50, mom_percent: 50 },
      fixed_transfers: [],
      categories: [],
      included_categories: null, // null = all categories included by default
      other_requires_approval: true
    }
  }

  // Resolve the included-category list. When the rule didn't store one (legacy or
  // freshly-set-up family), every known category is included by default — parents
  // can later opt-out individually.
  function getIncludedCategories(rules) {
    if (rules.included_categories && Array.isArray(rules.included_categories)) {
      return rules.included_categories
    }
    return categories.value.map(c => c.id)
  }

  // Same source of truth that classifyExpense uses for "is this in the shared
  // contract?" — exposed for the UI so badges/lanes can't drift from the
  // approval logic.
  function isSharedCategory(category, childId = null) {
    const rules = getChildRules(childId)
    return getIncludedCategories(rules).includes(category)
  }

  // Compute split percentages and amounts for an expense
  function computeSplit(amount, childId, category) {
    const rules = getChildRules(childId)
    const numAmount = parseFloat(amount) || 0

    // Check category-specific rules
    const categoryRule = rules.categories?.find(c => c.name === category)

    let dadPercent, momPercent

    if (categoryRule) {
      dadPercent = categoryRule.dad_percent || 50
      momPercent = categoryRule.mom_percent || 50
    } else {
      // Use default split
      dadPercent = rules.default_split?.dad_percent || 50
      momPercent = rules.default_split?.mom_percent || 50
    }

    return {
      dadPercent,
      momPercent,
      dadAmount: (numAmount * dadPercent) / 100,
      momAmount: (numAmount * momPercent) / 100
    }
  }

  // Save expense rules (create/update understanding)
  async function saveExpenseRules(rules) {
    if (!family.value || !user.value) return

    try {
      // Admin can auto-activate, others need co-parent approval
      const isAdmin = userRole.value === 'admin'
      const status = isAdmin ? 'active' : 'pending'

      const { data, error: upsertError } = await supabase
        .from('understandings')
        .insert({
          family_id: family.value.id,
          child_id: null, // Family-wide for now
          category: 'expenses',
          subject: 'Expense Sharing Agreement',
          content: 'Auto-generated expense sharing rules',
          expense_rules: rules,
          proposed_by: user.value.id,
          proposed_at: new Date().toISOString(),
          status: status,
          valid_from: new Date().toISOString().split('T')[0],
          group_id: crypto.randomUUID(),
          version_number: 1
        })
        .select()
        .single()

      if (upsertError) throw upsertError

      // Reload rules
      await loadExpenseRules()

      return data
    } catch (err) {
      console.error('Error saving expense rules:', err)
      error.value = err.message
      throw err
    }
  }

  // Computed: Filtered expenses by child
  const filteredExpenses = computed(() => {
    if (childFilter.value === null) {
      return expenses.value // All children
    }
    return expenses.value.filter(e => e.child_id === childFilter.value)
  })

  // Computed: Balance data (who paid what vs. who should have paid)
  const balanceData = computed(() => {
    const rules = getChildRules(childFilter.value)
    const total = filteredExpenses.value.reduce((sum, e) => sum + (e.amount || 0), 0)

    if (total === 0 || !user.value) {
      return {
        totalShared: 0,
        momPaid: 0,
        dadPaid: 0,
        targetMom: 0,
        targetDad: 0,
        gap: 0,
        oweDirection: null
      }
    }

    const dadPaid = filteredExpenses.value
      .filter(e => e.payer_id === user.value.id)
      .reduce((sum, e) => sum + (e.amount || 0), 0)
    const momPaid = total - dadPaid

    const defaultSplit = rules.default_split || { dad_percent: 50, mom_percent: 50 }
    const targetDad = (total * defaultSplit.dad_percent) / 100
    const targetMom = (total * defaultSplit.mom_percent) / 100

    const gap = Math.abs(dadPaid - targetDad)
    const oweDirection = dadPaid > targetDad ? 'mom_owes_dad' : 'dad_owes_mom'

    return {
      totalShared: total,
      momPaid,
      dadPaid,
      targetMom,
      targetDad,
      gap,
      oweDirection: dadPaid === targetDad ? null : oweDirection
    }
  })

  // Computed: Fixed transfers from rules
  const fixedTransfers = computed(() => {
    const rules = getChildRules(childFilter.value)
    return rules.fixed_transfers || []
  })

  // Set timeframe and reload
  function setTimeframe(timeframe) {
    activeTimeframe.value = timeframe
    loadExpenses()
  }

  // Set child filter
  function setChildFilter(childId) {
    childFilter.value = childId
  }

  // === Realtime ===
  // Cross-device live sync for expenses. The decide trigger flips
  // expense.status (pending_approval → counted/rejected) server-side
  // when a partner approves, so the requester needs to see that change
  // without a refresh. Simple reload on any change — small payload,
  // simple correctness. Channel pattern mirrors supabaseUpdates.
  const realtimeChannel = ref(null)

  function subscribeToRealtime() {
    if (!family.value?.id) return
    if (realtimeChannel.value) return

    realtimeChannel.value = supabase
      .channel(`expenses-${family.value.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `family_id=eq.${family.value.id}`
        },
        () => { loadExpenses() }
      )
      .subscribe()
  }

  function unsubscribeRealtime() {
    if (realtimeChannel.value) {
      supabase.removeChannel(realtimeChannel.value)
      realtimeChannel.value = null
    }
  }

  return {
    expenses,
    expenseRules,
    children,
    childFilter,
    filteredExpenses,
    categories,
    categoryStats,
    activeTimeframe,
    totalAmount,
    dadShare,
    pieGradient,
    balanceData,
    fixedTransfers,
    loading,
    error,
    loadExpenses,
    loadChildren,
    loadExpenseRules,
    getChildRules,
    getIncludedCategories,
    isSharedCategory,
    classifyExpense,
    computeSplit,
    saveExpenseRules,
    addExpense,
    deleteExpense,
    setTimeframe,
    setChildFilter,
    subscribeToRealtime,
    unsubscribeRealtime
  }
})
