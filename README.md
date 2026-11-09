# AI Comptable

Site de comptabilité (clients, devis, factures, paiements, dépenses, tableau de bord) avec agents IA
(Gemini) pour aider à rédiger, classer et relancer. Hébergé sur Vercel, base de données et
authentification sur Supabase.

> **⚠️ Ce fichier doit être mis à jour à chaque changement notable** (déploiement, migration,
> fonctionnalité, dépendance, config de sécurité). Si tu es un agent IA ou un contributeur qui vient
> de faire une modification à ce dépôt, mets cette section à jour avant de terminer : état actuel,
> ce qui a changé, ce qui reste à faire. Ne laisse jamais ce fichier décrire un état obsolète.

## État actuel (2026-11-09)

- **Déployé** : https://ai-comptable.vercel.app
- **Supabase** : projet `gefeungrokakala@gmail.com's Project` (réf. `cuxfvyhrlqxysaffvaos`, région
  `eu-central-1`). Les 7 migrations de `supabase/migrations` sont appliquées sur ce projet.
- **Authentification** : e-mail/mot de passe et connexion Google (OAuth), toutes deux via Supabase
  Auth. Le fournisseur Google doit être activé côté tableau de bord Supabase (Authentication →
  Providers) avec un Client ID/Secret Google Cloud, et l'URL de redirection Supabase ajoutée dans la
  console Google Cloud.
- **Pages légales** : mentions légales, CGU, politique de confidentialité (`/mentions-legales`,
  `/cgu`, `/confidentialite`), accessibles même sans connexion. Les mentions légales contiennent des
  champs `[à compléter]` (identité de l'éditeur) à remplir avant toute exploitation commerciale.
- **Sécurité** : RLS activée sur toutes les tables métier, fonctions internes protégées
  (`search_path` fixe, non exposées via l'API REST), en-têtes de sécurité (CSP, HSTS,
  Permissions-Policy, X-Frame-Options) dans `vercel.json`.
- **À vérifier/compléter** : voir la section « À faire » ci-dessous.

## Stack

- Hébergement : Vercel (config dans `vercel.json`, dossier `api` pour d'éventuelles fonctions
  serverless).
- Base de données, authentification, stockage : Supabase, Row Level Security sur toutes les tables.
- Front : Vite + React + TypeScript (React Router).
- IA : API Gemini appelée depuis le navigateur avec la clé de l'utilisateur, jamais envoyée au
  serveur. Modèle par défaut `gemini-3.8-flash`, modifiable dans Réglages.

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

- `npm run build` : vérification TypeScript puis build de production.
- `vercel dev` : pour tester le dossier `api` (fonctions serverless) en plus du front.
- `vercel` puis `vercel --prod` : déployer.

## Sécurité et confidentialité

- La clé API Gemini de chaque utilisateur reste **uniquement dans son navigateur** (`localStorage`) :
  jamais envoyée à un serveur, jamais stockée en base, jamais journalisée. C'est le choix principal
  pour garder le maximum d'informations sensibles sur le poste de l'utilisateur et ne pas alourdir le
  quota (gratuit, limité) de la base Supabase.
- Chaque table métier a un `user_id` et des policies RLS qui limitent l'accès à son propriétaire ; les
  policies vérifient aussi la propriété des lignes parentes (un document ne peut référencer que des
  clients qui appartiennent au même utilisateur, par exemple).
- Aucune clé secrète dans le dépôt : `.env.local` en local, réglages Vercel en production. Seul
  `.env.example` est versionné. `SUPABASE_SERVICE_ROLE_KEY` n'est jamais exposée au navigateur, seules
  l'URL et la clé anon Supabase le sont.
- Les sorties des agents IA sont non fiables : toujours valider le format et les montants avant toute
  écriture, et toute action qui modifie la comptabilité demande une confirmation explicite.

## Structure

- `src/pages` : écrans (Login, Dashboard, Clients, Documents, DocumentForm, Expenses, Settings,
  Legal).
- `src/lib` : `supabase.ts`, `money.ts`, `gemini.ts`, `geminiKey.ts`, `agents.ts`, `print.ts`.
- `supabase/migrations` : migrations SQL versionnées, une par changement de schéma.
- `api`, `public` : fonctions serverless et fichiers statiques (vides pour l'instant).

## Règles comptables

- Montants en centimes, entiers. Les totaux sont recalculés par la base à partir des lignes.
- Un document reste brouillon sans numéro. Le numéro est attribué à l'émission, séquentiel par
  utilisateur, type et année, sans trou.
- Un document numéroté ne se supprime ni ne se renumérote : on l'annule.
- Une facture passe à payée quand les paiements couvrent son total.

## À faire

1. Remplacer les champs `[à compléter]` des mentions légales par l'identité réelle de l'éditeur
   (raison sociale, SIRET, adresse) avant toute exploitation commerciale.
2. Activer et configurer le fournisseur Google dans Supabase (Authentication → Providers) si ce n'est
   pas déjà fait, avec un Client ID/Secret Google Cloud dédié à ce projet.
3. Informations de l'émetteur (raison sociale, SIRET, mentions légales) sur les PDF de devis/factures.
4. Catalogue de produits dans l'interface (table `products` déjà créée).
5. Tests automatisés (totaux, validation des sorties IA).
6. Édition des brouillons et conversion devis en facture côté interface (les fonctions SQL existent :
   `update_draft_document`, `convert_quote_to_invoice`).
