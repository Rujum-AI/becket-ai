<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'
import { useI18n } from '@/composables/useI18n'

const route = useRoute()
const router = useRouter()
const { user, isAuthenticated, signOut } = useAuth()
const { checkUserFamily } = useFamily()
const { t, lang, toggleLang } = useI18n()

// === Core State ===
const status = ref('loading') // 'loading' | 'needsAuth' | 'onboarding' | 'accepting' | 'success' | 'error' | 'expired'
const invitation = ref(null)
const error = ref('')

// === Auth State ===
const email = ref('')
const password = ref('')
const displayName = ref('')
const authMode = ref('login') // 'login' or 'signup'
const authLoading = ref(false)
const authError = ref('')

// === Onboarding State ===
const onboardingStep = ref(1) // 1 = welcome + name + role, 2 = review + accept
const parentRole = ref('')
const direction = ref('forward')

// === Header dropdown ===
const isUserMenuOpen = ref(false)

const avatarUrl = computed(() => {
  if (!user.value) return '/assets/profile/king_profile.png'
  return user.value.user_metadata?.avatar_url || '/assets/profile/king_profile.png'
})

function toggleUserMenu() {
  isUserMenuOpen.value = !isUserMenuOpen.value
}

function closeUserMenu() {
  isUserMenuOpen.value = false
}

function setLang(targetLang) {
  if (lang.value !== targetLang) {
    toggleLang()
  }
}

async function handleLogout() {
  await signOut()
  router.push('/')
}

// Close dropdown when clicking outside
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-container')) {
      closeUserMenu()
    }
  })
}

// === Computed ===
const agreementDisplay = computed(() => {
  const map = { formal: 'agree1', verbal: 'agree2', building: 'agree3' }
  const key = map[invitation.value?.agreement_basis]
  return key ? t(key) : invitation.value?.agreement_basis || ''
})

const relationshipDisplay = computed(() => {
  const s = invitation.value?.relationship_status
  if (s === 'together' || s === 'apart' || s === 'separated') return t(s)
  return s || ''
})

const homesDisplay = computed(() => {
  return invitation.value?.home_count === 1 ? t('singleHome') : t('dualHome')
})

const currencyDisplay = computed(() => {
  const c = invitation.value?.currency
  const map = { NIS: '₪ NIS', USD: '$ USD', EUR: '€ EUR', SGD: 'S$ SGD' }
  return map[c] || c || ''
})

const canProceedStep1 = computed(() => {
  return displayName.value.trim() && parentRole.value
})

// Show bottom bar only during onboarding steps
const showBottomBar = computed(() => status.value === 'onboarding')

// === Lifecycle ===
onMounted(async () => {
  const token = route.params.token
  if (!token) {
    status.value = 'error'
    error.value = t('invite_invalidLink')
    return
  }

  // RPC bypasses RLS — works for unauthenticated users
  const { data, error: fetchError } = await supabase
    .rpc('lookup_invitation_by_token', { p_token: token })

  if (fetchError || !data) {
    status.value = 'error'
    error.value = t('invite_notFound')
    return
  }

  if (data.status !== 'pending') {
    status.value = 'expired'
    error.value = data.status === 'accepted'
      ? t('invite_alreadyAccepted')
      : t('invite_noLongerValid')
    return
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    status.value = 'expired'
    error.value = t('invite_expiredMsg')
    return
  }

  invitation.value = data
  email.value = data.email || ''

  // If already logged in, go to onboarding
  if (isAuthenticated.value) {
    prefillFromUser()
    status.value = 'onboarding'
  } else {
    status.value = 'needsAuth'
  }
})

function prefillFromUser() {
  const meta = user.value?.user_metadata
  displayName.value = meta?.full_name || meta?.display_name || displayName.value || ''
}

// === Onboarding navigation ===
function nextOnboardingStep() {
  direction.value = 'forward'
  onboardingStep.value = 2
}

function prevOnboardingStep() {
  direction.value = 'backward'
  onboardingStep.value = 1
}

// === Auth ===
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

    // Wait for auth state to propagate
    await new Promise(resolve => setTimeout(resolve, 500))

    if (user.value) {
      prefillFromUser()
      status.value = 'onboarding'
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
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    })
    if (oauthError) throw oauthError
  } catch (err) {
    authError.value = err.message
    authLoading.value = false
  }
}

// === Accept Invitation ===
async function acceptInvitation() {
  status.value = 'accepting'

  try {
    const { data: result, error: rpcError } = await supabase
      .rpc('accept_pending_invitation', {
        p_user_id: user.value.id,
        p_parent_label: parentRole.value || null,
        p_display_name: displayName.value.trim() || null
      })

    if (rpcError) throw rpcError

    if (result?.accepted) {
      // Also update auth user metadata
      if (displayName.value.trim()) {
        await supabase.auth.updateUser({
          data: { display_name: displayName.value.trim() }
        })
      }

      if (result.reason === 'already_member') {
        status.value = 'success'
        setTimeout(() => router.push('/family'), 1500)
        return
      }

      await checkUserFamily(user.value.id)
      status.value = 'success'
      setTimeout(() => router.push('/family'), 2000)
    } else {
      status.value = 'error'
      if (result?.reason === 'no_pending_invitation') {
        error.value = t('invite_emailMismatch')
      } else if (result?.reason === 'family_full') {
        error.value = t('familyFull')
      } else {
        error.value = result?.reason || t('invite_error')
      }
    }
  } catch (err) {
    status.value = 'error'
    error.value = err.message
  }
}
</script>

<template>
  <div class="onboarding-container">
    <!-- ===== HEADER (always visible) ===== -->
    <header class="onboarding-header">
      <div class="header-left">
        <span class="header-title">Becket AI</span>
      </div>

      <div class="header-right">
        <!-- Profile dropdown (only when logged in) -->
        <div v-if="isAuthenticated" class="profile-container" @click.stop>
          <div class="profile-ring" @click="toggleUserMenu">
            <img :src="avatarUrl" referrerpolicy="no-referrer">
          </div>

          <Transition name="pop">
            <div v-if="isUserMenuOpen" class="user-dropdown">
              <div class="dropdown-item justify-between cursor-default hover-none">
                <div class="dropdown-lang-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                </div>
                <div class="lang-toggle-group">
                  <span class="lang-option" :class="{ active: lang === 'en' }" @click.stop="setLang('en')">English</span>
                  <span class="lang-divider">|</span>
                  <span class="lang-option" :class="{ active: lang === 'he' }" @click.stop="setLang('he')">עברית</span>
                </div>
              </div>

              <div class="dropdown-item danger" @click="handleLogout">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                {{ t('logout') }}
              </div>
            </div>
          </Transition>
        </div>

        <!-- Language toggle (when not logged in) -->
        <button v-else class="header-lang-btn" @click="toggleLang">
          {{ lang === 'en' ? 'עברית' : 'English' }}
        </button>
      </div>
    </header>

    <!-- ===== MAIN CONTENT ===== -->
    <main class="onboarding-main">
      <Transition :name="direction === 'forward' ? 'slide-left' : 'slide-right'" mode="out-in">

        <!-- LOADING -->
        <div v-if="status === 'loading'" key="loading" class="step-content center-content">
          <div class="spinner"></div>
          <p class="status-text">{{ t('invite_verifying') }}</p>
        </div>

        <!-- ACCEPTING -->
        <div v-else-if="status === 'accepting'" key="accepting" class="step-content center-content">
          <div class="spinner"></div>
          <p class="status-text">{{ t('invite_joining') }}</p>
        </div>

        <!-- SUCCESS -->
        <div v-else-if="status === 'success'" key="success" class="step-content center-content">
          <div class="status-icon success-icon">
            <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 class="step-title">{{ t('invite_welcomeFamily') }}</h2>
          <p class="status-text">{{ t('invite_redirecting') }}</p>
        </div>

        <!-- ERROR / EXPIRED -->
        <div v-else-if="status === 'error' || status === 'expired'" key="error" class="step-content center-content">
          <div class="status-icon error-icon">
            <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <h2 class="step-title">{{ status === 'expired' ? t('invite_expired') : t('invite_error') }}</h2>
          <p class="status-text error-detail">{{ error }}</p>
          <button @click="$router.push('/')" class="modal-primary-btn" style="background: #BD5B39; margin-top: 1.5rem;">
            {{ t('invite_goToLogin') }}
          </button>
        </div>

        <!-- NEEDS AUTH -->
        <div v-else-if="status === 'needsAuth'" key="auth" class="step-content">
          <div class="step-header">
            <img src="/assets/becket_logo.png" alt="Becket AI" class="welcome-logo">
            <h2 class="step-title">{{ t('invite_title') }}</h2>
            <p class="step-subtitle">
              {{ authMode === 'login' ? t('invite_signInToAccept') : t('invite_signUpToAccept') }}
            </p>
          </div>

          <!-- Inviter info banner -->
          <div v-if="invitation" class="inviter-banner">
            <p class="inviter-text">
              {{ t('invite_welcomeMsg').replace('{inviter}', invitation.inviter_name) }}
            </p>
          </div>

          <div class="auth-card">
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

              <div v-if="authError" class="error-banner">
                {{ authError }}
              </div>

              <button
                type="submit"
                :disabled="authLoading"
                class="modal-primary-btn"
                style="background: #BD5B39"
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

        <!-- ONBOARDING STEP 1: Welcome + Name + Role -->
        <div v-else-if="status === 'onboarding' && onboardingStep === 1" key="onb-1" class="step-content">
          <div class="step-header">
            <h2 class="step-title">{{ t('invite_welcomeTitle') }}</h2>
            <p class="step-subtitle">
              {{ t('invite_welcomeMsg').replace('{inviter}', invitation?.inviter_name || '') }}
            </p>
          </div>

          <!-- Children Preview -->
          <div v-if="invitation?.children?.length" class="children-preview">
            <p class="section-label">{{ t('invite_yourChildren') }}</p>
            <div class="children-row">
              <div v-for="child in invitation.children" :key="child.name" class="child-preview-card">
                <img
                  :src="child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'"
                  :alt="child.name"
                  class="child-thumb"
                />
                <span class="child-name">{{ child.name }}</span>
              </div>
            </div>
          </div>

          <!-- Display Name -->
          <div class="form-section">
            <label class="input-label">{{ t('onb_yourName') }}</label>
            <input
              v-model="displayName"
              type="text"
              class="form-input"
              :placeholder="t('onb_namePlaceholder')"
            />
          </div>

          <!-- Role Picker -->
          <div class="role-section">
            <label class="section-label text-center">{{ t('chooseRole') }}</label>
            <div class="role-buttons">
              <button
                @click="parentRole = 'dad'"
                :class="['role-btn', { active: parentRole === 'dad' }]"
              >
                <img src="/assets/profile/king_profile.png" alt="Dad" class="role-img" />
                <span class="role-label">{{ t('iAmDad') }}</span>
              </button>
              <button
                @click="parentRole = 'mom'"
                :class="['role-btn', { active: parentRole === 'mom' }]"
              >
                <img src="/assets/profile/queen_profile.png" alt="Mom" class="role-img" />
                <span class="role-label">{{ t('iAmMom') }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- ONBOARDING STEP 2: Review Family Settings -->
        <div v-else-if="status === 'onboarding' && onboardingStep === 2" key="onb-2" class="step-content">
          <div class="step-header">
            <h2 class="step-title">{{ t('invite_reviewTitle') }}</h2>
            <p class="step-subtitle">{{ t('invite_reviewSub') }}</p>
          </div>

          <div class="review-cards">
            <div class="review-item">
              <span class="review-label">{{ t('invite_homesLabel') }}</span>
              <span class="review-value">{{ homesDisplay }}</span>
            </div>
            <div class="review-item">
              <span class="review-label">{{ t('invite_relationshipLabel') }}</span>
              <span class="review-value">{{ relationshipDisplay }}</span>
            </div>
            <div class="review-item">
              <span class="review-label">{{ t('invite_agreementLabel') }}</span>
              <span class="review-value">{{ agreementDisplay }}</span>
            </div>
            <div class="review-item">
              <span class="review-label">{{ t('invite_currencyLabel') }}</span>
              <span class="review-value">{{ currencyDisplay }}</span>
            </div>
          </div>
        </div>

      </Transition>
    </main>

    <!-- ===== FIXED BOTTOM BAR (only during onboarding) ===== -->
    <div v-if="showBottomBar" class="bottom-bar">
      <div class="progress-dots">
        <span :class="['dot', { active: onboardingStep === 1, completed: onboardingStep > 1 }]"></span>
        <span :class="['dot', { active: onboardingStep === 2 }]"></span>
      </div>
      <div class="bottom-actions" :class="{ 'single-btn': onboardingStep === 1 }">
        <button v-if="onboardingStep > 1" @click="prevOnboardingStep"
          class="modal-primary-btn onb-back-btn" style="background: #0d9488">
          {{ t('onb_back') }}
        </button>

        <!-- Step 1: Next -->
        <button v-if="onboardingStep === 1" @click="nextOnboardingStep" :disabled="!canProceedStep1"
          class="modal-primary-btn" style="background: #BD5B39">
          {{ t('onb_next') }}
        </button>
        <!-- Step 2: Accept & Join -->
        <button v-else @click="acceptInvitation"
          class="modal-primary-btn" style="background: #BD5B39">
          {{ t('invite_acceptJoin') }}
        </button>
      </div>
    </div>

    <!-- ===== COPYRIGHT BAR (always visible) ===== -->
    <div class="copyright-bar">All rights reserved to Rujum 2026 &copy;</div>
  </div>
</template>

<style scoped>
/* ============================================================
   FULL-PAGE LAYOUT (matches OnboardingView)
   ============================================================ */

.onboarding-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--warm-linen, #FDFBF7);
  display: flex;
  flex-direction: column;
}

/* === HEADER === */
.onboarding-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: clamp(44px, 12vw, 56px);
  padding: 0 clamp(12px, 3vw, 24px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 2000;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  direction: ltr;
  flex-shrink: 0;
}

.header-left {
  display: grid;
  line-height: 1.1;
  gap: 1px;
}

.header-title {
  font-family: 'Fraunces', serif;
  font-weight: 700;
  font-size: clamp(1.25rem, 5vw, 1.7rem);
  color: #1e293b;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: clamp(6px, 2vw, 12px);
  flex-shrink: 0;
}

/* Header language button (when not logged in) */
.header-lang-btn {
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
}

.header-lang-btn:hover {
  color: var(--rust-orange, #BD5B39);
  border-color: var(--rust-orange, #BD5B39);
}

/* Profile dropdown */
.profile-container { position: relative; }

.profile-ring {
  width: clamp(30px, 9vw, 42px);
  height: clamp(30px, 9vw, 42px);
  border-radius: 50%;
  background: #fff;
  padding: 1.5px;
  border: 1.5px solid rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.profile-ring img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.user-dropdown {
  position: absolute;
  top: calc(clamp(30px, 9vw, 42px) + 8px);
  right: 0;
  width: 220px;
  background: white;
  border-radius: 1.5rem;
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.2);
  padding: 0.75rem;
  z-index: 2100;
  transform-origin: top right;
  border: 1px solid #f1f5f9;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  color: #334155;
}

.dropdown-item:hover { background-color: #f8fafc; }
.dropdown-item.hover-none:hover { background-color: transparent; cursor: default; }

.dropdown-item.danger {
  color: #dc2626;
  margin-top: 0.25rem;
  border-top: 1px solid #f1f5f9;
  padding-top: 0.75rem;
}

.dropdown-item.danger:hover { background-color: #fef2f2; }
.dropdown-item.justify-between { justify-content: space-between; }

.dropdown-lang-icon {
  display: flex;
  align-items: center;
  color: #64748b;
}

.lang-toggle-group {
  display: flex;
  gap: 0.25rem;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.lang-option {
  cursor: pointer;
  transition: color 0.2s;
  color: #94a3b8;
  font-weight: 500;
}

.lang-option:hover { color: #64748b; }

.lang-option.active {
  font-weight: 900;
  color: #1e293b;
}

.lang-divider { color: #cbd5e1; }

/* Dropdown pop transition */
.pop-enter-active { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.pop-leave-active { transition: all 0.15s ease-in; }
.pop-enter-from { opacity: 0; transform: scale(0.9) translateY(-4px); }
.pop-leave-to { opacity: 0; transform: scale(0.95) translateY(-2px); }

/* === MAIN CONTENT === */
.onboarding-main {
  flex: 1;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  padding-bottom: 168px;
}

.step-content { width: 100%; }

.center-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 40vh;
}

/* === STEP HEADER === */
.step-header {
  text-align: center;
  margin-bottom: 2rem;
}

.step-title {
  font-size: 1.75rem;
  font-family: 'Fraunces', serif;
  font-weight: 800;
  margin-bottom: 0.5rem;
  color: var(--deep-slate, #1A1C1E);
  line-height: 1.2;
}

.step-subtitle {
  font-size: 1rem;
  color: #64748b;
  max-width: 400px;
  margin: 0 auto;
  line-height: 1.5;
}

/* === STATUS VIEWS (loading, success, error) === */
.spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid #e2e8f0;
  border-top: 3px solid var(--rust-orange, #BD5B39);
  border-radius: 50%;
  margin-bottom: 1.5rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-text {
  font-size: 1rem;
  color: #94a3b8;
  font-weight: 600;
  margin: 0;
}

.status-icon {
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.success-icon { background: #f0fdf4; }
.success-icon .icon-svg { width: 2.5rem; height: 2.5rem; color: #22c55e; }
.error-icon { background: #fef2f2; }
.error-icon .icon-svg { width: 2.5rem; height: 2.5rem; color: #ef4444; }
.error-detail { margin-bottom: 0.5rem; }

/* === AUTH SCREEN (needsAuth) === */
.welcome-logo {
  height: 3rem;
  margin: 0 auto 1rem;
  display: block;
  opacity: 0.2;
}

.inviter-banner {
  background: #fffbeb;
  border: 2px solid #fcd34d;
  border-radius: 1rem;
  padding: 0.875rem 1.25rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.inviter-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #92400e;
  margin: 0;
  line-height: 1.4;
}

.auth-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1.25rem;
  padding: 1.5rem;
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
  gap: 1rem;
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

.error-banner {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
}

.toggle-mode {
  margin-top: 1.25rem;
  text-align: center;
  padding-top: 1.25rem;
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

/* === ONBOARDING: CHILDREN PREVIEW === */
.children-preview {
  margin-bottom: 2rem;
}

.children-row {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.child-preview-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.child-thumb {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  object-fit: contain;
  border: 3px solid #e2e8f0;
  padding: 0.25rem;
  background: white;
  transition: all 0.2s;
}

.child-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #334155;
}

/* === FORM ELEMENTS === */
.form-section {
  margin-bottom: 2rem;
  text-align: center;
}

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 0.75rem;
  font-size: 1rem;
  background: white;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #BD5B39;
}

.section-label {
  display: block;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1A1C1E;
  margin-bottom: 0.75rem;
  text-align: center;
}

.text-center { text-align: center; }

/* === ROLE PICKER === */
.role-section {
  margin: 1.5rem 0;
  text-align: center;
}

.role-buttons {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  margin-top: 0.75rem;
}

.role-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.role-btn:hover { transform: scale(1.05); }
.role-btn:hover .role-img { border-color: #cbd5e1; }

.role-btn.active .role-img {
  border-color: #BD5B39;
  border-width: 4px;
  box-shadow: 0 0 0 4px rgba(189, 91, 57, 0.15);
}

.role-btn.active { transform: scale(1.08); }

.role-img {
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #e2e8f0;
  transition: all 0.2s;
}

.role-label {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1A1C1E;
}

/* === REVIEW CARDS (Step 2) === */
.review-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.review-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
}

.review-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
}

.review-value {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1A1C1E;
}

/* === FIXED BOTTOM BAR === */
.bottom-bar {
  position: fixed;
  bottom: 28px;
  left: 0;
  right: 0;
  background: var(--deep-slate, #1A1C1E);
  background-image: repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.06) 2px, rgba(255,255,255,0.06) 4px);
  padding: 0.75rem 1.5rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  z-index: 100;
}

.copyright-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 28px;
  background: #000000;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  transition: all 0.3s;
}

.dot.active {
  background: #BD5B39;
  transform: scale(1.3);
}

.dot.completed {
  background: white;
}

.bottom-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 600px;
  margin: 0 auto;
  gap: 1rem;
}

.onb-back-btn {
  flex: 1 !important;
}

.bottom-actions.single-btn :deep(.modal-primary-btn) {
  flex: none;
  width: 60%;
  max-width: 280px;
}

/* === TRANSITIONS === */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-left-enter-from { transform: translateX(40px); opacity: 0; }
.slide-left-leave-to { transform: translateX(-40px); opacity: 0; }
.slide-right-enter-from { transform: translateX(-40px); opacity: 0; }
.slide-right-leave-to { transform: translateX(40px); opacity: 0; }

/* RTL transition flip */
[dir="rtl"] .slide-left-enter-from { transform: translateX(-40px); }
[dir="rtl"] .slide-left-leave-to { transform: translateX(40px); }
[dir="rtl"] .slide-right-enter-from { transform: translateX(40px); }
[dir="rtl"] .slide-right-leave-to { transform: translateX(-40px); }

/* === RESPONSIVE === */
@media (max-width: 480px) {
  .step-title { font-size: 1.5rem; }
  .role-img { width: 4.5rem; height: 4.5rem; }
  .child-thumb { width: 3.5rem; height: 3.5rem; }
}

@media (min-width: 768px) {
  .onboarding-main {
    padding-top: 3rem;
    max-width: 640px;
  }

  .step-header { margin-bottom: 2.5rem; }
  .step-title { font-size: 2.25rem; }
  .step-subtitle { font-size: 1.125rem; max-width: 500px; }
  .role-img { width: 7rem; height: 7rem; }
  .child-thumb { width: 5rem; height: 5rem; }
  .child-name { font-size: 1rem; }
  .section-label { font-size: 1.0625rem; }
  .review-item { padding: 1.125rem 1.5rem; }
  .review-label { font-size: 0.9375rem; }
  .review-value { font-size: 1rem; }
  .bottom-actions { max-width: 640px; }
}
</style>
