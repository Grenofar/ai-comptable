# AI Comptable

Site web de comptabilité (clients, devis, factures, paiements, dépenses, tableau de bord), hébergé sur Vercel avec Supabase pour la base de données et l'authentification. Des agents IA (Gemini) aident à rédiger, classer et relancer.

## Stack

- Hébergement : Vercel (config dans `vercel.json`, dossier `api` pour d'éventuelles fonctions serverless).
- Base de données, authentification, stockage : Supabase, Row Level Security sur toutes les tables.
- Front : Vite + React + TypeScript (React Router).
- IA : API Gemini appelée depuis le navigateur avec la clé de l'utilisateur. Modèle par défaut gemini-3.8-flash, modifiable dans Réglages (gemini-2.0-flash est arrêté depuis le 1er juin 2026, vérifier https://ai.google.dev/gemini-api/docs/deprecations).

## Commandes

- `npm install` : installer.
- `npm run dev` : développement local (`vercel dev` pour tester `api`).
- `npm run build` : vérification TypeScript puis build de production.
- `vercel`, puis `vercel --prod` : déployer.

## Structure

- `src/pages` : écrans (Login, Dashboard, Clients, Documents, DocumentForm, Expenses, Settings).
- `src/lib` : `supabase.ts`, `money.ts`, `gemini.ts`, `geminiKey.ts`, `agents.ts`, `print.ts`.
- `supabase/migrations` : migrations SQL versionnées, une par changement de schéma.
- `api`, `public` : fonctions serverless et fichiers statiques (vides pour l'instant).

## Règles de sécurité

- La clé Gemini reste dans le navigateur (localStorage). Ne jamais l'envoyer au backend, la stocker dans Supabase ou la journaliser.
- Aucune clé secrète dans le dépôt : `.env.local` en local, réglages Vercel en production. Seul `.env.example` est versionné.
- Côté front : uniquement l'URL et la clé anon Supabase. `SUPABASE_SERVICE_ROLE_KEY` n'est jamais exposée au navigateur.
- Chaque table métier a `user_id` et des policies RLS limitant l'accès à l'utilisateur connecté.
- Les sorties des agents IA sont non fiables : valider format et montants avant toute écriture. Toute action qui modifie la comptabilité demande une confirmation.

## Règles comptables

- Montants en centimes, entiers. Les totaux sont recalculés par la base à partir des lignes.
- Un document reste brouillon sans numéro. Le numéro est attribué à l'émission, séquentiel par utilisateur, type et année, sans trou.
- Un document numéroté ne se supprime ni ne se renumérote : on l'annule.
- Une facture passe à payée quand les paiements couvrent son total.

## Conventions

- Interface et messages en français, devise euro. Code et commentaires : noms en anglais, textes affichés en français.
- Commits courts, un sujet par commit. Ne pas ajouter de dépendance sans justification.
- Écrire les fichiers en UTF-8 sans BOM (un BOM dans `package.json` casse le build).

## À faire

1. Appliquer les migrations sur un vrai projet Supabase et tester la RLS.
2. Informations de l'émetteur (raison sociale, SIRET, mentions légales) sur les PDF.
3. Catalogue de produits dans l'interface (table `products` déjà créée).
4. Tests automatisés (totaux, validation des sorties IA).
5. Édition des brouillons et conversion devis en facture.