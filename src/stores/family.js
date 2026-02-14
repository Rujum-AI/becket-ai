import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFamilyStore = defineStore('family', () => {
  const mode = ref(localStorage.getItem('family_mode') || '')
  const partnerEmail = ref(localStorage.getItem('partner_email') || '')
  const children = ref(JSON.parse(localStorage.getItem('family_children') || '[]'))
  const homes = ref(parseInt(localStorage.getItem('family_homes') || '1'))
  const relationshipStatus = ref(localStorage.getItem('relationship_status') || '')
  const agreementType = ref(localStorage.getItem('agreement_type') || '')
  const selectedPlan = ref(localStorage.getItem('selected_plan') || 'essential')

  function saveOnboarding(data) {
    mode.value = data.mode
    partnerEmail.value = data.partnerEmail || ''
    children.value = data.children
    homes.value = data.homes
    relationshipStatus.value = data.relationshipStatus
    agreementType.value = data.agreementType
    selectedPlan.value = data.selectedPlan

    // Persist to localStorage
    localStorage.setItem('family_mode', data.mode)
    localStorage.setItem('partner_email', data.partnerEmail || '')
    localStorage.setItem('family_children', JSON.stringify(data.children))
    localStorage.setItem('family_homes', data.homes.toString())
    localStorage.setItem('relationship_status', data.relationshipStatus)
    localStorage.setItem('agreement_type', data.agreementType)
    localStorage.setItem('selected_plan', data.selectedPlan)
    localStorage.setItem('onboarding_complete', 'true')
  }

  function isOnboardingComplete() {
    return localStorage.getItem('onboarding_complete') === 'true'
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
