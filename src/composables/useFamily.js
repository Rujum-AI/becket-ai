import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

// Singleton pattern - shared state across all useFamily() calls
const family = ref(null)
const loading = ref(false)
const userRole = ref(null) // 'admin' or 'member'

// Concurrency guard - prevents multiple simultaneous calls
let checkInProgress = null

export function useFamily() {

  // Check if user belongs to a family or has pending invitations
  async function checkUserFamily(userId) {
    // If a check is already running, return its promise instead of starting another
    if (checkInProgress) {
      console.log('⏳ checkUserFamily already in progress, reusing existing call')
      return checkInProgress
    }

    checkInProgress = _doCheckUserFamily(userId)
    try {
      return await checkInProgress
    } finally {
      checkInProgress = null
    }
  }

  async function _doCheckUserFamily(userId) {
    loading.value = true
    try {
      // Check family_members table
      const { data, error } = await supabase
        .from('family_members')
        .select(`
          family_id,
          parent_label,
          role,
          families (*)
        `)
        .eq('profile_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      // If user already has a family, return it
      if (data) {
        family.value = data.families
        userRole.value = data.role
        return true
      }

      // If no family, check for pending invitations via RPC
      // Use getSession() (local, no network call) instead of getUser() (network, can 403)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const userEmail = currentSession?.user?.email

      console.log('👤 No family found for user:', userId)
      console.log('📧 User email from auth:', userEmail)

      if (userEmail) {
        // Call RPC function (SECURITY DEFINER bypasses RLS)
        const { data: result, error: rpcError } = await supabase
          .rpc('accept_pending_invitation', {
            user_id: userId,
            user_email: userEmail.toLowerCase()
          })

        if (rpcError) {
          console.error('❌ RPC error:', rpcError.message, rpcError)
        } else {
          console.log('📩 Invitation RPC result:', result)
        }

        if (result?.accepted) {
          console.log('✅ Invitation accepted! Joining family:', result.family_id)
          // Re-check family membership
          const { data: familyData } = await supabase
            .from('family_members')
            .select(`
              family_id,
              parent_label,
              role,
              families (*)
            `)
            .eq('profile_id', userId)
            .single()

          if (familyData) {
            family.value = familyData.families
            userRole.value = familyData.role
            return true
          }
        } else {
          console.log('📭 No pending invitation found for:', userEmail)
        }
      } else {
        console.log('⚠️ Could not get user email from auth')
      }

      family.value = null
      userRole.value = null
      return false
    } catch (error) {
      console.error('Error checking family:', error)
      return false
    } finally {
      loading.value = false
    }
  }

  // Create a new family from onboarding data
  async function createFamily(userId, onboardingData) {
    try {
      // Map UI values to database values
      const agreementBasisMap = {
        'agree1': 'formal',
        'agree2': 'verbal',
        'agree3': 'building'
      }

      const relationshipStatusMap = {
        'together': 'together',
        'apart': 'apart',
        'separated': 'separated'
      }

      const planMap = {
        'essential': 'essential',
        'recommended': 'essential', // Map recommended to essential for now
        'aiAssistant': 'ai-assistant',
        'aiMediator': 'ai-mediator',
        'full': 'full'
      }

      // Create family
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .insert({
          mode: onboardingData.mode,
          home_count: onboardingData.homes,
          relationship_status: relationshipStatusMap[onboardingData.relationshipStatus] || onboardingData.relationshipStatus,
          agreement_basis: agreementBasisMap[onboardingData.agreementType] || onboardingData.agreementType,
          plan: planMap[onboardingData.selectedPlan] || 'essential',
          currency: 'NIS'
        })
        .select()
        .single()

      if (familyError) throw familyError

      // Add user as family member
      const { error: memberError } = await supabase
        .from('family_members')
        .insert({
          family_id: familyData.id,
          profile_id: userId,
          parent_label: 'dad', // Default, can be updated later
          role: 'admin'
        })

      if (memberError) throw memberError

      // Create children
      if (onboardingData.children && onboardingData.children.length > 0) {
        const { error: childrenError } = await supabase
          .from('children')
          .insert(
            onboardingData.children.map(child => ({
              family_id: familyData.id,
              name: child.name,
              gender: child.gender,
              date_of_birth: child.dob,
              medical_notes: child.medical
            }))
          )

        if (childrenError) throw childrenError
      }

      // If co-parent mode, create invitation
      if (onboardingData.mode === 'co-parent' && onboardingData.partnerEmail) {
        const { error: inviteError } = await supabase
          .from('invitations')
          .insert({
            family_id: familyData.id,
            email: onboardingData.partnerEmail,
            status: 'pending'
          })

        if (inviteError) throw inviteError
      }

      family.value = familyData
      return familyData
    } catch (error) {
      console.error('Error creating family:', error)
      throw error
    }
  }

  return {
    family,
    loading,
    userRole,
    checkUserFamily,
    createFamily
  }
}
