# Becket AI — Version History

**Current Version: v1.00**

Format: `vMAJOR.MINOR` — max 10 updates per major version (01–10), then major increments.

---

## v1 — Production Launch

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
