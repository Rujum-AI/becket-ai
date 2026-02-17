<script setup>
import { onMounted, watch } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import { CheckCircle, Sparkles } from 'lucide-vue-next'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseSubscriptionStore } from '@/stores/supabaseSubscription'
import { useFamily } from '@/composables/useFamily'

const { t } = useI18n()
const subStore = useSupabaseSubscriptionStore()
const { family } = useFamily()

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

function loadData() {
  if (family.value) {
    subStore.loadSubscription()
    subStore.loadPaymentHistory()
  }
}

onMounted(() => loadData())
watch(family, (f) => { if (f) loadData() })

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function formatAmount(cents) {
  if (!cents) return '$0'
  return `$${(cents / 100).toFixed(2)}`
}

function eventLabel(type) {
  const map = {
    subscription_created: 'subEventCreated',
    subscription_updated: 'subEventUpdated',
    subscription_cancelled: 'subEventCancelled',
    subscription_resumed: 'subEventResumed',
    subscription_expired: 'subEventExpired',
    subscription_paused: 'subEventPaused',
    subscription_unpaused: 'subEventUnpaused',
    subscription_payment_success: 'subEventPaymentSuccess',
    subscription_payment_failed: 'subEventPaymentFailed',
    subscription_payment_recovered: 'subEventPaymentRecovered',
    order_created: 'subEventOrderCreated',
    order_refunded: 'subEventOrderRefunded'
  }
  return t(map[type] || type)
}

function statusColor(status) {
  const map = {
    success: '#059669',
    failed: '#dc2626',
    refunded: '#d97706',
    pending: '#6366f1'
  }
  return map[status] || '#64748b'
}

// Placeholder: will open Lemon Squeezy checkout when hooked up
function openUpgrade() {
  // TODO: Open Lemon Squeezy checkout overlay with family_id + user_id as custom_data
  console.log('Upgrade flow — Lemon Squeezy checkout integration pending')
}

// Placeholder: will open Lemon Squeezy customer portal when hooked up
function openManage() {
  // TODO: Open Lemon Squeezy customer portal
  console.log('Manage subscription — Lemon Squeezy portal integration pending')
}
</script>

<template>
  <AppLayout>
    <!-- Plan Selection Section -->
    <div class="mb-12">
      <SectionHeader
        :title="t('subscriptionManagement')"
        icon="finance.png"
      />

      <!-- Active Subscription Details (shown only for paid users) -->
      <div v-if="subStore.subscription && subStore.isActive" class="sub-details-card">
        <div class="detail-row" v-if="subStore.renewalDate">
          <span class="detail-label">{{ t('renewsOn') }}</span>
          <span class="detail-value bidi-isolate">{{ formatDate(subStore.renewalDate) }}</span>
        </div>
        <div class="detail-row" v-if="subStore.daysRemaining !== null">
          <span class="detail-label">{{ t('daysLeft') }}</span>
          <span class="detail-value bidi-isolate">{{ subStore.daysRemaining }}</span>
        </div>
        <div class="detail-row" v-if="subStore.cardDisplay">
          <span class="detail-label">{{ t('paymentMethod') }}</span>
          <span class="detail-value bidi-isolate">{{ subStore.cardDisplay }}</span>
        </div>
        <button class="action-btn manage" @click="openManage">
          {{ t('manageSubscription') }}
        </button>
      </div>

      <!-- Plan Cards -->
      <div class="plans-duo">
        <!-- Free Plan -->
        <div class="plan-card" :class="{ active: subStore.isFree }">
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

        <!-- AI Pro Plan (Coming Soon) -->
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
    </div>

    <!-- Payment History Section -->
    <div class="mb-24">
      <SectionHeader
        :title="t('paymentHistory')"
        icon="finance.png"
      />

      <!-- Empty State -->
      <div v-if="subStore.paymentEvents.length === 0" class="empty-state">
        <p>{{ t('noPaymentHistory') }}</p>
      </div>

      <!-- Event List -->
      <div v-else class="event-list">
        <div
          v-for="event in subStore.paymentEvents"
          :key="event.id"
          class="event-row"
        >
          <div class="event-left">
            <div class="event-dot" :style="{ background: statusColor(event.status) }"></div>
            <div class="event-details">
              <span class="event-type">{{ eventLabel(event.event_type) }}</span>
              <span class="event-date bidi-isolate">{{ formatDate(event.created_at) }}</span>
            </div>
          </div>
          <div class="event-amount bidi-isolate" v-if="event.amount_cents > 0">
            {{ formatAmount(event.amount_cents) }}
          </div>
          <div class="event-status-badge" :style="{ color: statusColor(event.status) }" v-else>
            {{ t(event.status) }}
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
/* === PLAN CARDS (matches onboarding step 4) === */
.plans-duo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.plan-card {
  position: relative;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 1.25rem;
  padding: 1.5rem;
  transition: all 0.2s;
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

/* === SUBSCRIPTION DETAILS CARD === */
.sub-details-card {
  background: white;
  border-radius: 2rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1.5rem 1.75rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.detail-row:last-of-type {
  border-bottom: none;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 800;
  color: #1e293b;
}

/* === ACTION BUTTONS === */
.action-btn {
  width: 100%;
  padding: 0.875rem;
  border-radius: 1rem;
  font-size: 0.8125rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  margin-top: 0.75rem;
}

.action-btn.manage {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.action-btn.manage:hover {
  background: #e2e8f0;
}

/* === EMPTY STATE === */
.empty-state {
  padding: 3rem 2rem;
  text-align: center;
  background: #f8fafc;
  border-radius: 2rem;
  border: 2px dashed #cbd5e1;
  margin-top: 1rem;
}

.empty-state p {
  font-size: 0.875rem;
  font-weight: 600;
  color: #94a3b8;
  margin: 0;
}

/* === EVENT LIST === */
.event-list {
  background: white;
  border-radius: 2rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  margin-top: 1rem;
}

.event-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.2s;
}

.event-row:last-child {
  border-bottom: none;
}

.event-row:hover {
  background: #f8fafc;
}

.event-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.event-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: start;
  min-width: 0;
}

.event-type {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
}

.event-date {
  font-size: 0.625rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.event-amount {
  font-size: 1.125rem;
  font-weight: 900;
  color: #1e293b;
  flex-shrink: 0;
}

.event-status-badge {
  font-size: 0.6875rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

/* === RESPONSIVE === */
@media (min-width: 768px) {
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
}
</style>
