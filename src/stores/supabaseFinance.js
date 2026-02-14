import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'

export const useSupabaseFinanceStore = defineStore('supabaseFinance', () => {
  const { user } = useAuth()
  const { family, userRole } = useFamily()

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

  // Add new expense
  async function addExpense(expenseData) {
    if (!family.value || !user.value) return

    try {
      const amount = parseFloat(expenseData.amount)
      const childId = expenseData.childId || null
      const category = expenseData.category

      // Get partner ID if payer is 'partner'
      let payerId = user.value.id
      if (expenseData.payer === 'partner') {
        // Get the other family member (partner)
        const { data: members, error } = await supabase
          .from('family_members')
          .select('profile_id')
          .eq('family_id', family.value.id)
          .neq('profile_id', user.value.id)
          .limit(1)
          .maybeSingle()

        if (members && !error) {
          payerId = members.profile_id
        }
        // If no partner found (solo mode), payerId remains as current user
      }

      // Compute split from rules
      const split = computeSplit(amount, childId, category)

      // Determine status
      const rules = getChildRules(childId)
      let status = 'counted'
      let requiresApprovalReason = null

      // Admin can bypass approval flows
      const isAdmin = userRole.value === 'admin'

      // Check if "other" category requires approval (unless admin)
      if (!isAdmin && category === 'other' && rules.other_requires_approval) {
        status = 'pending_approval'
        requiresApprovalReason = 'category_other'
      }

      // TODO: Check budget limits (requires expense_budget_cache query)

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
          date: new Date().toISOString().split('T')[0],
          status: status,
          requires_approval_reason: requiresApprovalReason,
          split_dad_percent: split.dadPercent,
          split_mom_percent: split.momPercent,
          split_dad_amount: split.dadAmount,
          split_mom_amount: split.momAmount,
          created_by: user.value.id
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Reload expenses to refresh UI
      await loadExpenses()

      return data
    } catch (err) {
      console.error('Error adding expense:', err)
      error.value = err.message
      throw err
    }
  }

  // Delete expense
  async function deleteExpense(expenseId) {
    try {
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)

      if (deleteError) throw deleteError

      // Remove from local state
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

    let css = 'conic-gradient('
    let currentPos = 0

    stats.forEach((cat, index) => {
      css += `${cat.color} ${currentPos}% ${currentPos + cat.percent}%`
      if (index < stats.length - 1) css += ', '
      currentPos += cat.percent
    })
    css += ')'

    return css
  })

  // Load children for filter
  async function loadChildren() {
    if (!family.value) return

    try {
      const { data, error: fetchError } = await supabase
        .from('children')
        .select('id, name')
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
      other_requires_approval: true
    }
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
    return expenses.value.filter(e => e.child_id === childFilter.value || e.child_id === null)
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
    computeSplit,
    saveExpenseRules,
    addExpense,
    deleteExpense,
    setTimeframe,
    setChildFilter
  }
})
