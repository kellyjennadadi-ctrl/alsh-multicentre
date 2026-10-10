/*
# Multi-centre : centres uniques, centre d'origine conservé, temps réel des fiches enfants

1. Changes
- Index unique sur le nom des centres (les données sont rattachées au centre par son nom
  dans la colonne `centre_nom` : deux centres ne doivent jamais porter le même nom).
- Ajoute « École Pablo Neruda » dans la table `centres` si absent, pour que les données
  existantes restent accessibles via le sélecteur de centre (le nom n'est plus codé dans l'application).
- Ajoute `enfants` à la publication realtime : une fiche ajoutée/importée/modifiée sur un appareil
  apparaît sur les autres.

2. Security
- Aucun changement de RLS dans cette migration (voir CHANGES.md : les policies `anon` restent à durcir).
*/

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS centres_name_unique ON centres (lower(name));
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Index centres_name_unique non créé : des centres portent déjà le même nom. Renommez-les puis relancez.';
END $$;

INSERT INTO centres (name, pin_code, type)
SELECT 'École Pablo Neruda', '2026', 'Periscolaire'
WHERE NOT EXISTS (SELECT 1 FROM centres WHERE lower(name) = lower('École Pablo Neruda'));

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE enfants;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
