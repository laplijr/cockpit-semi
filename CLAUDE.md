# Cockpit — consignes pour les agents

Projet personnel de Ronan : cockpit d'entraînement (course à pied, vélo, muscu), web, gratuit, mono-utilisateur.

**Source de vérité : `docs/PLAN.md`.** Le lire en entier avant d'agir, puis exécuter la prochaine case non cochée de la section « État d'avancement et consigne aux agents ». Cocher les cases au fil de l'eau, dans ce fichier.

Règles qui priment sur tout le reste :

- Moteur d'entraînement déterministe et testé dans `server/domain/*` ; le LLM ne sert qu'au texte libre (Imprévu), à la recherche de course et aux explications. Aucune donnée Strava n'est envoyée au LLM.
- Rien n'est appliqué au plan sans validation de Ronan : le moteur produit des propositions.
- Écran principal hiérarchisé (instruments → aujourd'hui + à décider → semaine, cap). Un nouvel élément y remplace ou rétrograde un existant, sinon il va dans une page ou un panneau. L'écran de référence est le desktop 1440 ; depuis P6.8 le téléphone est servi par les règles de largeur du § 8 (les grilles se replient, les objets à axe défilent), sans parité ni PWA.
- Textes UI en français, sans emoji ; icônes via `UiAppIcon` ; classes `tile`, `panel`, `label`, `mono`, `btn` de `app/assets/css/main.css`.
- Schéma Drizzle dans `server/infra/db/schema.ts`, migrations générées (`pnpm db:generate`, `pnpm db:migrate`), jamais éditées à la main.
- « Fini » = `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts + parcours vérifié dans le navigateur. Un commit par livrable, message « P<n> — <résumé> ». Pas de push sans demande explicite.
- Ne jamais committer `.env`, `.env.local` ni un secret.

Maquettes de référence : https://claude.ai/artifact/GHF88CMB93rHvF8xQfaYDA (sources dans `~/Documents/dev/cockpit-semi-design`).
