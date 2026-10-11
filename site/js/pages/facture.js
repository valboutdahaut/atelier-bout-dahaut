// facture.js — facture ou avoir imprimable, lu via ?commande= et ?jeton=
//
// Le client n'a pas de compte. Il prouve son achat par le jeton inscrit dans
// l'adresse, impossible à deviner, exactement comme sur la page de
// confirmation. La fonction facture_commande() ne répond que sur présentation
// du bon couple, et refuse une commande qui n'a pas été facturée.
//
// Contrairement aux autres pages publiques, celle-ci affiche des données
// personnelles : une facture porte par obligation le nom et l'adresse de son
// destinataire. C'est le jeton qui rend la consultation légitime, et c'est
// pourquoi la page est interdite aux moteurs de recherche.
//
// La même page sert les deux documents. Avec ?avoir=AV-2026-0001, elle affiche
// cet avoir précis : une facture peut en porter plusieurs, par exemple si une
// cliente renvoie un article puis un autre.

import { supabase } from '../supabase-client.js';
import { formatPrix } from '../lib/format.js';
import { rendreMarkdownLite } from '../lib/markdown-lite.js';

const contenuEl = document.getElementById('contenu-facture');
const params = new URLSearchParams(location.search);
const numero = params.get('commande');
const jeton = params.get('jeton');
const numeroAvoir = params.get('avoir');

const JOUR = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });
const jour = (iso) => (iso ? JOUR.format(new Date(iso)) : '');

function introuvable(message) {
  contenuEl.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.style.padding = '96px 0';
  p.textContent = message;
  contenuEl.appendChild(p);
}

function ligneTotal(libelle, valeur, fort = false) {
  const tr = document.createElement('tr');
  if (fort) tr.className = 'total';
  const cellule = document.createElement('td');
  cellule.colSpan = 3;
  cellule.textContent = libelle;
  const montant = document.createElement('td');
  montant.className = 'nombre';
  montant.textContent = valeur;
  tr.append(cellule, montant);
  return tr;
}

function ligneArticle(article) {
  const tr = document.createElement('tr');
  const cases = [
    [article.titre, ''],
    [String(article.quantite), 'nombre'],
    [formatPrix(article.prix_unitaire_cents), 'nombre'],
    [formatPrix(article.prix_unitaire_cents * article.quantite), 'nombre'],
  ];
  for (const [texte, classe] of cases) {
    const td = document.createElement('td');
    td.textContent = texte;
    if (classe) td.className = classe;
    tr.appendChild(td);
  }
  return tr;
}

async function charger() {
  if (!numero || !jeton) {
    introuvable("Cette adresse est incomplète. Utilisez le lien reçu dans votre e-mail de confirmation.");
    return;
  }

  const { data, error } = await supabase.rpc('facture_commande', {
    p_numero: numero,
    p_jeton: jeton,
  });

  if (error) {
    console.error('facture.js', error);
    introuvable("Le document n'a pas pu être chargé. Réessayez dans un instant.");
    return;
  }
  if (!data) {
    introuvable("Document introuvable. Vérifiez le lien reçu dans votre e-mail de confirmation.");
    return;
  }

  const avoir = numeroAvoir
    ? (data.avoirs ?? []).find((a) => a.numero === numeroAvoir)
    : null;

  if (numeroAvoir && !avoir) {
    introuvable("Cet avoir est introuvable pour cette commande.");
    return;
  }

  // L'identité du vendeur et la mention de TVA viennent de l'administration,
  // comme sur le site et dans l'e-mail : un document qui contredirait les
  // conditions de vente n'aurait aucune valeur.
  const { data: textes } = await supabase
    .from('contenu_site')
    .select('cle, valeur')
    .in('cle', ['cgv-vendeur', 'boutique-tva']);
  const valeurs = new Map((textes ?? []).map((t) => [t.cle, t.valeur]));

  const node = document.getElementById('tpl-facture').content.cloneNode(true);

  node.querySelector('[data-slot="type-document"]').textContent = avoir ? 'Avoir' : 'Facture';
  node.querySelector('[data-slot="numero-facture"]').textContent =
    avoir ? avoir.numero : data.facture_numero;
  node.querySelector('[data-slot="dates"]').textContent = avoir
    ? `Émis le ${jour(avoir.emis_le)} · Se rapporte à la facture n° ${data.facture_numero} du ${jour(data.facture_emise_le)}`
    : `Émise le ${jour(data.facture_emise_le)} · Commande n° ${data.commande_numero} du ${jour(data.commande_le)}`;

  node.querySelector('[data-slot="vendeur"]').innerHTML =
    rendreMarkdownLite(valeurs.get('cgv-vendeur') ?? '');

  const client = node.querySelector('[data-slot="client"]');
  client.textContent = data.client_nom;
  if (data.adresse) {
    for (const ligne of String(data.adresse).split('\n')) {
      client.append(document.createElement('br'), ligne);
    }
  }

  // Un avoir ne porte que ce qu'il reprend, qui peut être une partie seulement
  // de la commande. Une facture porte tout.
  const articles = avoir ? (avoir.lignes ?? []) : (data.lignes ?? []);
  const corps = node.querySelector('[data-slot="lignes"]');
  for (const article of articles) corps.appendChild(ligneArticle(article));

  const totaux = node.querySelector('[data-slot="totaux"]');
  if (avoir) {
    const sousTotal = articles.reduce(
      (somme, a) => somme + a.prix_unitaire_cents * a.quantite, 0,
    );
    totaux.appendChild(ligneTotal('Articles repris', formatPrix(sousTotal)));
    if (avoir.inclut_livraison) {
      totaux.appendChild(ligneTotal('Frais de livraison remboursés', formatPrix(data.livraison_cents)));
    }
    totaux.appendChild(ligneTotal("Montant de l'avoir", formatPrix(avoir.total_cents), true));
  } else {
    totaux.appendChild(ligneTotal('Sous-total', formatPrix(data.sous_total_cents)));
    totaux.appendChild(ligneTotal(
      data.mode_retrait === 'retrait_showroom' ? 'Retrait au showroom' : 'Livraison',
      data.livraison_cents > 0 ? formatPrix(data.livraison_cents) : 'Gratuit',
    ));
    totaux.appendChild(ligneTotal('Total', formatPrix(data.total_cents), true));
  }

  node.querySelector('[data-slot="tva"]').textContent = valeurs.get('boutique-tva') ?? '';

  const reglement = node.querySelector('[data-slot="reglement"]');
  if (avoir) {
    // Un avoir constate l'annulation ; il ne vaut pas preuve de remboursement,
    // qui est un mouvement bancaire distinct. Le dire évite une réclamation
    // fondée sur un malentendu.
    reglement.textContent = avoir.motif
      ? `Motif : ${avoir.motif}. Le remboursement est effectué sur le moyen de paiement utilisé lors de la commande.`
      : 'Le remboursement est effectué sur le moyen de paiement utilisé lors de la commande.';
  } else {
    reglement.textContent = data.paye_le
      ? `Facture acquittée. Règlement reçu le ${jour(data.paye_le)}.`
      : 'Facture acquittée.';
  }

  node.querySelector('[data-action="imprimer"]').addEventListener('click', () => window.print());

  document.title = avoir
    ? `Avoir ${avoir.numero} — L'Atelier du Bout d'à Haut`
    : `Facture ${data.facture_numero} — L'Atelier du Bout d'à Haut`;

  contenuEl.innerHTML = '';
  contenuEl.appendChild(node);
}

charger();
