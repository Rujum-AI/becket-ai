import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUnderstandingsStore = defineStore('understandings', () => {
  // Custody Cycle State
  const cycleLength = ref(14) // 7 or 14 days
  const cycleDays = ref([])
  const isCycleEditing = ref(false)
  const originalCycleDays = ref([])

  // Expense Rules State
  const expenseRules = ref(null) // { rules: {...}, status: 'agreed', approvedDate: '...', creator: '...' }
  const pendingExpenseRules = ref(null) // { rules: {...}, status: 'pending', creator: '...' }
  const expenseRulesHistory = ref([]) // Array of previous rule versions

  // Understandings State
  const understandings = ref([
    // PARENTING
    { id: 101, subject: 'parenting', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'ימי חול: א׳ ו-ג׳ אצל אדן, ד׳ ו-ה׳ אצל דילן. ימי ו׳ לסירוגין.' },
    { id: 102, subject: 'parenting', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'סופי שבוע: לסירוגין. שישי מסיום מסגרת עד ראשון בבוקר.' },
    { id: 103, subject: 'parenting', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'מחלה: ילד חולה נשאר איפה שהתעורר. איסוף ממוסד חינוכי - ע״י ההורה של אותו יום.' },
    { id: 104, subject: 'parenting', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'מגורים: מרכז החיים במודיעין. מעבר מעל 30 דק׳ מחייב הסכמה.' },
    { id: 105, subject: 'parenting', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'הרכובים: הרכוב אחד אצל כל הורה. העברה להורה הטס לפי הצורך.' },

    // HOLIDAYS
    { id: 201, subject: 'holidays', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'חגים: סבב לסירוגין (ראש השנה, כיפור, סוכות, פסח) לפי טבלת ההסכם.' },
    { id: 202, subject: 'holidays', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'חופש גדול: חלוקה שווה. זכות ראשונים לתיאום מתחלפת (2025 - אמא).' },
    { id: 203, subject: 'holidays', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'ימי הולדת: שואפים לחגיגה משותפת. אם לא מסתייע, כל הורה חוגג בנפרד.' },

    // EXPENSES
    { id: 301, subject: 'expenses', status: 'agreed', creator: 'System', history: [], expiration: '2026-10-31', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'מזונות (רום): אדן משלם 2,000 ₪ עד גיל 6 (10/2026).' },
    { id: 302, subject: 'expenses', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'קצבת נכות: לאן עד גיל 6. אח״כ חלוקה שווה (50/50).' },
    { id: 303, subject: 'expenses', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'מחציות: חלוקה שווה (50/50) בהוצאות חינוך (חוגים, ציוד) ורפואה חריגה.' },
    { id: 304, subject: 'expenses', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'ביגוד: בתים נפרדים. קניית שנתית משותפת בסך 5,000 ₪ לחלוקה בין הבתים.' },
    { id: 305, subject: 'expenses', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'קנסות: אי-איסוף ללא התראה - 150 ₪ (יום לימודים) / 300 ₪ (חופש).' },

    // OTHERS
    { id: 401, subject: 'others', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'מחלוקות: הכרעה ע״י גורם מקצועי (רופא/יועצת) בהעדר הסכמה.' },
    { id: 402, subject: 'others', status: 'agreed', creator: 'System', history: [], expiration: '', approvedDate: '2025-08-17', isHistoryOpen: false, content: 'הודעה על אירועים: חובת עדכון הדדית על אירועי גן/בית ספר לאפשרות הגעה משותפת.' }
  ])

  // Computed
  const groupedUnderstandings = computed(() => {
    const groups = {}
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
    const children = [{ id: 1, name: 'Rom' }, { id: 2, name: 'Kai' }] // TODO: Get from dashboard store
    return cycleDays.value.every(day => {
      return children.every(child =>
        day.allocation && day.allocation.find(a => a.childId === child.id)
      )
    })
  })

  // Custody Actions
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

  function saveCycle() {
    localStorage.setItem('becket_cycle_data', JSON.stringify(cycleDays.value))
    isCycleEditing.value = false
  }

  function assignDayAllocation(dayIndex, children, parent, repeat = false) {
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

      children.forEach(child => {
        day.allocation = day.allocation.filter(a => a.childId !== child.id)
        day.allocation.push({
          childId: child.id,
          childGender: child.gender,
          parent
        })
      })
    })
  }

  // Understanding Actions
  function addUnderstanding(data) {
    understandings.value.push({
      id: Date.now(),
      subject: data.subject,
      content: data.content,
      status: 'pending',
      creator: 'Me',
      history: [],
      expiration: data.expiration || '',
      approvedDate: null,
      isHistoryOpen: false,
      terminationRequested: false
    })
    saveUnderstandings()
  }

  function updateUnderstanding(id, data) {
    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    if (item.status === 'agreed') {
      item.history.push({
        content: item.content,
        date: new Date().toISOString().split('T')[0]
      })
    }

    item.subject = data.subject
    item.content = data.content
    item.expiration = data.expiration || ''
    item.status = 'pending'
    item.creator = 'Me'
    saveUnderstandings()
  }

  function approveUnderstanding(id) {
    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    if (item.terminationRequested) {
      item.status = 'rejected'
      item.terminationRequested = false
      item.terminatedDate = new Date().toISOString().split('T')[0]
    } else {
      item.status = 'agreed'
      item.approvedDate = new Date().toISOString().split('T')[0]
    }
    saveUnderstandings()
  }

  function rejectUnderstanding(id) {
    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    if (item.terminationRequested) {
      item.status = 'agreed'
      item.terminationRequested = false
    } else {
      if (item.history.length > 0) {
        const lastVer = item.history.pop()
        item.content = lastVer.content
        item.status = 'agreed'
      } else {
        item.status = 'rejected'
        item.approvedDate = null
      }
    }
    saveUnderstandings()
  }

  function requestTermination(id) {
    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    item.status = 'pending'
    item.terminationRequested = true
    item.creator = 'Me'
    saveUnderstandings()
  }

  function cancelProposal(id) {
    const item = understandings.value.find(u => u.id === id)
    if (!item) return

    if (item.history.length > 0) {
      const lastVer = item.history.pop()
      item.content = lastVer.content
      item.status = 'agreed'
    } else {
      understandings.value = understandings.value.filter(u => u.id !== id)
    }
    saveUnderstandings()
  }

  function reviveUnderstanding(id) {
    const item = understandings.value.find(u => u.id === id)
    if (!item) return
    item.terminatedDate = null
  }

  function toggleHistory(id) {
    const item = understandings.value.find(u => u.id === id)
    if (item) {
      item.isHistoryOpen = !item.isHistoryOpen
    }
  }

  function saveUnderstandings() {
    localStorage.setItem('becket_understandings_v2', JSON.stringify(understandings.value))
  }

  function saveExpenseRulesLocal() {
    localStorage.setItem('becket_expense_rules', JSON.stringify({
      active: expenseRules.value,
      pending: pendingExpenseRules.value,
      history: expenseRulesHistory.value
    }))
  }

  // Expense Rules Actions
  function proposeExpenseRules(rules) {
    // If there are already active rules, push current to history
    if (expenseRules.value) {
      pendingExpenseRules.value = {
        rules,
        status: 'pending',
        creator: 'Me',
        proposedDate: new Date().toISOString().split('T')[0]
      }
    } else {
      // No existing rules - first-time setup
      pendingExpenseRules.value = {
        rules,
        status: 'pending',
        creator: 'Me',
        proposedDate: new Date().toISOString().split('T')[0]
      }
    }
    saveExpenseRulesLocal()
  }

  function approveExpenseRules() {
    if (!pendingExpenseRules.value) return

    // Push current active rules to history (if they exist)
    if (expenseRules.value) {
      expenseRulesHistory.value.push({
        ...expenseRules.value,
        supersededDate: new Date().toISOString().split('T')[0]
      })
    }

    // Promote pending to active
    expenseRules.value = {
      rules: pendingExpenseRules.value.rules,
      status: 'agreed',
      creator: pendingExpenseRules.value.creator,
      approvedDate: new Date().toISOString().split('T')[0]
    }
    pendingExpenseRules.value = null
    saveExpenseRulesLocal()
  }

  function rejectExpenseRules() {
    if (!pendingExpenseRules.value) return
    pendingExpenseRules.value = null
    saveExpenseRulesLocal()
  }

  // Initialize
  function init() {
    // Load cycle data
    try {
      const savedCycle = localStorage.getItem('becket_cycle_data')
      if (savedCycle) {
        const parsed = JSON.parse(savedCycle)
        if (Array.isArray(parsed) && parsed.length > 0) {
          cycleDays.value = parsed
          cycleLength.value = parsed.length
        } else {
          initCycle()
        }
      } else {
        initCycle()
      }
    } catch (e) {
      initCycle()
    }

    // Ensure all understandings have isHistoryOpen property
    understandings.value.forEach(item => {
      if (typeof item.isHistoryOpen === 'undefined') {
        item.isHistoryOpen = false
      }
      if (typeof item.terminationRequested === 'undefined') {
        item.terminationRequested = false
      }
    })

    // Load expense rules
    try {
      const savedRules = localStorage.getItem('becket_expense_rules')
      if (savedRules) {
        const parsed = JSON.parse(savedRules)
        expenseRules.value = parsed.active || null
        pendingExpenseRules.value = parsed.pending || null
        expenseRulesHistory.value = parsed.history || []
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  return {
    // State
    cycleLength,
    cycleDays,
    isCycleEditing,
    understandings,
    expenseRules,
    pendingExpenseRules,
    expenseRulesHistory,

    // Computed
    groupedUnderstandings,
    rejectedItems,
    isFullyAssigned,

    // Actions
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
    init
  }
})
