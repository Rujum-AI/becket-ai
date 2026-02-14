import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

const user = ref(null)
const session = ref(null)
const loading = ref(true)

export function useAuth() {
  const isAuthenticated = computed(() => !!session.value)

  // Initialize auth state
  async function initAuth() {
    loading.value = true
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      session.value = currentSession
      user.value = currentSession?.user ?? null
    } catch (error) {
      console.error('Error initializing auth:', error)
    } finally {
      loading.value = false
    }
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, newSession) => {
    console.log('🔐 Auth state change:', event, newSession)
    session.value = newSession
    user.value = newSession?.user ?? null
    loading.value = false
  })

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
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/family`
      }
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
    getUserProfile
  }
}
