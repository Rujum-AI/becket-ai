<script setup>
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()
const isWheelOpen = ref(false)

const menuLinks = [
  { key: 'expenses', icon: 'finance.png', url: '/finance' },
  { key: 'trustees', icon: 'trustees.png', url: '/trustees' },
  { key: 'family', icon: 'family.png', url: '/family' },
  { key: 'schedule', icon: 'management.png', url: '/management' },
  { key: 'agreements', icon: 'understandings.png', url: '/understandings' }
]

function toggleWheel() {
  isWheelOpen.value = !isWheelOpen.value
}
</script>

<template>
  <footer class="app-footer" :class="{'menu-open': isWheelOpen}">
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
