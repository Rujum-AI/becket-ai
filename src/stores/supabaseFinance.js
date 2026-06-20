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
  // Normalized budgets (migration 039 onwards). Source of truth for
  // classifyExpense — JSONB rules.categories[].budget_limit is being
  // phased out on this branch.
  const categoryBudgets = ref([])

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
        // Tiebreaker on created_at so freshly-added rows for today
        // land at the top instead of getting shuffled with same-date
        // entries in non-deterministic order.
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

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

    // Money budget — now sourced from the normalized category_budgets
    // table (migration 039). Per-child override takes precedence over
    // family-wide. Item-count caps stay in the JSONB override for now
    // (separate normalization).
    const numAmount = parseFloat(amount) || 0
    const monthlyBudget = getCategoryBudget(category, childId, 'monthly')
    const yearlyBudget = getCategoryBudget(category, childId, 'yearly')

    if (monthlyBudget) {
      const { spent } = currentCategoryUsage(category, childId, 'monthly')
      if (spent + numAmount > Number(monthlyBudget.limit_amount)) {
        return { route: 'pending', reasonKey: 'expenseOverBudgetReason', reason: 'exceeds_budget' }
      }
    }
    if (yearlyBudget) {
      const { spent } = currentCategoryUsage(category, childId, 'yearly')
      if (spent + numAmount > Number(yearlyBudget.limit_amount)) {
        return { route: 'pending', reasonKey: 'expenseOverBudgetReason', reason: 'exceeds_budget' }
      }
    }

    // Item-count caps still come from JSONB until they get their own table.
    if (override && override.limit_count?.max != null && override.limit_count.max > 0) {
      const period = override.limit_count.period || 'monthly'
      const { count } = currentCategoryUsage(category, childId, period)
      if (count + 1 > override.limit_count.max) {
        return { route: 'pending', reasonKey: 'expenseOverItemLimitReason', reason: 'exceeds_count' }
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

      // Determine status from the deterministic router. Both parents
      // are co-equal in this product — the previous admin bypass
      // ("admin trusts themselves") undermined the entire approval /
      // pending_actions framework, so it's removed. A flagged expense
      // routes to pending regardless of who created it; the partner
      // sees the request and decides.
      const decision = classifyExpense({ amount, category, childId })
      const status = decision.route === 'pending' ? 'pending_approval' : 'counted'
      // Fallback to 'no_rule' (a valid CHECK value) if reason ever goes
      // missing, so the insert doesn't fail a DB CHECK on an unknown sentinel.
      const requiresApprovalReason = decision.route === 'pending'
        ? (decision.reason || 'no_rule')
        : null

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

  // Pie / totals / dadShare reflect what's visible in the transaction
  // list — counted + pending (rejected is already filtered out of
  // filteredExpenses, so it never reaches here). Pending rows count
  // optimistically into the visualizations so the user's mental model
  // ("I added it → I see it") stays consistent. Numbers wouldn't
  // suddenly drop just because something's awaiting approval.

  // Computed: Total amount for current timeframe (respects filter, excludes rejected)
  const totalAmount = computed(() => {
    return filteredExpenses.value.reduce((sum, expense) => sum + (expense.amount || 0), 0)
  })

  // Computed: Category breakdown with percentages (respects filter, excludes rejected)
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
    }).filter(cat => cat.amount > 0)

    return stats
  })

  // Computed: Dad's share percentage (respects filter, excludes rejected)
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

  // === Category budgets (normalized, migration 039) ===
  // Replaces rules.categories[].budget_limit as the source of truth.
  // Family-wide + per-child rows coexist; per-child overrides family-wide.

  async function loadCategoryBudgets() {
    if (!family.value) return
    try {
      const { data, error: fetchError } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('family_id', family.value.id)
      if (fetchError) throw fetchError
      categoryBudgets.value = data || []
    } catch (err) {
      console.error('Error loading category budgets:', err)
      categoryBudgets.value = []
    }
  }

  // Resolve the active budget for a (category, child) pair. Per-child
  // wins; falls back to family-wide; returns null if neither exists.
  function getCategoryBudget(category, childId = null, period = 'monthly') {
    const list = categoryBudgets.value
    if (childId) {
      const perChild = list.find(b => b.category === category && b.child_id === childId && b.period === period)
      if (perChild) return perChild
    }
    return list.find(b => b.category === category && b.child_id === null && b.period === period) || null
  }

  // Upsert (one row per family_id × category × child_id × period — see
  // uniq_category_budgets in migration 039). amount must be > 0; null
  // amount = delete that budget instead.
  async function saveCategoryBudget({ category, period, amount, childId = null }) {
    if (!family.value || !user.value) return
    if (amount == null || Number(amount) <= 0) {
      return removeCategoryBudget({ category, period, childId })
    }
    const { error: upsertError } = await supabase
      .from('category_budgets')
      .upsert({
        family_id: family.value.id,
        category,
        child_id: childId,
        period,
        limit_amount: Number(amount),
        created_by: user.value.id
      }, { onConflict: 'family_id,category,child_id,period', ignoreDuplicates: false })
    if (upsertError) {
      // upsert with onConflict requires the unique index to use the same
      // columns — our index uses COALESCE(child_id, sentinel), so the
      // upsert may fall back to insert+conflict. Fallback: explicit update.
      const existing = getCategoryBudget(category, childId, period)
      if (existing) {
        const { error: updErr } = await supabase
          .from('category_budgets')
          .update({ limit_amount: Number(amount) })
          .eq('id', existing.id)
        if (updErr) throw updErr
      } else {
        throw upsertError
      }
    }
    await loadCategoryBudgets()
  }

  async function removeCategoryBudget({ category, period, childId = null }) {
    if (!family.value) return
    const existing = getCategoryBudget(category, childId, period)
    if (!existing) return
    const { error: delErr } = await supabase
      .from('category_budgets')
      .delete()
      .eq('id', existing.id)
    if (delErr) throw delErr
    await loadCategoryBudgets()
  }

  // Mirror of supabaseUnderstandings.syncCategoryBudgetsFromRule — kept
  // local so saveExpenseRules can call it without a circular store import.
  // Replace-all-in-scope semantics: every budget for this rule's scope
  // (family-wide vs child-specific) is rebuilt from the rule's JSONB.
  async function syncCategoryBudgetsFromRule(rule) {
    if (!family.value?.id || !rule?.expense_rules) return
    const childId = rule.child_id || null

    let delQuery = supabase
      .from('category_budgets')
      .delete()
      .eq('family_id', family.value.id)
    delQuery = childId === null
      ? delQuery.is('child_id', null)
      : delQuery.eq('child_id', childId)
    await delQuery

    const cats = rule.expense_rules.categories || []
    const rows = cats
      .filter(c => c?.budget_limit?.amount && Number(c.budget_limit.amount) > 0)
      .map(c => ({
        family_id: family.value.id,
        child_id: childId,
        category: c.name,
        period: c.budget_limit.period || 'monthly',
        limit_amount: Number(c.budget_limit.amount),
        created_by: user.value.id
      }))

    if (rows.length > 0) {
      const { error: insErr } = await supabase
        .from('category_budgets')
        .insert(rows)
      if (insErr) {
        console.warn('category_budgets sync insert failed:', insErr.message)
      }
    }
    await loadCategoryBudgets()
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

      // If the rule went straight to active (admin path), sync the
      // normalized budget table to match. Pending rules sync on approve
      // via supabaseUnderstandings.syncCategoryBudgetsFromRule.
      if (data?.status === 'active') {
        await syncCategoryBudgetsFromRule(data)
      }

      // Reload rules
      await loadExpenseRules()

      return data
    } catch (err) {
      console.error('Error saving expense rules:', err)
      error.value = err.message
      throw err
    }
  }

  // Computed: Filtered expenses by child — drives the transaction list
  // and the pie/total/balance computeds (which further filter to
  // status='counted'). Rejected rows are hidden everywhere: from the
  // user's POV, "rejected" means the partner declined → effectively
  // gone. Pending rows stay visible with a badge so the requester
  // sees their own outstanding submission.
  const filteredExpenses = computed(() => {
    const visible = expenses.value.filter(e => e.status !== 'rejected')
    if (childFilter.value === null) return visible
    return visible.filter(e => e.child_id === childFilter.value)
  })

  // Computed: Balance data (who paid what vs. who should have paid).
  // Same source as the pie — visible expenses (counted + pending,
  // excluding rejected). Mental model: "if I see it in the list, it
  // moves the bar." Approval state is communicated by the row badge.
  const balanceData = computed(() => {
    const rules = getChildRules(childFilter.value)
    const visible = filteredExpenses.value
    const total = visible.reduce((sum, e) => sum + (e.amount || 0), 0)

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

    const dadPaid = visible
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
      .channel(`finance-${family.value.id}`)
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'category_budgets',
          filter: `family_id=eq.${family.value.id}`
        },
        () => { loadCategoryBudgets() }
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
    categoryBudgets,
    loadCategoryBudgets,
    getCategoryBudget,
    saveCategoryBudget,
    removeCategoryBudget,
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
