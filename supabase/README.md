# Becket AI - Supabase Setup

## Migrations

Run these migrations in order in your Supabase SQL Editor:

1. **001_core_tables.sql** - Profiles, Families, Children, Invitations
2. **002_custody_and_events.sql** - Custody Cycles, Events, Event Children
3. **003_trustees.sql** - Schools, Activities, People, Schedules
4. **004_handoffs_items.sql** - Handoffs, Items, Item History
5. **005_tasks_understandings_expenses.sql** - Tasks, Understandings, Expenses
6. **006_notifications_media.sql** - Snapshots, Notifications, Activity Log, Documents
7. **007_functions.sql** - Database functions and triggers

## How to Run

### Option 1: Via Supabase Dashboard (Recommended for now)

1. Go to https://supabase.com/dashboard
2. Select your project: `ftgigazyrusqgjxwupho`
3. Go to SQL Editor (left sidebar)
4. Create a new query
5. Copy/paste the content of `001_core_tables.sql`
6. Click "Run"
7. Repeat for migrations 002-007 in order

### Option 2: Via Supabase CLI (after installing it)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref ftgigazyrusqgjxwupho

# Push migrations
supabase db push
```

## Storage Buckets

After running migrations, create storage buckets:

1. Go to Storage in Supabase dashboard
2. Create three buckets:
   - `avatars` (public)
   - `snapshots` (private, with RLS)
   - `documents` (private, with RLS)

### Storage RLS Policies

Run these in SQL Editor after creating buckets:

```sql
-- Avatars bucket (public read)
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Snapshots bucket (family-scoped)
CREATE POLICY "Family can view snapshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'snapshots' AND
    (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );

CREATE POLICY "Family can upload snapshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'snapshots' AND
    (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );

-- Documents bucket (family-scoped)
CREATE POLICY "Family can view documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );

CREATE POLICY "Family can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1]::uuid IN (SELECT user_family_ids())
  );
```

## Scheduled Jobs (Optional - for production)

These will be set up later via pg_cron when deploying to production:

- **Check missed pickups**: Every 5 minutes
- **Cleanup item history**: Daily at 3am
- **Cleanup notifications**: Daily at 3am
- **Refresh budget cache**: Hourly

For now, these functions exist but are not scheduled automatically.

## Next Steps

After migrations are complete:

1. Test authentication (sign up/login should auto-create profile)
2. Create a test family via the app
3. Verify RLS policies work (can only see own family data)
4. Wire up frontend stores to Supabase queries
