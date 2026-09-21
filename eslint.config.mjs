import prettier from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(prettier).append({
  /**
   * `scripts/proof-video` est un outil local de capture, avec son propre
   * package.json et sa propre chaîne d'outils : il n'est pas suivi par git et
   * ne suit pas les règles de l'app.
   */
  ignores: ['.nuxt', '.output', 'drizzle', 'node_modules', 'scripts/proof-video'],
})
