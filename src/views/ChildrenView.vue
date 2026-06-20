<script setup>
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import { useI18n } from '@/composables/useI18n'
import { useFamily } from '@/composables/useFamily'
import { Trash2, Plus } from 'lucide-vue-next'

const { t } = useI18n()
const { children, fetchChildren, updateChild, deleteChild, addChild } = useFamily()

const drafts = ref({})        // childId → { name, gender, date_of_birth, medical_notes }
const saving = ref({})        // childId → bool, locks Save button mid-call
const pendingSave = ref(null) // childId of the child whose edits are awaiting confirm
const pendingRemove = ref(null) // child object queued for deletion confirmation
const showAddForm = ref(false)
const newChild = ref({ name: '', gender: 'boy', date_of_birth: '', medical_notes: '' })
const addingChild = ref(false)

onMounted(() => { fetchChildren() })

function thumbnail(child) {
  return child.gender === 'girl' ? '/assets/thumbnail_girl.png' : '/assets/thumbnail_boy.png'
}

function draftFor(child) {
  if (!drafts.value[child.id]) {
    drafts.value[child.id] = {
      name: child.name || '',
      gender: child.gender || 'boy',
      date_of_birth: child.date_of_birth || '',
      medical_notes: child.medical_notes || ''
    }
  }
  return drafts.value[child.id]
}

function isDirty(child) {
  const d = drafts.value[child.id]
  if (!d) return false
  return (
    d.name !== (child.name || '') ||
    d.gender !== (child.gender || 'boy') ||
    d.date_of_birth !== (child.date_of_birth || '') ||
    d.medical_notes !== (child.medical_notes || '')
  )
}

function requestSave(child) {
  if (!isDirty(child)) return
  pendingSave.value = child.id
}

async function confirmSave() {
  const childId = pendingSave.value
  if (!childId) return
  saving.value = { ...saving.value, [childId]: true }
  try {
    await updateChild(childId, drafts.value[childId])
    delete drafts.value[childId]
    pendingSave.value = null
  } catch (err) {
    console.error('Update child failed', err)
  } finally {
    saving.value = { ...saving.value, [childId]: false }
  }
}

function requestRemove(child) {
  pendingRemove.value = child
}

async function confirmRemove() {
  if (!pendingRemove.value) return
  try {
    await deleteChild(pendingRemove.value.id)
    delete drafts.value[pendingRemove.value.id]
    pendingRemove.value = null
  } catch (err) {
    console.error('Delete child failed', err)
  }
}

function openAddForm() {
  newChild.value = { name: '', gender: 'boy', date_of_birth: '', medical_notes: '' }
  showAddForm.value = true
}

async function submitAddChild() {
  if (!newChild.value.name || !newChild.value.date_of_birth) return
  addingChild.value = true
  try {
    await addChild(newChild.value)
    showAddForm.value = false
  } catch (err) {
    console.error('Add child failed', err)
  } finally {
    addingChild.value = false
  }
}

const pendingSaveChild = computed(() =>
  pendingSave.value ? children.value.find(c => c.id === pendingSave.value) : null
)
</script>

<template>
  <AppLayout>
    <div class="mb-12">
      <SectionHeader
        :title="t('childrenScreenTitle')"
        icon="family.png"
        :hasAction="true"
        :actionLabel="t('addChild')"
        @action="openAddForm"
      />
      <p class="children-subtitle">{{ t('childrenScreenSubtitle') }}</p>

      <!-- Add child form (appears at the top when toggled) -->
      <div v-if="showAddForm" class="child-card add-card">
        <div class="child-card-header">
          <div class="child-thumb">
            <img :src="newChild.gender === 'girl' ? '/assets/thumbnail_girl.png' : '/assets/thumbnail_boy.png'" />
          </div>
          <input
            v-model="newChild.name"
            type="text"
            class="child-field child-name-input"
            :placeholder="t('childName')"
          />
        </div>
        <div class="child-card-body">
          <div class="child-field-row">
            <label class="child-field-label">{{ t('childGender') }}</label>
            <div class="gender-pills">
              <button
                :class="['gender-pill', { active: newChild.gender === 'boy' }]"
                @click="newChild.gender = 'boy'"
                type="button"
              >{{ t('childGenderBoy') }}</button>
              <button
                :class="['gender-pill', { active: newChild.gender === 'girl' }]"
                @click="newChild.gender = 'girl'"
                type="button"
              >{{ t('childGenderGirl') }}</button>
            </div>
          </div>
          <div class="child-field-row">
            <label class="child-field-label">{{ t('childDob') }}</label>
            <input
              v-model="newChild.date_of_birth"
              type="date"
              class="child-field"
            />
          </div>
          <div class="child-field-row">
            <label class="child-field-label">{{ t('childMedical') }}</label>
            <textarea
              v-model="newChild.medical_notes"
              class="child-field child-textarea"
              rows="2"
            ></textarea>
          </div>
          <div class="child-actions">
            <button class="child-secondary-btn" @click="showAddForm = false">{{ t('cancel') }}</button>
            <button
              class="child-primary-btn"
              :disabled="addingChild || !newChild.name || !newChild.date_of_birth"
              @click="submitAddChild"
            >
              {{ addingChild ? t('saving') : t('saveChild') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Children list -->
      <div class="children-list">
        <div v-for="child in children" :key="child.id" class="child-card">
          <div class="child-card-header">
            <div class="child-thumb">
              <img :src="thumbnail(child)" :alt="child.name" />
            </div>
            <input
              v-model="draftFor(child).name"
              type="text"
              class="child-field child-name-input"
              :placeholder="t('childName')"
            />
            <button
              class="child-remove-btn"
              :title="t('delete')"
              @click="requestRemove(child)"
            >
              <Trash2 :size="16" />
            </button>
          </div>
          <div class="child-card-body">
            <div class="child-field-row">
              <label class="child-field-label">{{ t('childGender') }}</label>
              <div class="gender-pills">
                <button
                  :class="['gender-pill', { active: draftFor(child).gender === 'boy' }]"
                  @click="draftFor(child).gender = 'boy'"
                  type="button"
                >{{ t('childGenderBoy') }}</button>
                <button
                  :class="['gender-pill', { active: draftFor(child).gender === 'girl' }]"
                  @click="draftFor(child).gender = 'girl'"
                  type="button"
                >{{ t('childGenderGirl') }}</button>
              </div>
            </div>
            <div class="child-field-row">
              <label class="child-field-label">{{ t('childDob') }}</label>
              <input
                v-model="draftFor(child).date_of_birth"
                type="date"
                class="child-field"
              />
            </div>
            <div class="child-field-row">
              <label class="child-field-label">{{ t('childMedical') }}</label>
              <textarea
                v-model="draftFor(child).medical_notes"
                class="child-field child-textarea"
                rows="2"
              ></textarea>
            </div>
            <div class="child-actions">
              <button
                class="child-primary-btn"
                :disabled="!isDirty(child) || saving[child.id]"
                @click="requestSave(child)"
              >
                {{ saving[child.id] ? t('saving') : t('saveChild') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm save -->
    <ConfirmModal
      :show="!!pendingSave"
      :title="t('editChildTitle')"
      :message="t('editChildMsg')"
      :confirmText="saving[pendingSave] ? t('saving') : t('saveChild')"
      confirmColor="bg-teal-600"
      @close="pendingSave = null"
      @confirm="confirmSave"
    />

    <!-- Confirm remove -->
    <ConfirmModal
      :show="!!pendingRemove"
      :title="t('removeChildTitle')"
      :message="t('removeChildMsg')"
      :confirmText="t('delete')"
      @close="pendingRemove = null"
      @confirm="confirmRemove"
    />
  </AppLayout>
</template>

<style scoped>
.children-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0.5rem 0 1.25rem;
  line-height: 1.4;
  text-align: start;
}

.children-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.child-card {
  background: white;
  border-radius: 1.5rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.add-card {
  border-color: #BD5B39;
  background: linear-gradient(135deg, #FFFBF7 0%, #FFF7ED 100%);
  margin-top: 1rem;
}

.child-card-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
}

.child-thumb {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  overflow: hidden;
  flex-shrink: 0;
}

.child-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.child-card-body {
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.child-field-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.child-field-label {
  font-size: 0.625rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: start;
}

.child-field {
  font-family: inherit;
  font-size: 0.9375rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.625rem;
  background: white;
  color: #1e293b;
  text-align: start;
  width: 100%;
  box-sizing: border-box;
}

.child-field:focus {
  outline: none;
  border-color: #BD5B39;
  box-shadow: 0 0 0 3px rgba(189, 91, 57, 0.12);
}

.child-name-input {
  flex: 1;
  font-size: 1rem;
  font-weight: 700;
}

.child-textarea {
  resize: vertical;
  min-height: 2.5rem;
  line-height: 1.4;
}

.gender-pills {
  display: flex;
  gap: 0.5rem;
}

.gender-pill {
  padding: 0.5rem 1.25rem;
  border-radius: 9999px;
  border: 1.5px solid #e2e8f0;
  background: white;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 0.15s;
}

.gender-pill.active {
  background: #BD5B39;
  border-color: #BD5B39;
  color: white;
}

.child-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.child-primary-btn {
  padding: 0.55rem 1.25rem;
  background: #0d9488;
  color: white;
  border: none;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
}

.child-primary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.child-primary-btn:hover:not(:disabled) {
  background: #0b7d72;
}

.child-secondary-btn {
  padding: 0.55rem 1.25rem;
  background: #f1f5f9;
  color: #475569;
  border: none;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
}

.child-remove-btn {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 1.5px solid #fecaca;
  background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
  color: #b91c1c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.child-remove-btn:hover {
  transform: translateY(-1px);
}

@media (max-width: 479px) {
  .child-card-header { padding: 0.875rem 1rem; gap: 0.625rem; }
  .child-card-body { padding: 0.875rem 1rem 1rem; gap: 0.75rem; }
  .child-thumb { width: 2.5rem; height: 2.5rem; }
}
</style>
