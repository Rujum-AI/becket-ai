# Becket AI - Data Schema & System Specification

> Final specification for Supabase backend. All design decisions confirmed.

---

## Architecture Principles

1. **Event-Driven** - Events are the backbone. Child status is derived from active events.
2. **Custody Computed, Not Stored** - Daily custody derived from cycle pattern. Only pickup/dropoff are stored as events.
3. **Minimum Interaction** - System auto-generates data. Parents volunteer info, pull insights easily.
4. **Full Audit Trail** - Every edit, proposal, rejection timestamped. Needed for conflict resolution.
5. **Temporal Context** - Everything is queryable by time. "What was the rule on Feb 12?" is a valid query.
6. **Multi-Child Aware** - Events, tasks, expenses, understandings can target one or multiple children.

---

## Tables

### 1. `profiles`
User accounts. Extends Supabase `auth.users`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | References auth.users.id |
| email | text | |
| display_name | text | |
| avatar_url | text | Nullable |
| lang | text | 'en' or 'he' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### 2. `families`
The co-parenting unit.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| mode | text | 'solo' or 'co-parent' |
| home_count | int | 1 or 2 |
| relationship_status | text | 'together', 'apart', 'separated' |
| agreement_basis | text | 'formal', 'verbal', 'building' |
| plan | text | 'essential', 'ai-assistant', 'ai-mediator', 'full' |
| currency | text | 'NIS', 'USD', 'SGD', 'EUR' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### 3. `family_members`
Links profiles to families.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| profile_id | uuid FK → profiles | |
| parent_label | text | 'dad', 'mom', or custom |
| role | text | 'admin', 'parent' |
| joined_at | timestamptz | |

**Constraint:** UNIQUE(family_id, profile_id)

---

### 4. `invitations`
Co-parent invite system.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| email | text | |
| token | text UNIQUE | |
| status | text | 'pending', 'accepted', 'expired' |
| expires_at | timestamptz | |
| created_at | timestamptz | |

---

### 5. `children`
Kids in the family.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| name | text | |
| gender | text | 'boy', 'girl' |
| date_of_birth | date | |
| medical_notes | text | Nullable |
| avatar_url | text | Nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### 6. `custody_cycles`
Defines the repeating custody pattern. Versioned — new row when pattern changes.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| cycle_length | int | 7 or 14 days |
| cycle_data | jsonb | See structure below |
| valid_from | date | When this pattern starts |
| valid_until | date | Nullable. Null = currently active |
| version_number | int | |
| replaces_cycle_id | uuid FK → custody_cycles | Nullable. Previous version |
| created_by | uuid FK → profiles | |
| created_at | timestamptz | |

**cycle_data structure:**
```json
[
  { "day": 0, "parent_label": "dad" },
  { "day": 1, "parent_label": "dad" },
  { "day": 2, "parent_label": "mom" },
  { "day": 3, "parent_label": "mom" },
  { "day": 4, "parent_label": "dad" },
  { "day": 5, "parent_label": "mom" },
  { "day": 6, "parent_label": "mom" }
]
```

**Custody is COMPUTED, not stored as events.**
Database function `get_custody_parent(family_id, child_id, date)`:
1. Find active cycle where `valid_from <= date` and (`valid_until >= date` OR `valid_until IS NULL`)
2. Calculate `day_in_cycle = (date - valid_from) % cycle_length`
3. Return `cycle_data[day_in_cycle].parent_label`

This eliminates ~365 event rows per child per year.

**Index:** (family_id, valid_from, valid_until)

---

### 7. `events`
All scheduled and actual activities. The central table.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| type | text | See types below |
| title | text | |
| description | text | Nullable |
| start_time | timestamptz | |
| end_time | timestamptz | |
| all_day | boolean | Default false |
| | | |
| school_id | uuid FK → trustees_schools | Nullable |
| activity_id | uuid FK → trustees_activities | Nullable |
| person_id | uuid FK → trustees_people | Nullable |
| parent_id | uuid FK → profiles | Nullable (for custody transitions) |
| location_name | text | Nullable. Free text for custom locations |
| | | |
| status | text | 'scheduled', 'confirmed', 'pending_approval', 'missed', 'cancelled' |
| expected_by | uuid FK → profiles | Nullable. Who should confirm (for pickup/dropoff) |
| confirmed_at | timestamptz | Nullable |
| confirmed_by | uuid FK → profiles | Nullable |
| scheduled_time | timestamptz | Original scheduled time |
| actual_time | timestamptz | Nullable. When it actually happened |
| | | |
| generated_from_type | text | 'trustee_schedule', 'manual', 'ask_approved', null |
| generated_from_id | uuid | Nullable. References the source |
| recurrence_rule | text | Nullable. RRULE format for recurring template |
| recurrence_exception | boolean | Default false. True if edited instance |
| parent_event_id | uuid FK → events | Nullable. Links instance to recurring template |
| | | |
| created_by | uuid FK → profiles | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Event types:**
- `pickup` — custody transition: parent picks up child
- `dropoff` — custody transition: parent drops off child
- `school` — generated from trustee school schedule
- `activity` — generated from trustee activity schedule
- `friend_visit` — child visiting a trusted person
- `appointment` — doctor, dentist, etc.
- `manual` — any other event

**Location resolution:** Only ONE of school_id, activity_id, person_id, parent_id, location_name should be set. Enforced by CHECK constraint.

**Recurrence handling (Google Calendar style):**
- Template event: has `recurrence_rule`, no `parent_event_id`
- Generated instances: `parent_event_id` links to template
- Edit one instance: set `recurrence_exception = true`
- Edit all future: update `recurrence_rule` on template, regenerate future instances
- Cancel one: set `status = 'cancelled'` on instance
- Cancel all future: set end date on recurrence rule

**Rolling generation:** Generate events 3 months ahead. Background job extends the window.
`trustee_schedules.generated_until` tracks how far ahead we've generated.

**Indexes:**
- (family_id, start_time, end_time) — range queries
- (family_id, type, status) — filtered lists
- (status, expected_by) — alert queries
- (parent_event_id) — recurrence lookups
- (generated_from_type, generated_from_id) — source tracing

---

### 8. `event_children`
Junction table: which children are involved in each event.

| Column | Type | Notes |
|--------|------|-------|
| event_id | uuid FK → events | |
| child_id | uuid FK → children | |

**Constraint:** PRIMARY KEY (event_id, child_id)

**Index:** (child_id, event_id) — for "all events for child X" queries

One event can affect multiple children. One child has many events.

---

### 9. `trustees_schools`
Educational institutions (schools, daycare).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| name | text | |
| address | text | Nullable |
| contact_phone | text | Nullable |
| default_items | jsonb | Array: ['backpack', 'lunch box', 'water bottle'] |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### 10. `trustees_activities`
After-school activities (soccer, music, dance).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| name | text | |
| address | text | Nullable |
| contact_phone | text | Nullable |
| default_items | jsonb | Array: ['soccer cleats', 'uniform', 'water bottle'] |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### 11. `trustees_people`
Trusted individuals (grandma, friends, babysitters).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| name | text | |
| relationship | text | 'family', 'friend', 'babysitter', or custom |
| contact_phone | text | Nullable |
| address | text | Nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### 12. `trustee_children`
Which children are associated with which trustees.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| trustee_type | text | 'school', 'activity', 'person' |
| trustee_id | uuid | Polymorphic ref to the trustee |
| child_id | uuid FK → children | |

**Constraint:** UNIQUE(trustee_type, trustee_id, child_id)

---

### 13. `trustee_schedules`
Recurring patterns that generate events.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| trustee_type | text | 'school', 'activity' |
| trustee_id | uuid | References the trustee |
| child_id | uuid FK → children | |
| days | jsonb | See structure below |
| start_date | date | Schedule starts |
| end_date | date | Nullable. Schedule ends |
| repeat_freq | int | Default 1. Every N weeks |
| generated_until | date | How far ahead events have been generated |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**days structure** (matches frontend):
```json
[
  { "day": 0, "active": true, "start": "08:00", "end": "16:00" },
  { "day": 1, "active": true, "start": "08:00", "end": "16:00" },
  { "day": 2, "active": false, "start": null, "end": null },
  ...
]
```

**Event generation:** A function reads this schedule and creates `events` rows for each active day, up to `generated_until`. Background job extends the window.

---

### 14. `handoffs`
Records of custody transitions. Created when pickup/dropoff is confirmed.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| child_id | uuid FK → children | |
| event_id | uuid FK → events | The pickup/dropoff event |
| from_parent_id | uuid FK → profiles | |
| to_parent_id | uuid FK → profiles | |
| scheduled_at | timestamptz | When it was supposed to happen |
| actual_at | timestamptz | When it actually happened |
| items_sent | jsonb | Array of items. See structure below |
| snapshot_id | uuid FK → snapshots | Nullable. Photo at handoff |
| notes | text | Nullable |
| created_at | timestamptz | |

**items_sent structure:**
```json
[
  { "name": "backpack", "flagged_missing": false },
  { "name": "water bottle", "flagged_missing": true },
  { "name": "winter coat", "flagged_missing": false }
]
```

Items are optional. Parents can do a quick "confirm pickup" without logging items.
If they do log items, the list defaults from the trustee's `default_items` (one-click add).
Either parent can flag items as missing. No approval required from other side.

**Indexes:**
- (child_id, actual_at DESC) — for "last handoff" queries
- (family_id, actual_at DESC) — for family timeline
- (from_parent_id, child_id, actual_at DESC) — for brief system: "when did this parent last drop off?"

---

### 15. `items`
Master item list per child. Optional one-time setup.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| child_id | uuid FK → children | |
| name | text | |
| category | text | 'daily', 'seasonal', 'special' |
| current_status | text | 'with_dad', 'with_mom', 'at_school', 'missing', 'unknown' |
| last_seen_handoff_id | uuid FK → handoffs | Nullable |
| last_seen_at | timestamptz | Nullable |
| flagged_missing_since | timestamptz | Nullable. When first flagged |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Index:** (child_id, current_status)

---

### 16. `item_history`
Movement log for tracked items.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| item_id | uuid FK → items | |
| handoff_id | uuid FK → handoffs | |
| status_change | text | 'sent', 'received', 'flagged_missing', 'found' |
| with_parent_id | uuid FK → profiles | Nullable |
| timestamp | timestamptz | |

**Retention:** 1 month. Auto-delete older records.
**Index:** (item_id, timestamp DESC), (timestamp) for cleanup job

---

### 17. `snapshots`
Photos and media. Flat storage with smart filtering.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| file_url | text | Supabase Storage path |
| file_type | text | 'image', 'video' |
| timestamp | timestamptz | EXIF time or upload time |
| uploaded_by | uuid FK → profiles | |
| event_id | uuid FK → events | Nullable. Auto-computed on upload |
| caption | text | Nullable |
| created_at | timestamptz | |

**Auto-tagging on upload** (database function):
1. Find most specific active event at snapshot timestamp for this family
2. Priority: friend_visit > appointment > activity > school > pickup/dropoff
3. Set `event_id` → from there we derive children (via event_children) and location

**Smart filtering queries:**
- By child: JOIN event_children through event_id
- By date range: WHERE timestamp BETWEEN x AND y
- By event type: JOIN events WHERE type = x
- By parent who uploaded: WHERE uploaded_by = x

**Storage:** Supabase Storage bucket `snapshots`, kept forever.

**Indexes:**
- (family_id, timestamp DESC) — album browsing
- (event_id) — event timeline view
- (uploaded_by, timestamp DESC) — "my photos"

---

### 18. `tasks`
Tasks and asks between co-parents.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| child_id | uuid FK → children | Nullable. Can be family-wide |
| type | text | 'task', 'ask' |
| name | text | |
| description | text | Nullable |
| urgency | text | 'low', 'mid', 'high', 'urgent' |
| status | text | 'pending', 'in_progress', 'completed', 'failed', 'rejected' |
| owner_id | uuid FK → profiles | Nullable. Who's responsible |
| creator_id | uuid FK → profiles | Who created it |
| due_date | date | Nullable |
| becomes_event | boolean | Default false. If true, approval creates a calendar event |
| related_event_id | uuid FK → events | Nullable. Linked event after approval |
| event_data | jsonb | Nullable. Event details for when ask is approved |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| completed_at | timestamptz | Nullable |

**event_data structure** (for asks that become events):
```json
{
  "title": "Dentist appointment",
  "start_time": "2026-02-15T15:00:00",
  "end_time": "2026-02-15T16:00:00",
  "child_ids": ["uuid1"],
  "location_name": "Dr. Smith Clinic"
}
```

**Ask → Event flow:**
1. Parent A creates ask with `becomes_event = true` + `event_data`
2. Event created with `status = 'pending_approval'` in calendar (shows as pending)
3. Parent B approves ask → event status changes to `'scheduled'`, task status to `'completed'`
4. Parent B rejects ask → event status changes to `'cancelled'`, task status to `'rejected'`

**Indexes:**
- (family_id, status, type) — filtered lists
- (owner_id, status) — my tasks
- (child_id, type, status) — per-child tasks

---

### 19. `task_comments`
Activity log and discussion on tasks/asks.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| task_id | uuid FK → tasks | |
| author_id | uuid FK → profiles | |
| text | text | |
| action | text | Nullable: 'created', 'status_change', 'assigned', 'comment', 'approved', 'rejected' |
| created_at | timestamptz | |

**Index:** (task_id, created_at)

---

### 20. `understandings`
Agreements between parents. **Fully versioned** — each row is one version.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| group_id | uuid | Same across all versions of one agreement |
| family_id | uuid FK → families | |
| child_id | uuid FK → children | Nullable. Null = applies to all children |
| subject | text | |
| category | text | 'parenting', 'expenses', 'holidays', 'other' |
| content | text | The actual agreement text |
| | | |
| proposed_by | uuid FK → profiles | |
| proposed_at | timestamptz | |
| status | text | 'pending', 'accepted', 'rejected', 'superseded', 'active', 'terminated' |
| | | |
| version_number | int | |
| replaces_id | uuid FK → understandings | Nullable. Previous version |
| | | |
| accepted_at | timestamptz | Nullable |
| accepted_by | uuid FK → profiles | Nullable |
| rejected_at | timestamptz | Nullable |
| rejected_by | uuid FK → profiles | Nullable |
| rejection_reason | text | Nullable |
| | | |
| valid_from | date | Nullable. When this version became the active rule |
| valid_until | date | Nullable. When superseded or terminated |
| | | |
| is_temporary | boolean | Default false |
| expires_on | date | Nullable |
| | | |
| expense_rules | jsonb | Nullable. See structure below |
| attachment_url | text | Nullable. PDF of legal agreement |
| | | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**expense_rules structure:**
```json
{
  "categories": [
    {
      "name": "education",
      "dad_percent": 50,
      "mom_percent": 50,
      "budget_limit": { "amount": 2000, "period": "monthly" }
    },
    {
      "name": "healthcare",
      "dad_percent": 60,
      "mom_percent": 40,
      "budget_limit": { "amount": 500, "period": "monthly" }
    },
    {
      "name": "activities",
      "dad_percent": 50,
      "mom_percent": 50,
      "budget_limit": null
    }
  ],
  "other_requires_approval": true
}
```

**Fixed expense categories** (system-wide, not per family):
education, activities, healthcare, clothing, legal, food, events, other

**Version flow:**
1. Parent A proposes → `status = 'pending'`, `version = 1`, new `group_id`
2. Parent B accepts → `status = 'active'`, `valid_from = today`
3. Parent A proposes edit → new row, same `group_id`, `version = 2`, `replaces_id = v1.id`, `status = 'pending'`
4. Parent B accepts edit → v2: `status = 'active'`, `valid_from = today` | v1: `status = 'superseded'`, `valid_until = today`
5. Either parent requests termination → `status = 'terminated'` when other parent confirms, `valid_until = today`

**Temporal query: "What was the rule on Feb 12, 2026?"**
```sql
SELECT * FROM understandings
WHERE group_id = X
  AND valid_from <= '2026-02-12'
  AND (valid_until >= '2026-02-12' OR valid_until IS NULL)
  AND status = 'active'
```

**Indexes:**
- (family_id, status, category) — active agreements
- (group_id, version_number) — version chain
- (family_id, child_id, category, valid_from, valid_until) — temporal lookups

---

### 21. `expenses`
Financial tracking with validation against understandings.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| child_id | uuid FK → children | Nullable |
| understanding_id | uuid FK → understandings | Nullable. Which version was active |
| | | |
| title | text | |
| description | text | Nullable |
| amount | decimal | |
| category | text | Fixed: education, activities, healthcare, clothing, legal, food, events, other |
| date | date | |
| | | |
| payer_id | uuid FK → profiles | Who paid |
| status | text | 'pending_approval', 'approved', 'rejected', 'counted' |
| requires_approval_reason | text | Nullable: 'category_other', 'exceeds_budget', 'no_rule' |
| approved_by | uuid FK → profiles | Nullable |
| approved_at | timestamptz | Nullable |
| | | |
| split_dad_percent | int | Computed from understanding rules |
| split_mom_percent | int | Computed from understanding rules |
| split_dad_amount | decimal | Computed |
| split_mom_amount | decimal | Computed |
| | | |
| receipt_url | text | Nullable. Supabase Storage |
| | | |
| created_by | uuid FK → profiles | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Validation logic on insert:**
1. Find active understanding: `WHERE family_id = X AND child_id = expense.child_id AND category = 'expenses' AND valid_from <= expense.date AND (valid_until >= expense.date OR valid_until IS NULL) AND status = 'active'`
2. Save `understanding_id` for audit trail
3. If category = 'other' AND `expense_rules.other_requires_approval` → status = 'pending_approval'
4. If category is defined in expense_rules:
   - Compute budget used: `SUM(amount) WHERE category = X AND period matches`
   - If exceeds budget_limit → status = 'pending_approval', reason = 'exceeds_budget'
   - Else → status = 'counted', compute split amounts from percentages
5. If no matching understanding → status = 'pending_approval', reason = 'no_rule'

**Indexes:**
- (family_id, date DESC) — recent expenses
- (family_id, child_id, category, date) — budget calculation
- (status, family_id) — pending approvals
- (understanding_id) — audit trail

---

### 22. `expense_budget_cache`
Running totals for fast budget validation. Updated by trigger.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| child_id | uuid FK → children | Nullable |
| category | text | |
| period_type | text | 'monthly', 'yearly' |
| period_key | text | '2026-02' or '2026' |
| total_amount | decimal | |
| updated_at | timestamptz | |

**Constraint:** UNIQUE(family_id, child_id, category, period_type, period_key)

Updated via database trigger on expenses INSERT/UPDATE/DELETE.

---

### 23. `notifications`
Persistent notification records.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| recipient_id | uuid FK → profiles | |
| type | text | See types below |
| category | text | 'handoff', 'task', 'ask', 'approval', 'event', 'expense', 'nudge' |
| | | |
| title | text | |
| message | text | |
| priority | text | 'low', 'normal', 'high', 'urgent' |
| | | |
| related_entity_type | text | 'event', 'understanding', 'expense', 'task', 'snapshot', 'handoff' |
| related_entity_id | uuid | |
| | | |
| requires_action | boolean | e.g. missed pickup must be resolved |
| action_taken | boolean | Default false |
| action_taken_at | timestamptz | Nullable |
| | | |
| read | boolean | Default false |
| read_at | timestamptz | Nullable |
| | | |
| escalation_level | int | Default 0. For pickup: 0 = initial, 1 = escalated |
| parent_notification_id | uuid FK → notifications | Nullable. Links escalation to original |
| | | |
| created_at | timestamptz | |

**Notification types:**
- `pickup_expected` — reminder: pickup should happen soon
- `pickup_missed` — 15 min past, pickup not confirmed (requires_action = true)
- `pickup_escalated` — 15 min after missed, notify other parent "check with [parent]"
- `understanding_proposed` — new agreement proposed
- `understanding_accepted` — agreement accepted
- `understanding_rejected` — agreement rejected
- `snapshot_added` — new photo of child
- `expense_pending` — expense needs approval
- `expense_over_budget` — expense exceeds agreed budget
- `task_assigned` — new task assigned to you
- `ask_received` — new ask from co-parent
- `event_requested` — ask wants to create event on your custody time
- `item_flagged_missing` — item marked as missing at handoff
- `nudge_request` — parent misses child, wants update
- `nudge_response` — auto-populated with recent snapshot + activity

**Nudge special handling:**
1. Parent A presses "nudge" for child
2. System creates `nudge_request` notification for Parent B
3. System auto-pulls most recent snapshot + last event for child
4. Creates `nudge_response` notification for Parent A with this data
5. If Parent B responds manually, updates the nudge_response

**Escalation logic (pickup):**
1. Pickup event scheduled for 16:00, expected_by = dad
2. At 16:15: if event.status != 'confirmed' → create notification type='pickup_missed', recipient=dad, requires_action=true, priority='urgent'
3. At 16:30: if still not confirmed → create notification type='pickup_escalated', recipient=mom, parent_notification_id=dad's notification, escalation_level=1

**Retention:** 3 months. Auto-delete older records.

**Indexes:**
- (recipient_id, read, created_at DESC) — unread notifications
- (family_id, category, created_at DESC) — filtered feed
- (related_entity_type, related_entity_id) — entity notifications
- (created_at) — for cleanup job

---

### 24. `activity_log`
General audit trail for AI queries and conflict resolution.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| actor_id | uuid FK → profiles | Who performed the action |
| action | text | 'created', 'updated', 'deleted', 'approved', 'rejected', 'confirmed', 'flagged' |
| entity_type | text | 'event', 'expense', 'understanding', 'task', 'handoff', 'snapshot', 'item' |
| entity_id | uuid | |
| changes | jsonb | What changed: { field: { old: X, new: Y } } |
| timestamp | timestamptz | |

**Purpose:** Single table for AI to query: "What happened in this family recently?"
No need to JOIN 8 tables.

**Retention:** 1 year, then archive to cold storage.

**Index:** (family_id, entity_type, timestamp DESC)

---

### 25. `documents`
Uploaded files (agreements, medical records, receipts).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| family_id | uuid FK → families | |
| name | text | |
| file_type | text | 'pdf', 'image', 'document' |
| file_url | text | Supabase Storage path |
| category | text | 'agreement', 'receipt', 'medical', 'other' |
| related_entity_type | text | Nullable |
| related_entity_id | uuid | Nullable |
| uploaded_by | uuid FK → profiles | |
| uploaded_at | timestamptz | |

**Index:** (family_id, category, uploaded_at DESC)

---

## Supabase Storage Buckets

| Bucket | Access | Contents | Retention |
|--------|--------|----------|-----------|
| `avatars` | Public read | Profile pictures | Forever |
| `snapshots` | Family-scoped | Photos/videos of children | Forever |
| `documents` | Family-scoped | PDFs, agreements, receipts | Forever |

---

## Row Level Security (RLS)

All tables get RLS enabled.

**Helper function:**
```sql
CREATE FUNCTION user_family_ids()
RETURNS SETOF uuid AS $$
  SELECT family_id FROM family_members
  WHERE profile_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**Policy pattern for family-scoped tables:**
```sql
-- SELECT: user can read if they belong to the family
CREATE POLICY "family_read" ON [table]
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

-- INSERT: user can insert if they belong to the family
CREATE POLICY "family_insert" ON [table]
  FOR INSERT WITH CHECK (family_id IN (SELECT user_family_ids()));

-- UPDATE: user can update if they belong to the family
CREATE POLICY "family_update" ON [table]
  FOR UPDATE USING (family_id IN (SELECT user_family_ids()));

-- DELETE: user can delete if they belong to the family
CREATE POLICY "family_delete" ON [table]
  FOR DELETE USING (family_id IN (SELECT user_family_ids()));
```

**Profiles:** Users can only read/update their own profile.
**Notifications:** Users can only read their own notifications (recipient_id = auth.uid()).

---

## Database Functions

### `get_custody_parent(p_family_id uuid, p_date date)`
Returns the parent_label who has custody on a given date.
Computes from custody_cycles pattern without needing stored events.

### `tag_snapshot(p_family_id uuid, p_timestamp timestamptz)`
Finds the most specific active event at the given timestamp.
Priority: friend_visit > appointment > activity > school > pickup/dropoff.
Returns event_id for auto-tagging.

### `child_timeline(p_child_id uuid, p_from date, p_to date)`
Aggregates events, handoffs, snapshots, expenses for a date range.
Returns jsonb timeline for display and AI consumption.

### `generate_brief(p_child_id uuid, p_parent_id uuid, p_since timestamptz DEFAULT NULL)`
Generates a briefing for a parent about a child.
- Default `p_since`: last handoff where this parent was `from_parent_id` (last time they dropped off)
- Can be overridden to any timestamp or "last X days"
- Pulls: events, snapshots, handoffs, expenses, task changes, understanding changes since that time
- Returns structured jsonb for display.

### `validate_expense(p_expense_id uuid)`
Checks expense against active understanding rules.
Sets status to 'counted' or 'pending_approval' based on category and budget rules.

### `generate_recurring_events(p_months_ahead int DEFAULT 3)`
Reads all trustee_schedules and generates event instances up to N months ahead.
Updates `generated_until` on each schedule.
Handles exceptions (cancelled/edited instances) by skipping those dates.

### `check_missed_pickups()`
Called by Supabase cron job every 5 minutes.
Finds pickup/dropoff events past deadline that are not confirmed.
Creates notifications with escalation logic.

---

## Scheduled Jobs (Supabase pg_cron)

| Job | Schedule | Function |
|-----|----------|----------|
| Generate recurring events | Daily at 2am | `generate_recurring_events(3)` |
| Check missed pickups | Every 5 minutes | `check_missed_pickups()` |
| Clean item_history | Daily at 3am | `DELETE FROM item_history WHERE timestamp < NOW() - INTERVAL '1 month'` |
| Clean notifications | Daily at 3am | `DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '3 months'` |
| Clean activity_log | Monthly | `Archive WHERE timestamp < NOW() - INTERVAL '1 year'` |
| Refresh budget cache | Hourly | `refresh_expense_budget_cache()` |

---

## Data Retention Summary

| Data | Retention | Method |
|------|-----------|--------|
| Events | Forever | — |
| Snapshots / Photos | Forever | Supabase Storage |
| Handoffs | Forever | — |
| Understandings | Forever (all versions) | — |
| Expenses | Forever | — |
| Task comments | Forever | — |
| Activity log | 1 year | Archive then delete |
| Notifications | 3 months | Auto-delete |
| Item history | 1 month | Auto-delete |

---

## Export: PDF Report

Date range selection. Sections:
1. **Custody Schedule** — who had the child each day in the period
2. **Events Timeline** — all events with confirmations and actual times
3. **Handoff History** — each transition with items logged, missing flags
4. **Expenses Summary** — breakdown by category, payer, totals, split amounts
5. **Understandings Active** — which agreements were active during period, any changes
6. **Snapshots** — thumbnails with timestamps and event tags
7. **Tasks & Asks** — activity log with resolutions

Format: PDF, generated server-side (Supabase Edge Function or external service).

---

## Table Count: 25

| # | Table | Rows/Year (2 kids) |
|---|-------|--------------------|
| 1 | profiles | 2 |
| 2 | families | 1 |
| 3 | family_members | 2 |
| 4 | invitations | ~1 |
| 5 | children | 2 |
| 6 | custody_cycles | ~2-4 versions |
| 7 | events | ~800 (no custody events!) |
| 8 | event_children | ~800-1600 |
| 9 | trustees_schools | ~2-4 |
| 10 | trustees_activities | ~4-8 |
| 11 | trustees_people | ~10-20 |
| 12 | trustee_children | ~10-20 |
| 13 | trustee_schedules | ~6-12 |
| 14 | handoffs | ~100-200 |
| 15 | items | ~20-40 |
| 16 | item_history | Cleaned monthly |
| 17 | snapshots | ~100-500 |
| 18 | tasks | ~50-200 |
| 19 | task_comments | ~200-500 |
| 20 | understandings | ~10-30 versions |
| 21 | expenses | ~100-500 |
| 22 | expense_budget_cache | ~50-100 |
| 23 | notifications | Cleaned quarterly |
| 24 | activity_log | Cleaned yearly |
| 25 | documents | ~10-50 |

**Total persistent rows per family per year: ~2,500-4,500**
Highly scalable. Even 10,000 families = ~45M rows/year max, well within PostgreSQL capabilities.
