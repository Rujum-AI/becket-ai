<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()

function goToApp() {
  router.push('/login')
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
        <button class="landing-cta" @click="goToApp">
          Go to App
        </button>
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
  background: var(--deep-slate);
  color: white;
  font-size: 0.875rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  position: relative;
  overflow: hidden;
}

/* Button stripe texture */
.landing-cta::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.12) 2px,
    rgba(255, 255, 255, 0.12) 4px
  );
  border-radius: 9999px;
  pointer-events: none;
}

.landing-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.landing-cta:active {
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
