<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useLanguageStore } from '@/stores/language'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { ChevronLeft, ChevronRight, Plus, ArrowLeftRight } from 'lucide-vue-next'
import EventDetailModal from '@/components/family/EventDetailModal.vue'
import DayActionMenu from '@/components/family/DayActionMenu.vue'
import ChangeCustodyModal from '@/components/family/ChangeCustodyModal.vue'
import CreateItemModal from '@/components/management/CreateItemModal.vue'

const { t } = useI18n()
const langStore = useLanguageStore()
const dashboardStore = useSupabaseDashboardStore()

const emit = defineEmits(['addEvent', 'editEvent', 'deleteEvent', 'deleteAllSimilarEvents'])

const viewMode = ref('month') // 'month', 'week', 'day'
const currentDate = ref(new Date())
const selectedEvent = ref(null)
const showDayMenu = ref(false)
const dayMenuDate = ref(null)
const dayMenuPosition = ref({ x: 0, y: 0 })
const showChangeCustodyModal = ref(false)
const changeCustodyInitialDate = ref(null)
const showSwitchDaysModal = ref(false)
const switchDaysInitialDate = ref('')

// Mobile detection for responsive calendar
const isMobile = ref(false)
function checkMobile() { isMobile.value = window.innerWidth <= 640 }
onMounted(() => { checkMobile(); window.addEventListener('resize', checkMobile) })
onUnmounted(() => window.removeEventListener('resize', checkMobile))

// Selected day for mobile month view (tap to see events below grid)
const selectedDay = ref(null)
const selectedDayEvents = computed(() => {
  if (!selectedDay.value) return []
  return getEventsForDate(selectedDay.value)
})

// Get custody schedule and events from store
const custodySchedule = computed(() => dashboardStore.custodySchedule)
const storeEvents = computed(() => dashboardStore.events)

// Reactive locale — reads through Pinia reactive proxy so computed tracks changes
const locale = computed(() => langStore.lang === 'he' ? 'he-IL' : 'en-US')
const isRTL = computed(() => langStore.lang === 'he')

// Day name keys in Sun(0)..Sat(6) order
const dayKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Use local date components (NOT toISOString which converts to UTC)
function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTime(date) {
  return date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit', hour12: false })
}

function getEventsForDate(date) {
  const key = formatDateKey(date)
  return storeEvents.value
    .filter(event => {
      const eventDate = new Date(event.start_time)
      return formatDateKey(eventDate) === key
    })
    .map(event => {
      const startDate = new Date(event.start_time)
      const endDate = event.end_time ? new Date(event.end_time) : null
      return {
        ...event,
        startFormatted: formatTime(startDate),
        endFormatted: endDate ? formatTime(endDate) : null,
        timeRange: endDate ? `${formatTime(startDate)} - ${formatTime(endDate)}` : formatTime(startDate),
        displayTitle: event.title || event.type
      }
    })
}

const currentDayEvents = computed(() => {
  return getEventsForDate(currentDate.value)
})

function getCustodyForDate(date) {
  const key = formatDateKey(date)
  return custodySchedule.value[key] || 'mom'
}

function isSameDay(date1, date2) {
  return formatDateKey(date1) === formatDateKey(date2)
}

// In RTL: left arrow = next (forward), right arrow = prev (backward)
function onLeftArrow() {
  isRTL.value ? navigateNext() : navigatePrev()
}

function onRightArrow() {
  isRTL.value ? navigatePrev() : navigateNext()
}

function navigatePrev() {
  const newDate = new Date(currentDate.value)
  if (viewMode.value === 'month') {
    newDate.setMonth(newDate.getMonth() - 1)
  } else if (viewMode.value === 'week') {
    newDate.setDate(newDate.getDate() - (isMobile.value ? 3 : 7))
  } else {
    newDate.setDate(newDate.getDate() - 1)
  }
  currentDate.value = newDate
}

function navigateNext() {
  const newDate = new Date(currentDate.value)
  if (viewMode.value === 'month') {
    newDate.setMonth(newDate.getMonth() + 1)
  } else if (viewMode.value === 'week') {
    newDate.setDate(newDate.getDate() + (isMobile.value ? 3 : 7))
  } else {
    newDate.setDate(newDate.getDate() + 1)
  }
  currentDate.value = newDate
}

const currentTitle = computed(() => {
  const date = currentDate.value
  const loc = locale.value

  if (viewMode.value === 'month') {
    return date.toLocaleDateString(loc, { month: 'long', year: 'numeric' })
  } else if (viewMode.value === 'week') {
    if (isMobile.value) {
      const end = new Date(date)
      end.setDate(end.getDate() + 2)
      const startStr = date.toLocaleDateString(loc, { month: 'short', day: 'numeric' })
      const endStr = end.toLocaleDateString(loc, { month: 'short', day: 'numeric' })
      return `${startStr} - ${endStr}`
    }
    const weekStart = getWeekStart(date)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const startStr = weekStart.toLocaleDateString(loc, { month: 'short', day: 'numeric' })
    const endStr = weekEnd.toLocaleDateString(loc, { month: 'short', day: 'numeric' })
    return `${startStr} - ${endStr}`
  } else {
    return date.toLocaleDateString(loc, { weekday: 'long', month: 'long', day: 'numeric' })
  }
})

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  return new Date(d.setDate(diff))
}

const weekDays = computed(() => {
  const start = getWeekStart(currentDate.value)
  const days = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    days.push(date)
  }

  return days
})

// Mobile: show 3 days starting from currentDate (Google Calendar style)
const visibleWeekDays = computed(() => {
  if (isMobile.value) {
    const start = new Date(currentDate.value)
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }
  return weekDays.value
})

const monthDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = firstDay.getDay()

  const days = []

  // Previous month days
  for (let i = 0; i < startDay; i++) {
    const date = new Date(firstDay)
    date.setDate(date.getDate() - (startDay - i))
    days.push({ date, isCurrentMonth: false })
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true })
  }

  // Next month days to complete grid
  const remainingDays = 35 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i)
    days.push({ date, isCurrentMonth: false })
  }

  return days
})

function getDayLabel(date) {
  return t(dayKeys[date.getDay()])
}

function onDayClick(date, event) {
  selectedDay.value = date
  if (isMobile.value) return // Mobile: just select day, no overlay menu
  dayMenuDate.value = date
  const cell = event.currentTarget
  const rect = cell.getBoundingClientRect()
  dayMenuPosition.value = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  }
  showDayMenu.value = true
}

function handleViewDay() {
  currentDate.value = new Date(dayMenuDate.value)
  viewMode.value = 'day'
  showDayMenu.value = false
}

function handleAddEvent() {
  showDayMenu.value = false
  emit('addEvent', dayMenuDate.value)
}

function handleChangeCustody() {
  changeCustodyInitialDate.value = formatDateKey(dayMenuDate.value)
  showDayMenu.value = false
  showChangeCustodyModal.value = true
}

function handleSwitchDays() {
  switchDaysInitialDate.value = formatDateKey(dayMenuDate.value)
  showDayMenu.value = false
  showSwitchDaysModal.value = true
}

function hasPendingOverride(date) {
  const key = formatDateKey(date)
  return !!dashboardStore.getPendingOverrideForDate(key)
}

// Get the pending override for the day menu's date
const dayMenuPendingOverride = computed(() => {
  if (!dayMenuDate.value) return null
  const key = formatDateKey(dayMenuDate.value)
  return dashboardStore.getPendingOverrideForDate(key)
})

async function handleApproveOverride() {
  const override = dayMenuPendingOverride.value
  if (!override) return
  showDayMenu.value = false
  await dashboardStore.respondToCustodyOverride(override.id, 'approve')
}

async function handleRejectOverride() {
  const override = dayMenuPendingOverride.value
  if (!override) return
  showDayMenu.value = false
  await dashboardStore.respondToCustodyOverride(override.id, 'reject')
}

function openEvent(event) {
  selectedEvent.value = event
}

function handleEditEvent(event) {
  selectedEvent.value = null
  emit('editEvent', event)
}

function handleDeleteEvent(event) {
  selectedEvent.value = null
  emit('deleteEvent', event)
}

function handleDeleteAllSimilar(event) {
  selectedEvent.value = null
  emit('deleteAllSimilarEvents', event)
}
</script>

<template>
  <div class="calendar-container">
    <!-- View Mode Toggles -->
    <div class="view-toggles">
      <button
        @click="viewMode = 'month'"
        :class="['view-toggle-btn', { active: viewMode === 'month' }]"
      >
        {{ t('month') }}
      </button>
      <button
        @click="viewMode = 'week'"
        :class="['view-toggle-btn', { active: viewMode === 'week' }]"
      >
        {{ t('week') }}
      </button>
      <button
        @click="viewMode = 'day'"
        :class="['view-toggle-btn', { active: viewMode === 'day' }]"
      >
        {{ t('day') }}
      </button>
    </div>

    <!-- Navigation Header — always LTR layout, arrows swap function in RTL -->
    <div class="calendar-header">
      <button @click="onLeftArrow" class="nav-btn">
        <ChevronLeft :size="24" />
      </button>
      <h3 class="calendar-title" :style="{ direction: isRTL ? 'rtl' : 'ltr' }">{{ currentTitle }}</h3>
      <button @click="onRightArrow" class="nav-btn">
        <ChevronRight :size="24" />
      </button>
    </div>

    <!-- Month View -->
    <div v-if="viewMode === 'month'" class="month-view">
      <div class="weekday-header" :style="{ direction: isRTL ? 'rtl' : 'ltr' }">
        <div v-for="day in dayKeys" :key="day" class="weekday-label">
          <span class="day-label-full">{{ t(day) }}</span>
          <span class="day-label-short">{{ t(day).charAt(0) }}</span>
        </div>
      </div>
      <div class="month-grid" :style="{ direction: isRTL ? 'rtl' : 'ltr' }">
        <div
          v-for="(item, index) in monthDays"
          :key="index"
          :class="[
            'month-day',
            getCustodyForDate(item.date),
            { 'other-month': !item.isCurrentMonth },
            { 'today': isSameDay(item.date, new Date()) },
            { 'pending-override': hasPendingOverride(item.date) },
            { 'selected': selectedDay && isSameDay(item.date, selectedDay) }
          ]"
          @click="onDayClick(item.date, $event)"
        >
          <div class="day-number">{{ item.date.getDate() }}</div>
          <!-- Desktop: event text labels -->
          <div v-if="getEventsForDate(item.date).length > 0" class="month-events">
            <div
              v-for="(event, idx) in getEventsForDate(item.date).slice(0, 3)"
              :key="idx"
              class="month-event-item"
              @click.stop="openEvent(event)"
            >
              {{ t(event.displayTitle) }}
            </div>
            <div v-if="getEventsForDate(item.date).length > 3" class="more-events">
              +{{ getEventsForDate(item.date).length - 3 }}
            </div>
          </div>
          <!-- Mobile: colored dots -->
          <div v-if="getEventsForDate(item.date).length > 0" class="month-event-dots">
            <span v-for="n in Math.min(getEventsForDate(item.date).length, 3)" :key="n" class="event-dot"></span>
          </div>
        </div>
      </div>

      <!-- Mobile: selected day event list below grid -->
      <div v-if="selectedDay" class="selected-day-events">
        <div class="selected-day-header" :style="{ direction: isRTL ? 'rtl' : 'ltr' }">
          {{ selectedDay.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }) }}
        </div>
        <div v-if="selectedDayEvents.length > 0" class="selected-day-list">
          <div
            v-for="(event, idx) in selectedDayEvents"
            :key="idx"
            class="selected-day-event"
            @click="openEvent(event)"
          >
            <div class="selected-event-dot"></div>
            <div class="selected-event-time">{{ event.timeRange }}</div>
            <div class="selected-event-title">{{ t(event.displayTitle) }}</div>
          </div>
        </div>
        <div v-else class="selected-day-empty">{{ t('noEvents') }}</div>
        <div class="selected-day-actions">
          <button class="selected-day-action-btn" @click="emit('addEvent', selectedDay)">
            <Plus :size="16" />
            {{ t('addEvent') }}
          </button>
          <button class="selected-day-action-btn" @click="switchDaysInitialDate = formatDateKey(selectedDay); showSwitchDaysModal = true">
            <ArrowLeftRight :size="16" />
            {{ t('switchDays') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Week View -->
    <div v-if="viewMode === 'week'" class="week-view">
      <div class="week-grid" :style="{ direction: isRTL ? 'rtl' : 'ltr' }">
        <div
          v-for="date in visibleWeekDays"
          :key="formatDateKey(date)"
          :class="['week-day', { 'today': isSameDay(date, new Date()) }]"
        >
          <div :class="['week-day-header', getCustodyForDate(date), { 'pending-override': hasPendingOverride(date) }]">
            <div class="week-day-name">{{ getDayLabel(date) }}</div>
            <div class="week-day-number">{{ date.getDate() }}</div>
          </div>
          <div class="week-events">
            <div
              v-for="(event, idx) in getEventsForDate(date)"
              :key="idx"
              class="week-event-item"
              @click="openEvent(event)"
            >
              <span class="week-event-time">{{ event.timeRange }}</span>
              <span class="week-event-title">{{ t(event.displayTitle) }}</span>
            </div>
            <div v-if="getEventsForDate(date).length === 0" class="week-no-events">
              {{ t('noEvents') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Day View -->
    <div v-if="viewMode === 'day'" class="day-view">
      <div :class="['day-custody-banner', getCustodyForDate(currentDate)]">
        <div class="custody-emoji">{{ getCustodyForDate(currentDate) === 'dad' ? '👨' : '👩' }}</div>
        <div class="custody-text">
          {{ getCustodyForDate(currentDate) === 'dad' ? t('dadHome') : t('momHome') }}
        </div>
      </div>

      <div class="day-events">
        <div
          v-for="(event, idx) in currentDayEvents"
          :key="idx"
          class="event-item"
          @click="openEvent(event)"
        >
          <div class="event-time-block">
            <div class="event-time-start">{{ event.startFormatted }}</div>
            <div v-if="event.endFormatted" class="event-time-end">{{ event.endFormatted }}</div>
          </div>
          <div class="event-content">
            <div class="event-title">{{ t(event.displayTitle) }}</div>
            <div v-if="event.type" class="event-type-badge">{{ t(event.type) }}</div>
          </div>
        </div>
        <div v-if="currentDayEvents.length === 0" class="no-events">
          <p>{{ t('noEvents') }}</p>
        </div>
      </div>
    </div>

    <!-- Day Action Menu -->
    <DayActionMenu
      v-if="showDayMenu"
      :date="dayMenuDate"
      :position="dayMenuPosition"
      :pendingOverride="dayMenuPendingOverride"
      @close="showDayMenu = false"
      @viewDay="handleViewDay"
      @addEvent="handleAddEvent"
      @changeCustody="handleChangeCustody"
      @switchDays="handleSwitchDays"
      @approveOverride="handleApproveOverride"
      @rejectOverride="handleRejectOverride"
    />

    <!-- Change Custody Modal -->
    <ChangeCustodyModal
      v-if="showChangeCustodyModal"
      :initialDate="changeCustodyInitialDate"
      @close="showChangeCustodyModal = false"
    />

    <!-- Switch Days Modal (opens CreateItemModal in switch mode) -->
    <CreateItemModal
      v-if="showSwitchDaysModal"
      initialType="switch"
      :prefilledDate="switchDaysInitialDate"
      @close="showSwitchDaysModal = false"
    />

    <!-- Event Detail Modal -->
    <EventDetailModal
      v-if="selectedEvent"
      :event="selectedEvent"
      @close="selectedEvent = null"
      @edit="handleEditEvent"
      @delete="handleDeleteEvent"
      @delete-all-similar="handleDeleteAllSimilar"
    />
  </div>
</template>

<style scoped>
.calendar-container {
  background: white;
  border-radius: 2rem;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.view-toggles {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  justify-content: center;
}

.view-toggle-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 1.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #f8fafc;
  color: #64748b;
  border: 2px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.view-toggle-btn.active {
  background: #1A1C1E;
  color: white;
  border-color: #1A1C1E;
}

/* Navigation header — force LTR so arrows stay positioned, functions swap in RTL */
.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  direction: ltr;
}

.calendar-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1A1C1E;
  letter-spacing: -0.5px;
}

.nav-btn {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #1A1C1E;
}

.nav-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: scale(1.05);
}

/* Grids: direction set via inline style binding */
.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.weekday-label {
  text-align: center;
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0.5rem;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.month-day {
  aspect-ratio: 1;
  padding: 0.5rem;
  border-radius: 1rem;
  border: 2px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.month-day:hover {
  border-color: #cbd5e1;
  transform: scale(1.05);
}

.month-day.other-month {
  opacity: 0.3;
}

.month-day.today {
  border-color: #1A1C1E;
  border-width: 3px;
}

.month-day.dad {
  background: linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%);
}

.month-day.mom {
  background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%);
}

.day-number {
  font-size: 1rem;
  font-weight: 700;
  color: #1A1C1E;
  margin-bottom: 4px;
}

.month-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  overflow: hidden;
}

.month-event-item {
  font-size: 0.625rem;
  font-weight: 600;
  color: #1A1C1E;
  background: rgba(255, 255, 255, 0.6);
  padding: 2px 4px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  cursor: pointer;
}

.month-event-item:hover {
  background: rgba(255, 255, 255, 0.9);
}

.more-events {
  font-size: 0.625rem;
  font-weight: 700;
  color: #64748b;
  text-align: center;
  margin-top: 2px;
}

/* Pending override indicator — amber dashed border */
.month-day.pending-override {
  border-color: #fbbf24;
  border-style: dashed;
}

.week-day-header.pending-override {
  position: relative;
}

.week-day-header.pending-override::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fbbf24;
}

/* Week View */
.week-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.75rem;
}

.week-day {
  border-radius: 1.5rem;
  border: 2px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.2s;
  background: white;
}

.week-day:hover {
  border-color: #cbd5e1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.week-day.today {
  border-color: #1A1C1E;
  border-width: 3px;
}

.week-day-header {
  padding: 1rem;
  text-align: center;
  border-bottom: 2px solid #e2e8f0;
}

.week-day-header.dad {
  background: linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%);
}

.week-day-header.mom {
  background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%);
}

.week-day-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1A1C1E;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
}

.week-day-number {
  font-size: 1.5rem;
  font-weight: 900;
  color: #1A1C1E;
}

.week-events {
  padding: 1rem;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.week-event-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.15s;
}

.week-event-item:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.week-event-time {
  font-size: 0.75rem;
  font-weight: 900;
  color: #1A1C1E;
  direction: ltr;
  unicode-bidi: isolate;
}

.week-event-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #64748b;
}

.week-no-events {
  font-size: 0.75rem;
  color: #cbd5e1;
  text-align: center;
  padding: 1rem;
  font-weight: 600;
}

/* Day View */
.day-custody-banner {
  padding: 2rem;
  border-radius: 1.5rem;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.day-custody-banner.dad {
  background: linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%);
}

.day-custody-banner.mom {
  background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%);
}

.custody-emoji {
  font-size: 3rem;
}

.custody-text {
  font-size: 1.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.5px;
  color: #1A1C1E;
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.event-item {
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 1.5rem;
  border: 2px solid #e2e8f0;
  transition: all 0.2s;
  cursor: pointer;
}

.event-item:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.event-time-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 4rem;
  direction: ltr;
  unicode-bidi: isolate;
}

.event-time-start {
  font-size: 1.125rem;
  font-weight: 900;
  color: #1A1C1E;
}

.event-time-end {
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
}

.event-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.event-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1A1C1E;
}

.event-type-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.no-events {
  text-align: center;
  padding: 3rem 1rem;
  color: #cbd5e1;
  font-weight: 700;
  font-style: italic;
}

/* Desktop defaults for mobile-only elements */
.day-label-full { display: inline; }
.day-label-short { display: none; }
.month-event-dots { display: none; }
.selected-day-events { display: none; }

.event-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #1A1C1E;
}

/* Selected day event list styles */
.selected-day-header {
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  padding: 0.5rem 0.25rem;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 0.5rem;
}

.selected-day-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.selected-day-event {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.5rem;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}

.selected-day-event:active {
  background: #f1f5f9;
}

.selected-event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1A1C1E;
  flex-shrink: 0;
}

.selected-event-time {
  font-size: 0.8rem;
  font-weight: 800;
  color: #1A1C1E;
  min-width: 5rem;
  direction: ltr;
  unicode-bidi: isolate;
}

.selected-event-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
}

.selected-day-empty {
  font-size: 0.8rem;
  color: #cbd5e1;
  font-weight: 600;
  padding: 0.75rem 0.5rem;
  font-style: italic;
}

.selected-day-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f1f5f9;
}

.selected-day-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  border-radius: 9999px;
  border: 2px solid;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 2.5rem;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  overflow: hidden;
}

.selected-day-action-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.12) 2px,
    rgba(255, 255, 255, 0.12) 4px
  );
  pointer-events: none;
}

.selected-day-action-btn:active {
  transform: scale(0.97);
}

/* Add Event — blue (matches AddEventFlow header #60A5FA) */
.selected-day-action-btn:first-child {
  background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);
  border-color: #2563EB;
  color: white;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* Switch Days — amber (matches CreateItemModal switch header #F59E0B) */
.selected-day-action-btn:last-child {
  background: linear-gradient(135deg, #D97706 0%, #F59E0B 100%);
  border-color: #B45309;
  color: white;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* ─── Mobile ─── */
@media (max-width: 640px) {
  /* Container */
  .calendar-container {
    padding: 1rem;
    border-radius: 1.5rem;
  }

  /* View toggles — compact segmented pill */
  .view-toggles {
    gap: 0;
    background: #f1f5f9;
    border-radius: 0.75rem;
    padding: 3px;
    margin-bottom: 1rem;
  }

  .view-toggle-btn {
    padding: 0.4rem 0;
    font-size: 0.7rem;
    border: none;
    border-radius: 0.625rem;
    flex: 1;
    letter-spacing: 0;
  }

  .view-toggle-btn.active {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  /* Navigation header */
  .calendar-header {
    margin-bottom: 1rem;
  }

  .calendar-title {
    font-size: 1.1rem;
  }

  .nav-btn {
    width: 2rem;
    height: 2rem;
  }

  .nav-btn svg {
    width: 18px;
    height: 18px;
  }

  /* ─── Month View ─── */

  /* Single-letter day labels */
  .weekday-header {
    gap: 2px;
    margin-bottom: 0.25rem;
  }

  .weekday-label {
    font-size: 0.7rem;
    padding: 0.25rem;
    letter-spacing: 0;
  }

  .day-label-full { display: none; }
  .day-label-short { display: inline; }

  /* Compact month grid — no aspect-ratio, tight cells */
  .month-grid {
    gap: 2px;
  }

  .month-day {
    aspect-ratio: unset;
    min-height: 2.75rem;
    padding: 0.25rem;
    border-radius: 0.5rem;
    border-width: 1.5px;
    justify-content: center;
  }

  .month-day:hover {
    transform: none;
  }

  .month-day.selected {
    border-color: #1A1C1E;
    border-width: 2.5px;
  }

  .day-number {
    font-size: 0.8rem;
    margin-bottom: 2px;
  }

  /* Hide event text, show dots */
  .month-events {
    display: none;
  }

  .month-event-dots {
    display: flex;
    gap: 2px;
    justify-content: center;
  }

  /* Selected day event list */
  .selected-day-events {
    display: block;
    margin-top: 0.75rem;
    border-top: 1px solid #e2e8f0;
    padding-top: 0.5rem;
  }

  /* ─── Week View (3-day) ─── */
  .week-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .week-day {
    border-radius: 1rem;
  }

  .week-day-header {
    padding: 0.5rem;
  }

  .week-day-name {
    font-size: 0.75rem;
    margin-bottom: 0.125rem;
  }

  .week-day-number {
    font-size: 1.125rem;
  }

  .week-events {
    padding: 0.5rem;
    min-height: 80px;
    gap: 0.375rem;
  }

  .week-event-item {
    padding: 0.375rem;
  }

  .week-event-time {
    font-size: 0.7rem;
  }

  .week-event-title {
    font-size: 0.65rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .week-no-events {
    display: none;
  }

  /* ─── Day View ─── */
  .day-custody-banner {
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    margin-bottom: 1rem;
    gap: 0.5rem;
  }

  .custody-emoji {
    font-size: 1.5rem;
  }

  .custody-text {
    font-size: 1rem;
    letter-spacing: 0;
  }

  .day-events {
    gap: 0.75rem;
  }

  .event-item {
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 1rem;
    border-width: 1.5px;
  }

  .event-time-block {
    min-width: 3rem;
  }

  .event-time-start {
    font-size: 0.95rem;
  }

  .event-time-end {
    font-size: 0.75rem;
  }

  .event-title {
    font-size: 0.95rem;
  }

  .no-events {
    padding: 2rem 1rem;
  }
}
</style>
