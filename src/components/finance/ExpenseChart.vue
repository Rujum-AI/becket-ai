<script setup>
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { useSupabaseFinanceStore } from '@/stores/supabaseFinance'
import CategoryBadge from '@/components/shared/CategoryBadge.vue'

const { t } = useI18n()
const financeStore = useSupabaseFinanceStore()

const timeframes = ['month', 'year']
const timeframeLabel = { month: 'monthly', year: 'year' }

// Split categories into left (odd index) and right (even index)
const rightCategories = computed(() =>
  financeStore.categoryStats.filter((_, i) => i % 2 === 0)
)
const leftCategories = computed(() =>
  financeStore.categoryStats.filter((_, i) => i % 2 === 1)
)

function formatAmount(amount) {
  return amount.toLocaleString('en-US')
}
</script>

<template>
  <div class="expense-chart-container">
    <!-- Timeframe Toggles -->
    <div class="timeframe-toggles">
      <div class="toggle-group">
        <button
          v-for="tf in timeframes"
          :key="tf"
          @click="financeStore.setTimeframe(tf)"
          :class="['toggle-btn', { active: financeStore.activeTimeframe === tf }]"
        >
          {{ t(timeframeLabel[tf]) }}
        </button>
      </div>
    </div>

    <!-- Pie Chart with Categories on sides -->
    <div class="chart-with-categories">
      <!-- Left Categories -->
      <div class="side-categories left-categories">
        <div v-for="cat in leftCategories" :key="cat.id" class="side-category-item">
          <CategoryBadge :category="cat.id" size="lg" />
          <span class="side-category-stats bidi-isolate">{{ cat.percent }}%</span>
        </div>
      </div>

      <!-- Pie Chart -->
      <div class="chart-wrapper">
        <div class="pie-chart" :style="{ background: financeStore.pieGradient }"></div>
        <div class="pie-center">
          <span class="pie-label">{{ t('total') }}</span>
          <span class="pie-amount bidi-isolate">{{ formatAmount(financeStore.totalAmount) }}</span>
          <span class="pie-currency">ILS</span>
        </div>
      </div>

      <!-- Right Categories -->
      <div class="side-categories right-categories">
        <div v-for="cat in rightCategories" :key="cat.id" class="side-category-item">
          <CategoryBadge :category="cat.id" size="lg" />
          <span class="side-category-stats bidi-isolate">{{ cat.percent }}%</span>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.expense-chart-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.5rem;
}

.timeframe-toggles {
  display: flex;
  justify-content: center;
}

.toggle-group {
  display: flex;
  background: #f1f5f9;
  padding: 0.25rem;
  border-radius: 9999px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.toggle-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.2s;
  color: #64748b;
  border: none;
  background: transparent;
  cursor: pointer;
}

.toggle-btn:hover {
  color: #475569;
}

.toggle-btn.active {
  background: #1e293b;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Chart with side categories layout — grid keeps pie centered */
.chart-with-categories {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1.75rem;
  margin-top: 0.5rem;
}

.side-categories {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.left-categories {
  align-items: center;
  justify-self: end;
}

.right-categories {
  align-items: center;
  justify-self: start;
}

.side-category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-align: center;
}

.side-category-stats {
  font-size: 0.625rem;
  color: #64748b;
  font-weight: 700;
}

.chart-wrapper {
  position: relative;
  width: 220px;
  height: 220px;
  flex-shrink: 0;
}

.pie-chart {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  position: relative;
}

.pie-chart::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.06) 2px,
    rgba(255, 255, 255, 0.06) 4px
  );
}

.pie-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60%;
  height: 60%;
  background: white;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.pie-label {
  font-size: 0.5rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.pie-amount {
  font-size: 1.5rem;
  font-weight: 900;
  color: #1e293b;
  letter-spacing: -0.025em;
}

.pie-currency {
  font-size: 0.5rem;
  font-weight: 700;
  color: #94a3b8;
}

/* Narrow viewports: stop trying to fit categories on either side of the
   donut — at 360–480px the side columns clip the labels. Reflow to a
   single column with the chart centered and all categories in a wrap-grid
   underneath. This is the layout that survives the smallest phones. */
@media (max-width: 540px) {
  .chart-with-categories {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 1.25rem;
  }

  .side-categories {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem 1.25rem;
    width: 100%;
    max-width: 22rem;
  }

  .left-categories,
  .right-categories {
    justify-self: center;
  }

  /* Render the two halves in correct visual order: left col first, then
     pie, then right col — pie sits in the middle via order. */
  .left-categories  { order: 2; }
  .chart-wrapper    { order: 1; }
  .right-categories { order: 3; }

  /* Once the two halves stack underneath the chart, merge them visually
     into one continuous grid by removing the vertical gap between them. */
  .right-categories { margin-top: -1rem; }
}

@media (max-width: 420px) {
  .chart-wrapper {
    width: 160px;
    height: 160px;
  }

  .side-category-item :deep(.circle) {
    width: 2.75rem;
    height: 2.75rem;
  }

  .pie-amount {
    font-size: 1.125rem;
  }
}

</style>
