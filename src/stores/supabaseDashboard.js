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
  const labelToProfileId = ref({}) // { 'dad': uuid, 'mom': uuid } — resolved at load
  const events = ref([])
  const custodySchedule = ref({})
  const custodyOverrides = ref([])
  const pendingOverrides = ref([])
  const pendingInvite = ref(null) // { email, token } if co-parent not yet joined
  const defaultHandoffTime = ref('') // from custody_cycles.default_handoff_time (user must set)
  const loading = ref(false)
  const error = ref(null)
  let statusRefreshTimer = null

  // Helper: get local timezone offset string like "+02:00" or "-05:00"
  function getTzOffset() {
    const offset = new Date().getTimezoneOffset() // minutes, e.g. -120 for UTC+2
    const sign = offset <= 0 ? '+' : '-'
    const abs = Math.abs(offset)
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
  }

  // Load family and children from Supabase
  async function loadFamilyData() {
    if (!user.value) return

    loading.value = true
    error.value = null

    try {
      // Get user's family membership
      const { data: familyMember, error: memberError } = await supabase
        .from('family_members')
        .select('family_id, parent_label')
        .eq('profile_id', user.value.id)
        .single()

      if (memberError) throw memberError

      // Fetch family record separately (avoids PostgREST embedded join issues)
      const { data: familyRecord, error: familyError } = await supabase
        .from('families')
        .select('*')
        .eq('id', familyMember.family_id)
        .single()

      if (familyError) throw familyError

      family.value = familyRecord
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

      // Build label→profileId map for custody schedule resolution
      const ltpMap = {}
      if (familyMember.parent_label) ltpMap[familyMember.parent_label] = user.value.id
      if (partnerData?.parent_label && partnerData?.profile_id) {
        ltpMap[partnerData.parent_label] = partnerData.profile_id
      }
      labelToProfileId.value = ltpMap

      // If no co-parent yet, check for pending invite via RPC (bypasses RLS)
      if (!partnerId.value) {
        const { data: inviteData, error: inviteError } = await supabase
          .rpc('get_pending_invite', { p_family_id: familyMember.family_id })

        if (inviteError) {
          console.error('Pending invite RPC failed:', inviteError)
        }

        pendingInvite.value = inviteData || null
      } else {
        pendingInvite.value = null
      }

      // Get children (now includes current_status columns)
      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('*')
        .eq('family_id', familyMember.family_id)
        .order('date_of_birth', { ascending: true })

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
        .or('status.neq.cancelled,status.is.null')
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
        defaultHandoffTime.value = custodyData.default_handoff_time || ''
        buildCustodySchedule(custodyData)
      }

      // Build child data for UI
      children.value = childrenData.map(child => {
        const todaysEvents = getTodaysEvents(child.id)
        const dayProgress = getDayProgress()
        const nextEvent = getNextEvent(child.id)
        const nextHandoff = getNextHandoff(child.id)
        const myLabel = parentLabel.value || 'dad'

        // Effective status: DB status, or custody cycle fallback when unknown
        const { status, source: statusSource } = getEffectiveStatus(child)

        // Detect conflict between current status and expected (from events)
        const conflict = getStatusConflict(child.id, status, child.name, statusSource)

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
          statusSource: statusSource,
          conflict: conflict,
          _dbStatus: child.current_status || 'unknown',
          currentParentId: child.current_parent_id,
          nextEventTime: nextEvent?.time || '--:--',
          nextEventLoc: nextEvent?.location || '',
          nextAction: nextAction,
          nextHandoffTime: nextHandoff?.time || null,
          nextHandoffType: nextHandoff?.type || null,
          nextHandoffLoc: nextHandoff?.location || null,
          nextHandoffDate: nextHandoff?.date?.toISOString() || null,
          items: [], // TODO: fetch from items table
          todaysEvents: todaysEvents,
          dayProgress: dayProgress
        }
      })

      // Start periodic status/conflict refresh (events may start/end while app is open)
      startStatusRefresh()
    } catch (err) {
      console.error('Error loading family data:', err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // Build description with optional backpack items prefix
  function buildDescription(notes, backpackItems) {
    let desc = ''
    if (backpackItems && backpackItems.length > 0) {
      desc = `[BACKPACK:${backpackItems.join(',')}]\n`
    }
    if (notes) desc += notes
    return desc || null
  }

  // Parse backpack items from description string
  function parseBackpackItems(description) {
    if (!description) return { items: [], notes: '' }
    const match = description.match(/^\[BACKPACK:(.*?)\]\n?/)
    if (!match) return { items: [], notes: description }
    const items = match[1].split(',').filter(Boolean)
    const notes = description.slice(match[0].length)
    return { items, notes }
  }

  // Relative time formatting for brief timeline
  function formatRelativeTime(date) {
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (diff < 0) {
      const absMins = Math.floor(Math.abs(diff) / 60000)
      const absHours = Math.floor(Math.abs(diff) / 3600000)
      if (absMins < 60) return `in ${absMins}m`
      if (absHours < 24) return `in ${absHours}h`
      return date.toLocaleDateString()
    }
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  // Generate brief/recap for a child
  async function generateBrief(childId, mode = 'since-last-seen') {
    if (!user.value || !family.value) return { sinceDate: null, hadHandoff: false, items: [] }

    let sinceTimestamp
    let hadHandoff = true

    if (mode === 'today') {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      sinceTimestamp = now.toISOString()
    } else {
      // Find last handoff where this parent dropped off the child
      const { data: lastHandoff, error: handoffError } = await supabase
        .from('handoffs')
        .select('actual_at, items_sent, notes')
        .eq('from_parent_id', user.value.id)
        .eq('child_id', childId)
        .order('actual_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (handoffError) {
        console.error('Error fetching last handoff:', handoffError)
        throw handoffError
      }

      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

      if (lastHandoff?.actual_at) {
        // Cap at 5 days max even if handoff was longer ago
        sinceTimestamp = lastHandoff.actual_at < fiveDaysAgo ? fiveDaysAgo : lastHandoff.actual_at
      } else {
        // No handoff found — fallback to last 5 days
        hadHandoff = false
        sinceTimestamp = fiveDaysAgo
      }
    }

    // Query events for this child in the time window (past only, no future)
    const nowTimestamp = new Date().toISOString()
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select(`
        id, title, type, start_time, end_time,
        location_name, description, status,
        event_children!inner (child_id)
      `)
      .eq('family_id', family.value.id)
      .eq('event_children.child_id', childId)
      .gte('start_time', sinceTimestamp)
      .lte('start_time', nowTimestamp)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true })

    if (eventsError) {
      console.error('Error fetching brief events:', eventsError)
      throw eventsError
    }

    const items = (eventsData || []).map(event => {
      const eventDate = new Date(event.start_time)
      const parsed = parseBackpackItems(event.description)
      return {
        id: event.id,
        time: formatRelativeTime(eventDate),
        timestamp: eventDate.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: false
        }),
        type: event.type,
        title: event.title || event.type,
        description: parsed.notes || '',
        location: event.location_name || '',
        startTime: event.start_time
      }
    })

    // Also fetch snapshots for this child in the same time range
    const { data: snapshotsData } = await supabase
      .from('snapshots')
      .select(`
        id, file_url, timestamp, caption, uploaded_by,
        snapshot_children!inner (child_id)
      `)
      .eq('family_id', family.value.id)
      .eq('snapshot_children.child_id', childId)
      .gte('timestamp', sinceTimestamp)
      .lte('timestamp', nowTimestamp)
      .order('timestamp', { ascending: true })

    // Merge snapshots into timeline
    if (snapshotsData?.length) {
      for (const snap of snapshotsData) {
        const snapDate = new Date(snap.timestamp)
        items.push({
          id: snap.id,
          time: formatRelativeTime(snapDate),
          timestamp: snapDate.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false
          }),
          type: 'snapshot',
          title: snap.caption || 'Photo',
          description: '',
          photoUrl: snap.file_url,
          startTime: snap.timestamp
        })
      }
      // Re-sort by time
      items.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    }

    return { sinceDate: sinceTimestamp, hadHandoff, items }
  }

  // Create a new event and link it to children
  async function createEvent({
    title, date, time, endTime, location, notes, type, childIds,
    schoolId = null, activityId = null, personId = null,
    rrule = null, backpackItems = []
  }) {
    if (!user.value || !family.value) return

    try {
      const tz = getTzOffset()
      const startTime = time ? `${date}T${time}:00${tz}` : `${date}T00:00:00${tz}`
      const allDay = !time

      // Auto-detect co-parent custody day for pending approval
      let eventStatus = 'scheduled'
      if (partnerId.value) {
        const custodyParent = getExpectedParent(date)
        const custodyLabel = resolveCustodyLabel(custodyParent)
        if (custodyLabel && custodyLabel !== parentLabel.value && custodyLabel !== 'split') {
          eventStatus = 'pending_approval'
        }
      }

      const insertData = {
        family_id: family.value.id,
        type: type || 'manual',
        title,
        description: buildDescription(notes, backpackItems),
        start_time: startTime,
        end_time: endTime ? `${date}T${endTime}:00${tz}` : null,
        all_day: allDay,
        location_name: location || null,
        school_id: schoolId,
        activity_id: activityId,
        person_id: personId,
        recurrence_rule: rrule,
        status: eventStatus,
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

  // Update an existing event
  async function updateEvent(eventId, {
    title, date, time, endTime, location, notes, type, childIds,
    schoolId = null, activityId = null, personId = null,
    rrule = null, backpackItems = []
  }) {
    if (!user.value || !family.value) return

    try {
      const tz = getTzOffset()
      const startTime = time ? `${date}T${time}:00${tz}` : `${date}T00:00:00${tz}`

      // Check co-parent custody for pending approval
      let eventStatus = 'scheduled'
      if (partnerId.value) {
        const custodyParent = getExpectedParent(date)
        const custodyLabel = resolveCustodyLabel(custodyParent)
        if (custodyLabel && custodyLabel !== parentLabel.value && custodyLabel !== 'split') {
          eventStatus = 'pending_approval'
        }
      }

      const updateData = {
        title,
        type: type || 'manual',
        description: buildDescription(notes, backpackItems),
        start_time: startTime,
        end_time: endTime ? `${date}T${endTime}:00${tz}` : null,
        all_day: !time,
        location_name: location || null,
        school_id: schoolId,
        activity_id: activityId,
        person_id: personId,
        recurrence_rule: rrule,
        status: eventStatus
      }

      const { error: updateError } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', eventId)

      if (updateError) throw updateError

      // Replace event_children
      if (childIds) {
        await supabase.from('event_children').delete().eq('event_id', eventId)
        if (childIds.length > 0) {
          const { error: childError } = await supabase
            .from('event_children')
            .insert(childIds.map(childId => ({
              event_id: eventId,
              child_id: childId
            })))
          if (childError) throw childError
        }
      }

      await loadFamilyData()
    } catch (err) {
      console.error('Error updating event:', err)
      error.value = err.message
      throw err
    }
  }

  // Soft-delete an event (set status to cancelled)
  async function deleteEvent(eventId) {
    if (!user.value) return

    try {
      await supabase.from('event_children').delete().eq('event_id', eventId)
      const { error: delError } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (delError) throw delError

      await loadFamilyData()
    } catch (err) {
      console.error('Error deleting event:', err)
      error.value = err.message
      throw err
    }
  }

  // Delete all upcoming events with the same title and daily time pattern
  async function deleteAllSimilarEvents(event) {
    if (!user.value || !family.value) return

    try {
      const now = new Date().toISOString()

      // Fetch all upcoming events in this family with the same title
      const { data: upcoming } = await supabase
        .from('events')
        .select('id, start_time, end_time')
        .eq('family_id', family.value.id)
        .eq('title', event.title)
        .gte('start_time', now)

      if (!upcoming || upcoming.length === 0) { await loadFamilyData(); return }

      // Extract time-of-day from the source event for matching
      const srcStart = new Date(event.start_time)
      const srcStartHM = `${srcStart.getHours()}:${srcStart.getMinutes()}`
      const srcEnd = event.end_time ? new Date(event.end_time) : null
      const srcEndHM = srcEnd ? `${srcEnd.getHours()}:${srcEnd.getMinutes()}` : null

      // Filter to events with matching time-of-day
      const matchIds = upcoming.filter(e => {
        const s = new Date(e.start_time)
        if (`${s.getHours()}:${s.getMinutes()}` !== srcStartHM) return false
        if (srcEndHM) {
          const en = e.end_time ? new Date(e.end_time) : null
          if (!en || `${en.getHours()}:${en.getMinutes()}` !== srcEndHM) return false
        }
        return true
      }).map(e => e.id)

      if (matchIds.length > 0) {
        await supabase.from('event_children').delete().in('event_id', matchIds)
        await supabase.from('events').delete().in('id', matchIds)
      }

      await loadFamilyData()
    } catch (err) {
      console.error('Error deleting similar events:', err)
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
    const label = resolveCustodyLabel(expected)
    return label === parentLabel.value || label === 'split'
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
  async function confirmDropoff(childId, location, items, snapshotId = null) {
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
      const handoffData = {
        family_id: family.value.id,
        child_id: childId,
        from_parent_id: user.value.id,
        to_parent_id: toParent,
        scheduled_at: new Date().toISOString(),
        actual_at: new Date().toISOString(),
        items_sent: (items || []).map(item => ({ name: item, flagged_missing: false })),
        notes: `Dropped off at ${location}`
      }
      if (snapshotId) handoffData.snapshot_id = snapshotId

      const { error: handoffError } = await supabase
        .from('handoffs')
        .insert(handoffData)

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

  // Resolve a schedule value (profile_id or raw label) back to 'dad'/'mom'/'split'
  function resolveCustodyLabel(val) {
    if (!val) return null
    if (val === 'dad' || val === 'mom' || val === 'split') return val
    if (val === user.value?.id) return parentLabel.value || 'dad'
    if (val === partnerId.value) return partnerLabel.value || 'mom'
    return val
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
      const label = dayData?.parent_label
      // Resolve label → profile_id; fall back to raw label if no mapping
      if (label === 'split') {
        schedule[dateKey] = 'split'
      } else {
        schedule[dateKey] = labelToProfileId.value[label] || label || null
      }
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
        // Resolve override label → profile_id too
        schedule[`${oy}-${om}-${od}`] = labelToProfileId.value[override.override_parent] || override.override_parent
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

  // Effective status: use DB status if set, otherwise fall back to custody cycle
  // IMPORTANT: On transition days, do NOT auto-flip — keep yesterday's parent
  // until handoff is explicitly confirmed (pickup/dropoff button)
  function getEffectiveStatus(child) {
    const dbStatus = child.current_status || 'unknown'

    if (dbStatus !== 'unknown') {
      return { status: dbStatus, source: 'explicit' }
    }

    // Fall back to custody cycle for today
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const expectedParent = getExpectedParent(todayStr) // profile_id or 'split'

    if (!expectedParent || expectedParent === 'unknown') {
      return { status: 'unknown', source: 'none' }
    }

    // Check if today is a transition day (custody parent changed from yesterday)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    const yesterdayParent = getExpectedParent(yStr)

    const isTransitionDay = yesterdayParent && expectedParent !== yesterdayParent && yesterdayParent !== 'split'

    if (isTransitionDay) {
      // DON'T auto-flip! Keep yesterday's parent until handoff is confirmed.
      const yLabel = resolveCustodyLabel(yesterdayParent)
      if (yLabel) {
        return { status: `with_${yLabel}`, source: 'custody_cycle_pending' }
      }
    }

    // Not a transition day — safe to use today's schedule
    const todayLabel = resolveCustodyLabel(expectedParent)
    if (todayLabel === 'split') {
      return { status: `with_${parentLabel.value}`, source: 'custody_cycle' }
    }
    if (todayLabel) {
      return { status: `with_${todayLabel}`, source: 'custody_cycle' }
    }

    return { status: 'unknown', source: 'none' }
  }

  // Detect conflict between current status and what events expect
  function getStatusConflict(childId, currentStatus, childName, statusSource) {
    const now = new Date()

    // HANDOFF PENDING: transition day, no explicit confirmation
    if (statusSource === 'custody_cycle_pending') {
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const expectedLabel = resolveCustodyLabel(getExpectedParent(todayStr))
      const isMyDay = expectedLabel === parentLabel.value || expectedLabel === 'split'
      return {
        type: 'handoff_pending',
        childName,
        expectedParent: expectedLabel,
        isMyPickup: isMyDay // true = I should pick up, false = I should drop off
      }
    }

    const childEvents = getChildEvents(childId)

    // Find active event right now (school/activity)
    const activeEvent = childEvents.find(event => {
      if (event.status === 'cancelled') return false
      if (event.type !== 'school' && event.type !== 'activity') return false
      const start = new Date(event.start_time)
      const end = event.end_time ? new Date(event.end_time) : null
      if (!end) return false
      return start <= now && now <= end
    })

    if (activeEvent) {
      const isWithParent = currentStatus.startsWith('with_')
      if (isWithParent) {
        const minutesSinceStart = (now - new Date(activeEvent.start_time)) / 60000
        return {
          type: minutesSinceStart >= 15 ? 'dropoff_overdue' : 'dropoff_needed',
          childName,
          eventTitle: activeEvent.title || activeEvent.type,
          eventStart: activeEvent.start_time,
          eventType: activeEvent.type
        }
      }
      return null // Status matches expectation (at_school/at_activity)
    }

    // Find upcoming event starting within 30 minutes
    const soon = new Date(now.getTime() + 30 * 60 * 1000)
    const upcomingEvent = childEvents.find(event => {
      if (event.status === 'cancelled') return false
      if (event.type !== 'school' && event.type !== 'activity') return false
      const start = new Date(event.start_time)
      return start > now && start <= soon
    })

    if (upcomingEvent && currentStatus.startsWith('with_')) {
      return {
        type: 'dropoff_needed',
        childName,
        eventTitle: upcomingEvent.title || upcomingEvent.type,
        eventStart: upcomingEvent.start_time,
        eventType: upcomingEvent.type
      }
    }

    // Check if child is at_school/at_activity but no active event (event ended)
    if ((currentStatus === 'at_school' || currentStatus === 'at_activity') && !activeEvent) {
      // Find the most recent ended event today for this child
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const recentEndedEvent = [...childEvents].reverse().find(event => {
        if (event.status === 'cancelled') return false
        if (event.type !== 'school' && event.type !== 'activity') return false
        const end = event.end_time ? new Date(event.end_time) : null
        if (!end) return false
        return end < now && end >= today
      })

      if (recentEndedEvent) {
        return {
          type: 'pickup_needed',
          childName,
          eventTitle: recentEndedEvent.title || recentEndedEvent.type,
          eventStart: recentEndedEvent.end_time,
          eventType: recentEndedEvent.type
        }
      }
    }

    return null
  }

  // Refresh timer: re-evaluate statuses and conflicts every 60s
  function startStatusRefresh() {
    stopStatusRefresh()
    statusRefreshTimer = setInterval(() => {
      if (!children.value.length) return
      const myLabel = parentLabel.value || 'dad'

      children.value = children.value.map(child => {
        const { status, source: statusSource } = getEffectiveStatus({
          current_status: child._dbStatus || 'unknown'
        })
        const conflict = getStatusConflict(child.id, status, child.name, statusSource)
        const childIsWithMe = status === `with_${myLabel}`

        return {
          ...child,
          status,
          statusSource,
          conflict,
          nextAction: childIsWithMe ? 'drop' : 'pick'
        }
      })
    }, 60000)
  }

  function stopStatusRefresh() {
    if (statusRefreshTimer) {
      clearInterval(statusRefreshTimer)
      statusRefreshTimer = null
    }
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

  // Helper: Get next interaction for a child
  // Priority: 1) Non-school/non-other event on my custody day → "take to event"
  //           2) Custody transition → pickup/dropoff (with school time or default)
  function getNextHandoff(childId) {
    const now = new Date()
    const myId = user.value?.id // profile UUID
    const myLabel = parentLabel.value // fallback for unresolved labels
    if (!myId) return null

    // Check if a schedule value matches the current user (handles both profile_id and raw label)
    function isMe(val) { return val === myId || val === myLabel }

    // Helper to format date as YYYY-MM-DD in local timezone
    function fmtDate(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const childEvents = getChildEvents(childId)

    // Scan up to 14 days ahead
    for (let i = 0; i <= 14; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() + i)
      const dateStr = fmtDate(date)

      const dayParent = custodySchedule.value[dateStr]
      if (!dayParent) continue

      // --- Check 1: Event on MY custody day → "take to event" (school included) ---
      if (isMe(dayParent) || dayParent === 'split') {
        // Find earliest upcoming event on this day (skip 'other' type only)
        const dayEvent = childEvents
          .filter(e => {
            if (e.type === 'other') return false
            if (!e.start_time) return false
            const eStart = new Date(e.start_time)
            if (fmtDate(eStart) !== dateStr) return false
            // If today, skip events that already started
            if (i === 0 && now >= eStart) return false
            // Ensure event ends within custody range (if end_time exists)
            if (e.end_time) {
              const eEnd = new Date(e.end_time)
              const endParent = custodySchedule.value[fmtDate(eEnd)]
              if (endParent && !isMe(endParent) && endParent !== 'split') return false
            }
            return true
          })
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0]

        if (dayEvent) {
          const eStart = new Date(dayEvent.start_time)
          const eventTime = `${String(eStart.getHours()).padStart(2, '0')}:${String(eStart.getMinutes()).padStart(2, '0')}`
          return {
            type: 'takeToEvent',
            time: eventTime,
            location: dayEvent.title || dayEvent.type,
            date: date
          }
        }
      }

      // --- Check 2: Custody transition → pickup/dropoff ---
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDateStr = fmtDate(nextDay)
      const tomorrowParent = custodySchedule.value[nextDateStr]

      if (!tomorrowParent) continue
      if (dayParent === tomorrowParent) continue

      // Transition found: custody changes from dayParent → tomorrowParent
      const schoolEvent = childEvents.find(e => {
        if (e.type !== 'school') return false
        const eDate = new Date(e.start_time)
        return fmtDate(eDate) === dateStr
      })

      let handoffTime
      let location = null
      let handoffDate = date // default: transition day itself

      if (schoolEvent && schoolEvent.end_time) {
        // School pickup: happens on the transition day at school end time
        const endDate = new Date(schoolEvent.end_time)
        handoffTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
        location = schoolEvent.title || 'School'
      } else {
        // Default handoff: happens on the FIRST day of the new custody period
        handoffTime = defaultHandoffTime.value || null
        handoffDate = nextDay // handoff is tomorrow morning, not today
      }

      // No time available (no school event and user hasn't set default) — skip
      if (!handoffTime) continue

      // If handoff date is today and time already passed, skip
      const handoffDateStr = fmtDate(handoffDate)
      const todayStr = fmtDate(now)
      if (handoffDateStr === todayStr) {
        const [hh, mm] = handoffTime.split(':').map(Number)
        const handoffMoment = new Date(handoffDate)
        handoffMoment.setHours(hh, mm, 0, 0)
        if (now > handoffMoment) continue
      }

      // Type depends on custody direction:
      //   tomorrowParent is me → I'm picking up (child comes to me)
      //   tomorrowParent is partner → I'm dropping off (child goes to them)
      const type = isMe(tomorrowParent) ? 'pickup' : 'dropoff'

      return { type, time: handoffTime, location, date: handoffDate }
    }

    return null
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
    pendingInvite,
    events,
    custodySchedule,
    custodyOverrides,
    pendingOverrides,
    loading,
    error,
    userId: computed(() => user.value?.id || null),
    labelToProfileId,
    loadFamilyData,
    createEvent,
    updateEvent,
    deleteEvent,
    deleteAllSimilarEvents,
    parseBackpackItems,
    confirmPickup,
    confirmDropoff,
    getExpectedParent,
    resolveCustodyLabel,
    getPendingOverrideForDate,
    requestCustodyOverride,
    respondToCustodyOverride,
    generateBrief,
    stopStatusRefresh
  }
})
