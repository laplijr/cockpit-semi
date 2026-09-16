import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/infra/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.NUXT_DATABASE_URL! },
  casing: 'snake_case',
})
