<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { frontmatter, page } = useData()

const isBlogPost = computed(() => {
  return page.value.relativePath.startsWith('blog/') && page.value.relativePath !== 'blog/index.md'
})

const date = computed(() => frontmatter.value.date as string | undefined)
const author = computed(() => frontmatter.value.author as string | undefined)

const formattedDate = computed(() => {
  if (!date.value) return ''
  return new Date(date.value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})
</script>

<template>
  <div v-if="isBlogPost && date" class="blog-post-meta">
    <time :datetime="date">{{ formattedDate }}</time>
    <span v-if="author"> · {{ author }}</span>
  </div>
</template>
