<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useUnderstandingsStore } from '@/stores/supabaseUnderstandings'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import UnderstandingItem from '@/components/understandings/UnderstandingItem.vue'
import CustodyCycleEditor from '@/components/understandings/CustodyCycleEditor.vue'
import CustodyAssignModal from '@/components/understandings/CustodyAssignModal.vue'
import UnderstandingFormModal from '@/components/understandings/UnderstandingFormModal.vue'
import ExpenseRulesPanel from '@/components/understandings/ExpenseRulesPanel.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import ModuleDashboard from '@/components/shared/ModuleDashboard.vue'
import { Upload, Plus, AlertCircle, ChevronUp, ChevronDown, Handshake } from 'lucide-vue-next'

const { t } = useI18n()
const understandingsStore = useUnderstandingsStore()

const fileInput = ref(null)
const isRejectedOpen = ref(false)
const isModalOpen = ref(false)
const editingItem = ref(null)
const preselectedSubject = ref(null)
const activeDayIndex = ref(null)
const isCustodySaveModalOpen = ref(false)
const confirmModal = ref({ isOpen: false, title: '', message: '', action: null })

// True when at least one non-rejected text understanding exists across any
// subject. Expense rules render via ExpenseRulesPanel and don't count here —
// the empty state is about the free-text understanding list.
const hasTextUnderstandings = computed(() => {
  return Object.entries(understandingsStore.groupedUnderstandings)
    .some(([, items]) => items.length > 0)
})

function interp(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''))
}

// Module dashboard summary counts
const activeUnderstandingsCount = computed(() => {
  return understandingsStore.understandings.filter(u => u.status !== 'rejected').length
})

const awaitingApprovalCount = computed(() => {
  return understandingsStore.understandings.filter(u => u.status === 'pending').length
})

onMounted(() => {
  understandingsStore.init()
})

// Custody Cycle Functions
function handleSetCycle(len) {
  understandingsStore.setCycleLength(len)
}

function startEditingCycle() {
  understandingsStore.startEditingCycle()
}

function discardCycleChanges() {
  understandingsStore.discardCycleChanges()
}

function triggerCustodySave() {
  if (!understandingsStore.isFullyAssigned) {
    alert(t('completeToSave'))
    return
  }
  isCustodySaveModalOpen.value = true
}

function finalSaveCycle() {
  understandingsStore.saveCycle()
  isCustodySaveModalOpen.value = false
}

function handleDayClick(index) {
  activeDayIndex.value = index
}

function closeAssignModal() {
  activeDayIndex.value = null
}

function confirmAssignment(data) {
  understandingsStore.assignDayAllocation(
    data.dayIndex,
    data.children,
    data.parent,
    data.repeat
  )
  closeAssignModal()
}

// Understanding Functions
function openCreateModal(subject) {
  editingItem.value = null
  preselectedSubject.value = subject
  isModalOpen.value = true
}

function openEditModal(item) {
  editingItem.value = item
  preselectedSubject.value = null
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
  editingItem.value = null
  preselectedSubject.value = null
}

function handleSave(data) {
  if (editingItem.value) {
    understandingsStore.updateUnderstanding(editingItem.value.id, data)
  } else {
    understandingsStore.addUnderstanding(data)
  }
  closeModal()
}

function handleTerminate() {
  closeModal()
  openConfirmModal(
    t('terminateTitle'),
    t('terminateMsg'),
    () => {
      if (editingItem.value) {
        understandingsStore.requestTermination(editingItem.value.id)
      }
    }
  )
}

function handleApprove(item) {
  understandingsStore.approveUnderstanding(item.id)
}

function handleReject(item) {
  understandingsStore.rejectUnderstanding(item.id)
}

function handleCancel(item) {
  openConfirmModal(
    t('confirmForfeit'),
    t('forfeitMsg'),
    () => {
      understandingsStore.cancelProposal(item.id)
    }
  )
}

function handleToggleHistory(id) {
  understandingsStore.toggleHistory(id)
}

function reviveItem(item) {
  understandingsStore.reviveUnderstanding(item.id)
  openEditModal(item)
}

// File Upload
function triggerUpload() {
  fileInput.value.click()
}

function handleFileUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  alert(`Simulating AI Analysis for: ${file.name}`)
  setTimeout(() => {
    understandingsStore.addUnderstanding({
      subject: 'expenses',
      content: 'Extracted: Parents split extra-curriculars 50/50.',
      expiration: ''
    })
  }, 1000)
}

// Confirmation Modal
function openConfirmModal(title, message, actionFn) {
  confirmModal.value = {
    isOpen: true,
    title,
    message,
    action: actionFn
  }
}

function closeConfirmModal() {
  confirmModal.value.isOpen = false
  confirmModal.value.action = null
}

function executeConfirmAction() {
  try {
    if (confirmModal.value.action) {
      confirmModal.value.action()
    }
  } catch (err) {
    console.error('Action failed:', err)
  } finally {
    closeConfirmModal()
  }
}
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('understandings') }}</h1>
        <p class="page-subtitle">{{ t('pageSubtitle') }}</p>
      </div>

      <button @click="triggerUpload" class="upload-agreement-btn">
        <Upload class="w-4 h-4" />
        <span>{{ t('uploadAgreement') }}</span>
      </button>
      <input type="file" ref="fileInput" class="hidden" @change="handleFileUpload">
    </div>

    <!-- Module summary: counts + custody cycle pill -->
    <ModuleDashboard>
      <template #summary>
        <div class="module-summary-row">
          <span class="module-summary-text">
            <span class="bidi-isolate">{{ interp(t('summaryUnderstandings'), { count: activeUnderstandingsCount }) }}</span>
            <template v-if="awaitingApprovalCount > 0">
              <span class="module-summary-sep">·</span>
              <span class="module-summary-warn bidi-isolate">{{ interp(t('summaryAwaitingApproval'), { count: awaitingApprovalCount }) }}</span>
            </template>
          </span>
          <span v-if="understandingsStore.cycleLength" class="module-summary-pill bidi-isolate">
            {{ interp(t('summaryCycleDays'), { count: understandingsStore.cycleLength }) }}
          </span>
        </div>
      </template>
    </ModuleDashboard>

    <!-- Custody Cycle Section -->
    <div class="mb-12">
      <SectionHeader
        :title="t('parentingTime')"
        icon="calendar.png"
        :has-action="true"
        action-type="edit"
        :is-editing="understandingsStore.isCycleEditing"
        @action="startEditingCycle"
        @save="triggerCustodySave"
        @discard="discardCycleChanges"
      />

      <CustodyCycleEditor
        :cycle-days="understandingsStore.cycleDays"
        :cycle-length="understandingsStore.cycleLength"
        :is-editing="understandingsStore.isCycleEditing"
        :default-handoff-time="understandingsStore.defaultHandoffTime"
        @set-cycle="handleSetCycle"
        @day-click="handleDayClick"
        @update:default-handoff-time="v => understandingsStore.defaultHandoffTime = v"
      />
    </div>

    <!-- Grouped Understandings -->
    <div v-for="(items, subject) in understandingsStore.groupedUnderstandings" :key="subject" class="mb-10">
      <SectionHeader
        :title="t(subject)"
        icon="understandings.png"
        :has-action="true"
        @action="openCreateModal(subject)"
      />

      <!-- Expense Rules Panel (only in expenses section) -->
      <ExpenseRulesPanel v-if="subject === 'expenses'" />

      <div class="flex flex-col">
        <UnderstandingItem
          v-for="item in items"
          :key="item.id"
          :item="item"
          @edit="openEditModal"
          @approve="handleApprove"
          @reject="handleReject"
          @cancel="handleCancel"
          @toggle-history="handleToggleHistory"
        />
      </div>
    </div>

    <!-- Empty State (no text understandings recorded yet) -->
    <EmptyState
      v-if="!hasTextUnderstandings"
      :icon="Handshake"
      :title="t('noUnderstandings')"
    />

    <!-- Central Add Button -->
    <div class="add-center-btn" @click="openCreateModal(null)">
      <Plus class="w-8 h-8" />
    </div>

    <!-- Rejected Section -->
    <div class="rejected-section" v-if="understandingsStore.rejectedItems.length">
      <div class="rejected-header" @click="isRejectedOpen = !isRejectedOpen">
        <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {{ t('rejectedList') }} ({{ understandingsStore.rejectedItems.length }})
        </span>
        <div class="rejected-line"></div>
        <component :is="isRejectedOpen ? ChevronUp : ChevronDown" class="w-4 h-4 text-slate-400" />
      </div>

      <div v-if="isRejectedOpen" class="rejected-list flex flex-col gap-2">
        <div v-for="item in understandingsStore.rejectedItems" :key="item.id" class="understanding-item rejected-item">
          <div class="item-main-row">
            <div class="u-status-icon u-status-rejected">
              <AlertCircle class="w-3 h-3" />
            </div>
            <div class="u-content">
              <p class="u-text text-start">{{ item.content }}</p>
              <div class="u-meta flex-wrap gap-2">
                <span v-if="item.terminatedDate" class="text-red-500 bidi-isolate">
                  {{ t('terminatedOn') }}: {{ item.terminatedDate }}
                </span>
                <span v-else>{{ t('rejected') }}</span>

                <button @click="reviveItem(item)" class="text-[10px] font-bold uppercase underline ms-2 text-slate-500">
                  {{ t('revive') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Understanding Form Modal -->
    <UnderstandingFormModal
      :is-open="isModalOpen"
      :item="editingItem"
      :preselected-subject="preselectedSubject"
      @close="closeModal"
      @save="handleSave"
      @terminate="handleTerminate"
    />

    <!-- Custody Assignment Modal -->
    <CustodyAssignModal
      :is-open="activeDayIndex !== null"
      :day-index="activeDayIndex"
      @close="closeAssignModal"
      @confirm="confirmAssignment"
    />

    <!-- Custody Save Confirmation Modal -->
    <ConfirmModal
      :show="isCustodySaveModalOpen"
      :title="t('confirmChanges')"
      :message="t('warningText')"
      :icon="AlertCircle"
      :confirmText="t('yesApply')"
      @close="isCustodySaveModalOpen = false"
      @confirm="finalSaveCycle"
    />

    <!-- Generic Confirmation Modal -->
    <ConfirmModal
      :show="confirmModal.isOpen"
      :title="confirmModal.title"
      :message="confirmModal.message"
      :icon="AlertCircle"
      @close="closeConfirmModal"
      @confirm="executeConfirmAction"
    />
  </AppLayout>
</template>

<style scoped>
.upload-agreement-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  color: #334155;
  padding: 0.625rem 1.125rem;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: transform 0.12s;
}

.upload-agreement-btn:active {
  transform: scale(0.96);
}

@media (max-width: 479px) {
  .upload-agreement-btn {
    padding: 0.55rem 0.85rem;
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    gap: 0.4rem;
  }
}
</style>
