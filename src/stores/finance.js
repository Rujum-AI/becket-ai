import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useFinanceStore = defineStore('finance', () => {
  const expenses = ref([
    { id: 101, title: 'Math Tutor', amount: 200, payer: 'me', date: 'Feb 02', category: 'education' },
    { id: 102, title: 'Tennis Shoes', amount: 350, payer: 'partner', date: 'Feb 01', category: 'clothing' },
    { id: 103, title: 'Dentist Checkup', amount: 400, payer: 'me', date: 'Jan 28', category: 'healthcare' }
  ])

  const categories = ref([
    { id: 'education', name: 'education', color: '#FCD34D', percent: 35, amount: 2100, icon: 'education.png' },
    { id: 'activities', name: 'activities', color: '#F87171', percent: 20, amount: 1200, icon: 'activities.png' },
    { id: 'healthcare', name: 'healthcare', color: '#34D399', percent: 10, amount: 600, icon: 'healthcare.png' },
    { id: 'clothing', name: 'clothing', color: '#60A5FA', percent: 10, amount: 600, icon: 'clothing.png' },
    { id: 'food', name: 'food', color: '#FB923C', percent: 10, amount: 600, icon: 'food_beverages.png' },
    { id: 'legal', name: 'legal', color: '#94A3B8', percent: 10, amount: 600, icon: 'legal_bills.png' },
    { id: 'events', name: 'events', color: '#F472B6', percent: 5, amount: 300, icon: 'birthday_events.png' }
  ])

  const activeTimeframe = ref('month')

  const totalAmount = computed(() => {
    return activeTimeframe.value === 'month' ? 6000 : 72000
  })

  const dadShare = computed(() => {
    return activeTimeframe.value === 'month' ? 65 : 50
  })

  const pieGradient = computed(() => {
    let css = 'conic-gradient('
    let currentPos = 0
    categories.value.forEach((cat, index) => {
      css += `${cat.color} ${currentPos}% ${currentPos + cat.percent}%`
      if (index < categories.value.length - 1) css += ', '
      currentPos += cat.percent
    })
    css += ')'
    return css
  })

  function addExpense(expenseData) {
    const cat = categories.value.find(c => c.id === expenseData.category)
    expenses.value.unshift({
      id: Date.now(),
      title: expenseData.title,
      amount: expenseData.amount,
      payer: expenseData.payer || 'me',
      date: 'Today',
      category: expenseData.category,
      icon: cat ? cat.icon : 'finance.png'
    })
  }

  function setTimeframe(timeframe) {
    activeTimeframe.value = timeframe
  }

  return {
    expenses,
    categories,
    activeTimeframe,
    totalAmount,
    dadShare,
    pieGradient,
    addExpense,
    setTimeframe
  }
})
