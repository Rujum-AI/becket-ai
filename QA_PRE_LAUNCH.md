# Becket AI — Pre-Launch QA & Security Audit

**Generated:** 2026-02-18
**Status:** DIAGNOSTIC (run tests, then fix)

---

## PART 1: CRITICAL SECURITY ISSUES (Fix Before Launch)

### CRIT-1: Exposed Secrets in Git
**File:** `databasepassword.txt` (TRACKED IN GIT)
- Database password: exposed
- Google OAuth Client ID: exposed
- Google OAuth Client Secret: exposed

**Action Required:**
1. Remove from git: `git rm --cached databasepassword.txt`
2. Add to `.gitignore`
3. Rotate ALL credentials:
   - Supabase DB password (Supabase Dashboard → Settings → Database)
   - Google OAuth secret (Google Cloud Console → Credentials)
4. Remove from git history: `git filter-repo --path databasepassword.txt --invert-paths`

### CRIT-2: Dev Auth Bypass System
**File:** `src/composables/useAuth.js` (lines 8-26)
- `DEV_BYPASS` creates a fake user with hardcoded UUID
- Skips all auth checks when `VITE_DEV_BYPASS_AUTH=true`
- Router guard skips authentication entirely

**Action Required:**
- Remove DEV_BYPASS code entirely before launch
- Use local Supabase with real test users instead

### CRIT-3: Sensitive Data in localStorage
**File:** `src/stores/family.js` (lines 5-30)
- Partner email, children names/DOB/medical, relationship status stored in plaintext
- Accessible to any XSS or browser extension

**Action Required:**
- Move onboarding state to sessionStorage (cleared on browser close)
- Or keep in Pinia memory only (not persisted)

---

## PART 2: TEST SCENARIOS

### Category A: Authentication & Session

| # | Test | Steps | Expected | Severity |
|---|------|-------|----------|----------|
| A1 | Google OAuth login | Click "Sign in with Google" → complete flow | Redirect to /family or /onboarding | HIGH |
| A2 | Session persistence | Login → close tab → reopen app | Still authenticated | HIGH |
| A3 | Session expiry | Wait for token to expire (or manually clear) | Redirected to login | HIGH |
| A4 | Unauthenticated route access | Visit /family directly without login | Redirected to / (landing) | HIGH |
| A5 | Auth callback handling | Complete Google OAuth → check URL hash processing | No tokens in URL bar after redirect | MEDIUM |
| A6 | Logout flow | Click logout → verify session cleared | Redirected to landing, can't access /family | HIGH |
| A7 | Multiple tabs | Login in tab 1, open tab 2 → both authenticated? | Both tabs share session | MEDIUM |
| A8 | Invalid session token | Manually corrupt token in localStorage | App redirects to login gracefully | MEDIUM |

### Category B: Invitation System (Hardened)

| # | Test | Steps | Expected | Severity |
|---|------|-------|----------|----------|
| B1 | Create first invite | Open modal → enter email → create | Invite created, banner appears, share options shown | CRITICAL |
| B2 | Invite persists on refresh | Create invite → hard refresh (Ctrl+Shift+R) | Banner still shows pending invite | CRITICAL |
| B3 | Block duplicate invite | With pending invite → try to create another | RPC returns invite_already_pending, shows existing | CRITICAL |
| B4 | Cancel and recreate | Pending invite → click "Change email" → enter new email → create | Old expired, new created | HIGH |
| B5 | Header hides when pending | Create invite → check header dropdown | "Invite Co-Parent" option NOT visible | HIGH |
| B6 | Header shows when no invite | No pending invite, no partner → check header | "Invite Co-Parent" option visible | HIGH |
| B7 | Family full blocks invite | Both parents joined → try to invite | Modal shows "Family complete" | HIGH |
| B8 | Invite acceptance flow | Send invite → log in as invitee → visit /invite/:token | Invitee joins family, invite marked accepted | CRITICAL |
| B9 | Expired invite rejection | Wait 7 days (or manually expire) → try to accept | Error: invitation expired | HIGH |
| B10 | Accept with wrong email | Send invite to A → log in as B → visit token URL | Error: no pending invitation | HIGH |
| B11 | Double-accept prevention | Accept invite → try same token again | Already member, no duplicate | HIGH |
| B12 | Max 2 members enforced | 2 parents in family → try DB-level INSERT | Trigger rejects with check_violation | CRITICAL |
| B13 | User can't join 2 families | User in family A → try accepting invite to family B | Returns already_member | HIGH |
| B14 | Share via WhatsApp | Click WhatsApp share button | Opens wa.me with correct link and message | LOW |
| B15 | Share via Email | Click Email share button | Opens mailto with correct subject/body | LOW |
| B16 | Copy invite link | Click copy button | Link copied to clipboard, check icon shows | LOW |

### Category C: Data Isolation (Cross-Family)

| # | Test | Steps | Expected | Severity |
|---|------|-------|----------|----------|
| C1 | Can't see other family's children | Query children table as User A | Only sees own family's children | CRITICAL |
| C2 | Can't see other family's events | Query events table as User A | Only own family's events | CRITICAL |
| C3 | Can't see other family's expenses | Query expenses table | Only own family | CRITICAL |
| C4 | Can't see other family's trustees | Query trustees_schools/activities/people | Only own family | HIGH |
| C5 | Can't see other family's notifications | Query notifications table | Only where recipient_id = self | HIGH |
| C6 | Can't see other family's snapshots | Query snapshots table | Only own family | HIGH |
| C7 | Can't INSERT into other family | Try inserting event with wrong family_id | RLS blocks insert | CRITICAL |
| C8 | Can't UPDATE other family's data | Try updating child in different family | RLS blocks update | CRITICAL |
| C9 | Storage isolation | Try accessing /snapshots/{other_family_id}/photo.jpg | Access denied | HIGH |
| C10 | RPC respects family boundary | Call send_nudge with child from other family | Exception: child not in family | HIGH |

### Category D: Edge Cases & Race Conditions

| # | Test | Steps | Expected | Severity |
|---|------|-------|----------|----------|
| D1 | Concurrent invite creation | Two browser tabs → create invite simultaneously | Only one succeeds (partial unique index) | HIGH |
| D2 | Cancel during creation | Start creating invite → cancel mid-request | No orphaned data | MEDIUM |
| D3 | Network failure during invite | Create invite → disconnect network mid-request | Error shown, state consistent | MEDIUM |
| D4 | Rapid status changes | Click pickup → immediately click dropoff | Only one status update applied | MEDIUM |
| D5 | Empty family dashboard | New user, no children added | Empty state shown, no errors | MEDIUM |
| D6 | Special characters in names | Add child with name: `<script>alert(1)</script>` | Name displayed as text, no XSS | HIGH |
| D7 | Unicode/Hebrew names | Add child with Hebrew name: `יוסי` | Displays correctly in RTL | MEDIUM |
| D8 | Very long email in invite | Enter 256-char email | Validation rejects gracefully | LOW |
| D9 | SQL injection in email | Enter `'; DROP TABLE invitations;--` as email | Rejected by email validation regex | HIGH |
| D10 | Onboarding incomplete → dashboard | Complete step 1 of onboarding → navigate to /family | Redirected back to onboarding | HIGH |

### Category E: UI/UX Consistency

| # | Test | Steps | Expected | Severity |
|---|------|-------|----------|----------|
| E1 | Mobile responsiveness | Open on 375px width (iPhone SE) | All content visible, no horizontal scroll | HIGH |
| E2 | RTL Hebrew layout | Switch to Hebrew | All content RTL, no layout breaks | HIGH |
| E3 | Language toggle persistence | Switch to Hebrew → refresh | Still Hebrew | MEDIUM |
| E4 | Version display | Check footer | Shows v1.00 | LOW |
| E5 | Copyright bar always visible | Scroll to bottom of page | Copyright bar visible | LOW |
| E6 | Modal close on overlay click | Open any modal → click outside | Modal closes | MEDIUM |
| E7 | Loading states | Slow network → check all data loads | Loading indicators shown, no flash of empty | MEDIUM |
| E8 | Error toast messages | Trigger an error → check message | User-friendly message (no stack traces) | MEDIUM |

### Category F: Production Readiness

| # | Test | Steps | Expected | Severity |
|---|------|-------|----------|----------|
| F1 | Console clean in prod | Open DevTools on production URL | No debug logs, no sensitive data | HIGH |
| F2 | No dev bypass in prod | Check network tab for mock user | Real Supabase auth only | CRITICAL |
| F3 | HTTPS enforced | Visit http://becket.rujum.ai | Redirected to HTTPS | HIGH |
| F4 | Correct Supabase URL | Check network tab → API calls | Points to production Supabase, not localhost | HIGH |
| F5 | Vercel env vars set | Check Vercel dashboard | VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set | HIGH |
| F6 | No .env files in build | Check Vercel build output | No .env files bundled | HIGH |
| F7 | Error boundary | Navigate to /nonexistent | 404 or redirect, no crash | MEDIUM |

---

## PART 3: RLS POLICY VERIFICATION QUERIES

Run these in **Supabase SQL Editor** as the authenticated user (not service role) to verify data isolation:

```sql
-- TEST 1: Verify user can only see own family
SELECT id, name FROM families;
-- Expected: Only your family

-- TEST 2: Verify children isolation
SELECT id, name, family_id FROM children;
-- Expected: Only your children

-- TEST 3: Verify events isolation
SELECT id, title, family_id FROM events LIMIT 10;
-- Expected: Only your family's events

-- TEST 4: Verify invitations isolation
SELECT id, email, status, family_id FROM invitations;
-- Expected: Only invitations for your family or matching your email

-- TEST 5: Verify notifications isolation
SELECT id, type, recipient_id FROM notifications LIMIT 10;
-- Expected: Only where recipient_id = your user ID

-- TEST 6: Verify no one can INSERT notifications directly
INSERT INTO notifications (family_id, recipient_id, type, title)
VALUES ('some-uuid', 'some-uuid', 'test', 'hack');
-- Expected: REJECTED (INSERT policy is WITH CHECK (false))

-- TEST 7: Verify family member limit
-- (Run after family has 2 members)
INSERT INTO family_members (family_id, profile_id, parent_label, role)
VALUES ('your-family-id', 'random-uuid', 'dad', 'parent');
-- Expected: REJECTED by trigger (max 2 members)

-- TEST 8: Verify pending invite uniqueness
-- (Run when a pending invite exists)
INSERT INTO invitations (family_id, email, token, status)
VALUES ('your-family-id', 'test@test.com', 'test-token', 'pending');
-- Expected: REJECTED by unique index
```

---

## PART 4: SECURITY HARDENING CHECKLIST

### Before Launch
- [ ] Remove `databasepassword.txt` from git and history
- [ ] Rotate DB password in Supabase
- [ ] Rotate Google OAuth Client Secret
- [ ] Remove DEV_BYPASS code from useAuth.js
- [ ] Remove `VITE_DEV_BYPASS_AUTH` from .env.development
- [ ] Move localStorage sensitive data to sessionStorage/memory
- [ ] Wrap all console.log in `import.meta.env.DEV` check
- [ ] Verify edge function returns generic errors (not err.message)

### After Launch
- [ ] Set up error monitoring (Sentry or similar)
- [ ] Add Content-Security-Policy headers via Vercel config
- [ ] Add rate limiting to auth endpoints (Supabase dashboard)
- [ ] Set up database backup schedule
- [ ] Monitor for failed auth attempts
- [ ] Review RLS policies quarterly

---

## PART 5: DATABASE STATE VERIFICATION

Run before launch to ensure clean state:

```sql
-- Check for orphaned data
SELECT 'orphan_invites' as type, COUNT(*) FROM invitations
WHERE family_id NOT IN (SELECT id FROM families);

SELECT 'orphan_members' as type, COUNT(*) FROM family_members
WHERE family_id NOT IN (SELECT id FROM families);

SELECT 'orphan_children' as type, COUNT(*) FROM children
WHERE family_id NOT IN (SELECT id FROM families);

-- Check for duplicate pending invites (should be 0)
SELECT family_id, COUNT(*) as pending_count
FROM invitations
WHERE status = 'pending'
GROUP BY family_id
HAVING COUNT(*) > 1;

-- Check for overfull families (should be 0)
SELECT family_id, COUNT(*) as member_count
FROM family_members
GROUP BY family_id
HAVING COUNT(*) > 2;

-- Check for users in multiple families (should be 0)
SELECT profile_id, COUNT(*) as family_count
FROM family_members
GROUP BY profile_id
HAVING COUNT(*) > 1;

-- Check for stale test data
SELECT id, email, status, created_at
FROM invitations
ORDER BY created_at DESC
LIMIT 20;
```
