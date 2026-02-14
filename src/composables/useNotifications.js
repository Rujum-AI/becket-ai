import { supabase } from '@/lib/supabase'

/**
 * Helper composable for creating notifications
 * Can be used by any store to notify users of events
 */
export function useNotifications() {

  /**
   * Create a notification for a user
   * @param {Object} notification - Notification data
   * @param {string} notification.recipient_id - User to notify
   * @param {string} notification.family_id - Family context
   * @param {string} notification.type - Notification type (pickup_confirmed, expense_added, etc.)
   * @param {string} notification.category - Category (handoff, expense, task, ask, approval, event)
   * @param {string} notification.title - Title
   * @param {string} notification.message - Message body
   * @param {string} [notification.priority] - Priority (low, normal, high, urgent) - defaults to 'normal'
   * @param {string} [notification.related_entity_type] - Entity type (event, expense, task, understanding, handoff)
   * @param {string} [notification.related_entity_id] - Entity ID
   * @param {boolean} [notification.requires_action] - Whether notification requires user action
   */
  async function createNotification(notification) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          recipient_id: notification.recipient_id,
          family_id: notification.family_id,
          type: notification.type,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          priority: notification.priority || 'normal',
          related_entity_type: notification.related_entity_type || null,
          related_entity_id: notification.related_entity_id || null,
          requires_action: notification.requires_action || false,
          read: false
        })
        .select()
        .single()

      if (error) throw error

      console.log(`📬 Created notification: ${notification.type}`)
      return data
    } catch (err) {
      console.error('Error creating notification:', err)
      // Don't throw - notifications are non-critical, shouldn't break main flow
      return null
    }
  }

  /**
   * Get the partner's ID for the current user in the family
   */
  async function getPartnerIdInFamily(familyId, currentUserId) {
    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('profile_id')
        .eq('family_id', familyId)
        .neq('profile_id', currentUserId)
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data?.profile_id || null
    } catch (err) {
      console.error('Error getting partner ID:', err)
      return null
    }
  }

  /**
   * Notify partner about a pickup confirmation
   * In solo mode, creates activity log for self
   */
  async function notifyPickup(familyId, currentUserId, childName) {
    const partnerId = await getPartnerIdInFamily(familyId, currentUserId)
    const recipientId = partnerId || currentUserId // Solo mode: notify self

    return createNotification({
      recipient_id: recipientId,
      family_id: familyId,
      type: 'pickup_confirmed',
      category: 'handoff',
      title: 'Pickup Confirmed',
      message: partnerId ? `${childName} was picked up` : `You picked up ${childName}`,
      priority: 'normal'
    })
  }

  /**
   * Notify partner about a dropoff confirmation
   * In solo mode, creates activity log for self
   */
  async function notifyDropoff(familyId, currentUserId, childName, location) {
    const partnerId = await getPartnerIdInFamily(familyId, currentUserId)
    const recipientId = partnerId || currentUserId

    return createNotification({
      recipient_id: recipientId,
      family_id: familyId,
      type: 'dropoff_confirmed',
      category: 'handoff',
      title: 'Dropoff Completed',
      message: partnerId ? `${childName} was dropped off at ${location}` : `You dropped off ${childName} at ${location}`,
      priority: 'normal'
    })
  }

  /**
   * Notify partner about a new expense
   * In solo mode, creates activity log for self
   */
  async function notifyExpenseAdded(familyId, currentUserId, expenseTitle, amount, currency = '₪') {
    const partnerId = await getPartnerIdInFamily(familyId, currentUserId)
    const recipientId = partnerId || currentUserId

    return createNotification({
      recipient_id: recipientId,
      family_id: familyId,
      type: 'expense_added',
      category: 'expense',
      title: partnerId ? 'New Expense Added' : 'Expense Recorded',
      message: `${expenseTitle} - ${amount} ${currency}`,
      priority: 'normal'
    })
  }

  /**
   * Notify partner about a pending expense that needs approval
   */
  async function notifyExpensePending(familyId, currentUserId, expenseTitle, amount, reason, currency = '₪') {
    const partnerId = await getPartnerIdInFamily(familyId, currentUserId)
    if (!partnerId) return

    return createNotification({
      recipient_id: partnerId,
      family_id: familyId,
      type: 'expense_pending',
      category: 'approval',
      title: 'Expense Needs Approval',
      message: `${expenseTitle} - ${amount} ${currency} (${reason})`,
      priority: 'high',
      requires_action: true
    })
  }

  /**
   * Notify user about a new task assigned to them
   */
  async function notifyTaskAssigned(userId, familyId, taskName, assignerName) {
    return createNotification({
      recipient_id: userId,
      family_id: familyId,
      type: 'task_assigned',
      category: 'task',
      title: 'New Task Assigned',
      message: `${taskName} (assigned by ${assignerName})`,
      priority: 'normal'
    })
  }

  /**
   * Notify partner about a new ask
   * In solo mode, creates activity log for self
   */
  async function notifyAskReceived(familyId, currentUserId, askTitle) {
    const partnerId = await getPartnerIdInFamily(familyId, currentUserId)
    const recipientId = partnerId || currentUserId

    return createNotification({
      recipient_id: recipientId,
      family_id: familyId,
      type: 'ask_received',
      category: 'ask',
      title: partnerId ? 'New Ask Received' : 'Ask Created',
      message: askTitle,
      priority: 'normal',
      requires_action: !!partnerId // Only requires action if there's a partner
    })
  }

  /**
   * Notify partner about a new understanding proposal
   * In solo mode, creates activity log for self
   */
  async function notifyUnderstandingProposed(familyId, currentUserId, subject) {
    const partnerId = await getPartnerIdInFamily(familyId, currentUserId)
    const recipientId = partnerId || currentUserId

    return createNotification({
      recipient_id: recipientId,
      family_id: familyId,
      type: 'understanding_proposed',
      category: 'approval',
      title: partnerId ? 'Pending Approval' : 'Understanding Created',
      message: partnerId ? `New understanding proposal: ${subject}` : `Created: ${subject}`,
      priority: partnerId ? 'high' : 'normal',
      requires_action: !!partnerId
    })
  }

  /**
   * Notify proposer that their understanding was accepted
   */
  async function notifyUnderstandingAccepted(proposerId, familyId, subject) {
    return createNotification({
      recipient_id: proposerId,
      family_id: familyId,
      type: 'understanding_accepted',
      category: 'approval',
      title: 'Understanding Accepted',
      message: `"${subject}" was approved`,
      priority: 'normal'
    })
  }

  /**
   * Notify proposer that their understanding was rejected
   */
  async function notifyUnderstandingRejected(proposerId, familyId, subject) {
    return createNotification({
      recipient_id: proposerId,
      family_id: familyId,
      type: 'understanding_rejected',
      category: 'approval',
      title: 'Understanding Rejected',
      message: `"${subject}" was not approved`,
      priority: 'normal'
    })
  }

  return {
    createNotification,
    getPartnerIdInFamily,
    notifyPickup,
    notifyDropoff,
    notifyExpenseAdded,
    notifyExpensePending,
    notifyTaskAssigned,
    notifyAskReceived,
    notifyUnderstandingProposed,
    notifyUnderstandingAccepted,
    notifyUnderstandingRejected
  }
}
