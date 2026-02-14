import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'

export const useSupabaseDashboardStore = defineStore('supabaseDashboard', () => {
  const { user } = useAuth()

  const children = ref([])
  const family = ref(null)
  const parentLabel = ref(null) // 'dad' or 'mom'
  const partnerId = ref(null)   // co-parent's profile_id (null in solo)
  const partnerLabel = ref(null) // co-parent's parent_label
  const events = ref([])
  const custodySchedule = ref({})
  const custodyOverrides = ref([])
  const pendingOverrides = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Load family and children from Supabase
  async function loadFamilyData() {
    if (!user.value) return

    loading.value = true
    error.value = null

    try {
      // Get user's family membership
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
      parentLabel.value = familyMember.parent_label

      // Get partner (co-parent) if exists
      const { data: partnerData } = await supabase
        .from('family_members')
        .select('profile_id, parent_label')
        .eq('family_id', familyMember.family_id)
        .neq('profile_id', user.value.id)
        .maybeSingle()

      partnerId.value = partnerData?.profile_id || null
      partnerLabel.value = partnerData?.parent_label || null

      // Get children (now includes current_status columns)
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
        .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .lte('start_time', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_time', { ascending: true })

      if (eventsError) throw eventsError

      events.value = eventsData || []

      // Get custody cycle (optional — may not exist yet)
      const { data: custodyData, error: custodyError } = await supabase
        .from('custody_cycles')
        .select('*')
        .eq('family_id', familyMember.family_id)
        .is('valid_until', null) // Active cycle only
        .maybeSingle()

      if (custodyError && custodyError.code !== 'PGRST116') {
        console.warn('Custody cycle query error:', custodyError)
      }

      // Get custody overrides (approved + pending)
      const { data: overridesData, error: overridesError } = await supabase
        .from('custody_overrides')
        .select('*')
        .eq('family_id', familyMember.family_id)
        .in('status', ['approved', 'pending'])

      if (!overridesError) {
        custodyOverrides.value = overridesData || []
        pendingOverrides.value = (overridesData || []).filter(o => o.status === 'pending')
      }

      if (custodyData) {
        buildCustodySchedule(custodyData)
      }

      // Build child data for UI
      children.value = childrenData.map(child => {
        const todaysEvents = getTodaysEvents(child.id)
        const dayProgress = getDayProgress()
        const nextEvent = getNextEvent(child.id)
        const nextHandoff = getNextHandoff(child.id)
        const myLabel = parentLabel.value || 'dad'

        // Status comes from DB (button press), not computed from custody
        const status = child.current_status || 'unknown'

        // Next action: if child is with me → dropoff, otherwise → pickup
        const childIsWithMe = status === `with_${myLabel}`
        const nextAction = childIsWithMe ? 'drop' : 'pick'

        return {
          id: child.id,
          name: child.name,
          gender: child.gender,
          dob: child.date_of_birth,
          medical: child.medical_notes,
          status: status,
          currentParentId: child.current_parent_id,
          nextEventTime: nextEvent?.time || '--:--',
          nextEventLoc: nextEvent?.location || '',
          nextAction: nextAction,
          nextHandoffTime: nextHandoff?.time || null,
          nextHandoffType: nextHandoff?.type || null,
          items: [], // TODO: fetch from items table
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

  // Create a new event and link it to children
  async function createEvent({ title, date, time, endTime, location, notes, type, childIds }) {
    if (!user.value || !family.value) return

    try {
      const startTime = time ? `${date}T${time}:00` : `${date}T00:00:00`
      const allDay = !time

      const insertData = {
        family_id: family.value.id,
        type: type || 'manual',
        title,
        description: notes || null,
        start_time: startTime,
        end_time: endTime ? `${date}T${endTime}:00` : null,
        all_day: allDay,
        location_name: location || null,
        status: 'scheduled',
        created_by: user.value.id
      }

      const { data: eventData, error: insertError } = await supabase
        .from('events')
        .insert(insertData)
        .select()
        .single()

      if (insertError) throw insertError

      // Link children to event
      if (childIds && childIds.length > 0) {
        const { error: childError } = await supabase
          .from('event_children')
          .insert(childIds.map(childId => ({
            event_id: eventData.id,
            child_id: childId
          })))

        if (childError) throw childError
      }

      // Reload to refresh calendar
      await loadFamilyData()
      return eventData
    } catch (err) {
      console.error('Error creating event:', err)
      error.value = err.message
      throw err
    }
  }

  // Check if current user is the expected custody parent today
  function isExpectedParentToday() {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const expected = getExpectedParent(today)
    if (!expected) return true // No cycle = anyone can pick up
    return expected === parentLabel.value
  }

  // Confirm pickup — child is now WITH ME
  // Returns { unexpectedParent: true } if user is not the expected parent
  async function confirmPickup(childId, { force = false } = {}) {
    if (!user.value || !family.value) return

    // Check if user is expected parent (unless force=true from confirmation dialog)
    if (!force && !isExpectedParentToday()) {
      return { unexpectedParent: true, childId }
    }

    try {
      const child = children.value.find(c => c.id === childId)
      if (!child) return

      const myLabel = parentLabel.value || 'dad'
      const newStatus = `with_${myLabel}`

      // 1. Update child status in DB
      const { error: updateError } = await supabase
        .from('children')
        .update({
          current_status: newStatus,
          current_parent_id: user.value.id,
          status_changed_at: new Date().toISOString(),
          status_changed_by: user.value.id
        })
        .eq('id', childId)

      if (updateError) throw updateError

      // 2. Create handoff record
      const fromParent = partnerId.value || user.value.id
      const { error: handoffError } = await supabase
        .from('handoffs')
        .insert({
          family_id: family.value.id,
          child_id: childId,
          from_parent_id: fromParent,
          to_parent_id: user.value.id,
          scheduled_at: new Date().toISOString(),
          actual_at: new Date().toISOString(),
          items_sent: []
        })

      if (handoffError) {
        console.error('Handoff insert error:', handoffError)
      }

      // 3. Reload to refresh UI (notification created by DB trigger)
      await loadFamilyData()
    } catch (err) {
      console.error('Error confirming pickup:', err)
      error.value = err.message
    }
  }

  // Confirm dropoff — child goes to a location
  async function confirmDropoff(childId, location, items) {
    if (!user.value || !family.value) return

    try {
      const child = children.value.find(c => c.id === childId)
      if (!child) return

      // Map location to status
      const newStatus = mapLocationToStatus(location)

      // 1. Update child status in DB
      const updateData = {
        current_status: newStatus,
        status_changed_at: new Date().toISOString(),
        status_changed_by: user.value.id
      }

      // If dropping off to partner, set their parent_id
      if (newStatus.startsWith('with_') && partnerId.value) {
        updateData.current_parent_id = partnerId.value
      } else {
        updateData.current_parent_id = null // at school/activity
      }

      const { error: updateError } = await supabase
        .from('children')
        .update(updateData)
        .eq('id', childId)

      if (updateError) throw updateError

      // 2. Create handoff record
      const toParent = partnerId.value || user.value.id // solo: self
      const { error: handoffError } = await supabase
        .from('handoffs')
        .insert({
          family_id: family.value.id,
          child_id: childId,
          from_parent_id: user.value.id,
          to_parent_id: toParent,
          scheduled_at: new Date().toISOString(),
          actual_at: new Date().toISOString(),
          items_sent: (items || []).map(item => ({ name: item, flagged_missing: false })),
          notes: `Dropped off at ${location}`
        })

      if (handoffError) {
        console.error('Handoff insert error:', handoffError)
      }

      // 3. Reload to refresh UI (notification created by DB trigger)
      await loadFamilyData()
    } catch (err) {
      console.error('Error confirming dropoff:', err)
      error.value = err.message
    }
  }

  // Map dropdown location text to a status value
  function mapLocationToStatus(location) {
    if (!location) return 'unknown'
    const loc = location.toLowerCase()
    if (loc.includes('school') || loc.includes('daycare') || loc.includes('kindergarten')) {
      return 'at_school'
    }
    // Everything else (soccer, tennis, music, dance, grandma, etc.) = activity/trustee
    return 'at_activity'
  }

  // Helper: Get expected custody parent for today (from cycle)
  function getExpectedParent(dateStr) {
    if (!dateStr) {
      const now = new Date()
      dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    }
    return custodySchedule.value[dateStr] || null
  }

  // Helper: Build custody schedule from cycle data
  function buildCustodySchedule(custodyData) {
    if (!custodyData.cycle_data) return

    const cycleLength = custodyData.cycle_length || 14
    const cycleData = custodyData.cycle_data
    const startDate = new Date(custodyData.valid_from || Date.now())

    // cycle_data is always indexed so that index % 7 = day-of-week (0=Sun, 6=Sat)
    // Align to the Sunday of the valid_from week so getDay() maps correctly
    const startDow = startDate.getDay() // 0=Sun, 6=Sat
    const cycleEpoch = new Date(startDate)
    cycleEpoch.setDate(cycleEpoch.getDate() - startDow) // Back to Sunday

    const schedule = {}
    for (let i = -14; i < 100; i++) {
      const date = new Date(cycleEpoch)
      date.setDate(cycleEpoch.getDate() + i)
      // Use local timezone (NOT toISOString which converts to UTC)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const dateKey = `${y}-${m}-${d}`
      // Days since cycle epoch (a Sunday), so i % 7 == date.getDay()
      const daysSinceEpoch = Math.floor((date - cycleEpoch) / (24 * 60 * 60 * 1000))
      const cycleDay = ((daysSinceEpoch % cycleLength) + cycleLength) % cycleLength
      const dayData = cycleData[cycleDay]
      schedule[dateKey] = dayData?.parent_label || dayData || 'unknown'
    }

    // Layer APPROVED overrides on top of cycle schedule
    const approvedOverrides = custodyOverrides.value.filter(o => o.status === 'approved')
    for (const override of approvedOverrides) {
      const start = new Date(override.from_date + 'T00:00:00')
      const end = new Date(override.to_date + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const oy = d.getFullYear()
        const om = String(d.getMonth() + 1).padStart(2, '0')
        const od = String(d.getDate()).padStart(2, '0')
        schedule[`${oy}-${om}-${od}`] = override.override_parent
      }
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
    const type = upcomingEvent.type

    // For handoff events, show the type as the label
    let location = upcomingEvent.location_name || ''
    if (type === 'pickup' || type === 'dropoff') {
      location = type
    }

    return {
      time: eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      location,
      type
    }
  }

  // Helper: Get next handoff (pickup or dropoff) for a child
  function getNextHandoff(childId) {
    const now = new Date()
    const childEvents = getChildEvents(childId)

    const handoff = childEvents.find(event =>
      new Date(event.start_time) > now &&
      (event.type === 'pickup' || event.type === 'dropoff')
    )

    if (!handoff) return null

    const eventDate = new Date(handoff.start_time)
    return {
      id: handoff.id,
      type: handoff.type,
      time: eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      date: eventDate
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

  // Check if a date has a pending custody override
  function getPendingOverrideForDate(dateStr) {
    return pendingOverrides.value.find(o => dateStr >= o.from_date && dateStr <= o.to_date) || null
  }

  // Request a one-off custody change (creates pending override)
  async function requestCustodyOverride({ fromDate, toDate, overrideParent, reason }) {
    if (!user.value || !family.value) return

    try {
      const { error: insertError } = await supabase
        .from('custody_overrides')
        .insert({
          family_id: family.value.id,
          from_date: fromDate,
          to_date: toDate,
          override_parent: overrideParent,
          reason: reason || null,
          requested_by: user.value.id
        })

      if (insertError) throw insertError

      await loadFamilyData()
    } catch (err) {
      console.error('Error requesting custody override:', err)
      error.value = err.message
      throw err
    }
  }

  // Approve or reject a custody override
  async function respondToCustodyOverride(overrideId, action) {
    if (!user.value) return

    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected'

      const { error: updateError } = await supabase
        .from('custody_overrides')
        .update({
          status: newStatus,
          responded_by: user.value.id,
          responded_at: new Date().toISOString()
        })
        .eq('id', overrideId)

      if (updateError) throw updateError

      await loadFamilyData()
    } catch (err) {
      console.error('Error responding to custody override:', err)
      error.value = err.message
      throw err
    }
  }

  return {
    children,
    family,
    parentLabel,
    partnerId,
    partnerLabel,
    events,
    custodySchedule,
    custodyOverrides,
    pendingOverrides,
    loading,
    error,
    loadFamilyData,
    createEvent,
    confirmPickup,
    confirmDropoff,
    getExpectedParent,
    getPendingOverrideForDate,
    requestCustodyOverride,
    respondToCustodyOverride
  }
})
