<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabasePendingActionsStore } from '@/stores/supabasePendingActions'
import { Check, X } from 'lucide-vue-next'

// Generic "needs your decision" list. Renders pending_actions for a
// single target_type and lets the user approve/reject. Caller provides
// per-row display via the default slot — that way each domain
// (finance, calendar, tasks) renders its own row shape.
//
// The decide-side DB trigger (migration 036) updates the target's
// status atomically when approve/reject fires, so callers don't need
// to reload their domain store explicitly — the next realtime push
// (Wave 2.4) will reflect it.
const props = defineProps({
  targetType: { type: String, required: true },  // 'expense' | 'event' | 'task'
  title: { type: String, required: true }
})

const { t } = useI18n()
const pendingStore = useSupabasePendingActionsStore()

const rows = computed(() => pendingStore.incoming.filter(a => a.target_type === props.targetType))
const deciding = ref({})  // actionId → bool, locks the buttons mid-call

async function approve(actionId) {
  if (deciding.value[actionId]) return
  deciding.value[actionId] = true
  try {
    await pendingStore.decide(actionId, 'approved')
  } catch (err) {
    console.error('approve failed', err)
  } finally {
    deciding.value[actionId] = false
  }
}

async function reject(actionId) {
  if (deciding.value[actionId]) return
  deciding.value[actionId] = true
  try {
    await pendingStore.decide(actionId, 'rejected')
  } catch (err) {
    console.error('reject failed', err)
  } finally {
    deciding.value[actionId] = false
  }
}
</script>

<template>
  <div v-if="rows.length > 0" class="pending-section">
    <div class="pending-header">
      <span class="pending-dot" />
      <h3 class="pending-title">{{ title }}</h3>
      <span class="pending-count">{{ rows.length }}</span>
    </div>

    <div class="pending-list">
      <div v-for="row in rows" :key="row.id" class="pending-row">
        <div class="pending-row-body">
          <slot :action="row">
            <div class="pending-row-fallback">
              {{ row.target_type }} · {{ t(row.reason || 'requiresApproval') }}
            </div>
          </slot>
        </div>
        <div class="pending-actions">
          <button
            class="pending-btn pending-reject"
            :disabled="deciding[row.id]"
            @click="reject(row.id)"
            :aria-label="t('reject')"
          >
            <X :size="16" />
          </button>
          <button
            class="pending-btn pending-approve"
            :disabled="deciding[row.id]"
            @click="approve(row.id)"
            :aria-label="t('approve')"
          >
            <Check :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pending-section {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.pending-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.pending-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: #f59e0b;
  display: inline-block;
}

.pending-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #92400e;
  margin: 0;
  letter-spacing: 0.01em;
}

.pending-count {
  font-size: 0.75rem;
  font-weight: 700;
  color: #b45309;
  background: #fde68a;
  border-radius: 9999px;
  padding: 0.1rem 0.5rem;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pending-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: white;
  border: 1px solid #fef3c7;
  border-radius: 10px;
  padding: 0.625rem 0.875rem;
}

.pending-row-body {
  flex: 1 1 auto;
  min-width: 0;
}

.pending-row-fallback {
  font-size: 0.875rem;
  color: #475569;
}

.pending-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.pending-btn {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pending-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.pending-reject {
  background: #fee2e2;
  color: #b91c1c;
}
.pending-reject:hover:not(:disabled) { background: #fecaca; }

.pending-approve {
  background: #dcfce7;
  color: #15803d;
}
.pending-approve:hover:not(:disabled) { background: #bbf7d0; }
</style>
