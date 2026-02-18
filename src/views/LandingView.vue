<script setup>
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'

const { signInWithGoogle } = useAuth()
const { t } = useI18n()
const loading = ref(false)
const error = ref('')

async function handleGoogleSignIn() {
  error.value = ''
  loading.value = true
  try {
    await signInWithGoogle()
  } catch (err) {
    error.value = err.message
    loading.value = false
  }
}
</script>

<template>
  <div class="landing">
    <!-- Landscape cover image -->
    <img
      src="/assets/becket_cover.png"
      alt=""
      class="landing-cover"
    />
    <!-- Portrait cover image -->
    <img
      src="/assets/becket_cover_vertical.png"
      alt=""
      class="landing-cover-portrait"
    />

    <!-- Content overlay -->
    <div class="landing-overlay">
      <div class="landing-card">
        <h1 class="landing-heading">Welcome to Becket!</h1>
        <h2 class="landing-tagline">Parenting continuity across distance, change, and busy reality.</h2>
        <p class="landing-text">
          A collaborative operating system for parents to stay coordinated, present and aligned in their child's life.
        </p>
        <button class="landing-cta" :disabled="loading" @click="handleGoogleSignIn">
          <svg class="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {{ loading ? t('login_loading') : t('login_googleContinue') }}
        </button>
        <p v-if="error" class="landing-error">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.landing {
  height: 100dvh;
  width: 100%;
  background: var(--warm-linen);
  position: relative;
  overflow: hidden;
  direction: ltr;
}

/* Image: native aspect ratio, full width, centered, clips horizontally */
.landing-cover {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  width: 100%;
  height: auto;
  border-top: 2px solid var(--deep-slate);
  border-bottom: 2px solid var(--deep-slate);
}

/* Portrait cover — hidden by default */
.landing-cover-portrait {
  display: none;
}

/* Overlay: positions card to the right */
.landing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 1.5rem 2.5rem 1.5rem 1.5rem;
}

/* Card: modal-style container */
.landing-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2.5rem 2rem;
  background: rgba(255, 255, 255, 0.65);
  border: 2px solid var(--deep-slate);
  border-radius: 2.5rem;
  box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.2);
  max-width: 520px;
  width: 100%;
  position: relative;
  overflow: hidden;
}

/* Diagonal stripe texture like modal buttons */
.landing-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(26, 28, 30, 0.03) 2px,
    rgba(26, 28, 30, 0.03) 4px
  );
  border-radius: 2.5rem;
  pointer-events: none;
}

.landing-heading {
  font-family: 'Fraunces', serif;
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--deep-slate);
  margin: 0;
  line-height: 1.15;
  position: relative;
}

.landing-tagline {
  font-family: 'Fraunces', serif;
  font-size: 1.1rem;
  font-weight: 500;
  font-style: italic;
  color: var(--rust-orange);
  margin: 0.5rem 0 0;
  line-height: 1.4;
  position: relative;
}

.landing-text {
  max-width: 340px;
  font-size: 0.95rem;
  font-weight: 500;
  color: #64748b;
  line-height: 1.6;
  margin: 1rem 0 0;
  position: relative;
}

.landing-cta {
  margin-top: 1.75rem;
  padding: 1.2rem 2.5rem;
  background: white;
  color: var(--deep-slate);
  font-size: 0.875rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  border: 2px solid var(--deep-slate);
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.landing-cta:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.google-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.landing-error {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  color: #dc2626;
  position: relative;
}

.landing-cta:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  background: #f8fafc;
}

.landing-cta:active:not(:disabled) {
  transform: scale(0.97);
}

/* === MOBILE PORTRAIT: card in top 1/3, image in bottom 1/3 === */
@media (max-width: 768px) and (orientation: portrait) {
  .landing-cover {
    display: none;
  }

  .landing-cover-portrait {
    display: block;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: auto;
    height: auto;
    border-top: 2px solid var(--deep-slate);
    border-bottom: 2px solid var(--deep-slate);
  }

  .landing-overlay {
    padding: 0 1.5rem;
    align-items: flex-start;
    justify-content: center;
  }

  .landing-card {
    padding: 1.5rem 1.25rem;
    max-width: none;
    width: 100%;
    margin-top: 66.67dvh;
    transform: translateY(-50%);
  }

  .landing-heading {
    font-size: 1.6rem;
  }

  .landing-tagline {
    font-size: 0.85rem;
  }

  .landing-text {
    font-size: 0.8rem;
    margin: 0.5rem 0 0;
  }

  .landing-cta {
    margin-top: 1rem;
    padding: 0.8rem 2rem;
    font-size: 0.75rem;
  }
}

/* === MOBILE LANDSCAPE: card pinned to right with vertical breathing room === */
@media (max-width: 768px) and (orientation: landscape) {
  .landing-overlay {
    justify-content: flex-end;
    padding: 1rem 1.25rem;
  }

  .landing-card {
    padding: 1.25rem 1rem;
    max-width: 280px;
  }

  .landing-heading {
    font-size: 1.5rem;
  }

  .landing-tagline {
    font-size: 0.75rem;
  }

  .landing-text {
    font-size: 0.75rem;
    margin: 0.4rem 0 0;
  }

  .landing-cta {
    margin-top: 0.75rem;
    padding: 0.6rem 1.5rem;
    font-size: 0.7rem;
  }
}

/* Large screens */
@media (min-width: 1200px) {
  .landing-heading {
    font-size: 4rem;
  }

  .landing-tagline {
    font-size: 1.6rem;
  }

  .landing-text {
    font-size: 1.05rem;
    max-width: 400px;
  }
}

</style>
