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
const { family, userRole } = useFamily()
const updatesStore = useUpdatesStore()
const dashboardStore = useSupabaseDashboardStore()
const isUserMenuOpen = ref(false)
const showInviteModal = ref(false)

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

            <div v-if="!dashboardStore.partnerId" class="dropdown-item" @click="openInviteModal">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {{ t('inviteCoParent') }}
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
</template>
