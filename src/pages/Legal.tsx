import { ReactNode } from "react";
import { Link } from "react-router-dom";

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="card legal">
      <Link to="/" className="link">&larr; Retour</Link>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

export function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales">
      <p className="hint">
        À compléter par l'éditeur de ce service avant toute mise en production commerciale.
      </p>
      <h2>Éditeur</h2>
      <p>
        Raison sociale : [à compléter] — Forme juridique : [à compléter] — SIRET : [à compléter]
        <br />
        Adresse du siège : [à compléter] — Contact : [à compléter]
      </p>
      <h2>Hébergement</h2>
      <p>
        Application (front-end) : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.
        <br />
        Base de données et authentification : Supabase Inc., hébergées sur des serveurs situés dans
        l'Union européenne (région eu-central-1).
      </p>
      <h2>Directeur de la publication</h2>
      <p>[à compléter]</p>
    </LegalPage>
  );
}

export function Cgu() {
  return (
    <LegalPage title="Conditions générales d'utilisation">
      <h2>1. Objet</h2>
      <p>
        AI Comptable est un outil de gestion de clients, devis, factures, paiements et dépenses. Les
        fonctions d'assistance par intelligence artificielle (rédaction, classement, relance) sont
        fournies à titre d'aide : leurs résultats doivent être vérifiés avant toute validation, en
        particulier les montants et les mentions légales des documents émis.
      </p>
      <h2>2. Compte utilisateur</h2>
      <p>
        L'accès se fait par e-mail et mot de passe ou par connexion Google. Vous êtes responsable de
        la confidentialité de vos identifiants et de toute action effectuée depuis votre compte.
      </p>
      <h2>3. Responsabilité</h2>
      <p>
        Les documents émis (devis, factures) engagent leur émetteur. L'éditeur du service ne garantit
        pas l'exactitude des suggestions produites par les agents IA et ne peut être tenu responsable
        des conséquences d'une validation sans vérification.
      </p>
      <h2>4. Résiliation</h2>
      <p>
        Vous pouvez supprimer votre compte à tout moment depuis les réglages ou en en faisant la
        demande ; vos données sont alors effacées conformément à la politique de confidentialité.
      </p>
      <h2>5. Droit applicable</h2>
      <p>Droit français, sous réserve des dispositions impératives applicables à votre lieu de résidence.</p>
    </LegalPage>
  );
}

export function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité">
      <h2>Données traitées</h2>
      <p>
        Compte : e-mail et, si vous utilisez la connexion Google, votre identifiant et nom Google.
        Comptabilité : clients, devis, factures, paiements, dépenses que vous saisissez. Ces données
        restent strictement privées : chaque compte n'accède qu'à ses propres données (sécurité au
        niveau des lignes activée sur chaque table).
      </p>
      <h2>Clé API Gemini</h2>
      <p>
        Si vous activez les assistants IA, votre clé API Gemini est enregistrée uniquement dans le
        stockage local de votre navigateur (localStorage). Elle n'est jamais transmise à nos serveurs,
        jamais stockée en base, jamais journalisée. Elle n'est envoyée qu'à l'API Gemini de Google,
        directement depuis votre navigateur, pour chaque demande d'assistance.
      </p>
      <h2>Sous-traitants</h2>
      <ul>
        <li>Vercel Inc. — hébergement de l'application.</li>
        <li>Supabase Inc. — base de données et authentification (région Union européenne).</li>
        <li>Google LLC — authentification « Connexion avec Google » et API Gemini (si vous l'activez).</li>
      </ul>
      <h2>Conservation</h2>
      <p>
        Vos données de comptabilité sont conservées tant que votre compte existe. Un document
        numéroté (devis ou facture émis) n'est jamais supprimé, conformément aux obligations
        comptables ; il peut être annulé.
      </p>
      <h2>Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de
        portabilité de vos données. Vous pouvez exercer ces droits depuis l'application ou en
        contactant l'éditeur (voir mentions légales).
      </p>
      <h2>Cookies</h2>
      <p>
        Le service n'utilise que des cookies strictement nécessaires à l'authentification (gérés par
        Supabase). Aucun cookie publicitaire ou de mesure d'audience tiers n'est déposé.
      </p>
    </LegalPage>
  );
}
