<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'

const router = useRouter()
const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth()
const { t, lang, toggleLang } = useI18n()

const mode = ref('login') // 'login', 'signup', or 'forgot'
const email = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

const errorMessages = {
  'Invalid login credentials': 'err_invalidCredentials',
  'User already registered': 'err_userExists',
  'Password should be at least 6 characters': 'err_passwordShort',
  'Unable to validate email address: invalid format': 'err_invalidEmail',
  'Email not confirmed': 'err_emailNotConfirmed',
  'For security purposes, you can only request this once every 60 seconds': 'err_rateLimited',
}

function friendlyError(msg) {
  const key = errorMessages[msg]
  return key ? t(key) : msg
}

function setLang(targetLang) {
  if (lang.value !== targetLang) {
    toggleLang()
  }
}

async function handleSubmit() {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    if (mode.value === 'forgot') {
      await resetPassword(email.value)
      success.value = t('login_resetSent')
    } else if (mode.value === 'login') {
      await signIn(email.value, password.value)
      router.push('/family')
    } else {
      await signUp(email.value, password.value, displayName.value)
      router.push('/family')
    }
  } catch (err) {
    error.value = friendlyError(err.message)
  } finally {
    loading.value = false
  }
}

async function handleGoogleSignIn() {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    await signInWithGoogle()
  } catch (err) {
    error.value = friendlyError(err.message)
    loading.value = false
  }
}

function setMode(newMode) {
  mode.value = newMode
  error.value = ''
  success.value = ''
}
</script>

<template>
  <div class="login-page">
    <!-- Language toggle — top right -->
    <div class="lang-bar">
      <div class="lang-toggle-group">
        <span
          class="lang-option"
          :class="{ active: lang === 'en' }"
          @click="setLang('en')">English</span>
        <span class="lang-divider">|</span>
        <span
          class="lang-option"
          :class="{ active: lang === 'he' }"
          @click="setLang('he')">עברית</span>
      </div>
    </div>

    <div class="login-container">
      <!-- Logo -->
      <div class="logo-section">
        <img src="/assets/becket_logo.png" alt="Becket AI" class="logo">
        <h1 class="app-title">Becket AI</h1>
        <p class="app-tagline">{{ t('login_tagline') }}</p>
      </div>

      <!-- Form Card -->
      <div class="form-card">
        <h2 class="form-title">
          {{ mode === 'forgot' ? t('login_resetPassword') : mode === 'login' ? t('login_welcome') : t('login_createAccount') }}
        </h2>

        <!-- Google Sign In (hidden in forgot mode) -->
        <template v-if="mode !== 'forgot'">
          <button
            type="button"
            @click="handleGoogleSignIn"
            :disabled="loading"
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
        </template>

        <!-- Forgot mode description -->
        <p v-if="mode === 'forgot'" class="forgot-desc">
          {{ t('login_forgotDesc') }}
        </p>

        <form @submit.prevent="handleSubmit" class="auth-form">
          <!-- Display Name (signup only) -->
          <div v-if="mode === 'signup'" class="form-field">
            <label>{{ t('login_name') }}</label>
            <input
              v-model="displayName"
              type="text"
              required
              :placeholder="t('login_namePlaceholder')"
            >
          </div>

          <!-- Email -->
          <div class="form-field">
            <label>{{ t('login_email') }}</label>
            <input
              v-model="email"
              type="email"
              required
              :placeholder="t('login_emailPlaceholder')"
            >
          </div>

          <!-- Password (hidden in forgot mode) -->
          <div v-if="mode !== 'forgot'" class="form-field">
            <label>{{ t('login_password') }}</label>
            <input
              v-model="password"
              type="password"
              required
              minlength="6"
              placeholder="••••••••"
            >
          </div>

          <!-- Forgot Password Link (login mode only) -->
          <div v-if="mode === 'login'" class="forgot-link">
            <button type="button" @click="setMode('forgot')">
              {{ t('login_forgotLink') }}
            </button>
          </div>

          <!-- Success Message -->
          <div v-if="success" class="message success">
            {{ success }}
          </div>

          <!-- Error Message -->
          <div v-if="error" class="message error">
            {{ error }}
          </div>

          <!-- Submit Button -->
          <button type="submit" :disabled="loading"
            class="modal-primary-btn" style="background: #BD5B39">
            {{ loading ? t('login_loading') : mode === 'forgot' ? t('login_sendReset') : mode === 'login' ? t('login_signIn') : t('login_signUp') }}
          </button>
        </form>

        <!-- Toggle Mode -->
        <div class="toggle-mode">
          <button v-if="mode === 'forgot'" @click="setMode('login')">
            {{ t('login_backToSignIn') }}
          </button>
          <button v-else @click="setMode(mode === 'login' ? 'signup' : 'login')">
            {{ mode === 'login' ? t('login_noAccount') : t('login_hasAccount') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Copyright bar -->
    <div class="copyright-bar">All rights reserved to Rujum 2026 &copy;</div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--warm-linen, #FDFBF7);
  padding: 2rem;
  padding-bottom: calc(2rem + 28px);
  position: relative;
}

.login-container {
  width: 100%;
  max-width: 26rem;
}

/* === LANGUAGE TOGGLE BAR === */
.lang-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: flex-end;
  padding: 0.75rem 1.25rem;
  z-index: 10;
}

.lang-toggle-group {
  display: flex;
  gap: 0.375rem;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.lang-option {
  cursor: pointer;
  transition: color 0.2s;
  color: #94a3b8;
  font-weight: 500;
}

.lang-option:hover {
  color: #64748b;
}

.lang-option.active {
  font-weight: 900;
  color: var(--deep-slate, #1A1C1E);
}

.lang-divider {
  color: #cbd5e1;
}

/* === LOGO === */
.logo-section {
  text-align: center;
  margin-bottom: 2rem;
}

.logo {
  height: 4rem;
  margin: 0 auto 0.75rem auto;
  display: block;
  opacity: 0.15;
}

.app-title {
  font-family: 'Fraunces', serif;
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--deep-slate, #1A1C1E);
  margin: 0;
  letter-spacing: -0.02em;
}

.app-tagline {
  font-size: 0.875rem;
  font-weight: 600;
  font-style: italic;
  color: var(--rust-orange, #BD5B39);
  margin: 0.375rem 0 0;
}

/* === FORM CARD === */
.form-card {
  background: rgba(255, 255, 255, 0.7);
  border: 2px solid var(--deep-slate, #1A1C1E);
  border-radius: 2.5rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 20px 60px -15px rgba(0, 0, 0, 0.12);
  position: relative;
  overflow: hidden;
}

/* Stripe texture like landing card */
.form-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(26, 28, 30, 0.03) 2px,
    rgba(26, 28, 30, 0.03) 4px
  );
  border-radius: 2.5rem;
  pointer-events: none;
}

.form-title {
  font-family: 'Fraunces', serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--deep-slate, #1A1C1E);
  margin: 0 0 2rem 0;
  text-align: center;
  position: relative;
}

/* === GOOGLE BUTTON === */
.google-btn {
  width: 100%;
  background: white;
  color: #334155;
  font-weight: 700;
  padding: 0.875rem 1rem;
  border-radius: 9999px;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  position: relative;
}

.google-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.google-btn:hover:not(:disabled) {
  border-color: #cbd5e1;
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.google-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* === DIVIDER === */
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
  background: rgba(255, 255, 255, 0.7);
  padding: 0 1rem;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 600;
}

/* === FORGOT DESC === */
.forgot-desc {
  color: #64748b;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  text-align: start;
  line-height: 1.5;
  position: relative;
}

/* === FORM === */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: relative;
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

/* === FORGOT LINK === */
.forgot-link {
  text-align: end;
  margin-top: -0.5rem;
}

.forgot-link button {
  font-size: 0.75rem;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
}

.forgot-link button:hover {
  color: var(--rust-orange, #BD5B39);
}

/* === MESSAGES === */
.message {
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  text-align: start;
}

.message.success {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.message.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

/* === SUBMIT — uses global modal-primary-btn, width override === */
.auth-form :deep(.modal-primary-btn) {
  width: 100%;
  margin-top: 0.5rem;
}

/* === TOGGLE MODE === */
.toggle-mode {
  margin-top: 1.5rem;
  text-align: center;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  position: relative;
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

/* === MOBILE === */
@media (max-width: 640px) {
  .login-page {
    padding: 1rem;
    padding-bottom: calc(1rem + 28px);
  }

  .form-card {
    padding: 2rem 1.5rem;
    border-radius: 2rem;
  }

  .form-card::before {
    border-radius: 2rem;
  }

  .form-title {
    font-size: 1.5rem;
  }

  .logo {
    height: 3rem;
  }

  .app-title {
    font-size: 1.75rem;
  }
}
</style>
