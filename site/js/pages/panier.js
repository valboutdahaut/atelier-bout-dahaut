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
    .select('id, titre, slug, sous_titre, prix_cents, photos, stock')
    .in('id', ids);

  if (error) {
    lignesEl.innerHTML = '<p class="empty-state">Impossible de charger votre panier pour le moment.</p>';
    return;
  }

  const template = document.getElementById('tpl-ligne-panier');
  lignesEl.innerHTML = '';
  let sousTotal = 0;

  for (const ligne of cart) {
    const produit = produits.find((p) => p.id === ligne.produit_id);
    if (!produit) continue; // produit supprimé depuis
    const qte = Math.min(ligne.quantite, produit.stock);
    sousTotal += produit.prix_cents * qte;

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
  document.getElementById('sous-total').textContent = formatPrix(sousTotal);
  document.getElementById('total').textContent = formatPrix(sousTotal);
}

charger();
