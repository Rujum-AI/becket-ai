<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'
import { useFamilyStore } from '@/stores/family'
import { supabase } from '@/lib/supabase'
import { Copy, Check, MessageCircle, Mail, Share2, CheckCircle, Sparkles } from 'lucide-vue-next'

const router = useRouter()
const { t, lang, toggleLang } = useI18n()
const { user, signOut } = useAuth()
const { createFamily, updateFamilyPlan } = useFamily()

async function handleLogout() {
  await signOut()
  router.push('/')
}
const familyStore = useFamilyStore()

// === STATE ===
const step = ref(1)
const direction = ref('forward')
const showShareScreen = ref(false)
const displayName = ref('')

const familyType = ref('')       // 'separated' | 'together' | 'solo'
const mode = ref('')             // 'co-parent' | 'solo' (derived)
const partnerEmail = ref('')
const parentRole = ref('')
const children = ref([])
const childDraft = ref(null)
const dashboardPrefs = ref({ finance: true, management: true, understandings: true })
const homes = ref(2)
const agreementType = ref('')
const currency = ref('NIS')
const selectedPlan = ref('free')

const freePlanFeatures = [
  'familyDashboard',
  'sharedCalendar',
  'expenseTracking',
  'custodySchedule',
  'taskManagement',
  'trustedContacts'
]

const aiPlanFeatures = [
  'aiMediator',
  'aiBriefings',
  'smartInsights',
  'conflictResolution',
  'toneGuidance',
  'unlimitedHistory'
]

const saving = ref(false)
const error = ref('')
const inviteToken = ref(null)
const linkCopied = ref(false)
const isUserMenuOpen = ref(false)

// Dashboard prefs to show (Understandings only for separated)
const dashboardOptions = computed(() => {
  const opts = [
    { key: 'finance', challenge: 'expenses' },
    { key: 'management', challenge: 'scheduling' }
  ]
  if (familyType.value === 'separated') {
    opts.push({ key: 'understandings', challenge: 'consistency' })
  }
  return opts
})

// Dynamic step names based on family type
const allSteps = computed(() => {
  return ['type', 'profile', 'usage', 'currency', 'plan']
})
const currentStepName = computed(() => allSteps.value[step.value - 1])
const totalSteps = computed(() => allSteps.value.length)

// Avatar
const avatarUrl = computed(() => {
  if (!user.value) return '/assets/profile/king_profile.png'
  return user.value.user_metadata?.avatar_url
    || '/assets/profile/king_profile.png'
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

// Close dropdown when clicking outside
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-container')) {
      closeUserMenu()
    }
  })
}

// === LIFECYCLE ===
onMounted(() => {
  const meta = user.value?.user_metadata
  displayName.value = meta?.full_name || meta?.display_name || ''
})

// === COMPUTED ===
const inviteLink = computed(() => {
  if (!inviteToken.value) return ''
  return `${window.location.origin}/invite/${inviteToken.value}`
})

const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

const canProceed = computed(() => {
  const s = currentStepName.value
  if (s === 'type') return !!familyType.value && (familyType.value !== 'separated' || agreementType.value)
  if (s === 'profile') return displayName.value.trim() && parentRole.value && children.value.length > 0 && !childDraft.value
  if (s === 'usage') return true // toggles have defaults
  if (s === 'currency') return true // currency has default
  if (s === 'plan') return true
  return true
})

// === NAVIGATION ===
function nextStep() {
  direction.value = 'forward'
  if (step.value < totalSteps.value) step.value++
}

function prevStep() {
  direction.value = 'backward'
  if (showShareScreen.value) {
    showShareScreen.value = false
    return
  }
  if (step.value > 1) step.value--
}

// === FAMILY TYPE SELECTION (Step 1) ===
function selectFamilyType(type) {
  familyType.value = type
  if (type === 'solo') {
    mode.value = 'solo'
  } else {
    mode.value = 'co-parent'
  }
  // Auto-fill defaults for non-separated types
  if (type === 'together') {
    homes.value = 1
    dashboardPrefs.value = { finance: true, management: true, understandings: false }
  } else if (type === 'solo') {
    homes.value = 1
    dashboardPrefs.value = { finance: true, management: true, understandings: false }
  } else {
    homes.value = 2
    dashboardPrefs.value = { finance: true, management: true, understandings: true }
  }
}

// === DASHBOARD PREFS ===
function toggleDashPref(key) {
  dashboardPrefs.value = { ...dashboardPrefs.value, [key]: !dashboardPrefs.value[key] }
}

// === CHILDREN ===
function addChild() {
  childDraft.value = { name: '', gender: '', dob: '', medical: '' }
}

function saveChild() {
  if (childDraft.value && childDraft.value.name && childDraft.value.gender && childDraft.value.dob) {
    children.value.push({ ...childDraft.value })
    childDraft.value = null
  }
}

function editChild(index) {
  childDraft.value = { ...children.value[index], _editIndex: index }
}

function updateChild() {
  if (childDraft.value && childDraft.value.name && childDraft.value.gender && childDraft.value.dob) {
    children.value[childDraft.value._editIndex] = {
      name: childDraft.value.name,
      gender: childDraft.value.gender,
      dob: childDraft.value.dob,
      medical: childDraft.value.medical
    }
    childDraft.value = null
  }
}

function cancelChild() {
  childDraft.value = null
}

function removeChild(index) {
  children.value.splice(index, 1)
}

// === CREATE FAMILY (fires after currency step) ===
async function handleCreateFamily() {
  if (!user.value) {
    error.value = 'User not authenticated'
    return
  }

  saving.value = true
  error.value = ''

  try {
    if (displayName.value) {
      await supabase.auth.updateUser({ data: { display_name: displayName.value } })
    }

    const result = await createFamily(user.value.id, {
      mode: mode.value,
      familyType: familyType.value,
      parentRole: parentRole.value,
      partnerEmail: partnerEmail.value,
      children: children.value,
      homes: homes.value,
      relationshipStatus: familyType.value === 'together' ? 'together' : (familyType.value === 'separated' ? 'apart' : ''),
      agreementType: agreementType.value,
      currency: currency.value,
      selectedPlan: 'free',
      dashboardPrefs: dashboardPrefs.value,
      challenges: []
    })

    familyStore.saveOnboarding({
      mode: mode.value,
      familyType: familyType.value,
      partnerEmail: partnerEmail.value,
      children: children.value,
      homes: homes.value,
      relationshipStatus: familyType.value === 'together' ? 'together' : 'apart',
      agreementType: agreementType.value,
      currency: currency.value,
      selectedPlan: 'free',
      dashboardPrefs: dashboardPrefs.value,
      challenges: []
    })

    if (mode.value === 'co-parent' && result._inviteToken) {
      inviteToken.value = result._inviteToken
      showShareScreen.value = true
    } else {
      direction.value = 'forward'
      step.value = totalSteps.value // go to plan step
    }
  } catch (err) {
    console.error('Error creating family:', err)
    error.value = err.message || 'Failed to save family data'
  } finally {
    saving.value = false
  }
}

// === FINISH (fires after plan step) ===
async function handleFinish() {
  saving.value = true
  error.value = ''

  try {
    if (selectedPlan.value !== 'free') {
      await updateFamilyPlan(selectedPlan.value)
    }
    router.push('/family')
  } catch (err) {
    console.error('Error finishing onboarding:', err)
    error.value = err.message || 'Failed to update plan'
  } finally {
    saving.value = false
  }
}

// === SHARE ===
function goToPlanStep() {
  showShareScreen.value = false
  direction.value = 'forward'
  step.value = totalSteps.value // plan is always last
}

function copyInviteLink() {
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
  window.open(`mailto:${partnerEmail.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
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
</script>

<template>
  <div class="onboarding-container">
    <!-- Header (matches AppHeader) -->
    <header class="onboarding-header">
      <div class="header-left">
        <span class="header-title">Becket AI</span>
      </div>

      <div class="header-right">
        <div class="profile-container" @click.stop>
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
                  <span
                    class="lang-option"
                    :class="{ active: lang === 'en' }"
                    @click.stop="setLang('en')">English</span>
                  <span class="lang-divider">|</span>
                  <span
                    class="lang-option"
                    :class="{ active: lang === 'he' }"
                    @click.stop="setLang('he')">עברית</span>
                </div>
              </div>

              <div class="dropdown-item danger" @click="handleLogout">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                {{ t('logout') }}
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="onboarding-main">
      <Transition :name="direction === 'forward' ? 'slide-left' : 'slide-right'" mode="out-in">

        <!-- SHARE INTERSTITIAL -->
        <div v-if="showShareScreen" key="share" class="step-content share-interstitial">
          <div class="step-header">
            <h2 class="step-title">{{ t('inviteShareTitle') }}</h2>
            <p class="step-subtitle">{{ t('inviteShareDesc') }}</p>
          </div>

          <div class="share-card">
            <p class="share-email-label">{{ partnerEmail }}</p>

            <div class="share-link-row">
              <div class="share-link-text">{{ inviteLink }}</div>
              <button class="share-copy-btn" :class="{ copied: linkCopied }" @click="copyInviteLink">
                <component :is="linkCopied ? Check : Copy" :size="18" />
              </button>
            </div>

            <div class="share-action-buttons">
              <button class="share-action-btn whatsapp" @click="shareViaWhatsApp">
                <MessageCircle :size="22" />
                WhatsApp
              </button>
              <button class="share-action-btn email-btn" @click="shareViaEmail">
                <Mail :size="22" />
                Email
              </button>
              <button v-if="canNativeShare" class="share-action-btn native-btn" @click="shareNative">
                <Share2 :size="22" />
                {{ t('share') }}
              </button>
            </div>

            <p class="share-expires">{{ t('inviteExpires7Days') }}</p>
          </div>
        </div>

        <!-- STEP: TYPE SELECTION -->
        <div v-else-if="currentStepName === 'type'" key="type" class="step-content">
          <div class="step-header">
            <h2 class="step-title">{{ t('onb_whatBrings') }}</h2>
            <p class="step-subtitle">{{ t('onb_step1Sub') }}</p>
          </div>

          <div class="type-cards">
            <div class="type-card" :class="{ selected: familyType === 'separated' }" @click="selectFamilyType('separated')">
              <img src="@/assets/button_house2.png" alt="Separated" class="type-img" />
              <h3 class="type-title">{{ t('onb_separated') }}</h3>
              <p class="type-desc">{{ t('onb_separatedDesc') }}</p>
            </div>
            <div class="type-card" :class="{ selected: familyType === 'together' }" @click="selectFamilyType('together')">
              <img src="@/assets/button_house1.png" alt="Together" class="type-img" />
              <h3 class="type-title">{{ t('onb_together') }}</h3>
              <p class="type-desc">{{ t('onb_togetherDesc') }}</p>
            </div>
            <div class="type-card" :class="{ selected: familyType === 'solo' }" @click="selectFamilyType('solo')">
              <img src="@/assets/button_soloparent.png" alt="Solo" class="type-img" />
              <h3 class="type-title">{{ t('onb_solo') }}</h3>
              <p class="type-desc">{{ t('onb_soloDesc') }}</p>
            </div>
          </div>

          <!-- Agreement (inline — separated only) -->
          <div v-if="familyType === 'separated'" class="agreement-inline">
            <label class="section-label">{{ t('agreementLabel') }}</label>
            <div class="select-buttons">
              <button
                v-for="agree in ['agree1', 'agree2', 'agree3']"
                :key="agree"
                @click="agreementType = agree"
                :class="['select-btn', { active: agreementType === agree }]"
              >
                {{ t(agree) }}
              </button>
            </div>
          </div>
        </div>

        <!-- STEP: PROFILE (name + role + kids) -->
        <div v-else-if="currentStepName === 'profile'" key="profile" class="step-content">
          <div class="step-header">
            <h2 class="step-title">{{ t('onb_aboutYou') }}</h2>
            <p class="step-subtitle">{{ t('onb_step2Sub') }}</p>
          </div>

          <!-- Display Name -->
          <div class="form-section">
            <label class="input-label">{{ t('onb_yourName') }}</label>
            <input v-model="displayName" type="text" class="form-input" :placeholder="t('onb_namePlaceholder')" />
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

          <!-- Children list -->
          <div v-if="parentRole" class="children-list">
            <div v-for="(child, index) in children" :key="index" class="child-card-saved">
              <div class="child-saved-info">
                <div class="child-saved-thumb">
                  <img :src="child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'" :alt="child.name" />
                </div>
                <div>
                  <div class="child-saved-name">{{ child.name }}</div>
                  <div class="child-saved-meta">{{ child.dob }}</div>
                </div>
              </div>
              <div class="child-saved-actions">
                <button @click="editChild(index)" class="btn-edit">{{ t('edit') }}</button>
                <button @click="removeChild(index)" class="btn-remove-small">&times;</button>
              </div>
            </div>
          </div>

          <!-- Child Form (Add or Edit) -->
          <div v-if="parentRole && childDraft" class="child-form">
            <div class="child-form-header">
              <span class="child-number">{{ typeof childDraft._editIndex === 'number' ? `${t('edit')} #${childDraft._editIndex + 1}` : t('addChild') }}</span>
              <button @click="cancelChild" class="btn-remove">&times;</button>
            </div>
            <div class="form-row-single">
              <div class="form-group">
                <label class="input-label">{{ t('labelName') }}</label>
                <input v-model="childDraft.name" type="text" class="form-input" />
              </div>
            </div>
            <div class="form-row-single">
              <label class="input-label text-center">{{ t('boy') }} / {{ t('girl') }}</label>
              <div class="gender-buttons">
                <button
                  @click="childDraft.gender = 'boy'"
                  :class="['gender-btn', { active: childDraft.gender === 'boy' }]"
                >
                  <img src="@/assets/thumbnail_boy.png" alt="Boy" class="gender-img" />
                </button>
                <button
                  @click="childDraft.gender = 'girl'"
                  :class="['gender-btn', { active: childDraft.gender === 'girl' }]"
                >
                  <img src="@/assets/thumbnail_girl.png" alt="Girl" class="gender-img" />
                </button>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="input-label">{{ t('labelDob') }}</label>
                <input v-model="childDraft.dob" type="date" class="form-input" />
              </div>
              <div class="form-group">
                <label class="input-label">{{ t('labelMedical') }}</label>
                <input v-model="childDraft.medical" type="text" class="form-input" :placeholder="t('medPlaceholder')" />
              </div>
            </div>
            <button
              v-if="typeof childDraft._editIndex === 'number'"
              @click="updateChild"
              :disabled="!childDraft.name || !childDraft.gender || !childDraft.dob"
              class="btn-save-child"
            >
              {{ t('confirm') }}
            </button>
            <button
              v-else
              @click="saveChild"
              :disabled="!childDraft.name || !childDraft.gender || !childDraft.dob"
              class="btn-save-child"
            >
              {{ t('confirm') }}
            </button>
          </div>

          <button v-if="parentRole && !childDraft" @click="addChild" class="btn-add-child">
            + {{ t('addChild') }}
          </button>
        </div>

        <!-- STEP: HOW WILL YOU USE BECKET -->
        <div v-else-if="currentStepName === 'usage'" key="usage" class="step-content">
          <div class="step-header">
            <h2 class="step-title">{{ t('onb_usage') }}</h2>
            <p class="step-subtitle">{{ t('onb_usageSub') }}</p>
          </div>

          <div class="usage-cards">
            <div
              v-for="opt in dashboardOptions"
              :key="opt.key"
              class="usage-card"
              :class="{ selected: dashboardPrefs[opt.key] }"
              @click="toggleDashPref(opt.key)"
            >
              <img :src="`/assets/${opt.key}.png`" alt="" class="type-img" />
              <h3 class="type-title">{{ t('dash_' + opt.key) }}</h3>
              <p class="type-desc">{{ t('dash_' + opt.key + 'Desc') }}</p>
              <div class="usage-toggle" :class="{ on: dashboardPrefs[opt.key] }">
                <div class="usage-toggle-knob"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- STEP: CURRENCY + INVITE -->
        <div v-else-if="currentStepName === 'currency'" key="currency" class="step-content">
          <div class="step-header">
            <h2 class="step-title">{{ t('onb_almostDone') }}</h2>
            <p class="step-subtitle">{{ t('onb_step3Sub') }}</p>
          </div>

          <!-- Currency Selector -->
          <div class="form-section">
            <label class="section-label">{{ t('onb_currency') }}</label>
            <p class="section-hint">{{ t('onb_currencyDesc') }}</p>
            <div class="select-buttons">
              <button
                v-for="cur in ['NIS', 'USD', 'EUR', 'SGD']"
                :key="cur"
                @click="currency = cur"
                :class="['select-btn currency-btn', { active: currency === cur }]"
              >
                {{ cur === 'NIS' ? '₪ NIS' : cur === 'USD' ? '$ USD' : cur === 'EUR' ? '€ EUR' : 'S$ SGD' }}
              </button>
            </div>
          </div>

          <!-- Partner email (co-parent / together modes) -->
          <div v-if="mode === 'co-parent'" class="form-section">
            <label class="section-label">{{ t('onb_partnerEmail') }}</label>
            <p class="section-hint">{{ t('onb_inviteDesc') }}</p>
            <input
              v-model="partnerEmail"
              type="email"
              class="form-input"
              placeholder="partner@example.com"
            />
          </div>

          <!-- Solo note -->
          <p v-if="mode === 'solo'" class="solo-note">{{ t('onb_addContactsLater') }}</p>

          <!-- Error Message -->
          <div v-if="error" class="error-banner">
            {{ error }}
          </div>
        </div>

        <!-- STEP: PLAN SELECTION -->
        <div v-else-if="currentStepName === 'plan'" key="plan" class="step-content">
          <div class="step-header">
            <h2 class="step-title">{{ t('onb_choosePlan') }}</h2>
            <p class="step-subtitle">{{ t('onb_step4Sub') }}</p>
          </div>

          <!-- Welcome banner -->
          <div class="welcome-banner">
            <img src="/assets/becket_logo.png" alt="Becket AI" class="welcome-logo" />
          </div>

          <div class="plans-duo">
            <!-- Free Plan -->
            <div class="plan-card" :class="{ active: selectedPlan === 'free' }" @click="selectedPlan = 'free'">
              <img src="/assets/plan_free.png" alt="Free Plan" class="plan-img" />
              <div class="plan-card-header free-header">
                <h3>{{ t('freePlanName') }}</h3>
                <span class="plan-price">{{ t('freePlanPrice') }}</span>
              </div>
              <p class="plan-card-desc">{{ t('freePlanDesc') }}</p>
              <ul class="plan-feature-list">
                <li v-for="f in freePlanFeatures" :key="f">
                  <CheckCircle :size="16" class="feature-check" />
                  {{ t(f) }}
                </li>
              </ul>
            </div>

            <!-- AI Pro Plan (Coming Soon — not selectable) -->
            <div class="plan-card ai-card">
              <div class="plan-badge-coming">{{ t('comingSoonBadge') }}</div>
              <img src="/assets/plan_AI.png" alt="AI Pro Plan" class="plan-img" />
              <div class="plan-card-header ai-header">
                <h3>{{ t('aiPlanName') }}</h3>
                <span class="plan-price">{{ t('aiPlanPrice') }}</span>
              </div>
              <p class="plan-card-desc">{{ t('aiPlanDesc') }}</p>
              <ul class="plan-feature-list">
                <li v-for="f in aiPlanFeatures" :key="f">
                  <Sparkles :size="16" class="feature-sparkle" />
                  {{ t(f) }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="error-banner">
            {{ error }}
          </div>
        </div>

      </Transition>
    </main>

    <!-- Fixed Bottom Bar -->
    <div class="bottom-bar">
      <div class="progress-dots">
        <span v-for="n in totalSteps" :key="n" :class="['dot', { active: !showShareScreen && step === n, completed: showShareScreen ? n <= totalSteps - 1 : step > n }]"></span>
      </div>
      <div class="bottom-actions" :class="{ 'single-btn': step === 1 || showShareScreen }">
        <button v-if="!showShareScreen && step > 1" @click="prevStep"
          class="modal-primary-btn onb-back-btn" style="background: #0d9488">
          {{ t('onb_back') }}
        </button>

        <!-- Share screen: Continue to plans -->
        <button v-if="showShareScreen" @click="goToPlanStep"
          class="modal-primary-btn" style="background: #BD5B39">
          {{ t('onb_continue') }}
        </button>
        <!-- Currency step: Create Family -->
        <button v-else-if="currentStepName === 'currency'" @click="handleCreateFamily" :disabled="!canProceed || saving"
          class="modal-primary-btn" style="background: #BD5B39">
          {{ saving ? t('onb_saving') + '...' : t('onb_createFamily') }}
        </button>
        <!-- Plan step: Let's Go -->
        <button v-else-if="currentStepName === 'plan'" @click="handleFinish" :disabled="saving"
          class="modal-primary-btn" style="background: #BD5B39">
          {{ saving ? t('onb_saving') + '...' : t('onb_letsGo') }}
        </button>
        <!-- Other steps: Next -->
        <button v-else @click="nextStep" :disabled="!canProceed"
          class="modal-primary-btn" style="background: #BD5B39">
          {{ t('onb_next') }}
        </button>
      </div>
    </div>

    <!-- Copyright bar -->
    <div class="copyright-bar">All rights reserved to Rujum 2026 &copy;</div>
  </div>
</template>

<style scoped>
/* === LAYOUT === */
.onboarding-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--warm-linen, #FDFBF7);
  display: flex;
  flex-direction: column;
}

/* === HEADER (matches AppHeader) === */
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

.profile-container {
  position: relative;
}

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

.dropdown-item:hover {
  background-color: #f8fafc;
}

.dropdown-item.hover-none:hover {
  background-color: transparent;
  cursor: default;
}

.dropdown-item.danger {
  color: #dc2626;
  margin-top: 0.25rem;
  border-top: 1px solid #f1f5f9;
  padding-top: 0.75rem;
}

.dropdown-item.danger:hover {
  background-color: #fef2f2;
}

.dropdown-item.justify-between {
  justify-content: space-between;
}

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

.lang-option:hover {
  color: #64748b;
}

.lang-option.active {
  font-weight: 900;
  color: #1e293b;
}

.lang-divider {
  color: #cbd5e1;
}

/* Dropdown pop transition */
.pop-enter-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pop-leave-active {
  transition: all 0.15s ease-in;
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-4px);
}
.pop-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-2px);
}

/* === MAIN CONTENT === */
.onboarding-main {
  flex: 1;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  padding-bottom: 168px;
}

.step-content {
  width: 100%;
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

.step-hint {
  text-align: center;
  font-size: 0.8125rem;
  color: #94a3b8;
  margin-top: 1.25rem;
}

/* === TYPE SELECTION (Step 1 — 3 cards) === */
.type-cards {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.type-card {
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  padding: 1rem 0.5rem;
  border-radius: 1.25rem;
  border: 2px solid transparent;
}

.type-card:hover {
  transform: translateY(-2px);
}

.type-card.selected {
  border-color: #BD5B39;
  background: rgba(189, 91, 57, 0.04);
}

.type-img {
  width: 100%;
  max-width: 100px;
  height: auto;
  margin: 0 auto 0.75rem;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
}

.type-title {
  font-size: 0.9375rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
  color: #1A1C1E;
}

.type-desc {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.4;
}

/* === AGREEMENT INLINE (Type step — separated only) === */
.agreement-inline {
  margin-top: 2rem;
  text-align: center;
}

/* === FORM ELEMENTS === */
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

.form-section {
  margin-bottom: 2rem;
  text-align: center;
}

.section-label {
  display: block;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1A1C1E;
  margin-bottom: 0.75rem;
}

.section-hint {
  font-size: 0.8125rem;
  color: #94a3b8;
  margin: -0.5rem 0 0.75rem;
}

.currency-btn {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.solo-note {
  text-align: center;
  font-size: 0.875rem;
  color: #94a3b8;
  font-style: italic;
  margin-top: 1rem;
}

/* === CHALLENGE CARDS (Step 3) === */
.challenge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
  justify-content: center;
}

.challenge-card {
  padding: 0.75rem 1.25rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 2rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.challenge-card:hover {
  border-color: #BD5B39;
}

.challenge-card.active {
  background: #BD5B39;
  border-color: #BD5B39;
  color: white;
}

/* === USAGE CARDS (same layout as type cards + toggle) === */
.usage-cards {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.usage-cards:has(> :nth-child(3)) {
  grid-template-columns: 1fr 1fr 1fr;
}

.usage-cards:not(:has(> :nth-child(3))) {
  grid-template-columns: 1fr 1fr;
  max-width: 360px;
  margin-inline: auto;
}

.usage-card {
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  padding: 1rem 0.5rem 0.75rem;
  border-radius: 1.25rem;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.usage-card:hover {
  transform: translateY(-2px);
}

.usage-card.selected {
  border-color: #BD5B39;
  background: rgba(189, 91, 57, 0.04);
}

.usage-toggle {
  width: 2.75rem;
  height: 1.5rem;
  background: #e2e8f0;
  border-radius: 1rem;
  position: relative;
  transition: background 0.2s;
  margin-top: auto;
  flex-shrink: 0;
}

.usage-toggle.on {
  background: #BD5B39;
}

.usage-toggle-knob {
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

.usage-toggle.on .usage-toggle-knob {
  left: calc(100% - 1.3125rem);
}


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

/* === CHILDREN === */
.children-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.child-card-saved {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
  padding: 0.875rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.child-saved-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.child-saved-thumb {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.625rem;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.child-saved-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.child-saved-name {
  font-size: 1rem;
  font-weight: 700;
  color: #1A1C1E;
}

.child-saved-meta {
  font-size: 0.8125rem;
  color: #64748b;
}

.child-saved-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-edit {
  padding: 0.375rem 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit:hover { background: #f1f5f9; }

.btn-remove-small {
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 50%;
  font-size: 1.125rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-remove-small:hover { background: #fecaca; }

.child-form {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.child-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.child-number {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #BD5B39;
  text-transform: uppercase;
}

.btn-remove {
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 50%;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-remove:hover { background: #fecaca; }

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.form-row-single {
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.gender-buttons {
  display: flex;
  gap: 1.25rem;
  justify-content: center;
  margin-top: 0.5rem;
}

.gender-btn {
  width: 5.5rem;
  height: 5.5rem;
  border: 3px solid #e2e8f0;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.gender-btn:hover {
  transform: scale(1.05);
  border-color: #cbd5e1;
}

.gender-btn.active {
  border-color: #BD5B39;
  border-width: 4px;
  background: #fff7ed;
  transform: scale(1.08);
}

.gender-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.text-center { text-align: center; }

.btn-save-child {
  width: 100%;
  padding: 0.75rem;
  background: #0d9488;
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-weight: 700;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 0.75rem;
}

.btn-save-child:hover:not(:disabled) { background: #0f766e; }
.btn-save-child:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-add-child {
  width: 100%;
  padding: 0.875rem;
  background: #f0fdfa;
  border: 2px dashed #0d9488;
  border-radius: 0.75rem;
  color: #0d9488;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-child:hover {
  background: #ccfbf1;
  border-style: solid;
}

/* === HOUSE BUTTONS (Situation step) === */
.house-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.house-card {
  position: relative;
  display: block;
  cursor: pointer;
  text-align: center;
  border-radius: 1rem;
  border: 2px solid transparent;
  transition: all 0.2s;
  padding: 0.5rem;
}

.house-card input {
  position: absolute;
  opacity: 0;
}

.house-card:has(input:checked) {
  border-color: #BD5B39;
  background: rgba(189, 91, 57, 0.04);
}

.house-img {
  width: 100%;
  max-width: 120px;
  height: auto;
  margin: 0 auto 0.5rem;
  transition: all 0.2s;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
}

.house-card input:checked ~ .house-img {
  transform: scale(1.05);
  filter: drop-shadow(0 6px 16px rgba(189, 91, 57, 0.2));
}

.house-content { padding: 0.25rem; }

.house-content h4 {
  font-size: 1rem;
  font-weight: 700;
  color: #1A1C1E;
  margin-bottom: 0.25rem;
}

.house-content p {
  color: #64748b;
  font-size: 0.8125rem;
  line-height: 1.4;
}

/* === SELECT BUTTONS === */
.select-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.select-btn {
  padding: 0.625rem 1.5rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 2rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.select-btn:hover { border-color: #BD5B39; }

.select-btn.active {
  background: #BD5B39;
  border-color: #BD5B39;
  color: white;
}

/* === PLAN SELECTION === */
.plans-duo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.plan-card {
  position: relative;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1.25rem;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.plan-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.plan-card.active {
  border-color: #BD5B39;
  background: #fffbf5;
  box-shadow: 0 4px 16px rgba(189, 91, 57, 0.1);
}

.plan-img {
  width: 100%;
  max-width: 140px;
  height: auto;
  display: block;
  margin: 0 auto 1rem;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
}

.plan-card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
}

.free-header h3 {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0d9488;
  margin: 0;
}

.ai-header h3 {
  font-size: 1.25rem;
  font-weight: 800;
  color: #7c3aed;
  margin: 0;
}

.plan-price {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #64748b;
}

.plan-card-desc {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1rem;
  line-height: 1.4;
}

.plan-feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.plan-feature-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
}

.feature-check {
  color: #0d9488;
  flex-shrink: 0;
}

.feature-sparkle {
  color: #7c3aed;
  flex-shrink: 0;
}

.plan-badge-coming {
  position: absolute;
  top: -0.5rem;
  right: 1rem;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  color: white;
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
}

[dir="rtl"] .plan-badge-coming {
  right: auto;
  left: 1rem;
}

.ai-card {
  opacity: 0.8;
}

.ai-card:hover { opacity: 0.95; }

/* === WELCOME BANNER === */
.welcome-banner {
  text-align: center;
  margin-bottom: 1.5rem;
}

.welcome-logo {
  height: 3rem;
  margin: 0 auto 0.5rem;
  display: block;
  opacity: 0.2;
}

/* === ERROR BANNER === */
.error-banner {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  margin-top: 1rem;
}

/* === SHARE CARD === */
.share-interstitial {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.share-card {
  width: 100%;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1.25rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.share-email-label {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #475569;
  text-align: center;
  background: #fffbeb;
  padding: 0.625rem 1rem;
  border-radius: 0.625rem;
  border: 1px solid #fcd34d;
}

.share-link-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 0.625rem;
  padding: 0.375rem;
}

.share-link-text {
  flex: 1;
  font-size: 0.6875rem;
  color: #64748b;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.25rem 0.375rem;
  user-select: all;
}

.share-copy-btn {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
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

.share-copy-btn:hover {
  border-color: #cbd5e1;
  color: #334155;
}

.share-copy-btn.copied {
  background: #f0fdf4;
  border-color: #86efac;
  color: #16a34a;
}

.share-action-buttons {
  display: flex;
  gap: 0.5rem;
}

.share-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.share-action-btn.whatsapp {
  background: #dcfce7;
  color: #15803d;
}

.share-action-btn.whatsapp:hover { background: #bbf7d0; }

.share-action-btn.email-btn {
  background: #e0f2fe;
  color: #0369a1;
}

.share-action-btn.email-btn:hover { background: #bae6fd; }

.share-action-btn.native-btn {
  background: #f1f5f9;
  color: #334155;
}

.share-action-btn.native-btn:hover { background: #e2e8f0; }

.share-expires {
  font-size: 0.6875rem;
  color: #94a3b8;
  text-align: center;
  margin: 0;
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

/* Copyright bar */
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

.slide-left-enter-from {
  transform: translateX(40px);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-40px);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(40px);
  opacity: 0;
}

/* RTL transition flip */
[dir="rtl"] .slide-left-enter-from { transform: translateX(-40px); }
[dir="rtl"] .slide-left-leave-to { transform: translateX(40px); }
[dir="rtl"] .slide-right-enter-from { transform: translateX(40px); }
[dir="rtl"] .slide-right-leave-to { transform: translateX(-40px); }

/* === RESPONSIVE === */
@media (max-width: 480px) {
  .step-title {
    font-size: 1.5rem;
  }

  .type-cards {
    gap: 0.5rem;
  }

  .type-img {
    max-width: 70px;
  }

  .type-title {
    font-size: 0.8125rem;
  }

  .type-desc {
    font-size: 0.6875rem;
  }

  .house-img {
    max-width: 90px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .role-img {
    width: 4.5rem;
    height: 4.5rem;
  }

  .gender-btn {
    width: 4.5rem;
    height: 4.5rem;
  }
}

@media (min-width: 768px) {
  .onboarding-main {
    padding-top: 3rem;
    max-width: 640px;
  }

  .step-header {
    margin-bottom: 2.5rem;
  }

  .step-title {
    font-size: 2.25rem;
  }

  .step-subtitle {
    font-size: 1.125rem;
    max-width: 500px;
  }

  .type-img {
    max-width: 140px;
  }

  .type-title {
    font-size: 1.125rem;
  }

  .type-desc {
    font-size: 0.875rem;
  }

  .role-img {
    width: 7rem;
    height: 7rem;
  }

  .gender-btn {
    width: 7rem;
    height: 7rem;
  }

  .house-img {
    max-width: 160px;
  }

  .house-content h4 {
    font-size: 1.125rem;
  }

  .section-label {
    font-size: 1.0625rem;
  }

  .select-btn {
    padding: 0.75rem 1.5rem;
    font-size: 0.9375rem;
  }

  .plans-duo {
    flex-direction: row;
    gap: 1.25rem;
  }

  .plan-card {
    flex: 1;
    padding: 2rem;
  }

  .free-header h3,
  .ai-header h3 {
    font-size: 1.5rem;
  }

  .plan-feature-list li {
    font-size: 0.9375rem;
  }

  .bottom-actions {
    max-width: 640px;
  }
}
</style>
