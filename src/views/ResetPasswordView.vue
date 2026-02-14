<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { updatePassword } = useAuth()

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)

async function handleReset() {
  error.value = ''

  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true

  try {
    await updatePassword(password.value)
    success.value = true
    setTimeout(() => router.push('/family'), 2000)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
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
        <!-- Success State -->
        <template v-if="success">
          <div class="text-center">
            <div class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-slate-900 mb-2">Password Updated</h2>
            <p class="text-slate-500 text-sm">Redirecting you to the app...</p>
          </div>
        </template>

        <!-- Reset Form -->
        <template v-else>
          <h2 class="text-2xl font-bold text-slate-900 mb-2">Set New Password</h2>
          <p class="text-slate-500 text-sm mb-6">Choose a new password for your account.</p>

          <form @submit.prevent="handleReset" class="space-y-4">
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-2">New Password</label>
              <input
                v-model="password"
                type="password"
                required
                minlength="6"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rust-orange"
                placeholder="••••••••"
              >
            </div>

            <div>
              <label class="block text-sm font-bold text-slate-700 mb-2">Confirm Password</label>
              <input
                v-model="confirmPassword"
                type="password"
                required
                minlength="6"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rust-orange"
                placeholder="••••••••"
              >
            </div>

            <div v-if="error" class="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full bg-rust-orange text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {{ loading ? 'Updating...' : 'Update Password' }}
            </button>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-warm-linen {
  background-color: #FAF6F1;
}
</style>
