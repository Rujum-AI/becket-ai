<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useLanguageStore } from '@/stores/language'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import EventDetailModal from '@/components/family/EventDetailModal.vue'
import DayActionMenu from '@/components/family/DayActionMenu.vue'
import ChangeCustodyModal from '@/components/family/ChangeCustodyModal.vue'

const { t } = useI18n()
const langStore = useLanguageStore()
const dashboardStore = useSupabaseDashboardStore()

const emit = defineEmits(['addEvent'])

const viewMode = ref('month') // 'month', 'week', 'day'
const currentDate = ref(new Date())
const selectedEvent = ref(null)
const showDayMenu = ref(false)
const dayMenuDate = ref(null)
const dayMenuPosition = ref({ x: 0, y: 0 })
const showChangeCustodyModal = ref(false)
const changeCustodyInitialDate = ref(null)

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
    newDate.setDate(newDate.getDate() - 7)
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
    newDate.setDate(newDate.getDate() + 7)
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
  dayMenuDate.value = date
  dayMenuPosition.value = { x: event.clientX, y: event.clientY }
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
          {{ t(day) }}
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
            { 'pending-override': hasPendingOverride(item.date) }
          ]"
          @click="onDayClick(item.date, $event)"
        >
          <div class="day-number">{{ item.date.getDate() }}</div>
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
        </div>
      </div>
    </div>

    <!-- Week View -->
    <div v-if="viewMode === 'week'" class="week-view">
      <div class="week-grid" :style="{ direction: isRTL ? 'rtl' : 'ltr' }">
        <div
          v-for="date in weekDays"
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
      @approveOverride="handleApproveOverride"
      @rejectOverride="handleRejectOverride"
    />

    <!-- Change Custody Modal -->
    <ChangeCustodyModal
      v-if="showChangeCustodyModal"
      :initialDate="changeCustodyInitialDate"
      @close="showChangeCustodyModal = false"
    />

    <!-- Event Detail Modal -->
    <EventDetailModal
      v-if="selectedEvent"
      :event="selectedEvent"
      @close="selectedEvent = null"
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

@media (max-width: 640px) {
  .calendar-container {
    padding: 1.5rem;
  }

  .week-grid {
    gap: 0.25rem;
  }

  .week-day-header {
    padding: 0.5rem;
  }

  .week-day-name {
    font-size: 0.625rem;
  }

  .week-day-number {
    font-size: 1rem;
  }

  .month-day {
    padding: 0.5rem;
  }

  .day-number {
    font-size: 0.875rem;
  }
}
</style>
