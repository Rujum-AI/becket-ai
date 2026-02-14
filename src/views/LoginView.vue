<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { signIn, signUp, signInWithGoogle } = useAuth()

const mode = ref('login') // 'login' or 'signup'
const email = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    if (mode.value === 'login') {
      await signIn(email.value, password.value)
      router.push('/family')
    } else {
      await signUp(email.value, password.value, displayName.value)
      router.push('/family')
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleGoogleSignIn() {
  error.value = ''
  loading.value = true

  try {
    await signInWithGoogle()
    // OAuth will redirect, so we don't need to manually navigate
  } catch (err) {
    error.value = err.message
    loading.value = false
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'signup' : 'login'
  error.value = ''
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-warm-linen p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <img src="/assets/becket_logo.png" alt="Becket AI" class="h-16 mx-auto mb-4">
        <h1 class="text-3xl font-serif font-bold text-slate-900">Becket AI</h1>
        <p class="text-slate-500 mt-2">Co-parenting made simple</p>
      </div>

      <!-- Auth Form -->
      <div class="bg-white rounded-3xl p-8 shadow-lg border border-slate-100">
        <h2 class="text-2xl font-bold text-slate-900 mb-6">
          {{ mode === 'login' ? 'Welcome Back' : 'Create Account' }}
        </h2>

        <!-- Google Sign In Button -->
        <button
          type="button"
          @click="handleGoogleSignIn"
          :disabled="loading"
          class="w-full bg-white text-slate-700 font-bold py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
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
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-slate-200"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-4 bg-white text-slate-500">Or continue with email</span>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Display Name (signup only) -->
          <div v-if="mode === 'signup'">
            <label class="block text-sm font-bold text-slate-700 mb-2">Name</label>
            <input
              v-model="displayName"
              type="text"
              required
              class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rust-orange"
              placeholder="Your name"
            >
          </div>

          <!-- Email -->
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

          <!-- Password -->
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

          <!-- Error Message -->
          <div v-if="error" class="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
            {{ error }}
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-rust-orange text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {{ loading ? 'Loading...' : (mode === 'login' ? 'Sign In' : 'Sign Up') }}
          </button>
        </form>

        <!-- Toggle Mode -->
        <div class="mt-6 text-center">
          <button
            @click="toggleMode"
            class="text-sm text-slate-500 hover:text-rust-orange transition-colors"
          >
            {{ mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-warm-linen {
  background-color: #FAF6F1;
}
</style>
