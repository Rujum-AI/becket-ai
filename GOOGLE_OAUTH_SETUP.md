# Google OAuth Setup for Becket AI

## Step 1: Enable Google Provider in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ftgigazyrusqgjxwupho
2. Click **Authentication** in the left sidebar
3. Click **Providers** tab
4. Find **Google** in the list
5. Toggle it **ON**
6. You'll see two fields:
   - **Authorized Client IDs** (optional for now)
   - **Skip nonce check** (leave unchecked)

## Step 2: Get Google OAuth Credentials

### Quick Start (For Development)

Supabase provides a quick setup for development:

1. In the Google provider settings, you'll see a **"Use Supabase's Google OAuth credentials"** option
2. Enable this for quick testing
3. Add authorized redirect URL: `https://ftgigazyrusqgjxwupho.supabase.co/auth/v1/callback`
4. Click **Save**

**Done!** You can now test Google OAuth immediately.

---

### Production Setup (When Ready)

For production, you'll need your own Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure consent screen:
   - User Type: External
   - App name: Becket AI
   - User support email: your email
   - Developer contact: your email
6. Create OAuth Client ID:
   - Application type: Web application
   - Name: Becket AI Web
   - Authorized redirect URIs:
     - `https://ftgigazyrusqgjxwupho.supabase.co/auth/v1/callback`
     - `http://localhost:5173/family` (for local testing)
7. Copy **Client ID** and **Client Secret**
8. Paste them into Supabase Google provider settings
9. Click **Save**

## Step 3: Test It

1. Refresh your app: http://localhost:5173
2. You should see "Continue with Google" button
3. Click it
4. Select your Google account
5. Grant permissions
6. You should be redirected to `/family` and logged in!

## What Happens on Google Sign-In

1. User clicks "Continue with Google"
2. Redirected to Google consent screen
3. After approval, Google redirects back to Supabase with auth code
4. Supabase creates:
   - User in `auth.users`
   - Profile in `profiles` (via trigger)
   - Email and name come from Google automatically
5. Session created and stored
6. User redirected to `/family`

## Verify It Worked

After signing in with Google, check in Supabase Dashboard:

1. Go to **Authentication** → **Users**
2. You should see your Google account listed
3. Go to **Table Editor** → **profiles**
4. You should see a profile with:
   - `id` matching the auth user
   - `email` from your Google account
   - `display_name` from your Google name

Perfect! ✅
