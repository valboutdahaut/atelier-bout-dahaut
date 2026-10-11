// facturation.js — factures, avoirs et export comptable.
//
// Rassemble au même endroit ce qui relève de la comptabilité, séparé du suivi
// des commandes qui relève de la préparation. Deux moments différents du
// travail de l'atelier, deux écrans.
//
// Une facture est émise automatiquement au paiement (voir la fonction serveur
// envoyer-confirmation). Elle ne se supprime pas et ne se modifie pas : en cas
// d'annulation, on émet un avoir qui l'annule sans l'effacer. Le remboursement
// se fait dans Stripe, l'administration ne touche jamais à l'argent.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatPrix, formatDate } from '../../lib/format.js';
import { telechargerCsv } from '../../lib/export-csv.js';

const conteneur = document.getElementById('liste-factures');

const LIBELLES_STATUT = {
  nouvelle: 'Nouvelle',
  en_preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const LIBELLES_PAIEMENT = {
  paye: 'Payée',
  en_attente: 'Paiement en cours',
  expire: 'Jamais payée',
  annule_client: 'Abandonnée',
  echoue: 'Paiement refusé',
  non_requis: 'Sans paiement en ligne',
};

const LIBELLES_MODE = {
  livraison: 'Livraison à domicile',
  retrait_showroom: 'Retrait au showroom',
};

let client;
let commandes = [];

/** Lien vers un document imprimable, porté par le jeton de la commande. */
function lienDocument(commande, type) {
  return `/boutique/facture.html?commande=${encodeURIComponent(commande.numero)}`
    + `&jeton=${encodeURIComponent(commande.jeton_client ?? '')}`
    + (type === 'avoir' ? '&doc=avoir' : '');
}

function lien(href, texte) {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = texte;
  return a;
}

// =============================================================================
// Le tableau des factures
// =============================================================================

function cellule(contenu) {
  const td = document.createElement('td');
  if (typeof contenu === 'string') td.textContent = contenu;
  else if (contenu) td.appendChild(contenu);
  return td;
}

function ligneAvoir(commande, td) {
  if (commande.avoir_numero) {
    td.appendChild(lien(lienDocument(commande, 'avoir'), commande.avoir_numero));
    if (commande.avoir_motif) {
      const motif = document.createElement('span');
      motif.className = 'hint';
      motif.style.display = 'block';
      motif.textContent = commande.avoir_motif;
      td.appendChild(motif);
    }
    return;
  }

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'btn btn-outline';
  bouton.textContent = 'Émettre un avoir';

  bouton.addEventListener('click', async () => {
    // Un seul dialogue sert de confirmation et de saisie : annuler interrompt,
    // valider à vide émet l'avoir sans motif. Un avoir ne se défait pas, d'où
    // ce passage obligé.
    const motif = window.prompt(
      `Émettre un avoir annulant la facture ${commande.facture_numero} ?\n\n`
      + "Cette opération est définitive. Le remboursement reste à faire dans Stripe.\n\n"
      + 'Motif (facultatif) :',
      'Annulation de la commande',
    );
    if (motif === null) return;

    bouton.disabled = true;
    bouton.textContent = 'Émission…';

    const { data, error } = await client.rpc('emettre_avoir', {
      p_commande_id: commande.id,
      p_motif: motif,
    });

    if (error) {
      bouton.disabled = false;
      bouton.textContent = 'Émettre un avoir';
      alert("L'avoir n'a pas pu être émis. Réessayez, et prévenez Tom si cela persiste.");
      console.error('facturation.js : émission', error);
      return;
    }

    commande.avoir_numero = data;
    commande.avoir_motif = motif || null;
    td.textContent = '';
    ligneAvoir(commande, td);
  });

  td.appendChild(bouton);
}

function rendre() {
  const facturees = commandes
    .filter((c) => c.facture_numero)
    .sort((a, b) => String(b.facture_emise_le ?? '').localeCompare(String(a.facture_emise_le ?? '')));

  conteneur.innerHTML = '';

  if (facturees.length === 0) {
    const vide = document.createElement('p');
    vide.className = 'empty-state';
    vide.textContent = "Aucune facture pour l'instant. La première sera émise dès la première commande réglée.";
    conteneur.appendChild(vide);
    return;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';

  const thead = document.createElement('thead');
  const trEntete = document.createElement('tr');
  for (const libelle of ['Facture', 'Émise le', 'Commande', 'Cliente', 'Total', 'Statut', 'Avoir']) {
    const th = document.createElement('th');
    th.textContent = libelle;
    trEntete.appendChild(th);
  }
  thead.appendChild(trEntete);
  table.appendChild(thead);

  const corps = document.createElement('tbody');
  for (const commande of facturees) {
    const tr = document.createElement('tr');
    // Une facture annulée par un avoir reste affichée, barrée : elle existe
    // toujours comptablement, c'est tout l'objet de l'avoir.
    if (commande.avoir_numero) tr.classList.add('facture-annulee');

    tr.appendChild(cellule(lien(lienDocument(commande, 'facture'), commande.facture_numero)));
    tr.appendChild(cellule(formatDate(commande.facture_emise_le)));
    tr.appendChild(cellule(commande.numero));
    tr.appendChild(cellule(commande.client_nom));
    tr.appendChild(cellule(formatPrix(commande.total_cents)));
    tr.appendChild(cellule(LIBELLES_STATUT[commande.statut] ?? commande.statut));

    const tdAvoir = cellule('');
    ligneAvoir(commande, tdAvoir);
    tr.appendChild(tdAvoir);

    corps.appendChild(tr);
  }
  table.appendChild(corps);
  conteneur.appendChild(table);
}

// =============================================================================
// Export comptable
// =============================================================================
// Déplacé depuis la page Commandes : il relève du même moment de travail que
// les factures et les avoirs.

/**
 * La date qui fait foi est celle de l'ENCAISSEMENT, une micro-entreprise
 * déclarant ses recettes encaissées. Une commande jamais réglée n'a pas de date
 * de paiement : on retombe sur sa date de création.
 */
function dateComptable(commande) {
  return commande.paye_le ?? commande.created_at;
}

function commandesAExporter() {
  const du = document.getElementById('export-du').value;
  const au = document.getElementById('export-au').value;
  const statut = document.getElementById('export-statut').value;
  const seulementReglees = document.getElementById('export-paiement').value === 'reglees';

  return commandes
    .filter((c) => !seulementReglees || c.paiement_statut === 'paye' || c.paiement_statut === 'non_requis')
    .filter((c) => !statut || c.statut === statut)
    .filter((c) => {
      // Comparaison sur AAAA-MM-JJ : le format des champs de date du
      // formulaire, où comparer des chaînes revient à comparer des dates.
      const jour = (dateComptable(c) ?? '').slice(0, 10);
      if (du && jour < du) return false;
      if (au && jour > au) return false;
      return true;
    })
    .sort((a, b) => (dateComptable(a) ?? '').localeCompare(dateComptable(b) ?? ''));
}

/** Montant en euros, virgule décimale, sans symbole : le tableur doit additionner. */
function montant(cents) {
  return ((cents ?? 0) / 100).toFixed(2).replace('.', ',');
}

function jourFrancais(iso) {
  if (!iso) return '';
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  return `${jour}/${mois}/${annee}`;
}

function majCompteExport() {
  const liste = commandesAExporter();
  const total = liste.reduce((somme, c) => somme + (c.total_cents ?? 0), 0);
  const el = document.getElementById('export-compte');
  const bouton = document.getElementById('btn-exporter');

  if (liste.length === 0) {
    el.textContent = 'Aucune commande ne correspond à ces filtres.';
    bouton.disabled = true;
    return;
  }
  el.textContent = `${liste.length} commande${liste.length > 1 ? 's' : ''}, ${formatPrix(total)} au total.`;
  bouton.disabled = false;
}

function exporter() {
  const liste = commandesAExporter();
  if (liste.length === 0) return;

  const entetes = [
    'Facture', 'Avoir', 'Numéro', 'Date de paiement', 'Date de commande',
    'Cliente', 'E-mail', 'Téléphone', 'Mode de récupération', 'Adresse',
    'Articles', 'Sous-total', 'Livraison', 'Total', 'Statut', 'Paiement',
  ];

  const lignes = liste.map((c) => [
    c.facture_numero ?? '',
    c.avoir_numero ?? '',
    c.numero,
    jourFrancais(c.paye_le),
    jourFrancais(c.created_at),
    c.client_nom,
    c.client_email,
    c.client_telephone ?? '',
    LIBELLES_MODE[c.mode_retrait] ?? c.mode_retrait,
    // Les retours à la ligne deviennent des virgules : une cellule de tableur
    // sur plusieurs lignes se lit mal et se trie encore moins bien.
    (c.adresse_livraison ?? '').replace(/\s*\n\s*/g, ', '),
    (c.lignes_commande ?? []).map((l) => `${l.titre_produit} x ${l.quantite}`).join(' + '),
    montant(c.sous_total_cents),
    montant(c.livraison_cents),
    montant(c.total_cents),
    LIBELLES_STATUT[c.statut] ?? c.statut,
    LIBELLES_PAIEMENT[c.paiement_statut] ?? c.paiement_statut,
  ]);

  const du = document.getElementById('export-du').value;
  const au = document.getElementById('export-au').value;
  const suffixe = du || au ? `${du || 'debut'}_${au || 'aujourdhui'}` : new Date().toISOString().slice(0, 10);

  telechargerCsv(`commandes-${suffixe}.csv`, entetes, lignes);
}

function cablerExport() {
  for (const id of ['export-du', 'export-au', 'export-statut', 'export-paiement']) {
    document.getElementById(id).addEventListener('change', majCompteExport);
  }
  document.getElementById('btn-exporter').addEventListener('click', exporter);
}

// =============================================================================

async function charger() {
  client = await getAuthenticatedClient();
  const { data, error } = await client
    .from('commandes')
    .select('*, lignes_commande(*)')
    .order('created_at', { ascending: false });

  if (error) {
    conteneur.innerHTML = '<p class="empty-state">Erreur de chargement.</p>';
    console.error('facturation.js', error);
    return;
  }

  commandes = data ?? [];
  rendre();
  majCompteExport();
}

cablerExport();
charger();
