// facture.js — facture imprimable d'une commande, lue via ?commande= et ?jeton=
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

import { supabase } from '../supabase-client.js';
import { formatPrix } from '../lib/format.js';
import { rendreMarkdownLite } from '../lib/markdown-lite.js';

const contenuEl = document.getElementById('contenu-facture');
const params = new URLSearchParams(location.search);
const numero = params.get('commande');
const jeton = params.get('jeton');

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
    introuvable("La facture n'a pas pu être chargée. Réessayez dans un instant.");
    return;
  }
  if (!data) {
    introuvable("Facture introuvable. Vérifiez le lien reçu dans votre e-mail de confirmation.");
    return;
  }

  // L'identité du vendeur et la mention de TVA viennent de l'administration,
  // comme sur le site et dans l'e-mail : une facture qui contredirait les
  // conditions de vente n'aurait aucune valeur.
  const { data: textes } = await supabase
    .from('contenu_site')
    .select('cle, valeur')
    .in('cle', ['cgv-vendeur', 'boutique-tva']);
  const valeurs = new Map((textes ?? []).map((t) => [t.cle, t.valeur]));

  const node = document.getElementById('tpl-facture').content.cloneNode(true);

  node.querySelector('[data-slot="numero-facture"]').textContent = data.facture_numero;
  node.querySelector('[data-slot="dates"]').textContent =
    `Émise le ${jour(data.facture_emise_le)} · Commande n° ${data.commande_numero} du ${jour(data.commande_le)}`;

  node.querySelector('[data-slot="vendeur"]').innerHTML =
    rendreMarkdownLite(valeurs.get('cgv-vendeur') ?? '');

  const client = node.querySelector('[data-slot="client"]');
  client.textContent = data.client_nom;
  if (data.adresse) {
    for (const ligne of String(data.adresse).split('\n')) {
      client.append(document.createElement('br'), ligne);
    }
  }

  const corps = node.querySelector('[data-slot="lignes"]');
  for (const ligne of data.lignes ?? []) {
    const tr = document.createElement('tr');
    const designation = document.createElement('td');
    designation.textContent = ligne.titre;
    const quantite = document.createElement('td');
    quantite.className = 'nombre';
    quantite.textContent = ligne.quantite;
    const unitaire = document.createElement('td');
    unitaire.className = 'nombre';
    unitaire.textContent = formatPrix(ligne.prix_unitaire_cents);
    const total = document.createElement('td');
    total.className = 'nombre';
    total.textContent = formatPrix(ligne.prix_unitaire_cents * ligne.quantite);
    tr.append(designation, quantite, unitaire, total);
    corps.appendChild(tr);
  }

  const totaux = node.querySelector('[data-slot="totaux"]');
  totaux.appendChild(ligneTotal('Sous-total', formatPrix(data.sous_total_cents)));
  totaux.appendChild(ligneTotal(
    data.mode_retrait === 'retrait_showroom' ? 'Retrait au showroom' : 'Livraison',
    data.livraison_cents > 0 ? formatPrix(data.livraison_cents) : 'Gratuit',
  ));
  totaux.appendChild(ligneTotal('Total', formatPrix(data.total_cents), true));

  node.querySelector('[data-slot="tva"]').textContent = valeurs.get('boutique-tva') ?? '';
  node.querySelector('[data-slot="reglement"]').textContent = data.paye_le
    ? `Facture acquittée. Règlement reçu le ${jour(data.paye_le)}.`
    : 'Facture acquittée.';

  node.querySelector('[data-action="imprimer"]').addEventListener('click', () => window.print());

  document.title = `Facture ${data.facture_numero} — L'Atelier du Bout d'à Haut`;
  contenuEl.innerHTML = '';
  contenuEl.appendChild(node);
}

charger();
