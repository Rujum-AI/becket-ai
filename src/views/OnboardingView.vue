<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'
import { useFamily } from '@/composables/useFamily'
import { useFamilyStore } from '@/stores/family'
import { Sparkles } from 'lucide-vue-next'

const router = useRouter()
const { t, lang, toggleLang } = useI18n()
const { user, signOut } = useAuth()
const { createFamily } = useFamily()

async function handleLogout() {
  await signOut()
  router.push('/login')
}
const familyStore = useFamilyStore()

const step = ref(1)
const mode = ref('')
const partnerEmail = ref('')
const children = ref([])
const childDraft = ref(null) // Currently editing child
const homes = ref(1)
const relationshipStatus = ref('')
const agreementType = ref('')
const selectedPlan = ref('essential')

const plans = {
  essential: ['Core Dashboards', 'Child Tracking', 'Basic Expenses'],
  recommended: ['Core Dashboards', 'Child Tracking', 'Basic Expenses', 'Advanced Presence Insights', 'Context Preservation', 'Daily Briefings'],
  aiAssistant: ['Full AI Suite', 'Unlimited History', 'Mediator + Assistant'],
  aiMediator: ['Conflict Neutralizer', 'Agreement Integration', 'Tone Guidance']
}

function selectMode(selectedMode) {
  mode.value = selectedMode
  if (selectedMode === 'solo') {
    step.value = 2
  }
}

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

function nextStep() {
  if (step.value < 4) {
    step.value++
  }
}

function prevStep() {
  if (step.value > 1) {
    step.value--
  }
}

const saving = ref(false)
const error = ref('')

async function completeOnboarding() {
  if (!user.value) {
    error.value = 'User not authenticated'
    return
  }

  saving.value = true
  error.value = ''

  try {
    // Save to Supabase
    await createFamily(user.value.id, {
      mode: mode.value,
      partnerEmail: partnerEmail.value,
      children: children.value,
      homes: homes.value,
      relationshipStatus: relationshipStatus.value,
      agreementType: agreementType.value,
      selectedPlan: selectedPlan.value
    })

    // Also save to localStorage for backward compatibility
    familyStore.saveOnboarding({
      mode: mode.value,
      partnerEmail: partnerEmail.value,
      children: children.value,
      homes: homes.value,
      relationshipStatus: relationshipStatus.value,
      agreementType: agreementType.value,
      selectedPlan: selectedPlan.value
    })

    router.push('/family')
  } catch (err) {
    console.error('Error completing onboarding:', err)
    error.value = err.message || 'Failed to save family data'
  } finally {
    saving.value = false
  }
}

const canProceed = computed(() => {
  if (step.value === 1) {
    if (mode.value === '') return false
    if (mode.value === 'co-parent' && !partnerEmail.value) return false
    return true
  }
  if (step.value === 2) return children.value.length > 0 && !childDraft.value
  if (step.value === 3) return homes.value && relationshipStatus.value && agreementType.value
  return true
})

const relationshipOptions = computed(() => {
  if (mode.value === 'solo') {
    return ['together']
  }
  return ['together', 'apart', 'separated']
})
</script>

<template>
  <div class="onboarding-container">
    <!-- Header -->
    <nav class="onboarding-nav">
      <button @click="toggleLang" class="lang-toggle">
        {{ lang === 'en' ? 'עברית' : 'English' }}
      </button>
      <div class="logo-container">
        <div class="logo-icon">
          <Sparkles :size="20" :stroke-width="2" />
        </div>
        <span class="logo-text">Becket AI</span>
      </div>
      <button @click="handleLogout" class="logout-btn">
        {{ t('logout') }}
      </button>
    </nav>

    <!-- Main Content -->
    <main class="onboarding-main">
      <!-- Step 1: Mode Selection -->
      <div v-if="step === 1" class="step-content">
        <div class="step-header">
          <h2 class="step-title">{{ t('step1Title') }}</h2>
          <p class="step-subtitle">{{ t('step1Sub') }}</p>
        </div>

        <div class="mode-cards-images">
          <div class="mode-card-image" @click="selectMode('solo')">
            <img src="@/assets/button_soloparent.png" alt="Solo Parent" class="mode-img" />
            <h3 class="mode-title-img">{{ t('soloTitle') }}</h3>
            <p class="mode-desc">{{ t('soloDesc') }}</p>
          </div>
          <div class="mode-card-image" @click="mode = 'co-parent'">
            <img src="@/assets/button_coparents.png" alt="Co-Parents" class="mode-img" />
            <h3 class="mode-title-img">{{ t('coTitle') }}</h3>
            <p class="mode-desc">{{ t('coDesc') }}</p>
          </div>
        </div>

        <div v-if="mode === 'co-parent'" class="email-section">
          <label class="input-label">{{ t('partnerEmail') }}</label>
          <input
            v-model="partnerEmail"
            type="email"
            class="email-input"
            placeholder="partner@example.com"
            @keyup.enter="canProceed && nextStep()"
          />
          <button @click="nextStep" :disabled="!canProceed" class="btn-primary">
            {{ t('next') }} →
          </button>
        </div>
      </div>

      <!-- Step 2: Children -->
      <div v-if="step === 2" class="step-content">
        <div class="step-header">
          <h2 class="step-title">{{ t('step2Title') }}</h2>
          <p class="step-subtitle">{{ t('step2Sub') }}</p>
        </div>

        <!-- Saved Children List -->
        <div class="children-list">
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
              <button @click="removeChild(index)" class="btn-remove-small">×</button>
            </div>
          </div>
        </div>

        <!-- Child Form (Add or Edit) -->
        <div v-if="childDraft" class="child-form">
          <div class="child-form-header">
            <span class="child-number">{{ typeof childDraft._editIndex === 'number' ? `${t('edit')} #${childDraft._editIndex + 1}` : t('addChild') }}</span>
            <button @click="cancelChild" class="btn-remove">×</button>
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
            ✓ {{ t('confirm') }}
          </button>
          <button
            v-else
            @click="saveChild"
            :disabled="!childDraft.name || !childDraft.gender || !childDraft.dob"
            class="btn-save-child"
          >
            ✓ {{ t('confirm') }}
          </button>
        </div>

        <button v-if="!childDraft" @click="addChild" class="btn-add-child">
          + {{ t('addChild') }}
        </button>

        <div class="step-actions">
          <button @click="prevStep" class="btn-secondary">← {{ t('back') }}</button>
          <button @click="nextStep" :disabled="!canProceed" class="btn-primary">{{ t('next') }} →</button>
        </div>
      </div>

      <!-- Step 3: Operational Framework -->
      <div v-if="step === 3" class="step-content">
        <div class="step-header">
          <h2 class="step-title">{{ t('step3Title') }}</h2>
          <p class="step-subtitle">{{ t('step3Sub') }}</p>
        </div>

        <div class="form-section">
          <label class="section-label">Household Structure</label>
          <div class="house-buttons">
            <label class="house-card">
              <input type="radio" v-model="homes" :value="1" />
              <img src="@/assets/button_house1.png" alt="Single Home" class="house-img" />
              <div class="house-content">
                <h4>{{ t('singleHome') }}</h4>
                <p>{{ t('singleHomeDesc') }}</p>
              </div>
            </label>
            <label class="house-card">
              <input type="radio" v-model="homes" :value="2" />
              <img src="@/assets/button_house2.png" alt="Dual Home" class="house-img" />
              <div class="house-content">
                <h4>{{ t('dualHome') }}</h4>
                <p>{{ t('dualHomeDesc') }}</p>
              </div>
            </label>
          </div>
        </div>

        <div class="form-section">
          <label class="section-label">{{ t('relLabel') }}</label>
          <div class="select-buttons">
            <button
              v-for="status in relationshipOptions"
              :key="status"
              @click="relationshipStatus = status"
              :class="['select-btn', { active: relationshipStatus === status }]"
            >
              {{ t(status) }}
            </button>
          </div>
        </div>

        <div class="form-section">
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

        <div class="step-actions">
          <button @click="prevStep" class="btn-secondary">← {{ t('back') }}</button>
          <button @click="nextStep" :disabled="!canProceed" class="btn-primary">{{ t('next') }} →</button>
        </div>
      </div>

      <!-- Step 4: Plan Selection -->
      <div v-if="step === 4" class="step-content">
        <div class="step-header">
          <h2 class="step-title">{{ t('step4Title') }}</h2>
          <p class="step-subtitle">Choose your plan</p>
        </div>

        <div class="plans-grid">
          <div
            v-for="(planName, planKey) in { essential: 'Essential', recommended: 'Recommended', aiAssistant: 'AI Assistant', aiMediator: 'AI Mediator' }"
            :key="planKey"
            @click="selectedPlan = planKey"
            :class="['plan-card', { active: selectedPlan === planKey, recommended: planKey === 'recommended' }]"
          >
            <div class="plan-header">
              <h3 class="plan-name">{{ t(planName) }}</h3>
              <span v-if="planKey === 'recommended'" class="plan-badge">{{ t('recommended') }}</span>
            </div>
            <ul class="plan-features">
              <li v-for="feature in plans[planKey]" :key="feature">{{ t(feature) }}</li>
            </ul>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
          {{ error }}
        </div>

        <div class="step-actions">
          <button @click="prevStep" class="btn-secondary" :disabled="saving">← {{ t('back') }}</button>
          <button @click="completeOnboarding" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : t('complete') + ' ✓' }}
          </button>
        </div>
      </div>
    </main>

    <!-- Progress Indicator -->
    <div class="progress-dots">
      <span v-for="n in 4" :key="n" :class="['dot', { active: step === n, completed: step > n }]"></span>
    </div>
  </div>
</template>

<style scoped>
.onboarding-container {
  min-height: 100vh;
  background: var(--warm-linen);
  padding-bottom: 4rem;
}

.onboarding-nav {
  padding: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.lang-toggle {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  width: 6rem;
  text-align: left;
  transition: color 0.2s;
}

.lang-toggle:hover {
  color: #1e293b;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  width: 2.5rem;
  height: 2.5rem;
  background: #1A1C1E;
  border-radius: 0.75rem;
  transform: rotate(3deg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  color: white;
}

.logo-text {
  font-size: 1.5rem;
  font-family: 'Fraunces', serif;
  letter-spacing: -0.5px;
}

.logout-btn {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  width: 6rem;
  text-align: right;
  transition: color 0.2s;
}

.logout-btn:hover {
  color: #ef4444;
}

.onboarding-main {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 2rem;
}

.step-content {
  margin-top: 3rem;
}

.step-header {
  text-align: center;
  margin-bottom: 3rem;
}

.step-title {
  font-size: 2.5rem;
  font-family: 'Fraunces', serif;
  margin-bottom: 1rem;
  color: #1A1C1E;
}

.step-subtitle {
  font-size: 1.125rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

.mode-cards-images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.mode-card-image {
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.mode-card-image:hover {
  transform: scale(1.05);
}

.mode-img {
  width: 100%;
  max-width: 300px;
  height: auto;
  margin: 0 auto 1rem;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
}

.mode-title-img {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #1A1C1E;
}

.mode-desc {
  color: #64748b;
  line-height: 1.6;
}

.email-section {
  max-width: 400px;
  margin: 2rem auto;
  text-align: center;
}

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
  text-align: left;
}

.email-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 0.75rem;
  font-size: 1rem;
  margin-bottom: 1rem;
  transition: border-color 0.2s;
}

.email-input:focus {
  outline: none;
  border-color: #BD5B39;
}

.children-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.child-card-saved {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1rem;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.child-saved-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.child-saved-thumb {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  background: white;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.child-saved-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.child-saved-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1A1C1E;
}

.child-saved-meta {
  font-size: 0.875rem;
  color: #64748b;
}

.child-saved-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-edit {
  padding: 0.5rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit:hover {
  background: #f1f5f9;
}

.btn-remove-small {
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

.btn-remove-small:hover {
  background: #fecaca;
}

.child-form {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1.5rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.child-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.child-number {
  font-size: 0.875rem;
  font-weight: 700;
  color: #BD5B39;
  text-transform: uppercase;
}

.btn-remove {
  width: 2rem;
  height: 2rem;
  border: none;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 50%;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-remove:hover {
  background: #fecaca;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-row-single {
  margin-bottom: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.gender-buttons {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  margin-top: 0.5rem;
}

.gender-btn {
  width: 7rem;
  height: 7rem;
  border: 3px solid #e2e8f0;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0.5rem;
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
  transform: scale(1.1);
}

.gender-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.text-center {
  text-align: center;
}

.form-input {
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 0.75rem;
  font-size: 0.9375rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #BD5B39;
}

.btn-save-child {
  width: 100%;
  padding: 0.875rem;
  background: #0d9488;
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 1rem;
}

.btn-save-child:hover:not(:disabled) {
  background: #0f766e;
}

.btn-save-child:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-add-child {
  width: 100%;
  padding: 1rem;
  background: #f0fdfa;
  border: 2px dashed #0d9488;
  border-radius: 0.75rem;
  color: #0d9488;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 2rem;
}

.btn-add-child:hover {
  background: #ccfbf1;
  border-style: solid;
}

.form-section {
  margin-bottom: 2.5rem;
}

.section-label {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  color: #1A1C1E;
  margin-bottom: 1rem;
}

.house-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.house-card {
  position: relative;
  display: block;
  cursor: pointer;
  text-align: center;
}

.house-card input {
  position: absolute;
  opacity: 0;
}

.house-img {
  width: 100%;
  max-width: 200px;
  height: auto;
  margin: 0 auto 1rem;
  transition: all 0.2s;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
}

.house-card input:checked ~ .house-img {
  transform: scale(1.1);
  filter: drop-shadow(0 8px 24px rgba(189, 91, 57, 0.3));
}

.house-content {
  padding: 1rem;
}

.house-content h4 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1A1C1E;
  margin-bottom: 0.5rem;
}

.house-content p {
  color: #64748b;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.select-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.select-btn {
  padding: 0.75rem 1.5rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 2rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.select-btn:hover {
  border-color: #BD5B39;
}

.select-btn.active {
  background: #BD5B39;
  border-color: #BD5B39;
  color: white;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.plan-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1.5rem;
  padding: 2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.plan-card:hover {
  border-color: #BD5B39;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(189, 91, 57, 0.15);
}

.plan-card.active {
  border-color: #BD5B39;
  background: #fff7ed;
}

.plan-card.recommended {
  border-color: #0d9488;
}

.plan-card.recommended.active {
  border-color: #0d9488;
  background: #f0fdfa;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.plan-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1A1C1E;
}

.plan-badge {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #0d9488;
  background: #ccfbf1;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
}

.plan-features {
  list-style: none;
  padding: 0;
}

.plan-features li {
  padding: 0.5rem 0;
  color: #475569;
  font-size: 0.9375rem;
  border-bottom: 1px solid #f1f5f9;
}

.plan-features li:last-child {
  border-bottom: none;
}

.step-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 3rem;
}

.btn-primary, .btn-secondary {
  padding: 1rem 2rem;
  border-radius: 2rem;
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: #1A1C1E;
  color: white;
  flex: 1;
}

.btn-primary:hover:not(:disabled) {
  background: #2d3033;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #475569;
  border: 2px solid #e2e8f0;
}

.btn-secondary:hover {
  border-color: #cbd5e1;
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 3rem;
  padding: 2rem 0;
}

.dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background: #e2e8f0;
  transition: all 0.3s;
}

.dot.active {
  background: #BD5B39;
  transform: scale(1.2);
}

.dot.completed {
  background: #0d9488;
}
</style>
