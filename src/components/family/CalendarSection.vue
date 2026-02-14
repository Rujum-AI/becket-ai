<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore } from '@/stores/supabaseDashboard'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const { t } = useI18n()
const dashboardStore = useSupabaseDashboardStore()

const viewMode = ref('week') // 'month', 'week', 'day'
const currentDate = ref(new Date())

// Get custody schedule and events from store
const custodySchedule = computed(() => dashboardStore.custodySchedule)
const storeEvents = computed(() => dashboardStore.events)

function getEventsForDate(date) {
  const key = formatDateKey(date)
  return storeEvents.value
    .filter(event => {
      const eventDate = new Date(event.start_time)
      return formatDateKey(eventDate) === key
    })
    .map(event => {
      const eventDate = new Date(event.start_time)
      return {
        time: eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        title: event.title || event.type,
        location: event.location || 'Unknown'
      }
    })
}

const currentDayEvents = computed(() => {
  return getEventsForDate(currentDate.value)
})

function getCustodyForDate(date) {
  const key = date.toISOString().split('T')[0]
  return custodySchedule.value[key] || 'mom'
}

function formatDateKey(date) {
  return date.toISOString().split('T')[0]
}

function isSameDay(date1, date2) {
  return formatDateKey(date1) === formatDateKey(date2)
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
  const options = { month: 'long', year: 'numeric' }

  if (viewMode.value === 'month') {
    return date.toLocaleDateString('en-US', options)
  } else if (viewMode.value === 'week') {
    const weekStart = getWeekStart(date)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${startStr} - ${endStr}`
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
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

function goToDay(date) {
  currentDate.value = new Date(date)
  viewMode.value = 'day'
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

    <!-- Navigation Header -->
    <div class="calendar-header">
      <button @click="navigatePrev" class="nav-btn">
        <ChevronLeft :size="24" />
      </button>
      <h3 class="calendar-title">{{ currentTitle }}</h3>
      <button @click="navigateNext" class="nav-btn">
        <ChevronRight :size="24" />
      </button>
    </div>

    <!-- Month View -->
    <div v-if="viewMode === 'month'" class="month-view">
      <div class="weekday-header">
        <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day" class="weekday-label">
          {{ t(day) }}
        </div>
      </div>
      <div class="month-grid">
        <div
          v-for="(item, index) in monthDays"
          :key="index"
          :class="[
            'month-day',
            getCustodyForDate(item.date),
            { 'other-month': !item.isCurrentMonth },
            { 'today': isSameDay(item.date, new Date()) }
          ]"
          @click="goToDay(item.date)"
        >
          <div class="day-number">{{ item.date.getDate() }}</div>
          <div v-if="getEventsForDate(item.date).length > 0" class="month-events">
            <div
              v-for="(event, idx) in getEventsForDate(item.date).slice(0, 3)"
              :key="idx"
              class="month-event-item"
            >
              {{ t(event.title) }}
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
      <div class="week-grid">
        <div
          v-for="date in weekDays"
          :key="formatDateKey(date)"
          :class="['week-day', { 'today': isSameDay(date, new Date()) }]"
        >
          <div :class="['week-day-header', getCustodyForDate(date)]">
            <div class="week-day-name">{{ date.toLocaleDateString('en-US', { weekday: 'short' }) }}</div>
            <div class="week-day-number">{{ date.getDate() }}</div>
          </div>
          <div class="week-events">
            <div
              v-for="(event, idx) in getEventsForDate(date)"
              :key="idx"
              class="week-event-item"
            >
              <span class="week-event-time">{{ event.time }}</span>
              <span class="week-event-title">{{ t(event.title) }}</span>
            </div>
            <div v-if="getEventsForDate(date).length === 0" class="week-no-events">
              No events
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
        >
          <div class="event-time">{{ event.time }}</div>
          <div class="event-content">
            <div class="event-title">{{ t(event.title) }}</div>
            <div class="event-location">{{ t(event.location) }}</div>
          </div>
        </div>
        <div v-if="currentDayEvents.length === 0" class="no-events">
          <p class="text-slate-400 text-center">No events scheduled</p>
        </div>
      </div>
    </div>
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

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.calendar-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1A1C1E;
  text-transform: uppercase;
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

/* Month View */
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
}

.more-events {
  font-size: 0.625rem;
  font-weight: 700;
  color: #64748b;
  text-align: center;
  margin-top: 2px;
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
  cursor: pointer;
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
}

.week-event-time {
  font-size: 0.75rem;
  font-weight: 900;
  color: #1A1C1E;
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
  transform: translateX(4px);
}

.event-time {
  font-size: 1.125rem;
  font-weight: 900;
  color: #1A1C1E;
  min-width: 4rem;
}

.event-content {
  flex: 1;
}

.event-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1A1C1E;
  margin-bottom: 0.25rem;
}

.event-location {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@media (max-width: 640px) {
  .calendar-container {
    padding: 1.5rem;
  }

  .week-grid {
    grid-template-columns: repeat(7, 1fr);
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

  .week-custody-bar {
    padding: 1rem 0.5rem;
    min-height: 60px;
  }

  .custody-label {
    font-size: 0.625rem;
  }

  .month-day {
    padding: 0.5rem;
  }

  .day-number {
    font-size: 0.875rem;
  }
}
</style>
