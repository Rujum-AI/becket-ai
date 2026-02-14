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

const emit = defineEmits(['close', 'confirm'])

const { t } = useI18n()

const dropLocation = ref('School')
const newItem = ref('')
const tempItems = ref([...(props.child.items || [])])

const locations = ['School', 'Soccer Club', 'Tennis', 'Grandma', 'Music Lesson', 'Dance Class']

function addItem() {
  if (newItem.value.trim()) {
    tempItems.value.push(newItem.value.trim())
    newItem.value = ''
  }
}

function removeItem(index) {
  tempItems.value.splice(index, 1)
}

function confirmDropoff() {
  emit('confirm', {
    child: props.child,
    location: dropLocation.value,
    items: tempItems.value
  })
  emit('close')
}
</script>

<template>
  <BaseModal
    :headerStyle="'linear-gradient(135deg, #FFEDD5, #FED7AA)'"
    maxWidth="500px"
    @close="$emit('close')"
  >
    <template #header>
      <h2 class="modal-title">{{ t('dropoffTitle') }}</h2>
      <div class="mt-8 px-10">
        <select v-model="dropLocation" class="big-select">
          <option v-for="loc in locations" :key="loc" :value="loc">
            {{ t(loc) }}
          </option>
        </select>
      </div>
    </template>
        <div class="modal-section">
          <img src="@/assets/backpack.png" class="modal-section-img" alt="Backpack" />
          <h3 class="modal-subtitle">{{ t('whatGear') }} {{ child.name }}?</h3>
        </div>

        <div class="flex flex-col gap-6">
          <div class="flex flex-wrap gap-3">
            <div v-for="(item, i) in tempItems" :key="i" class="tag-pill">
              {{ t(item) }}
              <span class="text-slate-300 ms-2 cursor-pointer text-xl leading-none" @click="removeItem(i)">×</span>
            </div>
          </div>

          <div class="flex gap-3">
            <input
              type="text"
              v-model="newItem"
              :placeholder="t('addCustom')"
              @keyup.enter="addItem"
              class="flex-1 p-5 bg-white rounded-2xl border-2 border-slate-900 font-bold text-lg outline-none"
            />
            <button @click="addItem" class="w-16 h-16 bg-slate-900 text-white rounded-2xl font-black text-3xl flex items-center justify-center hover:bg-slate-700 transition-colors">
              +
            </button>
          </div>
        </div>

        <div class="snapshot-zone">
          <img src="@/assets/snapshot.png" alt="Snapshot" />
          <span class="snapshot-text">{{ t('takeSnapshot') }}</span>
        </div>

    <template #footer>
      <div class="modal-action-bar">
        <button class="modal-secondary-btn" @click="$emit('close')">
          {{ t('cancel') }}
        </button>
        <button class="modal-primary-btn" style="background: #f97316" @click="confirmDropoff">
          {{ t('confirmDropoff') }}
        </button>
      </div>
      <p class="text-center text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-2">
        {{ t('notifyParent') }}
      </p>
    </template>
  </BaseModal>
</template>

<style scoped>
.big-select {
  width: 100%;
  padding: 1rem 1.5rem;
  background: white;
  border: 2px solid #1A1C1E;
  border-radius: 1rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1A1C1E;
  cursor: pointer;
  outline: none;
}

.modal-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.modal-section-img {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: contain;
}

.modal-subtitle {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1A1C1E;
  flex: 1;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: #f0fdf4;
  border: 2px solid #86efac;
  border-radius: 2rem;
  font-weight: 600;
  color: #166534;
  font-size: 0.9375rem;
}

.snapshot-zone {
  margin: 2rem 0;
  padding: 2rem;
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.snapshot-zone:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.snapshot-zone img {
  width: 4rem;
  height: 4rem;
  object-fit: contain;
}

.snapshot-text {
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
