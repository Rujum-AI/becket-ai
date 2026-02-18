<script setup>
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import ChildCard from '@/components/family/ChildCard.vue'
import PickupModal from '@/components/family/PickupModal.vue'
import DropoffModal from '@/components/family/DropoffModal.vue'
import BriefModal from '@/components/family/BriefModal.vue'
import DocumentsModal from '@/components/family/DocumentsModal.vue'
import CalendarSection from '@/components/family/CalendarSection.vue'
import AddEventFlow from '@/components/family/AddEventFlow.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { useUpdatesStore } from '@/stores/supabaseUpdates'
import { useAuth } from '@/composables/useAuth'
import { AlertTriangle, Clock, Send } from 'lucide-vue-next'
import InviteCoParentModal from '@/components/shared/InviteCoParentModal.vue'

const { t } = useI18n()
const dashboardStore = useSupabaseDashboardStore()
const updatesStore = useUpdatesStore()
const { user } = useAuth()

const children = computed(() => dashboardStore.children)
const hasChildren = computed(() => children.value.length > 0)
const loading = computed(() => dashboardStore.loading)
const pendingInvite = computed(() => dashboardStore.pendingInvite)
const showInviteModal = ref(false)

// Load family data on mount
onMounted(() => {
  dashboardStore.loadFamilyData()
})

const activeModal = ref(null)
const selectedChild = ref(null)
const showAddEventModal = ref(false)
const addEventInitialDate = ref('')
const editingEvent = ref(null)
const showUnexpectedParentModal = ref(false)
const unexpectedPickupChildId = ref(null)

// Check-in
const nudgeSending = ref(null)

function canNudge(child) {
  return dashboardStore.partnerId && child.currentParentId && child.currentParentId !== user.value?.id
}

async function sendNudge(child) {
  if (nudgeSending.value) return
  nudgeSending.value = child.id
  await updatesStore.sendNudge(child.id, child.name)
  nudgeSending.value = null
}

// Expected custody parent label for today
const expectedParentLabel = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return dashboardStore.getExpectedParent(today)
})

// Message for unexpected parent modal
const unexpectedPickupMessage = computed(() => {
  const parentName = t(expectedParentLabel.value || 'partner')
  return t('unexpectedPickupMsg') + ' ' + parentName
})

function openModal(child, modalType) {
  selectedChild.value = child
  activeModal.value = modalType
}

function closeModal() {
  activeModal.value = null
  selectedChild.value = null
}

async function confirmPickup(child) {
  const result = await dashboardStore.confirmPickup(child.id)

  // If unexpected parent, show confirmation dialog
  if (result?.unexpectedParent) {
    unexpectedPickupChildId.value = result.childId
    showUnexpectedParentModal.value = true
    closeModal()
    return
  }
}

async function forcePickup() {
  showUnexpectedParentModal.value = false
  if (unexpectedPickupChildId.value) {
    await dashboardStore.confirmPickup(unexpectedPickupChildId.value, { force: true })
    unexpectedPickupChildId.value = null
  }
}

function cancelUnexpectedPickup() {
  showUnexpectedParentModal.value = false
  unexpectedPickupChildId.value = null
}

function confirmDropoff(data) {
  dashboardStore.confirmDropoff(data.child.id, data.location, data.items, data.snapshotId)
}

function openAddEventModal(date) {
  editingEvent.value = null
  if (date instanceof Date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    addEventInitialDate.value = `${y}-${m}-${d}`
  } else {
    addEventInitialDate.value = ''
  }
  showAddEventModal.value = true
}

function onEventSaved() {
  showAddEventModal.value = false
  editingEvent.value = null
}

function handleEditEvent(event) {
  editingEvent.value = event
  showAddEventModal.value = true
}

async function handleDeleteEvent(event) {
  await dashboardStore.deleteEvent(event.id)
}
</script>

<template>
  <AppLayout>
    <!-- Pending Invite Banner -->
    <div v-if="pendingInvite" class="invite-banner" @click="showInviteModal = true">
      <div class="invite-banner-content">
        <Clock :size="20" class="invite-banner-icon" />
        <div class="invite-banner-text">
          <p class="invite-banner-title">{{ t('invitePendingFor') }} <strong>{{ pendingInvite.email }}</strong></p>
          <p class="invite-banner-sub">{{ t('inviteAwaitingApproval') }}</p>
        </div>
        <Send :size="16" class="invite-banner-action" />
      </div>
    </div>

    <div class="mb-12">
      <SectionHeader :title="t('children')" icon="family.png" />

      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <p class="text-slate-500 text-center text-lg">Loading...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!hasChildren" class="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <p class="text-slate-500 text-center text-lg">{{ t('children') }} section is empty</p>
        <p class="text-slate-400 text-sm text-center mt-4">
          Complete onboarding to add children to your family dashboard.
        </p>
      </div>

      <div v-else class="children-grid">
        <ChildCard
          v-for="(child, index) in children"
          :key="child.id"
          :child="child"
          :colorIndex="index"
          :expectedParentLabel="expectedParentLabel"
          :canNudge="canNudge(child)"
          :nudgeSending="nudgeSending === child.id"
          @open-pickup="c => openModal(c, 'pickup')"
          @open-dropoff="c => openModal(c, 'dropoff')"
          @open-brief="c => openModal(c, 'brief')"
          @open-documents="c => openModal(c, 'documents')"
          @send-nudge="sendNudge"
        />
      </div>
    </div>

    <div class="mb-12">
      <SectionHeader :title="t('calendar')" icon="calendar.png" :hasAction="true" @action="openAddEventModal" />
      <CalendarSection
        @addEvent="openAddEventModal"
        @editEvent="handleEditEvent"
        @deleteEvent="handleDeleteEvent"
      />
    </div>

    <!-- Modals -->
    <PickupModal
      v-if="activeModal === 'pickup' && selectedChild"
      :child="selectedChild"
      @close="closeModal"
      @confirm="confirmPickup"
    />

    <DropoffModal
      v-if="activeModal === 'dropoff' && selectedChild"
      :child="selectedChild"
      @close="closeModal"
      @confirm="confirmDropoff"
    />

    <BriefModal
      v-if="activeModal === 'brief' && selectedChild"
      :child="selectedChild"
      @close="closeModal"
    />

    <DocumentsModal
      v-if="activeModal === 'documents' && selectedChild"
      :child="selectedChild"
      @close="closeModal"
    />

    <AddEventFlow
      v-if="showAddEventModal"
      :initialDate="addEventInitialDate"
      :editEvent="editingEvent"
      @close="showAddEventModal = false; editingEvent = null"
      @save="onEventSaved"
    />

    <!-- Unexpected Parent Confirmation -->
    <ConfirmModal
      :show="showUnexpectedParentModal"
      :title="t('unexpectedPickupTitle')"
      :message="unexpectedPickupMessage"
      :icon="AlertTriangle"
      :confirmText="t('pickupAnyway')"
      :cancelText="t('cancel')"
      confirmColor="bg-amber-500"
      @confirm="forcePickup"
      @close="cancelUnexpectedPickup"
    />

    <!-- Invite Co-Parent Modal -->
    <InviteCoParentModal :show="showInviteModal" @close="showInviteModal = false" />
  </AppLayout>
</template>

<style scoped>
.invite-banner {
  margin-bottom: 1rem;
  padding: 0.875rem 1rem;
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 2px solid #fcd34d;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.invite-banner:hover {
  border-color: #f59e0b;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
}

.invite-banner-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.invite-banner-icon {
  color: #f59e0b;
  flex-shrink: 0;
}

.invite-banner-text {
  flex: 1;
  min-width: 0;
}

.invite-banner-title {
  font-size: 0.875rem;
  color: #92400e;
  margin: 0;
  line-height: 1.3;
}

.invite-banner-title strong {
  font-weight: 700;
}

.invite-banner-sub {
  font-size: 0.75rem;
  color: #a16207;
  margin: 0.125rem 0 0;
}

.invite-banner-action {
  color: #d97706;
  flex-shrink: 0;
}

.children-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .children-grid {
    grid-template-columns: 1fr;
    gap: 0.625rem;
  }
}
</style>
