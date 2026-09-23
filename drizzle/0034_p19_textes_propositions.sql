-- Custom SQL migration file, put your code below! --

-- Les textes du moteur s'écrivent en français depuis P19 : « 5,1 km » et
-- « 22 nov. » au lieu de « 5.1 km » et « 2026-11-22 », et le nom de la séance
-- au lieu de son code. Les propositions écrites avant gardaient l'ancien texte,
-- dans « À décider » comme dans l'historique : on les réécrit comme le moteur
-- les écrirait aujourd'hui (`server/domain/shared/french.ts`).

-- I1 et R8 nommaient la séance par son code : « SL le 2026-11-22 », « EF en course ».
WITH label(code, name) AS (
  VALUES
    ('EF', 'Endurance fondamentale'), ('droites', 'Lignes droites et éducatifs'),
    ('SL', 'Sortie longue'), ('seuil', 'Seuil'), ('VMA', 'VMA'), ('allure_semi', 'Allure semi'),
    ('cotes', 'Côtes courtes'), ('progressif', 'Progressif'), ('test', 'Test 20 minutes'),
    ('Z2', 'Endurance Z2'), ('SL_velo', 'Sortie longue vélo'),
    ('force_cadence', 'Force basse cadence'), ('sweet_spot', 'Sweet spot'), ('legs', 'Legs'),
    ('push', 'Push'), ('pull', 'Pull'), ('mobilite', 'Mobilité'), ('puissance', 'Puissance'),
    ('reprise', 'Reprise'), ('velo', 'Vélo'), ('full', 'Full'), ('appuis', 'Appuis'),
    ('tronc', 'Tronc'), ('rappel', 'Rappel')
)
UPDATE "proposal" AS p
SET "before" = l.name || substr(p."before", length(l.code) + 1)
FROM label AS l
WHERE p."rule_id" IN ('I1', 'R8') AND split_part(p."before", ' ', 1) = l.code;
--> statement-breakpoint
WITH label(code, name) AS (
  VALUES
    ('EF', 'Endurance fondamentale'), ('droites', 'Lignes droites et éducatifs'),
    ('SL', 'Sortie longue'), ('seuil', 'Seuil'), ('VMA', 'VMA'), ('allure_semi', 'Allure semi'),
    ('cotes', 'Côtes courtes'), ('progressif', 'Progressif'), ('test', 'Test 20 minutes'),
    ('Z2', 'Endurance Z2'), ('SL_velo', 'Sortie longue vélo'),
    ('force_cadence', 'Force basse cadence'), ('sweet_spot', 'Sweet spot'), ('legs', 'Legs'),
    ('push', 'Push'), ('pull', 'Pull'), ('mobilite', 'Mobilité'), ('puissance', 'Puissance'),
    ('reprise', 'Reprise'), ('velo', 'Vélo'), ('full', 'Full'), ('appuis', 'Appuis'),
    ('tronc', 'Tronc'), ('rappel', 'Rappel')
)
UPDATE "proposal" AS p
SET "after" = l.name || substr(p."after", length(l.code) + 1)
FROM label AS l
WHERE p."rule_id" = 'I1' AND split_part(p."after", ' ', 1) = l.code;
--> statement-breakpoint

-- R2 écrivait ses distances au point décimal.
UPDATE "proposal"
SET
  "before" = regexp_replace("before", '(\d)\.(\d) km', '\1,\2 km', 'g'),
  "after" = regexp_replace("after", '(\d)\.(\d) km', '\1,\2 km', 'g')
WHERE "before" ~ '\d\.\d km' OR "after" ~ '\d\.\d km';
--> statement-breakpoint

-- R1, R6, R100, R101, I1 et C1 écrivaient des dates ISO : « 2026-11-05 » devient « 5 nov. ».
DO $$
DECLARE
  months text[] := ARRAY['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  pattern text;
BEGIN
  FOR month IN 1..12 LOOP
    pattern := '\d{4}-' || lpad(month::text, 2, '0') || '-0?(\d{1,2})';
    UPDATE "proposal"
    SET
      "before" = regexp_replace("before", pattern, '\1 ' || months[month], 'g'),
      "after" = regexp_replace("after", pattern, '\1 ' || months[month], 'g'),
      "explanation" = regexp_replace("explanation", pattern, '\1 ' || months[month], 'g')
    WHERE "before" ~ pattern OR "after" ~ pattern OR "explanation" ~ pattern;
  END LOOP;
END $$;
