// commande.js — étape 2 : coordonnées + mode de retrait, puis validation via
// la fonction RPC creer_commande (seul chemin d'écriture pour une commande,
// voir supabase/functions.sql). Le prix n'est jamais envoyé par le client :
// seuls produit_id et quantité le sont, le serveur relit le prix réel.

import { supabase } from '../supabase-client.js';
import { formatPrix } from '../lib/format.js';
import { getCart } from '../cart.js';

const FRAIS_LIVRAISON_CENTS = 890;

// Mention imposée par le Code de la consommation sur le bouton qui engage le
// paiement. Gardée ici en constante parce que le bouton change de texte pendant
// l'envoi : sans elle, revenir en arrière après une erreur réécrirait un
// libellé approximatif et ferait tomber la conformité sans que ça se voie.
const LIBELLE_VALIDATION = 'Commande avec obligation de paiement';

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
    .select('id, titre, prix_cents, stock, retrait_showroom_seul')
    .in('id', cart.map((l) => l.produit_id));

  sousTotalCents = cart.reduce((total, ligne) => {
    const produit = produits?.find((p) => p.id === ligne.produit_id);
    if (!produit) return total;
    return total + produit.prix_cents * Math.min(ligne.quantite, produit.stock);
  }, 0);

  imposerRetraitSiNecessaire(cart, produits);
  mettreAJourResume();
}

/**
 * Une pièce qui ne part pas en colis fait basculer la commande entière en
 * retrait. Le choix « livraison » est laissé visible, barré et désactivé,
 * plutôt que retiré de la liste : le client l'a vu au panier, le faire
 * disparaître sans un mot le laisserait chercher une option évanouie.
 *
 * La même règle est posée dans creer_commande, côté serveur. Elle doit y être :
 * cette page peut rester ouverte pendant que l'atelier coche la case, et un
 * navigateur ne garantit jamais une règle de vente.
 */
function imposerRetraitSiNecessaire(cart, produits) {
  const titres = cart
    .map((ligne) => produits?.find((p) => p.id === ligne.produit_id))
    .filter((produit) => produit?.retrait_showroom_seul)
    .map((produit) => produit.titre);
  if (titres.length === 0) return;

  const radioLivraison = form.querySelector('input[name="mode_retrait"][value="livraison"]');
  form.querySelector('input[name="mode_retrait"][value="retrait_showroom"]').checked = true;
  radioLivraison.disabled = true;
  radioLivraison.closest('.choix-radio').classList.add('choix-indisponible');
  basculerAdresse(false);

  const liste = titres.map((t) => `« ${t} »`).join(', ');
  const avis = document.querySelector('[data-slot="avis-retrait"]');
  avis.textContent = titres.length === 1
    ? `${liste} ne peut pas être expédié : votre commande est à retirer au showroom de Rambouillet.`
    : `${liste} ne peuvent pas être expédiés : votre commande est à retirer au showroom de Rambouillet.`;
  avis.hidden = false;
}

/**
 * Traduit l'erreur de creer_commande en une phrase utile au client. Les
 * messages de la fonction serveur nomment la pièce et sont écrits pour un
 * journal technique, pas pour la personne qui essaie d'acheter.
 */
function messageErreurCommande(message) {
  if (message?.includes('showroom')) {
    return 'Une pièce de votre panier est à retirer au showroom et ne peut pas être livrée. '
      + 'Retournez au panier, le retrait vous sera proposé.';
  }
  if (message?.includes('stock')) {
    return "Une des pièces de votre panier n'est plus disponible en quantité suffisante. Retournez au panier pour ajuster.";
  }
  return 'Une erreur est survenue, merci de réessayer.';
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

// Commande déjà enregistrée en base, gardée de côté au cas où seule l'ouverture
// de la page de paiement échoue. Sans cela, le bouton « Réessayer le paiement »
// repasserait par creer_commande et enregistrerait une seconde commande, qui
// retirerait une seconde fois le stock.
let commandeEnregistree = null;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erreurEl.hidden = true;
  btnValider.disabled = true;
  btnValider.textContent = 'Envoi en cours…';

  const donnees = new FormData(form);
  const lignes = getCart().map((l) => ({ produit_id: l.produit_id, quantite: l.quantite }));

  let data = commandeEnregistree;

  if (!data) {
    const reponse = await supabase.rpc('creer_commande', {
      p_client_nom: donnees.get('nom'),
      p_client_email: donnees.get('email'),
      p_client_telephone: donnees.get('telephone') || null,
      p_mode_retrait: donnees.get('mode_retrait'),
      p_adresse_livraison: donnees.get('mode_retrait') === 'livraison' ? adresseComplete(donnees) : null,
      p_lignes: lignes,
    });

    if (reponse.error) {
      erreurEl.textContent = messageErreurCommande(reponse.error.message);
      erreurEl.hidden = false;
      btnValider.disabled = false;
      btnValider.textContent = LIBELLE_VALIDATION;
      console.error('commande.js', reponse.error);
      return;
    }
    data = reponse.data;
    commandeEnregistree = data;
  }

  // La commande est enregistrée et le stock réservé. Reste à la faire régler :
  // on demande au serveur de préparer le paiement, puis on confie le visiteur
  // à la page sécurisée de Stripe. Aucun numéro de carte ne transite par ce
  // site, ce qui évite d'avoir à le sécuriser pour cela.
  //
  // Le panier n'est PAS vidé ici : le visiteur peut encore renoncer sur la
  // page de paiement. Il est vidé sur la page de confirmation, une fois le
  // paiement avéré.
  btnValider.textContent = 'Redirection vers le paiement…';

  try {
    const url = await preparerPaiement(data.numero, donnees.get('email'));
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
