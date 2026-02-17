/**
 * Becket AI — Centralized Modal Header Color System
 *
 * COLOR LOGIC:
 * - Section modals → section gradient (Family=teal, Management=blue, Finance=green, Understandings=amber, Trustees=orange)
 * - Type-specific modals → type color (event types, management item types)
 * - Handoff modals → semantic color (pickup=green/arriving, dropoff=orange/departing)
 */

// ─── Section gradients (modal headers for generic section modals) ────────────

export const SECTION_COLORS = {
  family:         'linear-gradient(135deg, #14B8A6 0%, #0d9488 100%)',
  management:     'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
  finance:        'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  understandings: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  trustees:       'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
}

// ─── Event type gradients (EventDetailModal, calendar views) ─────────────────

export const EVENT_TYPE_COLORS = {
  pickup:       'linear-gradient(135deg, #CCFBF1 0%, #5EEAD4 100%)',
  dropoff:      'linear-gradient(135deg, #FFEDD5 0%, #FDBA74 100%)',
  school:       'linear-gradient(135deg, #DBEAFE 0%, #93C5FD 100%)',
  activity:     'linear-gradient(135deg, #F3E8FF 0%, #C084FC 100%)',
  appointment:  'linear-gradient(135deg, #FEE2E2 0%, #FCA5A5 100%)',
  friend_visit: 'linear-gradient(135deg, #FEF9C3 0%, #FDE047 100%)',
  manual:       'linear-gradient(135deg, #F1F5F9 0%, #CBD5E1 100%)',
}

// ─── Management item type colors (CreateItemModal, ItemDetailModal) ──────────

export const ITEM_TYPE_COLORS = {
  task:   '#60A5FA',
  ask:    '#34D399',
  switch: '#F59E0B',
}
