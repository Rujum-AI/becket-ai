import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFamilyStore = defineStore('family', () => {
  const mode = ref(sessionStorage.getItem('family_mode') || '')
  const familyType = ref(sessionStorage.getItem('family_type') || '')
  const partnerEmail = ref(sessionStorage.getItem('partner_email') || '')
  const children = ref(JSON.parse(sessionStorage.getItem('family_children') || '[]'))
  const homes = ref(parseInt(sessionStorage.getItem('family_homes') || '1'))
  const relationshipStatus = ref(sessionStorage.getItem('relationship_status') || '')
  const agreementType = ref(sessionStorage.getItem('agreement_type') || '')
  const selectedPlan = ref(sessionStorage.getItem('selected_plan') || 'essential')
  const dashboardPrefs = ref(JSON.parse(sessionStorage.getItem('dashboard_prefs') || '{"finance":true,"management":true,"understandings":true}'))
  const challenges = ref(JSON.parse(sessionStorage.getItem('family_challenges') || '[]'))

  function saveOnboarding(data) {
    mode.value = data.mode
    familyType.value = data.familyType || ''
    partnerEmail.value = data.partnerEmail || ''
    children.value = data.children
    homes.value = data.homes
    relationshipStatus.value = data.relationshipStatus
    agreementType.value = data.agreementType
    selectedPlan.value = data.selectedPlan
    dashboardPrefs.value = data.dashboardPrefs || { finance: true, management: true, understandings: true }
    challenges.value = data.challenges || []

    // Persist to sessionStorage (cleared when browser closes)
    sessionStorage.setItem('family_mode', data.mode)
    sessionStorage.setItem('family_type', data.familyType || '')
    sessionStorage.setItem('partner_email', data.partnerEmail || '')
    sessionStorage.setItem('family_children', JSON.stringify(data.children))
    sessionStorage.setItem('family_homes', data.homes.toString())
    sessionStorage.setItem('relationship_status', data.relationshipStatus)
    sessionStorage.setItem('agreement_type', data.agreementType)
    sessionStorage.setItem('selected_plan', data.selectedPlan)
    sessionStorage.setItem('dashboard_prefs', JSON.stringify(data.dashboardPrefs || {}))
    sessionStorage.setItem('family_challenges', JSON.stringify(data.challenges || []))
    sessionStorage.setItem('onboarding_complete', 'true')
  }

  function isOnboardingComplete() {
    return sessionStorage.getItem('onboarding_complete') === 'true'
  }

  return {
    mode,
    familyType,
    partnerEmail,
    children,
    homes,
    relationshipStatus,
    agreementType,
    selectedPlan,
    dashboardPrefs,
    challenges,
    saveOnboarding,
    isOnboardingComplete
  }
})
