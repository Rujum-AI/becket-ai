<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth()

const mode = ref('login') // 'login', 'signup', or 'forgot'
const email = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

const errorMessages = {
  'Invalid login credentials': 'Email or password is incorrect',
  'User already registered': 'An account with this email already exists',
  'Password should be at least 6 characters': 'Password must be at least 6 characters',
  'Unable to validate email address: invalid format': 'Please enter a valid email address',
  'Email not confirmed': 'Please check your email to confirm your account',
  'For security purposes, you can only request this once every 60 seconds': 'Please wait a moment before requesting another reset email',
}

function friendlyError(msg) {
  return errorMessages[msg] || msg
}

async function handleSubmit() {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    if (mode.value === 'forgot') {
      await resetPassword(email.value)
      success.value = 'Password reset link sent! Check your email.'
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
    <div class="login-container">
      <!-- Logo -->
      <div class="logo-section">
        <img src="/assets/becket_logo.png" alt="Becket AI" class="logo">
        <h1 class="app-title">Becket AI</h1>
      </div>

      <!-- Form Card -->
      <div class="form-card">
        <h2 class="form-title">
          {{ mode === 'forgot' ? 'Reset Password' : mode === 'login' ? 'Welcome Back' : 'Create Account' }}
        </h2>

        <!-- Google Sign In (hidden in forgot mode) -->
        <template v-if="mode !== 'forgot'">
          <button
            type="button"
            @click="handleGoogleSignIn"
            :disabled="loading"
            class="google-btn"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <!-- Divider -->
          <div class="divider">
            <span>Or continue with email</span>
          </div>
        </template>

        <!-- Forgot mode description -->
        <p v-if="mode === 'forgot'" class="forgot-desc">
          Enter your email and we'll send you a link to reset your password.
        </p>

        <form @submit.prevent="handleSubmit" class="auth-form">
          <!-- Display Name (signup only) -->
          <div v-if="mode === 'signup'" class="form-field">
            <label>Name</label>
            <input
              v-model="displayName"
              type="text"
              required
              placeholder="Your name"
            >
          </div>

          <!-- Email -->
          <div class="form-field">
            <label>Email</label>
            <input
              v-model="email"
              type="email"
              required
              placeholder="you@example.com"
            >
          </div>

          <!-- Password (hidden in forgot mode) -->
          <div v-if="mode !== 'forgot'" class="form-field">
            <label>Password</label>
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
              Forgot password?
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
          <button type="submit" :disabled="loading" class="submit-btn">
            {{ loading ? 'Loading...' : mode === 'forgot' ? 'Send Reset Link' : mode === 'login' ? 'Sign In' : 'Sign Up' }}
          </button>
        </form>

        <!-- Toggle Mode -->
        <div class="toggle-mode">
          <button v-if="mode === 'forgot'" @click="setMode('login')">
            Back to sign in
          </button>
          <button v-else @click="setMode(mode === 'login' ? 'signup' : 'login')">
            {{ mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #C2571A 0%, #E07B39 100%);
  padding: 2rem;
}

.login-container {
  width: 100%;
  max-width: 26rem;
}

.logo-section {
  text-align: center;
  margin-bottom: 2rem;
}

.logo {
  height: 4rem;
  margin: 0 auto 1rem auto;
  display: block;
  filter: brightness(0) invert(1);
}

.app-title {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.form-card {
  background: white;
  border-radius: 1.5rem;
  padding: 2.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.form-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 2rem 0;
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

.forgot-desc {
  color: #64748b;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  text-align: start;
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
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.9375rem;
  transition: all 0.2s;
  text-align: start;
}

.form-field input:focus {
  outline: none;
  border-color: #C2571A;
  background: white;
  box-shadow: 0 0 0 3px rgba(194, 87, 26, 0.1);
}

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
  color: #C2571A;
}

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

.submit-btn {
  width: 100%;
  background: #0f172a;
  color: white;
  font-weight: 700;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9375rem;
  margin-top: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  background: #1e293b;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
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
  color: #C2571A;
}

/* RTL Support */
:global(.lang-he) .form-title,
:global(.lang-he) .form-field label,
:global(.lang-he) .form-field input,
:global(.lang-he) .forgot-desc,
:global(.lang-he) .message {
  text-align: start;
}

:global(.lang-he) .forgot-link {
  text-align: start;
}

:global(.lang-he) .logo-section,
:global(.lang-he) .app-title {
  direction: ltr;
  text-align: center;
}

/* Mobile */
@media (max-width: 640px) {
  .login-page {
    padding: 1rem;
  }

  .form-card {
    padding: 2rem 1.5rem;
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
