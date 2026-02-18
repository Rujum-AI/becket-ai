import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useFamily } from '@/composables/useFamily'
import { DEV_BYPASS } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      redirect: '/'
    },
    {
      path: '/landing',
      redirect: '/'
    },
    {
      path: '/',
      name: 'landing',
      component: () => import('@/views/LandingView.vue'),
      meta: { public: true }
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingView.vue'),
      meta: { requiresAuth: true, requiresNoFamily: true }
    },
    {
      path: '/family',
      name: 'family',
      component: () => import('@/views/FamilyView.vue'),
      meta: { requiresAuth: true, requiresFamily: true }
    },
    {
      path: '/finance',
      name: 'finance',
      component: () => import('@/views/FinanceView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/management',
      name: 'management',
      component: () => import('@/views/ManagementView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/trustees',
      name: 'trustees',
      component: () => import('@/views/TrusteesView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/understandings',
      name: 'understandings',
      component: () => import('@/views/UnderstandingsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/updates',
      name: 'updates',
      component: () => import('@/views/UpdatesView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/subscription',
      name: 'subscription',
      component: () => import('@/views/SubscriptionView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
      meta: { public: true }
    },
    {
      path: '/invite/:token',
      name: 'invite',
      component: () => import('@/views/InviteAcceptView.vue'),
      meta: { public: true }
    }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

// Auth guard
router.beforeEach(async (to, from, next) => {
  console.log('🛣️ Router guard:', { to: to.path, from: from.path, hash: to.hash, query: to.query })

  // Dev bypass — skip all auth/family checks, allow all routes
  if (DEV_BYPASS) {
    if (to.path === '/') {
      next('/onboarding')
      return
    }
    next()
    return
  }

  // Check if this is an OAuth or password reset callback (has auth tokens in URL)
  const hasAuthParams = to.hash.includes('access_token') || to.query.code

  if (hasAuthParams) {
    console.log('✅ Auth callback detected, allowing route')
    next()
    return
  }

  const { data: { session } } = await supabase.auth.getSession()
  console.log('🔑 Session:', session ? 'EXISTS' : 'NONE')

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresFamily = to.matched.some(record => record.meta.requiresFamily)
  const requiresNoFamily = to.matched.some(record => record.meta.requiresNoFamily)
  const isPublic = to.matched.some(record => record.meta.public)

  // Not authenticated
  if (requiresAuth && !session) {
    console.log('❌ Protected route, no session -> /')
    next('/')
    return
  }

  // Already logged in, trying to access landing — send to app
  if (isPublic && session && to.path === '/') {
    console.log('✅ Already logged in, checking family status')
    const { checkUserFamily } = useFamily()
    const hasFamily = await checkUserFamily(session.user.id)
    next(hasFamily ? '/family' : '/onboarding')
    return
  }

  // Check family requirement
  if (session && (requiresFamily || requiresNoFamily)) {
    const { checkUserFamily } = useFamily()
    const hasFamily = await checkUserFamily(session.user.id)

    console.log('👨‍👩‍👧‍👦 Has family:', hasFamily)

    if (requiresFamily && !hasFamily) {
      console.log('❌ Requires family, but none found -> /onboarding')
      next('/onboarding')
      return
    }

    if (requiresNoFamily && hasFamily && !to.query.preview) {
      console.log('❌ Requires no family, but has one -> /family')
      next('/family')
      return
    }
  }

  console.log('✅ Allowing navigation')
  next()
})

export default router
