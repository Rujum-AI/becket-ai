<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'

const route = useRoute()
const router = useRouter()
const { user, isAuthenticated } = useAuth()
const { checkUserFamily } = useFamily()

const status = ref('loading') // 'loading', 'needsAuth', 'accepting', 'success', 'error', 'expired'
const invitation = ref(null)
const error = ref('')

const email = ref('')
const password = ref('')
const displayName = ref('')
const authMode = ref('login') // 'login' or 'signup'
const authLoading = ref(false)
const authError = ref('')

onMounted(async () => {
  const token = route.params.token
  if (!token) {
    status.value = 'error'
    error.value = 'Invalid invitation link'
    return
  }

  // Look up the invitation
  const { data, error: fetchError } = await supabase
    .from('invitations')
    .select('*, families(mode)')
    .eq('token', token)
    .single()

  if (fetchError || !data) {
    status.value = 'error'
    error.value = 'Invitation not found'
    return
  }

  if (data.status !== 'pending') {
    status.value = 'expired'
    error.value = data.status === 'accepted' ? 'This invitation has already been accepted' : 'This invitation is no longer valid'
    return
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    status.value = 'expired'
    error.value = 'This invitation has expired'
    return
  }

  invitation.value = data
  email.value = data.email || ''

  // If user is already logged in, try to accept directly
  if (isAuthenticated.value) {
    await acceptInvitation()
  } else {
    status.value = 'needsAuth'
  }
})

async function acceptInvitation() {
  status.value = 'accepting'

  try {
    const { data: result, error: rpcError } = await supabase
      .rpc('accept_pending_invitation', {
        p_user_id: user.value.id
      })

    if (rpcError) throw rpcError

    if (result?.accepted) {
      await checkUserFamily(user.value.id)
      status.value = 'success'
      setTimeout(() => router.push('/family'), 2000)
    } else {
      status.value = 'error'
      error.value = 'Could not accept invitation. Make sure you are using the email the invitation was sent to.'
    }
  } catch (err) {
    status.value = 'error'
    error.value = err.message
  }
}

async function handleAuth() {
  authError.value = ''
  authLoading.value = true

  try {
    if (authMode.value === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: { data: { display_name: displayName.value } }
      })
      if (signUpError) throw signUpError
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value
      })
      if (signInError) throw signInError
    }

    // After auth, user ref will be updated by onAuthStateChange
    // Wait briefly for it to propagate
    await new Promise(resolve => setTimeout(resolve, 500))

    if (user.value) {
      await acceptInvitation()
    } else {
      authError.value = 'Authentication succeeded but session not ready. Please try again.'
    }
  } catch (err) {
    authError.value = err.message
  } finally {
    authLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-warm-linen p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <img src="/assets/becket_logo.png" alt="Becket AI" class="h-16 mx-auto mb-4">
        <h1 class="text-3xl font-serif font-bold text-slate-900">Becket AI</h1>
      </div>

      <div class="bg-white rounded-3xl p-8 shadow-lg border border-slate-100">
        <!-- Loading -->
        <div v-if="status === 'loading'" class="text-center py-8">
          <div class="animate-spin w-8 h-8 border-3 border-slate-200 border-t-rust-orange rounded-full mx-auto mb-4"></div>
          <p class="text-slate-500 text-sm">Verifying invitation...</p>
        </div>

        <!-- Accepting -->
        <div v-else-if="status === 'accepting'" class="text-center py-8">
          <div class="animate-spin w-8 h-8 border-3 border-slate-200 border-t-rust-orange rounded-full mx-auto mb-4"></div>
          <p class="text-slate-500 text-sm">Joining family...</p>
        </div>

        <!-- Success -->
        <div v-else-if="status === 'success'" class="text-center py-8">
          <div class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-slate-900 mb-2">Welcome to the Family!</h2>
          <p class="text-slate-500 text-sm">Redirecting you to the app...</p>
        </div>

        <!-- Error / Expired -->
        <div v-else-if="status === 'error' || status === 'expired'" class="text-center py-8">
          <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-slate-900 mb-2">{{ status === 'expired' ? 'Invitation Expired' : 'Something Went Wrong' }}</h2>
          <p class="text-slate-500 text-sm mb-6">{{ error }}</p>
          <button
            @click="$router.push('/login')"
            class="bg-rust-orange text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity"
          >
            Go to Login
          </button>
        </div>

        <!-- Needs Auth -->
        <div v-else-if="status === 'needsAuth'">
          <h2 class="text-xl font-bold text-slate-900 mb-2">You've Been Invited!</h2>
          <p class="text-slate-500 text-sm mb-6">
            {{ authMode === 'login' ? 'Sign in to accept the invitation.' : 'Create an account to join your family.' }}
          </p>

          <form @submit.prevent="handleAuth" class="space-y-4">
            <div v-if="authMode === 'signup'">
              <label class="block text-sm font-bold text-slate-700 mb-2">Name</label>
              <input
                v-model="displayName"
                type="text"
                required
                class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rust-orange"
                placeholder="Your name"
              >
            </div>

            <div>
              <label class="block text-sm font-bold text-slate-700 mb-2">Email</label>
              <input
                v-model="email"
                type="email"
                required
                class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rust-orange"
                placeholder="you@example.com"
              >
            </div>

            <div>
              <label class="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <input
                v-model="password"
                type="password"
                required
                minlength="6"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rust-orange"
                placeholder="••••••••"
              >
            </div>

            <div v-if="authError" class="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
              {{ authError }}
            </div>

            <button
              type="submit"
              :disabled="authLoading"
              class="w-full bg-rust-orange text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {{ authLoading ? 'Loading...' : authMode === 'login' ? 'Sign In & Accept' : 'Sign Up & Accept' }}
            </button>
          </form>

          <div class="mt-6 text-center">
            <button
              @click="authMode = authMode === 'login' ? 'signup' : 'login'"
              class="text-sm text-slate-500 hover:text-rust-orange transition-colors"
            >
              {{ authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-warm-linen {
  background-color: #FAF6F1;
}

.border-3 {
  border-width: 3px;
}

.border-t-rust-orange {
  border-top-color: #C2571A;
}
</style>
