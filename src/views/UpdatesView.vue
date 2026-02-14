<script setup>
import { computed, onMounted, watch } from 'vue'
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
  UserPlus,
  FileCheck,
  Gift,
  Bell,
  ArrowLeft
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const updatesStore = useUpdatesStore()

// Fetch updates on mount
onMounted(() => {
  updatesStore.fetchUpdates()
})

// Refresh when navigating back to this view
watch(() => route.path, (newPath) => {
  if (newPath === '/updates') {
    updatesStore.fetchUpdates()
  }
})

function goBack() {
  router.push('/family')
}

const iconMap = {
  pickup: ArrowUpDown,
  dropoff: ArrowUpDown,
  task: ClipboardList,
  ask: MessageSquare,
  understanding: FileCheck,
  event: Calendar,
  expense: DollarSign,
  birthday: Gift
}

const colorMap = {
  handoff: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  task: 'bg-purple-50 text-purple-600 border-purple-100',
  ask: 'bg-orange-50 text-orange-600 border-orange-100',
  approval: 'bg-teal-50 text-teal-600 border-teal-100',
  event: 'bg-blue-50 text-blue-600 border-blue-100',
  expense: 'bg-green-50 text-green-600 border-green-100'
}

function getIcon(type) {
  return iconMap[type] || Bell
}

function getColor(category) {
  return colorMap[category] || 'bg-slate-50 text-slate-600 border-slate-100'
}

function formatTime(timestamp) {
  // Handle both created_at (DB field) and timestamp (UI alias)
  const dateString = timestamp || new Date().toISOString()
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function getCategoryLabel(category) {
  const labels = {
    all: t('allUpdates'),
    handoff: t('handoffs'),
    task: t('tasks'),
    ask: t('asks'),
    approval: t('approvals'),
    event: t('events'),
    expense: t('expenses')
  }
  return labels[category] || category
}
</script>

<template>
  <AppLayout>
    <div class="mb-8">
      <div class="flex justify-between items-center mb-4">
        <div class="flex items-center gap-3">
          <button
            @click="goBack"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <h1 class="text-4xl font-serif text-slate-900">{{ t('updates') }}</h1>
        </div>
        <button
          v-if="updatesStore.unreadCount > 0"
          @click="updatesStore.markAllAsRead()"
          class="text-xs font-bold text-teal-600 uppercase tracking-wider hover:text-teal-700 transition-colors flex items-center gap-2"
        >
          <CheckCheck class="w-4 h-4" />
          {{ t('markAllRead') }}
        </button>
      </div>
      <p class="text-slate-400 font-bold text-sm">{{ t('stayUpdated') }}</p>
    </div>

    <!-- Category Filters -->
    <div class="flex gap-2 mb-3 overflow-x-auto pb-2">
      <button
        v-for="category in updatesStore.categories"
        :key="category"
        @click="updatesStore.setCategory(category)"
        class="filter-chip"
        :class="updatesStore.selectedCategory === category ? 'filter-chip-active' : ''"
      >
        {{ getCategoryLabel(category) }}
      </button>
    </div>

    <!-- Time Filters -->
    <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
      <button
        @click="updatesStore.setTimeFilter('all')"
        class="filter-chip filter-chip-secondary"
        :class="updatesStore.selectedTimeFilter === 'all' ? 'filter-chip-secondary-active' : ''"
      >
        {{ t('allTime') }}
      </button>
      <button
        @click="updatesStore.setTimeFilter('day')"
        class="filter-chip filter-chip-secondary"
        :class="updatesStore.selectedTimeFilter === 'day' ? 'filter-chip-secondary-active' : ''"
      >
        {{ t('lastDay') }}
      </button>
      <button
        @click="updatesStore.setTimeFilter('week')"
        class="filter-chip filter-chip-secondary"
        :class="updatesStore.selectedTimeFilter === 'week' ? 'filter-chip-secondary-active' : ''"
      >
        {{ t('lastWeek') }}
      </button>
      <button
        @click="updatesStore.setTimeFilter('unread')"
        class="filter-chip filter-chip-secondary"
        :class="updatesStore.selectedTimeFilter === 'unread' ? 'filter-chip-secondary-active' : ''"
      >
        {{ t('unread') }}
      </button>
    </div>

    <!-- Updates List -->
    <div class="updates-list">
      <div
        v-for="update in updatesStore.filteredUpdates"
        :key="update.id"
        class="update-item"
        :class="{ 'update-unread': !update.read }"
        @click="updatesStore.markAsRead(update.id)"
      >
        <div class="update-icon" :class="getColor(update.category)">
          <component :is="getIcon(update.type)" class="w-5 h-5" />
        </div>
        <div class="update-content">
          <div class="flex justify-between items-start mb-1">
            <h3 class="update-title">{{ update.title }}</h3>
            <span class="update-time">{{ formatTime(update.timestamp) }}</span>
          </div>
          <p class="update-message">{{ update.message }}</p>
        </div>
        <div v-if="!update.read" class="update-unread-dot"></div>
      </div>

      <div v-if="updatesStore.filteredUpdates.length === 0" class="empty-state">
        <Bell class="w-16 h-16 text-slate-300 mb-4" />
        <p class="text-slate-400 font-bold">{{ t('noUpdatesCategory') }}</p>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.filter-chip {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-chip:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.filter-chip-active {
  background: #0f172a;
  color: white;
  border-color: #0f172a;
}

.filter-chip-secondary {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.filter-chip-secondary:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.filter-chip-secondary-active {
  background: #0d9488;
  color: white;
  border-color: #0d9488;
}

.updates-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.update-item {
  background: white;
  border: 1px solid #f1f5f9;
  border-radius: 1.5rem;
  padding: 1.25rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.update-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.05);
  border-color: #e2e8f0;
}

.update-unread {
  background: #fef9f5;
  border-color: #fed7aa;
}

.update-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid;
}

.update-content {
  flex: 1;
}

.update-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.25rem;
}

.update-message {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
  line-height: 1.4;
}

.update-time {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
  white-space: nowrap;
}

.update-unread-dot {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}

.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
