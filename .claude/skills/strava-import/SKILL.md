---
name: strava-import
description: Importe les activités Strava de Ronan dans le cockpit, sans l'API Strava (réservée aux abonnés payants). Deux voies - l'archive d'export officielle pour l'historique complet, et la lecture de strava.com dans Chrome pour les activités récentes. Utiliser quand Ronan dit "importe mes activités", "récupère mes sorties", "synchronise Strava", "mets à jour ma charge", ou après une séance qu'il vient de faire.
---

# Import des activités Strava

L'API Strava est réservée aux abonnés payants depuis 2026 (constaté le 16 sept. 2026 :
« L'accès à l'API Strava est réservé aux abonné(e)s » sur `strava.com/settings/api`).
Ce skill contourne l'absence d'API par deux voies complémentaires.

Les deux voies aboutissent au même endpoint : `POST /api/activities/import`, qui rattache
chaque activité à la séance prévue correspondante (même sport à ± 1 jour), crée un imprévu
sinon, et recalcule la charge des jours touchés.

## Choisir la voie

| Situation | Voie |
|---|---|
| Premier import, ou plus de 30 jours de retard | **A — archive d'export** |
| Une à quelques séances récentes | **B — lecture dans Chrome** |

La voie A est officielle, gratuite et complète : préfère-la chaque fois que le volume le
justifie. La voie B lit les pages du compte de Ronan dans son propre navigateur ; c'est
son compte et ses données, en usage personnel et à faible volume, mais ce n'est pas un
accès prévu par Strava — ne t'en sers pas pour du volume que l'archive couvrirait mieux.

## Préparation commune

Le serveur de dev doit tourner et la session doit être ouverte.

```bash
cd /Users/laplijr/Documents/dev/cockpit-semi
COOKIES=$(mktemp)
PW=$(/usr/bin/grep '^NUXT_APP_PASSWORD=' .env | cut -d= -f2-)
curl -s -c "$COOKIES" -o /dev/null -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' -d "{\"password\":\"$PW\"}"
```

Garde `$COOKIES` pour tous les appels suivants. Si le serveur ne répond pas, lance-le avec
`preview_start` (configuration `cockpit`) avant de continuer.

## Voie A — archive d'export officielle

1. Demande à Ronan de lancer l'export s'il ne l'a pas déjà : `strava.com/athlete/delete_your_account`,
   bouton **« Demander votre archive »**. Strava envoie un lien par e-mail, généralement en
   quelques heures. Ne clique jamais toi-même sur quoi que ce soit d'autre sur cette page :
   elle sert aussi à supprimer le compte.
2. Quand il a le `.zip`, demande-lui son chemin. Le fichier utile est `activities.csv`.
3. Parse le CSV et construis le tableau JSON. Les colonnes varient selon la langue du compte ;
   repère-les par leur en-tête plutôt que par leur position. Correspondances usuelles :

   | Colonne CSV | Champ |
   |---|---|
   | `Activity ID` | `externalId` |
   | `Activity Date` | `date` (convertir en `YYYY-MM-DD`) et `startedAt` |
   | `Activity Name` | `name` |
   | `Activity Type` | `type` |
   | `Elapsed Time` / `Moving Time` | `durationS` (secondes) |
   | `Distance` | `distanceM` (attention : parfois en km) |
   | `Average Heart Rate` | `averageHr` |
   | `Max Heart Rate` | `maxHr` |
   | `Average Watts` | `averageWatts` |
   | `Elevation Gain` | `elevationGainM` |

4. Envoie par lots de 500 maximum (la route en accepte 2000, mais des lots plus petits
   donnent des erreurs lisibles).

## Voie B — lecture dans Chrome

1. Charge les outils Chrome en **un seul** appel `ToolSearch` :
   `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_close_mcp`
2. Ouvre `https://www.strava.com/athlete/training`. Si Ronan n'est pas connecté, arrête-toi
   et dis-le-lui : ne saisis jamais ses identifiants.
3. Lis la page avec `get_page_text`. Le journal d'entraînement liste, par activité : date,
   nom, type, distance, temps, dénivelé, et parfois la fréquence cardiaque moyenne.
4. Pour une activité dont il te faut la FC ou la durée exacte, ouvre sa page
   `https://www.strava.com/activities/<id>` et relis. Ne fais ça que pour les activités
   réellement nécessaires : une page par activité, pas plus.
5. **Ne récupère que les activités postérieures au dernier import.** Récupère cette borne
   ainsi :

   ```bash
   curl -s -b "$COOKIES" http://localhost:3000/api/activities/latest
   ```

6. Ferme l'onglet avec `tabs_close_mcp` quand tu as fini.

## Envoi

```bash
curl -s -b "$COOKIES" -X POST http://localhost:3000/api/activities/import \
  -H 'content-type: application/json' \
  -d @/chemin/vers/activities.json
```

Forme attendue :

```json
{
  "activities": [
    {
      "externalId": "12345678901",
      "name": "Sortie matinale",
      "type": "Run",
      "date": "2026-09-20",
      "startedAt": "2026-09-20T07:12:00+02:00",
      "durationS": 3180,
      "distanceM": 8200,
      "averageHr": 148,
      "maxHr": 171,
      "averageWatts": null,
      "elevationGainM": 64
    }
  ]
}
```

`externalId`, `type`, `date` et `durationS` sont obligatoires ; tout le reste accepte `null`.
`type` prend le libellé Strava brut (`Run`, `TrailRun`, `Ride`, `VirtualRide`,
`WeightTraining`…) : la correspondance vers les sports du cockpit est faite côté serveur.
Un `externalId` déjà connu met à jour l'activité au lieu de la dupliquer, donc un import
rejoué est sans danger.

## Après l'import

La réponse donne `{ imported, linked, days }`. Rends compte à Ronan en une ligne : combien
d'activités, combien rattachées à une séance prévue, et combien sont restées des imprévus.

Les activités rattachées n'entrent **pas** deux fois dans la charge : seule la séance compte,
une fois son ressenti saisi. Rappelle-lui donc de compléter le ressenti des séances
nouvellement marquées faites — c'est le RPE qui produit la charge, pas la distance.

## Ce qu'il ne faut pas faire

- Ne crée pas d'application sur `strava.com/settings/api` : elle serait refusée sans abonnement.
- N'accepte aucune condition d'utilisation à la place de Ronan.
- Ne télécharge pas les fichiers GPX/FIT de l'archive : le cockpit n'en fait rien aujourd'hui.
- N'invente jamais une valeur manquante. Une FC absente vaut `null` : le serveur retombe
  alors sur un RPE neutre de 5, ce qui est le comportement voulu.
