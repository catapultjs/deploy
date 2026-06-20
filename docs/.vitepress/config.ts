import { defineConfig, type HeadConfig } from 'vitepress'

const siteUrl = 'https://catapultjs.com'
const siteDescription =
  'Deploy Node.js applications over SSH with a composable task pipeline, auto-rollback, and multi-server support. No agents, no containers, no server dependencies.'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Catapult',
  titleTemplate: ':title | Catapult',
  description: siteDescription,
  lang: 'en-US',
  cleanUrls: true,
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
    // OpenGraph — static per-site values; title/description/url injected per page via transformHead
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Catapult' }],
    ['meta', { property: 'og:image', content: `${siteUrl}/og.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    // Twitter Card
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/og.png` }],
  ],
  transformHead({ pageData }) {
    const head: HeadConfig[] = []

    const title = pageData.title
      ? `${pageData.title} | Catapult`
      : 'Catapult — SSH Deployment for Node.js'

    const description = (pageData.frontmatter.description as string | undefined) || siteDescription

    const slug = pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '')
    const url = slug ? `${siteUrl}/${slug}` : siteUrl

    head.push(['link', { rel: 'canonical', href: url }])
    head.push(['meta', { property: 'og:url', content: url }])
    head.push(['meta', { property: 'og:title', content: title }])
    head.push(['meta', { property: 'og:description', content: description }])
    head.push(['meta', { name: 'twitter:title', content: title }])
    head.push(['meta', { name: 'twitter:description', content: description }])

    if (pageData.relativePath === 'index.md') {
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Catapult',
          description: siteDescription,
          url: siteUrl,
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Linux, macOS',
          programmingLanguage: 'TypeScript',
          license: 'https://github.com/catapultjs/deploy/blob/main/LICENSE',
          downloadUrl: 'https://www.npmjs.com/package/@catapultjs/deploy',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }),
      ])
    }

    return head
  },
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Blog', link: '/blog/' },
      { text: 'FAQ', link: '/faq' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Motivation', link: '/guide/motivation' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            {
              text: 'CLI',
              link: '/guide/cli/',
              items: [
                { text: 'Overview', link: '/guide/cli/' },
                { text: 'version', link: '/guide/cli/version' },
                { text: 'init', link: '/guide/cli/init' },
                { text: 'deploy:setup', link: '/guide/cli/deploy-setup' },
                { text: 'deploy', link: '/guide/cli/deploy' },
                { text: 'rollback', link: '/guide/cli/rollback' },
                { text: 'status', link: '/guide/cli/status' },
                { text: 'list:releases', link: '/guide/cli/list-releases' },
                { text: 'list:revisions', link: '/guide/cli/list-revisions' },
                { text: 'list:tasks', link: '/guide/cli/list-tasks' },
                { text: 'pipeline', link: '/guide/cli/pipeline' },
                { text: 'task', link: '/guide/cli/task' },
                { text: 'ssh', link: '/guide/cli/ssh' },
                { text: 'run', link: '/guide/cli/run' },
              ],
            },
            { text: 'Pipeline', link: '/guide/pipeline' },
            { text: 'Hooks', link: '/guide/hooks' },
            { text: 'API Reference', link: '/guide/api' },
            {
              text: 'Recipes',
              link: '/guide/recipes/',
              collapsed: false,
              items: [
                { text: 'astro', link: '/guide/recipes/astro' },
                { text: 'astro_static', link: '/guide/recipes/astro_static' },
                { text: 'git', link: '/guide/recipes/git' },
                { text: 'rsync', link: '/guide/recipes/rsync' },
                { text: 'adonisjs', link: '/guide/recipes/adonisjs' },
                { text: 'adonisjs_local', link: '/guide/recipes/adonisjs_local' },
                { text: 'directus', link: '/guide/recipes/directus' },
                { text: 'nextjs', link: '/guide/recipes/nextjs' },
                { text: 'nextjs_static', link: '/guide/recipes/nextjs_static' },
                { text: 'nuxt', link: '/guide/recipes/nuxt' },
                { text: 'nuxt_static', link: '/guide/recipes/nuxt_static' },
                { text: 'pm2', link: '/guide/recipes/pm2' },
                { text: 'redis', link: '/guide/recipes/redis' },
                { text: 'vitepress', link: '/guide/recipes/vitepress' },
              ],
            },
            {
              text: 'Creating a Recipe',
              link: '/guide/creating-recipes',
              items: [{ text: 'Monorepo', link: '/guide/monorepo' }],
            },
            { text: 'CI/CD', link: '/guide/ci-cd' },
            { text: 'Programmatic usage', link: '/guide/programmatic' },
            { text: 'Agent skill', link: '/guide/agent-skills' },
            { text: 'Deployment Examples', link: '/guide/deployment-examples' },
            { text: 'Changelog', link: '/changelog' },
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
