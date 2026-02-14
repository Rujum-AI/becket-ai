<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseDashboardStore as useDashboardStore } from '@/stores/supabaseDashboard'
import { GraduationCap, Trophy, User, MapPin, Phone, Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  entity: {
    type: Object,
    required: true
  },
  type: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete'])

const { t } = useI18n()
const dashboardStore = useDashboardStore()

const iconComponent = computed(() => {
  if (props.type === 'school') return GraduationCap
  if (props.type === 'activity') return Trophy
  return User
})

const iconClass = computed(() => {
  if (props.type === 'school') return 'bg-school'
  if (props.type === 'activity') return 'bg-activity'
  return 'bg-trustee'
})

function getChildImg(childId) {
  const child = dashboardStore.children.find(c => c.id === childId)
  if (!child) return '/assets/thumbnail_boy.png'
  return child.gender === 'boy'
    ? '/assets/thumbnail_boy.png'
    : '/assets/thumbnail_girl.png'
}

function formatScheduleSummary(schedule) {
  if (!schedule || !schedule.days) return ''

  const weekDaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const parts = []

  schedule.days.forEach((day, idx) => {
    if (day.active && day.start) {
      parts.push(`<strong>${weekDaysShort[idx]}</strong> ${day.start}-${day.end}`)
    }
  })

  if (parts.length === 0) return '<span style="color: #cbd5e1;">No schedule</span>'
  if (parts.length > 2) return `${parts.length} days active`
  return parts.join(', ')
}
</script>

<template>
  <div class="entity-card">
    <div class="card-header-flex">
      <div class="card-icon-box" :class="iconClass">
        <component :is="iconComponent" class="w-6 h-6" />
      </div>

      <div class="card-main-content">
        <div class="card-title">{{ entity.name }}</div>

        <!-- For trustees (people), show relationship -->
        <span v-if="type === 'person'" class="text-xs font-bold text-slate-400 uppercase tracking-wide">
          {{ t(entity.relationship) }}
        </span>

        <!-- For schools/activities, show children with schedule -->
        <template v-else>
          <div v-for="childId in entity.children" :key="childId" class="child-row">
            <img :src="getChildImg(childId)" class="child-tiny-avatar" />
            <span class="schedule-summary" v-html="formatScheduleSummary(entity.schedule)"></span>
          </div>

          <div v-if="entity.items && entity.items.length" class="items-flex">
            <div v-for="item in entity.items" :key="item" class="item-pill">{{ item }}</div>
          </div>
        </template>
      </div>

      <div class="card-actions">
        <div class="action-dot" @click.stop="$emit('edit', entity)">
          <Pencil class="w-4 h-4" />
        </div>
        <div class="action-dot danger" @click.stop="$emit('delete', entity)">
          <Trash2 class="w-4 h-4" />
        </div>
      </div>
    </div>

    <div class="meta-row">
      <div class="meta-item">
        <MapPin class="w-3 h-3" />
        {{ entity.address }}
      </div>
      <div class="meta-item">
        <Phone class="w-3 h-3" />
        <span class="bidi-isolate">{{ entity.contact }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.entity-card {
  background: white;
  border-radius: 1.5rem;
  border: 1px solid #f1f5f9;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  position: relative;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px -2px rgba(0,0,0,0.02);
}

.entity-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -5px rgba(0,0,0,0.05);
  border-color: #cbd5e1;
}

.card-header-flex {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.card-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(0,0,0,0.05);
}

.bg-school {
  background: #f0fdfa;
  color: #0d9488;
}

.bg-activity {
  background: #fff1f2;
  color: #be123c;
}

.bg-trustee {
  background: #fff7ed;
  color: #c2410c;
}

.card-main-content {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-family: 'Fraunces', serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
  margin-bottom: 0.2rem;
}

.child-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.child-tiny-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #cbd5e1;
}

.schedule-summary {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
}

.schedule-summary :deep(strong) {
  color: #334155;
  font-weight: 800;
}

.items-flex {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.item-pill {
  font-size: 0.65rem;
  font-weight: 700;
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 2px 8px;
  border-radius: 6px;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-inline-start: auto;
}

.action-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #cbd5e1;
  transition: all 0.2s;
}

.action-dot:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.action-dot.danger:hover {
  background: #fef2f2;
  color: #ef4444;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
  padding-top: 0.8rem;
  border-top: 1px dashed #f1f5f9;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
}
</style>
