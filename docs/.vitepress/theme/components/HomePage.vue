<script setup>
import { withBase } from 'vitepress'
</script>

<template>
  <div class="home ctp-home">
    <!-- Hero -->
    <section class="hero">
      <div class="hero__glow" />
      <div class="hero__content">
        <div class="hero__badges">
          <div class="hero__badge">SSH Deployment Tool</div>
          <div class="hero__alpha">⚠️ Alpha — API may change</div>
        </div>
        <h1 class="hero__title">
          <span class="hero__title-main">Catapult JS</span>
        </h1>
        <p class="hero__tagline">Deploy Node.js applications over SSH.</p>
        <div class="hero__actions">
          <a :href="withBase('/guide/getting-started')" class="btn btn--primary">Get Started</a>
          <a href="https://github.com/batosai/catapult" class="btn btn--secondary" target="_blank">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            GitHub
          </a>
        </div>
        <div class="hero__install">
          <code>npx @catapultjs/deploy init</code>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="features">
      <div class="features__grid">
        <div class="feature-card">
          <div class="feature-card__icon">⚡</div>
          <h3>SSH-based</h3>
          <p>
            Deploy directly over SSH — no agents, no server-side dependencies, just a remote shell.
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-card__icon">🔧</div>
          <h3>Pipeline-driven</h3>
          <p>
            Composable task pipeline. Insert, remove or replace any step with a single function
            call.
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-card__icon">📦</div>
          <h3>Recipes</h3>
          <p>
            Drop-in recipes for AdonisJS, PM2 and rsync. Import once, tasks are registered
            automatically.
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-card__icon">↩️</div>
          <h3>Auto rollback</h3>
          <p>On failure after publish, the previous release is restored automatically.</p>
        </div>
        <div class="feature-card">
          <div class="feature-card__icon">🌐</div>
          <h3>Multi-server</h3>
          <p>
            Deploy to staging and production in the same run. Target a single host with
            <code>--host</code>.
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-card__icon">🔌</div>
          <h3>Extensible</h3>
          <p>
            Define custom tasks, hooks and recipes. Full async support with
            <code>getContext()</code>.
          </p>
        </div>
      </div>
    </section>

    <!-- Quick start -->
    <section class="quickstart">
      <h2 class="quickstart__title">Up and running in minutes</h2>
      <div class="quickstart__steps">
        <div class="step">
          <div class="step__number">1</div>
          <div class="step__content">
            <h4>Init</h4>
            <pre><code>npx @catapultjs/deploy init</code></pre>
          </div>
        </div>
        <div class="step">
          <div class="step__number">2</div>
          <div class="step__content">
            <h4>Configure</h4>
            <pre><code><span class="c-keyword">import</span> { defineConfig } <span class="c-keyword">from</span> <span class="c-string">'@catapultjs/deploy'</span>

<span class="c-keyword">await</span> <span class="c-fn">defineConfig</span>({
  keepReleases: <span class="c-num">5</span>,
  hosts: [{
    name: <span class="c-string">'production'</span>,
    ssh: <span class="c-string">'deploy@example.com'</span>,
    deployPath: <span class="c-string">'/home/deploy/myapp'</span>,
    branch: <span class="c-string">'main'</span>,
  }],
})</code></pre>
          </div>
        </div>
        <div class="step">
          <div class="step__number">3</div>
          <div class="step__content">
            <h4>Deploy</h4>
            <pre><code>npx cata deploy</code></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="home-footer">
      <p>
        Inspired by <a href="https://deployer.org" target="_blank">Deployer PHP</a> and
        <a href="https://capistranorb.com" target="_blank">Capistrano</a>
      </p>
    </footer>
  </div>
</template>

<style>
/* ── CSS variables (non-scoped pour que .dark fonctionne) ── */
.ctp-home {
  --h-c-string: #22a060;
  --h-c-fn: #d97706;
  --h-c-num: #e25822;
  --h-bg: #f5f7fa;
  --h-text: #1a1b2e;
  --h-text-muted: rgba(26, 27, 46, 0.55);
  --h-text-subtle: rgba(26, 27, 46, 0.35);
  --h-accent: #00bfff;
  --h-accent-hover: #33ccff;
  --h-card-bg: rgba(26, 27, 46, 0.04);
  --h-card-border: rgba(26, 27, 46, 0.1);
  --h-pre-bg: rgba(26, 27, 46, 0.05);
  --h-pre-border: rgba(26, 27, 46, 0.1);
  --h-pre-code: #1a1b2e;
  --h-btn-secondary-bg: rgba(26, 27, 46, 0.06);
  --h-btn-secondary-text: #1a1b2e;
  --h-btn-secondary-border: rgba(26, 27, 46, 0.15);
  --h-footer-border: rgba(26, 27, 46, 0.08);
  --h-title-gradient: linear-gradient(120deg, #1a1b2e 40%, #00bfff);
}

.dark .ctp-home {
  --h-c-string: #a8e6a3;
  --h-c-fn: #ffd97d;
  --h-c-num: #f4a261;
  --h-bg: #1a1b2e;
  --h-text: #ffffff;
  --h-text-muted: rgba(255, 255, 255, 0.65);
  --h-text-subtle: rgba(255, 255, 255, 0.35);
  --h-card-bg: rgba(255, 255, 255, 0.03);
  --h-card-border: rgba(255, 255, 255, 0.08);
  --h-pre-bg: rgba(255, 255, 255, 0.04);
  --h-pre-border: rgba(255, 255, 255, 0.08);
  --h-pre-code: #e2e8f0;
  --h-btn-secondary-bg: rgba(255, 255, 255, 0.06);
  --h-btn-secondary-text: #ffffff;
  --h-btn-secondary-border: rgba(255, 255, 255, 0.15);
  --h-footer-border: rgba(255, 255, 255, 0.06);
  --h-title-gradient: linear-gradient(120deg, #ffffff 40%, #00bfff);
}
</style>

<style scoped>
/* ── Base ── */

.home {
  background: var(--h-bg);
  color: var(--h-text);
  min-height: 100vh;
}

/* Hero */

.hero {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 80px 24px;
  overflow: hidden;
  text-align: center;
}

.hero__glow {
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(0, 191, 255, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.hero__content {
  position: relative;
  max-width: 720px;
}

.hero__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}

@media (max-width: 480px) {
  .hero__badges {
    flex-direction: column;
  }
}

.hero__badge {
  display: inline-block;
  padding: 4px 14px;
  border: 1px solid rgba(0, 191, 255, 0.4);
  border-radius: 999px;
  font-size: 13px;
  color: var(--h-accent);
  letter-spacing: 0.05em;
}

.hero__alpha {
  display: inline-block;
  padding: 4px 14px;
  border: 1px solid rgba(255, 165, 0, 0.4);
  border-radius: 999px;
  font-size: 12px;
  color: #f59e0b;
  letter-spacing: 0.04em;
}

.hero__title {
  font-size: clamp(56px, 10vw, 96px);
  font-weight: 800;
  line-height: 1;
  margin: 0 0 24px;
  letter-spacing: -0.03em;
}

.hero__title-main {
  background: var(--h-title-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero__tagline {
  font-size: 20px;
  color: var(--h-text-muted);
  line-height: 1.6;
  margin: 0 0 40px;
}

.hero__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 32px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}

.btn--primary {
  background: var(--h-accent);
  color: #1a1b2e;
}

.btn--primary:hover {
  background: var(--h-accent-hover);
}

.btn--secondary {
  background: var(--h-btn-secondary-bg);
  color: var(--h-btn-secondary-text);
  border: 1px solid var(--h-btn-secondary-border);
}

.btn--secondary:hover {
  background: var(--h-card-bg);
}

.hero__install {
  display: inline-block;
  background: rgba(0, 191, 255, 0.08);
  border: 1px solid rgba(0, 191, 255, 0.2);
  border-radius: 8px;
  padding: 10px 20px;
}

.hero__install code {
  font-family: monospace;
  font-size: 14px;
  color: var(--h-accent);
}

/* Features */

.features {
  padding: 80px 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.features__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.feature-card {
  background: var(--h-card-bg);
  border: 1px solid var(--h-card-border);
  border-radius: 12px;
  padding: 28px;
  transition: border-color 0.2s;
}

.feature-card:hover {
  border-color: rgba(0, 191, 255, 0.3);
}

.feature-card__icon {
  font-size: 28px;
  margin-bottom: 16px;
}

.feature-card h3 {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--h-text);
}

.feature-card p {
  font-size: 14px;
  color: var(--h-text-muted);
  line-height: 1.6;
  margin: 0;
}

.feature-card code {
  font-family: monospace;
  font-size: 13px;
  color: var(--h-accent);
  background: rgba(0, 191, 255, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
}

/* Quick start */

.quickstart {
  max-width: 800px;
  margin: 0 auto;
  padding: 80px 24px;
}

.quickstart__title {
  font-size: 32px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 56px;
  color: var(--h-text);
}

.quickstart__steps {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.step {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.step__number {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 191, 255, 0.15);
  border: 1px solid rgba(0, 191, 255, 0.4);
  color: var(--h-accent);
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step__content {
  flex: 1;
  min-width: 0;
}

.step__content h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--h-text-muted);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.step__content pre {
  background: var(--h-pre-bg);
  border: 1px solid var(--h-pre-border);
  border-radius: 8px;
  padding: 16px 20px;
  margin: 0;
  overflow-x: auto;
  max-width: 100%;
  box-sizing: border-box;
}

.step__content pre code {
  font-family: monospace;
  font-size: 14px;
  line-height: 1.7;
  color: var(--h-pre-code);
}

.c-keyword {
  color: var(--h-accent);
}
.c-string {
  color: var(--h-c-string, #22a060);
}
.c-fn {
  color: var(--h-c-fn, #d97706);
}
.c-num {
  color: var(--h-c-num, #e25822);
}

/* Footer */

.home-footer {
  text-align: center;
  padding: 48px 24px;
  border-top: 1px solid var(--h-footer-border);
  color: var(--h-text-subtle);
  font-size: 14px;
}

.home-footer a {
  color: var(--h-text-muted);
  text-decoration: none;
}

.home-footer a:hover {
  color: var(--h-accent);
}
</style>
