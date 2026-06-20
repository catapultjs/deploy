// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './style.css'
import BlogIndex from './components/BlogIndex.vue'
import BlogPostMeta from './components/BlogPostMeta.vue'
import FaqPage from './components/FaqPage.vue'
import HomePage from './components/HomePage.vue'
import NavVersion from './components/NavVersion.vue'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-title-after': () => h(NavVersion),
      'doc-before': () => h(BlogPostMeta),
    })
  },
  enhanceApp({ app }) {
    app.component('BlogIndex', BlogIndex)
    app.component('FaqPage', FaqPage)
    app.component('HomePage', HomePage)
  },
} satisfies Theme
