import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Catapult',
  description: 'SSH deployment tool for Node.js applications.',
  head: [
    [
      'script',
      {
        'defer': '',
        'src': 'https://umami.jrmc.dev/script.js',
        'data-website-id': 'e3910dee-0a06-45bd-87f7-90623acdcd7c',
      },
    ],
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
