import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'

export const useSnapshotsStore = defineStore('supabaseSnapshots', () => {
  const { user } = useAuth()
  const { family } = useFamily()

  const loading = ref(false)
  const error = ref(null)

  /**
   * Auto-detect the most relevant active event for given children at a timestamp.
   * Checks events where start_time <= now <= end_time (or within 30 min window).
   * @param {string[]} childIds
   * @param {string} timestamp - ISO string
   * @returns {Object|null} { eventId, eventType }
   */
  async function autoDetectEvent(childIds, timestamp) {
    if (!family.value || !childIds.length) return null

    const ts = new Date(timestamp)
    const windowStart = new Date(ts.getTime() - 30 * 60000).toISOString()
    const windowEnd = new Date(ts.getTime() + 30 * 60000).toISOString()

    const { data, error: err } = await supabase
      .from('events')
      .select(`
        id, type, title,
        event_children!inner (child_id)
      `)
      .eq('family_id', family.value.id)
      .eq('event_children.child_id', childIds[0])
      .lte('start_time', windowEnd)
      .gte('start_time', windowStart)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (err || !data) return null
    return { eventId: data.id, eventType: data.type }
  }

  /**
   * Upload a photo to Supabase Storage + create snapshots row + tag children.
   * Auto-detects event if not provided.
   * @param {Blob} blob - Compressed image blob
   * @param {Object} options - { childIds[], eventId?, caption?, category? }
   * @returns {Object} snapshot record
   */
  async function uploadSnapshot(blob, { childIds = [], eventId = null, caption = null, category = 'photo' } = {}) {
    if (!user.value || !family.value) throw new Error('Not authenticated')

    loading.value = true
    error.value = null

    try {
      const snapshotId = crypto.randomUUID()
      const now = new Date().toISOString()
      const ext = category === 'doc' ? 'pdf' : 'jpg'
      const contentType = category === 'doc' ? 'application/pdf' : 'image/jpeg'
      const fileType = category === 'doc' ? 'document' : 'image'
      const filePath = `${family.value.id}/${snapshotId}.${ext}`

      // Auto-detect event if not provided (photos only)
      if (!eventId && category === 'photo' && childIds.length) {
        const detected = await autoDetectEvent(childIds, now)
        if (detected) eventId = detected.eventId
      }

      // 1. Upload to storage bucket
      const { error: uploadError } = await supabase.storage
        .from('snapshots')
        .upload(filePath, blob, {
          contentType,
          upsert: false
        })

      if (uploadError) throw uploadError

      // 2. Insert snapshots table row
      const { data: snapshot, error: insertError } = await supabase
        .from('snapshots')
        .insert({
          id: snapshotId,
          family_id: family.value.id,
          file_url: filePath,
          file_type: fileType,
          timestamp: now,
          uploaded_by: user.value.id,
          event_id: eventId,
          caption,
          category
        })
        .select()
        .single()

      if (insertError) throw insertError

      // 3. Tag children
      if (childIds.length > 0) {
        const { error: tagError } = await supabase
          .from('snapshot_children')
          .insert(childIds.map(childId => ({
            snapshot_id: snapshotId,
            child_id: childId
          })))

        if (tagError) throw tagError
      }

      return snapshot
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get signed URL for a snapshot's file.
   * @param {string} filePath - Storage path
   * @returns {string|null} Signed URL valid for 1 hour
   */
  async function getSignedUrl(filePath) {
    if (!filePath) return null

    const { data, error: urlError } = await supabase.storage
      .from('snapshots')
      .createSignedUrl(filePath, 3600)

    if (urlError) {
      console.error('Error creating signed URL:', urlError)
      return null
    }
    return data.signedUrl
  }

  /**
   * Get the last handoff snapshot for a child.
   * @param {string} childId
   * @returns {Object|null} { snapshot, signedUrl }
   */
  async function getLastHandoffSnapshot(childId) {
    if (!user.value) return null

    const { data: handoff, error: handoffError } = await supabase
      .from('handoffs')
      .select(`
        actual_at,
        snapshot_id,
        snapshots (id, file_url, timestamp, caption)
      `)
      .eq('child_id', childId)
      .not('snapshot_id', 'is', null)
      .order('actual_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (handoffError || !handoff?.snapshots) return null

    const signedUrl = await getSignedUrl(handoff.snapshots.file_url)
    return {
      ...handoff.snapshots,
      signedUrl,
      handoffAt: handoff.actual_at
    }
  }

  /**
   * Get all photo snapshots for a child within a date range (for brief).
   * @param {string} childId
   * @param {string} since - ISO timestamp
   * @returns {Array} snapshots with signed URLs
   */
  async function getSnapshotsForChild(childId, since) {
    if (!family.value) return []

    const { data, error: fetchError } = await supabase
      .from('snapshots')
      .select(`
        id, file_url, timestamp, caption, uploaded_by,
        snapshot_children!inner (child_id)
      `)
      .eq('family_id', family.value.id)
      .eq('snapshot_children.child_id', childId)
      .eq('category', 'photo')
      .gte('timestamp', since)
      .order('timestamp', { ascending: true })

    if (fetchError) {
      console.error('Error fetching snapshots:', fetchError)
      return []
    }

    const withUrls = await Promise.all(
      (data || []).map(async (snap) => ({
        ...snap,
        signedUrl: await getSignedUrl(snap.file_url)
      }))
    )

    return withUrls
  }

  /**
   * Get all documents for a child.
   * @param {string} childId
   * @returns {Array} documents with signed URLs
   */
  async function getDocumentsForChild(childId) {
    if (!family.value) return []

    const { data, error: fetchError } = await supabase
      .from('snapshots')
      .select(`
        id, file_url, timestamp, caption, uploaded_by,
        snapshot_children!inner (child_id)
      `)
      .eq('family_id', family.value.id)
      .eq('snapshot_children.child_id', childId)
      .eq('category', 'doc')
      .order('timestamp', { ascending: false })

    if (fetchError) {
      console.error('Error fetching documents:', fetchError)
      return []
    }

    const withUrls = await Promise.all(
      (data || []).map(async (doc) => ({
        ...doc,
        signedUrl: await getSignedUrl(doc.file_url)
      }))
    )

    return withUrls
  }

  /**
   * Delete a snapshot (storage file + DB row).
   * @param {string} snapshotId
   * @param {string} filePath
   */
  async function deleteSnapshot(snapshotId, filePath) {
    if (!user.value) throw new Error('Not authenticated')

    const { error: storageError } = await supabase.storage
      .from('snapshots')
      .remove([filePath])

    if (storageError) console.error('Storage delete error:', storageError)

    const { error: dbError } = await supabase
      .from('snapshots')
      .delete()
      .eq('id', snapshotId)

    if (dbError) throw dbError
  }

  return {
    loading,
    error,
    uploadSnapshot,
    getSignedUrl,
    getLastHandoffSnapshot,
    getSnapshotsForChild,
    getDocumentsForChild,
    deleteSnapshot
  }
})
