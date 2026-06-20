<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useTrusteesStore } from '@/stores/supabaseTrustees'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import EntityCard from '@/components/trustees/EntityCard.vue'
import EntityFormModal from '@/components/trustees/EntityFormModal.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import ModuleDashboard from '@/components/shared/ModuleDashboard.vue'
import { AlertTriangle, School, Sparkles, Users } from 'lucide-vue-next'

function interp(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''))
}

const { t } = useI18n()
const trusteesStore = useTrusteesStore()
const dashboardStore = useSupabaseDashboardStore()

// Load all trustees data + children on mount
onMounted(() => {
  trusteesStore.loadAll()
  dashboardStore.loadFamilyData()
})

const showModal = ref(false)
const currentEntity = ref(null)
const currentType = ref(null)
const deleteModal = ref({ isOpen: false, type: null, item: null })

function openAddModal(type) {
  currentEntity.value = null
  currentType.value = type
  showModal.value = true
}

function openEditModal(entity, type) {
  currentEntity.value = entity
  currentType.value = type
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  currentEntity.value = null
  currentType.value = null
}

function confirmDelete(entity, type) {
  deleteModal.value = { isOpen: true, type, item: entity }
}

function closeDeleteModal() {
  deleteModal.value.isOpen = false
}

async function executeDelete() {
  const { type, item } = deleteModal.value
  closeDeleteModal()
  if (type === 'school') {
    await trusteesStore.deleteSchool(item.id)
  } else if (type === 'activity') {
    await trusteesStore.deleteActivity(item.id)
  } else {
    await trusteesStore.deletePerson(item.id)
  }
}
</script>

<template>
  <AppLayout>
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('trustees') }}</h1>
        <p class="page-subtitle">{{ t('trusteesSubtitle') }}</p>
      </div>
    </div>

    <!-- Module summary: counts across all three trustee categories -->
    <ModuleDashboard>
      <template #summary>
        <div class="module-summary-row">
          <span class="module-summary-text">
            <span class="bidi-isolate">{{ interp(t('summarySchools'), { count: trusteesStore.schools.length }) }}</span>
            <span class="module-summary-sep">·</span>
            <span class="bidi-isolate">{{ interp(t('summaryActivities'), { count: trusteesStore.activities.length }) }}</span>
            <span class="module-summary-sep">·</span>
            <span class="bidi-isolate">{{ interp(t('summaryPeople'), { count: trusteesStore.people.length }) }}</span>
          </span>
        </div>
      </template>
    </ModuleDashboard>

    <!-- Schools Section -->
    <div class="mb-10">
      <SectionHeader
        :title="t('schoolsTitle')"
        icon="school.png"
        :hasAction="true"
        @action="openAddModal('school')"
      />
      <EmptyState
        v-if="trusteesStore.schools.length === 0"
        :icon="School"
        :title="t('noSchools')"
      />
      <div v-else class="entities-grid">
        <EntityCard
          v-for="school in trusteesStore.schools"
          :key="school.id"
          :entity="school"
          type="school"
          @edit="openEditModal(school, 'school')"
          @delete="confirmDelete(school, 'school')"
        />
      </div>
    </div>

    <!-- Activities Section -->
    <div class="mb-10">
      <SectionHeader
        :title="t('activitiesTitle')"
        icon="activities.png"
        :hasAction="true"
        @action="openAddModal('activity')"
      />
      <EmptyState
        v-if="trusteesStore.activities.length === 0"
        :icon="Sparkles"
        :title="t('noActivities')"
      />
      <div v-else class="entities-grid">
        <EntityCard
          v-for="activity in trusteesStore.activities"
          :key="activity.id"
          :entity="activity"
          type="activity"
          @edit="openEditModal(activity, 'activity')"
          @delete="confirmDelete(activity, 'activity')"
        />
      </div>
    </div>

    <!-- People Section -->
    <div class="mb-24">
      <SectionHeader
        :title="t('familyFriendsTitle')"
        icon="trustees.png"
        :hasAction="true"
        @action="openAddModal('person')"
      />
      <EmptyState
        v-if="trusteesStore.people.length === 0"
        :icon="Users"
        :title="t('noPeople')"
      />
      <div v-else class="entities-grid">
        <EntityCard
          v-for="person in trusteesStore.people"
          :key="person.id"
          :entity="person"
          type="person"
          @edit="openEditModal(person, 'person')"
          @delete="confirmDelete(person, 'person')"
        />
      </div>
    </div>

    <!-- Entity Form Modal -->
    <EntityFormModal
      v-if="showModal"
      :entity="currentEntity"
      :entity-type="currentType"
      @close="closeModal"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :show="deleteModal.isOpen"
      :title="t('deleteTitle')"
      :message="t('deleteMsg')"
      :icon="AlertTriangle"
      :confirmText="t('delete')"
      @close="closeDeleteModal"
      @confirm="executeDelete"
    />
  </AppLayout>
</template>

<style scoped>
.entities-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 768px) {
  .entities-grid {
    grid-template-columns: 1fr;
  }
}

</style>
