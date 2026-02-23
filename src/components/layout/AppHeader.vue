<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'
import { useUpdatesStore } from '@/stores/supabaseUpdates'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { ChevronDown } from 'lucide-vue-next'
import InviteCoParentModal from '@/components/shared/InviteCoParentModal.vue'

const router = useRouter()
const { t, lang, toggleLang } = useI18n()
const { user, signOut } = useAuth()
const { family, userRole, updateDashboardPrefs } = useFamily()
const updatesStore = useUpdatesStore()
const dashboardStore = useSupabaseDashboardStore()
const isUserMenuOpen = ref(false)
const showInviteModal = ref(false)
const showDashSetup = ref(false)
const dashPrefsLocal = ref({ finance: true, management: true, understandings: true })
const savingPrefs = ref(false)

// Fetch updates on mount to get real-time count
onMounted(() => {
  updatesStore.fetchUpdates()
})

const unreadCount = computed(() => updatesStore.unreadCount)

// Display name from auth metadata or email
const displayName = computed(() => {
  if (!user.value) return ''
  return user.value.user_metadata?.display_name
    || user.value.email?.split('@')[0]
    || ''
})

// Avatar: use Supabase avatar_url or fallback to default
const avatarUrl = computed(() => {
  if (!user.value) return '/assets/profile/king_profile.png'
  return user.value.user_metadata?.avatar_url
    || '/assets/profile/king_profile.png'
})

// Role label for display
const roleLabel = computed(() => {
  return userRole.value === 'admin' ? 'Admin' : 'Parent'
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

async function logout() {
  await signOut()
  router.push('/')
}

function goToUpdates() {
  router.push('/updates')
}

function goToDashboard() {
  router.push('/family')
}

function openInviteModal() {
  closeUserMenu()
  showInviteModal.value = true
}

function openDashSetup() {
  closeUserMenu()
  const prefs = family.value?.dashboard_prefs
    || { finance: true, management: true, understandings: true }
  dashPrefsLocal.value = { ...prefs }
  showDashSetup.value = true
}

function toggleLocalPref(key) {
  dashPrefsLocal.value = { ...dashPrefsLocal.value, [key]: !dashPrefsLocal.value[key] }
}

async function saveDashPrefs() {
  savingPrefs.value = true
  try {
    await updateDashboardPrefs(dashPrefsLocal.value)
    showDashSetup.value = false
    // If current route is now disabled, redirect to /family
    const dashPref = router.currentRoute.value.meta?.dashboardPref
    if (dashPref && !dashPrefsLocal.value[dashPref]) {
      router.push('/family')
    }
  } catch (err) {
    console.error('Error saving dashboard prefs:', err)
  } finally {
    savingPrefs.value = false
  }
}

// Close dropdown when clicking outside
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-container')) {
      closeUserMenu()
    }
  })
}
</script>

<template>
  <header class="app-header">
    <div class="header-left cursor-pointer" @click="goToDashboard">
      <span class="header-tagline">Co-parenting, simplified</span>
      <span class="header-title">Becket AI</span>
    </div>

    <div class="header-right">
      <div class="header-icon relative cursor-pointer" @click="goToUpdates">
        <img src="/assets/updates_icon.png" class="w-full h-full object-cover">
        <div v-if="unreadCount > 0" class="update-badge">{{ unreadCount }}</div>
      </div>
      <div class="header-spacer"></div>

      <div class="profile-container relative" @click.stop>
        <div class="profile-ring" @click="toggleUserMenu">
          <img :src="avatarUrl" referrerpolicy="no-referrer">
        </div>

        <Transition name="pop">
          <div v-if="isUserMenuOpen" class="user-dropdown">
            <div class="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100 px-2">
              <div class="w-10 h-10 rounded-full overflow-hidden border border-slate-200">
                <img :src="avatarUrl" class="w-full h-full object-cover" referrerpolicy="no-referrer">
              </div>
              <div class="text-start">
                <p class="text-sm font-bold text-slate-800">{{ displayName }}</p>
                <p class="text-[10px] text-slate-400">{{ roleLabel }}</p>
              </div>
            </div>

            <div v-if="!dashboardStore.partnerId && !dashboardStore.pendingInvite" class="dropdown-item" @click="openInviteModal">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>{{ t('inviteCoParent') }}</span>
              <span v-if="dashboardStore.pendingInvite" class="invite-pending-dot"></span>
            </div>

            <div class="dropdown-item" @click="openDashSetup">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              {{ t('dashboardSetup') }}
            </div>

            <div class="dropdown-item" @click="closeUserMenu(); router.push('/subscription')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>
              {{ t('subscription') }}
            </div>

            <div class="dropdown-item justify-between cursor-default hover:bg-transparent">
              <div class="flex items-center gap-2 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
              </div>
              <div class="flex gap-1 text-xs shrink-0 whitespace-nowrap">
                <span
                  class="cursor-pointer transition-colors"
                  :class="lang === 'en' ? 'font-black text-slate-900' : 'text-slate-400 font-medium hover:text-slate-600'"
                  @click.stop="setLang('en')">English</span>
                <span class="text-slate-300">|</span>
                <span
                  class="cursor-pointer transition-colors"
                  :class="lang === 'he' ? 'font-black text-slate-900' : 'text-slate-400 font-medium hover:text-slate-600'"
                  @click.stop="setLang('he')">עברית</span>
              </div>
            </div>

            <div class="dropdown-item danger mt-2 border-t border-slate-50 pt-3" @click="logout">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              {{ t('logout') }}
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>

  <!-- Invite Co-Parent Modal -->
  <InviteCoParentModal :show="showInviteModal" @close="showInviteModal = false" />

  <!-- Dashboard Setup Modal -->
  <Teleport to="body">
    <Transition name="pop">
      <div v-if="showDashSetup" class="dash-setup-overlay" @click.self="showDashSetup = false">
        <div class="dash-setup-modal">
          <h3 class="dash-setup-title">{{ t('dashboardSetup') }}</h3>
          <p class="dash-setup-desc">{{ t('dashboardSetupDesc') }}</p>

          <div class="dash-setup-cards">
            <div class="dash-setup-card" :class="{ active: dashPrefsLocal.finance }" @click="toggleLocalPref('finance')">
              <img src="/assets/finance.png" alt="" class="dash-setup-icon" />
              <div class="dash-setup-card-body">
                <span class="dash-setup-card-title">{{ t('dash_finance') }}</span>
                <span class="dash-setup-card-desc">{{ t('dash_financeDesc') }}</span>
              </div>
              <div class="dash-setup-toggle" :class="{ on: dashPrefsLocal.finance }">
                <div class="dash-setup-knob"></div>
              </div>
            </div>
            <div class="dash-setup-card" :class="{ active: dashPrefsLocal.management }" @click="toggleLocalPref('management')">
              <img src="/assets/management.png" alt="" class="dash-setup-icon" />
              <div class="dash-setup-card-body">
                <span class="dash-setup-card-title">{{ t('dash_management') }}</span>
                <span class="dash-setup-card-desc">{{ t('dash_managementDesc') }}</span>
              </div>
              <div class="dash-setup-toggle" :class="{ on: dashPrefsLocal.management }">
                <div class="dash-setup-knob"></div>
              </div>
            </div>
            <div class="dash-setup-card" :class="{ active: dashPrefsLocal.understandings }" @click="toggleLocalPref('understandings')">
              <img src="/assets/understandings.png" alt="" class="dash-setup-icon" />
              <div class="dash-setup-card-body">
                <span class="dash-setup-card-title">{{ t('dash_understandings') }}</span>
                <span class="dash-setup-card-desc">{{ t('dash_understandingsDesc') }}</span>
              </div>
              <div class="dash-setup-toggle" :class="{ on: dashPrefsLocal.understandings }">
                <div class="dash-setup-knob"></div>
              </div>
            </div>
          </div>

          <p class="dash-setup-note">{{ t('dash_alwaysIncluded') }}</p>

          <button class="dash-setup-save" :disabled="savingPrefs" @click="saveDashPrefs">
            {{ savingPrefs ? '...' : t('saveDashPrefs') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.invite-pending-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
  flex-shrink: 0;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Dashboard Setup Modal */
.dash-setup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.dash-setup-modal {
  background: var(--warm-linen, #FDFBF7);
  border-radius: 1.5rem;
  padding: 2rem 1.5rem 1.5rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  text-align: center;
}

.dash-setup-title {
  font-family: 'Fraunces', serif;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--deep-slate, #1A1C1E);
  margin: 0 0 0.375rem;
  line-height: 1.2;
}

.dash-setup-desc {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.5rem;
  line-height: 1.4;
}

.dash-setup-cards {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-bottom: 1rem;
}

.dash-setup-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: start;
}

.dash-setup-card:hover {
  border-color: #cbd5e1;
}

.dash-setup-card.active {
  border-color: #BD5B39;
  background: rgba(189, 91, 57, 0.03);
}

.dash-setup-icon {
  width: 2.75rem;
  height: 2.75rem;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
}

.dash-setup-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.dash-setup-card-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1A1C1E;
}

.dash-setup-card-desc {
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.3;
}

.dash-setup-toggle {
  width: 2.75rem;
  height: 1.5rem;
  background: #e2e8f0;
  border-radius: 1rem;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.dash-setup-toggle.on {
  background: #BD5B39;
}

.dash-setup-knob {
  width: 1.125rem;
  height: 1.125rem;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  transition: left 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.dash-setup-toggle.on .dash-setup-knob {
  left: calc(100% - 1.3125rem);
}

.dash-setup-note {
  text-align: center;
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0 0 1rem;
}

.dash-setup-save {
  width: 100%;
  padding: 0.875rem;
  background: #BD5B39;
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.dash-setup-save:hover:not(:disabled) {
  background: #a34e31;
}

.dash-setup-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
