<script setup>
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useCamera } from '@/composables/useCamera'
import { useSnapshotsStore } from '@/stores/supabaseSnapshots'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  child: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'confirm'])

const { t } = useI18n()
const { capturePhoto } = useCamera()
const snapshotsStore = useSnapshotsStore()

const dropLocation = ref('School')
const newItem = ref('')
const tempItems = ref([...(props.child.items || [])])
const photoPreview = ref(null)
const photoBlob = ref(null)
const uploading = ref(false)

const locations = ['School', 'Soccer Club', 'Tennis', 'Grandma', 'Music Lesson', 'Dance Class']

function addItem() {
  if (newItem.value.trim()) {
    tempItems.value.push(newItem.value.trim())
    newItem.value = ''
  }
}

function removeItem(index) {
  tempItems.value.splice(index, 1)
}

async function takeSnapshot() {
  const result = await capturePhoto()
  if (result) {
    photoPreview.value = result.dataUrl
    photoBlob.value = result.blob
  }
}

function removePhoto() {
  photoPreview.value = null
  photoBlob.value = null
}

async function confirmDropoff() {
  uploading.value = true
  try {
    let snapshotId = null

    // Upload photo if one was captured
    if (photoBlob.value) {
      const childIds = props.child.id ? [props.child.id] : []
      const caption = `${props.child.name} ${t('goingTo')} ${t(dropLocation.value)}`
      const snapshot = await snapshotsStore.uploadSnapshot(photoBlob.value, { childIds, caption })
      snapshotId = snapshot.id
    }

    emit('confirm', {
      child: props.child,
      location: dropLocation.value,
      items: tempItems.value,
      snapshotId
    })
    emit('close')
  } catch (err) {
    console.error('Dropoff error:', err)
    uploading.value = false
  }
}
</script>

<template>
  <BaseModal
    headerStyle="#FB923C"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <h2 class="modal-title">{{ t('dropoffTitle') }}</h2>
      <div class="mt-8 px-10">
        <select v-model="dropLocation" class="big-select">
          <option v-for="loc in locations" :key="loc" :value="loc">
            {{ t(loc) }}
          </option>
        </select>
      </div>
    </template>
        <div class="modal-section">
          <img src="@/assets/backpack.png" class="modal-section-img" alt="Backpack" />
          <h3 class="modal-subtitle">{{ t('whatGear') }} {{ child.name }}?</h3>
        </div>

        <div class="flex flex-col gap-6">
          <div class="flex flex-wrap gap-3">
            <div v-for="(item, i) in tempItems" :key="i" class="tag-pill">
              {{ t(item) }}
              <span class="text-slate-300 ms-2 cursor-pointer text-xl leading-none" @click="removeItem(i)">×</span>
            </div>
          </div>

          <div class="flex gap-3">
            <input
              type="text"
              v-model="newItem"
              :placeholder="t('addCustom')"
              @keyup.enter="addItem"
              class="flex-1 p-5 bg-white rounded-2xl border-2 border-slate-900 font-bold text-lg outline-none"
            />
            <button @click="addItem" class="w-16 h-16 bg-slate-900 text-white rounded-2xl font-black text-3xl flex items-center justify-center hover:bg-slate-700 transition-colors">
              +
            </button>
          </div>
        </div>

        <!-- Snapshot capture zone -->
        <div v-if="!photoPreview" class="snapshot-zone" @click="takeSnapshot">
          <img src="@/assets/snapshot.png" alt="Snapshot" />
          <span class="snapshot-text">{{ t('takeSnapshot') }}</span>
        </div>

        <!-- Photo preview -->
        <div v-else class="snapshot-preview">
          <img :src="photoPreview" class="preview-img" alt="Snapshot preview" />
          <div class="preview-actions">
            <button class="preview-btn" @click="takeSnapshot">{{ t('photoRetake') }}</button>
            <button class="preview-btn preview-btn-remove" @click="removePhoto">{{ t('photoRemove') }}</button>
          </div>
        </div>

    <template #footer>
      <div class="modal-action-bar">
        <button class="modal-secondary-btn" @click="$emit('close')">
          {{ t('cancel') }}
        </button>
        <button class="modal-primary-btn" style="background: #f97316" @click="confirmDropoff" :disabled="uploading">
          {{ uploading ? t('uploadingPhoto') : t('confirmDropoff') }}
        </button>
      </div>
      <p class="text-center text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-2">
        {{ t('notifyParent') }}
      </p>
    </template>
  </BaseModal>
</template>

<style scoped>
.big-select {
  width: 100%;
  padding: 1rem 1.5rem;
  background: white;
  border: 2px solid #1A1C1E;
  border-radius: 1rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1A1C1E;
  cursor: pointer;
  outline: none;
}

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
}

.preview-img {
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  border-radius: 1.5rem;
  border: 3px solid #e2e8f0;
}

.preview-actions {
  display: flex;
  gap: 0.75rem;
}

.preview-btn {
  padding: 0.625rem 1.25rem;
  border-radius: 2rem;
  font-size: 0.875rem;
  font-weight: 700;
  border: 2px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.preview-btn-remove {
  color: #ef4444;
  border-color: #fecaca;
  background: #fef2f2;
}

.preview-btn-remove:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}
</style>
