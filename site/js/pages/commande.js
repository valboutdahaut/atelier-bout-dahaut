// commande.js — étape 2 : coordonnées + mode de retrait, puis validation via
// la fonction RPC creer_commande (seul chemin d'écriture pour une commande,
// voir supabase/functions.sql). Le prix n'est jamais envoyé par le client :
// seuls produit_id et quantité le sont, le serveur relit le prix réel.

import { supabase } from '../supabase-client.js';
import { formatPrix } from '../lib/format.js';
import { getCart, clearCart } from '../cart.js';

const FRAIS_LIVRAISON_CENTS = 890;

const form = document.getElementById('form-commande');
const champAdresse = document.getElementById('champ-adresse');
const erreurEl = document.getElementById('erreur-commande');
const btnValider = document.getElementById('btn-valider');

let sousTotalCents = 0;

async function calculerSousTotal() {
  const cart = getCart();
  if (cart.length === 0) {
    window.location.replace('/boutique/panier.html');
    return;
  }
  const { data: produits } = await supabase
    .from('produits')
    .select('id, prix_cents, stock')
    .in('id', cart.map((l) => l.produit_id));

  sousTotalCents = cart.reduce((total, ligne) => {
    const produit = produits?.find((p) => p.id === ligne.produit_id);
    if (!produit) return total;
    return total + produit.prix_cents * Math.min(ligne.quantite, produit.stock);
  }, 0);

  mettreAJourResume();
}

function fraisLivraison() {
  const mode = document.querySelector('input[name="mode_retrait"]:checked').value;
  return mode === 'livraison' ? FRAIS_LIVRAISON_CENTS : 0;
}

function mettreAJourResume() {
  const frais = fraisLivraison();
  document.getElementById('sous-total').textContent = formatPrix(sousTotalCents);
  document.getElementById('frais-livraison').textContent = frais === 0 ? 'Gratuit' : formatPrix(frais);
  document.getElementById('total').textContent = formatPrix(sousTotalCents + frais);
}

document.querySelectorAll('input[name="mode_retrait"]').forEach((r) => {
  r.addEventListener('change', () => {
    champAdresse.hidden = r.form.mode_retrait.value !== 'livraison';
    mettreAJourResume();
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erreurEl.hidden = true;
  btnValider.disabled = true;
  btnValider.textContent = 'Envoi en cours…';

  const donnees = new FormData(form);
  const lignes = getCart().map((l) => ({ produit_id: l.produit_id, quantite: l.quantite }));

  const { data, error } = await supabase.rpc('creer_commande', {
    p_client_nom: donnees.get('nom'),
    p_client_email: donnees.get('email'),
    p_client_telephone: donnees.get('telephone') || null,
    p_mode_retrait: donnees.get('mode_retrait'),
    p_adresse_livraison: donnees.get('mode_retrait') === 'livraison' ? donnees.get('adresse') : null,
    p_lignes: lignes,
  });

  if (error) {
    erreurEl.textContent = error.message?.includes('stock')
      ? "Une des pièces de votre panier n'est plus disponible en quantité suffisante. Retournez au panier pour ajuster."
      : "Une erreur est survenue, merci de réessayer.";
    erreurEl.hidden = false;
    btnValider.disabled = false;
    btnValider.textContent = 'Passer commande';
    console.error('commande.js', error);
    return;
  }

  clearCart();
  sessionStorage.setItem('derniere-commande', JSON.stringify(data));
  window.location.href = '/boutique/confirmation.html';
});

calculerSousTotal();
