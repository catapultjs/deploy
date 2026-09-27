import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'build/sea',
    ssr: 'bin/run.ts',
    rollupOptions: {
      output: {
        entryFileNames: 'cata.mjs',
        format: 'es',
        codeSplitting: false,
      },
    },
  },
  ssr: {
    noExternal: true,
  },
})
