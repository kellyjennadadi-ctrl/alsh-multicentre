# Modifications — multi-centres, pointage, sécurité d'accès

## Fichiers modifiés
| Fichier | Changement |
|---|---|
| `src/lib/auth.tsx` | Plus aucun centre/identité figé. Démarrage non connecté, sans centre. `selectCentre` vérifie réellement le code du centre. Fiche équipe créée dans le centre choisi. Liste des centres mise en cache (choix possible hors-ligne). `localSignIn` supprimé. Accès démo désactivé par défaut. |
| `src/App.tsx` | Écran de connexion simplifié (la sélection du centre passe par `CentreSelectionScreen`, liste réelle des centres). `AppContent` réinitialisé à chaque changement de centre (`key`). **Les fiches enfants (PAI, régime, inscriptions) sont maintenant chargées depuis la base** + temps réel + resynchro au retour sur l'app. Pointage : écriture par `upsert` (plus de doublons), bug de l'état « présent/absent » inversé corrigé. |
| `src/lib/useOfflineSync.ts` | File hors-ligne distincte par centre, purge des entrées obsolètes, `upsert`. |
| `src/types.ts` | `Child.regime`. |
| `src/tabs/PointageTab.tsx` | Badge régime alimentaire ; destinations ALSH = autres centres de la plateforme. |
| `src/tabs/PlanningTab.tsx` | Nom du centre dynamique, vrai sélecteur « Changer de structure », regroupements ALSH dynamiques. |
| `src/tabs/DirectionTab.tsx` | Suppression e-mails / mot de passe codés en dur ; connexion Direction = vrai compte avec rôle directeur/adjoint ; PIN adjoint par défaut = code du centre. |
| `src/tabs/EquipeDirectionPage.tsx` | Code d'invitation = code réel du centre (plus « PABLO2026 »), caractère parasite « n » supprimé. |
| `src/tabs/PrintGrilles.tsx`, `src/tabs/EspaceTab.tsx`, `src/data/mockData.ts`, `src/components/LoginScreen.tsx` | Nom de centre dynamique. |
| `supabase/migrations/20261007120000_multicentre_enfants_realtime.sql` | **Nouveau — à exécuter** : nom de centre unique, centre Pablo Neruda inscrit en base, realtime sur `enfants`. |

## Non vérifié
Le projet n'a pas pu être compilé ni lancé ici (dépendances npm inaccessibles). Seule la syntaxe TypeScript a été contrôlée.
Avant tout déploiement : `npm install && npm run typecheck && npm run build`, puis test manuel (voir liste dans la réponse).

## Points à traiter (non modifiés)
1. **RLS** : les policies `TO anon, authenticated USING (true)` donnent accès à toutes les données (enfants, PAI, téléphones) de tous les centres à toute personne possédant la clé publique. À remplacer par une table `centre_membres (user_id, centre_nom, role)` + policies basées sur `auth.uid()`.
2. Le code d'accès du centre est lisible côté client (`centres.pin_code`) : c'est une barrière d'interface, pas de sécurité. Idem pour le rôle (choisi à l'inscription).
3. Pointages liés à `enfant_nom` : deux enfants homonymes dans un centre partagent la même ligne.
4. Données rattachées par `centre_nom` : renommer un centre dissocie ses données.
5. Hors-ligne : pas de cache des fiches enfants (choix RGPD) → un démarrage à froid sans réseau affiche une liste vide.
