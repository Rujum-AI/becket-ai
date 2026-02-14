<script setup>
import { useI18n } from '@/composables/useI18n'
import { CheckCircle } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  child: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'confirm'])

const { t } = useI18n()

function confirmPickup() {
  emit('confirm', props.child)
  emit('close')
}
</script>

<template>
  <BaseModal
    headerStyle="#34D399"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <h2 class="modal-title">{{ t('pickupTitle') }}</h2>
    </template>
        <div class="modal-section">
          <img src="@/assets/backpack.png" class="modal-section-img" alt="Backpack" />
          <h3 class="modal-subtitle">{{ child.name }} - {{ t('gearChecklist') }}</h3>
        </div>

        <div class="flex flex-wrap gap-3 justify-center">
          <div v-for="item in child.items" :key="item" class="tag-pill">
            <CheckCircle :size="20" class="text-green-500" />
            {{ t(item) }}
          </div>
          <p v-if="!child.items || child.items.length === 0" class="text-slate-400 font-bold italic">
            {{ t('noItems') }}
          </p>
        </div>

        <div class="snapshot-zone">
          <img src="@/assets/snapshot.png" alt="Snapshot" />
          <span class="snapshot-text">{{ t('lastSnapshot') }}</span>
        </div>

    <template #footer>
      <div class="modal-action-bar">
        <button class="modal-secondary-btn" @click="$emit('close')">
          {{ t('cancel') }}
        </button>
        <button class="modal-primary-btn" style="background: #0d9488" @click="confirmPickup">
          {{ t('confirmPickup') }}
        </button>
      </div>
      <p class="text-center text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-2">
        {{ t('notifyParent') }}
      </p>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.modal-section-img {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: contain;
}

.modal-subtitle {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1A1C1E;
  flex: 1;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: #f0fdf4;
  border: 2px solid #86efac;
  border-radius: 2rem;
  font-weight: 600;
  color: #166534;
  font-size: 0.9375rem;
}

.snapshot-zone {
  margin: 2rem 0;
  padding: 2rem;
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.snapshot-zone:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.snapshot-zone img {
  width: 4rem;
  height: 4rem;
  object-fit: contain;
}

.snapshot-text {
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
