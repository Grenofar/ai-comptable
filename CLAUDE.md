AI Comptable
=============

Description
-----------
Application web de comptabilité assistée par des agents IA et des automatisations. Fonctions visées : générateur de factures et de devis avec numérotation automatique, gestion des clients, suivi des paiements et des dépenses, rapports, et agents IA qui saisissent, classent et relancent à la place de l'utilisateur.

Stack
-----
- Hébergement et fonctions serverless : Vercel, dossier api pour les endpoints, config dans vercel.json.
- Base de données, authentification et stockage : Supabase, avec Row Level Security activée sur toutes les tables.
- IA : API Gemini appelée directement depuis le navigateur. La clé API est saisie par l'utilisateur dans l'interface.
- Front : Vite + React + TypeScript, à confirmer.

Règles de sécurité
------------------
- La clé Gemini reste côté client, stockée dans le navigateur de l'utilisateur. Ne jamais l'envoyer au backend, ne jamais la stocker dans Supabase, ne jamais la journaliser.
- Aucune clé secrète dans le dépôt. Les variables d'environnement vont dans .env.local en local et dans les réglages du projet Vercel en production. Seul .env.example est versionné.
- Côté front, seules la clé anon Supabase et l'URL du projet sont utilisées. La clé service_role n'est jamais exposée au navigateur.
- Chaque table métier a une colonne user_id et des policies RLS qui limitent l'accès aux lignes de l'utilisateur connecté.
- Les sorties des agents IA sont traitées comme non fiables : validation du format et des montants avant toute écriture en base.

Structure du projet
-------------------
- api : fonctions serverless Vercel.
- src : application front.
- public : fichiers statiques.
- supabase/migrations : migrations SQL versionnées, une par changement de schéma.

Modèle de données prévu
-----------------------
- clients, produits ou services, devis, factures, lignes de document, paiements, dépenses.
- Numérotation séquentielle des devis et des factures par utilisateur et par année, sans trou.
- Montants stockés en centimes, en entiers. TVA et totaux recalculés côté serveur.

Agents IA et automatisations prévus
-----------------------------------
- Agent de rédaction : crée un devis ou une facture à partir d'une description en langage naturel.
- Agent de classement : catégorise les dépenses et les justificatifs.
- Agent de relance : prépare les relances pour factures impayées, validation humaine avant envoi.
- Toute action qui modifie la comptabilité demande une confirmation de l'utilisateur.

Conventions
-----------
- Langue de l'interface et des messages : français. Devise par défaut : euro.
- Code et commentaires : noms en anglais, textes affichés en français.
- Commits courts et explicites, un sujet par commit.
- Ne pas ajouter de dépendance sans justification.

Commandes
---------
- Installer : npm install
- Développement local : npm run dev, ou vercel dev pour tester les fonctions api.
- Déployer : vercel, puis vercel --prod.

Prochaines étapes
-----------------
Fait : package.json, vercel.json, front Vite + React + TypeScript, migrations (schéma, RLS, numérotation), saisie de la clé Gemini, devis et factures avec export PDF par impression, trois agents IA.

À faire :
1. Appliquer les migrations sur un vrai projet Supabase et tester les policies RLS.
2. Informations de l'émetteur (raison sociale, SIRET, mentions légales) sur les PDF.
3. Catalogue de produits dans l'interface (la table products existe déjà).
4. Tests automatisés (calculs de totaux, validation des sorties IA).
5. Édition des brouillons et conversion devis en facture.