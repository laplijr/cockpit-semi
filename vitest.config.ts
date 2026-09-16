import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          environment: 'node',
          include: ['tests/domain/**/*.test.ts'],
        },
        resolve: { alias: { '~~': rootDir } },
      },
      await defineVitestProject({
        test: {
          name: 'app',
          environment: 'nuxt',
          include: ['tests/app/**/*.test.ts'],
        },
      }),
    ],
  },
})
