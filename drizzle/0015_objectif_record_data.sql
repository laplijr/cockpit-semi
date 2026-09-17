-- Custom SQL migration file, put your code below! --

-- Le mode « performance maximale » disparaît au profit de « record » (§ 9, P5.15).
-- Les courses qui le portaient repassent en « temps » avec leurs trois niveaux
-- vides : la référence du mode record est le meilleur résultat représentatif sur
-- la distance, et ces courses n'en ont pas. Sans cette conversion, le changement
-- de type de l'étape suivante échouerait sur une valeur devenue inconnue.
UPDATE "race" SET "objective_mode" = 'temps' WHERE "objective_mode" = 'performance_max';
