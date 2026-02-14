import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'

export const useSupabaseDashboardStore = defineStore('supabaseDashboard', () => {
  const { user } = useAuth()
  const children = ref([])
  const family = ref(null)
  const events = ref([])
  const custodySchedule = ref({})
  const loading = ref(false)
  const error = ref(null)

  // Load family and children from Supabase
  async function loadFamilyData() {
    if (!user.value) return

    loading.value = true
    error.value = null

    try {
      // Get user's family
      const { data: familyMember, error: memberError } = await supabase
        .from('family_members')
        .select(`
          family_id,
          parent_label,
          families (*)
        `)
        .eq('profile_id', user.value.id)
        .single()

      if (memberError) throw memberError

      family.value = familyMember.families

      // Get children
      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('*')
        .eq('family_id', familyMember.family_id)
        .order('date_of_birth', { ascending: false })

      if (childrenError) throw childrenError

      // Get events for this family
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_children (
            child_id
          )
        `)
        .eq('family_id', familyMember.family_id)
        .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .lte('start_time', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()) // Next 30 days
        .order('start_time', { ascending: true })

      if (eventsError) throw eventsError

      events.value = eventsData || []

      // Get custody cycle
      const { data: custodyData, error: custodyError } = await supabase
        .from('custody_cycles')
        .select('*')
        .eq('family_id', familyMember.family_id)
        .single()

      if (custodyError && custodyError.code !== 'PGRST116') throw custodyError

      // Build custody schedule from cycle data
      if (custodyData) {
        buildCustodySchedule(custodyData)
      }

      children.value = childrenData.map(child => {
        const childEvents = getChildEvents(child.id)
        const nextEvent = getNextEvent(child.id)
        const todaysEvents = getTodaysEvents(child.id)
        const dayProgress = getDayProgress()

        return {
          id: child.id,
          name: child.name,
          gender: child.gender,
          dob: child.date_of_birth,
          medical: child.medical_notes,
          status: getCurrentStatus(child.id),
          nextEventTime: nextEvent?.time || '--:--',
          nextEventLoc: nextEvent?.location || 'unknown',
          nextAction: nextEvent?.type === 'pickup' ? 'pick' : 'drop',
          items: ['Backpack', 'Water Bottle'], // TODO: fetch from items table
          todaysEvents: todaysEvents,
          dayProgress: dayProgress
        }
      })
    } catch (err) {
      console.error('Error loading family data:', err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // Confirm pickup - creates a handoff record
  async function confirmPickup(childId) {
    if (!user.value || !family.value) return

    try {
      const child = children.value.find(c => c.id === childId)
      if (!child) return

      // Create handoff record
      const { error: handoffError } = await supabase
        .from('handoffs')
        .insert({
          family_id: family.value.id,
          child_id: childId,
          from_parent_id: user.value.id, // Simplified - should be other parent
          to_parent_id: user.value.id,
          scheduled_at: new Date().toISOString(),
          actual_at: new Date().toISOString(),
          items_sent: child.items.map(item => ({ name: item, flagged_missing: false }))
        })

      if (handoffError) throw handoffError

      // Reload family data to refresh UI
      await loadFamilyData()
    } catch (err) {
      console.error('Error confirming pickup:', err)
      error.value = err.message
    }
  }

  // Confirm dropoff - creates a handoff record
  async function confirmDropoff(childId, location, items) {
    if (!user.value || !family.value) return

    try {
      // Create handoff record
      const { error: handoffError } = await supabase
        .from('handoffs')
        .insert({
          family_id: family.value.id,
          child_id: childId,
          from_parent_id: user.value.id,
          to_parent_id: user.value.id, // Simplified - should be other parent
          scheduled_at: new Date().toISOString(),
          actual_at: new Date().toISOString(),
          items_sent: items.map(item => ({ name: item, flagged_missing: false })),
          notes: `Dropped off at ${location}`
        })

      if (handoffError) throw handoffError

      // Reload family data to refresh UI
      await loadFamilyData()
    } catch (err) {
      console.error('Error confirming dropoff:', err)
      error.value = err.message
    }
  }

  // Helper: Build custody schedule from cycle data
  function buildCustodySchedule(custodyData) {
    if (!custodyData.cycle_data) return

    const cycleLength = custodyData.cycle_length || 14
    const cycleData = custodyData.cycle_data // Array like ['dad', 'dad', 'mom', 'mom', ...]
    const startDate = new Date(custodyData.cycle_start || Date.now())

    // Generate schedule for 60 days
    const schedule = {}
    for (let i = 0; i < 60; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateKey = date.toISOString().split('T')[0]
      const cycleDay = i % cycleLength
      schedule[dateKey] = cycleData[cycleDay] || 'mom'
    }

    custodySchedule.value = schedule
  }

  // Helper: Get events for a specific child
  function getChildEvents(childId) {
    return events.value.filter(event =>
      event.event_children?.some(ec => ec.child_id === childId)
    )
  }

  // Helper: Get next event for a child
  function getNextEvent(childId) {
    const now = new Date()
    const childEvents = getChildEvents(childId)

    const upcomingEvent = childEvents.find(event =>
      new Date(event.start_time) > now
    )

    if (!upcomingEvent) return null

    const eventDate = new Date(upcomingEvent.start_time)
    return {
      time: eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      location: upcomingEvent.location || 'Unknown',
      type: upcomingEvent.type
    }
  }

  // Helper: Get today's events for timeline
  function getTodaysEvents(childId) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const childEvents = getChildEvents(childId)

    return childEvents
      .filter(event => {
        const eventDate = new Date(event.start_time)
        return eventDate >= today && eventDate < tomorrow
      })
      .map(event => {
        const eventDate = new Date(event.start_time)
        const hour = eventDate.getHours()
        const minute = eventDate.getMinutes()
        const pos = ((hour * 60 + minute) / (24 * 60)) * 100

        return {
          time: eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          label: event.title || event.type,
          pos: pos
        }
      })
  }

  // Helper: Get current day progress (0-100)
  function getDayProgress() {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    return ((hour * 60 + minute) / (24 * 60)) * 100
  }

  // Helper: Get current status for a child
  function getCurrentStatus(childId) {
    const today = new Date().toISOString().split('T')[0]
    const currentParent = custodySchedule.value[today]

    if (currentParent === 'dad') return 'withDad'
    if (currentParent === 'mom') return 'withMom'
    return 'withMom' // Default
  }

  return {
    children,
    family,
    events,
    custodySchedule,
    loading,
    error,
    loadFamilyData,
    confirmPickup,
    confirmDropoff
  }
})
