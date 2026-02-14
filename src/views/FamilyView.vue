<script setup>
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import PickupModal from '@/components/family/PickupModal.vue'
import DropoffModal from '@/components/family/DropoffModal.vue'
import BriefModal from '@/components/family/BriefModal.vue'
import CalendarSection from '@/components/family/CalendarSection.vue'
import AddEventModal from '@/components/family/AddEventModal.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { useRouter } from 'vue-router'
import { ChevronDown, AlertTriangle } from 'lucide-vue-next'

const { t } = useI18n()
const dashboardStore = useSupabaseDashboardStore()
const router = useRouter()

const children = computed(() => dashboardStore.children)
const hasChildren = computed(() => children.value.length > 0)
const loading = computed(() => dashboardStore.loading)

// Load family data on mount
onMounted(() => {
  dashboardStore.loadFamilyData()
})

const activeModal = ref(null)
const selectedChild = ref(null)
const expandedIds = ref(new Set())
const showAddEventModal = ref(false)
const addEventInitialDate = ref('')
const showUnexpectedParentModal = ref(false)
const unexpectedPickupChildId = ref(null)

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

function toggleExpand(childId) {
  if (expandedIds.value.has(childId)) {
    expandedIds.value.delete(childId)
  } else {
    expandedIds.value.add(childId)
  }
}

function isExpanded(childId) {
  return expandedIds.value.has(childId)
}

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
  dashboardStore.confirmDropoff(data.child.id, data.location, data.items)
}

function openAddEventModal(date) {
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
}
</script>

<template>
  <AppLayout>
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
        <div
          v-for="child in children"
          :key="child.id"
          :class="['child-card', child.gender === 'boy' ? 'card-boy' : 'card-girl']"
        >
          <!-- Top row: Avatar + Info -->
          <div class="card-top" @click="toggleExpand(child.id)">
            <div class="avatar-wrapper">
              <img
                :src="child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'"
                class="avatar-img"
                :alt="child.name"
              />
            </div>
            <div class="card-info">
              <h4 class="child-name">{{ child.name }}</h4>
              <div class="status-pill">
                <div class="status-dot"></div>
                <span>{{ t(child.status) }}</span>
              </div>
              <div class="card-meta">
                <span v-if="expectedParentLabel" class="custody-day">{{ t(expectedParentLabel + 'Day') }}</span>
                <span v-if="child.nextHandoffTime" class="handoff-time bidi-isolate">{{ child.nextHandoffTime }}</span>
              </div>
            </div>
          </div>

          <!-- Bottom row: expand + Action button -->
          <div class="card-bottom">
            <div class="expand-toggle" @click="toggleExpand(child.id)">
              <ChevronDown :size="16" :class="['chevron-icon', { 'flipped': isExpanded(child.id) }]" />
            </div>
            <img
              :src="child.nextAction === 'pick' ? '/assets/pickme_button.png' : '/assets/dropfoff_button.png'"
              class="btn-action"
              alt="Status Action"
              @click.stop="openModal(child, child.nextAction === 'pick' ? 'pickup' : 'dropoff')"
            />
          </div>

          <!-- Expandable Drawer -->
          <div class="child-drawer" :class="{ 'drawer-open': isExpanded(child.id) }">
            <div class="drawer-inner">
              <div class="timeline-section">
                <h5 class="timeline-title">{{ t('myDay') }}</h5>
                <div class="timeline-bar">
                  <div class="progress-fill" :style="{ width: child.dayProgress + '%' }"></div>
                  <div class="current-time-dot" :style="{ left: child.dayProgress + '%' }"></div>
                  <div
                    v-for="(ev, idx) in child.todaysEvents"
                    :key="idx"
                    class="timeline-event"
                    :class="{ 'past': ev.pos < child.dayProgress }"
                    :style="{ left: ev.pos + '%' }"
                  >
                    <span class="event-time bidi-isolate">{{ ev.time }}</span>
                    <div class="event-marker"></div>
                    <span class="event-label">{{ t(ev.label) }}</span>
                  </div>
                </div>
              </div>
              <div class="drawer-buttons">
                <img src="/assets/check.png" class="drawer-btn" alt="Check" />
                <img
                  :src="child.gender === 'boy' ? '/assets/brief_boy.png' : '/assets/brief_girl.png'"
                  class="drawer-btn drawer-btn-wide"
                  alt="Brief"
                  @click.stop="openModal(child, 'brief')"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-12">
      <SectionHeader :title="t('calendar')" icon="calendar.png" :hasAction="true" @action="openAddEventModal" />
      <CalendarSection @addEvent="openAddEventModal" />
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

    <AddEventModal
      v-if="showAddEventModal"
      :initialDate="addEventInitialDate"
      @close="showAddEventModal = false"
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
  </AppLayout>
</template>

<style scoped>
/* ===== Grid ===== */
.children-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

/* ===== Card ===== */
.child-card {
  border-radius: 1.25rem;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 2px solid #f1f5f9;
  transition: all 0.3s ease;
}

.child-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-boy { background: linear-gradient(145deg, #e0f2fe 0%, #f0f9ff 100%); }
.card-girl { background: linear-gradient(145deg, #fce7f3 0%, #fdf2f8 100%); }

/* ===== Top: Avatar + Info (horizontal) ===== */
.card-top {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 0.75rem 0.25rem;
  cursor: pointer;
}

.avatar-wrapper {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.child-name {
  font-size: 1.0625rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  width: fit-content;
}

.status-dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-pill span {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #475569;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.custody-day {
  font-size: 0.5625rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.handoff-time {
  font-size: 0.75rem;
  font-weight: 900;
  color: #0f172a;
}

/* ===== Bottom: Action + Expand ===== */
.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.75rem 0.5rem;
}

.btn-action {
  width: 5rem;
  height: auto;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-action:hover { transform: scale(1.05); }
.btn-action:active { transform: scale(0.95); }

.expand-toggle {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.expand-toggle:hover { background: rgba(255, 255, 255, 0.9); }

.chevron-icon {
  color: #94a3b8;
  transition: transform 0.3s ease;
}

.chevron-icon.flipped { transform: rotate(180deg); }

/* ===== Drawer ===== */
.child-drawer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease;
}

.child-drawer.drawer-open { max-height: 350px; }

.drawer-inner {
  padding: 0 0.75rem 0.75rem;
}

/* ===== Timeline ===== */
.timeline-section { margin-bottom: 0.75rem; }

.timeline-title {
  font-size: 0.625rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 0.5rem;
  text-align: start;
}

.timeline-bar {
  position: relative;
  height: 80px;
  background: linear-gradient(to bottom, transparent 48%, #e2e8f0 48%, #e2e8f0 52%, transparent 52%);
  border-radius: 6px;
  margin-top: 1rem;
}

.progress-fill {
  position: absolute;
  top: 48%;
  left: 0;
  height: 4%;
  background: linear-gradient(90deg, #10b981 0%, #0d9488 100%);
  border-radius: 6px;
  transition: width 0.3s ease;
  z-index: 1;
}

.current-time-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: #0d9488;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 1px 6px rgba(13, 148, 136, 0.5);
  z-index: 3;
}

.timeline-event {
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
}

.timeline-event.past { opacity: 0.7; }

.event-time {
  font-size: 0.5625rem;
  font-weight: 900;
  color: #1e293b;
  white-space: nowrap;
  background: white;
  padding: 1px 4px;
  border-radius: 3px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: absolute;
  top: -22px;
}

.event-marker {
  width: 10px;
  height: 10px;
  background: white;
  border: 2px solid #64748b;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.timeline-event.past .event-marker {
  background: #10b981;
  border-color: #10b981;
}

.event-label {
  font-size: 0.5rem;
  font-weight: 800;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.2px;
  white-space: nowrap;
  background: white;
  padding: 1px 4px;
  border-radius: 3px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: absolute;
  top: 24px;
}

/* ===== Drawer Buttons ===== */
.drawer-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.drawer-btn {
  height: 2.25rem;
  width: auto;
  cursor: pointer;
  transition: transform 0.2s;
}

.drawer-btn-wide { height: 2rem; }
.drawer-btn:hover { transform: scale(1.08); }
.drawer-btn:active { transform: scale(0.95); }

/* ===== Responsive ===== */
@media (max-width: 480px) {
  .children-grid { gap: 0.5rem; }
  .card-top { padding: 0.625rem 0.625rem 0.25rem; gap: 0.5rem; }
  .avatar-wrapper { width: 2.75rem; height: 2.75rem; }
  .child-name { font-size: 0.9375rem; }
  .btn-action { width: 4rem; }
  .timeline-bar { height: 60px; }
}

@media (max-width: 340px) {
  .children-grid { grid-template-columns: 1fr; }
}
</style>
