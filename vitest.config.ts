import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

/**
 * Les tests d'intégration parlent à une vraie base **et la vident** : ils
 * n'acceptent donc que `NUXT_TEST_DATABASE_URL`, jamais celle de
 * développement. Sans elle, ils se sautent et `pnpm test` ne détruit rien.
 */
function testDatabaseUrl(): string {
  if (process.env.NUXT_TEST_DATABASE_URL) return process.env.NUXT_TEST_DATABASE_URL

  for (const name of ['.env.local', '.env']) {
    const path = `${rootDir}${name}`
    if (!existsSync(path)) continue
    const match = readFileSync(path, 'utf8').match(/^NUXT_TEST_DATABASE_URL=(.*)$/m)
    if (match) return match[1]!.trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

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
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          env: { NUXT_DATABASE_URL: testDatabaseUrl() },
          /** Deux athlètes se rejouent sur la même base : jamais en parallèle. */
          fileParallelism: false,
          testTimeout: 60_000,
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
