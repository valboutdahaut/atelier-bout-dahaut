// confirmation.js — dernière étape du tunnel : dire au visiteur, sans mentir,
// où en est son paiement.
//
// Le visiteur n'est pas connecté et la table commandes lui est fermée (RLS) :
// elle contient les coordonnées de tout le monde. Il présente donc le couple
// numéro + jeton reçu dans l'adresse de retour construite par le serveur, et
// la fonction statut_commande lui renvoie le strict nécessaire.
//
// POINT IMPORTANT : arriver sur cette page ne prouve pas que le paiement a
// abouti. L'adresse peut être ouverte à la main, et un navigateur peut être
// fermé en cours de route. Seul Stripe sait si l'argent est arrivé, et il le
// dit au serveur de son côté (voir la fonction stripe-webhook). Ce message
// serveur à serveur met parfois une seconde de plus que la redirection du
// visiteur : d'où la relance ci-dessous, plutôt qu'une réponse définitive dès
// le premier essai.

import { supabase } from '../supabase-client.js';
import { formatPrix, echapper } from '../lib/format.js';
import { clearCart } from '../cart.js';

const contenuEl = document.getElementById('contenu-confirmation');

const params = new URLSearchParams(window.location.search);
const numero = params.get('commande');
const jeton = params.get('jeton');

// Le jeton ne reste pas dans la barre d'adresse : recopié dans un message ou
// laissé dans l'historique d'un ordinateur partagé, il donnerait à un tiers le
// suivi de la commande.
if (jeton) {
  const propre = new URL(window.location.href);
  propre.searchParams.delete('jeton');
  history.replaceState(null, '', propre.toString());
}

const DELAI_RELANCE_MS = 2000;
const RELANCES_MAX = 10; // environ vingt secondes d'attente au pire

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function titre(texte) {
  return `<h1 style="font-size:30px;margin:24px 0 12px">${texte}</h1>`;
}

function bouton(libelle, href) {
  return `<a class="btn btn-primary" href="${href}" style="margin-top:24px;display:inline-flex">${libelle}</a>`;
}

function recapitulatif(commande) {
  const remise = commande.mode_retrait === 'livraison'
    ? "Votre commande part à l'adresse indiquée."
    : 'Votre commande vous attend au showroom de Rambouillet.';
  return `
    <p style="color:var(--color-text-muted);margin-bottom:24px">
      Commande <strong>${echapper(commande.numero)}</strong> — ${formatPrix(commande.total_cents)}<br>${remise}
    </p>`;
}

function afficherPaye(commande) {
  // Le panier n'est vidé qu'ici, une fois le paiement confirmé. Vidé avant la
  // redirection, il laissait les mains vides le client qui renonce sur la page
  // de paiement, et l'obligeait à tout reprendre.
  clearCart();
  contenuEl.innerHTML = titre('Merci, votre paiement est confirmé !')
    + recapitulatif(commande)
    + `<p style="font-size:13.5px;color:var(--color-text-faint)">Vous recevez le reçu de paiement par email. Valérie prépare votre commande et vous écrit dès qu'elle est prête.</p>`
    + bouton('Retour à la boutique', '/boutique/index.html');
}

function afficherEnAttente(commande) {
  contenuEl.innerHTML = titre('Votre commande est enregistrée')
    + recapitulatif(commande)
    + `<p style="font-size:13.5px;color:var(--color-text-faint)">
        La confirmation de paiement de notre banque n'est pas encore arrivée. C'est fréquent et sans gravité :
        si votre banque a bien validé le paiement, tout se met à jour d'ici quelques minutes et vous recevrez le reçu par email.
        En cas de doute, écrivez à l'atelier en indiquant le numéro ci-dessus.</p>`
    + bouton("Écrire à l'atelier", '/contact.html?sujet=Commande');
}

function afficherNonAboutie(commande) {
  contenuEl.innerHTML = titre("Le paiement n'a pas abouti")
    + `<p style="color:var(--color-text-muted);margin-bottom:24px">
        La commande ${echapper(commande.numero)} a été annulée et les pièces sont remises en vente.
        Rien ne vous a été débité.</p>`
    + bouton('Retour à la boutique', '/boutique/index.html');
}

function afficherIntrouvable() {
  contenuEl.innerHTML = titre('Aucune commande à afficher')
    + `<p style="color:var(--color-text-muted)">Cette page se remplit au retour du paiement.
        Retournez à la <a href="/boutique/index.html">boutique</a> pour passer commande.</p>`;
}

async function lireStatut() {
  const { data, error } = await supabase.rpc('statut_commande', {
    p_numero: numero,
    p_jeton: jeton,
  });
  if (error) {
    console.error('confirmation.js', error);
    return null;
  }
  return data; // null si le couple numéro + jeton ne correspond à rien
}

async function suivre() {
  if (!numero || !jeton) {
    afficherIntrouvable();
    return;
  }

  for (let essai = 0; essai <= RELANCES_MAX; essai += 1) {
    const commande = await lireStatut();

    if (!commande) {
      afficherIntrouvable();
      return;
    }
    if (commande.paiement_statut === 'paye' || commande.paiement_statut === 'non_requis') {
      afficherPaye(commande);
      return;
    }
    if (commande.paiement_statut !== 'en_attente') {
      afficherNonAboutie(commande);
      return;
    }

    // Toujours en attente : on laisse au message de Stripe le temps d'arriver,
    // et on le dit, plutôt que de laisser tourner un chargement muet.
    if (essai === 0) {
      contenuEl.innerHTML = titre('Merci !')
        + '<p style="color:var(--color-text-muted)">Nous confirmons votre paiement…</p>';
    }
    if (essai < RELANCES_MAX) await attendre(DELAI_RELANCE_MS);
    else afficherEnAttente(commande);
  }
}

suivre();
