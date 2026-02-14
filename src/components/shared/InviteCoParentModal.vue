<script setup>
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useFamily } from '@/composables/useFamily'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import { UserPlus } from 'lucide-vue-next'
import BaseModal from './BaseModal.vue'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const { family } = useFamily()
const { user } = useAuth()

const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

async function sendInvitation() {
  if (!email.value || !family.value || !user.value) return

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    error.value = 'Please enter a valid email address'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // Create invitation record (same as onboarding)
    const { error: inviteError } = await supabase
      .from('invitations')
      .insert({
        family_id: family.value.id,
        email: email.value,
        status: 'pending'
      })

    if (inviteError) throw inviteError

    // TODO: Send email with invitation link

    success.value = true
    setTimeout(() => {
      emit('close')
      email.value = ''
      success.value = false
    }, 2000)
  } catch (err) {
    console.error('Invitation error:', err)
    error.value = t('inviteError')
  } finally {
    loading.value = false
  }
}

function handleClose() {
  email.value = ''
  error.value = ''
  success.value = false
  emit('close')
}
</script>

<template>
  <BaseModal
    v-if="show"
    :headerStyle="'linear-gradient(135deg, #FED7AA, #FDBA74)'"
    maxWidth="500px"
    @close="handleClose"
  >
    <template #header>
      <h2 class="modal-title">{{ t('inviteCoParentTitle') }}</h2>
    </template>
        <!-- Success message -->
        <div v-if="success" class="success-banner">
          <UserPlus :size="48" class="text-orange-600" />
          <p class="success-text">{{ t('inviteSent') }}</p>
        </div>

        <!-- Form -->
        <div v-else>
          <div class="modal-section">
            <p class="modal-description">{{ t('inviteCoParentDesc') }}</p>
          </div>

          <div class="form-group">
            <label class="modal-form-label">{{ t('coParentEmail') }}</label>
            <input
              v-model="email"
              type="email"
              placeholder="example@email.com"
              class="email-input"
              @keyup.enter="sendInvitation"
            />
          </div>

          <!-- Error message -->
          <div v-if="error" class="modal-error">
            {{ error }}
          </div>
        </div>

    <template #footer>
      <div v-if="!success" class="modal-action-bar">
        <button class="modal-secondary-btn" @click="handleClose">
          {{ t('cancel') }}
        </button>
        <button
          class="modal-primary-btn"
          style="background: #ea580c"
          @click="sendInvitation"
          :disabled="loading || !email"
        >
          {{ loading ? t('sending') + '...' : t('sendInvite') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-section {
  margin-bottom: 1.5rem;
}

.modal-description {
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
  text-align: center;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.5rem;
}

.email-input {
  width: 100%;
  padding: 1rem 1.25rem;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  background: #f8fafc;
  transition: all 0.2s;
}

.email-input:focus {
  outline: none;
  border-color: #fb923c;
  background: white;
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.1);
}

.email-input::placeholder {
  color: #cbd5e1;
  font-weight: 500;
}

.success-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: #fff7ed;
  border: 2px solid #fdba74;
  border-radius: 1.5rem;
  margin-bottom: 1.5rem;
}

.success-text {
  font-size: 1.125rem;
  font-weight: 700;
  color: #c2410c;
  text-align: center;
}
</style>
