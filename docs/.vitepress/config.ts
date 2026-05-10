import { defineConfig } from 'vitepress'

const siteUrl = 'https://catapultjs.com'
const siteDescription =
  'Deploy Node.js applications over SSH with a composable task pipeline, auto-rollback, and multi-server support. No agents, no server dependencies.'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Catapult',
  titleTemplate: ':title | Catapult',
  description: siteDescription,
  lang: 'en-US',
  sitemap: {
    hostname: siteUrl,
  },
  head: [
    [
      'script',
      {
        'defer': '',
        'src': 'https://umami.jrmc.dev/script.js',
        'data-website-id': 'e3910dee-0a06-45bd-87f7-90623acdcd7c',
      },
    ],
    // OpenGraph
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Catapult' }],
    ['meta', { property: 'og:url', content: siteUrl }],
    ['meta', { property: 'og:title', content: 'Catapult — SSH Deployment for Node.js' }],
    ['meta', { property: 'og:description', content: siteDescription }],
    // Twitter Card
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'Catapult — SSH Deployment for Node.js' }],
    ['meta', { name: 'twitter:description', content: siteDescription }],
  ],
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Motivation', link: '/guide/motivation' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Pipeline', link: '/guide/pipeline' },
            { text: 'Hooks', link: '/guide/hooks' },
            { text: 'API Reference', link: '/guide/api' },
            {
              text: 'Recipes',
              link: '/guide/recipes/',
              collapsed: false,
              items: [
                { text: 'astro', link: '/guide/recipes/astro' },
                { text: 'git', link: '/guide/recipes/git' },
                { text: 'rsync', link: '/guide/recipes/rsync' },
                { text: 'adonisjs', link: '/guide/recipes/adonisjs' },
                { text: 'directus', link: '/guide/recipes/directus' },
                { text: 'nuxt', link: '/guide/recipes/nuxt' },
                { text: 'pm2', link: '/guide/recipes/pm2' },
                { text: 'redis', link: '/guide/recipes/redis' },
                { text: 'vitepress', link: '/guide/recipes/vitepress' },
              ],
            },
            { text: 'Deployment Examples', link: '/guide/deployment-examples' },
            {
              text: 'Creating a Recipe',
              link: '/guide/creating-recipes',
              items: [{ text: 'Monorepo', link: '/guide/monorepo' }],
            },
            { text: 'Changelog', link: '/guide/changelog' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/catapultjs/deploy' }],
  },
})
