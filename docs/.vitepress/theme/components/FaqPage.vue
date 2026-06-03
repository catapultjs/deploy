<script setup lang="ts">
import { withBase } from 'vitepress'

type FaqItem = {
  question: string
  answer: string[]
  bullets?: string[]
  examples?: Array<{
    label?: string
    command: string
  }>
}

const items: FaqItem[] = [
  {
    question: 'What is the difference between the Guide, CLI, and API pages?',
    answer: [
      'The Guide explains concepts and end-to-end workflows.',
      'The CLI section documents each command on its own page.',
      'The API Reference documents the helpers and primitives used to build custom tasks and recipes.',
    ],
  },
  {
    question: 'Where does Catapult look for the config file?',
    answer: ['By default, Catapult looks in the current directory for:'],
    bullets: ['deploy.ts', 'deploy.config.ts', 'deploy.js', 'deploy.config.js'],
  },
  {
    question: 'When should I run `deploy:setup`?',
    answer: [
      'Run `deploy:setup` before the first deployment on a server.',
      'It creates the remote directory structure Catapult expects and runs setup hooks registered by recipes.',
    ],
  },
  {
    question: 'What is the difference between `deploy`, `rollback`, and `task`?',
    answer: [
      'Use `deploy` for the full deployment pipeline.',
      'Use `rollback` to switch back to an earlier release.',
      'Use `task` to run one registered task on the current release without launching a full deployment.',
    ],
  },
  {
    question: 'Why does `task` require a current release?',
    answer: [
      'Catapult runs the task against the current published release on the target host.',
      'If no deployment has happened yet, there is no current release to execute the task against.',
    ],
  },
  {
    question: 'When should I use `--host` / `-H`?',
    answer: [
      'Use `--host` when more than one host is configured and you want to skip the interactive selection prompt.',
    ],
    examples: [{ label: 'Example', command: 'npx cata deploy -H production' }],
  },
  {
    question: 'What happens when multiple hosts are configured?',
    answer: [
      'For host-aware commands, Catapult prompts you to select one or more hosts when `--host` is not provided.',
      'The `ssh` command prompts for a single host because it opens one interactive session.',
    ],
  },
  {
    question: 'How do I deploy a different branch for one run?',
    answer: [
      'Use `--branch` or `-b` on `deploy`.',
      'That overrides the branch from the config only for the current command.',
    ],
    examples: [{ label: 'Example', command: 'npx cata deploy --branch feature/my-feature' }],
  },
  {
    question: 'How do I use another config file?',
    answer: [
      'Pass `--config` or `-c`.',
      'This is useful when you keep separate configs for staging, production, or multiple projects.',
    ],
    examples: [{ label: 'Example', command: 'npx cata deploy -c deploy.staging.ts' }],
  },
  {
    question: 'How do I unlock a stuck deployment?',
    answer: [
      'If a lock remains after an interrupted deployment, run the unlock task when it is available.',
      'You can list available tasks first if you want to confirm the task name.',
    ],
    examples: [
      { label: 'Unlock a host', command: 'npx cata task deploy:unlock -H production' },
      { label: 'List available tasks', command: 'npx cata list:tasks' },
    ],
  },
  {
    question: 'What does `status` show?',
    answer: ['`status` shows the current state of the selected host, including:'],
    bullets: [
      'the active release',
      'the healthcheck result when configured',
      'the Node.js and package-manager versions',
      'the latest revision metadata',
      'the deployment lock status',
    ],
  },
]
</script>

<template>
  <div class="faq-page">
    <section class="faq-hero">
      <p class="faq-eyebrow">FAQ</p>
      <h1>Frequently asked questions</h1>
      <p class="faq-lead">
        Quick answers for the most common Catapult setup, CLI, and deployment questions.
      </p>
      <div class="faq-links">
        <a :href="withBase('/guide/getting-started')" class="faq-link faq-link--primary">
          Getting Started
        </a>
        <a :href="withBase('/guide/cli/')" class="faq-link faq-link--secondary">CLI Reference</a>
      </div>
    </section>

    <section class="faq-list">
      <details v-for="item in items" :key="item.question" class="faq-item">
        <summary class="faq-question">{{ item.question }}</summary>
        <div class="faq-answer">
          <p v-for="paragraph in item.answer" :key="paragraph">{{ paragraph }}</p>

          <ul v-if="item.bullets">
            <li v-for="bullet in item.bullets" :key="bullet">
              <code v-if="bullet.startsWith('deploy') || bullet.includes('.ts') || bullet.includes('.js')">
                {{ bullet }}
              </code>
              <template v-else>{{ bullet }}</template>
            </li>
          </ul>

          <div v-if="item.examples?.length" class="faq-examples">
            <div v-for="example in item.examples" :key="example.command" class="faq-example">
              <p v-if="example.label" class="faq-example-label">{{ example.label }}</p>
              <pre class="faq-example-code"><code>{{ example.command }}</code></pre>
            </div>
          </div>
        </div>
      </details>
    </section>
  </div>
</template>

<style scoped>
.faq-page {
  width: min(880px, calc(100vw - 48px));
  margin: 0 auto;
  padding: 48px 0 72px;
}

.faq-hero {
  margin-bottom: 32px;
}

.faq-eyebrow {
  margin: 0 0 8px;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.faq-hero h1 {
  margin: 0;
  font-size: clamp(36px, 6vw, 52px);
  line-height: 1.05;
}

.faq-lead {
  margin: 16px 0 0;
  color: var(--vp-c-text-2);
  font-size: 18px;
  line-height: 1.7;
}

.faq-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.faq-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-weight: 600;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.faq-link--primary {
  background: var(--vp-c-brand-1);
  color: #1a1b2e;
}

.faq-link--primary:hover {
  background: var(--vp-c-brand-2);
}

.faq-link--secondary {
  border-color: var(--vp-c-divider);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.faq-link--secondary:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.faq-list {
  display: grid;
  gap: 14px;
}

.faq-item {
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.faq-question {
  position: relative;
  padding: 20px 56px 20px 22px;
  list-style: none;
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
}

.faq-question::-webkit-details-marker {
  display: none;
}

.faq-question::after {
  content: '+';
  position: absolute;
  top: 50%;
  right: 22px;
  transform: translateY(-50%);
  color: var(--vp-c-brand-1);
  font-size: 28px;
  line-height: 1;
}

.faq-item[open] .faq-question::after {
  content: '−';
}

.faq-answer {
  padding: 0 22px 22px;
  color: var(--vp-c-text-2);
}

.faq-answer :deep(code) {
  white-space: nowrap;
}

.faq-answer p:first-child {
  margin-top: 0;
}

.faq-answer p,
.faq-answer ul {
  margin: 0 0 8px;
  line-height: 1.45;
}

.faq-answer ul {
  padding-left: 20px;
}

.faq-examples {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.faq-example {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: #000;
  overflow: hidden;
}

.faq-example-label {
  margin: 0;
  padding: 10px 14px 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.faq-example-code {
  margin: 0;
  padding: 10px 14px 14px;
  background: transparent;
  border: 0;
  overflow-x: auto;
}

.faq-example-code code {
  display: block;
  color: #f5f7fa;
  font-size: 14px;
  line-height: 1.45;
}

@media (max-width: 640px) {
  .faq-page {
    width: min(100vw - 32px, 880px);
    padding-top: 28px;
  }

  .faq-question {
    padding: 18px 48px 18px 18px;
    font-size: 17px;
  }

  .faq-answer {
    padding: 0 18px 18px;
  }

  .faq-answer p,
  .faq-answer ul {
    line-height: 1.4;
  }
}
</style>
