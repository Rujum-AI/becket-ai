<script setup>
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps({
  child: {
    type: Object,
    required: true
  }
})

defineEmits(['close'])

const { t } = useI18n()

const viewMode = ref('since-last-seen') // 'since-last-seen' or 'today'

// Mock timeline data - will be replaced with real data from Supabase later
const timelineEvents = [
  {
    time: '2 hours ago',
    timestamp: '14:30',
    type: 'activity',
    title: 'Soccer Practice',
    description: 'Had a great time at soccer practice. Scored 2 goals!'
  },
  {
    time: '5 hours ago',
    timestamp: '11:45',
    type: 'meal',
    title: 'Lunch',
    description: 'Ate spaghetti with vegetables. Finished everything.'
  },
  {
    time: '7 hours ago',
    timestamp: '09:30',
    type: 'school',
    title: 'Math Class',
    description: 'Did well on the multiplication quiz - 9/10!'
  },
  {
    time: '9 hours ago',
    timestamp: '08:00',
    type: 'dropoff',
    title: 'Dropped off at School',
    description: 'Parent dropped off with backpack, lunch, and water bottle.'
  }
]

const todayEvents = timelineEvents.filter((_, index) => index < 3)

function toggleViewMode() {
  viewMode.value = viewMode.value === 'since-last-seen' ? 'today' : 'since-last-seen'
}

function getEventIcon(type) {
  const icons = {
    activity: '⚽',
    meal: '🍽️',
    school: '📚',
    dropoff: '🚗',
    pickup: '👋',
    note: '📝'
  }
  return icons[type] || '•'
}
</script>

<template>
  <BaseModal
    :headerStyle="'linear-gradient(135deg, #FEF3C7, #FDE68A)'"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <img
        :src="child.gender === 'boy' ? '/assets/brief_boy.png' : '/assets/brief_girl.png'"
        class="brief-hero-img"
        :alt="child.name"
      />
      <h2 class="modal-title">{{ child.name }}'s {{ t('recap') }}</h2>
      <p class="modal-subtitle">{{ viewMode === 'since-last-seen' ? t('sinceLastSeen') : t('todayOnly') }}</p>
    </template>
        <div class="view-toggle">
          <button @click="toggleViewMode" class="toggle-btn">
            {{ viewMode === 'since-last-seen' ? t('showTodayOnly') : t('showSinceLastSeen') }}
          </button>
        </div>

        <div class="timeline">
          <div
            v-for="(event, index) in (viewMode === 'today' ? todayEvents : timelineEvents)"
            :key="index"
            class="timeline-item"
          >
            <div class="timeline-dot">
              <span class="event-icon">{{ getEventIcon(event.type) }}</span>
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <h3 class="timeline-title">{{ event.title }}</h3>
                <span class="timeline-time">{{ event.time }}</span>
              </div>
              <p class="timeline-description">{{ event.description }}</p>
              <span class="timeline-timestamp">{{ event.timestamp }}</span>
            </div>
          </div>
        </div>

    <template #footer>
      <button class="modal-primary-btn" @click="$emit('close')">
        {{ t('close') }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.brief-hero-img {
  width: 6rem;
  height: 6rem;
  object-fit: contain;
}

.modal-subtitle {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.view-toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.toggle-btn {
  padding: 0.75rem 1.5rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 2rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.timeline {
  position: relative;
  padding-left: 3rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 1.25rem;
  top: 0;
  bottom: 3rem;
  width: 3px;
  background: linear-gradient(to bottom, #cbd5e1 0%, #cbd5e1 100%);
}

.timeline-item {
  position: relative;
  padding-left: 2.5rem;
  margin-bottom: 2rem;
}

.timeline-dot {
  position: absolute;
  left: -2.75rem;
  top: 0;
  width: 2.5rem;
  height: 2.5rem;
  background: white;
  border: 3px solid #0d9488;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.2);
  z-index: 2;
}

.event-icon {
  font-size: 1.125rem;
}

.timeline-content {
  background: #f8fafc;
  border-radius: 1rem;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
}

.timeline-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1A1C1E;
  margin: 0;
  flex: 1;
}

.timeline-time {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.timeline-description {
  font-size: 0.9375rem;
  color: #475569;
  line-height: 1.5;
  margin: 0 0 0.5rem 0;
}

.timeline-timestamp {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #94a3b8;
}
</style>
