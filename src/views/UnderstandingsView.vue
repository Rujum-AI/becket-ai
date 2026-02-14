<script setup>
import { ref, onMounted } from 'vue'
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
import { Upload, Plus, AlertCircle, ChevronUp, ChevronDown } from 'lucide-vue-next'

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
    <div class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
      <div>
        <h1 class="text-4xl font-serif text-slate-900 mb-2">{{ t('understandings') }}</h1>
        <p class="text-slate-400 font-bold text-sm">{{ t('pageSubtitle') }}</p>
      </div>

      <button @click="triggerUpload" class="bg-white border border-slate-200 shadow-sm text-slate-700 px-5 py-3 rounded-full font-bold text-xs uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-transform">
        <Upload class="w-4 h-4" />
        {{ t('uploadAgreement') }}
      </button>
      <input type="file" ref="fileInput" class="hidden" @change="handleFileUpload">
    </div>

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
        @set-cycle="handleSetCycle"
        @day-click="handleDayClick"
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
