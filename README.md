# AI Comptable

Application web de comptabilité assistée par IA : clients, devis, factures avec numérotation automatique, paiements, dépenses, tableau de bord et trois agents IA (rédaction, classement, relance).

## Démarrage

1. `npm install`
2. Copier `.env.example` vers `.env.local` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
3. Appliquer les migrations de `supabase/migrations` dans l'ordre (SQL Editor Supabase ou `supabase db push`).
4. `npm run dev`
5. Dans l'app, ouvrir Réglages et saisir sa clé API Gemini.

## Sécurité

- La clé Gemini reste dans le navigateur (localStorage). Elle n'est jamais envoyée au backend ni stockée en base.
- Row Level Security activée sur toutes les tables : chaque utilisateur n'accède qu'à ses lignes.
- Seules l'URL et la clé anon Supabase sont utilisées côté navigateur. `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais être exposée au front.
- Les sorties des agents IA sont validées (format, montants) avant toute utilisation, et rien n'est écrit sans action de l'utilisateur.

## Fonctionnement

- Montants stockés en centimes. Les totaux d'un document sont recalculés par la base à partir des lignes.
- Un devis ou une facture reste en brouillon sans numéro. Le numéro (`DEV-2026-0001`, `FAC-2026-0001`) est attribué à l'émission, de façon séquentielle par utilisateur, type et année, ce qui évite les trous.
- Un document numéroté ne peut plus être supprimé ni renuméroté : on l'annule.
- Une facture passe à « Payée » quand les paiements couvrent son total.
- Le bouton PDF ouvre une page imprimable ; choisir « Enregistrer au format PDF ».

## Déploiement

`vercel` puis `vercel --prod`. Définir les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les réglages du projet Vercel.

## Limites connues

- Pas encore de gestion des informations de l'émetteur (raison sociale, SIRET, mentions légales) sur les PDF.
- Pas de tests automatisés ; les migrations n'ont pas été exécutées sur une base réelle depuis cet environnement.