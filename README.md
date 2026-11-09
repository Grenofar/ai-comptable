# AI Comptable

Site de comptabilité multi-organisation (clients, devis, factures, paiements, dépenses, tableau de
bord) avec agents IA (Gemini) pour aider à rédiger, classer et relancer, plus une messagerie interne
et des tâches assignables entre membres d'une même équipe. Hébergé sur Vercel, base de données et
authentification sur Supabase.

> **⚠️ Ce fichier doit être mis à jour à chaque changement notable** (déploiement, migration,
> fonctionnalité, dépendance, config de sécurité). Si tu es un agent IA ou un contributeur qui vient
> de faire une modification à ce dépôt, mets cette section à jour avant de terminer : état actuel,
> ce qui a changé, ce qui reste à faire. Ne laisse jamais ce fichier décrire un état obsolète.

## État actuel (2026-11-09)

- **Déployé** : https://ai-comptable.vercel.app
- **Supabase** : projet `gefeungrokakala@gmail.com's Project` (réf. `cuxfvyhrlqxysaffvaos`, région
  `eu-central-1`). Toutes les migrations de `supabase/migrations` sont appliquées sur ce projet.
- **Organisations** : chaque inscription crée automatiquement une organisation personnelle (l'inscrit
  en est "owner"). Toutes les données métier (clients, devis, factures, dépenses...) sont rattachées
  à une organisation, pas à un seul utilisateur : plusieurs personnes dans la même organisation
  partagent les mêmes données. Rôles : `owner` (tout, y compris supprimer l'organisation),
  `admin` (gérer les membres et les réglages), `member` (utilisation courante). Page `/organisation`
  pour renommer, gérer les membres/rôles, inviter (par e-mail, uniquement des personnes ayant déjà un
  compte AI Comptable — aucun envoi d'e-mail d'invitation n'est implémenté) et créer d'autres
  organisations. Un sélecteur d'organisation est dans la navigation.
- **Profils** : page `/profil` (nom affiché, bio, photo de profil stockée dans le bucket Supabase
  Storage `avatars`, public en lecture, écriture limitée à son propriétaire).
- **Messagerie interne** (`/messages`) : un canal de groupe "Général" automatique par organisation
  (tous les membres y sont ajoutés/retirés automatiquement), plus des conversations privées à la
  demande via le bouton « + Nouveau message ». Pas de websocket : la liste de messages se rafraîchit
  par un polling simple toutes les 4 secondes.
- **Tâches** (`/taches`) : n'importe quel membre peut créer une tâche pour lui-même ; seuls
  owner/admin peuvent en assigner une à quelqu'un d'autre ("le chef assigne, l'employé exécute").
  Trois colonnes de statut (à faire / en cours / terminé).
- **Thème** : sombre par défaut, bascule claire dans Réglages → Apparence (mémorisée dans ce
  navigateur, `localStorage`).
- **Authentification** : e-mail/mot de passe et connexion Google (OAuth), toutes deux via Supabase
  Auth. Le fournisseur Google doit être activé côté tableau de bord Supabase (Authentication →
  Providers) avec un Client ID/Secret Google Cloud, et l'URL de redirection Supabase ajoutée dans la
  console Google Cloud (`https://cuxfvyhrlqxysaffvaos.supabase.co/auth/v1/callback`).
- **Pages légales** : mentions légales, CGU, politique de confidentialité (`/mentions-legales`,
  `/cgu`, `/confidentialite`), accessibles même sans connexion, contact éditeur
  grnfrscripts@gmail.com. Les mentions légales contiennent encore des champs `[à compléter]`
  (raison sociale, SIRET, adresse de l'éditeur) à remplir avant toute exploitation commerciale.
- **Sécurité** : RLS activée sur toutes les tables, scoping par organisation (appartenance vérifiée à
  chaque lecture/écriture), fonctions internes protégées (`search_path` fixe, non exposées via l'API
  REST sauf les RPC volontairement publiques comme `invite_member_by_email` ou `get_or_create_dm`,
  qui valident elles-mêmes les droits de l'appelant), en-têtes de sécurité (CSP, HSTS,
  Permissions-Policy, X-Frame-Options) dans `vercel.json`.
- **Générateur de devis/factures** : création, édition des brouillons (`update_draft_document`),
  émission avec numérotation séquentielle (par organisation, type et année), paiements, conversion
  devis accepté → facture (`convert_quote_to_invoice`), export PDF via impression navigateur
  (`src/lib/print.ts`). Le PDF reprend les mentions légales de l'émetteur (SIRET, TVA, IBAN...)
  renseignées dans Réglages, propres à l'organisation (et non plus à chaque utilisateur).
- **Non vérifié en conditions réelles** : l'espace connecté (organisations, messagerie, tâches) n'a
  pas pu être testé dans un navigateur dans cet environnement — Supabase a rejeté les adresses de
  test synthétiques, et créer un compte directement en base est bloqué par la politique de sécurité
  de cet environnement. Build et vérification TypeScript passent, le code SQL/React a été relu
  attentivement, mais un test manuel par un humain (créer un compte, une organisation, inviter un
  second compte, envoyer des messages, assigner une tâche) reste à faire avant mise en production
  réelle.
- **Vercel** : les variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) doivent
  être configurées manuellement dans le dashboard Vercel (Settings → Environment Variables) — le
  connecteur Vercel MCP de cette session n'a pas accès à la gestion de projet/déploiement (seulement
  Sandbox/Drive/Flags), donc cette étape ne peut pas être automatisée depuis ici.
- **À vérifier/compléter** : voir la section « À faire » ci-dessous.

## Stack

- Hébergement : Vercel (config dans `vercel.json`, dossier `api` pour d'éventuelles fonctions
  serverless).
- Base de données, authentification, stockage : Supabase, Row Level Security sur toutes les tables.
- Front : Vite + React + TypeScript (React Router).
- IA : API Gemini appelée depuis le navigateur avec la clé de l'utilisateur, jamais envoyée au
  serveur. Modèle sélectionné dans une liste déroulante (Réglages), avec option de saisie libre.

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
  jamais envoyée à un serveur, jamais stockée en base, jamais journalisée.
- Chaque table métier a un `organization_id` et des policies RLS qui limitent l'accès aux membres de
  cette organisation ; les policies vérifient aussi la cohérence des lignes parentes (un document ne
  peut référencer qu'un client de la même organisation, par exemple). Un `created_by` (ex `user_id`)
  trace qui a créé chaque ligne, à titre d'audit, mais n'intervient plus dans la sécurité.
- Les droits d'organisation (renommer, inviter, retirer un membre, changer un rôle, modifier le
  profil émetteur) sont réservés à `owner`/`admin`, appliqués à la fois côté RLS et côté interface.
- Aucune clé secrète dans le dépôt : `.env.local` en local, réglages Vercel en production. Seul
  `.env.example` est versionné. `SUPABASE_SERVICE_ROLE_KEY` n'est jamais exposée au navigateur, seules
  l'URL et la clé anon Supabase le sont.
- Les sorties des agents IA sont non fiables : toujours valider le format et les montants avant toute
  écriture, et toute action qui modifie la comptabilité demande une confirmation explicite.

## Structure

- `src/pages` : écrans (Login, Dashboard, Clients, Documents, DocumentForm, Expenses, Settings,
  Organisation, Profil, Messages, Tasks, Legal).
- `src/lib` : `supabase.ts`, `money.ts`, `gemini.ts`, `geminiKey.ts`, `agents.ts`, `print.ts`,
  `theme.ts` (thème sombre/clair), `org.tsx` (contexte organisation courante), `members.ts`.
- `src/components` : `Avatar.tsx`.
- `supabase/migrations` : migrations SQL versionnées, une par changement de schéma.
- `api`, `public` : fonctions serverless et fichiers statiques (favicon).

## Règles comptables

- Montants en centimes, entiers. Les totaux sont recalculés par la base à partir des lignes.
- Un document reste brouillon sans numéro. Le numéro est attribué à l'émission, séquentiel par
  organisation, type et année, sans trou.
- Un document numéroté ne se supprime ni ne se renumérote : on l'annule.
- Une facture passe à payée quand les paiements couvrent son total.

## À faire

1. Faire vérifier manuellement l'espace connecté (organisations, invitations, messagerie, tâches) par
   un humain — voir « Non vérifié en conditions réelles » ci-dessus.
2. Configurer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans Vercel (Settings → Environment
   Variables) puis redéployer — sans ça le site reste bloqué sur « Configuration requise ».
3. Remplacer les champs `[à compléter]` des mentions légales par l'identité réelle de l'éditeur
   (raison sociale, SIRET, adresse) avant toute exploitation commerciale.
4. Activer et configurer le fournisseur Google dans Supabase (Authentication → Providers).
5. Catalogue de produits dans l'interface (table `products` déjà créée et scopée par organisation).
6. Tests automatisés front (les contrôles SQL ont un test de fumée dans `supabase/tests/smoke.sql`,
   à adapter au nouveau modèle par organisation — il référence encore l'ancien modèle par utilisateur).
