<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import { useUpdatesStore } from '@/stores/supabaseUpdates'
import AppLayout from '@/components/layout/AppLayout.vue'
import {
  ArrowUpDown,
  CheckCheck,
  Calendar,
  ClipboardList,
  MessageSquare,
  DollarSign,
  FileCheck,
  Heart,
  Bell,
  ArrowLeft,
  ChevronDown
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const updatesStore = useUpdatesStore()

onMounted(() => {
  updatesStore.fetchUpdates()
})

watch(() => route.path, (newPath) => {
  if (newPath === '/updates') {
    updatesStore.fetchUpdates()
  }
})

function goBack() {
  router.push('/family')
}

// === Icons ===
const iconMap = {
  pickup: ArrowUpDown,
  dropoff: ArrowUpDown,
  pickup_confirmed: ArrowUpDown,
  dropoff_confirmed: ArrowUpDown,
  task: ClipboardList,
  task_assigned: ClipboardList,
  task_started: ClipboardList,
  task_completed: ClipboardList,
  task_failed: ClipboardList,
  task_rejected: ClipboardList,
  ask: MessageSquare,
  ask_received: MessageSquare,
  ask_accepted: MessageSquare,
  ask_rejected: MessageSquare,
  understanding: FileCheck,
  understanding_proposed: FileCheck,
  understanding_accepted: FileCheck,
  understanding_rejected: FileCheck,
  event: Calendar,
  expense: DollarSign,
  expense_pending: DollarSign,
  expense_added: DollarSign,
  custody_override_requested: Calendar,
  custody_override_approved: Calendar,
  custody_override_rejected: Calendar,
  nudge_request: Heart,
  nudge_response: Heart
}

function getIcon(type) {
  return iconMap[type] || Bell
}

// === Category stripe + icon colors ===
const stripeColorMap = {
  handoff: '#06b6d4',
  task: '#8b5cf6',
  ask: '#f97316',
  approval: '#f59e0b',
  event: '#3b82f6',
  expense: '#10b981',
  nudge: '#ef4444'
}

function getStripeColor(category) {
  return stripeColorMap[category] || '#94a3b8'
}

function getIconColor(category) {
  return stripeColorMap[category] || '#94a3b8'
}

// === Time formatting ===
function formatTime(timestamp) {
  const dateString = timestamp || new Date().toISOString()
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d`
  return date.toLocaleDateString()
}

// === Filter system (merged single bar) ===
const activeFilter = ref('all')

const filterChips = computed(() => [
  { key: 'all', label: t('allUpdates') },
  { key: 'handoff', label: t('handoffs') },
  { key: 'task', label: t('tasks') },
  { key: 'ask', label: t('asks') },
  { key: 'approval', label: t('approvals') },
  { key: 'event', label: t('events') },
  { key: 'expense', label: t('expenses') },
  { key: 'unread', label: t('unread') },
])

function setFilter(key) {
  if (key === 'unread') {
    updatesStore.setCategory('all')
    updatesStore.setTimeFilter('unread')
  } else {
    updatesStore.setCategory(key)
    updatesStore.setTimeFilter('all')
  }
  activeFilter.value = key
}

// === Time sections ===
const timeSections = computed(() => {
  const g = updatesStore.groupedNotifications
  return [
    { key: 'today', label: t('today') || 'Today', items: g.today || [] },
    { key: 'yesterday', label: t('yesterday') || 'Yesterday', items: g.yesterday || [] },
    { key: 'thisWeek', label: t('thisWeek') || 'This Week', items: g.thisWeek || [] },
    { key: 'older', label: t('older') || 'Older', items: g.older || [] },
  ]
})

const isEmpty = computed(() => {
  return timeSections.value.every(s => s.items.length === 0)
})

// === Grouped notification expand/collapse ===
const expandedGroups = ref(new Set())

function toggleGroup(entityId) {
  if (expandedGroups.value.has(entityId)) {
    expandedGroups.value.delete(entityId)
  } else {
    expandedGroups.value.add(entityId)
  }
  // Force reactivity
  expandedGroups.value = new Set(expandedGroups.value)
}

// === Navigation on click ===
function handleNotificationClick(notification) {
  updatesStore.markAsRead(notification.id)

  if (notification.type?.startsWith('custody_override')) {
    router.push('/management')
  } else if (notification.related_entity_type === 'expense') {
    router.push('/finance')
  } else if (notification.related_entity_type === 'task' || notification.category === 'ask') {
    router.push('/management')
  } else if (notification.category === 'nudge') {
    // Nudge clicks navigate to family
    router.push('/family')
  } else if (notification.related_entity_type === 'understanding') {
    router.push('/understandings')
  }
}

// === Inline actions ===
async function handleInlineAction(notification, action) {
  const result = await updatesStore.handleInlineAction(notification, action)
  if (result === 'open-modal') {
    // Nudge: navigate to family view (modal opens from there)
    router.push('/family')
  }
}

// === Action button helpers ===
function getPositiveActions() {
  return ['accept', 'approve', 'respond']
}

function isPositiveAction(action) {
  return getPositiveActions().includes(action)
}
</script>

<template>
  <AppLayout>
    <!-- Header -->
    <div class="activity-header">
      <div class="flex items-center gap-3">
        <button @click="goBack" class="back-btn">
          <ArrowLeft class="w-5 h-5" />
        </button>
        <h1 class="activity-title">{{ t('updates') }}</h1>
      </div>
      <button
        v-if="updatesStore.unreadCount > 0"
        @click="updatesStore.markAllAsRead()"
        class="mark-all-btn"
      >
        <CheckCheck class="w-3.5 h-3.5" />
        {{ t('markAllRead') }}
      </button>
    </div>

    <!-- Single Filter Bar -->
    <div class="filter-bar-wrap">
      <div class="filter-bar">
        <button
          v-for="chip in filterChips"
          :key="chip.key"
          @click="setFilter(chip.key)"
          class="filter-chip"
          :class="{ active: activeFilter === chip.key }"
        >
          {{ chip.label }}
        </button>
      </div>
    </div>

    <!-- Activity Feed -->
    <div class="activity-feed">
      <template v-for="section in timeSections" :key="section.key">
        <div v-if="section.items.length > 0" class="time-section">
          <!-- Sticky date header -->
          <div class="time-section-header">
            <span class="time-section-label">{{ section.label }}</span>
          </div>

          <!-- Items -->
          <div class="section-items">
            <template v-for="item in section.items" :key="item.type === 'group' ? item.entityId : item.id">

              <!-- GROUPED NOTIFICATIONS -->
              <div v-if="item.type === 'group'" class="activity-group">
                <!-- Lead item -->
                <div
                  class="activity-card"
                  :class="{ unread: !item.lead.read }"
                  @click="handleNotificationClick(item.lead)"
                >
                  <div class="card-stripe" :style="{ background: getStripeColor(item.lead.category) }"></div>
                  <div class="card-body">
                    <div class="card-top-row">
                      <component :is="getIcon(item.lead.type)" :size="16" class="card-icon" :style="{ color: getIconColor(item.lead.category) }" />
                      <span class="card-title">{{ item.lead.title }}</span>
                      <span class="card-time">{{ formatTime(item.lead.created_at) }}</span>
                      <span v-if="!item.lead.read" class="unread-dot"></span>
                    </div>
                    <p class="card-message">{{ item.lead.message }}</p>

                    <!-- Inline actions for lead -->
                    <div v-if="updatesStore.isActionable(item.lead)" class="card-actions">
                      <button
                        v-for="action in updatesStore.getActions(item.lead)"
                        :key="action"
                        class="action-btn"
                        :class="isPositiveAction(action) ? 'action-btn-positive' : 'action-btn-negative'"
                        @click.stop="handleInlineAction(item.lead, action)"
                      >
                        {{ t(action) }}
                      </button>
                    </div>

                    <!-- Group expand toggle -->
                    <button class="group-toggle" @click.stop="toggleGroup(item.entityId)">
                      <ChevronDown :size="14" :class="{ rotated: expandedGroups.has(item.entityId) }" class="toggle-icon" />
                      <span>{{ item.children.length + 1 }} {{ t('updates').toLowerCase() }}</span>
                    </button>
                  </div>
                </div>

                <!-- Expanded children -->
                <TransitionGroup v-if="expandedGroups.has(item.entityId)" name="expand" tag="div" class="group-children">
                  <div
                    v-for="child in item.children"
                    :key="child.id"
                    class="activity-card child-card"
                    :class="{ unread: !child.read }"
                    @click="handleNotificationClick(child)"
                  >
                    <div class="card-stripe" :style="{ background: getStripeColor(child.category) }"></div>
                    <div class="card-body">
                      <div class="card-top-row">
                        <component :is="getIcon(child.type)" :size="14" class="card-icon" :style="{ color: getIconColor(child.category) }" />
                        <span class="card-title">{{ child.title }}</span>
                        <span class="card-time">{{ formatTime(child.created_at) }}</span>
                        <span v-if="!child.read" class="unread-dot"></span>
                      </div>
                      <p class="card-message">{{ child.message }}</p>
                    </div>
                  </div>
                </TransitionGroup>
              </div>

              <!-- SINGLE NOTIFICATION -->
              <div
                v-else
                class="activity-card"
                :class="{ unread: !item.read }"
                @click="handleNotificationClick(item)"
              >
                <div class="card-stripe" :style="{ background: getStripeColor(item.category) }"></div>
                <div class="card-body">
                  <div class="card-top-row">
                    <component :is="getIcon(item.type)" :size="16" class="card-icon" :style="{ color: getIconColor(item.category) }" />
                    <span class="card-title">{{ item.title }}</span>
                    <span class="card-time">{{ formatTime(item.created_at) }}</span>
                    <span v-if="!item.read" class="unread-dot"></span>
                  </div>
                  <p class="card-message">{{ item.message }}</p>

                  <!-- Inline actions -->
                  <div v-if="updatesStore.isActionable(item)" class="card-actions">
                    <button
                      v-for="action in updatesStore.getActions(item)"
                      :key="action"
                      class="action-btn"
                      :class="isPositiveAction(action) ? 'action-btn-positive' : 'action-btn-negative'"
                      @click.stop="handleInlineAction(item, action)"
                    >
                      {{ t(action) }}
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <div v-if="isEmpty" class="empty-state">
        <Bell class="w-12 h-12 text-slate-300 mb-4" />
        <p class="text-slate-400 font-bold text-sm">{{ t('noUpdatesCategory') }}</p>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
/* === Activity Header === */
.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.back-btn:hover {
  background: #e2e8f0;
}

.activity-title {
  font-size: 1.75rem;
  font-family: 'Fraunces', serif;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.mark-all-btn {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #0D9488;
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}

.mark-all-btn:hover {
  color: #0b8479;
}

/* === Filter Bar === */
.filter-bar-wrap {
  position: relative;
  margin-bottom: 1.25rem;
  /* Trailing fade mask to hint at scrollable overflow */
  -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
  mask-image: linear-gradient(to right, black 85%, transparent 100%);
}

[dir="rtl"] .filter-bar-wrap {
  -webkit-mask-image: linear-gradient(to left, black 85%, transparent 100%);
  mask-image: linear-gradient(to left, black 85%, transparent 100%);
}

.filter-bar {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  padding-right: 1.5rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

[dir="rtl"] .filter-bar {
  padding-right: 0;
  padding-left: 1.5rem;
}

.filter-bar::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  padding: 0.3rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.filter-chip:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.filter-chip.active {
  background: #0f172a;
  color: white;
  border-color: #0f172a;
}

/* === Time Sections === */
.time-section {
  margin-bottom: 1.5rem;
}

.time-section-header {
  position: sticky;
  top: calc(clamp(44px, 12vw, 56px));
  z-index: 10;
  background: var(--warm-linen, #FDFBF7);
  padding: 0.5rem 0;
}

.time-section-label {
  font-size: 0.65rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.section-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* === Activity Card === */
.activity-card {
  display: flex;
  background: white;
  border: 1px solid #f1f5f9;
  border-radius: 1rem;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s ease;
}

.activity-card:hover {
  border-color: #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.activity-card.unread {
  background: #fef9f5;
}

/* Left stripe */
.card-stripe {
  width: 3px;
  flex-shrink: 0;
  opacity: 0.6;
}

.activity-card.unread .card-stripe {
  opacity: 1;
  width: 4px;
}

/* Card body */
.card-body {
  flex: 1;
  padding: 0.75rem 1rem;
  min-width: 0;
}

.card-top-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.card-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.card-title {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-time {
  font-size: 0.65rem;
  font-weight: 600;
  color: #94a3b8;
  white-space: nowrap;
}

.unread-dot {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-message {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
  line-height: 1.35;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* === Inline Actions === */
.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #f1f5f9;
}

.action-btn {
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.action-btn-positive {
  background: #0D9488;
  color: white;
}

.action-btn-positive:hover {
  background: #0b8479;
}

.action-btn-negative {
  background: #f1f5f9;
  color: #64748b;
}

.action-btn-negative:hover {
  background: #e2e8f0;
  color: #475569;
}

/* === Group Toggle === */
.group-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  color: #0D9488;
  background: none;
  border: none;
  cursor: pointer;
  margin-top: 0.35rem;
  padding: 0;
  transition: color 0.2s;
}

.group-toggle:hover {
  color: #0b8479;
}

.toggle-icon {
  transition: transform 0.2s;
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}

.group-children {
  padding-inline-start: 7px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.child-card {
  opacity: 0.85;
}

.child-card .card-body {
  padding: 0.6rem 0.85rem;
}

/* === Expand Transition === */
.expand-enter-active {
  transition: all 0.3s ease;
}

.expand-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.expand-leave-active {
  transition: all 0.2s ease;
}

.expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* === Empty State === */
.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
