# Cockpit d'entraînement — plan d'implémentation

Projet personnel, indépendant de bonx-next. Web **desktop** (largeur cible 1440, minimum 1280), gratuit. Une seule connexion externe : Strava. Le mobile viendra plus tard, en vue réduite de la même app.
Application déployée : https://cockpit-semi.vercel.app
Maquettes de référence (v5, desktop) : https://claude.ai/artifact/GHF88CMB93rHvF8xQfaYDA (sources dans `~/Documents/dev/cockpit-semi-design`, générateur `build_desktop.py`).

## État d'avancement et consigne aux agents

**Où on en est (16 sept. 2026)** : P0, P0.5, P1 et P2 livrés (dernier commit `38abb52` « P2 — réalisé, retour de séance, charge » ; Strava abandonné, voir la décision dans le bloc P2). Nuxt 4 + Tailwind 4 + Pinia + nuxt-auth-utils + Drizzle/Neon, coque desktop complète, moteur `fitness` / `running` / `plan` / `load` / `matching` testé, seed des données réelles du § 0, écrans Courses, Profil, Semaine, Course à pied, Connexions et Cockpit avec réalisé, retour de séance et charge. Une revue d'entraîneur du plan généré (16 sept.) a relevé des défauts du moteur course, corrigés dans la brique **P1.5** (livrée). P3, P3.5, P3.6, P4 et P5 livrés, les trois parcours de P5 vérifiés dans le navigateur. La semaine porte ses quatre courses, ses trois musculations et sa sortie vélo ; l'Imprévu, la déclaration de pause et la recherche de course tournent sur `claude-sonnet-5` en effort `low` (§ 6). Les briques P5.6, P5.7 et P5.8 sont écrites et en attente. Suivent **P5.6** (placement vélo et lendemain de sortie longue), puis **P5.7** (identité : âge, profil physique, avatar), **P5.8** (tuiles pleine largeur et tuiles ouvrantes) et **P5.9** (séances de muscu réelles et temps de récupération), décidées avec Ronan le 16 sept. 2026.

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
- [x] Fini : tests domaine verts, parcours « onboarding → courses → plan généré → cockpit affiche la séance du jour » vérifié, commit « P1 — courses, forme, plan ».

P1.5 — Corrections du moteur course (revue d'entraîneur du 16 sept., règles fixées au § 5)
- [x] `fitness` : allure E affichée à 70 % du VDOT (fourchette 59–74 % conservée pour l'affichage en plage) ; tests contre la table Daniels autour du plancher : VDOT 30 → 5 km 30:41, semi 2:21:17, E 7:39, T 6:24, I 5:54 ; VDOT 35 → 5 km 26:59, semi 2:04:13, E 6:48, T 5:40, I 5:13 (± 2 s).
- [x] `running` : budget des séances de qualité calculé sur la portion intense seule (échauffement et retour au calme hors budget) ; progression des séances clés au fil de la phase (seuil 2×8' → 3×8' → 20' continu ; VMA 4×800 → 6×800 → 5×1000) indexée sur la position dans la phase ; allure semi dérivée de `raceTimeForVdot(vdot, 21 097,5)` et non de la zone M ; côtes prescrites en durée et en effort (RPE), sans allure. Tests : seuil à 55 km/sem ≥ 4 km de qualité ; allure semi au VDOT 33 ≈ 6:10/km ; progression strictement croissante dans une phase.
- [x] `plan` : reprise 60/80/100 % appliquée à un volume de départ fixe, progression de bloc gelée pendant les 3 semaines de reprise ; compteur de bloc réinitialisé à chaque cycle, phases affûtage / récup / relance hors rythme de bloc (affûtage 2 semaines : 70 % puis 50 % du dernier volume plein, jamais croissant) ; jour de course sans séance et lendemain de course A en repos ; séances clés par phase selon le profil : base et développement = sortie longue + 1 clé, spécifique et vitesse = sortie longue + 2 clés ; lignes droites interdites avant la semaine 3 de reprise et en récup ; cycle 5 km : sortie longue bornée à 75' à l'allure E ; test 20' placé en semaine 4 après la reprise puis toutes les 6 semaines hors affûtage et récup, en remplacement de la séance clé du milieu de semaine. Tests : montée de reprise ≤ +10 %/sem après la semaine 1 ; affûtage Paris décroissant ; aucune séance le 7 mars, le 4 avril, le 8 août ; test présent en semaine 4 de reprise ; ≤ 2 clés hors sortie longue.
- [x] `plan` : pause ouverte sans date de reprise estimée → le plan est généré en semaines non datées (phases et volumes seulement, `startDate` nul) et aucune séance n'est posée ; la page Semaine et le cockpit affichent « en attente de la reprise ». Les séances apparaissent à la régénération `Resume`.
- [x] `application` : volume de départ et pic lus depuis `athlete` (`startWeeklyVolumeM`, `peakWeeklyVolumeM`, saisis dans Profil, défauts 20 km et 45 km) au lieu des constantes ; cas d'usage « enregistrer un test 20' » qui crée un `fitness_point` (origine test, non plancher), met à jour le VDOT courant, et régénère le plan (`PlanTrigger.TestRecorded`).
- [x] UI : Profil expose volume de départ et pic ; Course à pied affiche E en plage et les allures E / M / T / I / R recalculées ; cadran VDOT affiche « prochain test » à partir du plan ; saisie de la distance du test 20' dans le panneau Retour de séance de P2 (ou un champ minimal si P2 n'est pas encore branché).
- [x] Seed rejoué (`pnpm db:seed`) et plan régénéré ; vérifier dans le navigateur : semaines de reprise 60/80/100 sur base fixe, test en semaine 4, affûtage décroissant, jours de course vides.
- [x] Fini : lint, typecheck, tests, build verts ; mettre à jour § 0 si les allures changent ; commit « P1.5 — corrections du moteur course ».

P2 — Réalisé, retour de séance et charge

**Décision du 16 sept. 2026 : Strava est abandonné.** L'accès à l'API est désormais réservé aux abonnés payants (« L'accès à l'API Strava est réservé aux abonné(e)s », constaté sur `strava.com/settings/api` avec un compte gratuit). Le § 7 devient caduc : plus d'OAuth, plus d'import automatique, plus de webhook. Le réalisé se saisit à la main, ce qui ne coûte que quelques secondes par séance puisque la prescription est déjà à l'écran. Conséquence : le ratio de charge reste indisponible les 28 premiers jours, au lieu d'être fourni d'emblée par l'import.

- [x] `server/domain/load` : `UA = RPE × durée_min`, charge quotidienne par sport, ratio 7 j / 21 j découplé, monotonie, indisponible tant que < 28 jours d'historique (§ 5).
- [x] `server/domain/matching` : rattachement d'une activité à une séance prévue (même sport à ± 1 jour), RPE déduit de la FC. Sert à l'import de fichier et aux activités hors plan.
- [x] Schéma : `activity`, `feedback`, `load_daily`.
- [x] Retirer `strava_token` du schéma : la table est morte.
- [x] Marquer une séance faite depuis le cockpit, avec réalisé saisi (durée, distance) pré-rempli par la prescription.
- [x] Panneau Retour de séance : RPE, sensations, sommeil, douleur avec les zones à surveiller de la pause pré-cochées ; prescription vs réalisé côte à côte.
- [x] Recalcul de `load_daily` à chaque enregistrement, cadran charge combinée dans le cockpit (ratio, zone de référence, avancement par sport).
- [x] UI Connexions : indiquer qu'aucune connexion externe n'est active, pourquoi, et ce que ça change.
- [x] Fini : tests verts, parcours « séance du jour → marquée faite → ressenti saisi → charge à jour » vérifié, commit « P2 — réalisé, retour de séance, charge ».

P3 — Recalcul, forme du jour et progression
- [x] `server/domain/rules` : R1 à R8 du § 5, chacune avec id, condition, effet et explication ; sortie = propositions typées, jamais d'application directe. Tests : chaque règle a un cas « déclenche » et un cas « ne déclenche pas » (§ 10).
- [x] `server/domain/readiness` : score 0–100 (sommeil 35 %, RPE vs prévu sur 3 séances 30 %, sensations 20 %, ratio de charge 15 %), seuils Prêt ≥ 65 / Vigilance 40–64 / Repos < 40, suggestion par templates. Tests des trois états et du score sans données.
- [x] Schéma : `proposal` (déclencheur, règle, cible, avant, après, explication, statut, décidé le). Migration.
- [x] `application` : évaluation des règles après chaque ressenti et à la régénération ; acceptation d'une proposition l'applique et régénère le plan ; refus l'archive. Les refus et acceptations sont le signal d'apprentissage (§ 1.3).
- [x] Cockpit : cadran forme du jour (état, causes, suggestion pour demain) et zone « À décider » avec une case par ligne, la règle affichée, l'ancienne valeur barrée et « Appliquer n ».
- [x] Panneau détail d'une proposition + cloche de la barre du haut avec le nombre en attente ; page Propositions avec l'historique des décisions.
- [x] Page Progression v1 : courbe VDOT avec courses et tests, projection avec intervalle, volume et charge par semaine, adhérence, journal des séances clés filtrable. Lecture seule.
- [x] Cron quotidien Vercel : forme du jour pré-calculée, rappel de ressenti manquant, expiration des propositions. Précision ± 59 min assumée, la forme se recalcule à la demande à l'ouverture.
- [x] Fini : lint, typecheck, tests, build verts ; parcours « ressenti dur → proposition → acceptée → plan ajusté » vérifié ; commit « P3 — recalcul, forme du jour, progression ».

P3.5 — Seed de dev daté et horloge simulée

Le seed actuel pose l'état réel du 16 sept. : pause ouverte, aucune séance faite, donc pas de charge, pas de forme du jour, pas de courbe de progression et aucune règle qui déclenche. Pour visualiser et tester réellement ces fonctionnalités, il faut pouvoir se placer à une date future avec un historique cohérent, produit par le moteur lui-même à partir d'une progression estimée, et non par des inserts inventés.

- [x] Horloge : `systemClock` (`server/utils/context.ts`) lit `NUXT_COCKPIT_TODAY` (date ISO) quand elle est définie, sinon la date réelle. Variable réservée au local, jamais définie sur Vercel (le noter dans `.env.example`) ; le seed et `pnpm dev` la partagent pour voir le cockpit au jour simulé. Test : l'horloge retourne la date forcée.
- [x] `application` : extraire l'enregistrement d'un ressenti (`recordFeedback` : ressenti, statut fait, réalisé, recalcul de `load_daily`, évaluation des règles) de `server/api/sessions/[id]/feedback.put.ts`, et la reprise de pause (`resumePause`) de `server/api/pause/resume.post.ts`, vers `server/application/`, avec l'horloge en paramètre. Les routes et le seed passent par le même code : le seed ne fait aucun insert brut d'`activity`, `feedback`, `load_daily`, `fitness_point` de test ni `proposal`.
- [x] Simulation : `pnpm db:seed --scenario=<nom>` rejoue jour par jour du 16 sept. au jour simulé. Reprise à la date du scénario (`resumePause` avec l'horloge à cette date, plan `Resume`), puis pour chaque séance planifiée passée : réalisé = prescription ± 5 %, RPE = RPE attendu ± 1, sommeil 6,5–8 h, sensations cohérentes avec l'écart de RPE, douleur « genou droit, face postérieure » qui décroît de 3 à 0 sur les 3 semaines de reprise ; environ 10 % de séances manquées (statut manquée, sans ressenti) ; chaque test 20' planifié enregistré via `recordTest` avec la distance déduite du VDOT visé (progression estimée : +0,6 VDOT par test, paramètre du scénario), ce qui régénère le plan comme dans l'app ; dans la dernière semaine du scénario, deux séances clés d'affilée à RPE prévu + 2 pour qu'au moins une règle déclenche. Générateur pseudo-aléatoire seedé : deux exécutions produisent exactement les mêmes données.
- [x] Scénarios, chacun fixe la date de reprise, le jour simulé et la graine : `pause` (défaut, état réel actuel, identique au seed d'aujourd'hui) ; `reprise-s2` (reprise le 28 sept., jour simulé 8 oct. : deux semaines de réalisé, ratio de charge encore indisponible, forme du jour calculable) ; `bloc-2` (jour simulé 22 nov. : test de semaine 4 fait, ratio disponible, deux points VDOT) ; `affutage-paris` (jour simulé 1er mars 2027 : quatre tests, semaine d'affûtage à 70 %, Madrid à 5 semaines). Le scénario affiche en fin d'exécution la `NUXT_COCKPIT_TODAY` à exporter avant `pnpm dev`.
- [x] Fini : lint, typecheck, tests (générateur déterministe ; réalisé et RPE dans les bornes ; VDOT strictement croissant d'un test au suivant) et build verts ; `pnpm db:seed --scenario=bloc-2` puis `pnpm dev` au jour simulé : cockpit avec la séance du jour, la charge disponible et la semaine courante avec ses séances faites et manquées, table `proposal` non vide ; cadran forme du jour, « À décider » et Progression garnis ; commit « P3.5 — seed daté et horloge simulée ».

P3.6 — Semaine type à nombre de courses borné (revue d'entraîneur du 16 sept., règles au § 5 « Semaine type »)

Le générateur pose une séance sur chaque jour disponible : six jours déclarés donnent six courses, dont quatre endurances de 4 km qui n'entraînent rien et suppriment tout jour de repos. La semaine type doit compter un **nombre de courses par phase**, indépendant des jours disponibles, et le volume se concentrer sur peu de séances qui ont chacune un rôle.

- [x] `athlete` : `constraints.runsPerWeek` optionnel (2 à 6) ; sans valeur, le nombre par défaut de la phase s'applique (§ 5). Profil expose le champ à côté des jours disponibles, avec le texte « les jours disponibles disent où courir, pas combien ». Migration si le jsonb ne suffit pas (il suffit).
- [x] `plan/week-template` : la semaine reçoit un nombre de courses `runs = min(runsPerWeek ?? défaut de phase, jours disponibles non bloqués)` et ne pose que ce nombre de séances. Ordre de pose : sortie longue sur son jour ; séances clés sur les jours durs espacés d'au moins un jour ; endurances sur les jours restants en privilégiant un jour de repos après la sortie longue et après chaque séance clé ; les jours disponibles non retenus restent vides. Lignes droites : intégrées à une endurance (6 × 100 m en fin de séance), plus jamais une séance à part. Tests : reprise = 3 courses ; base = 4 dont 1 progressif ; développement = 4 dont 1 qualité ; spécifique = 4 dont seuil et sortie longue avec portion à allure semi ; affûtage = 3 ; jamais deux séances clés consécutives ; au moins un jour vide après la sortie longue quand `runs < jours disponibles`.
- [x] `plan/week-template` : allure semi en spécifique posée **dans** la sortie longue (dernier tiers à allure semi, borné par le quota 20 % de qualité) et non en séance séparée ; la deuxième séance clé du spécifique redevient le seuil. Test : aucune séance `allure_semi` isolée ; la sortie longue de spécifique contient une étape `intense`.
- [x] `running/prescription` : endurance bornée en durée, minimum 35' et maximum 75' à l'allure E ; si le volume hebdo dépasse ce que `runs` séances peuvent porter dans ces bornes, la sortie longue absorbe jusqu'à son quota, puis le volume cible est réduit et la semaine porte un indicateur `volumeCapped`. Tests : endurance ≥ 35' à VDOT 33 ; volume hebdo jamais dépassé de plus de 15 %.
- [x] `plan/weeks` : `runsPerWeek` par défaut porté par la phase (reprise 3, base 4, base courte 4, développement 4, spécifique 4, vitesse 4, relance 3, affûtage 3, récup 2) ; exposé dans `PlanWeek.runs` pour la page Semaine.
- [x] Seed et scénarios P3.5 rejoués : les scénarios simulent le réalisé sur les séances effectivement planifiées, donc rien à changer sauf les assertions de nombre de séances ; vérifier dans le navigateur au scénario `bloc-2` : semaine à 4 courses avec deux jours vides, sortie longue dimanche, qualité mardi ou mercredi, endurances 35' à 75'.
- [x] Fini : lint, typecheck, tests, build verts ; § 5 « Semaine type » relu ; commit « P3.6 — semaine type à nombre de courses borné ».

P4 — Muscu et vélo dans le plan

P3.6 a laissé des jours vides dans la semaine : c'est là que se posent la musculation et le vélo. Les deux sports existent déjà dans le schéma (`session.sport`, `load_daily`) et dans l'UI (icône par sport dans « Aujourd'hui » et la semaine) ; il manque leurs bibliothèques, leur placement et la saisie des charges.

- [x] `server/domain/shared/prescription.ts` : extraire `PrescriptionStep` et `Prescription` de `running/session-types.ts` (code en `string`, distances nulles autorisées) et y placer `prescribedDurationS`, pour que les trois sports partagent la même structure de séance. `running` les réexporte : aucun import existant ne change.
- [x] `server/domain/strength` : bibliothèque des exercices des maquettes (Legs, Push, Pull, bloc prévention) avec séries, répétitions, apport (course / vélo / prévention) et note ; phases muscu (adaptation 3 sem → force → force-puissance + plio → entretien −30 % → légère en affûtage → mobilité en récup) dérivées de la phase du plan ; `strengthPrescription(code, phase, semaine)` ; progression du Nordic 1×4 → 3×8 sur 6 semaines ; `nextLoadKg` (charge suivante : toutes les séries au format et RPE ≤ 8 → +2,5 kg haut / +5 kg bas, format manqué ou RPE ≥ 9 → charge tenue, très en dessous → −5 %). Tests : 3 séances en base et développement, 2 en spécifique et relance, 1 en affûtage, 0 en transition ; Nordic croissant ; charge suivante dans les trois cas.
- [x] `server/domain/cycling` : les quatre séances des maquettes (endurance Z2, sortie longue vélo, force basse cadence, sweet spot) avec durée, % FTP, RPE attendu et phases autorisées ; `cyclingPrescription(code, durée)` ; la conversion course → vélo à charge égale (R8) déménage de `rules/convert.ts` vers `cycling/convert.ts`, `rules` l'importe. Tests : conversion à ± 10 % d'UA ; sweet spot jamais plaçable par le générateur (douleur seulement) ; durée Z2 bornée 75′–120′.
- [x] `server/domain/plan/week-support.ts` : pose les séances vélo et muscu sur la semaine une fois les courses placées. Muscu le soir des jours durs (Legs sur un jour de séance clé hors sortie longue, jamais la veille de la sortie longue ni d'une séance clé ; haut du corps sur les autres jours) ; vélo uniquement sur les jours sans course, en privilégiant le lendemain d'une séance clé ; nombre par phase (muscu : base, base courte, développement et vitesse 3, spécifique et relance 2, affûtage 1, récup 2, transition 0 ; vélo : base et base courte 2, développement, spécifique, vitesse, relance et récup 1, affûtage et transition 0) ; muscu coupée les 7 jours avant une course A ; Legs retiré quand une pause interdit la muscu jambes ; en spécifique la durée vélo est bornée pour que sa charge reste ≤ 30 % du total de la semaine ; la sortie longue vélo remplace une des deux sorties de la semaine allégée de base au lieu de s'ajouter, et ne remplace jamais la sortie longue course. Tests : aucun vélo sur un jour de course à pied ; Legs sur un jour dur ; pas de muscu la veille de la sortie longue ; rien dans les 7 jours avant la course A ; quota 30 % en spécifique.
- [x] `plan/generate` : chaque `GeneratedWeek` porte ses séances de soutien ; `plan-gateway` les enregistre avec leur sport et remplit `week.targetCyclingMin` et `week.targetStrengthCount`. Le seed et les scénarios P3.5 rejouent alors muscu et vélo comme les courses.
- [x] Schéma : table `strength_set` (séance, exercice, série, répétitions, charge kg, RPE) ; migration générée.
- [x] `application` : `recordStrengthSets` (enregistre les séries d'une séance de muscu) et lecture de la dernière charge par exercice pour proposer la suivante. Route `PUT /api/sessions/[id]/strength`.
- [x] UI Retour de séance : quand la séance est une muscu, la liste des exercices avec série / répétitions / charge pré-remplie par la charge suivante, l'ancienne valeur barrée ; la durée et le RPE restent ceux du formulaire commun.
- [x] UI Muscu : phase muscu courante, les trois séances avec leurs exercices et ce qu'ils apportent, le bloc prévention, la charge tenue et la charge proposée par exercice. UI Vélo : les quatre séances, zones de FC et de puissance, règles de conversion course → vélo.
- [x] Vérifier dans le navigateur au scénario `bloc-2` : « Aujourd'hui » et la semaine montrent les trois muscu et le vélo, le cadran charge répartit course / vélo / muscu, la saisie des séries propose la charge suivante.
- [x] Fini : lint, typecheck, tests, build verts ; commit « P4 — muscu et vélo ».

P5 — Imprévu, pause et recherche de course

Première brique qui fait appel au LLM. Le périmètre est celui du § 6 et rien de plus : traduire un texte libre en événements structurés, chercher une course sur le web. Le moteur déterministe garde la main sur le plan ; toute sortie du modèle est validée par schéma avant usage et, en cas d'échec, l'écran demande une saisie manuelle. Aucune donnée d'entraînement ne part vers le modèle : l'Imprévu ne reçoit que la date du jour et les séances *prévues*, la recherche de course ne reçoit que le nom tapé.

- [x] `server/infra/llm` : client `@anthropic-ai/sdk`, modèle `claude-sonnet-5` en effort `low` (§ 2, arrêté le 16 sept. après mesure), thinking adaptatif, sortie JSON stricte via `output_config.format`, clé lue dans `runtimeConfig.anthropicApiKey` (`NUXT_ANTHROPIC_API_KEY`, à ajouter dans `.env.example` et dans les variables Vercel). Erreurs typées remontées telles quelles : une panne du modèle ne doit pas ressembler à une réponse vide.
- [x] `server/domain/unplanned` : types des événements du § 6 (`activity` : sport, date, durée, RPE estimé, profil d'intensité ; `unavailability` : du, au, portée) et règle **I1** — une indisponibilité qui couvre une séance prévue propose de la déplacer vers un jour libre de la même semaine quand c'est une séance clé et qu'il reste 48 h avec la suivante (§ 5, R6), sinon de la retirer. Sortie = propositions typées, jamais d'application directe. Tests : déclenche et ne déclenche pas, clé déplacée, facile retirée, aucune proposition hors fenêtre.
- [x] `rules` : `RuleId.I1`, effets `MoveSession` et `CancelSession`, `ProposalTrigger.Unplanned` ; `proposal.payload` (jsonb) pour porter la date de destination, que le texte d'une proposition ne peut pas transporter. Application dans `proposal-repository` : déplacer change la date de la séance, retirer la passe en sautée.
- [x] Schéma : `unplanned_event` (texte brut, interprétation jsonb, statut à confirmer / confirmée), `race_lookup` (course, champs bruts, statut par champ, sources, dernière vérification), `proposal.payload` ; migration générée.
- [x] `application/record-unplanned` : le texte part au modèle avec le contexte minimal du § 6, la sortie est validée par schéma et stockée « à confirmer » ; à la confirmation, les activités deviennent des `activity` hors séance avec recalcul de `load_daily`, et les indisponibilités passent par I1 pour produire des propositions. Routes `POST /api/unplanned` et `POST /api/unplanned/[id]/confirm`.
- [x] Panneau Imprévu (⌘K) : champ de texte libre, aperçu des événements extraits (une ligne par activité et par indisponibilité, modifiables), bouton « Confirmer », puis renvoi vers « À décider ». En cas d'échec de validation, message clair et saisie manuelle.
- [x] `application/open-pause` + panneau Pause / blessure : type, zone, douleur, date de fin estimée facultative, autorisations (course, vélo, muscu haut, muscu jambes) et conditions ; l'ouverture gèle le plan et le régénère (`PlanTrigger.Pause`), sans date de reprise estimée le plan repart non daté (§ 5). La reprise reste le bouton existant du cockpit. Route `POST /api/pause`.
- [x] `server/infra/search` : recherche de course par le modèle avec l'outil serveur `web_search_20260209` (5 usages au plus), sortie JSON par champ `{value, status: sûr | à_confirmer | estimé, sources[]}` pour nom, date, distance, lieu, D+ et ouverture des inscriptions. Test de contrat sur une sortie enregistrée, aucun appel réseau en CI.
- [x] Fenêtre Nouvelle course : recherche à gauche (champ, résultats par champ avec statut et sources cliquables), formulaire pré-rempli à droite, chaque valeur restant modifiable ; le `race_lookup` est conservé avec la course. La saisie manuelle seule reste possible.
- [x] Cron quotidien : revérification de la date des courses dont le dernier `race_lookup` a plus de 30 jours et dont les inscriptions ne sont pas ouvertes ; une date qui change produit une proposition, jamais une écriture silencieuse.
- [x] Ajouté hors liste : colonne `activity.rpe`, sans quoi la charge d'une activité hors plan retombait sur un RPE de 5 en dur ; migration générée.
- [x] Fini : lint, typecheck, tests et build verts ; les trois parcours vérifiés dans le navigateur à 1440 px le 16 sept. — « 1 h de squash, pas dispo vendredi » compte 420 UA en « autre » et retire les deux séances du vendredi, une blessure déclarée gèle le plan et le repose en semaines non datées avec la reprise à 60 %, « semi madrid 2027 » pré-remplit le formulaire avec le Movistar Medio Maratón du 4 avril 2027 et ses sources. Commit « P5 — imprévu, pause, recherche de course ».

P5.6 — Corrections du placement vélo et du lendemain de sortie longue (revue du 16 sept. 2026)

Deux défauts relevés en relisant un plan généré complet (26 semaines, Paris puis Madrid, sept jours disponibles, sortie longue le dimanche). **Le lendemain de la sortie longue reçoit une endurance au plafond** : sur les 22 sorties longues du cycle, 8 sont suivies le lundi d'une endurance de 11,6 km, soit 75' à l'allure E, et ce sont les 8 semaines du spécifique, celles où la sortie longue porte en plus la portion à allure semi. La cause est un angle mort de fin de semaine : `dayAfterHard` dans `easyDaysFor` compare `day - 1` à des jours numérotés 1 à 7, donc `0` pour le lundi, et un dimanche dur n'est jamais vu comme la veille d'un lundi. Le test censé couvrir la règle porte le même angle mort et passe au vert pour cette raison. **Le vélo n'a aucune intensité nulle part** : 26 endurances Z2, une sortie longue vélo et une force basse cadence sur tout le cycle. Le sweet spot hors générateur est une règle voulue (§ 5, R8), mais la force basse cadence déclare `allowedPhases` base et base courte et sa note dit « en base seulement à 48 h du Legs », alors que `cyclingCodeFor` ne la pose qu'en relance : la bibliothèque annonce une séance que le placement ne produit jamais.

- [ ] `plan/week-template` : `easyDaysFor` boucle la semaine, un lundi qui suit une sortie longue du dimanche compte comme lendemain de séance dure. Corriger dans la foulée `tests/domain/week-template.test.ts`, qui reproduit l'angle mort (`used.get(day - 1)`) et ne teste donc pas ce qu'il annonce. Tests : sur un cycle complet, aucune endurance le lendemain d'une sortie longue tant qu'un autre jour libre reste ; le test de bouclage échoue sur le code actuel.
- [ ] § 5 « Semaine type » : trancher la contradiction entre « lundi facile » et « garder un jour vide après la sortie longue ». Le lendemain de la sortie longue revient au vélo Z2 ; « lundi facile » ne vaut que lorsque la sortie longue n'est pas le dimanche. Le défaut `easyDays` reste le lundi, il cesse seulement de primer sur le jour de repos.
- [ ] `plan/week-support` : `cyclingCodeFor` pose la force basse cadence en base et en base courte dès que l'écart avec le Legs de la semaine atteint 48 h, Z2 sinon ; la relance ne change pas. Le sweet spot reste hors générateur, douleur seulement (§ 5, R8). Tests : au moins une force basse cadence en base sur un cycle complet ; jamais à moins de 48 h d'un Legs ; aucun sweet spot planifié.
- [ ] Vérifier dans le navigateur au scénario `bloc-2` puis à une semaine de spécifique : le lundi qui suit la sortie longue porte un vélo et pas une endurance de 75', et une semaine de base montre une force basse cadence à distance du Legs.
- [ ] Fini : lint, typecheck, tests, build verts ; commit « P5.6 — placement vélo et lendemain de sortie longue ».

P5.7 — Identité : âge, profil physique, avatar

Le cockpit ne sait rien de qui s'entraîne : ni âge, ni niveau. FCmax, volume de départ, pic et nombre de courses par semaine se saisissent à nu, sans repère, et l'écran ne porte aucune identité. Un profil physique donne ces repères en une fois, à la façon des propositions : il pré-remplit, il n'impose pas.

- [ ] Schéma : `athlete.birth_date` (date), `athlete.profile` (enum `athlete_profile`), `athlete.avatar` (text, nul par défaut) ; migration générée.
- [ ] `server/domain/athlete/profile.ts` : enum `AthleteProfile` — athlète (entraînement structuré depuis des années), sportif régulier (3 séances et plus par semaine toute l'année), sportif occasionnel (1 à 2 fois par semaine, irrégulier), reprise (arrêt de plusieurs mois), débutant (jamais entraîné en endurance). `defaultsFor(profile)` → `startWeeklyVolumeM`, `peakWeeklyVolumeM`, `runsPerWeek`, `maxWeeklyIncreasePct`. `estimatedMaxHr(age)` = 208 − 0,7 × âge (Tanaka), proposée seulement quand FCmax est vide. `ageOn(birthDate, today)` prend l'horloge du § P3.5. Tests : les cinq profils donnent des défauts distincts et croissants ; Tanaka à 40 ans = 180 ; l'âge suit le jour simulé.
- [ ] `plan` : le plafond de progression hebdomadaire, aujourd'hui 10 % en dur, est lu depuis `athlete` (5 % pour reprise et débutant). C'est **la seule prise du profil physique sur le moteur** : tout le reste n'est que du pré-remplissage de champs que Ronan peut écraser. Tests : en profil reprise, la montée d'un cycle complet ne dépasse jamais 5 % par semaine ; en profil athlète, le comportement actuel est inchangé.
- [ ] `app/utils/avatar.ts` : avatar déterministe en SVG inline (initiales et palette des tokens, graine stockée), aucun service externe, aucune requête réseau. La photo, quand il y en a une, le remplace.
- [ ] Photo de profil : upload redimensionné côté client en 160×160 webp, stocké en data URL de 100 Ko au plus dans `athlete.avatar` — pas de stockage de fichiers à ajouter, Neon suffit. Refus explicite au-delà de la taille, jamais de troncature silencieuse.
- [ ] TopBar : bloc identité à droite de la cloche (avatar 28 px, prénom, âge et profil en `mono`), cliquable vers `/profil`. C'est le seul ajout à la barre du haut ; Imprévu, Pause et cloche ne bougent pas.
- [ ] Page Profil : tuile **Identité** en tête (avatar, remplacer la photo, date de naissance, profil physique avec une ligne disant ce que chaque profil change), puis Volume, Jours, Compte. Choisir un profil pré-remplit volume de départ, pic et courses par semaine en affichant l'ancienne valeur barrée (§ 8) ; rien n'est écrit sans « Enregistrer ».
- [ ] Fini : lint, typecheck, tests, build verts ; parcours vérifié à 1440 px — profil « reprise » choisi, champs pré-remplis, plan régénéré à +5 %/semaine ; commit « P5.7 — identité, âge et profil physique ».

P5.8 — Tuiles pleine largeur, tuiles ouvrantes, curseurs

Trois défauts d'ergonomie relevés le 16 sept. 2026. **Les tuiles ne remplissent pas la largeur** : Profil et Connexions bornent à 860 px, Propositions à 980 px, alors que la zone principale en fait 1208. **Les tuiles disent trop et ne s'ouvrent pas** : une ligne de séance affiche déjà l'allure de chaque étape, et il n'existe qu'une seule fenêtre dans toute l'app (Nouvelle course) ; le store d'UI ne sait même pas viser un objet avec une fenêtre, faute de `modalTargetId`. **Les curseurs mentent** : Tailwind 4 a retiré `cursor: pointer` du preflight sur `<button>`, seule la classe `.btn` le porte, et il n'y a aucun `cursor-pointer` dans `app/` — la cloche, le bouton fermer, la barre ⌘K et les pills de jours se survolent avec une flèche.

- [ ] `app/assets/css/main.css`, `@layer base` : `button`, `[role="button"]`, `select`, `summary` et les labels de case à cocher reçoivent `cursor: pointer`. Classe `.tile-action` : curseur, bordure au survol, `:focus-visible`. Audit des 31 boutons de `app/`, de la barre ⌘K, de la cloche, des pills du Profil et du Retour de séance, des fonds de panneau et de fenêtre.
- [ ] Largeur : retirer les `max-w-*` de `app/pages/profil.vue`, `connexions.vue` et `propositions.vue` ; leurs formulaires passent en grille de 2 ou 3 colonnes pour que la largeur serve à autre chose qu'étirer des lignes de texte. La page de connexion garde sa carte centrée de 360 px (§ 8).
- [ ] `app/stores/ui.ts` : `modalTargetId` et `openModal(id, targetId)` sur le modèle de `panelTargetId` ; `MODAL_IDS` étendu à `seance`, `cadran`, `course`, `exercice`, `proposition`.
- [ ] Dialog **Séance** : `CockpitSessionRow` et `CockpitDayCell` tombent à icône du sport, nom, un seul chiffre, statut — les allures par étape quittent le premier niveau. Le dialog porte la structure complète (échauffement, étapes, retour au calme), les allures, le RPE attendu, le rôle de la séance dans la semaine, prescrit contre réalisé, l'historique de la même séance, et le **formulaire de retour de séance** : le panneau latéral `retour` disparaît, une couche en moins.
- [ ] Dialogs des **cadrans** : chaque cadran garde son titre, son grand chiffre et une ligne. Passent au dialog les causes et la suggestion de Forme du jour, le détail 7 j / 21 j et la répartition par sport de Charge, la projection avec son intervalle et le prochain test de Course A, la tendance et les cinq allures de VDOT.
- [ ] Autres tuiles ouvrantes : ligne de course (Courses), exercice (Muscu), séance de bibliothèque (Course à pied, Vélo), proposition — ce dernier dialog remplace le panneau `proposition` de P3, la zone « À décider » et la page Propositions pointent dessus.
- [ ] Clavier et accessibilité : `role="button"`, `tabindex="0"`, Entrée et Espace sur toute tuile ouvrante ; Échap ferme déjà la couche haute (`closeTopLayer`).
- [ ] Vérifier dans le navigateur au scénario `bloc-2` à 1440 px : aucune tuile ne laisse de vide à droite, chaque tuile ouvrante réagit au survol avec le bon curseur, un cadran ouvre son détail, la séance du jour s'ouvre et se complète sans quitter le cockpit.
- [ ] Fini : lint, typecheck, tests, build verts ; § 8 relu ; commit « P5.8 — tuiles pleine largeur et tuiles ouvrantes ».

P5.9 — Séances de muscu réelles et temps de récupération (revue d'un préparateur physique, 16 sept. 2026)

P4 a livré une bibliothèque d'exercices juste, mais pas des séances. `strengthPrescription` prend **tous** les exercices d'un groupe dans l'ordre du fichier : la pliométrie, dont la note dit « en début de séance, frais », est le sixième et dernier exercice du Legs ; les trois exercices du groupe `Prevention` ne sont jamais tirés et le bloc prévention reste une étape opaque de dix minutes ; `recoveryS` n'est posé que sur le premier exercice, les quatre à six autres n'ont aucun temps de repos, et la page Muscu ne l'affiche nulle part alors que Course à pied et Vélo le montrent déjà. Quatre défauts de fond s'y ajoutent : `hip-thrust` est dans Pull avec `lowerBody: true`, donc une séance déclarée sans jambes en charge et passe malgré une blessure basse ; `durationMin` et `expectedRpe` sont figés par type, donc un Legs d'affûtage pèse autant qu'un Legs de force-puissance dans le cadran charge ; la progression du Nordic est indexée sur `weekInPhase`, remis à 1 à chaque phase, donc la rampe de six semaines ne se termine jamais ; `mollet-unipodal` porte deux exercices dans un seul libellé et le tempo vit en prose dans `why`. Règles fixées au § 5 « Musculation ».

- [ ] `strength/exercises.ts` : enum `StrengthEffort` (force max, force-vitesse, hypertrophie, gainage, prévention, mobilité) et table `EFFORT_RECOVERY_S` (180 / 150 / 90 / 45 / 45 / 20 s). Champs d'exercice : `effort`, `unilateral`, `tempo`, `repDurationS`, `defaultIntensity`, `eccentricLoad`, `contacts`, `droppableFirst`, `superset`. Groupe `Core` ajouté. Tests : chaque exercice a un effort et une durée de répétition ; le repos par défaut suit l'effort.
- [ ] `strength/exercises.ts` : sept exercices ajoutés — `mollet-soleaire` (genou fléchi : le soléaire porte plus de la moitié du soutien vertical en course, il n'est pas un accessoire), `saut-unipodal`, `goblet-squat`, `dead-bug`, `copenhagen`, `mobilite-thoracique`, `etirement-psoas`. Corrections de valeurs : `hip-thrust` passe de Pull à Legs, `pallof` et `planche-laterale` passent de Push à Core, `mollet-unipodal` est scindé (son libellé portait deux exercices), `squat-espagnol` passe à 4 × 45 s, et les `why` de `pliometrie` et `squat-espagnol` cessent de surpromettre (§ 5, honnêteté des libellés).
- [ ] `strength/phases.ts` : `restFactor` et `expectedRpe` par phase (§ 5). Tests : le repos d'un accessoire suit `EFFORT_RECOVERY_S × restFactor` ; le RPE d'un Legs d'affûtage est strictement inférieur à celui d'un Legs de force-puissance.
- [ ] `strength/session-types.ts` : la séance n'est plus un groupe mais un **ordre explicite** — `exerciseIds`, `plyometricIds` (posés en tête quand la phase active la pliométrie), `preventionIds` (le bloc prévention devient des étapes réelles, en rotation selon la séance), `minGapAfterRunS`. `recoveryS` est posé sur **toutes** les étapes. `estimatedDurationS(steps)` remplace le `durationMin` figé. Tests : la pliométrie est la première étape chargée en force-puissance ; aucune étape sans repos ; durée estimée à ± 10 % des 55 / 41 / 42 / 24 minutes annoncées.
- [ ] `strength/session-types.ts` : quatre séances ajoutées — `puissance` (force-puissance dédiée, 35', remplace Legs en phase vitesse pour que la pliométrie ne soit jamais enterrée en fin de séance), `reprise` (30', aucun excentrique ni pliométrie, isométrie antalgique en tête : c'est la séance que reçoit une pause qui interdit les jambes, au lieu du trou actuel), `velo` (40', hip thrust et fente bulgare longue : la destination logique du hip thrust), `full` (30', dose minimale pour une semaine au pic, une séance rattrapée, et **séance unique de l'affûtage** : squat 2 × 3 à 85 % en tête puis haut du corps léger). Composition détaillée des six séances chargées au § 5.
- [ ] `strength/session-types.ts` : `progressionStep` reçoit un compteur de semaines **cumulé depuis le début de la progression** et non `weekInPhase`. Test : le Nordic atteint 3 × 8 même quand la phase course change en cours de rampe, et ne redescend jamais.
- [ ] `plan/week-support.ts` : G1 à G9 du § 5 deviennent un **filtre appliqué avant le tri**, comme `isRaceWeek` l'est déjà, et non des malus de `strengthScore` qui ne bloquent rien quand il ne reste qu'un jour. La contrainte suit l'exercice `lowerBody` et non le type de séance. `STRENGTH_PER_PHASE[Taper]` passe de `[Push]` à `[Full]` : la séance unique de l'affûtage garde le rappel de force sur les jambes sans supprimer le haut du corps (§ 5). Tests : aucune séance jambes la veille d'une clé ou de la sortie longue en force et en force-puissance ; Push et Pull plaçables la veille d'un seuil ; sur `legStrength: false`, `reprise` remplace Legs et les autres séances perdent leurs étapes jambes ; force basse cadence jamais à moins de 48 h d'un Legs.
- [ ] UI Muscu : temps de récupération, tempo et intensité affichés **par exercice** (la page les ignore aujourd'hui alors que Course à pied les montre déjà), paires de superset marquées, bloc prévention détaillé exercice par exercice au lieu d'une ligne de prose, durée calculée affichée. Les nouvelles séances apparaissent avec leur phase d'usage.
- [ ] UI : le détail d'une séance de muscu dans le dialog de P5.8 porte les mêmes informations, plus la charge tenue et la charge proposée par exercice.
- [ ] Seed et scénarios P3.5 rejoués : la durée et le RPE des séances de muscu changent, donc `load_daily` et le cadran charge bougent ; vérifier au scénario `bloc-2` que la charge muscu reste cohérente et que les assertions de test sont mises à jour, pas contournées.
- [ ] Vérifier dans le navigateur au scénario `bloc-2` : page Muscu avec récup par exercice et bloc prévention détaillé ; une semaine de force-puissance pose la pliométrie en tête de séance ; aucune séance jambes la veille de la sortie longue.
- [ ] Fini : lint, typecheck, tests, build verts ; § 5 « Musculation » relu ; commit « P5.9 — séances de muscu réelles et temps de récupération ».

P5.5, P6 et P7 (dont les itinéraires GPX) : voir § 9, à transformer en cases au moment d'attaquer la phase.

## 0. Données réelles de départ (à seeder en P1)

Les valeurs des maquettes (VDOT 45, 1:42 au semi, objectif 1:38, Madrid le 18 avril) sont des exemples. Voici la vraie base.

**Courses réalisées**

| Course | Date | Résultat | Statut de référence |
|---|---|---|---|
| Premier semi-marathon | dim. 13 sept. 2026 | **2:26:00 sur 21,5 km (6:48/km de moyenne)**. Segments : 6:00/km jusqu'au km ~14, blessure, marche/course alternées du km 14 au km 19, 6:00/km du km 19 à l'arrivée. | **Base de référence, non représentative** : le chrono final ne sert pas à calibrer le VDOT. Le segment continu 0–14 km à 6:00/km sert de plancher (VDOT ≈ 33). |

**Courses à venir**

| Course | Date | Distance | Priorité | Objectif |
|---|---|---|---|---|
| Semi de Paris | dim. 7 mars 2027 | 21,1 km | A | **se tester** : couru à fond, sans chrono cible, pour recaler le VDOT |
| Semi de Madrid | dim. 4 avril 2027 (4 semaines après Paris) | 21,1 km | B | **performance maximale** : l'objectif est la projection du jour, recalée par Paris |
| 5 km · Île d'Arz | dim. 8 août 2027 (confirmé) | 5 km | A | **performance maximale** : pas de chrono cible, l'objectif est la projection du jour, à battre |

**Conséquences immédiates sur le plan**
- **Pause active au 16 sept.** : ongle de pied cassé, douloureux, pas de course tant que la douleur en marchant n'est pas nulle. Type « blessure », zone « pied », durée inconnue : la pause reste ouverte jusqu'à ce que Ronan marque la reprise dans l'app. Pendant la pause : muscu haut du corps autorisée, vélo et muscu jambes seulement si la chaussure ne fait pas mal, mobilité. Le plan (reprise, test, phases) est calé sur la **date de reprise**, pas sur une date fixe : tout ce qui suit est exprimé en semaines après reprise.
- Blessure du 13 sept. : douleur derrière le genou droit (creux poplité), **disparue depuis**. À la fin de la pause, le plan enchaîne sur une **reprise surveillée** de 3 semaines (60 → 80 → 100 % d'un volume de départ prudent, endurance seule la première semaine, pas de VMA avant la semaine 3), avec la zone « genou droit, face postérieure » pré-cochée dans le retour de séance. Toute douleur > 2/10 à cet endroit déclenche R5 immédiatement.
- Madrid n'est qu'à **4 semaines** de Paris : mini-cycle Récup 2 · Relance 1 · Affûtage 1. Madrid se court sur la forme de Paris, sans bloc de progression entre les deux.
- Aucun VDOT fiable : premier **test 20'** planifié en semaine 4 après la reprise (posé par le générateur, voir § 5). Ni Paris ni Madrid n'ont de chrono cible : les deux sont en mode performance maximale, Paris servant de test grandeur nature qui recale le VDOT pour Madrid. D'ici là, les allures d'entraînement se calculent depuis le plancher VDOT 33,15 (valeurs du moteur, vérifiées contre la table Daniels le 16 sept. 2026) : E 7:05/km affichée, plage 6:47 – 8:05 ; M 6:25 ; T 5:55 ; I 5:27 ; R 5:03. Projections au plancher : 5 km 28:14, 10 km 58:40, semi 2:10:01. Elles seront revues à la hausse dès le test.
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
| LLM | **Claude API** via `@anthropic-ai/sdk`, modèle `claude-sonnet-5`, thinking adaptatif, effort `low`, `output_config.format` pour du JSON strict, outil serveur `web_search_20260209` pour la recherche de course | Volume très faible (quelques appels/semaine), quelques centimes/mois |
| Itinéraires | **OpenRouteService** (clé gratuite, 2 000 requêtes/jour) : géocodage d'adresse et boucles à distance cible (`round_trip`, profil `foot-walking`), export GPX natif | Gratuit, service côté serveur sans compte pour l'utilisateur, résultat reproductible à graine égale |
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
    routes/               # distances cibles des sorties sur place pour une course, validation d'une trace GPX
  application/            # cas d'usage : orchestrent domain + repos + adapters
  infra/
    db/                   # Drizzle schema, repos
    strava/               # OAuth, import, webhook, rattachement
    llm/                  # client Claude, prompts, schémas de sortie
    search/               # recherche de course (LLM + web_search)
    routing/              # OpenRouteService : géocodage, boucles à distance cible, GPX
  api/                    # Nitro routes (REST minimal, JSON)
app/                      # pages Nuxt (desktop), coque (barre latérale, panneaux, ⌘K), composants, stores Pinia
```

Règle : `domain` n'importe rien de `infra`. Les cas d'usage reçoivent leurs dépendances (repos, clock, llm) en paramètres.

## 4. Modèle de données (Postgres)

- `athlete` (1 ligne) : poids, FCmax, `birth_date` (l'âge se dérive de l'horloge, il n'est jamais stocké), `profile` (athlète | sportif régulier | sportif occasionnel | reprise | débutant), `avatar` (data URL 160×160 ; nul = avatar généré depuis les initiales), jours dispo, contraintes (sortie longue le dimanche, lundi sans course…), volume de départ et pic, plafond de progression hebdomadaire, préférences.
- `race` : nom, date, distance_m, priorité (A/B/C), `objective_mode` (temps | performance_max), objectif_s (nul en mode performance_max), profil (D+, type), météo attendue, source (manuel / recherche), statut (planifiée, courue, annulée), résultat_s, `representative` (bool : faux si le résultat ne reflète pas la forme, ex. blessure en course), `incident` (km, type, note).
- `race.fuel_plan` (jsonb, généré à J−7, modifiable) : glucides g/h, prises (km ou minute, produit), eau ml/h, sodium mg/h, caféine, consignes pré-départ ; `null` quand la course ne le justifie pas.
- `race_segment` : race, km_debut, km_fin, mode (course | marche_course | marche), allure_s_km, note. Optionnel : une course sans segment se lit comme avant, un seul chrono. Ajouté parce que la course de référence du 13 sept. n'est lisible qu'en segments.
- `race_lookup` : résultat brut de la recherche automatique par champ, statut (sûr / à confirmer / estimé), sources, dernière vérification.
- `race.start_address` : adresse de la ligne de départ, saisie à la main ou issue de la recherche ; sert d'arrivée à l'itinéraire logement → départ.
- `race_route` : race, adresse de départ saisie (logement), lat / lon géocodés, cible (session ou distance_m), type (boucle | aller), graine, distance_m réelle, D+, nombre de virages, gpx (texte), généré le. Une ligne par variante conservée.
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
Allures d'entraînement : inverser la relation pour E (59–74 % VDOT, valeur unique affichée à 70 %, comme la table publiée), M (75–84, milieu), T (83–88, haut de plage), I (95–100, milieu), R (105–110, milieu). **Allure semi** = allure moyenne de la projection sur 21 097,5 m, jamais une zone. Projection sur une distance : résoudre `t` tel que VDOT(d, t) = VDOT courant (Newton). Tests unitaires sur la table Daniels : VDOT 44 → semi 1:42:17, VDOT 45,4 → ≈ 1:39:35, et autour du plancher VDOT 30 → 5 km 30:41, semi 2:21:17, E 7:39, T 6:24, I 5:54 ; VDOT 35 → 5 km 26:59, semi 2:04:13, E 6:48, T 5:40, I 5:13 (vérifié le 16 sept. 2026 contre la 4e édition).

**Mise à jour du VDOT** — uniquement course ou test (priorité C ou test 20' contrôlé). Une course `representative = faux` ne met pas à jour le VDOT : son meilleur segment continu (≥ 10 km) donne un **plancher** (VDOT minimal), affiché comme tel jusqu'au premier test. Le **test 20'** est posé par le générateur : semaine 4 après une reprise, puis toutes les 6 semaines hors affûtage et récup, à la place de la séance clé du milieu de semaine ; sa distance saisie donne VDOT(distance, 20') qui devient le VDOT courant et régénère le plan. Les ressentis de séance peuvent le *baisser* (2 séances clés d'affilée à RPE ≥ prévu + 1 et allure non tenue → −0,3), jamais le monter.

**Projection jour J** — VDOT courant + gain attendu du bloc restant (plafonné à +0,4 VDOT / 8 semaines, réduit par les pauses) ; intervalle ± dérivé de la variabilité des tests ; ajustement course : dénivelé (+0,5 s / m de D+ net), chaleur (+1,5 %/°C au-dessus de 18 °C, si météo attendue connue). **Confiance** = probabilité que la borne basse de la projection ≤ objectif, arrondie aux 2 %.

**Charge** — `UA = RPE × durée_min` pour toute activité (course, vélo, muscu, imprévu). Ratio = charge 7 derniers jours / moyenne hebdo des 21 jours précédents (découplé). Affiché comme repère (0,8–1,3), jamais décisionnel seul. Indisponible tant que < 28 jours d'historique (l'import Strava initial le fournit dès le premier jour).

**Musculation** (revue d'un préparateur physique, 16 sept. 2026) — phases calées sur celles du plan : adaptation 3 semaines → force → force-puissance avec pliométrie → entretien −30 % → rappel léger en affûtage → mobilité en récup → arrêt total à J−7 d'une course A. En affûtage, la semaine ne porte qu'une séance et c'est une **séance mixte courte** (`full`, 30') : squat 2 × 3 à 85 % en tête, puis tractions et développé militaire à dose légère. Ni Push seul — deux à trois semaines sans charge sur les jambes avant une course A, c'est du détraînement gratuit — ni jambes seules, le haut du corps n'a aucune raison de disparaître. Nordic en progression 1×4 → 3×8 sur six semaines, comptées **en continu** et non remises à zéro au changement de phase.

*Repos entre séries*, par nature d'effort et non par rang dans la séance : force maximale 180 s, force-vitesse et pliométrie 150 s, hypertrophie et accessoires 90 s, gainage et prévention 45 s, isométrie antalgique 120 s, mobilité 20 s. La phase module ce repos (facteur 1 en adaptation, force et force-puissance ; 0,9 en entretien ; 0,8 en affûtage ; 0,7 en récup) sans le remplacer. **Chaque étape porte son repos**, l'exercice principal comme les accessoires. Supersets antagonistes sur les accessoires seulement, pour tenir la séance en 45 à 60 minutes : jamais sur l'exercice principal, jamais deux exercices jambes dans la même paire, jamais la veille d'une séance clé — la densité fait monter le RPE réel et déclencherait R1 à tort.

*Composition d'une séance* : l'ordre des exercices est une donnée, pas l'ordre du fichier. La pliométrie se place en tête, à froid ; le bloc prévention est fait d'étapes réelles, en rotation selon la séance, et non d'un libellé de dix minutes. La durée se calcule (`Σ séries × (répétitions × durée d'une répétition × côtés + repos) + 60 s d'installation par exercice`) au lieu d'être posée par type, et le RPE attendu varie avec la phase : sinon un Legs d'affûtage et un Legs de force-puissance pèsent le même poids dans le cadran charge.

*Interférence avec la course et le vélo*, en contraintes dures et non en malus de score : (G1) une séance qui charge les jambes est interdite la veille d'une séance clé ou de la sortie longue dès que la phase active la pliométrie ou dose l'exercice principal à ≥ 85 % ; (G2) le même jour, course d'abord et ≥ 6 h d'écart ; (G3) excentrique lourd ou pliométrie → 48 h avant la prochaine séance clé, sinon ces exercices sortent de la séance et le reste est conservé ; (G4) Push, Pull et Mobilité n'imposent aucun écart ; (G5) la contrainte suit **l'exercice** (`lowerBody`) et non le type de séance ; (G6) arrêt total à J−7 d'une course A ; (G7) une pause qui interdit la muscu jambes remplace Legs par une séance de reprise et filtre les exercices jambes des autres séances, au lieu de supprimer ; (G8) le vélo en force basse cadence est un travail de force jambes, soumis à G1 et à 48 h d'écart avec Legs ; (G9) R1 étendue — séance clé à RPE ≥ prévu + 1 retire une série **et** les exercices d'excentrique lourd et de force-vitesse.

*Ordre de retrait quand le volume de course monte* : dips, puis le troisième accessoire de chaque séance, puis le Nordic, puis la fente bulgare, puis la séance Pull entière. *Jamais retirés* : le squat lourd même réduit à un rappel, les mollets genou tendu et genou fléchi, le bloc prévention, la mobilité de cheville.

*Honnêteté des libellés* : la charge lourde devance nettement la pliométrie sur l'économie de course (Eihara 2022 : g = −0,32 contre −0,13) — la pliométrie est un complément pour la raideur tendineuse, pas « le stimulus le mieux démontré ». Le Nordic reste une assurance à effet non concluant hors football (Impellizzeri 2021) : ne pas le prioriser. Le squat espagnol est un antalgique tendineux à effet immédiat (Rio 2015), pas une prévention universelle. La réduction du risque de blessure par la musculation, elle, est solide et dose-dépendante (Lauersen 2018) : c'est ce qui justifie de ne jamais tomber à zéro.

**Périodisation** — depuis la course A : rétro-planning Affûtage 2 · Spécifique 7 · Développement 8 · Base = reste (min 4). Course B à ≤ 8 semaines après A : Récup 2 · Relance N−3 · Aff 1 (Madrid à 4 semaines : Récup 2 · Relance 1 · Aff 1). Course B avant A : intégrée comme séance test à allure contrôlée ou remplace la sortie longue. Course C : remplace la séance clé de la semaine, recale le VDOT. **Course A sur 5 km** (ou 10 km) : cycle Récup 2 · Base courte 4 · Vitesse 8 (2 séances clés : VMA + répétitions courtes / côtes, sortie longue ramenée à 60–75') · Affûtage 1 ; muscu en force-puissance et pliométrie. **Mode performance maximale** : l'objectif affiché est la projection du jour ; la confiance devient « probabilité de faire mieux que la dernière référence ». Sortie longue ≤ 30 % du volume hebdo, et ≤ 75' à l'allure E dans un cycle 5 km.

**Volume et blocs** — volume de départ et pic lus dans `athlete` (défauts 20 km et 45 km, à ajuster dans Profil au fil de l'historique saisi). Blocs de 4 semaines : 3 en montée (+≤ 10 %/sem), 1 allégée (−30 %), plafonnés au pic. Le compteur de bloc repart à 1 au début de chaque cycle. Les phases affûtage, récup et relance sortent du rythme de bloc : affûtage 2 semaines = 70 % puis 50 % du dernier volume plein, affûtage 1 semaine = 60 %, récup = 50 %, relance = 80 % ; un affûtage n'est jamais croissant. **Reprise après pause** : 60 / 80 / 100 % du volume de départ fixe, progression de bloc gelée pendant ces 3 semaines, la montée normale commence en semaine 4. Le **jour de course** ne porte aucune séance et le lendemain d'une course A est un repos.

**Semaine type** — générée à partir des contraintes : jours durs groupés, muscu le soir des jours durs (course d'abord, ≥ 6 h), vélo Z2 le lendemain d'une séance clé, lundi facile. **Nombre de courses par semaine** borné et indépendant des jours disponibles : les jours disponibles disent où courir, pas combien. Défaut par phase, modifiable dans Profil (`runsPerWeek`, 2 à 6) : reprise 3, base et base courte 4, développement 4, spécifique 4, vitesse 4, relance 3, affûtage 3, récup 2. Chaque course a un rôle : la sortie longue, une séance de qualité (deux à partir du spécifique et de la vitesse), le reste en endurance de 35' à 75' à l'allure E, lignes droites incluses en fin d'endurance (6 × 100 m, au plus 2 fois par semaine, jamais avant la semaine 3 d'une reprise ni en récup) et jamais en séance à part. Pose : sortie longue sur son jour, séances clés sur des jours durs espacés d'au moins un jour, endurances sur les jours restants en gardant un jour vide après la sortie longue et après chaque séance clé quand le nombre de courses le permet ; les jours disponibles non retenus restent vides pour le vélo et la muscu. Séances clés par phase, sortie longue comprise : base, base courte, développement, relance = sortie longue + 1 clé ; spécifique, vitesse = sortie longue + 2 clés ; affûtage = 1 clé ; récup = aucune. En spécifique, l'allure semi se court **dans** la sortie longue (dernier tiers, borné par le quota 20 % de qualité), pas en séance séparée. Les séances clés progressent dans la phase (seuil 2×8' → 3×8' → 20' continu ; VMA 4×800 → 6×800 → 5×1000 ; côtes 6 → 10 répétitions de 30", à l'effort, sans allure) ; leur budget d'intensité se calcule sur la portion intense seule, échauffement et retour au calme hors quota. Si le volume hebdo dépasse ce que le nombre de courses peut porter dans les bornes de durée, la sortie longue absorbe jusqu'à son quota puis le volume cible est réduit et la semaine est marquée `volumeCapped`. 2 vélos en base, 1 ensuite, vélo ≤ 30 % de la charge en spécifique. Musculation : voir le paragraphe dédié ci-dessous.

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

**Pause** — gèle les semaines couvertes ; conserve les activités autorisées ; reprise 60 % → 80 % → 100 % sans séance clé la première semaine ; régénère une `plan_version` ; recalcule projection et confiance ; met en pause la muscu jambes si blessure basse. Pause ouverte **sans date de reprise estimée** : le plan est généré en semaines non datées (phases et volumes, aucune séance, `startDate` nul) et l'écran affiche « en attente de la reprise » ; les dates et les séances apparaissent à la régénération déclenchée par « Marquer la reprise ».

**Apprentissage (v1, statistique, sans ML)** — détecteurs : glissement de jour (séance X déplacée vers Y ≥ 60 % sur ≥ 8 occurrences), créneau jamais honoré (0/≥ 8), biais RPE par type de séance (moyenne écart sur ≥ 6), sensibilité au sommeil (RPE +≥1 quand sommeil < 6 h, ≥ 5 cas), refus systématique d'une famille de propositions (≥ 70 % sur ≥ 5). Chaque détection → `habit` (confiance = n/N pondéré) → l'utilisateur accepte → règle personnelle paramétrée. Calibration hebdo : erreur RPE, taux d'acceptation, écart projection/résultat aux tests.

## 6. LLM : périmètre et contrats

- **Imprévu** : entrée = texte libre + contexte minimal (date du jour, jours de la semaine, séances *prévues* — jamais les activités Strava). Sortie JSON strict (`output_config.format`) : `[{kind: "activity", sport, date, duration_min, rpe_estimate, intensity_profile}] + [{kind: "unavailability", from, to, scope}]`. Le moteur déterministe génère ensuite les propositions. Un appel, `claude-sonnet-5`, thinking adaptatif, effort `low`. Deux à quatre secondes en pratique.
- **Recherche de course** : entrée = nom tapé ; outil serveur `web_search_20260209` (max 5 usages) ; sortie JSON par champ `{value, status: sûr|à_confirmer|estimé, sources[]}`. Revérification mensuelle de la date par le cron jusqu'à ouverture des inscriptions. Aucune donnée personnelle envoyée.
- **Explications** (optionnel, v2) : reformuler une proposition en phrase naturelle à partir de la règle et des valeurs, sans données Strava.
- Toute sortie LLM est validée par schéma avant usage ; en cas d'échec, l'écran demande une correction manuelle.
- **Hors périmètre LLM** : les itinéraires GPX (P5.5) sont produits par un service de routage déterministe, sans LLM ; seule l'adresse saisie quitte le serveur.
- **Modèle arrêté le 16 sept. 2026 : `claude-sonnet-5` en effort `low` pour les deux appels.** Ni traduire un texte libre, ni recopier six champs depuis une page d'organisateur ne demandent Opus : la recherche de course passait deux minutes sur `claude-opus-5` en effort haut, elle en prend quinze à quarante secondes ici, et l'Imprévu répond en deux à quatre secondes. `claude-haiku-4-5` n'est pas retenu : il ne prend ni `effort`, ni l'outil `web_search_20260209`. Sur une requête ambiguë — Madrid a deux semi-marathons — la réponse peut varier d'une exécution à l'autre ; c'est précisément ce que couvrent le statut par champ, les sources et le fait que chaque valeur reste modifiable.

## 7. Intégration Strava

1. App déclarée sur strava.com/settings/api (mono-athlète, callback `https://<app>/api/strava/callback`).
2. OAuth2 : `read,activity:read_all` ; stockage chiffré access/refresh ; refresh automatique avant expiration.
3. Import initial : 24 mois d'activités (pagination 200/page) → `activity` + `load_daily` + points de forme depuis les courses officielles (type Race) → charge chronique disponible dès le premier jour.
4. Webhook : abonnement `create/update/delete` sur `/api/strava/webhook` (validation du challenge) ; à chaque `create`, fetch de l'activité puis **rattachement** : même sport à ± 1 jour d'une `session` prévue → statut « faite », prescription vs réalisé pré-remplis, notification « il reste le ressenti » ; sinon → `unplanned_event` avec charge estimée (RPE déduit de la FC si dispo, sinon 5) à confirmer.
5. Limites : 200 req / 15 min, 2 000 / jour ; un athlète en consomme < 50 / jour. Suppression côté Strava → suppression locale.
6. Montres (Garmin, Apple Watch, Coros) : rien à faire, elles passent par Strava.

## 8. Écrans et navigation (desktop)

**Coque commune** : barre latérale 232 px en quatre groupes, barre du haut (fil d'Ariane + date / semaine / phase, champ Imprévu ⌘K, bouton Pause / blessure, cloche des propositions, puis à l'extrême droite l'identité — avatar, prénom, âge et profil physique — cliquable vers Profil), zone principale.

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

**Panneaux latéraux** (par-dessus le cockpit, Échap ferme) : Imprévu (⌘K), Pause / blessure — la saisie liée au flux, sans objet à lire. **Dialogs** (fenêtre centrée, Échap ferme) : séance (détail complet et retour de séance), course, cadran, proposition, exercice de muscu. **Fenêtre** : Nouvelle course (recherche automatique à gauche, formulaire pré-rempli à droite) ; Itinéraires (depuis la ligne d'une course : adresse du logement, date d'arrivée, une ligne par sortie sur place avec tracé, distance, D+ et téléchargement du GPX).

Règles d'ergonomie : une action principale par ligne, jamais deux boutons pleins côte à côte ; toute valeur proposée affiche l'ancienne barrée ; les nombres en police mono alignée ; aucun écran secondaire n'est nécessaire pour la routine séance → ressenti → décision.

Règles de tuile (fixées le 16 sept. 2026) :
- **Une tuile montre au plus quatre informations.** Tout le détail vit dans son dialog. C'est la contrepartie de la règle du § 11 : une tuile qui grossit se vide dans son dialog au lieu de pousser les autres.
- **Toute tuile qui a un détail est cliquable et ouvre un dialog.** Dialog = lire et agir sur un objet (séance, course, cadran, proposition, exercice). Panneau latéral = saisie liée au flux (Imprévu, Pause). Un clic n'empile jamais deux surfaces.
- **Les tuiles occupent la largeur de la zone principale.** Aucune page ne borne sa largeur ; les formulaires se répartissent en grille de 2 ou 3 colonnes pour que cette largeur serve. Exception unique : la page de connexion, carte centrée de 360 px.
- Tout élément cliquable porte `cursor: pointer` et répond au clavier (Entrée, Espace). Tailwind 4 ne met plus le curseur sur `<button>` : c'est à la feuille de base de le faire.

## 9. Phases de livraison

Chaque phase est déployable et utilisable seule. « Fini » = tests verts, `vue-tsc` vert, lint vert, parcours vérifié sur téléphone.

**P0 — Socle (1 soirée)** ✅ livré
Repo, Nuxt + TS strict, Tailwind, tokens du design, Drizzle + Neon, auth mono-utilisateur, déploiement Vercel, CI, **coque desktop** (barre latérale, barre du haut, zone principale, système de panneaux latéraux et fenêtres, ⌘K). Livrable : coque en ligne et protégée, navigation entre pages vides, un panneau qui s'ouvre et se ferme.

**P1 — Courses, forme, plan (cœur déterministe)**
`races`, `fitness`, `running` (bibliothèque des 9 types de séances et quotas), `plan` avec tests unitaires (table Daniels, rétro-planning, blocs 4 semaines, semaine type, quotas respectés). Écrans : Courses, fenêtre Nouvelle course (manuelle), page Course à pied, Semaine, Cockpit v1 (cadran course, cadran VDOT, Aujourd'hui avec la séance prévue, semaine, cap). Saisie manuelle d'un résultat de course pour initialiser le VDOT, avec segments et incident. Seed des données réelles du § 0 (semi du 13 sept. en segments, Paris, Madrid, 5 km Île d'Arz). Livrable : le cockpit affiche la pause en cours, la reprise, puis le plan complet jusqu'au 5 km d'août, avec les objectifs de Paris et Madrid marqués « à fixer après le test ».

**P1.5 — Corrections du moteur course (revue d'entraîneur du 16 sept. 2026)**
Le plan généré en P1 était juste sur le VDOT, la périodisation et les quotas, mais faux sur huit points : test 20' jamais planifié donc VDOT figé au plancher ; reprise cumulant les ratios 60/80/100 et la montée de bloc (15 → 22 → 30 km) ; seuil et VMA figés et sous-dimensionnés parce que le budget retirait échauffement et retour au calme ; allure semi prise dans la zone M (15 s/km trop lente) ; semaines allégées calées sur un compteur global, d'où un affûtage de Paris inversé (23 puis 33 km) ; séance posée le jour de course ; trois séances dures par semaine dès le développement pour un coureur à VDOT 33 ; plan daté pendant la pause. Les règles corrigées sont au § 5 (Volume et blocs, Semaine type, Mise à jour du VDOT, Pause). Livrable : le seed rejoué produit une reprise 60/80/100 sur base fixe, un test en semaine 4, des séances clés qui progressent, un affûtage décroissant et des jours de course vides ; la saisie du test met à jour le VDOT et le plan.

**P2 — Strava + retour de séance + charge**
OAuth, import 24 mois, webhook, rattachement, panneau Retour de séance (RPE, sensations, sommeil, douleur), `load`, cadran charge, réalisé Strava dans « Aujourd'hui ». Livrable : une sortie faite avec la montre apparaît « faite » dans les 2 minutes dans le cockpit, tu ajoutes le ressenti en 20 s sans quitter l'écran.

**P3 — Recalcul + forme du jour**
`rules` R1–R8, `proposal`, panneau « À décider » dans le cockpit + panneau détail, `readiness` et cadran forme du jour, cloche, cron quotidien. Page Progression v1 : courbe VDOT avec courses et tests, projection avec intervalle, volume et charge par semaine, adhérence, journal des séances clés. Livrable : la boucle complète séance → ressenti → propositions → plan ajusté, entièrement depuis le cockpit, et une vue qui montre si ça progresse.

**P3.5 — Seed de dev daté et horloge simulée**
`NUXT_COCKPIT_TODAY` force la date côté serveur en local ; le seed rejoue jour par jour une reprise puis des semaines d'entraînement en passant par les cas d'usage (ressenti, test 20', reprise) avec une progression estimée paramétrée, en scénarios nommés (`pause`, `reprise-s2`, `bloc-2`, `affutage-paris`). Livrable : en une commande, le cockpit se regarde à n'importe quel point de la saison avec un historique cohérent, ce qui rend la charge, la forme du jour, les propositions et la progression visibles et testables sans attendre des semaines réelles.

**P3.6 — Semaine type à nombre de courses borné**
Le générateur remplissait chaque jour disponible, d'où six courses par semaine dont quatre endurances trop courtes pour servir et aucun jour de repos. La semaine type compte désormais un nombre de courses par phase (3 en reprise et affûtage, 4 en base, développement, spécifique et vitesse, 2 en récup), modifiable dans Profil ; chaque course a un rôle (sortie longue, qualité, endurance de 35' à 75' avec lignes droites incluses) ; l'allure semi se court dans la sortie longue ; les jours disponibles non retenus restent vides pour le vélo et la muscu de P4. Livrable : au scénario `bloc-2`, la semaine affiche quatre courses, deux jours vides, une sortie longue le dimanche et une séance de qualité en milieu de semaine.

**P4 — Muscu + vélo**
Bibliothèque d'exercices et de séances (données des maquettes), phases, placement dans la semaine, saisie séries/reps/charges en panneau, charge suivante, conversion course→vélo, pages Muscu et Vélo. Livrable : les 3 muscu et le vélo apparaissent dans « Aujourd'hui » et la semaine, et comptent dans la charge.

**P5 — Imprévu, pause, recherche de course**
Client Claude, ⌘K Imprévu → propositions ; panneau Pause + reprise progressive + régénération ; fenêtre Nouvelle course avec recherche (statuts et sources), revérification mensuelle. Livrable : « 1 h de squash, pas dispo vendredi » réorganise la semaine ; une blessure d'une semaine produit un plan de reprise ; « semi madrid 2027 » pré-remplit le formulaire.

**P5.5 — Itinéraires GPX pour un évènement**
Pour une course à venir, Ronan saisit l'adresse de départ de ses sorties sur place (hôtel, logement) et sa date d'arrivée (défaut J−1) ; l'app géocode l'adresse et génère des boucles GPX à la distance de chaque séance de course à pied planifiée entre l'arrivée et la course (footing de veille, déblocage, échauffement), plus l'aller logement → ligne de départ quand `race.start_address` est renseignée. Moteur `domain/routes`, pur et testé : liste des cibles (séance, distance_m) depuis le plan actif ; validation d'une trace (distance à ± 10 % de la cible, D+ ≤ 10 m/km, départ = arrivée pour une boucle) ; classement des variantes par D+ puis par nombre de virages ; tests sur des GPX fixtures. `infra/routing` : OpenRouteService, profil `foot-walking`, `round_trip` avec graine, trois variantes par cible, clé `NUXT_ORS_API_KEY` côté serveur uniquement ; réponses enregistrées en fixtures pour les tests, aucun appel réseau en CI. Schéma : `race.start_address`, `race_route` (§ 4), migration. UI : fenêtre « Itinéraires » ouverte depuis la ligne de la course (§ 8) ; tracé dessiné en SVG depuis les points du GPX, sans fond de carte ni bibliothèque ; par ligne, une action principale « Télécharger le GPX » et un lien « Autre variante » ; rien de nouveau dans le cockpit. Aucun LLM, aucune donnée d'entraînement envoyée : seule l'adresse saisie part vers le service. Livrable : « Semi de Madrid, hôtel calle Mayor » produit en une minute les GPX du footing de veille et de l'échauffement, importables dans la montre.

**P5.6 — Placement vélo et lendemain de sortie longue**
Une relecture d'un cycle généré complet montre deux défauts de placement. Le lendemain de la sortie longue reçoit une endurance au plafond de 75' pendant les huit semaines du spécifique, parce que le calcul du lendemain de séance dure ne boucle pas la semaine et que le test porte le même angle mort. Le vélo ne porte aucune intensité sur 26 semaines, alors que la force basse cadence est déclarée autorisée en base : le placement ne l'y pose jamais. Livrable : le lundi qui suit la sortie longue redevient un jour de vélo, et une semaine de base porte une force basse cadence à 48 h du Legs.

**P5.7 — Identité : âge, profil physique, avatar**
`athlete` gagne une date de naissance, un profil physique (athlète, sportif régulier, sportif occasionnel, reprise, débutant) et un avatar — généré depuis les initiales par défaut, remplaçable par une photo redimensionnée en 160×160 et stockée en base. Le profil pré-remplit volume de départ, pic et courses par semaine, et n'a qu'une prise sur le moteur : le plafond de progression hebdomadaire, 5 % au lieu de 10 % en reprise et en débutant. L'âge sert à proposer une FCmax (Tanaka) quand elle est vide, et à l'affichage. Livrable : l'identité est visible en haut à droite de toutes les pages, et choisir « reprise » dans Profil pré-remplit les volumes et régénère un plan qui monte de 5 % par semaine.

**P5.8 — Tuiles pleine largeur, tuiles ouvrantes, curseurs**
Les tuiles remplissent la largeur de la zone principale, disent au plus quatre choses et s'ouvrent en dialog sur tout leur détail : séance (avec le retour de séance dedans, le panneau latéral disparaît), cadran, course, proposition, exercice. Tout ce qui se clique porte enfin un curseur de clic — Tailwind 4 ne le fait plus — et répond au clavier. Livrable : le cockpit se lit d'un coup d'œil, et chaque tuile donne tout son détail en un clic sans quitter l'écran.

**P5.9 — Séances de muscu réelles et temps de récupération**
La bibliothèque de P4 était juste, les séances ne l'étaient pas : elles prenaient tous les exercices d'un groupe dans l'ordre du fichier, d'où la pliométrie en fin de séance au lieu du début, un bloc prévention opaque de dix minutes dont les exercices n'étaient jamais tirés, et un temps de repos posé sur le seul premier exercice. La séance devient une composition ordonnée, chaque étape porte son repos et son tempo, la durée et le RPE se calculent au lieu d'être figés par type, quatre séances arrivent (force-puissance dédiée, reprise après blessure, séance cycliste, et un full-body court qui devient la séance unique de l'affûtage, rappel de squat lourd compris), et les règles d'interférence avec la course passent de malus de score à contraintes dures. Livrable : la page Muscu et le dialog de séance donnent une séance qu'on peut exécuter telle quelle, minute par minute, et le générateur ne pose plus de jambes la veille d'une séance clé.

**P6 — Apprentissage + nutrition**
Détecteurs d'habitudes, page Apprentissage, calibration hebdo, règles personnelles R100+ ; Progression v2 (calibration du ressenti, charges muscu, récupération, filtres de période) ; page Nutrition (repères par type de jour, ravito d'entraînement, protocole J−7, **plan ravito + hydratation en course** généré par course, affiché sur la fiche de la course et dans le cockpit la semaine de course) et rappel nutrition dans la ligne « demain » du cockpit. Livrable : premières habitudes proposées après ~8 semaines de données ; protocole nutrition généré à J−7 de la course A.

**P7 — Confort**
Notifications navigateur (ressenti manquant, proposition en attente), bilan hebdo du dimanche généré depuis Progression, export CSV, kilométrage chaussures. Ensuite, si besoin : déclinaison mobile (même app, cockpit empilé), PWA.

Ordre de valeur si le temps manque : P0 → P1 → P1.5 → P2 → P3 → P3.5 → P3.6. Le reste est additif.

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
| Le cockpit se remplit et perd sa hiérarchie | Règle : un nouvel élément sur l'écran principal doit remplacer ou rétrograder un existant ; sinon il va dans une page ou un panneau. Une tuile montre au plus quatre informations, le reste vit dans son dialog (§ 8) |
| Confiance excessive dans la projection | Toujours affichée avec son intervalle et la date du prochain test |
| Quota et qualité d'OpenRouteService (2 000 req/j ; boucles parfois tortueuses ou sur route passante) | Génération à la demande seulement, variantes mises en cache dans `race_route` ; trois graines par cible, classement par D+ et virages ; si aucune variante ne passe la validation, message clair et saisie d'un GPX à la main |

## 12. Décisions à prendre avant P0

1. Nom du projet et domaine Vercel.
2. Nuxt confirmé (sinon Next/React, même plan).
3. ~~Modèle LLM par défaut.~~ Tranché le 16 sept. 2026 : `claude-sonnet-5` en effort `low` pour l'Imprévu et la recherche de course (§ 6).
4. Poids, FCmax, jours disponibles, contraintes : les valeurs de `athlete` du premier écran d'onboarding.
5. La date de reprise de la course à pied, à marquer dans l'app quand l'ongle ne fait plus mal en marchant. (Le 8 août, la blessure du genou et les dates de Paris / Madrid sont renseignés au § 0.)
