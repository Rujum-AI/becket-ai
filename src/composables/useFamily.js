import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

// Singleton pattern - shared state across all useFamily() calls
const family = ref(null)
const children = ref([])
const loading = ref(false)
const userRole = ref(null) // 'admin' or 'member'
const pendingInvite = ref(null) // { email, token } — cached so modal can access without DB query

// Generate a random hex token (64 chars = 32 bytes)
function generateToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

// Concurrency guard - prevents multiple simultaneous calls
let checkInProgress = null

export function useFamily() {

  // Fetch children for the current family
  async function fetchChildren() {
    if (!family.value?.id) {
      children.value = []
      return
    }

    try {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('family_id', family.value.id)
        .order('created_at')

      if (error) throw error
      children.value = data || []
    } catch (error) {
      console.error('Error fetching children:', error)
      children.value = []
    }
  }

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
        await fetchChildren()
        return true
      }

      // If no family, check for pending invitations via RPC
      // Use getSession() (local, no network call) instead of getUser() (network, can 403)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const userEmail = currentSession?.user?.email

      console.log('👤 No family found for user:', userId)

      if (userEmail) {
        // Call RPC function (SECURITY DEFINER bypasses RLS)
        // Email is now read from auth.email() inside the function — not passed as parameter
        const { data: result, error: rpcError } = await supabase
          .rpc('accept_pending_invitation', {
            p_user_id: userId
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
            await fetchChildren()
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
        'free': 'essential',
        'ai': 'ai-assistant',
        'essential': 'essential',
        'recommended': 'essential',
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
          currency: onboardingData.currency || 'NIS'
        })
        .select()
        .single()

      if (familyError) throw familyError

      // Ensure profile exists (handles edge cases where trigger didn't fire)
      const { error: profileError } = await supabase.rpc('ensure_profile_exists')
      if (profileError) console.warn('ensure_profile_exists warning:', profileError.message)

      // Add user as family member
      const { error: memberError } = await supabase
        .from('family_members')
        .insert({
          family_id: familyData.id,
          profile_id: userId,
          parent_label: onboardingData.parentRole || 'dad',
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

      // If co-parent mode, create invitation via atomic RPC
      let inviteToken = null
      if (onboardingData.mode === 'co-parent' && onboardingData.partnerEmail) {
        inviteToken = generateToken()

        const { data: invResult, error: inviteError } = await supabase.rpc('create_family_invitation', {
          p_family_id: familyData.id,
          p_email: onboardingData.partnerEmail,
          p_token: inviteToken
        })

        if (inviteError) throw inviteError
        if (!invResult?.success) {
          console.warn('Invitation creation failed:', invResult?.reason)
        }

        // Cache for the invite modal to pick up
        pendingInvite.value = { email: onboardingData.partnerEmail, token: inviteToken }

        // Send invite email (fire and forget)
        const { data: { session } } = await supabase.auth.getSession()
        const inviterName = session?.user?.user_metadata?.display_name
          || session?.user?.email?.split('@')[0]
          || 'Your co-parent'
        supabase.functions.invoke('send-invite-email', {
          body: {
            email: onboardingData.partnerEmail,
            inviterName,
            token: inviteToken
          }
        }).catch(() => {})
      }

      family.value = familyData
      await fetchChildren()
      return { ...familyData, _inviteToken: inviteToken }
    } catch (error) {
      console.error('Error creating family:', error)
      throw error
    }
  }

  async function updateFamilyPlan(planValue) {
    if (!family.value?.id) return
    const planMap = { 'free': 'essential', 'ai': 'ai-assistant' }
    const mapped = planMap[planValue] || 'essential'
    const { error } = await supabase
      .from('families')
      .update({ plan: mapped })
      .eq('id', family.value.id)
    if (error) throw error
    family.value = { ...family.value, plan: mapped }
  }

  return {
    family,
    children,
    loading,
    userRole,
    pendingInvite,
    checkUserFamily,
    createFamily,
    updateFamilyPlan,
    fetchChildren
  }
}
