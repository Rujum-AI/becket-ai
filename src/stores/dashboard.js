import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFamily } from '@/composables/useFamily'

export const useDashboardStore = defineStore('dashboard', () => {
  const { children: familyChildren } = useFamily()
  const childrenStatus = ref({})

  const children = computed(() => {
    return familyChildren.value.map((child) => {
      const status = childrenStatus.value[child.id] || {
        status: 'withMom',
        nextEventTime: '16:00',
        nextEventLoc: 'school',
        nextAction: 'pick',
        items: ['Backpack', 'Lunch', 'Jacket']
      }

      return {
        id: child.id,  // Use real UUID from database
        name: child.name,
        gender: child.gender,
        dob: child.date_of_birth,
        medical: child.medical_notes,
        ...status,
        todaysEvents: [
          { time: '08:00', label: 'School', pos: 33 },
          { time: '16:00', label: 'Pickup', pos: 66 }
        ],
        dayProgress: 50
      }
    })
  })

  function updateChildStatus(childId, newStatus) {
    childrenStatus.value[childId] = {
      ...childrenStatus.value[childId],
      ...newStatus
    }
  }

  function confirmPickup(childId) {
    const currentStatus = childrenStatus.value[childId] || {}
    updateChildStatus(childId, {
      ...currentStatus,
      status: 'withDad',
      nextAction: 'drop',
      nextEventTime: 'Tomorrow',
      nextEventLoc: 'at School',
      items: currentStatus.items || []
    })
  }

  function confirmDropoff(childId, location, items) {
    updateChildStatus(childId, {
      status: 'withMom',
      nextAction: 'pick',
      nextEventTime: '16:00',
      nextEventLoc: `from ${location}`,
      items: items
    })
  }

  return {
    children,
    updateChildStatus,
    confirmPickup,
    confirmDropoff
  }
})
