import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

const user = ref(null)
const session = ref(null)
const loading = ref(true)

// Dev-only auth bypass — only active when BOTH conditions are true
export const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

const DEV_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@becket.local',
  user_metadata: { display_name: 'Dev User' },
  app_metadata: {},
  aud: 'authenticated',
  role: 'authenticated'
}

const DEV_SESSION = {
  access_token: 'dev-bypass-token',
  refresh_token: 'dev-bypass-refresh',
  expires_in: 999999,
  token_type: 'bearer',
  user: DEV_USER
}

export function useAuth() {
  const isAuthenticated = computed(() => !!session.value)

  // Initialize auth state
  async function initAuth() {
    loading.value = true
    try {
      if (DEV_BYPASS) {
        console.warn('⚠️ DEV AUTH BYPASS ACTIVE — using mock user')
        session.value = DEV_SESSION
        user.value = DEV_USER
        loading.value = false
        return
      }
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      session.value = currentSession
      user.value = currentSession?.user ?? null
    } catch (error) {
      console.error('Error initializing auth:', error)
    } finally {
      loading.value = false
    }
  }

  // Listen for auth changes (skip in dev bypass — mock user must not be overwritten)
  if (!DEV_BYPASS) {
    supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('🔐 Auth state change:', event, newSession)
      session.value = newSession
      user.value = newSession?.user ?? null
      loading.value = false
    })
  }

  // Sign up
  async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    })

    if (error) throw error
    return data
  }

  // Sign in
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    return data
  }

  // Sign in with Google
  async function signInWithGoogle() {
    if (DEV_BYPASS) {
      session.value = DEV_SESSION
      user.value = DEV_USER
      return DEV_SESSION
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    })

    if (error) throw error
    return data
  }

  // Send password reset email
  async function resetPassword(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
    return data
  }

  // Update password (after clicking reset link)
  async function updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })
    if (error) throw error
    return data
  }

  // Sign out
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    user.value = null
    session.value = null
  }

  // Get current user profile
  async function getUserProfile() {
    if (!user.value) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()

    if (error) throw error
    return data
  }

  return {
    user,
    session,
    loading,
    isAuthenticated,
    initAuth,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    getUserProfile
  }
}
