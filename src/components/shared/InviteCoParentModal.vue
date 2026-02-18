<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useFamily } from '@/composables/useFamily'
import { useAuth } from '@/composables/useAuth'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { supabase } from '@/lib/supabase'
import { Clock, CheckCircle, Copy, Check, MessageCircle, Mail, Share2 } from 'lucide-vue-next'
import BaseModal from './BaseModal.vue'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const { family, pendingInvite } = useFamily()
const dashboardStore = useSupabaseDashboardStore()
const { user } = useAuth()

const email = ref('')
const loading = ref(false)
const checkingStatus = ref(false)
const error = ref('')
const familyFull = ref(false)
const existingInvite = ref(null)
const linkCopied = ref(false)

const inviteLink = computed(() => {
  if (!existingInvite.value?.token) return ''
  return `${window.location.origin}/invite/${existingInvite.value.token}`
})

const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

// Generate a random hex token (64 chars = 32 bytes)
function generateToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

// Check invite status when modal opens
watch(() => props.show, async (isOpen) => {
  if (isOpen) {
    const familyId = family.value?.id || dashboardStore.family?.id
    if (!familyId) return

    checkingStatus.value = true
    error.value = ''
    try {
      // Check member count
      const { count } = await supabase
        .from('family_members')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', familyId)

      familyFull.value = count >= 2

      // Check pending invite — use store first, then in-memory cache, then DB
      if (!familyFull.value) {
        if (dashboardStore.pendingInvite) {
          existingInvite.value = dashboardStore.pendingInvite
        } else if (pendingInvite.value) {
          existingInvite.value = pendingInvite.value
        } else {
          const { data } = await supabase
            .from('invitations')
            .select('*')
            .eq('family_id', familyId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          existingInvite.value = data
        }
      }
    } catch (err) {
      console.error('Error checking invite status:', err)
    } finally {
      checkingStatus.value = false
    }
  }
}, { immediate: true })

async function cancelExistingInvite() {
  const familyId = family.value?.id || dashboardStore.family?.id
  if (!familyId) return
  await supabase
    .from('invitations')
    .update({ status: 'expired' })
    .eq('family_id', familyId)
    .eq('status', 'pending')
  existingInvite.value = null
  pendingInvite.value = null
  dashboardStore.pendingInvite = null
}

async function createInvitation() {
  const hasFamilyId = family.value?.id || dashboardStore.family?.id
  if (!email.value || !hasFamilyId || !user.value) return

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    error.value = t('err_invalidEmail')
    return
  }

  loading.value = true
  error.value = ''

  try {
    const familyId = family.value?.id || dashboardStore.family?.id

    // Generate token client-side
    const token = generateToken()

    // Use atomic RPC — expires old invites + creates new one in single transaction
    const { data: result, error: rpcError } = await supabase.rpc('create_family_invitation', {
      p_family_id: familyId,
      p_email: email.value,
      p_token: token
    })

    if (rpcError) throw rpcError

    if (!result.success) {
      if (result.reason === 'family_full') {
        familyFull.value = true
        return
      }
      throw new Error(result.reason)
    }

    // Sync to all state sources
    const inviteData = { email: email.value, token }
    existingInvite.value = inviteData
    pendingInvite.value = inviteData
    dashboardStore.pendingInvite = inviteData

    // Try edge function email as bonus (fire and forget)
    const inviterName = user.value.user_metadata?.display_name || user.value.email?.split('@')[0]
    supabase.functions.invoke('send-invite-email', {
      body: { email: email.value, inviterName, token }
    }).catch(() => {})
  } catch (err) {
    console.error('Invitation error:', err)
    error.value = t('inviteError')
  } finally {
    loading.value = false
  }
}

function copyLink() {
  if (!inviteLink.value) return
  navigator.clipboard.writeText(inviteLink.value)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
}

function shareViaWhatsApp() {
  const name = user.value?.user_metadata?.display_name || ''
  const text = `${name ? name + ' invited' : 'You are invited'} to co-parent together on Becket AI. Join here: ${inviteLink.value}`
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}

function shareViaEmail() {
  const name = user.value?.user_metadata?.display_name || 'Your co-parent'
  const subject = `${name} invited you to Becket AI`
  const body = `${name} invited you to co-parent together on Becket AI.\n\nClick this link to join:\n${inviteLink.value}`
  window.open(`mailto:${existingInvite.value?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
}

async function shareNative() {
  const name = user.value?.user_metadata?.display_name || 'Your co-parent'
  try {
    await navigator.share({
      title: 'Join Becket AI',
      text: `${name} invited you to co-parent together on Becket AI.`,
      url: inviteLink.value
    })
  } catch {
    // User cancelled
  }
}

function resetState() {
  email.value = ''
  error.value = ''
  linkCopied.value = false
  existingInvite.value = null
  familyFull.value = false
}

function handleClose() {
  resetState()
  emit('close')
}
</script>

<template>
  <BaseModal
    v-if="show"
    headerStyle="#FB923C"
    maxWidth="500px"
    @close="handleClose"
  >
    <template #header>
      <h2 class="modal-title">{{ t('inviteCoParentTitle') }}</h2>
    </template>

    <!-- Loading -->
    <div v-if="checkingStatus" class="status-banner">
      <p class="status-text">...</p>
    </div>

    <!-- Family Full -->
    <div v-else-if="familyFull" class="full-banner">
      <CheckCircle :size="48" class="text-green-600" />
      <p class="full-text">{{ t('familyFull') }}</p>
    </div>

    <!-- Pending invite — show share options -->
    <div v-else-if="existingInvite" class="share-view">
      <div class="pending-header">
        <Clock :size="28" class="pending-icon" />
        <div>
          <p class="pending-title">{{ t('invitePending') }}</p>
          <p class="pending-email">{{ existingInvite.email }}</p>
        </div>
      </div>

      <div class="share-section">
        <p class="share-label">{{ t('shareInviteLink') }}</p>

        <div class="link-row">
          <div class="link-text">{{ inviteLink }}</div>
          <button class="copy-btn" :class="{ copied: linkCopied }" @click="copyLink">
            <component :is="linkCopied ? Check : Copy" :size="18" />
          </button>
        </div>

        <div class="share-buttons">
          <button class="share-btn whatsapp" @click="shareViaWhatsApp">
            <MessageCircle :size="20" />
            WhatsApp
          </button>
          <button class="share-btn email-share" @click="shareViaEmail">
            <Mail :size="20" />
            Email
          </button>
          <button v-if="canNativeShare" class="share-btn native" @click="shareNative">
            <Share2 :size="20" />
            {{ t('share') }}
          </button>
        </div>
      </div>

      <p class="expires-note">{{ t('inviteExpires7Days') }}</p>

      <button class="change-email-btn" @click="cancelExistingInvite">
        {{ t('inviteChangeEmail') }}
      </button>
    </div>

    <!-- Form: enter email to create invite -->
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
          @keyup.enter="createInvitation"
        />
      </div>

      <div v-if="error" class="modal-error">
        {{ error }}
      </div>
    </div>

    <template #footer>
      <div v-if="!familyFull && !existingInvite && !checkingStatus" class="modal-action-bar">
        <button class="modal-secondary-btn" @click="handleClose">
          {{ t('cancel') }}
        </button>
        <button
          class="modal-primary-btn"
          style="background: #ea580c"
          @click="createInvitation"
          :disabled="loading || !email"
        >
          {{ loading ? t('creating') + '...' : t('createInvite') }}
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

.status-banner {
  padding: 3rem;
  text-align: center;
}

.status-text {
  font-size: 1rem;
  color: #94a3b8;
  font-weight: 600;
}

.full-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: #f0fdf4;
  border: 2px solid #86efac;
  border-radius: 1.5rem;
}

.full-text {
  font-size: 1.125rem;
  font-weight: 700;
  color: #15803d;
  text-align: center;
}

/* Share view — shown after creating invite or when pending invite exists */
.share-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.pending-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: #fffbeb;
  border: 2px solid #fcd34d;
  border-radius: 1rem;
}

.pending-icon {
  color: #f59e0b;
  flex-shrink: 0;
}

.pending-title {
  font-size: 1rem;
  font-weight: 700;
  color: #92400e;
  margin: 0;
}

.pending-email {
  font-size: 0.875rem;
  color: #a16207;
  margin: 0.125rem 0 0;
}

.share-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.share-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #475569;
  margin: 0;
}

.link-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.5rem;
}

.link-text {
  flex: 1;
  font-size: 0.75rem;
  color: #64748b;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.25rem 0.5rem;
  user-select: all;
}

.copy-btn {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 0.5rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  border-color: #cbd5e1;
  color: #334155;
}

.copy-btn.copied {
  background: #f0fdf4;
  border-color: #86efac;
  color: #16a34a;
}

.share-buttons {
  display: flex;
  gap: 0.5rem;
}

.share-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.share-btn.whatsapp {
  background: #dcfce7;
  color: #15803d;
}

.share-btn.whatsapp:hover {
  background: #bbf7d0;
}

.share-btn.email-share {
  background: #e0f2fe;
  color: #0369a1;
}

.share-btn.email-share:hover {
  background: #bae6fd;
}

.share-btn.native {
  background: #f1f5f9;
  color: #334155;
}

.share-btn.native:hover {
  background: #e2e8f0;
}

.expires-note {
  font-size: 0.75rem;
  color: #94a3b8;
  text-align: center;
  margin: 0;
}

.change-email-btn {
  width: 100%;
  padding: 0.75rem;
  background: none;
  border: 2px dashed #e2e8f0;
  border-radius: 0.75rem;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.change-email-btn:hover {
  border-color: #f87171;
  color: #ef4444;
  background: #fef2f2;
}
</style>
