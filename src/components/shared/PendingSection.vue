<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabasePendingActionsStore } from '@/stores/supabasePendingActions'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import { Check, X } from 'lucide-vue-next'

// Generic "needs your decision" list. Renders pending_actions for a
// single target_type. Caller provides per-row display via the default
// slot — each domain (finance, calendar, tasks) renders its own row
// shape.
//
// Design: white rounded-card container matching ExpenseList; section
// header matches SectionHeader so it sits next to "Overview" /
// "Transactions" without looking foreign. RTL-safe (text-align: start,
// flex flips naturally with [dir="rtl"]).
const props = defineProps({
  targetType: { type: String, required: true },  // 'expense' | 'event' | 'task'
  title: { type: String, default: '' },
  icon: { type: String, default: 'finance.png' }
})

const { t } = useI18n()
const pendingStore = useSupabasePendingActionsStore()

const rows = computed(() =>
  pendingStore.incoming.filter(a => a.target_type === props.targetType)
)

const headerTitle = computed(() => props.title || t('pendingApprovals'))
const deciding = ref({})  // actionId → bool, locks the buttons mid-call

// Map DB reason values → existing translation keys so we don't invent strings
const REASON_KEYS = {
  category_other: 'expenseExcludedReason',
  no_rule: 'expenseNoRuleReason',
  exceeds_budget: 'expenseOverBudgetReason',
  exceeds_count: 'expenseOverItemLimitReason',
  cross_day_event: 'reasonCrossDayEvent',
  legacy: 'reasonLegacy'
}
function reasonText(reason) {
  if (!reason) return ''
  const key = REASON_KEYS[reason]
  return key ? t(key) : reason
}

async function approve(actionId) {
  if (deciding.value[actionId]) return
  deciding.value[actionId] = true
  try { await pendingStore.decide(actionId, 'approved') }
  catch (err) { console.error('approve failed', err) }
  finally { deciding.value[actionId] = false }
}

async function reject(actionId) {
  if (deciding.value[actionId]) return
  deciding.value[actionId] = true
  try { await pendingStore.decide(actionId, 'rejected') }
  catch (err) { console.error('reject failed', err) }
  finally { deciding.value[actionId] = false }
}
</script>

<template>
  <div v-if="rows.length > 0" class="mb-12">
    <SectionHeader :title="headerTitle" :icon="icon" />

    <div class="pending-list">
      <div v-for="row in rows" :key="row.id" class="pending-row">
        <div class="pending-row-body">
          <slot :action="row" :reasonText="reasonText(row.reason)">
            <div class="pending-row-fallback">
              {{ reasonText(row.reason) || row.target_type }}
            </div>
          </slot>
        </div>
        <div class="pending-actions">
          <button
            type="button"
            class="pending-btn pending-reject"
            :disabled="deciding[row.id]"
            :aria-label="t('reject')"
            :title="t('reject')"
            @click="reject(row.id)"
          >
            <X :size="18" />
          </button>
          <button
            type="button"
            class="pending-btn pending-approve"
            :disabled="deciding[row.id]"
            :aria-label="t('approve')"
            :title="t('approve')"
            @click="approve(row.id)"
          >
            <Check :size="18" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pending-list {
  /* Amber-tinted container so it reads as "needs attention" next to the
     plain-white Transactions card, without shouting. Diagonal stripe
     texture stacked over the soft amber gradient unifies it with the
     delete/V/X buttons that use the same motif. */
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.35) 2px,
      rgba(255, 255, 255, 0.35) 4px
    ),
    linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  border-radius: 2rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid #FCD34D;
  margin-top: 1rem;
}

.pending-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(180, 83, 9, 0.12);
  transition: all 0.2s;
}

.pending-row:last-child { border-bottom: none; }
.pending-row:hover { background: rgba(255, 255, 255, 0.45); }

.pending-row-body {
  flex: 1 1 auto;
  min-width: 0;
  text-align: start;
}

.pending-row-fallback {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
}

.pending-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.pending-btn {
  /* Soft pastel pills matching BalanceBar's gradient treatment — same
     palette as the rest of the app (no harsh saturated reds/greens). */
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  border-width: 1px;
  border-style: solid;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.pending-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.pending-reject {
  background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
  border-color: #FCA5A5;
  color: #b91c1c;
}
.pending-reject:hover:not(:disabled) {
  background: linear-gradient(135deg, #FECACA 0%, #FCA5A5 100%);
  transform: translateY(-1px);
}

.pending-approve {
  background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%);
  border-color: #6EE7B7;
  color: #047857;
}
.pending-approve:hover:not(:disabled) {
  background: linear-gradient(135deg, #A7F3D0 0%, #6EE7B7 100%);
  transform: translateY(-1px);
}

@media (max-width: 479px) {
  .pending-row { padding: 1rem 1rem; gap: 0.5rem; }
  .pending-btn { width: 2rem; height: 2rem; }
}
</style>
