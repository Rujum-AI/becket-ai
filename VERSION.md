# Becket AI — Version History

**Current Version: v3.03**

Format: `vMAJOR.MINOR` — max 10 updates per major version (01–10), then major increments.

---

## v3 — Custody Cycle Correctness

### v3.03 — Next handoff respects school model; stale status falls back to cycle
`pending` — 2026-06-20
- **getNextHandoff school-day model fixed.** Under the v2.08+ model the school event lives on the INCOMING custody day (kid sleeps with outgoing parent, drops at school next morning, incoming parent picks up after school). The handoff scanner was still looking at the OUTGOING day for school — so transitions with school on the next day fell back to "pickup at default morning time" instead of "pickup at school end". Now scans on the incoming day; handoff date is always the incoming day either way
- **getEffectiveStatus staleness.** DB `current_status` overrode the cycle indefinitely — a confirm action months ago kept the child stuck `with_dad` even as the cycle rolled to mom. Now if `status_changed_at` is on an earlier calendar day than today (or null), the DB status is treated as stale and the cycle takes over. Same-day explicit actions still win (e.g., a pickup confirmed this morning legitimately overrides the cycle until tomorrow)

### v3.02 — Child card "next interaction" reads live from store
`pending` — 2026-06-20
- Before: ChildCard read `child.nextHandoffTime/Type/Loc/Date` — fields baked onto the child object once, inside `loadFamilyData()`. Any change to events or custodySchedule (calendar edits, cron re-runs, the wipe+regenerate from 047/048) didn't propagate; the card kept showing the stale handoff until the user fully reloaded the app
- Removed those snapshot fields from the children map. ChildCard now calls `dashboardStore.getNextHandoff(child.id)` inside a Vue computed → Vue tracks reactive deps on `events`, `custodySchedule`, `defaultHandoffTime`, etc. and re-evaluates automatically
- Added a `nowTick` ref bumped every 60s (alongside the existing status refresh) so the computed also re-evaluates as time passes — a handoff whose time has elapsed drops out without needing an event change
- `getNextHandoff` exposed from the store

### v3.01 — Sunday-aligned SQL helper + school-first generation order
`pending` — 2026-06-20
- SQL custody helpers (`get_custody_parent_id`, `get_custody_parent`) treated cycle_data[0] as the parent on valid_from's actual weekday. The UI editor and calendar treat cycle_data[i] with i%7=day_of_week (0=Sun..6=Sat). Mismatch by `valid_from.dow` days — cron-generated handoffs and trustee-generated school events landed on the wrong custody days; calendar showed transitions the JS view said weren't transitions
- Migration 047 rewrites both helpers to shift epoch to the Sunday on/before valid_from, then wipes + regenerates all future custody_cycle / trustee_schedule events with the corrected helper
- Migration 048 swaps the order inside `generate_recurring_events` (trustee first, custody second) so the school-supersession guard in `generate_custody_events` actually sees school events when it runs. Plus a re-run of the same supersession cleanup
- Verified live: every upcoming school event's `dropoff_by` / `pickup_by` matches the JS calendar's per-day custody; zero custody handoffs remain on days with an active school event

---

## v2 — Onboarding & Dashboard Personalization

### v2.10 — School supersedes custody handoff (no more duplicate events)
`pending` — 2026-06-20
- Before: the daily cron's `generate_custody_events` created an evening dropoff (18:00) and a morning pickup (08:00) on every custody transition — regardless of whether school existed. Once schools were added, the calendar showed BOTH the school event AND a redundant pair of handoffs for the same day; parents got asked to confirm a handoff that doesn't actually happen
- `generate_custody_events` now checks per-child: if the INCOMING custody day already has a school event for that child, both the outgoing-evening dropoff and the incoming-morning pickup are skipped. School owns the handoff
- Migration 046 also cleans up FUTURE custody_cycle pickup/dropoff events that are already superseded by an existing school event (per-family timezone). Past events left untouched

### v2.09 — School events: configurable owners + calendar display (Wave 2 — UI)
`pending` — 2026-06-20
- School setup ([EntityFormModal](src/components/trustees/EntityFormModal.vue)) gains a "Who takes me?" block with per-schedule Drop-off / Pickup selectors (Previous day's parent / Current day's parent)
- `trustee_schedules.dropoff_owner` + `pickup_owner` columns added (migration 045); generator reads them per-school instead of hard-coding the rule
- Existing school schedules backfilled with the typical default: drop-off = prev day, pickup = current day; activities default to current/current (generator ignores for now)
- [EventDetailModal](src/components/family/EventDetailModal.vue) for school events now shows two rows — 🚗 Drop-off and 🚪 Pickup — with the resolved parent name (calling name or Dad/Mom)
- New `resolveParentDisplayName(profileId)` helper in dashboard store
- EN + HE translations: whoTakesMe, dropoffByLabel, pickupByLabel, ownerPrevDay, ownerCurrentDay, assignParentNeeded

### v2.08 — School events: drop-off / pickup split (Wave 1 — schema + generator)
`pending` — 2026-06-20
- Events table gains `dropoff_by` and `pickup_by` (uuid → profiles); school events now carry both, expected_by mirrors pickup_by for status-engine compat
- `generate_trustee_events` sets dropoff_by = previous-night's custody parent (sleep-with), pickup_by = current-day custody parent; non-school types unchanged
- Split-custody days leave the affected slot NULL — UI assignment lands in Wave 2
- `pending_actions` unique-pending index widened to (target_type, target_id, reason) so `swap_dropoff` and `swap_pickup` can be requested independently on the same event
- Backfill: future school events get the new slots filled per family timezone; past events untouched

### v2.07 — Calendar parenting-time: lazy cycle resolution + correct fallbacks
`pending` — 2026-06-20
- Custody schedule now computes lazily via a Proxy from the cycle config (epoch + length + per-day labels); no pre-filled window, so navigating to any past or future month always shows parenting time
- Removed the 100-day window that silently capped coloring once a cycle aged past three months
- `getCustodyForDate` no longer defaults missing schedule entries to 'mom' (which made every cell look orange when data was absent); returns 'no-custody' instead
- `resolveCustodyLabel` returns null for unrecognized values instead of leaking a raw profile_id UUID as a CSS class
- Added `.split` and `.no-custody` styling across month / week / day views; day-view banner now hides on non-custody days instead of falsely showing "mom Home"

### v2.05 — Usage step card layout matches type step
`pending` — 2026-02-24
- Usage cards now vertical grid (same as type selection cards)
- Image on top, title, description, toggle underneath each card
- 3-column for separated, 2-column centered for together/solo

### v2.04 — Usage step icons, profile menu label, separated image
`pending` — 2026-02-24
- Add section icons (finance/management/understandings) to onboarding usage cards
- Match AppHeader modal layout: icon + body + toggle
- Shorten profile dropdown label to "My Setup" / "ההגדרות שלי"
- Change separated type card image to two-homes (button_house2.png)

### v2.03 — Onboarding polish: merge steps, human-focused copy
`pending` — 2026-02-23
- Merge Type + Situation into single step (agreement inline for separated)
- Remove Challenges step entirely (derive from dashboard prefs)
- Rename Dashboard → Usage with problem-focused descriptions
- Remove "Family & Trustees always included" note
- All family types now 5 steps: Type → Profile → Usage → Currency → Plan
- Updated EN + HE copy: "Expenses & Costs", "Schedules & Tasks", "Parenting Agreements"

### v2.02 — Dashboard Setup in profile menu
`pending` — 2026-02-23
- New "Dashboard Setup" item in profile dropdown menu
- Toggle modal: enable/disable Finance, Management, Understandings
- Saves to Supabase instantly, footer + router update in real-time
- Auto-redirects to /family if current route becomes disabled

### v2.01 — Onboarding rebuild: family types, challenges, dashboard prefs
`pending` — 2026-02-23
- New 3-type funnel: Separated (7 steps), Together (6 steps), Solo (6 steps)
- Challenges multi-select per family type (communication, scheduling, etc.)
- Dashboard preference toggles: Finance, Management, Understandings (optional)
- Three-layer enforcement: router guard + footer + family data
- Direct URL to disabled dashboard → redirects to /family
- Dynamic AppFooter: satellite positions for 2/3/4/5 items
- New DB columns: family_type, dashboard_prefs (jsonb), challenges (jsonb)
- Migration 030: backfills existing families (all dashboards ON, no breakage)
- Null-safe nullable columns (relationship_status, agreement_basis)
- 94 new translation keys (EN + HE)

---

## v1 — Production Launch

### v1.10 — Compact desktop modal headers
`pending` — 2026-02-23
- Reduced header padding, title font-size, and image size on desktop
- Mobile modal headers unchanged

### v1.09 — Handoff pending alert + school in next interaction
`pending` — 2026-02-20
- Status NO LONGER auto-flips on custody transition days (keeps yesterday's parent)
- Blue "Handoff expected" conflict banner with Confirm Pickup/Dropoff button
- Next interaction now shows school events ("Take to School Friday at 8:00")
- Removed school exclusion filter — school is the primary daily interaction
- EN + HE translations for handoff pending alerts

### v1.08 — Fix handoff type: use custody direction, not stale DB status
`pending` — 2026-02-20
- Handoff type (pickup/dropoff) now always based on custody transition direction
- School events no longer force 'pickup' — outgoing parent correctly sees 'dropoff'
- Remove stale childIsWithMe override that flipped dropoff→pickup incorrectly

### v1.07 — Resolve profile_ids back to labels for calendar + all consumers
`pending` — 2026-02-19
- New `resolveCustodyLabel()` helper in dashboard store (profile_id → 'dad'/'mom'/'split')
- CalendarSection: custody day colors now work with profile_id schedule values
- ChangeCustodyModal: suggest-parent and preview resolve correctly
- AddEventFlow + CreateItemModal: co-parent day warnings resolve correctly
- isExpectedParentToday + createEvent/updateEvent pending_approval use resolver
- Fixes calendar showing only co-parent days, not user's own custody days

### v1.06 — Custody editor uses profile_ids end-to-end
`pending` — 2026-02-19
- CustodyAssignModal emits profile_id instead of 'dad'/'mom' strings
- CustodyCycleEditor resolves both old labels and new profile_ids for styling
- saveCycle derives parent_label from profile_id for SQL backward compat
- Old cycle_data normalized on load (dad/mom → profile_id)
- createEvent pending_approval uses profile_id comparison

### v1.05 — Pin custody to profile_ids + family timezone for RPC events
`pending` — 2026-02-19
- Custody schedule resolved to profile UUIDs instead of fragile 'dad'/'mom' labels
- getNextHandoff() and getEffectiveStatus() compare user.id directly
- Handles 'split' custody days correctly
- RPC event generators (011, 014) now SET LOCAL timezone from families.timezone
- Fixes +2h offset on school/activity events generated server-side

### v1.04 — Fix handoff date + NULL-safe events filter
`pending` — 2026-02-19
- Fix handoff date: non-school transitions use first day of new custody period (not transition day)
- NULL-safe events query: include events with NULL status (from RPC generator)
- Prevents "already passed" check from skipping tomorrow's handoff when checked tonight

### v1.03 — "Take to event" logic + trustee cascade delete
`f4f7b85` — 2026-02-19
- Next interaction: non-school/non-other events on custody days → "Take to [Event]"
- Delete upcoming calendar events when a trustee (school/activity/person) is removed
- Past events preserved for record; dashboard auto-refreshes after deletion
- EN + HE translations for "Take to" interaction type

### v1.02 — Smart handoff time: computed from custody transitions + school events
`7ce64ec` — 2026-02-19
- Compute next handoff from custody schedule transitions (no manual pickup/dropoff events needed)
- If school event exists on transition day → use school end time as handoff time
- Otherwise → use configurable default handoff time (stored in custody_cycles table)
- New "Default handoff time" input in custody cycle editor (Understandings page)
- Always-visible nudge/check-in button on child cards (grayed when inactive)
- Always-visible next interaction section with placeholder when no data
- EN + HE translations for new handoff time UI

### v1.01 — Post-launch hardening + invite flow overhaul
`152f8cb` — 2026-02-19
- QA hardening: requiresFamily guard on 6 routes, strip console.log, global error handler
- Fix invite "not found" bug: lookup_invitation_by_token RPC bypasses RLS
- Co-parent onboarding wizard: welcome screen, name/role picker, family settings review
- Child status engine: effective status from custody cycle, conflict banners, 60s refresh
- Full-page layout for entire invite + onboarding flow (dark textured footer, white header, styled buttons)
- Share interstitial: bottom bar with textured Continue button + progress dots
- Replace embedded families(*) joins with separate queries (fix PostgREST 406 errors)
- Generate family UUID client-side to bypass SELECT RLS on INSERT RETURNING
- Remove email edge function calls (invite shared via WhatsApp/copy-link)

### v1.00 — Production baseline
`0c3aed1` — 2026-02-18
- Google-only auth with subdomain (becket.rujum.ai)
- Invitation system hardened: DB triggers, partial unique index, atomic RPC
- Max 2 members per family enforced at DB level
- Pending invite locked once sent (must cancel to change)
- Pending invite banner on dashboard + amber dot in header
- Version tracking in footer + VERSION.md
- Dev bypass auth for local development
- Content editor scripts

---

<details>
<summary>Pre-release history (39 commits)</summary>

- `736550a` Initial commit: Becket AI co-parenting management app
- `6dbafd1` Phase 3: Auth & Onboarding
- `b9905b4` Phase 4: Wire Trustees to Supabase
- `44a843b` Fix: Children use real database UUIDs
- `3d4a907` Phase 4: Wire Management to Supabase
- `7a560cb` Child status tracking and notification system
- `4105e8a` Notification engine with database triggers
- `e2c26dd` Event generator and status resolution engine
- `70a79a7` Handoff time display, unexpected parent flow, cron jobs
- `5ad074a` Clean up dead mock stores, add cron jobs migration
- `62f90d5` Fix trustee delete not updating UI
- `8b67191` Trustee event generator, auto-refresh calendar
- `c51149f` Onboarding v2, add event flow, modal redesign
- `3706077` Photo system, documents modal, brief enhancements
- `2027eb0` Management dashboard rework, photo capture flow
- `6e18a7e` Live notification overlay with check-in
- `ec4d34d` Child card redesign: unique colors, smart actions
- `6b53838` Flatten child card: remove expand/collapse
- `221b6be` Fix brief showing future events
- `f8a59df` Header redesign: bright/orange split, new logo
- `80909f1` Add missing camera.png asset
- `50ab7e6` Mobile-first header, footer, floating buttons
- `7346494` Mobile section headers: compact padding
- `ae814cb` Mobile calendar: Google Calendar-style views
- `82c245b` Mobile child cards: single-column CSS Grid
- `795e4ed` Management redesign: Monday.com-style UnifiedBoard
- `89afa4a` Security: fix 7 critical/high vulnerabilities
- `b842d5d` Mobile full-screen modals, semantic colors, copyright bar
- `f7c9b18` Notification redesign: Slack Activity Tab model
- `d5766c1` Finance cleanup: thumbnail filter, transfer alignment
- `f844554` Subscription infrastructure: Lemon Squeezy billing
- `17350ce` Landing page, login/onboarding redesign, invite cancel/resend
- `2982dba` Auth redesign: Google-only login, subdomain, profile FK fix
- `236de17` Trigger Vercel redeploy
- `03fa714` Landing page: force LTR direction
- `43690aa` Add local dev files to .gitignore
- `a87eaed` Pending invite banner on family dashboard
- `1276f46` Fix invite modal detecting pending invite
- `00ca650` Invitation hardening: DB constraints, atomic RPC, max 2 members
- `e30b50a` Version tracking: footer indicator + VERSION.md
- `f2e0dc4` Dev bypass auth, content editor scripts
- `0c3aed1` Lock invite creation: refuse if pending exists

</details>
