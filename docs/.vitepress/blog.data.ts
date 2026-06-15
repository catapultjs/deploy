import { createContentLoader } from 'vitepress'

export interface Post {
  title: string
  url: string
  date: string
  description?: string
  author?: string
}

declare const data: Post[]
export { data }

export default createContentLoader('blog/*.md', {
  transform(raw) {
    return raw
      .filter(({ frontmatter }) => frontmatter.date)
      .map(({ url, frontmatter }) => ({
        title: frontmatter.title as string,
        url,
        date: frontmatter.date as string,
        description: frontmatter.description as string | undefined,
        author: frontmatter.author as string | undefined,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  },
})
