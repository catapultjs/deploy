<script setup lang="ts">
import { data as posts } from '../../blog.data.js'

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="blog-index">
    <p v-if="posts.length === 0" class="empty">No posts yet.</p>
    <article v-for="post in posts" :key="post.url" class="post">
      <a :href="post.url" class="post-title">{{ post.title }}</a>
      <div class="post-meta">
        <time :datetime="post.date">{{ formatDate(post.date) }}</time>
        <span v-if="post.author"> · {{ post.author }}</span>
      </div>
      <p v-if="post.description" class="post-description">{{ post.description }}</p>
    </article>
  </div>
</template>

<style scoped>
.blog-index {
  max-width: 680px;
}

.post {
  padding: 28px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.post:last-child {
  border-bottom: none;
}

.post-title {
  display: block;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  text-decoration: none;
  margin-bottom: 6px;
  transition: color 0.2s;
}

.post-title:hover {
  color: var(--vp-c-brand-1);
}

.post-meta {
  font-size: 0.875rem;
  color: var(--vp-c-text-3);
  margin-bottom: 8px;
}

.post-description {
  font-size: 0.95rem;
  color: var(--vp-c-text-2);
  margin: 0;
  line-height: 1.6;
}
</style>
