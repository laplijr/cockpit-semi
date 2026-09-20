import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-16',
  modules: ['@nuxt/eslint', '@pinia/nuxt', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  typescript: { strict: true, typeCheck: false },
  runtimeConfig: {
    appPassword: '',
    databaseUrl: '',
    /** Protège la route de cron ; Vercel l'envoie en en-tête Authorization. */
    cronSecret: '',
    /** Clé de l'API Claude, pour l'Imprévu et la recherche de course (§ 6). */
    anthropicApiKey: '',
    /** Clé OpenRouteService, pour les itinéraires GPX ; serveur uniquement (§ 9). */
    orsApiKey: '',
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Cockpit',
      meta: [
        { charset: 'utf-8' },
        /*
         * `interactive-widget=resizes-content` fait rétrécir la fenêtre de mise
         * en page quand le clavier virtuel monte, au lieu de la faire glisser
         * sous lui. C'est ce qui donne son sens au `dvh` des feuilles : le
         * bouton d'envoi reste au-dessus du clavier (§ 8, P6.8).
         */
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, interactive-widget=resizes-content',
        },
        { name: 'color-scheme', content: 'dark' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },
})
