<script setup>
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import UnifiedBoard from '@/components/management/UnifiedBoard.vue'
import CreateItemModal from '@/components/management/CreateItemModal.vue'
import ItemDetailModal from '@/components/management/ItemDetailModal.vue'
import CustodyOverrideCard from '@/components/family/CustodyOverrideCard.vue'
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

    <!-- Section Header: Tasks -->
    <SectionHeader
      :title="t('ongoingTasks')"
      icon="management.png"
      :hasAction="true"
      @action="openCreateModal('task')"
    />

    <!-- Pending Custody Overrides -->
    <div v-if="dashboardStore.pendingOverrides.length > 0" class="overrides-list">
      <CustodyOverrideCard
        v-for="override in dashboardStore.pendingOverrides"
        :key="override.id"
        :override="override"
        @approve="dashboardStore.respondToCustodyOverride(override.id, 'approve')"
        @reject="dashboardStore.respondToCustodyOverride(override.id, 'reject')"
      />
    </div>

    <!-- Group 1: Unassigned Tasks (warning) -->
    <UnifiedBoard
      v-if="managementStore.unassignedTasks.length > 0"
      :items="managementStore.unassignedTasks"
      groupTitle="waitingForOwner"
      groupColor="#fb923c"
      @openDetail="openDetailModal"
    />

    <!-- Group 2: Assigned Tasks (sortable) -->
    <UnifiedBoard
      :items="managementStore.sortedAssignedTasks"
      groupTitle="assignedTasks"
      groupColor="#3b82f6"
      :sortable="true"
      :showAddRow="true"
      :emptyText="t('noTasks')"
      @openDetail="openDetailModal"
      @addNew="openCreateModal('task')"
    />

    <!-- Section Header: Asks -->
    <SectionHeader
      :title="t('asksAndDaySwaps')"
      icon="understandings.png"
      :hasAction="true"
      @action="openCreateModal('ask')"
      class="mt-8"
    />

    <!-- Group 3: Asks & Day Swaps (sortable) -->
    <UnifiedBoard
      :items="managementStore.sortedPendingAsks"
      groupTitle="pendingRequests"
      groupColor="#0d9488"
      :sortable="true"
      :showAddRow="true"
      :emptyText="t('noItems')"
      @openDetail="openDetailModal"
      @addNew="openCreateModal('ask')"
    />

    <!-- Group 4: Completed (collapsible) -->
    <UnifiedBoard
      v-if="managementStore.completedItems.length > 0"
      :items="managementStore.completedItems"
      groupTitle="completed"
      groupColor="#10b981"
      :collapsible="true"
      :collapsed="!showCompleted"
      @openDetail="openDetailModal"
      @toggleCollapse="showCompleted = !showCompleted"
    />

    <!-- Group 5: Rejected (collapsible) -->
    <div class="mb-24">
      <UnifiedBoard
        v-if="managementStore.rejectedItems.length > 0"
        :items="managementStore.rejectedItems"
        groupTitle="rejected"
        groupColor="#ef4444"
        :collapsible="true"
        :collapsed="!showRejected"
        @openDetail="openDetailModal"
        @toggleCollapse="showRejected = !showRejected"
      />
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
  top: calc(clamp(44px, 12vw, 56px) + 8px);
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

/* FAB: visible only on mobile */
@media (max-width: 640px) {
  .page-title {
    font-size: 1.75rem;
  }
}
</style>
