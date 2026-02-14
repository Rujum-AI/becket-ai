<script setup>
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
import AiChat from './AiChat.vue'
</script>

<template>
  <div>
    <AppHeader />
    <AiChat />
    <main class="content-wrap px-6 sm:px-8">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
