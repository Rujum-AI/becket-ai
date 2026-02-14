<script setup>
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import SectionHeader from '@/components/layout/SectionHeader.vue'
import PickupModal from '@/components/family/PickupModal.vue'
import DropoffModal from '@/components/family/DropoffModal.vue'
import BriefModal from '@/components/family/BriefModal.vue'
import CalendarSection from '@/components/family/CalendarSection.vue'
import AddEventModal from '@/components/family/AddEventModal.vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { useRouter } from 'vue-router'
import { ChevronDown } from 'lucide-vue-next'

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

// Router guard handles family check now, no need for manual redirect

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
  console.log('Opening modal:', modalType, 'for child:', child.name)
  selectedChild.value = child
  activeModal.value = modalType
  console.log('activeModal:', activeModal.value, 'selectedChild:', selectedChild.value)
}

function closeModal() {
  activeModal.value = null
  selectedChild.value = null
}

function confirmPickup(child) {
  dashboardStore.confirmPickup(child.id)
  console.log('Pickup confirmed for:', child.name)
  // In Phase 3, this will update Supabase
}

function confirmDropoff(data) {
  dashboardStore.confirmDropoff(data.child.id, data.location, data.items)
  console.log('Dropoff confirmed:', data)
  // In Phase 3, this will update Supabase
}

function openAddEventModal() {
  showAddEventModal.value = true
}

function saveEvent(eventData) {
  console.log('Saving event:', eventData)
  // In Phase 4, this will save to Supabase
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

      <div v-else class="flex flex-col gap-4">
        <div
          v-for="child in children"
          :key="child.id"
          :class="['child-card-wrapper', child.gender === 'boy' ? 'card-boy' : 'card-girl', isExpanded(child.id) ? 'expanded' : '']"
        >
          <!-- Child Header -->
          <div class="child-header">
            <div class="child-thumb">
              <img
                :src="child.gender === 'boy' ? '/assets/thumbnail_boy.png' : '/assets/thumbnail_girl.png'"
                class="w-full h-full object-contain scale-110 translate-y-1"
                :alt="child.name"
              />
            </div>
            <div class="child-info text-start">
              <h4 class="text-2xl font-bold text-slate-800 leading-none mb-1.5 truncate">{{ child.name }}</h4>
              <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 border border-white/50 w-fit max-w-full">
                <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0"></div>
                <span class="text-xs font-bold text-slate-600 whitespace-nowrap truncate">{{ t(child.status) }}</span>
              </div>
            </div>
            <div class="flex flex-col items-end text-end ms-auto flex-shrink-0">
              <span class="text-sm font-black text-slate-800 leading-tight bidi-isolate">{{ child.nextEventTime }}</span>
              <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate max-w-[80px]">{{ t(child.nextEventLoc) }}</span>
            </div>
            <img
              :src="child.nextAction === 'pick' ? '/assets/pickme_button.png' : '/assets/dropfoff_button.png'"
              class="btn-status"
              alt="Status Action"
              @click.stop="openModal(child, child.nextAction === 'pick' ? 'pickup' : 'dropoff')"
            />
            <div class="card-toggle-btn" @click="toggleExpand(child.id)">
              <ChevronDown :size="20" :class="['transition-transform', isExpanded(child.id) ? 'rotate-180' : '']" />
            </div>
          </div>

          <!-- Expandable Drawer -->
          <div class="child-drawer" :class="{'expanded': isExpanded(child.id)}">
            <div class="drawer-content">
              <!-- Timeline -->
              <div class="timeline-container">
                <h5 class="text-[15px] font-bold text-slate-400 uppercase tracking-widest mb-4 text-start">{{ t('myDay') }}</h5>
                <div class="timeline-bar">
                  <div class="progress-fill" :style="{width: child.dayProgress + '%'}"></div>
                  <div class="current-time-dot" :style="{left: child.dayProgress + '%'}"></div>
                  <div
                    v-for="(ev, idx) in child.todaysEvents"
                    :key="idx"
                    class="timeline-event"
                    :class="{'past': ev.pos < child.dayProgress}"
                    :style="{left: ev.pos + '%'}"
                  >
                    <span class="event-time bidi-isolate">{{ev.time}}</span>
                    <div class="event-marker"></div>
                    <span class="event-label">{{ t(ev.label) }}</span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="drawer-actions">
                <img src="/assets/check.png" class="btn-check" alt="Check" />
                <div class="drawer-separator"></div>
                <img
                  :src="child.gender === 'boy' ? '/assets/brief_boy.png' : '/assets/brief_girl.png'"
                  class="btn-brief"
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
      <CalendarSection />
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
      @close="showAddEventModal = false"
      @save="saveEvent"
    />
  </AppLayout>
</template>

<style scoped>
.child-card-wrapper {
  background: white;
  border-radius: 2rem;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 2px solid #f1f5f9;
  transition: all 0.3s ease;
}

.child-card-wrapper:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.child-card-wrapper.expanded {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.card-boy {
  background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
}

.card-girl {
  background: linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%);
}

.child-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
}

.child-thumb {
  width: 4rem;
  height: 4rem;
  border-radius: 1rem;
  background: white;
  padding: 0.25rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.child-info {
  flex: 1;
  min-width: 0;
}

.btn-status {
  width: 5rem;
  height: auto;
  cursor: pointer;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.btn-status:hover {
  transform: scale(1.05);
}

.btn-status:active {
  transform: scale(0.95);
}

.card-toggle-btn {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.card-toggle-btn:hover {
  background: white;
  transform: scale(1.1);
}

.child-drawer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.child-drawer.expanded {
  max-height: 500px;
}

.drawer-content {
  padding: 0 1.5rem 1.5rem;
}

.timeline-container {
  margin-bottom: 1.5rem;
}

.timeline-bar {
  position: relative;
  height: 180px;
  background: linear-gradient(to bottom, transparent 48%, #e2e8f0 48%, #e2e8f0 52%, transparent 52%);
  border-radius: 8px;
  margin-top: 2rem;
}

.progress-fill {
  position: absolute;
  top: 48%;
  left: 0;
  height: 4%;
  background: linear-gradient(90deg, #10b981 0%, #0d9488 100%);
  border-radius: 8px;
  transition: width 0.3s ease;
  z-index: 1;
}

.current-time-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: #0d9488;
  border: 4px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 12px rgba(13, 148, 136, 0.5);
  z-index: 3;
}

.timeline-event {
  position: absolute;
  left: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 2;
}

.timeline-event.past {
  opacity: 0.7;
}

.event-time {
  font-size: 15px;
  font-weight: 900;
  color: #1e293b;
  white-space: nowrap;
  background: white;
  padding: 4px 10px;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  position: absolute;
  top: -45px;
}

.event-marker {
  width: 18px;
  height: 18px;
  background: white;
  border: 4px solid #64748b;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.timeline-event.past .event-marker {
  background: #10b981;
  border-color: #10b981;
}

.event-label {
  font-size: 13px;
  font-weight: 800;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
  background: white;
  padding: 4px 10px;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  position: absolute;
  top: 40px;
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.btn-check,
.btn-brief {
  width: 4rem;
  height: auto;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-check:hover,
.btn-brief:hover {
  transform: scale(1.1);
}

.btn-check:active,
.btn-brief:active {
  transform: scale(0.95);
}

.drawer-separator {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, #e2e8f0 50%, transparent 100%);
}
</style>
