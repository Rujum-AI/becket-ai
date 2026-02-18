import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFamilyStore = defineStore('family', () => {
  const mode = ref(sessionStorage.getItem('family_mode') || '')
  const partnerEmail = ref(sessionStorage.getItem('partner_email') || '')
  const children = ref(JSON.parse(sessionStorage.getItem('family_children') || '[]'))
  const homes = ref(parseInt(sessionStorage.getItem('family_homes') || '1'))
  const relationshipStatus = ref(sessionStorage.getItem('relationship_status') || '')
  const agreementType = ref(sessionStorage.getItem('agreement_type') || '')
  const selectedPlan = ref(sessionStorage.getItem('selected_plan') || 'essential')

  function saveOnboarding(data) {
    mode.value = data.mode
    partnerEmail.value = data.partnerEmail || ''
    children.value = data.children
    homes.value = data.homes
    relationshipStatus.value = data.relationshipStatus
    agreementType.value = data.agreementType
    selectedPlan.value = data.selectedPlan

    // Persist to sessionStorage (cleared when browser closes)
    sessionStorage.setItem('family_mode', data.mode)
    sessionStorage.setItem('partner_email', data.partnerEmail || '')
    sessionStorage.setItem('family_children', JSON.stringify(data.children))
    sessionStorage.setItem('family_homes', data.homes.toString())
    sessionStorage.setItem('relationship_status', data.relationshipStatus)
    sessionStorage.setItem('agreement_type', data.agreementType)
    sessionStorage.setItem('selected_plan', data.selectedPlan)
    sessionStorage.setItem('onboarding_complete', 'true')
  }

  function isOnboardingComplete() {
    return sessionStorage.getItem('onboarding_complete') === 'true'
  }

  return {
    mode,
    partnerEmail,
    children,
    homes,
    relationshipStatus,
    agreementType,
    selectedPlan,
    saveOnboarding,
    isOnboardingComplete
  }
})
