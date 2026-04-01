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
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Pipeline', link: '/guide/pipeline' },
            { text: 'Recipes', link: '/guide/recipes' },
            { text: 'Creating a Recipe', link: '/guide/creating-recipes' },
            { text: 'Hooks', link: '/guide/hooks' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/catapultjs/deploy' }],
  },
})
