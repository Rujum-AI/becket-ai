<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSnapshotsStore } from '@/stores/supabaseSnapshots'
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
const snapshotsStore = useSnapshotsStore()

const lastSnapshot = ref(null)
const snapshotLoading = ref(true)
const viewFullSize = ref(false)

onMounted(async () => {
  try {
    lastSnapshot.value = await snapshotsStore.getLastHandoffSnapshot(props.child.id)
  } catch (err) {
    console.error('Error loading last snapshot:', err)
  } finally {
    snapshotLoading.value = false
  }
})

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

        <!-- Last handoff snapshot -->
        <div v-if="snapshotLoading" class="snapshot-zone">
          <div class="snapshot-loading"></div>
          <span class="snapshot-text">{{ t('lastSnapshot') }}</span>
        </div>

        <div v-else-if="lastSnapshot?.signedUrl" class="snapshot-preview" @click="viewFullSize = true">
          <img :src="lastSnapshot.signedUrl" class="preview-img" alt="Last handoff snapshot" />
          <span class="snapshot-text">{{ t('lastSnapshot') }}</span>
        </div>

        <div v-else class="snapshot-zone">
          <img src="@/assets/snapshot.png" alt="Snapshot" />
          <span class="snapshot-text">{{ t('noSnapshotYet') }}</span>
        </div>

        <!-- Full-size overlay -->
        <Teleport to="body">
          <div v-if="viewFullSize && lastSnapshot?.signedUrl" class="fullsize-overlay" @click="viewFullSize = false">
            <img :src="lastSnapshot.signedUrl" class="fullsize-img" alt="Full size snapshot" />
          </div>
        </Teleport>

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

.snapshot-preview {
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
}

.preview-img {
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  border-radius: 1.5rem;
  border: 3px solid #e2e8f0;
  transition: all 0.2s;
}

.preview-img:hover {
  border-color: #94a3b8;
}

.snapshot-loading {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.fullsize-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.fullsize-img {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
  border-radius: 1rem;
}
</style>
