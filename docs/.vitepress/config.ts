import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Catapult',
  description: 'SSH deployment tool for Node.js applications.',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
    ],

    sidebar: [
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

    socialLinks: [{ icon: 'github', link: 'https://github.com/batosai/catapult' }],
  },
})
