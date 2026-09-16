import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          environment: 'node',
          include: ['tests/domain/**/*.test.ts'],
        },
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
