// commande.js — étape 2 : coordonnées + mode de retrait, puis validation via
// la fonction RPC creer_commande (seul chemin d'écriture pour une commande,
// voir supabase/functions.sql). Le prix n'est jamais envoyé par le client :
// seuls produit_id et quantité le sont, le serveur relit le prix réel.

import { supabase } from '../supabase-client.js';
import { formatPrix } from '../lib/format.js';
import { getCart, clearCart } from '../cart.js';

const FRAIS_LIVRAISON_CENTS = 890;

/**
 * Recompose l'adresse à partir des quatre champs du formulaire, sur deux
 * lignes comme sur une enveloppe. La base garde une seule colonne texte :
 * découper la saisie évite les oublis, mais l'adresse reste à lire d'un bloc
 * au moment de préparer le colis.
 */
function adresseComplete(donnees) {
  const rue = [donnees.get('adresse-numero'), donnees.get('adresse-rue')]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(' ');
  const ville = [donnees.get('adresse-cp'), donnees.get('adresse-ville')]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return [rue, ville].filter(Boolean).join('\n') || null;
}

/**
 * Demande au serveur de préparer le paiement et renvoie l'adresse de la page
 * Stripe. Le montant n'est pas transmis : la fonction serveur le relit en base
 * à partir du numéro de commande (voir supabase/functions/creer-paiement).
 */
async function preparerPaiement(numero, email) {
  const { data, error } = await supabase.functions.invoke('creer-paiement', {
    body: { numero, email },
  });
  if (error) throw error;
  if (!data?.url) throw new Error(data?.erreur ?? 'Réponse inattendue du serveur de paiement');
  return data.url;
}

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

// Le numéro reste facultatif : toutes les adresses n'en ont pas (lieux-dits,
// hameaux). La rue, le code postal et la ville, eux, sont indispensables pour
// qu'un colis parte.
const ADRESSE_OBLIGATOIRE = ['adresse-rue', 'adresse-cp', 'adresse-ville'];

function basculerAdresse(livraison) {
  champAdresse.hidden = !livraison;
  // Les champs obligatoires suivent l'affichage : laissés requis une fois
  // masqués, le navigateur refuserait l'envoi en signalant une erreur sur un
  // champ invisible, sans que le client comprenne ce qu'on lui reproche.
  for (const nom of ADRESSE_OBLIGATOIRE) {
    const champ = form.elements.namedItem(nom);
    if (champ) champ.required = livraison;
  }
}

document.querySelectorAll('input[name="mode_retrait"]').forEach((r) => {
  r.addEventListener('change', () => {
    basculerAdresse(r.form.mode_retrait.value === 'livraison');
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
    p_adresse_livraison: donnees.get('mode_retrait') === 'livraison' ? adresseComplete(donnees) : null,
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

  // La commande est enregistrée et le stock réservé. Reste à la faire régler :
  // on demande au serveur de préparer le paiement, puis on confie le visiteur
  // à la page sécurisée de Stripe. Aucun numéro de carte ne transite par ce
  // site, ce qui évite d'avoir à le sécuriser pour cela.
  btnValider.textContent = 'Redirection vers le paiement…';
  sessionStorage.setItem('derniere-commande', JSON.stringify(data));

  try {
    const url = await preparerPaiement(data.numero, donnees.get('email'));
    clearCart();
    window.location.href = url;
  } catch (err) {
    console.error('commande.js : préparation du paiement', err);
    // Le panier n'est pas vidé : le visiteur doit pouvoir réessayer. Sa
    // commande existe déjà en base, l'atelier peut la reprendre à la main.
    erreurEl.textContent = `Votre commande ${data.numero} est bien enregistrée, mais la page de paiement n'a pas pu s'ouvrir. `
      + "Réessayez dans un instant, ou contactez l'atelier en indiquant ce numéro.";
    erreurEl.hidden = false;
    btnValider.disabled = false;
    btnValider.textContent = 'Réessayer le paiement';
  }
});

calculerSousTotal();
