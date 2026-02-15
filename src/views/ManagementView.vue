<script setup>
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import TaskBoard from '@/components/management/TaskBoard.vue'
import AskBoard from '@/components/management/AskBoard.vue'
import CreateItemModal from '@/components/management/CreateItemModal.vue'
import ItemDetailModal from '@/components/management/ItemDetailModal.vue'
import CustodyOverrideCard from '@/components/family/CustodyOverrideCard.vue'
import { ChevronDown } from 'lucide-vue-next'
import { useI18n } from '@/composables/useI18n'
import { useManagementStore } from '@/stores/supabaseManagement'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'

const { t } = useI18n()
const managementStore = useManagementStore()
const dashboardStore = useSupabaseDashboardStore()

onMounted(() => {
  managementStore.fetchAll()
  if (dashboardStore.pendingOverrides.length === 0 && !dashboardStore.family) {
    dashboardStore.loadFamilyData()
  }
})

const showCreateModal = ref(false)
const createModalType = ref('task')
const selectedItem = ref(null)
const selectedItemType = ref(null)

// Collapsible sections
const showCompleted = ref(false)
const showRejected = ref(false)

// Subtitle counts
const activeCount = computed(() => managementStore.activeTasks.length)
const pendingCount = computed(() => managementStore.pendingAsks.length + dashboardStore.pendingOverrides.length)

function openCreateModal(type) {
  createModalType.value = type
  showCreateModal.value = true
}

function openDetailModal(item, type) {
  selectedItem.value = item
  selectedItemType.value = type
}

function closeDetailModal() {
  selectedItem.value = null
  selectedItemType.value = null
}
</script>

<template>
  <AppLayout>
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('management') }}</h1>
        <p class="page-subtitle">
          <span class="bidi-isolate">{{ activeCount }}</span> {{ t('activeTasks') }}
          <span class="subtitle-dot">&middot;</span>
          <span class="bidi-isolate">{{ pendingCount }}</span> {{ t('pendingRequests') || 'pending' }}
        </p>
      </div>
    </div>

    <!-- Section 1: Ongoing Tasks -->
    <div class="mb-12">
      <SectionHeader
        :title="t('ongoingTasks')"
        icon="management.png"
        :hasAction="true"
        @action="openCreateModal('task')"
      />
      <TaskBoard @openDetail="openDetailModal" />
    </div>

    <!-- Section 2: Asks & Day Swaps (includes custody overrides) -->
    <div class="mb-12">
      <SectionHeader
        :title="t('asksAndDaySwaps')"
        icon="understandings.png"
        :hasAction="true"
        @action="openCreateModal('ask')"
      />

      <!-- Pending Custody Overrides folded in -->
      <div v-if="dashboardStore.pendingOverrides.length > 0" class="overrides-list">
        <CustodyOverrideCard
          v-for="override in dashboardStore.pendingOverrides"
          :key="override.id"
          :override="override"
          @approve="dashboardStore.respondToCustodyOverride(override.id, 'approve')"
          @reject="dashboardStore.respondToCustodyOverride(override.id, 'reject')"
        />
      </div>

      <AskBoard @openDetail="openDetailModal" />
    </div>

    <!-- Section 3: Completed (collapsible) -->
    <div v-if="managementStore.completedItems.length > 0" class="mb-12">
      <button class="collapse-header" @click="showCompleted = !showCompleted">
        <span class="collapse-title">{{ t('completed') }}</span>
        <span class="collapse-count">{{ managementStore.completedItems.length }}</span>
        <ChevronDown :size="18" :class="['collapse-chevron', { open: showCompleted }]" />
      </button>
      <div v-if="showCompleted" class="archive-list">
        <div
          v-for="item in managementStore.completedItems"
          :key="item.id"
          class="archive-card"
          @click="openDetailModal(item, item.type)"
        >
          <div class="archive-card-row">
            <span class="archive-type-badge completed">{{ t(item.type) }}</span>
            <span class="archive-name">{{ item.name }}</span>
          </div>
          <span class="archive-date">{{ item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '' }}</span>
        </div>
      </div>
    </div>

    <!-- Section 4: Rejected (collapsible) -->
    <div v-if="managementStore.rejectedItems.length > 0" class="mb-24">
      <button class="collapse-header" @click="showRejected = !showRejected">
        <span class="collapse-title">{{ t('rejected') }}</span>
        <span class="collapse-count">{{ managementStore.rejectedItems.length }}</span>
        <ChevronDown :size="18" :class="['collapse-chevron', { open: showRejected }]" />
      </button>
      <div v-if="showRejected" class="archive-list">
        <div
          v-for="item in managementStore.rejectedItems"
          :key="item.id"
          class="archive-card"
          @click="openDetailModal(item, item.type)"
        >
          <div class="archive-card-row">
            <span class="archive-type-badge rejected">{{ t(item.type) }}</span>
            <span class="archive-name">{{ item.name }}</span>
          </div>
          <span class="archive-date">{{ item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '' }}</span>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <CreateItemModal
      v-if="showCreateModal"
      :initialType="createModalType"
      @close="showCreateModal = false"
    />

    <ItemDetailModal
      v-if="selectedItem"
      :item="selectedItem"
      :itemType="selectedItemType"
      :readOnly="['completed', 'failed', 'rejected'].includes(selectedItem?.status)"
      @close="closeDetailModal"
    />
  </AppLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
  position: sticky;
  top: 90px;
  z-index: 30;
  background: rgba(253, 251, 247, 0.95);
  backdrop-filter: blur(8px);
  padding: 1rem 0;
}

.page-title {
  font-size: 2.25rem;
  font-family: 'Fraunces', serif;
  color: #0f172a;
  margin-bottom: 0.25rem;
  line-height: 1.2;
}

.page-subtitle {
  color: #94a3b8;
  font-size: 0.875rem;
  font-weight: 700;
  display: flex;
  gap: 0.25rem;
}

.subtitle-dot {
  margin: 0 0.25rem;
}

.overrides-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

/* Collapsible archive sections */
.collapse-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.collapse-header:hover {
  background: #e2e8f0;
}

.collapse-title {
  font-size: 0.875rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.collapse-count {
  font-size: 0.75rem;
  font-weight: 800;
  background: #cbd5e1;
  color: #475569;
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
}

.collapse-chevron {
  margin-left: auto;
  color: #94a3b8;
  transition: transform 0.2s;
}

.collapse-chevron.open {
  transform: rotate(180deg);
}

.archive-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.archive-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.archive-card:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.archive-card-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.archive-type-badge {
  font-size: 0.625rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
}

.archive-type-badge.completed {
  background: #d1fae5;
  color: #065f46;
}

.archive-type-badge.rejected {
  background: #fee2e2;
  color: #991b1b;
}

.archive-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.archive-date {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
}
</style>
