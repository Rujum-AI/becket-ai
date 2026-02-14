<script setup>
import { ref, computed } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import TaskBoard from '@/components/management/TaskBoard.vue'
import AskBoard from '@/components/management/AskBoard.vue'
import CreateItemModal from '@/components/management/CreateItemModal.vue'
import ItemDetailModal from '@/components/management/ItemDetailModal.vue'
import { useI18n } from '@/composables/useI18n'
import { useManagementStore } from '@/stores/management'

const { t } = useI18n()
const managementStore = useManagementStore()

const showCreateModal = ref(false)
const createModalType = ref('task')
const selectedItem = ref(null)
const selectedItemType = ref(null)

const activeTasksCount = computed(() => {
  return managementStore.sortedAssignedTasks.length
})

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
          <span class="bidi-isolate">{{ activeTasksCount }}</span>
          {{ t('activeTasks') }}
        </p>
      </div>
    </div>

    <!-- Tasks Section -->
    <div class="mb-12">
      <SectionHeader
        :title="t('tasks')"
        icon="management.png"
        :hasAction="true"
        @action="openCreateModal('task')"
      />
      <TaskBoard @openDetail="openDetailModal" />
    </div>

    <!-- Asks Section -->
    <div class="mb-24">
      <SectionHeader
        :title="t('asks')"
        icon="understandings.png"
        :hasAction="true"
        @action="openCreateModal('ask')"
      />
      <AskBoard @openDetail="openDetailModal" />
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
</style>
