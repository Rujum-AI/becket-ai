<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useFooterMenu } from '@/composables/useFooterMenu'
import { useFamily } from '@/composables/useFamily'

const { t } = useI18n()
const { isWheelOpen } = useFooterMenu()
const { family } = useFamily()

const allLinks = [
  { key: 'expenses', icon: 'finance.png', url: '/finance', pref: 'finance' },
  { key: 'trustees', icon: 'trustees.png', url: '/trustees', pref: null },
  { key: 'family', icon: 'family.png', url: '/family', pref: null },
  { key: 'schedule', icon: 'management.png', url: '/management', pref: 'management' },
  { key: 'agreements', icon: 'understandings.png', url: '/understandings', pref: 'understandings' }
]

const menuLinks = computed(() => {
  const prefs = family.value?.dashboard_prefs
    || { finance: true, management: true, understandings: true }
  return allLinks.filter(l => !l.pref || prefs[l.pref])
})

function toggleWheel() {
  isWheelOpen.value = !isWheelOpen.value
}
</script>

<template>
  <footer class="app-footer" :class="[{'menu-open': isWheelOpen}, `items-${menuLinks.length}`]">
    <div class="wheel-anchor">
      <div class="wheel-btn" :class="{'is-spinning': isWheelOpen}" @click="toggleWheel">
        <img src="/assets/wheel.png" alt="Menu Wheel">
      </div>

      <RouterLink
        v-for="(link, index) in menuLinks"
        :key="link.key"
        :to="link.url"
        class="satellite-item"
        :class="'sat-' + (index + 1)"
        @click="isWheelOpen = false">
        <div class="sat-btn-circle">
          <img :src="`/assets/${link.icon}`">
        </div>
        <span class="sat-label">{{ t(link.key) }}</span>
      </RouterLink>

      <div class="wheel-instruction" :class="{'visible': isWheelOpen}">
        {{ t('tapToClose') }}
      </div>
    </div>
  </footer>
</template>
