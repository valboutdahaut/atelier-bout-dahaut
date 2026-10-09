// panier.js — étape 1 du tunnel. Relit toujours les prix/stock actuels
// depuis Supabase (le panier localStorage ne contient que produit_id + qté).

import { supabase } from '../supabase-client.js';
import { formatPrix } from '../lib/format.js';
import { getCart, setQuantite, removeFromCart } from '../cart.js';

const lignesEl = document.getElementById('lignes-panier');
const resumeEl = document.getElementById('resume-panier');

async function charger() {
  const cart = getCart();
  if (cart.length === 0) {
    lignesEl.innerHTML = '<p class="empty-state">Votre panier est vide. <a href="/boutique/index.html">Retour à la boutique</a>.</p>';
    resumeEl.hidden = true;
    return;
  }

  const ids = cart.map((l) => l.produit_id);
  const { data: produits, error } = await supabase
    .from('produits')
    .select('id, titre, slug, sous_titre, prix_cents, photos, stock, retrait_showroom_seul')
    .in('id', ids);

  if (error) {
    lignesEl.innerHTML = '<p class="empty-state">Impossible de charger votre panier pour le moment.</p>';
    return;
  }

  const template = document.getElementById('tpl-ligne-panier');
  lignesEl.innerHTML = '';
  let sousTotal = 0;
  const titresRetraitSeul = [];

  for (const ligne of cart) {
    const produit = produits.find((p) => p.id === ligne.produit_id);
    if (!produit) continue; // produit supprimé depuis
    const qte = Math.min(ligne.quantite, produit.stock);
    sousTotal += produit.prix_cents * qte;
    if (produit.retrait_showroom_seul) titresRetraitSeul.push(produit.titre);

    const node = template.content.cloneNode(true);
    const photo = node.querySelector('[data-slot="photo"]');
    if (produit.photos?.[0]) photo.style.background = `center/cover no-repeat url("${produit.photos[0]}")`;
    const titreEl = node.querySelector('[data-slot="titre"]');
    titreEl.href = `/boutique/produit.html?slug=${encodeURIComponent(produit.slug)}`;
    titreEl.textContent = produit.titre;
    node.querySelector('[data-slot="meta"]').textContent = produit.sous_titre ?? '';
    node.querySelector('[data-slot="quantite"]').textContent = qte;
    node.querySelector('[data-slot="sous-total"]').textContent = formatPrix(produit.prix_cents * qte);

    node.querySelector('[data-action="moins"]').addEventListener('click', () => {
      setQuantite(produit.id, qte - 1);
      charger();
    });
    node.querySelector('[data-action="plus"]').addEventListener('click', () => {
      setQuantite(produit.id, Math.min(qte + 1, produit.stock));
      charger();
    });
    node.querySelector('[data-slot="retirer"]').addEventListener('click', () => {
      removeFromCart(produit.id);
      charger();
    });

    lignesEl.appendChild(node);
  }

  resumeEl.hidden = false;
  annoncerRetraitObligatoire(titresRetraitSeul);
  document.getElementById('sous-total').textContent = formatPrix(sousTotal);
  document.getElementById('total').textContent = formatPrix(sousTotal);
}

/**
 * Une seule pièce non expédiable fait basculer toute la commande en retrait :
 * on ne sait pas livrer la moitié d'un panier. Annoncé dès cette page, pour
 * qu'un client qui tenait à être livré puisse encore retirer la pièce de son
 * panier, au lieu de le découvrir à l'étape suivante.
 *
 * Les deux branches comptent : charger() est rejoué à chaque changement de
 * quantité, et la livraison doit revenir si la pièce en cause est retirée.
 */
function annoncerRetraitObligatoire(titres) {
  const note = document.querySelector('[data-slot="note-recuperation"]');
  const blocLivraison = document.querySelector('[data-slot="mode-livraison"]');

  if (titres.length === 0) {
    note.textContent = "Le mode de récupération se choisit à l'étape suivante.";
    blocLivraison.querySelector('p').textContent = '8,90 €, partout en France.';
    blocLivraison.classList.remove('mode-indisponible');
    return;
  }

  blocLivraison.querySelector('p').textContent = 'Non disponible pour ce panier.';
  blocLivraison.classList.add('mode-indisponible');

  const liste = titres.map((t) => `« ${t} »`).join(', ');
  note.textContent = titres.length === 1
    ? `${liste} ne peut pas être expédié : votre commande sera à retirer au showroom de Rambouillet.`
    : `${liste} ne peuvent pas être expédiés : votre commande sera à retirer au showroom de Rambouillet.`;
}

/**
 * Retour d'un paiement abandonné sur la page Stripe.
 *
 * La commande existe déjà en base et elle a réservé le stock : creer_commande
 * retire les pièces dès l'enregistrement, pour que deux clients n'achètent pas
 * le même fauteuil pendant qu'ils paient. Si on laissait cette réservation
 * courir jusqu'à son expiration, le client qui vient de renoncer ne pourrait
 * même pas se raviser : sa propre commande lui bloquerait la pièce pendant une
 * heure. On libère donc tout de suite.
 *
 * Le jeton sert de preuve : il n'est connu que de ce visiteur, et la fonction
 * n'annule que des commandes encore en attente de paiement.
 */
async function traiterRetourPaiement() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('paiement') !== 'annule') return;

  const numero = params.get('commande');
  const jeton = params.get('jeton');

  // L'adresse est nettoyée tout de suite : le jeton ne doit rester ni dans
  // l'historique ni dans un signet, et un rechargement ne doit pas rejouer
  // l'annulation.
  history.replaceState(null, '', window.location.pathname);

  if (numero && jeton) {
    const { error } = await supabase.rpc('annuler_paiement_client', {
      p_numero: numero,
      p_jeton: jeton,
    });
    if (error) console.error('panier.js : annulation', error);
  }

  const avis = document.getElementById('avis-paiement');
  avis.className = 'status-msg success';
  avis.textContent = 'Paiement abandonné. Rien ne vous a été débité et votre panier est intact : '
    + 'vous pouvez reprendre votre commande quand vous voulez.';
  avis.hidden = false;
}

// La libération du stock passe d'abord : sans cela, la page afficherait les
// quantités plafonnées d'avant, et un article encore réservé par la commande
// que l'on vient justement d'annuler apparaîtrait épuisé.
traiterRetourPaiement().finally(charger);
