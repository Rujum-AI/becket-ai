<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSnapshotsStore } from '@/stores/supabaseSnapshots'
import { useSupabaseDashboardStore as useDashboardStore } from '@/stores/supabaseDashboard'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import { useFamily } from '@/composables/useFamily'
import { X, Camera, Check } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  photoBlob: Blob,
  photoDataUrl: String
})

const emit = defineEmits(['close', 'saved'])

const { t } = useI18n()
const snapshotsStore = useSnapshotsStore()
const dashboardStore = useDashboardStore()
const { user } = useAuth()
const { family } = useFamily()

const caption = ref('')
const selectedChildren = ref([])
const saving = ref(false)

function getChildImg(child) {
  return child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'
}

function toggleChild(childId) {
  const idx = selectedChildren.value.indexOf(childId)
  if (idx >= 0) {
    selectedChildren.value.splice(idx, 1)
  } else {
    selectedChildren.value.push(childId)
  }
}

async function savePhoto() {
  if (saving.value) return
  saving.value = true

  try {
    const snapshot = await snapshotsStore.uploadSnapshot(props.photoBlob, {
      childIds: selectedChildren.value,
      caption: caption.value.trim() || null,
      category: 'photo'
    })

    // Send notification to co-parent
    if (dashboardStore.partnerId && family.value) {
      await supabase.from('notifications').insert({
        family_id: family.value.id,
        recipient_id: dashboardStore.partnerId,
        type: 'new_photo',
        category: 'photo',
        title: t('newPhotoNotifTitle'),
        message: caption.value.trim() || t('newPhotoNotifMessage'),
        priority: 'normal',
        related_entity_type: 'snapshot',
        related_entity_id: snapshot.id
      })
    }

    emit('saved')
  } catch (err) {
    console.error('Error saving photo:', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal headerStyle="#1e293b" maxWidth="420px" @close="$emit('close')">
    <template #header>
      <h2 class="modal-title">
        <Camera :size="18" style="margin-inline-end: 0.5rem" />
        {{ t('photoTime') }}
      </h2>
    </template>

    <!-- Photo preview -->
    <div class="photo-preview">
      <img :src="photoDataUrl" alt="Preview" class="preview-img" />
    </div>

    <!-- Description -->
    <label class="field-label">{{ t('description') }}</label>
    <input
      v-model="caption"
      type="text"
      :placeholder="t('addCaption')"
      class="modal-form-input caption-input"
    />

    <!-- Tag children -->
    <div v-if="dashboardStore.children.length > 0" class="tag-section">
      <label class="field-label center">{{ t('tagChildren') }}</label>
      <div class="child-row">
        <div
          v-for="child in dashboardStore.children"
          :key="child.id"
          @click="toggleChild(child.id)"
          class="c-tog"
          :class="{ selected: selectedChildren.includes(child.id) }"
        >
          <img :src="getChildImg(child)" class="c-img" />
          <span class="c-name">{{ child.name }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-action-bar">
        <button class="modal-secondary-btn" @click="$emit('close')">
          {{ t('discard') }}
        </button>
        <button class="modal-primary-btn save-btn" @click="savePhoto" :disabled="saving">
          <Check :size="16" v-if="!saving" />
          {{ saving ? t('uploadingPhoto') : t('addToAlbum') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.photo-preview {
  border-radius: 1rem;
  overflow: hidden;
  margin-bottom: 1rem;
  border: 1px solid #e2e8f0;
}

.preview-img {
  width: 100%;
  display: block;
  max-height: 300px;
  object-fit: cover;
}

.caption-input {
  margin-bottom: 1rem;
}

.tag-section {
  margin-bottom: 0.5rem;
}

.field-label {
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.field-label.center {
  text-align: center;
  display: block;
}

.child-row {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 0.75rem;
}

.c-tog {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.5;
  filter: grayscale(100%);
}

.c-tog.selected {
  opacity: 1;
  filter: grayscale(0);
}

.c-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 3px solid white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  object-fit: cover;
  margin-bottom: 0.3rem;
}

.c-tog.selected .c-img {
  border-color: #0f172a;
}

.c-name {
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #64748b;
}

.save-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #1e293b;
  padding: 0.625rem 1.25rem;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
