<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useLanguageStore } from '@/stores/language'
import { Calendar, Check, X } from 'lucide-vue-next'

const props = defineProps({
  override: { type: Object, required: true }
})

const emit = defineEmits(['approve', 'reject'])

const { t } = useI18n()
const langStore = useLanguageStore()
const locale = computed(() => langStore.lang === 'he' ? 'he-IL' : 'en-US')

const fromFormatted = computed(() => {
  return new Date(props.override.from_date + 'T00:00:00').toLocaleDateString(locale.value, {
    month: 'short', day: 'numeric'
  })
})

const toFormatted = computed(() => {
  return new Date(props.override.to_date + 'T00:00:00').toLocaleDateString(locale.value, {
    month: 'short', day: 'numeric'
  })
})

const parentLabel = computed(() => t(props.override.override_parent))

const statusLabel = computed(() => {
  const map = { pending: 'overridePending', approved: 'overrideApproved', rejected: 'overrideRejected' }
  return t(map[props.override.status] || props.override.status)
})
</script>

<template>
  <div :class="['override-card', override.status]">
    <div class="override-header">
      <Calendar :size="18" class="override-icon" />
      <div class="override-dates">
        <span class="date-range" dir="ltr">{{ fromFormatted }} — {{ toFormatted }}</span>
      </div>
      <span :class="['status-badge', override.status]">{{ statusLabel }}</span>
    </div>

    <div class="override-body">
      <div class="override-detail">
        <span class="detail-label">{{ t('assignTo') }}:</span>
        <span :class="['parent-badge', override.override_parent]">
          {{ override.override_parent === 'dad' ? '👨' : '👩' }}
          {{ parentLabel }}
        </span>
      </div>
      <div v-if="override.reason" class="override-reason">
        {{ override.reason }}
      </div>
    </div>

    <div v-if="override.status === 'pending'" class="override-actions">
      <button class="btn-reject" @click="emit('reject')">
        <X :size="16" />
        {{ t('reject') }}
      </button>
      <button class="btn-approve" @click="emit('approve')">
        <Check :size="16" />
        {{ t('approve') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.override-card {
  background: white;
  border-radius: 1.25rem;
  border: 2px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.2s;
}

.override-card.pending {
  border-color: #fbbf24;
}

.override-card.approved {
  border-color: #86efac;
}

.override-card.rejected {
  border-color: #fca5a5;
  opacity: 0.6;
}

.override-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #fefce8;
  border-bottom: 1px solid #fef3c7;
}

.override-icon {
  color: #d97706;
  flex-shrink: 0;
}

.override-dates {
  flex: 1;
}

.date-range {
  font-size: 0.9375rem;
  font-weight: 800;
  color: #1A1C1E;
  unicode-bidi: isolate;
}

.status-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
}

.status-badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.approved {
  background: #dcfce7;
  color: #166534;
}

.status-badge.rejected {
  background: #fee2e2;
  color: #991b1b;
}

.override-body {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.override-detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.detail-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
}

.parent-badge {
  font-size: 0.875rem;
  font-weight: 800;
  padding: 0.25rem 0.75rem;
  border-radius: 0.75rem;
}

.parent-badge.dad {
  background: #CCFBF1;
  color: #0d9488;
}

.parent-badge.mom {
  background: #FFEDD5;
  color: #c2410c;
}

.override-reason {
  font-size: 0.8125rem;
  color: #475569;
  font-style: italic;
  line-height: 1.4;
}

.override-actions {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.btn-reject,
.btn-approve {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 1rem;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid;
}

.btn-reject {
  background: white;
  color: #dc2626;
  border-color: #fca5a5;
}

.btn-reject:hover {
  background: #fef2f2;
}

.btn-approve {
  background: #16a34a;
  color: white;
  border-color: #16a34a;
}

.btn-approve:hover {
  background: #15803d;
}
</style>
