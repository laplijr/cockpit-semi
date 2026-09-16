# Cockpit d'entraînement — plan d'implémentation

Projet personnel, indépendant de bonx-next. Web **desktop** (largeur cible 1440, minimum 1280), gratuit. Une seule connexion externe : Strava. Le mobile viendra plus tard, en vue réduite de la même app.
Maquettes de référence (v5, desktop) : https://claude.ai/artifact/GHF88CMB93rHvF8xQfaYDA (sources dans `~/Documents/dev/cockpit-semi-design`, générateur `build_desktop.py`).

## État d'avancement et consigne aux agents

**Où on en est (16 sept. 2026)** : P0 livré (commit `a892722` « P0 — socle et coque desktop », puis Prettier). Nuxt 4 + Tailwind 4 + Pinia + nuxt-auth-utils + Drizzle/Neon, coque desktop complète (`app/components/shell/*`, `app/layouts/default.vue`, `app/stores/ui.ts` avec panneaux `imprevu | pause | retour | propositions` et fenêtre `nouvelle-course`, raccourcis ⌘K / Échap), 11 pages en stub `UiPhaseStub`, schéma réduit à `athlete`, CI lint + typecheck + test + build.

**Consigne** : lire ce fichier en entier, puis exécuter la prochaine case non cochée de la liste ci-dessous, dans l'ordre, jusqu'au bout de la phase. Une phase est finie quand tous ses critères de « Fini » passent. Cocher les cases dans ce fichier au fil de l'eau. Ne pas anticiper une phase suivante, ne pas ajouter d'élément à l'écran principal sans en retirer un (§ 8), pas de responsive mobile, pas de PWA.

**Règles de travail**
- Commandes : `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:generate` puis `pnpm db:migrate` pour toute évolution de `server/infra/db/schema.ts`. Ne jamais éditer les fichiers de `drizzle/` à la main.
- Domaine pur dans `server/domain/<module>/` (aucun import de `server/infra`), cas d'usage dans `server/application/`, routes dans `server/api/`. Chaque module de domaine a ses tests dans `tests/domain/<module>.test.ts` avant d'être branché à l'UI.
- Composants : `app/components/<domaine>/`, pages dans `app/pages/`, stores Pinia dans `app/stores/`, navigation dans `app/utils/navigation.ts`. Tokens et classes utilitaires (`tile`, `panel`, `label`, `mono`, `btn`) dans `app/assets/css/main.css` : les réutiliser, pas de nouvelle palette.
- Textes UI en français, sans emoji, icônes via `UiAppIcon`. Nombres en `mono`. Une seule action principale par ligne. Toute valeur proposée affiche l'ancienne barrée.
- Un commit par livrable, message « P<n> — <résumé> », sur `main`. Pas de push sans demande explicite de Ronan.
- Données Strava jamais envoyées au LLM (§ 1). Secrets uniquement dans `.env` / variables Vercel.
- « Fini » = lint, typecheck, tests et build verts, parcours vérifié dans le navigateur à 1440 px, cases cochées, commit fait.

**Liste ordonnée**

P0.5 — Alignement sur la version courante du plan (avant tout code P1)
- [x] `app/utils/navigation.ts` : groupe « Planifier » → « Objectifs » (Courses seule) + « Bibliothèques » (Course à pied `/course-a-pied` icône `run`, Muscu, Vélo, Nutrition) ; « Historique » → « Progression » (`/progression`, phase P3). Ajouter l'icône `run` dans `UiAppIcon`. Mettre à jour `tests/app/navigation.test.ts`.
- [x] Pages : renommer `app/pages/historique.vue` en `progression.vue`, créer `course-a-pied.vue` (stub P1). Phases des stubs : Cockpit P1, Semaine P1, Courses P1, Course à pied P1, Progression P3, Muscu P4, Vélo P4, Nutrition P6, Apprentissage P6, Connexions P2, Profil P1.
- [x] `server/infra/db/schema.ts` : ajouter `race` (avec `objective_mode`, `objectif_s` nul possible, `representative`, `incident` jsonb), `race_segment`, `session_type`, `fitness_point` (voir § 4) ; générer et appliquer la migration.
- [x] Commit « P0.5 — alignement navigation et schéma ».

P1 — Courses, forme, plan
- [x] `server/domain/fitness` : VDOT depuis (distance, temps), allures E/M/T/I, projection sur une distance, plancher depuis une course non représentative (§ 5). Tests sur la table Daniels : VDOT 44 → semi 1:42:17 ± 5 s, VDOT 45,4 → ≈ 1:39:35, 1:38:00 → 4:39/km.
- [x] `server/domain/running` : les 9 types de séances de la bibliothèque (§ 8) avec structure par défaut, quota, phases autorisées, RPE attendu ; fonction `prescription(type, vdot, semaine)`. Tests des quotas (I ≤ 8 %, T ≤ 10 %, SL ≤ 30 %).
- [x] `server/domain/plan` : rétro-planning des phases depuis la course A, mini-cycle B, cycle 5 km, blocs 4 semaines avec semaine allégée, génération de la semaine type depuis les contraintes de `athlete`, pause en cours → reprise 60/80/100 %. Tests : Paris A + Madrid B + 5 km A → 3 cycles sans collision ; semaine 4 allégée à −30 % ; SL ≤ 30 %.
- [x] `server/application` + `server/api` : CRUD courses, résultat de course avec segments, génération et lecture du plan actif (`plan_version`, `phase`, `week`, `session` en base).
- [x] Seed § 0 (script `pnpm db:seed`) : athlete, semi du 13 sept. (2:26:00, 21,5 km, 3 segments, non représentatif), Paris (A, mars 2027, objectif à fixer), Madrid (B, avril 2027), 5 km Île d'Arz (A, 8 août 2027, performance_max), pause active « ongle de pied cassé » ouverte le 16 sept. (course interdite, muscu haut du corps ok, vélo et muscu jambes si indolore), puis reprise surveillée de 3 semaines avec zone « genou droit, face postérieure » à surveiller.
- [x] UI Courses : table (nom, date, distance, priorité, objectif ou « à fixer », projection, écart, statut) + frise de périodisation ; fenêtre Nouvelle course en saisie manuelle (la recherche automatique attend P5).
- [x] UI Profil : onboarding `athlete` (poids, FCmax, jours, contraintes) + déclaration de la blessure en cours.
- [x] UI Semaine : bloc de 4 semaines, une ligne par semaine, cellules par jour (lecture seule en P1).
- [x] UI Course à pied : bibliothèque des 9 séances avec allures du VDOT courant.
- [x] UI Cockpit v1 : cadran course A, cadran VDOT (plancher affiché comme tel), panneau « Aujourd'hui » avec la séance prévue ou l'état de pause (jour n, activités autorisées, bouton « Marquer la reprise »), bande semaine, frise cap. Les autres cadrans restent en stub jusqu'à P2/P3.
- [ ] Fini : tests domaine verts, parcours « onboarding → courses → plan généré → cockpit affiche la séance du jour » vérifié, commit « P1 — courses, forme, plan ».

P2 → P7 : voir § 9, à transformer en cases au moment d'attaquer la phase.

## 0. Données réelles de départ (à seeder en P1)

Les valeurs des maquettes (VDOT 45, 1:42 au semi, objectif 1:38, Madrid le 18 avril) sont des exemples. Voici la vraie base.

**Courses réalisées**

| Course | Date | Résultat | Statut de référence |
|---|---|---|---|
| Premier semi-marathon | dim. 13 sept. 2026 | **2:26:00 sur 21,5 km (6:48/km de moyenne)**. Segments : 6:00/km jusqu'au km ~14, blessure, marche/course alternées du km 14 au km 19, 6:00/km du km 19 à l'arrivée. | **Base de référence, non représentative** : le chrono final ne sert pas à calibrer le VDOT. Le segment continu 0–14 km à 6:00/km sert de plancher (VDOT ≈ 33). |

**Courses à venir**

| Course | Date | Distance | Priorité | Objectif |
|---|---|---|---|---|
| Semi de Paris | dim. 7 mars 2027 | 21,1 km | A | à fixer après le premier test |
| Semi de Madrid | dim. 4 avril 2027 (4 semaines après Paris) | 21,1 km | B | à fixer |
| 5 km · Île d'Arz | dim. 8 août 2027 (confirmé) | 5 km | A | **performance maximale** : pas de chrono cible, l'objectif est la projection du jour, à battre |

**Conséquences immédiates sur le plan**
- **Pause active au 16 sept.** : ongle de pied cassé, douloureux, pas de course tant que la douleur en marchant n'est pas nulle. Type « blessure », zone « pied », durée inconnue : la pause reste ouverte jusqu'à ce que Ronan marque la reprise dans l'app. Pendant la pause : muscu haut du corps autorisée, vélo et muscu jambes seulement si la chaussure ne fait pas mal, mobilité. Le plan (reprise, test, phases) est calé sur la **date de reprise**, pas sur une date fixe : tout ce qui suit est exprimé en semaines après reprise.
- Blessure du 13 sept. : douleur derrière le genou droit (creux poplité), **disparue depuis**. À la fin de la pause, le plan enchaîne sur une **reprise surveillée** de 3 semaines (60 → 80 → 100 % d'un volume de départ prudent, endurance seule la première semaine, pas de VMA avant la semaine 3), avec la zone « genou droit, face postérieure » pré-cochée dans le retour de séance. Toute douleur > 2/10 à cet endroit déclenche R5 immédiatement.
- Madrid n'est qu'à **4 semaines** de Paris : mini-cycle Récup 2 · Relance 1 · Affûtage 1. Madrid se court sur la forme de Paris, sans bloc de progression entre les deux.
- Aucun VDOT fiable : premier **test 20'** planifié en semaine 4 après la reprise ; les objectifs de Paris et Madrid se fixent à partir de ce test, pas avant. D'ici là, les allures d'entraînement se calculent depuis le plancher VDOT ≈ 33 (E ≈ 6:50 – 7:35, T ≈ 6:05, I ≈ 5:30) et seront revues à la hausse dès le test.
- Le 5 km d'août ajoute un **troisième cycle** après Madrid : Récup 2 · Base courte 4 · Vitesse 8 (VMA, répétitions, côtes) · Affûtage 1. La muscu y bascule en force-puissance et pliométrie. Voir § 5.

## 1. Principes non négociables

1. **Le moteur d'entraînement est déterministe et testé.** VDOT, allures, périodisation, charge, règles de recalcul : du code pur, sans LLM.
2. **Le LLM ne touche que trois choses** : traduire un texte libre en événements structurés (Imprévu), chercher une course sur le web, formuler des explications. Il ne voit jamais les données Strava brutes (CGU API Strava, mise à jour nov. 2024 : usage restreint dans des modèles d'IA).
3. **Rien n'est appliqué en silence.** Toute modification du plan est une *proposition* avec sa règle, acceptée ou refusée par l'utilisateur. Les refus et acceptations sont le signal d'apprentissage.
4. **Règles de sécurité > règles apprises.** Douleur, progression max, affûtage, reprise après pause ne peuvent pas être contournées par une habitude apprise.
5. **Mono-utilisateur, gratuit.** Pas de multi-tenant, pas de paiement, hébergement sur offres gratuites.
6. **Un vrai cockpit.** L'écran principal est hiérarchisé : instruments à lire, zone d'action, contexte. Tout le reste vit dans la barre latérale, un panneau latéral ou une fenêtre. On ne quitte le cockpit que pour planifier ou comprendre.

## 2. Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Nuxt 3** (Vue, TypeScript, `<script setup>`) + Nitro server routes | Même écosystème que ton quotidien ; front + API + cron dans un seul déploiement |
| UI | Tailwind + composants maison (design system des maquettes : Barlow Condensed / IBM Plex, tokens sombres) | Léger, pas de lib lourde |
| Desktop | Layout fixe 232 px de barre latérale + zone principale fluide (1208 px à 1440), pas de responsive mobile en v1 ; raccourcis clavier (⌘K imprévu, Échap ferme un panneau) | Le cockpit se lit sur grand écran ; le mobile sera une déclinaison ultérieure |
| DB | **Postgres** gratuit (Neon free tier) + **Drizzle ORM** + migrations Drizzle Kit | SQL typé, migrations versionnées, gratuit |
| Auth | `nuxt-auth-utils`, session cookie chiffrée, un seul compte protégé par mot de passe + secret d'environnement | Mono-utilisateur, zéro service externe |
| Hébergement | **Vercel Hobby** (usage personnel) | URL publique HTTPS requise par le callback OAuth et le webhook Strava ; cron quotidien inclus |
| Jobs | Vercel Cron (1/jour : forme du jour, revérification des dates de course, calibration) + webhook Strava pour le temps réel | Le Hobby n'autorise qu'un cron quotidien : suffisant |
| LLM | **Claude API** via `@anthropic-ai/sdk`, modèle `claude-opus-5`, thinking adaptatif, `output_config.format` pour du JSON strict, outil serveur `web_search_20260209` pour la recherche de course | Volume très faible (quelques appels/semaine), quelques centimes/mois |
| Tests | Vitest (moteur), Playwright (3 parcours critiques) | Le moteur porte la valeur : il doit être couvert |
| Qualité | ESLint + Prettier + `vue-tsc`, CI GitHub Actions | |

Coût cible : 0 € d'hébergement, < 2 €/mois de LLM. Si un jour tu veux te passer de Vercel, tout tient dans un conteneur Node.

## 3. Architecture (modules, dépendances vers l'intérieur)

```
server/
  domain/                 # pur, sans IO, 100 % testé
    races/                # course, priorité, objectif, profil
    fitness/              # VDOT, allures, projection, confiance
    plan/                 # périodisation, génération des semaines, placement des séances
    load/                 # sRPE, charge combinée, ratio 7j/21j découplé, monotonie
    rules/                # moteur de règles → propositions d'ajustement
    running/              # bibliothèque des séances course (types, structures, quotas), allures depuis fitness
    strength/             # bibliothèque muscu, phases, charge suivante
    cycling/              # séances vélo, conversion course→vélo
    readiness/            # forme du jour (Prêt / Vigilance / Repos)
    pause/                # gel + reprise progressive
    learning/             # détection d'habitudes, calibration, règles personnelles
    nutrition/            # repères g/kg par type de jour, protocole semaine de course, plan ravito + hydratation en course
  application/            # cas d'usage : orchestrent domain + repos + adapters
  infra/
    db/                   # Drizzle schema, repos
    strava/               # OAuth, import, webhook, rattachement
    llm/                  # client Claude, prompts, schémas de sortie
    search/               # recherche de course (LLM + web_search)
  api/                    # Nitro routes (REST minimal, JSON)
app/                      # pages Nuxt (desktop), coque (barre latérale, panneaux, ⌘K), composants, stores Pinia
```

Règle : `domain` n'importe rien de `infra`. Les cas d'usage reçoivent leurs dépendances (repos, clock, llm) en paramètres.

## 4. Modèle de données (Postgres)

- `athlete` (1 ligne) : poids, FCmax, jours dispo, contraintes (sortie longue le dimanche, lundi sans course…), préférences.
- `race` : nom, date, distance_m, priorité (A/B/C), `objective_mode` (temps | performance_max), objectif_s (nul en mode performance_max), profil (D+, type), météo attendue, source (manuel / recherche), statut (planifiée, courue, annulée), résultat_s, `representative` (bool : faux si le résultat ne reflète pas la forme, ex. blessure en course), `incident` (km, type, note).
- `race.fuel_plan` (jsonb, généré à J−7, modifiable) : glucides g/h, prises (km ou minute, produit), eau ml/h, sodium mg/h, caféine, consignes pré-départ ; `null` quand la course ne le justifie pas.
- `race_segment` : race, km_debut, km_fin, mode (course | marche_course | marche), allure_s_km, note. Optionnel : une course sans segment se lit comme avant, un seul chrono. Ajouté parce que la course de référence du 13 sept. n'est lisible qu'en segments.
- `race_lookup` : résultat brut de la recherche automatique par champ, statut (sûr / à confirmer / estimé), sources, dernière vérification.
- `fitness_point` : date, vdot, origine (course, test, import initial).
- `plan_version` : générée le, déclencheur (course ajoutée, pause, recalcul accepté…), paramètres ; immuable. Le plan actif = dernière version.
- `phase` : plan_version, type (base, développement, spécifique, affûtage, récup, relance, transition), semaine début/fin, cible volume.
- `week` : plan_version, numéro, dates, volume cible course (km), vélo (min), muscu (nb), allégée (bool).
- `session_type` : sport, code (EF, droites, SL, seuil, VMA, allure_semi, cotes, progressif, test, Z2, sweet_spot, force_cadence, push, pull, legs…), structure par défaut, quotas, phases autorisées, RPE attendu ; contenu des bibliothèques, modifiable.
- `session` : week, date, sport (course / vélo / muscu / autre), session_type, prescription JSON (structure, allures, séries), statut (prévue, faite, modifiée, sautée), origine (plan / imprévu / import).
- `activity` : import Strava (id externe, sport, date, durée, distance, allure, FC, puissance, D+), rattachée à `session` ou non.
- `feedback` : session, RPE, sensations[], sommeil_h, douleur (zone, intensité), notes.
- `strength_set` : session, exercice, série, reps, charge_kg, RPE.
- `load_daily` : date, UA course / vélo / muscu / autre, total (recalculé, cache).
- `proposal` : déclencheur, règle_id, cible (session / week), avant, après, explication, statut (proposée, acceptée, refusée, expirée), décidé le.
- `pause` : type, zone, douleur, début, fin estimée, autorisations (vélo, muscu haut, muscu jambes, course), fin réelle.
- `unplanned_event` : texte brut, interprétation JSON (activités, indisponibilités), statut (à confirmer, confirmée), propositions liées.
- `habit` : type, paramètres, preuve (n/N), confiance, statut (détectée, acceptée, refusée), règle personnelle générée.
- `calibration` : date, erreur RPE moyenne, taux d'acceptation, écart projection/résultat.
- `strava_token` : access, refresh, expiration (chiffrés au repos).

## 5. Moteur : algorithmes fixés

**VDOT (Daniels)** — à partir d'un résultat (distance d en m, temps t en min) :
`v = d / t` (m/min), `VO2 = -4.60 + 0.182258·v + 0.000104·v²`,
`%VO2max = 0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)`, `VDOT = VO2 / %VO2max`.
Allures d'entraînement : inverser la relation pour E (59–74 % VDOT), M (75–84), T (83–88), I (95–100), R. Projection sur une distance : résoudre `t` tel que VDOT(d, t) = VDOT courant (Newton). Tests unitaires sur la table Daniels (ex. VDOT 44 → semi 1:42:17, VDOT 45,4 → ≈ 1:39:35).

**Mise à jour du VDOT** — uniquement course ou test (priorité C ou test 20' contrôlé). Une course `representative = faux` ne met pas à jour le VDOT : son meilleur segment continu (≥ 10 km) donne un **plancher** (VDOT minimal), affiché comme tel jusqu'au premier test. Les ressentis de séance peuvent le *baisser* (2 séances clés d'affilée à RPE ≥ prévu + 1 et allure non tenue → −0,3), jamais le monter.

**Projection jour J** — VDOT courant + gain attendu du bloc restant (plafonné à +0,4 VDOT / 8 semaines, réduit par les pauses) ; intervalle ± dérivé de la variabilité des tests ; ajustement course : dénivelé (+0,5 s / m de D+ net), chaleur (+1,5 %/°C au-dessus de 18 °C, si météo attendue connue). **Confiance** = probabilité que la borne basse de la projection ≤ objectif, arrondie aux 2 %.

**Charge** — `UA = RPE × durée_min` pour toute activité (course, vélo, muscu, imprévu). Ratio = charge 7 derniers jours / moyenne hebdo des 21 jours précédents (découplé). Affiché comme repère (0,8–1,3), jamais décisionnel seul. Indisponible tant que < 28 jours d'historique (l'import Strava initial le fournit dès le premier jour).

**Périodisation** — depuis la course A : rétro-planning Affûtage 2 · Spécifique 7 · Développement 8 · Base = reste (min 4). Course B à ≤ 8 semaines après A : Récup 2 · Relance N−3 · Aff 1 (Madrid à 4 semaines : Récup 2 · Relance 1 · Aff 1). Course B avant A : intégrée comme séance test à allure contrôlée ou remplace la sortie longue. Course C : remplace la séance clé de la semaine, recale le VDOT. **Course A sur 5 km** (ou 10 km) : cycle Récup 2 · Base courte 4 · Vitesse 8 (2 séances clés : VMA + répétitions courtes / côtes, sortie longue ramenée à 60–75') · Affûtage 1 ; muscu en force-puissance et pliométrie. **Mode performance maximale** : l'objectif affiché est la projection du jour ; la confiance devient « probabilité de faire mieux que la dernière référence ». Blocs de 4 semaines : 3 en montée (+≤ 10 %/sem), 1 allégée (−30 %). Sortie longue ≤ 30 % du volume hebdo.

**Semaine type** — générée à partir des contraintes : jours durs groupés, muscu le soir des jours durs (course d'abord, ≥ 6 h), vélo Z2 le lendemain d'une séance clé, lundi facile. 2 vélos en base, 1 ensuite, vélo ≤ 30 % de la charge en spécifique. Muscu : phases (adaptation 3 sem → force → force-puissance + plio → entretien −30 % → stop J−7). Nordic en progression 1×4 → 3×8 sur 6 semaines.

**Règles de recalcul (v1, chacune = id, condition, effet, explication)**
- R1 séance clé RPE ≥ prévu+1 → muscu du soir −1 série, sans excentrique lourd.
- R2 2 signaux de fatigue actifs (RPE +, jambes lourdes, sommeil < 6 h) → séances faciles −30 %, ≤ 70 % FCmax ; sortie longue suivante −10 %.
- R3 nuit < 6 h → prochaine séance clé : −1 répétition si une 2e nuit < 6 h ; allure inchangée.
- R4 signal de fatigue actif → progression du bloc gelée (maintien).
- R5 douleur > 3/10 sur 2 séances → proposition de pause ; douleur ≥ 4/10 → pause imposée pour la course, conversions vélo si indolore.
- R6 séance sautée → pas de rattrapage ; une séance clé sautée est replacée uniquement si ≥ 48 h avec la suivante.
- R7 (inverse) 2 séances clés d'affilée au RPE prévu ou en dessous, allures tenues → progression restaurée, séance réduite rétablie.
- R8 course → vélo : à charge égale (UA ± 10 %), sweet spot seulement sur douleur, jamais la sortie longue sauf douleur.
Les règles apprises (habitudes acceptées) s'ajoutent comme R100+ avec un poids, et ne peuvent que déplacer / adoucir, jamais dépasser une règle R1–R8.

**Forme du jour** — score 0–100 : sommeil déclaré (35 %), RPE vs prévu sur 3 dernières séances (30 %), sensations (20 %), ratio de charge (15 %). Prêt ≥ 65, Vigilance 40–64, Repos < 40 ; texte de suggestion produit par templates (pas de LLM).

**Ravito et hydratation en course** — généré à J−7 pour chaque course, seulement quand c'est nécessaire, à partir de la durée projetée et de la météo attendue :
- < 60' (5 km, 10 km rapide) : rien pendant la course ; pré-départ seulement (glucides 1–2 g/kg 2–3 h avant, 300–500 ml d'eau, caféine optionnelle 3 mg/kg à −45').
- 60–90' : eau aux ravitos (150–250 ml toutes les 20'), 1 gel optionnel à mi-course.
- > 90' (semi à l'allure actuelle, marathon) : 30–60 g de glucides / h dès la 20e minute, en prises régulières (gel 20–25 g toutes les 25–30' ou boisson), eau 400–800 ml / h selon la chaleur, sodium 300–600 mg / h si > 20 °C ou sueur salée, caféine optionnelle.
- Le plan liste les prises par km à l'allure projetée, calées sur les ravitos officiels quand ils sont connus (recherche de course), et rappelle que chaque produit doit avoir été testé en sortie longue. Ajustement automatique si la météo attendue change ; l'athlète peut modifier chaque prise.

**Pause** — gèle les semaines couvertes ; conserve les activités autorisées ; reprise 60 % → 80 % → 100 % sans séance clé la première semaine ; régénère une `plan_version` ; recalcule projection et confiance ; met en pause la muscu jambes si blessure basse.

**Apprentissage (v1, statistique, sans ML)** — détecteurs : glissement de jour (séance X déplacée vers Y ≥ 60 % sur ≥ 8 occurrences), créneau jamais honoré (0/≥ 8), biais RPE par type de séance (moyenne écart sur ≥ 6), sensibilité au sommeil (RPE +≥1 quand sommeil < 6 h, ≥ 5 cas), refus systématique d'une famille de propositions (≥ 70 % sur ≥ 5). Chaque détection → `habit` (confiance = n/N pondéré) → l'utilisateur accepte → règle personnelle paramétrée. Calibration hebdo : erreur RPE, taux d'acceptation, écart projection/résultat aux tests.

## 6. LLM : périmètre et contrats

- **Imprévu** : entrée = texte libre + contexte minimal (date du jour, jours de la semaine, séances *prévues* — jamais les activités Strava). Sortie JSON strict (`output_config.format`) : `[{kind: "activity", sport, date, duration_min, rpe_estimate, intensity_profile}] + [{kind: "unavailability", from, to, scope}]`. Le moteur déterministe génère ensuite les propositions. Un appel, `claude-opus-5`, thinking adaptatif, effort `low`.
- **Recherche de course** : entrée = nom tapé ; outil serveur `web_search_20260209` (max 5 usages) ; sortie JSON par champ `{value, status: sûr|à_confirmer|estimé, sources[]}`. Revérification mensuelle de la date par le cron jusqu'à ouverture des inscriptions. Aucune donnée personnelle envoyée.
- **Explications** (optionnel, v2) : reformuler une proposition en phrase naturelle à partir de la règle et des valeurs, sans données Strava.
- Toute sortie LLM est validée par schéma avant usage ; en cas d'échec, l'écran demande une correction manuelle.
- Si tu veux réduire encore le coût, `claude-haiku-4-5` suffit pour l'Imprévu ; c'est ta décision, la valeur par défaut reste `claude-opus-5`.

## 7. Intégration Strava

1. App déclarée sur strava.com/settings/api (mono-athlète, callback `https://<app>/api/strava/callback`).
2. OAuth2 : `read,activity:read_all` ; stockage chiffré access/refresh ; refresh automatique avant expiration.
3. Import initial : 24 mois d'activités (pagination 200/page) → `activity` + `load_daily` + points de forme depuis les courses officielles (type Race) → charge chronique disponible dès le premier jour.
4. Webhook : abonnement `create/update/delete` sur `/api/strava/webhook` (validation du challenge) ; à chaque `create`, fetch de l'activité puis **rattachement** : même sport à ± 1 jour d'une `session` prévue → statut « faite », prescription vs réalisé pré-remplis, notification « il reste le ressenti » ; sinon → `unplanned_event` avec charge estimée (RPE déduit de la FC si dispo, sinon 5) à confirmer.
5. Limites : 200 req / 15 min, 2 000 / jour ; un athlète en consomme < 50 / jour. Suppression côté Strava → suppression locale.
6. Montres (Garmin, Apple Watch, Coros) : rien à faire, elles passent par Strava.

## 8. Écrans et navigation (desktop)

**Coque commune** : barre latérale 232 px en quatre groupes, barre du haut (fil d'Ariane + date / semaine / phase, champ Imprévu ⌘K, bouton Pause / blessure, cloche des propositions), zone principale.

| Groupe | Entrée | Rôle |
|---|---|---|
| Piloter | **Cockpit** | écran principal, quotidien |
| | **Semaine** | bloc de 4 semaines, déplacement de séances |
| | Propositions | même liste que « À décider », historique des décisions |
| Objectifs | Courses | la seule entrée qui pilote le plan : table + périodisation ; « Nouvelle course » en fenêtre |
| Bibliothèques | Course à pied · Muscu · Vélo · Nutrition | le contenu où le générateur pioche : types de séances, exercices, repères ; chaque page montre aussi la prescription du jour |
| Comprendre | **Progression** · Apprentissage | Progression : forme et projection dans le temps, volume et charge par semaine, adhérence, calibration du ressenti, charges muscu, récupération, journal des séances clés filtrable. Lecture seule. Apprentissage : habitudes, règles personnelles |
| Réglages | Connexions · Profil | Strava, contraintes perso, poids, FCmax |

Une bibliothèque n'est pas un plan : on y consulte et on y ajuste le contenu (charges, variantes, allures), on n'y programme rien. La bibliothèque course à pied contient neuf types de séances (endurance, lignes droites et éducatifs, sortie longue, seuil, VMA, allure semi, côtes courtes, progressif, test) avec structure, allure dérivée du VDOT, RPE attendu, place dans le plan et quota (I ≤ 8 %, T ≤ 10 %, sortie longue ≤ 30 % du volume).

**Cockpit (écran principal), trois niveaux dans l'ordre de lecture**
1. Instruments (4 cadrans, lecture seule) : course A (J−, objectif, projection ± intervalle, confiance, prochain test) · forme du jour (état, causes, suggestion pour demain) · charge combinée (ratio, avancement course / vélo / muscu) · VDOT (valeur, tendance, allures E / T / I).
2. Zone d'action : **Aujourd'hui** (séances du jour, réalisé Strava vs prévu, une seule action par ligne : compléter le ressenti / ouvrir la séance ; ligne « demain ») et **À décider** (propositions, une case par ligne, règle affichée, « Appliquer n »).
3. Contexte : semaine en cours sur 7 colonnes, frise de saison.

**Panneaux latéraux** (par-dessus le cockpit, Échap ferme) : Retour de séance, Imprévu (⌘K), Pause / blessure, détail des propositions. **Fenêtre** : Nouvelle course (recherche automatique à gauche, formulaire pré-rempli à droite).

Règles d'ergonomie : une action principale par ligne, jamais deux boutons pleins côte à côte ; toute valeur proposée affiche l'ancienne barrée ; les nombres en police mono alignée ; aucun écran secondaire n'est nécessaire pour la routine séance → ressenti → décision.

## 9. Phases de livraison

Chaque phase est déployable et utilisable seule. « Fini » = tests verts, `vue-tsc` vert, lint vert, parcours vérifié sur téléphone.

**P0 — Socle (1 soirée)** ✅ livré
Repo, Nuxt + TS strict, Tailwind, tokens du design, Drizzle + Neon, auth mono-utilisateur, déploiement Vercel, CI, **coque desktop** (barre latérale, barre du haut, zone principale, système de panneaux latéraux et fenêtres, ⌘K). Livrable : coque en ligne et protégée, navigation entre pages vides, un panneau qui s'ouvre et se ferme.

**P1 — Courses, forme, plan (cœur déterministe)**
`races`, `fitness`, `running` (bibliothèque des 9 types de séances et quotas), `plan` avec tests unitaires (table Daniels, rétro-planning, blocs 4 semaines, semaine type, quotas respectés). Écrans : Courses, fenêtre Nouvelle course (manuelle), page Course à pied, Semaine, Cockpit v1 (cadran course, cadran VDOT, Aujourd'hui avec la séance prévue, semaine, cap). Saisie manuelle d'un résultat de course pour initialiser le VDOT, avec segments et incident. Seed des données réelles du § 0 (semi du 13 sept. en segments, Paris, Madrid, 5 km Île d'Arz). Livrable : le cockpit affiche la pause en cours, la reprise, puis le plan complet jusqu'au 5 km d'août, avec les objectifs de Paris et Madrid marqués « à fixer après le test ».

**P2 — Strava + retour de séance + charge**
OAuth, import 24 mois, webhook, rattachement, panneau Retour de séance (RPE, sensations, sommeil, douleur), `load`, cadran charge, réalisé Strava dans « Aujourd'hui ». Livrable : une sortie faite avec la montre apparaît « faite » dans les 2 minutes dans le cockpit, tu ajoutes le ressenti en 20 s sans quitter l'écran.

**P3 — Recalcul + forme du jour**
`rules` R1–R8, `proposal`, panneau « À décider » dans le cockpit + panneau détail, `readiness` et cadran forme du jour, cloche, cron quotidien. Page Progression v1 : courbe VDOT avec courses et tests, projection avec intervalle, volume et charge par semaine, adhérence, journal des séances clés. Livrable : la boucle complète séance → ressenti → propositions → plan ajusté, entièrement depuis le cockpit, et une vue qui montre si ça progresse.

**P4 — Muscu + vélo**
Bibliothèque d'exercices et de séances (données des maquettes), phases, placement dans la semaine, saisie séries/reps/charges en panneau, charge suivante, conversion course→vélo, pages Muscu et Vélo. Livrable : les 3 muscu et le vélo apparaissent dans « Aujourd'hui » et la semaine, et comptent dans la charge.

**P5 — Imprévu, pause, recherche de course**
Client Claude, ⌘K Imprévu → propositions ; panneau Pause + reprise progressive + régénération ; fenêtre Nouvelle course avec recherche (statuts et sources), revérification mensuelle. Livrable : « 1 h de squash, pas dispo vendredi » réorganise la semaine ; une blessure d'une semaine produit un plan de reprise ; « semi madrid 2027 » pré-remplit le formulaire.

**P6 — Apprentissage + nutrition**
Détecteurs d'habitudes, page Apprentissage, calibration hebdo, règles personnelles R100+ ; Progression v2 (calibration du ressenti, charges muscu, récupération, filtres de période) ; page Nutrition (repères par type de jour, ravito d'entraînement, protocole J−7, **plan ravito + hydratation en course** généré par course, affiché sur la fiche de la course et dans le cockpit la semaine de course) et rappel nutrition dans la ligne « demain » du cockpit. Livrable : premières habitudes proposées après ~8 semaines de données ; protocole nutrition généré à J−7 de la course A.

**P7 — Confort**
Notifications navigateur (ressenti manquant, proposition en attente), bilan hebdo du dimanche généré depuis Progression, export CSV, kilométrage chaussures. Ensuite, si besoin : déclinaison mobile (même app, cockpit empilé), PWA.

Ordre de valeur si le temps manque : P0 → P1 → P2 → P3. Le reste est additif.

## 10. Tests

- `domain/*` : Vitest, cas nominaux + limites (table Daniels, semaine allégée, course B avant A, pause en affûtage, ratio sans historique). Objectif : chaque règle R1–R8 a un test « déclenche » et un test « ne déclenche pas ».
- `infra/strava` : tests d'intégration contre des fixtures JSON réelles anonymisées (une activité course, une vélo, un webhook create).
- `infra/llm` : tests de contrat sur des sorties enregistrées (pas d'appel réseau en CI) + 1 test live manuel.
- Playwright (desktop 1440×900) : login → ajouter une course → voir le plan ; retour de séance en panneau → proposition dans « À décider » → appliquer ; ⌘K imprévu → semaine régénérée.

## 11. Risques et parades

| Risque | Parade |
|---|---|
| CGU API Strava sur l'IA | Données Strava jamais envoyées au LLM ; moteur déterministe ; app mono-utilisateur |
| Webhook Strava exige une URL publique stable | Vercel dès P0 ; en local, tunnel (cloudflared) uniquement pour tester |
| Cron Hobby limité à 1/jour | Tout le temps réel passe par le webhook ; le cron ne fait que forme du jour, rappels, revérifications |
| Sur-ajustement : le recalcul ne fait que baisser | R7 inverse dès P3 ; calibration affichée |
| Dette de « données d'exemple » des maquettes | Aucune valeur en dur : tout vient de `athlete`, `race`, `fitness_point` |
| Le cockpit se remplit et perd sa hiérarchie | Règle : un nouvel élément sur l'écran principal doit remplacer ou rétrograder un existant ; sinon il va dans une page ou un panneau |
| Confiance excessive dans la projection | Toujours affichée avec son intervalle et la date du prochain test |

## 12. Décisions à prendre avant P0

1. Nom du projet et domaine Vercel.
2. Nuxt confirmé (sinon Next/React, même plan).
3. Modèle LLM par défaut : `claude-opus-5` (qualité) ou `claude-haiku-4-5` (coût) pour l'Imprévu.
4. Poids, FCmax, jours disponibles, contraintes : les valeurs de `athlete` du premier écran d'onboarding.
5. La date de reprise de la course à pied, à marquer dans l'app quand l'ongle ne fait plus mal en marchant. (Le 8 août, la blessure du genou et les dates de Paris / Madrid sont renseignés au § 0.)
