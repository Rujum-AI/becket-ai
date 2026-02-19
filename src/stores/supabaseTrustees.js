import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useFamily } from '@/composables/useFamily'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'

export const useTrusteesStore = defineStore('supabaseTrustees', () => {
  const { family } = useFamily()
  const dashboardStore = useSupabaseDashboardStore()

  const schools = ref([])
  const activities = ref([])
  const people = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Helper: delete all UPCOMING events linked to a trustee (school/activity/person)
  // Past events are preserved for the record
  async function deleteUpcomingEventsFor(fkColumn, trusteeId) {
    const now = new Date().toISOString()
    const { data: upcoming } = await supabase
      .from('events')
      .select('id')
      .eq(fkColumn, trusteeId)
      .gte('start_time', now)

    if (upcoming && upcoming.length > 0) {
      const ids = upcoming.map(e => e.id)
      await supabase.from('event_children').delete().in('event_id', ids)
      await supabase.from('events').delete().in('id', ids)
    }
  }

  // Helper: generate events for this family after schedule changes
  async function regenerateEvents() {
    if (!family.value?.id) return
    const today = new Date().toISOString().split('T')[0]
    const threeMonths = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    try {
      await supabase.rpc('generate_trustee_events', {
        p_family_id: family.value.id,
        p_from_date: today,
        p_to_date: threeMonths
      })
      // Refresh dashboard events so calendar updates without hard refresh
      await dashboardStore.loadFamilyData()
    } catch (err) {
      console.error('Error generating trustee events:', err)
    }
  }

  // ========== FETCH OPERATIONS ==========

  async function fetchSchools() {
    if (!family.value?.id) return

    loading.value = true
    error.value = null

    try {
      // Fetch schools
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('trustees_schools')
        .select('*')
        .eq('family_id', family.value.id)
        .order('name')

      if (schoolsError) throw schoolsError

      // For each school, fetch associated children and schedule
      const enrichedSchools = await Promise.all(
        schoolsData.map(async (school) => {
          // Fetch children associations
          const { data: childrenData } = await supabase
            .from('trustee_children')
            .select('child_id')
            .eq('trustee_type', 'school')
            .eq('trustee_id', school.id)

          // Fetch schedule
          const { data: scheduleData } = await supabase
            .from('trustee_schedules')
            .select('*')
            .eq('trustee_type', 'school')
            .eq('trustee_id', school.id)
            .maybeSingle()

          return {
            id: school.id,
            name: school.name,
            address: school.address || '',
            contact: school.contact_phone || '',
            items: school.default_items || [],
            children: childrenData?.map(c => c.child_id) || [],
            schedule: scheduleData ? {
              days: scheduleData.days || [],
              repeatFreq: scheduleData.repeat_freq || 1,
              startDate: scheduleData.start_date || '',
              endDate: scheduleData.end_date || ''
            } : null
          }
        })
      )

      schools.value = enrichedSchools
    } catch (err) {
      error.value = err.message
      console.error('Error fetching schools:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchActivities() {
    if (!family.value?.id) return

    loading.value = true
    error.value = null

    try {
      // Fetch activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('trustees_activities')
        .select('*')
        .eq('family_id', family.value.id)
        .order('name')

      if (activitiesError) throw activitiesError

      // For each activity, fetch associated children and schedule
      const enrichedActivities = await Promise.all(
        activitiesData.map(async (activity) => {
          // Fetch children associations
          const { data: childrenData } = await supabase
            .from('trustee_children')
            .select('child_id')
            .eq('trustee_type', 'activity')
            .eq('trustee_id', activity.id)

          // Fetch schedule
          const { data: scheduleData } = await supabase
            .from('trustee_schedules')
            .select('*')
            .eq('trustee_type', 'activity')
            .eq('trustee_id', activity.id)
            .maybeSingle()

          return {
            id: activity.id,
            name: activity.name,
            address: activity.address || '',
            contact: activity.contact_phone || '',
            items: activity.default_items || [],
            children: childrenData?.map(c => c.child_id) || [],
            schedule: scheduleData ? {
              days: scheduleData.days || [],
              repeatFreq: scheduleData.repeat_freq || 1,
              startDate: scheduleData.start_date || '',
              endDate: scheduleData.end_date || ''
            } : null
          }
        })
      )

      activities.value = enrichedActivities
    } catch (err) {
      error.value = err.message
      console.error('Error fetching activities:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchPeople() {
    if (!family.value?.id) return

    loading.value = true
    error.value = null

    try {
      const { data, error: peopleError } = await supabase
        .from('trustees_people')
        .select('*')
        .eq('family_id', family.value.id)
        .order('name')

      if (peopleError) throw peopleError

      people.value = data.map(person => ({
        id: person.id,
        name: person.name,
        relationship: person.relationship || '',
        address: person.address || '',
        contact: person.contact_phone || ''
      }))
    } catch (err) {
      error.value = err.message
      console.error('Error fetching people:', err)
    } finally {
      loading.value = false
    }
  }

  async function loadAll() {
    await Promise.all([
      fetchSchools(),
      fetchActivities(),
      fetchPeople()
    ])
  }

  // ========== SCHOOLS CRUD ==========

  async function addSchool(school) {
    if (!family.value?.id) throw new Error('No family selected')

    try {
      // Insert school
      const { data: schoolData, error: schoolError } = await supabase
        .from('trustees_schools')
        .insert({
          family_id: family.value.id,
          name: school.name,
          address: school.address || null,
          contact_phone: school.contact || null,
          default_items: school.items || []
        })
        .select()
        .single()

      if (schoolError) throw schoolError

      // Insert children associations
      if (school.children?.length > 0) {
        const childrenInserts = school.children.map(childId => ({
          trustee_type: 'school',
          trustee_id: schoolData.id,
          child_id: childId
        }))

        const { error: childrenError } = await supabase
          .from('trustee_children')
          .insert(childrenInserts)

        if (childrenError) throw childrenError
      }

      // Insert schedule if provided
      if (school.schedule) {
        const { error: scheduleError } = await supabase
          .from('trustee_schedules')
          .insert({
            trustee_type: 'school',
            trustee_id: schoolData.id,
            child_id: school.children?.[0] || null, // For simplicity, use first child
            days: school.schedule.days,
            start_date: school.schedule.startDate || new Date().toISOString().split('T')[0],
            end_date: school.schedule.endDate || null,
            repeat_freq: school.schedule.repeatFreq || 1,
            generated_until: new Date().toISOString().split('T')[0]
          })

        if (scheduleError) throw scheduleError
      }

      await fetchSchools()
      await regenerateEvents()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function updateSchool(id, updates) {
    try {
      // Update school
      const updateData = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.address !== undefined) updateData.address = updates.address || null
      if (updates.contact !== undefined) updateData.contact_phone = updates.contact || null
      if (updates.items !== undefined) updateData.default_items = updates.items

      const { error: schoolError } = await supabase
        .from('trustees_schools')
        .update(updateData)
        .eq('id', id)

      if (schoolError) throw schoolError

      // Update children associations if provided
      if (updates.children !== undefined) {
        // Delete existing associations
        await supabase
          .from('trustee_children')
          .delete()
          .eq('trustee_type', 'school')
          .eq('trustee_id', id)

        // Insert new associations
        if (updates.children.length > 0) {
          const childrenInserts = updates.children.map(childId => ({
            trustee_type: 'school',
            trustee_id: id,
            child_id: childId
          }))

          const { error: childrenError } = await supabase
            .from('trustee_children')
            .insert(childrenInserts)

          if (childrenError) throw childrenError
        }
      }

      // Update schedule if provided
      if (updates.schedule !== undefined) {
        // Check if schedule exists
        const { data: existingSchedule } = await supabase
          .from('trustee_schedules')
          .select('id')
          .eq('trustee_type', 'school')
          .eq('trustee_id', id)
          .maybeSingle()

        const scheduleData = {
          days: updates.schedule.days,
          start_date: updates.schedule.startDate || new Date().toISOString().split('T')[0],
          end_date: updates.schedule.endDate || null,
          repeat_freq: updates.schedule.repeatFreq || 1
        }

        if (existingSchedule) {
          // Update existing schedule
          const { error: scheduleError } = await supabase
            .from('trustee_schedules')
            .update(scheduleData)
            .eq('id', existingSchedule.id)

          if (scheduleError) throw scheduleError
        } else {
          // Create new schedule
          const { error: scheduleError } = await supabase
            .from('trustee_schedules')
            .insert({
              trustee_type: 'school',
              trustee_id: id,
              child_id: updates.children?.[0] || null,
              ...scheduleData,
              generated_until: new Date().toISOString().split('T')[0]
            })

          if (scheduleError) throw scheduleError
        }
      }

      await fetchSchools()
      await regenerateEvents()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function deleteSchool(id) {
    // Optimistic removal
    schools.value = schools.value.filter(s => s.id !== id)

    try {
      // Delete upcoming calendar events linked to this school
      await deleteUpcomingEventsFor('school_id', id)

      await supabase.from('trustee_children').delete().eq('trustee_type', 'school').eq('trustee_id', id)
      await supabase.from('trustee_schedules').delete().eq('trustee_type', 'school').eq('trustee_id', id)

      const { error: schoolError } = await supabase.from('trustees_schools').delete().eq('id', id)
      if (schoolError) throw schoolError

      // Refresh dashboard to reflect removed events
      await dashboardStore.loadFamilyData()
    } catch (err) {
      error.value = err.message
      await fetchSchools() // Revert on error
    }
  }

  // ========== ACTIVITIES CRUD ==========

  async function addActivity(activity) {
    if (!family.value?.id) throw new Error('No family selected')

    try {
      // Insert activity
      const { data: activityData, error: activityError } = await supabase
        .from('trustees_activities')
        .insert({
          family_id: family.value.id,
          name: activity.name,
          address: activity.address || null,
          contact_phone: activity.contact || null,
          default_items: activity.items || []
        })
        .select()
        .single()

      if (activityError) throw activityError

      // Insert children associations
      if (activity.children?.length > 0) {
        const childrenInserts = activity.children.map(childId => ({
          trustee_type: 'activity',
          trustee_id: activityData.id,
          child_id: childId
        }))

        const { error: childrenError } = await supabase
          .from('trustee_children')
          .insert(childrenInserts)

        if (childrenError) throw childrenError
      }

      // Insert schedule if provided
      if (activity.schedule) {
        const { error: scheduleError } = await supabase
          .from('trustee_schedules')
          .insert({
            trustee_type: 'activity',
            trustee_id: activityData.id,
            child_id: activity.children?.[0] || null,
            days: activity.schedule.days,
            start_date: activity.schedule.startDate || new Date().toISOString().split('T')[0],
            end_date: activity.schedule.endDate || null,
            repeat_freq: activity.schedule.repeatFreq || 1,
            generated_until: new Date().toISOString().split('T')[0]
          })

        if (scheduleError) throw scheduleError
      }

      await fetchActivities()
      await regenerateEvents()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function updateActivity(id, updates) {
    try {
      // Update activity
      const updateData = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.address !== undefined) updateData.address = updates.address || null
      if (updates.contact !== undefined) updateData.contact_phone = updates.contact || null
      if (updates.items !== undefined) updateData.default_items = updates.items

      const { error: activityError } = await supabase
        .from('trustees_activities')
        .update(updateData)
        .eq('id', id)

      if (activityError) throw activityError

      // Update children associations if provided
      if (updates.children !== undefined) {
        // Delete existing associations
        await supabase
          .from('trustee_children')
          .delete()
          .eq('trustee_type', 'activity')
          .eq('trustee_id', id)

        // Insert new associations
        if (updates.children.length > 0) {
          const childrenInserts = updates.children.map(childId => ({
            trustee_type: 'activity',
            trustee_id: id,
            child_id: childId
          }))

          const { error: childrenError } = await supabase
            .from('trustee_children')
            .insert(childrenInserts)

          if (childrenError) throw childrenError
        }
      }

      // Update schedule if provided
      if (updates.schedule !== undefined) {
        // Check if schedule exists
        const { data: existingSchedule } = await supabase
          .from('trustee_schedules')
          .select('id')
          .eq('trustee_type', 'activity')
          .eq('trustee_id', id)
          .maybeSingle()

        const scheduleData = {
          days: updates.schedule.days,
          start_date: updates.schedule.startDate || new Date().toISOString().split('T')[0],
          end_date: updates.schedule.endDate || null,
          repeat_freq: updates.schedule.repeatFreq || 1
        }

        if (existingSchedule) {
          // Update existing schedule
          const { error: scheduleError } = await supabase
            .from('trustee_schedules')
            .update(scheduleData)
            .eq('id', existingSchedule.id)

          if (scheduleError) throw scheduleError
        } else {
          // Create new schedule
          const { error: scheduleError } = await supabase
            .from('trustee_schedules')
            .insert({
              trustee_type: 'activity',
              trustee_id: id,
              child_id: updates.children?.[0] || null,
              ...scheduleData,
              generated_until: new Date().toISOString().split('T')[0]
            })

          if (scheduleError) throw scheduleError
        }
      }

      await fetchActivities()
      await regenerateEvents()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function deleteActivity(id) {
    // Optimistic removal
    activities.value = activities.value.filter(a => a.id !== id)

    try {
      // Delete upcoming calendar events linked to this activity
      await deleteUpcomingEventsFor('activity_id', id)

      await supabase.from('trustee_children').delete().eq('trustee_type', 'activity').eq('trustee_id', id)
      await supabase.from('trustee_schedules').delete().eq('trustee_type', 'activity').eq('trustee_id', id)

      const { error: activityError } = await supabase.from('trustees_activities').delete().eq('id', id)
      if (activityError) throw activityError

      // Refresh dashboard to reflect removed events
      await dashboardStore.loadFamilyData()
    } catch (err) {
      error.value = err.message
      await fetchActivities() // Revert on error
    }
  }

  // ========== PEOPLE CRUD ==========

  async function addPerson(person) {
    if (!family.value?.id) throw new Error('No family selected')

    try {
      const { error: personError } = await supabase
        .from('trustees_people')
        .insert({
          family_id: family.value.id,
          name: person.name,
          relationship: person.relationship || null,
          contact_phone: person.contact || null,
          address: person.address || null
        })

      if (personError) throw personError

      await fetchPeople()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function updatePerson(id, updates) {
    try {
      const updateData = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.relationship !== undefined) updateData.relationship = updates.relationship || null
      if (updates.address !== undefined) updateData.address = updates.address || null
      if (updates.contact !== undefined) updateData.contact_phone = updates.contact || null

      const { error: personError } = await supabase
        .from('trustees_people')
        .update(updateData)
        .eq('id', id)

      if (personError) throw personError

      await fetchPeople()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  async function deletePerson(id) {
    // Optimistic removal
    people.value = people.value.filter(p => p.id !== id)

    try {
      // Delete upcoming calendar events linked to this person
      await deleteUpcomingEventsFor('person_id', id)

      const { error: personError } = await supabase.from('trustees_people').delete().eq('id', id)
      if (personError) throw personError

      // Refresh dashboard to reflect removed events
      await dashboardStore.loadFamilyData()
    } catch (err) {
      error.value = err.message
      await fetchPeople() // Revert on error
    }
  }

  return {
    schools,
    activities,
    people,
    loading,
    error,
    loadAll,
    fetchSchools,
    fetchActivities,
    fetchPeople,
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
