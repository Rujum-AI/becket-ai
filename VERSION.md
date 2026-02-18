# Becket AI — Version History

**Current Version: v4.09**

Format: `vMAJOR.MINOR` — max 10 updates per major version (01–10), then major increments.

---

## v4 — Security & Invitation Hardening

### v4.09 — Dev bypass auth, content editor scripts, local dev tooling
— 2026-02-18
- Dev auth bypass (mock user/session when `VITE_DEV_BYPASS_AUTH=true`)
- Router guard skip in dev mode
- Onboarding dev bypass (skip Supabase calls)
- Content pull/push scripts + npm commands
- .gitignore: exclude CONTENT.md

### v4.08 — Add version tracking: footer indicator + VERSION.md changelog
— 2026-02-18
- Version tag in copyright bar footer
- VERSION.md with full commit history mapped to vX.XX format

### v4.07 — Invitation system hardening: DB constraints, atomic RPC, max 2 members
`00ca650` — 2026-02-18
- Partial unique index enforcing 1 pending invite per family
- Trigger enforcing max 2 members per family
- Trigger blocking invites when family is full
- Atomic `create_family_invitation()` RPC (replaces client expire+insert)
- Updated `accept_pending_invitation()` with family size + multi-family checks
- Frontend uses new RPC in modal and onboarding flow

### v4.06 — Fix invite modal not detecting pending invite, prevent duplicate sends
`1276f46` — 2026-02-18
- InviteCoParentModal uses dashboardStore as primary invite source
- AppHeader shows pulsing amber dot when invite pending
- State synced bidirectionally between modal and store

### v4.05 — Pending invite banner on family dashboard
`a87eaed` — 2026-02-18
- Added pendingInvite to dashboard store with DB query
- Amber banner on FamilyView showing invite status
- Clickable banner opens invite modal to reshare

### v4.04 — Add local dev files to .gitignore
`43690aa` — 2026-02-18

### v4.03 — Landing page: force LTR direction regardless of language setting
`03fa714` — 2026-02-17

### v4.02 — Trigger Vercel redeploy
`236de17` — 2026-02-17

### v4.01 — Auth redesign: Google-only login, subdomain setup, profile FK fix
`2982dba` — 2026-02-17
- Google OAuth as sole auth method
- Subdomain setup (becket.rujum.ai)
- Profile foreign key fix for family members

---

## v3 — Features & Polish

### v3.10 — Landing page, login/onboarding redesign, invite cancel/resend
`17350ce` — 2026-02-16
- New landing page design
- Login and onboarding flow redesign
- Invite cancel and resend functionality

### v3.09 — Subscription infrastructure: Lemon Squeezy billing database, webhook, plan UI
`f844554` — 2026-02-15
- Lemon Squeezy integration
- Billing database tables
- Webhook handler
- Subscription plan UI

### v3.08 — Finance cleanup: thumbnail child filter, fixed transfer row alignment, pie chart centering
`d5766c1` — 2026-02-14

### v3.07 — Notification redesign: Slack Activity Tab model with time sections, inline actions
`f7c9b18` — 2026-02-13
- Slack-style activity tab
- Time-grouped sections
- Inline action buttons

### v3.06 — Mobile full-screen modals, semantic color system, white header, copyright bar
`b842d5d` — 2026-02-12

### v3.05 — Security: fix 7 critical/high vulnerabilities from red team audit
`89afa4a` — 2026-02-11
- Email validation from JWT (prevent spoofing)
- Family insert policy restricted to authenticated users
- Child ownership validation in nudge system

### v3.04 — Management redesign: Monday.com-style UnifiedBoard, pie chart cleanup, activity log fix
`795e4ed` — 2026-02-10

### v3.03 — Mobile child cards: single-column stack with CSS Grid layout
`82c245b` — 2026-02-09

### v3.02 — Mobile calendar: Google Calendar-style responsive views
`ae814cb` — 2026-02-08

### v3.01 — Mobile section headers: compact padding, smaller text, 50% title width cap
`7346494` — 2026-02-07

---

## v2 — UI Redesign & Mobile

### v2.10 — Mobile-first header, footer, and floating buttons redesign
`50ab7e6` — 2026-02-06

### v2.09 — Add missing camera.png asset
`80909f1` — 2026-02-05

### v2.08 — Header redesign: bright/orange split, new logo, modal button upgrades, notification fixes
`f8a59df` — 2026-02-04

### v2.07 — Fix brief showing future events: add upper bound to queries
`221b6be` — 2026-02-03

### v2.06 — Flatten child card: remove expand/collapse, show all content directly
`6b53838` — 2026-02-02

### v2.05 — Child card redesign: unique colors, smart action button, check-in, relative dates
`ec4d34d` — 2026-02-01

### v2.04 — Live notification overlay system with check-in feature
`6e18a7e` — 2026-01-31

### v2.03 — Management dashboard rework, photo capture flow, UI polish
`2027eb0` — 2026-01-30

### v2.02 — Photo system, documents modal, brief enhancements, event flow redesign
`3706077` — 2026-01-29

### v2.01 — Onboarding v2, add event flow, modal redesign, CSS cleanup
`c51149f` — 2026-01-28

---

## v1 — Foundation & Backend Wiring

### v1.10 — Add trustee event generator and auto-refresh calendar
`8b67191` — 2026-01-27

### v1.09 — Fix trustee delete not updating UI live
`62f90d5` — 2026-01-26

### v1.08 — Clean up dead mock stores and add cron jobs migration
`5ad074a` — 2026-01-25

### v1.07 — Add handoff time display, unexpected parent flow, cron jobs, and test seed
`70a79a7` — 2026-01-24

### v1.06 — Phase 2+3: Event generator and status resolution engine
`e2c26dd` — 2026-01-23

### v1.05 — Phase 1: Implement notification engine with database triggers
`4105e8a` — 2026-01-22

### v1.04 — Add child status tracking and notification system (Phase 4.1)
`7a560cb` — 2026-01-21

### v1.03 — Phase 4: Wire Management to Supabase
`3d4a907` — 2026-01-20

### v1.02 — Fix: Children now use real database UUIDs instead of localStorage IDs
`44a843b` — 2026-01-19

### v1.01 — Phase 4: Wire Trustees to Supabase
`b9905b4` — 2026-01-18

---

## v0 — Initial Release

### v0.02 — feat: Complete Phase 3 - Auth & Onboarding
`6dbafd1`

### v0.01 — Initial commit: Becket AI co-parenting management app
`736550a`
