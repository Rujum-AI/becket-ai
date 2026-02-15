<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useCamera } from '@/composables/useCamera'
import { useSnapshotsStore } from '@/stores/supabaseSnapshots'
import { FileText, Camera, Upload, Trash2, X } from 'lucide-vue-next'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  child: {
    type: Object,
    required: true
  }
})

defineEmits(['close'])

const { t } = useI18n()
const { capturePhoto, compressImage } = useCamera()
const snapshotsStore = useSnapshotsStore()

const documents = ref([])
const docsLoading = ref(true)
const uploading = ref(false)
const deleteConfirm = ref(null)

// Upload staging
const stagedFile = ref(null)
const stagedPreview = ref(null)
const stagedName = ref('')
const stagedIsPdf = ref(false)

onMounted(loadDocuments)

async function loadDocuments() {
  docsLoading.value = true
  try {
    documents.value = await snapshotsStore.getDocumentsForChild(props.child.id)
  } catch (err) {
    console.error('Error loading documents:', err)
  } finally {
    docsLoading.value = false
  }
}

function pickFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/pdf,image/*'
  input.onchange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    stageFile(file)
  }
  input.click()
}

async function takeSnapshot() {
  const result = await capturePhoto()
  if (result) {
    stagedFile.value = result.blob
    stagedPreview.value = result.dataUrl
    stagedIsPdf.value = false
    stagedName.value = ''
  }
}

function stageFile(file) {
  stagedFile.value = file
  stagedIsPdf.value = file.type === 'application/pdf'
  stagedName.value = file.name.replace(/\.[^.]+$/, '')

  if (!stagedIsPdf.value) {
    stagedPreview.value = URL.createObjectURL(file)
  } else {
    stagedPreview.value = null
  }
}

function clearStaged() {
  if (stagedPreview.value) URL.revokeObjectURL(stagedPreview.value)
  stagedFile.value = null
  stagedPreview.value = null
  stagedName.value = ''
  stagedIsPdf.value = false
}

async function saveDocument() {
  if (!stagedFile.value || !stagedName.value.trim()) return

  uploading.value = true
  try {
    let blob = stagedFile.value

    // Compress if it's a raw image File (not already compressed from camera)
    if (!stagedIsPdf.value && stagedFile.value instanceof File) {
      const compressed = await compressImage(stagedFile.value)
      blob = compressed.blob
    }

    await snapshotsStore.uploadSnapshot(blob, {
      childIds: [props.child.id],
      caption: stagedName.value.trim(),
      category: 'doc'
    })

    clearStaged()
    await loadDocuments()
  } catch (err) {
    console.error('Document upload error:', err)
  } finally {
    uploading.value = false
  }
}

async function doDelete(doc) {
  deleteConfirm.value = null
  try {
    await snapshotsStore.deleteSnapshot(doc.id, doc.file_url)
    documents.value = documents.value.filter(d => d.id !== doc.id)
  } catch (err) {
    console.error('Delete error:', err)
  }
}

function openDocument(doc) {
  if (doc.signedUrl) window.open(doc.signedUrl, '_blank')
}

function formatDate(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}
</script>

<template>
  <BaseModal
    headerStyle="#6366F1"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <h2 class="modal-title">{{ child.name }} — {{ t('documents') }}</h2>
    </template>

    <!-- Upload staging area -->
    <div v-if="stagedFile" class="stage-area">
      <div class="stage-preview-row">
        <div v-if="stagedIsPdf" class="stage-thumb stage-thumb-pdf">
          <FileText :size="32" />
          <span class="stage-ext">PDF</span>
        </div>
        <img v-else :src="stagedPreview" class="stage-thumb stage-thumb-img" alt="" />
        <button class="stage-clear" @click="clearStaged"><X :size="16" /></button>
      </div>
      <input
        v-model="stagedName"
        type="text"
        class="stage-name-input"
        :placeholder="t('documentName')"
        @keyup.enter="saveDocument"
      />
      <button
        class="stage-save-btn"
        @click="saveDocument"
        :disabled="uploading || !stagedName.trim()"
      >
        {{ uploading ? t('saving') : t('save') }}
      </button>
    </div>

    <!-- Add document buttons (shown when not staging) -->
    <div v-else class="add-doc-row">
      <button class="add-doc-btn" @click="takeSnapshot">
        <Camera :size="22" />
        <span>{{ t('takePhoto') }}</span>
      </button>
      <button class="add-doc-btn" @click="pickFile">
        <Upload :size="22" />
        <span>{{ t('uploadFile') }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="docsLoading" class="docs-scroll">
      <div v-for="i in 3" :key="i" class="doc-thumb-card skeleton-card">
        <div class="skeleton-thumb"></div>
        <div class="skeleton-label"></div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!documents.length" class="docs-empty">
      <FileText :size="48" class="empty-icon-svg" />
      <p class="empty-title">{{ t('noDocuments') }}</p>
      <p class="empty-hint">{{ t('noDocumentsSub') }}</p>
    </div>

    <!-- Horizontal scroll gallery -->
    <div v-else class="docs-scroll">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="doc-thumb-card"
        @click="openDocument(doc)"
      >
        <!-- Thumbnail: image preview or PDF icon -->
        <div v-if="doc.file_url?.endsWith('.pdf')" class="doc-thumb doc-thumb-pdf">
          <FileText :size="28" />
          <span class="doc-ext">PDF</span>
        </div>
        <img v-else-if="doc.signedUrl" :src="doc.signedUrl" class="doc-thumb doc-thumb-img" alt="" />
        <div v-else class="doc-thumb doc-thumb-pdf">
          <FileText :size="28" />
        </div>

        <p class="doc-label">{{ doc.caption || t('untitledDoc') }}</p>
        <span class="doc-date">{{ formatDate(doc.timestamp) }}</span>

        <button class="doc-del-btn" @click.stop="deleteConfirm = doc">
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Delete confirmation -->
    <Teleport to="body">
      <div v-if="deleteConfirm" class="delete-overlay" @click="deleteConfirm = null">
        <div class="delete-dialog" @click.stop>
          <p class="delete-msg">{{ t('deleteDocConfirm') }}</p>
          <p class="delete-name">{{ deleteConfirm.caption || t('untitledDoc') }}</p>
          <div class="delete-actions">
            <button class="modal-secondary-btn" @click="deleteConfirm = null">{{ t('cancel') }}</button>
            <button class="modal-primary-btn delete-confirm-btn" @click="doDelete(deleteConfirm)">{{ t('delete') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <template #footer>
      <button class="modal-primary-btn" @click="$emit('close')">{{ t('close') }}</button>
    </template>
  </BaseModal>
</template>

<style scoped>
/* === Add buttons row === */
.add-doc-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.add-doc-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.25rem 0.75rem;
  background: #eef2ff;
  border: 2px dashed #c7d2fe;
  border-radius: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
  color: #6366f1;
  font-size: 0.8125rem;
  font-weight: 700;
}

.add-doc-btn:hover {
  background: #e0e7ff;
  border-color: #818cf8;
}

/* === Staging area === */
.stage-area {
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  background: #f8fafc;
  border: 2px solid #c7d2fe;
  border-radius: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.stage-preview-row {
  position: relative;
}

.stage-thumb {
  width: 5rem;
  height: 5rem;
  border-radius: 1rem;
  overflow: hidden;
}

.stage-thumb-img {
  object-fit: cover;
}

.stage-thumb-pdf {
  background: #eef2ff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  gap: 0.125rem;
}

.stage-ext {
  font-size: 0.625rem;
  font-weight: 800;
  letter-spacing: 1px;
}

.stage-clear {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: none;
  background: #1A1C1E;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.stage-name-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #1A1C1E;
  border-radius: 1rem;
  font-size: 1rem;
  font-weight: 700;
  color: #1A1C1E;
  outline: none;
  background: white;
}

.stage-name-input::placeholder {
  color: #94a3b8;
  font-weight: 600;
}

.stage-save-btn {
  width: 100%;
  padding: 0.875rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 1rem;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s;
}

.stage-save-btn:hover { background: #4f46e5; }
.stage-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* === Horizontal scroll gallery === */
.docs-scroll {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 0.5rem 0 1rem;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.docs-scroll::-webkit-scrollbar {
  height: 4px;
}

.docs-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.doc-thumb-card {
  flex-shrink: 0;
  width: 7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  scroll-snap-align: start;
  position: relative;
}

.doc-thumb {
  width: 6rem;
  height: 6rem;
  border-radius: 1rem;
  border: 2px solid #e2e8f0;
  overflow: hidden;
  transition: border-color 0.2s;
}

.doc-thumb-card:hover .doc-thumb {
  border-color: #6366f1;
}

.doc-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.doc-thumb-pdf {
  background: #eef2ff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  gap: 0.125rem;
}

.doc-ext {
  font-size: 0.5625rem;
  font-weight: 800;
  letter-spacing: 1px;
}

.doc-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #1A1C1E;
  text-align: center;
  max-width: 6rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
}

.doc-date {
  font-size: 0.625rem;
  font-weight: 600;
  color: #94a3b8;
}

.doc-del-btn {
  position: absolute;
  top: -0.25rem;
  right: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: none;
  background: white;
  color: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  opacity: 0;
  transition: opacity 0.2s;
}

.doc-thumb-card:hover .doc-del-btn {
  opacity: 1;
}

/* === Empty === */
.docs-empty {
  text-align: center;
  padding: 2.5rem 1rem;
}

.empty-icon-svg {
  color: #cbd5e1;
  margin-bottom: 1rem;
}

.empty-title {
  font-size: 1rem;
  font-weight: 800;
  color: #475569;
  margin: 0 0 0.25rem;
}

.empty-hint {
  font-size: 0.875rem;
  color: #94a3b8;
  margin: 0;
}

/* === Skeleton === */
.skeleton-card {
  pointer-events: none;
}

.skeleton-thumb {
  width: 6rem;
  height: 6rem;
  border-radius: 1rem;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-label {
  width: 4rem;
  height: 0.75rem;
  border-radius: 0.5rem;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* === Delete dialog === */
.delete-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.delete-dialog {
  background: white;
  border-radius: 1.5rem;
  padding: 2rem;
  max-width: 320px;
  width: 100%;
  text-align: center;
}

.delete-msg {
  font-size: 1rem;
  font-weight: 800;
  color: #1A1C1E;
  margin: 0 0 0.5rem;
}

.delete-name {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.5rem;
}

.delete-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.delete-confirm-btn {
  background: #ef4444 !important;
}
</style>
