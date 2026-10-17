// facturation.js — factures, avoirs et export comptable.
//
// Rassemble ce qui relève de la comptabilité, séparé du suivi des commandes qui
// relève de la préparation. Deux moments différents du travail de l'atelier.
//
// Une facture est émise automatiquement au paiement. Elle ne se supprime pas et
// ne se modifie pas : en cas de retour, on émet un avoir, qui peut ne porter
// que sur une partie de la commande et dont il peut y avoir plusieurs sur une
// même facture.
//
// Le montant d'un avoir n'est jamais calculé ici : cette page dit ce qu'elle
// reprend, la base relit les prix réels et fait l'addition. Même principe que
// pour les commandes, où le prix ne vient jamais du navigateur.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatPrix, formatDate } from '../../lib/format.js';
import { telechargerCsv } from '../../lib/export-csv.js';

const listeFactures = document.getElementById('liste-factures');
const listeAvoirs = document.getElementById('liste-avoirs');
const ongletsEl = document.getElementById('onglets-facturation');

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
let avoirs = [];

// --- Onglets ----------------------------------------------------------------
// Même convention que « Textes du site » : un bouton par onglet, un panneau par
// onglet, et « hidden » pour masquer. Rien à charger au changement, les deux
// tableaux sont déjà rendus.

function activerOnglet(nom) {
  for (const bouton of ongletsEl.querySelectorAll('.admin-tab')) {
    bouton.classList.toggle('active', bouton.dataset.onglet === nom);
  }
  for (const panneau of document.querySelectorAll('[data-panneau]')) {
    panneau.hidden = panneau.dataset.panneau !== nom;
  }
}

ongletsEl.addEventListener('click', (e) => {
  const bouton = e.target.closest('.admin-tab');
  if (bouton) activerOnglet(bouton.dataset.onglet);
});

/** Le nombre de documents, affiché dans chaque onglet. */
function majCompteursOnglets(nbFactures, nbAvoirs) {
  ongletsEl.querySelector('[data-compteur="factures"]').textContent =
    nbFactures > 0 ? `(${nbFactures})` : '';
  ongletsEl.querySelector('[data-compteur="avoirs"]').textContent =
    nbAvoirs > 0 ? `(${nbAvoirs})` : '';
}

// --- Petits outils de construction ------------------------------------------

function el(balise, texte, classe) {
  const noeud = document.createElement(balise);
  if (texte != null) noeud.textContent = texte;
  if (classe) noeud.className = classe;
  return noeud;
}

function cellule(contenu) {
  const td = document.createElement('td');
  if (typeof contenu === 'string') td.textContent = contenu;
  else if (contenu) td.appendChild(contenu);
  return td;
}

function tableau(entetes) {
  const table = el('table', null, 'admin-table');
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  for (const libelle of entetes) tr.appendChild(el('th', libelle));
  thead.appendChild(tr);
  table.appendChild(thead);
  const corps = document.createElement('tbody');
  table.appendChild(corps);
  return { table, corps };
}

function lienDocument(commande, numeroAvoir) {
  return `/boutique/facture.html?commande=${encodeURIComponent(commande.numero)}`
    + `&jeton=${encodeURIComponent(commande.jeton_client ?? '')}`
    + (numeroAvoir ? `&avoir=${encodeURIComponent(numeroAvoir)}` : '');
}

function lien(href, texte) {
  const a = el('a', texte);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

const avoirsDe = (commande) => avoirs.filter((a) => a.commande_id === commande.id);

// =============================================================================
// Le panneau d'émission d'un avoir
// =============================================================================

/**
 * Ouvre, sous la ligne de la facture, le choix de ce qui est repris.
 *
 * Les quantités reprenables sont demandées à la base au moment de l'ouverture :
 * elles dépendent des avoirs déjà émis, et les recalculer ici reviendrait à
 * tenir une seconde comptabilité dans le navigateur.
 */
async function ouvrirPanneau(commande, trFacture, apresEmission) {
  // Un seul panneau à la fois : deux avoirs en cours de saisie sur la même
  // commande se marcheraient dessus.
  document.querySelectorAll('[data-panneau-avoir]').forEach((n) => n.remove());

  const tr = document.createElement('tr');
  tr.dataset.panneauAvoir = commande.id;
  const td = document.createElement('td');
  td.colSpan = 7;
  tr.appendChild(td);
  trFacture.after(tr);

  td.appendChild(el('p', 'Chargement des articles…', 'hint'));

  const { data: lignes, error } = await client.rpc('lignes_reprenables', {
    p_commande_id: commande.id,
  });

  if (error) {
    td.textContent = '';
    td.appendChild(el('p', "Impossible de charger les articles de cette commande.", 'status-msg error'));
    console.error('facturation.js : lignes reprenables', error);
    return;
  }

  const reprenables = (lignes ?? []).filter((l) => l.quantite_reprenable > 0);
  td.textContent = '';

  if (reprenables.length === 0) {
    td.appendChild(el('p', 'Tous les articles de cette commande ont déjà été repris.', 'hint'));
    return;
  }

  const panneau = el('div', null, 'panneau-avoir');
  panneau.appendChild(el('p', 'Cochez ce que vous reprenez. Le montant se calcule tout seul.', 'bloc-aide'));

  const choix = [];

  for (const ligne of reprenables) {
    const rangee = el('label', null, 'choix-avoir');

    const case_ = document.createElement('input');
    case_.type = 'checkbox';
    rangee.appendChild(case_);

    const intitule = el('span', null, 'choix-avoir-titre');
    intitule.appendChild(el('strong', ligne.titre_produit));
    intitule.append(` · ${formatPrix(ligne.prix_unitaire_cents)}`);
    if (ligne.quantite_deja_reprise > 0) {
      intitule.appendChild(el('span', ` (déjà repris : ${ligne.quantite_deja_reprise})`, 'hint'));
    }
    rangee.appendChild(intitule);

    // Le sélecteur de quantité n'apparaît que si la ligne en compte plusieurs :
    // sur une commande où tout est à l'unité, l'écran reste une simple liste de
    // cases à cocher.
    let quantite = null;
    if (ligne.quantite_reprenable > 1) {
      quantite = document.createElement('input');
      quantite.type = 'number';
      quantite.min = '1';
      quantite.max = String(ligne.quantite_reprenable);
      quantite.value = String(ligne.quantite_reprenable);
      quantite.className = 'choix-avoir-quantite';
      quantite.setAttribute('aria-label', `Quantité reprise pour ${ligne.titre_produit}`);
      rangee.appendChild(quantite);
      rangee.appendChild(el('span', `sur ${ligne.quantite_reprenable}`, 'hint'));
    }

    panneau.appendChild(rangee);
    choix.push({ ligne, case_, quantite });
  }

  // Les frais de livraison ne suivent pas automatiquement : en cas de
  // rétractation totale le vendeur les rembourse, en cas de retour partiel non,
  // la livraison ayant bien été effectuée. D'où une case à part, dont l'aide
  // rappelle la règle.
  let caseLivraison = null;
  if (commande.livraison_cents > 0) {
    const rangee = el('label', null, 'choix-avoir');
    caseLivraison = document.createElement('input');
    caseLivraison.type = 'checkbox';
    rangee.appendChild(caseLivraison);
    const intitule = el('span', null, 'choix-avoir-titre');
    intitule.appendChild(el('strong', 'Frais de livraison'));
    intitule.append(` · ${formatPrix(commande.livraison_cents)}`);
    rangee.appendChild(intitule);
    panneau.appendChild(rangee);
    panneau.appendChild(el(
      'p',
      "À rembourser si la cliente renonce à toute la commande. Sur un retour partiel, la livraison a bien eu lieu : les frais restent dus.",
      'hint',
    ));
  }

  const champMotif = document.createElement('input');
  champMotif.type = 'text';
  champMotif.placeholder = 'Motif, par exemple : rétractation de la cliente';
  champMotif.className = 'champ-motif';
  champMotif.setAttribute('aria-label', "Motif de l'avoir");
  panneau.appendChild(champMotif);

  const total = el('p', null, 'avoir-total');
  const pied = el('div', null, 'panneau-avoir-pied');
  const valider = el('button', "Émettre l'avoir", 'btn btn-accent');
  valider.type = 'button';
  const annuler = el('button', 'Annuler', 'btn btn-outline');
  annuler.type = 'button';
  pied.append(total, annuler, valider);
  panneau.appendChild(pied);

  const message = el('p', null, 'status-msg error');
  message.hidden = true;
  panneau.appendChild(message);

  td.appendChild(panneau);

  function quantiteChoisie(c) {
    if (!c.case_.checked) return 0;
    if (!c.quantite) return c.ligne.quantite_reprenable;
    const saisie = Number(c.quantite.value);
    if (!Number.isFinite(saisie)) return 0;
    return Math.min(Math.max(1, Math.trunc(saisie)), c.ligne.quantite_reprenable);
  }

  function recalculer() {
    let somme = 0;
    for (const c of choix) somme += c.ligne.prix_unitaire_cents * quantiteChoisie(c);
    if (caseLivraison?.checked) somme += commande.livraison_cents;

    // La case des frais de livraison se coche d'elle-même quand toute la
    // commande est reprise, puisque c'est alors une rétractation totale. Elle
    // reste décochable : c'est un garde-fou, pas une décision à la place de
    // l'atelier.
    total.textContent = `Montant de l'avoir : ${formatPrix(somme)}`;
    valider.disabled = somme === 0 && !caseLivraison?.checked;
    return somme;
  }

  function toutEstRepris() {
    return choix.every((c) => quantiteChoisie(c) === c.ligne.quantite_reprenable);
  }

  for (const c of choix) {
    c.case_.addEventListener('change', () => {
      if (caseLivraison && !caseLivraison.dataset.touche) {
        caseLivraison.checked = toutEstRepris() && choix.some((x) => x.case_.checked);
      }
      recalculer();
    });
    c.quantite?.addEventListener('input', recalculer);
  }
  caseLivraison?.addEventListener('change', () => {
    caseLivraison.dataset.touche = 'oui';
    recalculer();
  });

  recalculer();

  annuler.addEventListener('click', () => tr.remove());

  valider.addEventListener('click', async () => {
    const selection = choix
      .filter((c) => c.case_.checked)
      .map((c) => ({ ligne_id: c.ligne.ligne_id, quantite: quantiteChoisie(c) }));

    if (selection.length === 0) {
      message.textContent = 'Sélectionnez au moins un article.';
      message.hidden = false;
      return;
    }

    valider.disabled = true;
    valider.textContent = 'Émission…';
    message.hidden = true;

    const { data, error } = await client.rpc('emettre_avoir', {
      p_commande_id: commande.id,
      p_motif: champMotif.value,
      p_lignes: selection,
      p_inclut_livraison: Boolean(caseLivraison?.checked),
    });

    if (error) {
      valider.disabled = false;
      valider.textContent = "Émettre l'avoir";
      message.textContent = error.message?.includes('Déjà repris')
        ? "Un avoir a déjà repris ces articles. Rouvrez le panneau pour voir ce qu'il reste."
        : "L'avoir n'a pas pu être émis. Réessayez, et prévenez Tom si cela persiste.";
      message.hidden = false;
      console.error('facturation.js : émission', error);
      return;
    }

    tr.remove();
    apresEmission(data);
  });
}

// =============================================================================
// Les deux tableaux
// =============================================================================

function rendreFactures() {
  const facturees = commandes
    .filter((c) => c.facture_numero)
    .sort((a, b) => String(b.facture_emise_le ?? '').localeCompare(String(a.facture_emise_le ?? '')));

  listeFactures.innerHTML = '';

  if (facturees.length === 0) {
    listeFactures.appendChild(el('p', "Aucune facture pour l'instant. La première sera émise dès la première commande réglée.", 'empty-state'));
    return;
  }

  const { table, corps } = tableau(['Facture', 'Émise le', 'Commande', 'Cliente', 'Total', 'Statut', 'Avoirs']);

  for (const commande of facturees) {
    const tr = document.createElement('tr');
    tr.appendChild(cellule(lien(lienDocument(commande), commande.facture_numero)));
    tr.appendChild(cellule(formatDate(commande.facture_emise_le)));
    tr.appendChild(cellule(commande.numero));
    tr.appendChild(cellule(commande.client_nom));
    tr.appendChild(cellule(formatPrix(commande.total_cents)));
    tr.appendChild(cellule(LIBELLES_STATUT[commande.statut] ?? commande.statut));

    const td = document.createElement('td');
    const emis = avoirsDe(commande);
    for (const avoir of emis) {
      const ligne = el('span', null, 'avoir-pastille');
      ligne.appendChild(lien(lienDocument(commande, avoir.numero), avoir.numero));
      ligne.append(` · ${formatPrix(avoir.total_cents)}`);
      td.appendChild(ligne);
    }

    const bouton = el('button', emis.length ? 'Émettre un autre avoir' : 'Émettre un avoir', 'btn btn-outline');
    bouton.type = 'button';
    // Après émission, on recharge tout et on revient sur l'onglet des avoirs :
    // c'est le document qui vient d'être créé, c'est lui qu'on veut voir.
    bouton.addEventListener('click', () => ouvrirPanneau(commande, tr, async () => {
      await charger();
      activerOnglet('avoirs');
    }));
    td.appendChild(bouton);
    tr.appendChild(td);

    corps.appendChild(tr);
  }

  listeFactures.appendChild(table);
}

function rendreAvoirs() {
  listeAvoirs.innerHTML = '';

  if (avoirs.length === 0) {
    listeAvoirs.appendChild(el('p', "Aucun avoir émis. Tant mieux.", 'empty-state'));
    return;
  }

  const { table, corps } = tableau(['Avoir', 'Émis le', 'Facture', 'Commande', 'Cliente', 'Montant', 'Motif']);

  for (const avoir of [...avoirs].sort((a, b) => String(b.emis_le).localeCompare(String(a.emis_le)))) {
    const commande = commandes.find((c) => c.id === avoir.commande_id);
    const tr = document.createElement('tr');
    tr.appendChild(cellule(commande ? lien(lienDocument(commande, avoir.numero), avoir.numero) : avoir.numero));
    tr.appendChild(cellule(formatDate(avoir.emis_le)));
    tr.appendChild(cellule(commande?.facture_numero ?? ''));
    tr.appendChild(cellule(commande?.numero ?? ''));
    tr.appendChild(cellule(commande?.client_nom ?? ''));
    tr.appendChild(cellule(formatPrix(avoir.total_cents)));
    tr.appendChild(cellule(avoir.motif ?? ''));
    corps.appendChild(tr);
  }

  listeAvoirs.appendChild(table);
}

// =============================================================================
// Export comptable
// =============================================================================

const contenuEl = () => document.getElementById('export-contenu').value;

/**
 * La date qui fait foi pour une commande est celle de l'ENCAISSEMENT, une
 * micro-entreprise déclarant ses recettes encaissées. Pour un document, c'est
 * sa date d'émission, qui joue le même rôle.
 */
function dateComptable(commande) {
  return commande.paye_le ?? commande.created_at;
}

function dansLaPeriode(iso) {
  const du = document.getElementById('export-du').value;
  const au = document.getElementById('export-au').value;
  const jour = (iso ?? '').slice(0, 10);
  if (du && jour < du) return false;
  if (au && jour > au) return false;
  return true;
}

/**
 * Les statuts cochés, cumulables. Rien de coché vaut tous les statuts : un
 * filtre au repos ne retire rien, et l'atelier n'a pas à cocher cinq cases
 * pour obtenir le fichier complet.
 */
function statutsCoches() {
  return [...document.querySelectorAll('#export-statuts input:checked')].map((c) => c.value);
}

function commandesAExporter() {
  const statuts = statutsCoches();
  const seulementReglees = document.getElementById('export-paiement').value === 'reglees';

  return commandes
    .filter((c) => !seulementReglees || c.paiement_statut === 'paye' || c.paiement_statut === 'non_requis')
    .filter((c) => statuts.length === 0 || statuts.includes(c.statut))
    .filter((c) => dansLaPeriode(dateComptable(c)))
    .sort((a, b) => (dateComptable(a) ?? '').localeCompare(dateComptable(b) ?? ''));
}

/** Le journal des documents : factures et avoirs, triés par date d'émission. */
function documentsAExporter() {
  const contenu = contenuEl();
  const documents = [];

  if (contenu !== 'avoirs') {
    for (const c of commandes) {
      if (!c.facture_numero || !dansLaPeriode(c.facture_emise_le)) continue;
      documents.push({
        type: 'Facture',
        numero: c.facture_numero,
        date: c.facture_emise_le,
        commande: c,
        // Les avoirs sont comptés en négatif : la somme de la colonne donne
        // alors directement le chiffre d'affaires net.
        montant: c.total_cents,
        motif: '',
      });
    }
  }

  if (contenu !== 'factures') {
    for (const a of avoirs) {
      if (!dansLaPeriode(a.emis_le)) continue;
      const c = commandes.find((x) => x.id === a.commande_id);
      documents.push({
        type: 'Avoir',
        numero: a.numero,
        date: a.emis_le,
        commande: c,
        montant: -a.total_cents,
        motif: a.motif ?? '',
      });
    }
  }

  return documents.sort((x, y) => String(x.date).localeCompare(String(y.date)));
}

const SLUGS_STATUT = {
  nouvelle: 'nouvelles',
  en_preparation: 'en-preparation',
  expediee: 'expediees',
  livree: 'livrees',
  annulee: 'annulees',
};

/**
 * Rappelle les statuts retenus dans le nom du fichier : deux exports faits le
 * même jour avec deux filtres différents ne se confondent pas dans le dossier
 * des téléchargements. Au-delà de deux statuts, on compte plutôt que d'allonger.
 */
function suffixeStatuts() {
  const statuts = statutsCoches();
  if (statuts.length === 0) return '';
  if (statuts.length > 2) return `-${statuts.length}-statuts`;
  return '-' + statuts.map((s) => SLUGS_STATUT[s] ?? s).join('-');
}

function montant(cents) {
  return ((cents ?? 0) / 100).toFixed(2).replace('.', ',');
}

function jourFrancais(iso) {
  if (!iso) return '';
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  return `${jour}/${mois}/${annee}`;
}

function majAffichageFiltres() {
  const surCommandes = contenuEl() === 'commandes';
  document.querySelector('[data-slot="champ-statut"]').hidden = !surCommandes;
  document.querySelector('[data-slot="champ-paiement"]').hidden = !surCommandes;
  document.querySelector('[data-slot="aide-dates"]').innerHTML = surCommandes
    ? "Les dates portent sur le <strong>paiement</strong>, pas sur la date de commande. C'est l'encaissement qui compte pour la déclaration. Laissez vide pour tout prendre."
    : "Les dates portent sur la <strong>date d'émission</strong> du document. Laissez vide pour tout prendre.";
}

function majCompteExport() {
  const el_ = document.getElementById('export-compte');
  const bouton = document.getElementById('btn-exporter');

  if (contenuEl() === 'commandes') {
    const liste = commandesAExporter();
    const total = liste.reduce((s, c) => s + (c.total_cents ?? 0), 0);
    el_.textContent = liste.length === 0
      ? 'Aucune commande ne correspond à ces filtres.'
      : `${liste.length} commande${liste.length > 1 ? 's' : ''}, ${formatPrix(total)} au total.`;
    bouton.disabled = liste.length === 0;
    return;
  }

  const documents = documentsAExporter();
  const net = documents.reduce((s, d) => s + d.montant, 0);
  el_.textContent = documents.length === 0
    ? 'Aucun document ne correspond à ces filtres.'
    : `${documents.length} document${documents.length > 1 ? 's' : ''}, ${formatPrix(net)} net.`;
  bouton.disabled = documents.length === 0;
}

function exporter() {
  const suffixeDates = (() => {
    const du = document.getElementById('export-du').value;
    const au = document.getElementById('export-au').value;
    return du || au ? `${du || 'debut'}_${au || 'aujourdhui'}` : new Date().toISOString().slice(0, 10);
  })();

  if (contenuEl() === 'commandes') {
    const liste = commandesAExporter();
    if (liste.length === 0) return;

    telechargerCsv(
      `commandes${suffixeStatuts()}-${suffixeDates}.csv`,
      ['Facture', 'Numéro', 'Date de paiement', 'Date de commande', 'Cliente', 'E-mail',
        'Téléphone', 'Mode de récupération', 'Adresse', 'Articles',
        'Sous-total', 'Livraison', 'Total', 'Statut', 'Paiement'],
      liste.map((c) => [
        c.facture_numero ?? '',
        c.numero,
        jourFrancais(c.paye_le),
        jourFrancais(c.created_at),
        c.client_nom,
        c.client_email,
        c.client_telephone ?? '',
        LIBELLES_MODE[c.mode_retrait] ?? c.mode_retrait,
        (c.adresse_livraison ?? '').replace(/\s*\n\s*/g, ', '),
        (c.lignes_commande ?? []).map((l) => `${l.titre_produit} x ${l.quantite}`).join(' + '),
        montant(c.sous_total_cents),
        montant(c.livraison_cents),
        montant(c.total_cents),
        LIBELLES_STATUT[c.statut] ?? c.statut,
        LIBELLES_PAIEMENT[c.paiement_statut] ?? c.paiement_statut,
      ]),
    );
    return;
  }

  const documents = documentsAExporter();
  if (documents.length === 0) return;

  const nom = { documents: 'factures-et-avoirs', factures: 'factures', avoirs: 'avoirs' }[contenuEl()];

  telechargerCsv(
    `${nom}-${suffixeDates}.csv`,
    ['Type', 'Numéro', 'Date', 'Commande', 'Cliente', 'E-mail', 'Montant', 'Motif'],
    documents.map((d) => [
      d.type,
      d.numero,
      jourFrancais(d.date),
      d.commande?.numero ?? '',
      d.commande?.client_nom ?? '',
      d.commande?.client_email ?? '',
      montant(d.montant),
      d.motif,
    ]),
  );
}

function cablerExport() {
  document.getElementById('export-contenu').addEventListener('change', () => {
    majAffichageFiltres();
    majCompteExport();
  });
  for (const id of ['export-du', 'export-au', 'export-paiement']) {
    document.getElementById(id).addEventListener('change', majCompteExport);
  }
  // Un seul écouteur sur le groupe plutôt qu'un par case : l'événement
  // « change » d'une case remonte jusqu'ici.
  document.getElementById('export-statuts').addEventListener('change', majCompteExport);
  document.getElementById('btn-exporter').addEventListener('click', exporter);
  majAffichageFiltres();
}

// =============================================================================

async function charger() {
  client = await getAuthenticatedClient();

  const [resCommandes, resAvoirs] = await Promise.all([
    client.from('commandes').select('*, lignes_commande(*)').order('created_at', { ascending: false }),
    client.from('avoirs').select('*, avoir_lignes(*)').order('emis_le', { ascending: false }),
  ]);

  if (resCommandes.error || resAvoirs.error) {
    listeFactures.innerHTML = '<p class="empty-state">Erreur de chargement.</p>';
    console.error('facturation.js', resCommandes.error ?? resAvoirs.error);
    return;
  }

  commandes = resCommandes.data ?? [];
  avoirs = resAvoirs.data ?? [];

  rendreFactures();
  rendreAvoirs();
  majCompteursOnglets(commandes.filter((c) => c.facture_numero).length, avoirs.length);
  majCompteExport();
}

cablerExport();
charger();
