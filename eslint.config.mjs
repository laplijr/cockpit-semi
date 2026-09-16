import prettier from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(prettier).append({
  ignores: ['.nuxt', '.output', 'drizzle', 'node_modules'],
})
