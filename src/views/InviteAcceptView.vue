<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'
import { useI18n } from '@/composables/useI18n'

const route = useRoute()
const router = useRouter()
const { user, isAuthenticated } = useAuth()
const { checkUserFamily } = useFamily()
const { t, lang, toggleLang } = useI18n()

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
    error.value = t('invite_invalidLink')
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
    error.value = t('invite_notFound')
    return
  }

  if (data.status !== 'pending') {
    status.value = 'expired'
    error.value = data.status === 'accepted' ? t('invite_alreadyAccepted') : t('invite_noLongerValid')
    return
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    status.value = 'expired'
    error.value = t('invite_expiredMsg')
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
      error.value = t('invite_emailMismatch')
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

async function handleGoogleSignIn() {
  authError.value = ''
  authLoading.value = true

  try {
    // Redirect back to this invite page after Google auth
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href
      }
    })
    if (oauthError) throw oauthError
  } catch (err) {
    authError.value = err.message
    authLoading.value = false
  }
}
</script>

<template>
  <div class="invite-page">
    <div class="invite-container">
      <!-- Language Toggle -->
      <button class="lang-toggle" @click="toggleLang">
        {{ lang === 'en' ? 'עברית' : 'English' }}
      </button>

      <!-- Logo -->
      <div class="logo-section">
        <img src="/assets/becket_logo.png" alt="Becket AI" class="logo">
        <h1 class="app-title">Becket AI</h1>
      </div>

      <div class="form-card">
        <!-- Loading -->
        <div v-if="status === 'loading'" class="status-view">
          <div class="spinner"></div>
          <p class="status-text">{{ t('invite_verifying') }}</p>
        </div>

        <!-- Accepting -->
        <div v-else-if="status === 'accepting'" class="status-view">
          <div class="spinner"></div>
          <p class="status-text">{{ t('invite_joining') }}</p>
        </div>

        <!-- Success -->
        <div v-else-if="status === 'success'" class="status-view">
          <div class="status-icon success-icon">
            <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 class="status-heading">{{ t('invite_welcomeFamily') }}</h2>
          <p class="status-text">{{ t('invite_redirecting') }}</p>
        </div>

        <!-- Error / Expired -->
        <div v-else-if="status === 'error' || status === 'expired'" class="status-view">
          <div class="status-icon error-icon">
            <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <h2 class="status-heading">{{ status === 'expired' ? t('invite_expired') : t('invite_error') }}</h2>
          <p class="status-text error-detail">{{ error }}</p>
          <button @click="$router.push('/login')" class="action-btn">
            {{ t('invite_goToLogin') }}
          </button>
        </div>

        <!-- Needs Auth -->
        <div v-else-if="status === 'needsAuth'">
          <h2 class="form-title">{{ t('invite_title') }}</h2>
          <p class="form-subtitle">
            {{ authMode === 'login' ? t('invite_signInToAccept') : t('invite_signUpToAccept') }}
          </p>

          <!-- Google Sign In -->
          <button
            type="button"
            @click="handleGoogleSignIn"
            :disabled="authLoading"
            class="google-btn"
          >
            <svg class="google-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {{ t('login_googleContinue') }}
          </button>

          <!-- Divider -->
          <div class="divider">
            <span>{{ t('login_orEmail') }}</span>
          </div>

          <form @submit.prevent="handleAuth" class="auth-form">
            <div v-if="authMode === 'signup'" class="form-field">
              <label>{{ t('login_name') }}</label>
              <input
                v-model="displayName"
                type="text"
                required
                :placeholder="t('login_namePlaceholder')"
              >
            </div>

            <div class="form-field">
              <label>{{ t('login_email') }}</label>
              <input
                v-model="email"
                type="email"
                required
                :placeholder="t('login_emailPlaceholder')"
              >
            </div>

            <div class="form-field">
              <label>{{ t('login_password') }}</label>
              <input
                v-model="password"
                type="password"
                required
                minlength="6"
                placeholder="••••••••"
              >
            </div>

            <div v-if="authError" class="message error">
              {{ authError }}
            </div>

            <button
              type="submit"
              :disabled="authLoading"
              class="submit-btn"
            >
              {{ authLoading ? t('login_loading') : authMode === 'login' ? t('invite_signInAccept') : t('invite_signUpAccept') }}
            </button>
          </form>

          <div class="toggle-mode">
            <button @click="authMode = authMode === 'login' ? 'signup' : 'login'">
              {{ authMode === 'login' ? t('login_noAccount') : t('login_hasAccount') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invite-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--warm-linen, #FDFBF7);
  padding: 2rem;
  position: relative;
}

.invite-container {
  width: 100%;
  max-width: 28rem;
}

/* Language toggle */
.lang-toggle {
  position: fixed;
  top: 1rem;
  right: 1rem;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #64748b;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 2rem;
  padding: 0.375rem 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
}

[dir="rtl"] .lang-toggle {
  right: auto;
  left: 1rem;
}

.lang-toggle:hover {
  color: var(--rust-orange, #BD5B39);
  border-color: var(--rust-orange, #BD5B39);
}

/* Logo */
.logo-section {
  text-align: center;
  margin-bottom: 2rem;
}

.logo {
  height: 4rem;
  margin: 0 auto 1rem auto;
  display: block;
}

.app-title {
  font-family: 'Fraunces', serif;
  font-size: 2rem;
  font-weight: 800;
  color: var(--deep-slate, #1A1C1E);
  margin: 0;
  letter-spacing: -0.02em;
}

/* Card */
.form-card {
  background: white;
  border-radius: 1.5rem;
  padding: 2.5rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
}

/* Status views */
.status-view {
  text-align: center;
  padding: 2rem 0;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e2e8f0;
  border-top: 3px solid var(--rust-orange, #BD5B39);
  border-radius: 50%;
  margin: 0 auto 1rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-text {
  font-size: 0.875rem;
  color: #94a3b8;
  font-weight: 600;
  margin: 0;
}

.status-heading {
  font-family: 'Fraunces', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--deep-slate, #1A1C1E);
  margin: 0 0 0.5rem;
}

.status-icon {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.success-icon {
  background: #f0fdf4;
}

.success-icon .icon-svg {
  width: 2rem;
  height: 2rem;
  color: #22c55e;
}

.error-icon {
  background: #fef2f2;
}

.error-icon .icon-svg {
  width: 2rem;
  height: 2rem;
  color: #ef4444;
}

.error-detail {
  margin-bottom: 1.5rem;
}

.action-btn {
  background: var(--rust-orange, #BD5B39);
  color: white;
  font-weight: 700;
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
  font-size: 0.875rem;
}

.action-btn:hover {
  opacity: 0.9;
}

/* Auth form (matches LoginView) */
.form-title {
  font-family: 'Fraunces', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--deep-slate, #1A1C1E);
  margin: 0 0 0.5rem;
  text-align: center;
}

.form-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.5rem;
  text-align: center;
}

.google-btn {
  width: 100%;
  background: white;
  color: #334155;
  font-weight: 700;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.google-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.google-btn:hover:not(:disabled) {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.google-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.divider {
  position: relative;
  margin: 1.5rem 0;
  text-align: center;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e2e8f0;
}

.divider span {
  position: relative;
  background: white;
  padding: 0 1rem;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 600;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #334155;
  text-align: start;
}

.form-field input {
  width: 100%;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: 2px solid #e2e8f0;
  background: white;
  font-size: 0.9375rem;
  transition: all 0.2s;
  text-align: start;
  box-sizing: border-box;
}

.form-field input:focus {
  outline: none;
  border-color: var(--rust-orange, #BD5B39);
  box-shadow: 0 0 0 3px rgba(189, 91, 57, 0.1);
}

.message.error {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #fecaca;
  text-align: start;
}

.submit-btn {
  width: 100%;
  background: var(--rust-orange, #BD5B39);
  color: white;
  font-weight: 700;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9375rem;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(189, 91, 57, 0.3);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.toggle-mode {
  margin-top: 1.5rem;
  text-align: center;
  padding-top: 1.5rem;
  border-top: 1px solid #f1f5f9;
}

.toggle-mode button {
  font-size: 0.875rem;
  color: #64748b;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
}

.toggle-mode button:hover {
  color: var(--rust-orange, #BD5B39);
}

/* Mobile */
@media (max-width: 640px) {
  .invite-page {
    padding: 1rem;
  }

  .form-card {
    padding: 2rem 1.5rem;
  }

  .form-title {
    font-size: 1.25rem;
  }

  .logo {
    height: 3rem;
  }

  .app-title {
    font-size: 1.75rem;
  }
}
</style>
