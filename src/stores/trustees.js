import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTrusteesStore = defineStore('trustees', () => {
  const schools = ref([
    {
      id: 1,
      name: 'Rainbow Kindergarten',
      address: 'Herzl 45, Modiin',
      contact: '050-1234567',
      children: [2],
      items: ['Water Bottle'],
      schedule: {
        days: [
          { active: true, start: '07:30', end: '16:00' },   // Sunday
          { active: true, start: '07:30', end: '16:00' },   // Monday
          { active: true, start: '07:30', end: '16:00' },   // Tuesday
          { active: true, start: '07:30', end: '16:00' },   // Wednesday
          { active: true, start: '07:30', end: '16:00' },   // Thursday
          { active: false, start: '', end: '' },            // Friday
          { active: false, start: '', end: '' }             // Saturday
        ],
        repeatFreq: 1,
        startDate: new Date().toISOString().split('T')[0],
        endDate: ''
      }
    }
  ])

  const activities = ref([
    {
      id: 2,
      name: 'Judo',
      address: 'Community Center',
      contact: '050-000000',
      children: [1],
      items: ['Gi'],
      schedule: {
        days: [
          { active: false, start: '', end: '' },           // Sunday
          { active: true, start: '17:00', end: '18:00' },  // Monday
          { active: false, start: '', end: '' },           // Tuesday
          { active: true, start: '17:00', end: '18:00' },  // Wednesday
          { active: false, start: '', end: '' },           // Thursday
          { active: false, start: '', end: '' },           // Friday
          { active: false, start: '', end: '' }            // Saturday
        ],
        repeatFreq: 1,
        startDate: new Date().toISOString().split('T')[0],
        endDate: ''
      }
    }
  ])

  const people = ref([
    {
      id: 1,
      name: 'Grandma Ruth',
      relationship: 'Family',
      address: 'Tel Aviv',
      contact: '052-9999999'
    }
  ])

  function addSchool(school) {
    schools.value.push({
      id: Date.now(),
      ...school
    })
  }

  function updateSchool(id, updates) {
    const index = schools.value.findIndex(s => s.id === id)
    if (index !== -1) {
      schools.value[index] = { ...schools.value[index], ...updates }
    }
  }

  function deleteSchool(id) {
    schools.value = schools.value.filter(s => s.id !== id)
  }

  function addActivity(activity) {
    activities.value.push({
      id: Date.now(),
      ...activity
    })
  }

  function updateActivity(id, updates) {
    const index = activities.value.findIndex(a => a.id === id)
    if (index !== -1) {
      activities.value[index] = { ...activities.value[index], ...updates }
    }
  }

  function deleteActivity(id) {
    activities.value = activities.value.filter(a => a.id !== id)
  }

  function addPerson(person) {
    people.value.push({
      id: Date.now(),
      ...person
    })
  }

  function updatePerson(id, updates) {
    const index = people.value.findIndex(p => p.id === id)
    if (index !== -1) {
      people.value[index] = { ...people.value[index], ...updates }
    }
  }

  function deletePerson(id) {
    people.value = people.value.filter(p => p.id !== id)
  }

  return {
    schools,
    activities,
    people,
    addSchool,
    updateSchool,
    deleteSchool,
    addActivity,
    updateActivity,
    deleteActivity,
    addPerson,
    updatePerson,
    deletePerson
  }
})
