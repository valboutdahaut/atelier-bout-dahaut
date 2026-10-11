// commandes.js — suivi des commandes, rangées en dossiers par étape.
//
// Deux états cohabitent sur une commande et ne doivent pas être confondus :
//
//   paiement_statut  l'argent est-il arrivé ? décidé par Stripe, jamais à la
//                    main. Une commande existe dès la saisie des coordonnées,
//                    donc bien avant d'être réglée.
//   statut           où en est la préparation ? décidé par l'atelier.
//
// Les cinq premiers dossiers ne montrent que des commandes réglées, c'est le
// vrai travail. Le dernier regroupe tout ce qui n'a jamais été payé, pour que
// les paniers abandonnés ne viennent pas noyer les annulations réelles.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatPrix, formatDate, echapper } from '../../lib/format.js';

const conteneur = document.getElementById('liste-commandes');
const compteEl = document.getElementById('compte-resultats');

const ETAPES = ['nouvelle', 'en_preparation', 'expediee', 'livree', 'annulee'];

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

let client;
let commandes = [];
let dossierActif = 'nouvelle';
// Chaîne vide : tous les modes de récupération confondus.
let modeActif = '';

/** Le filtre de mode s'applique partout, compteurs des dossiers compris. */
function correspondAuMode(commande) {
  return !modeActif || commande.mode_retrait === modeActif;
}

/** Une commande est-elle réglée ? Sinon c'est un panier abandonné. */
function estReglee(commande) {
  return commande.paiement_statut === 'paye' || commande.paiement_statut === 'non_requis';
}

/** Le dossier dans lequel une commande doit apparaître. */
function dossierDe(commande) {
  return estReglee(commande) ? commande.statut : 'abandon';
}

function detailPaiement(commande) {
  const lignes = [LIBELLES_PAIEMENT[commande.paiement_statut] ?? commande.paiement_statut];
  if (commande.paye_le) lignes.push(`Réglée le ${formatDate(commande.paye_le)}`);
  if (commande.paiement_statut === 'en_attente') {
    lignes.push('Les pièces restent réservées une heure, puis repartent en vente toutes seules.');
  }
  return lignes.join('<br>');
}

function majCompteurs() {
  const comptes = {};
  for (const commande of commandes.filter(correspondAuMode)) {
    const d = dossierDe(commande);
    comptes[d] = (comptes[d] ?? 0) + 1;
  }
  for (const el of document.querySelectorAll('[data-compteur]')) {
    el.textContent = String(comptes[el.dataset.compteur] ?? 0);
  }
}

function rendre() {
  const visibles = commandes.filter((c) => dossierDe(c) === dossierActif && correspondAuMode(c));

  compteEl.textContent = visibles.length === 0
    ? ''
    : `${visibles.length} commande${visibles.length === 1 ? '' : 's'}`;

  if (visibles.length === 0) {
    // Le message rappelle le filtre actif : sans ça, un dossier qui paraît
    // vide fait croire qu'il n'y a rien à faire, alors qu'il reste peut-être
    // trois colis à expédier de l'autre côté du filtre.
    const precision = modeActif === 'retrait_showroom' ? ' à retirer au showroom'
      : modeActif === 'livraison' ? ' à livrer' : '';
    conteneur.innerHTML = dossierActif === 'abandon'
      ? `<p class="empty-state">Aucun panier abandonné${precision}. Tant mieux.</p>`
      : `<p class="empty-state">Aucune commande${precision} dans ce dossier.</p>`;
    return;
  }

  const template = document.getElementById('tpl-commande');
  conteneur.innerHTML = '';

  for (const commande of visibles) {
    conteneur.appendChild(carte(template, commande));
  }
}

function carte(template, commande) {
  const node = template.content.cloneNode(true);
  const resume = node.querySelector('[data-slot="resume"]');
  const detail = node.querySelector('[data-slot="detail"]');

  node.querySelector('[data-slot="numero"]').textContent = `${commande.numero} — ${formatDate(commande.created_at)}`;

  const badgeStatut = node.querySelector('[data-slot="statut-badge"]');
  badgeStatut.textContent = LIBELLES_STATUT[commande.statut] ?? commande.statut;
  badgeStatut.dataset.statut = commande.statut;

  // La pastille de paiement ne s'affiche que quand il y a quelque chose à
  // signaler. Dans les dossiers de préparation, tout est réglé par
  // construction : l'afficher partout n'apprendrait rien.
  if (!estReglee(commande)) {
    const badgePaiement = node.querySelector('[data-slot="paiement-badge"]');
    badgePaiement.textContent = LIBELLES_PAIEMENT[commande.paiement_statut] ?? commande.paiement_statut;
    badgePaiement.classList.add(commande.paiement_statut === 'echoue' ? 'alerte' : 'brouillon');
    badgePaiement.hidden = false;
  }

  node.querySelector('[data-slot="client"]').textContent = `${commande.client_nom} · ${commande.client_email}`;
  node.querySelector('[data-slot="total"]').textContent = formatPrix(commande.total_cents);

  // Note laissée par marquer_commande_payee quand un paiement arrive après que
  // le stock a été rendu. Rare, mais il faut le voir tout de suite.
  if (commande.notes) {
    const alerte = node.querySelector('[data-slot="alerte"]');
    alerte.textContent = commande.notes;
    alerte.hidden = false;
  }

  node.querySelector('[data-slot="lignes"]').innerHTML =
    '<thead><tr><th>Produit</th><th>Qté</th><th>Prix</th></tr></thead><tbody>'
    + commande.lignes_commande.map((l) => `<tr><td>${echapper(l.titre_produit)}</td><td>${l.quantite}</td><td>${formatPrix(l.prix_unitaire_cents)}</td></tr>`).join('')
    + '</tbody>';

  // Coordonnées saisies par le client : elles passent par echapper(), sans quoi
  // un nom de rue contenant un chevron casserait l'affichage.
  node.querySelector('[data-slot="coordonnees"]').innerHTML =
    `${echapper(commande.client_telephone ?? '—')}<br>`
    + (commande.mode_retrait === 'livraison'
      ? echapper(commande.adresse_livraison ?? '').replace(/\n/g, '<br>')
      : 'Retrait au showroom');

  node.querySelector('[data-slot="paiement-detail"]').innerHTML = detailPaiement(commande);

  cablerStatut(node, commande);
  cablerConfirmation(node, commande);

  resume.addEventListener('click', () => { detail.hidden = !detail.hidden; });
  return node;
}

/**
 * État du récapitulatif de commande, et renvoi au besoin.
 *
 * L'envoi est automatique au moment du paiement, mais il peut échouer : service
 * d'envoi indisponible, adresse e-mail saisie de travers. Comme la loi impose
 * de confirmer la commande au client, une confirmation manquante doit se voir
 * et se rattraper sans attendre une intervention technique.
 */
function cablerConfirmation(node, commande) {
  const bloc = node.querySelector('[data-slot="bloc-confirmation"]');
  // « non_requis » couvre les commandes saisies à la main, hors boutique en
  // ligne : il n'y a pas d'e-mail de confirmation à envoyer pour celles-là.
  if (commande.paiement_statut !== 'paye') return;
  bloc.hidden = false;

  const etat = bloc.querySelector('[data-slot="confirmation-etat"]');
  const bouton = bloc.querySelector('[data-action="renvoyer-confirmation"]');
  const message = bloc.querySelector('[data-slot="message-confirmation"]');

  // La facture, quand elle a été émise. Le lien s'ouvre dans un nouvel onglet
  // sur la page imprimable, d'où elle s'enregistre en PDF. Il est construit
  // avec le jeton de la commande, le même que celui de l'e-mail du client :
  // l'atelier peut donc le copier et le renvoyer tel quel.
  const factureEl = bloc.querySelector('[data-slot="facture"]');
  if (commande.facture_numero) {
    factureEl.textContent = `Facture ${commande.facture_numero} · `;
    const lien = document.createElement('a');
    lien.href = `/boutique/facture.html?commande=${encodeURIComponent(commande.numero)}`
      + `&jeton=${encodeURIComponent(commande.jeton_client ?? '')}`;
    lien.target = '_blank';
    lien.rel = 'noopener';
    lien.textContent = 'ouvrir, imprimer ou enregistrer en PDF';
    factureEl.appendChild(lien);
    factureEl.hidden = false;
  }

  function afficherEtat() {
    const envoye = Boolean(commande.confirmation_envoyee_at);
    etat.textContent = envoye
      ? `Envoyé le ${formatDate(commande.confirmation_envoyee_at)}`
      : "Pas encore envoyé : le client n'a reçu aucun récapitulatif.";
    etat.classList.toggle('texte-alerte', !envoye);
  }
  afficherEtat();

  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    bouton.textContent = 'Envoi…';
    message.hidden = true;

    // « forcer » passe outre la protection contre les doubles envois : c'est
    // tout l'objet d'un renvoi demandé à la main.
    const { error } = await client.functions.invoke('envoyer-confirmation', {
      body: { commande_id: commande.id, forcer: true },
    });

    if (error) {
      message.className = 'status-msg error';
      message.textContent = "L'envoi a échoué. Réessayez dans un instant, et prévenez Tom si cela persiste.";
      console.error('commandes.js : renvoi du récapitulatif', error);
    } else {
      commande.confirmation_envoyee_at = new Date().toISOString();
      afficherEtat();
      message.className = 'status-msg success';
      message.textContent = `Récapitulatif renvoyé à ${commande.client_email}.`;
    }

    message.hidden = false;
    bouton.disabled = false;
    bouton.textContent = 'Renvoyer au client';
  });
}

function cablerStatut(node, commande) {
  const select = node.querySelector('[data-slot="select-statut"]');
  const blocRemise = node.querySelector('[data-slot="bloc-remise"]');
  const caseRemettre = node.querySelector('[data-slot="remettre"]');
  const aideRemise = node.querySelector('[data-slot="remise-aide"]');
  const message = node.querySelector('[data-slot="message-statut"]');
  const bouton = node.querySelector('[data-action="enregistrer-statut"]');

  select.value = commande.statut;

  // Si les pièces sont déjà reparties en vente, la question ne se pose plus.
  // Le dire est plus utile que de masquer : sinon l'atelier se demande pourquoi
  // la case a disparu.
  const dejaRendu = commande.stock_rendu;
  if (dejaRendu) {
    caseRemettre.checked = false;
    caseRemettre.disabled = true;
    aideRemise.textContent = 'Les pièces de cette commande sont déjà revenues en vente.';
  }

  function majRemise() {
    blocRemise.hidden = select.value !== 'annulee';
  }
  majRemise();
  select.addEventListener('change', majRemise);

  bouton.addEventListener('click', async () => {
    message.hidden = true;
    bouton.disabled = true;
    bouton.textContent = 'Enregistrement…';

    const { error } = await client.rpc('changer_statut_commande', {
      p_commande_id: commande.id,
      p_statut: select.value,
      p_remettre_en_vente: select.value === 'annulee' && caseRemettre.checked && !dejaRendu,
    });

    bouton.disabled = false;
    bouton.textContent = 'Enregistrer';

    if (error) {
      // Le message vient de la base : il nomme la pièce qui manque, ce qu'un
      // texte générique ne pourrait pas faire.
      message.textContent = error.message ?? "Le statut n'a pas pu être enregistré.";
      message.hidden = false;
      console.error('commandes.js', error);
      return;
    }
    charger();
  });
}

async function charger() {
  client = await getAuthenticatedClient();
  const { data, error } = await client
    .from('commandes')
    .select('*, lignes_commande(*)')
    .order('created_at', { ascending: false });

  if (error) {
    conteneur.innerHTML = '<p class="empty-state">Erreur de chargement.</p>';
    console.error('commandes.js', error);
    return;
  }

  commandes = data ?? [];
  majCompteurs();
  rendre();
}

for (const bouton of document.querySelectorAll('[data-mode]')) {
  bouton.addEventListener('click', () => {
    modeActif = bouton.dataset.mode;
    for (const b of document.querySelectorAll('[data-mode]')) {
      const actif = b === bouton;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-pressed', String(actif));
    }
    majCompteurs();
    rendre();
  });
}

for (const bouton of document.querySelectorAll('[data-dossier]')) {
  bouton.addEventListener('click', () => {
    dossierActif = bouton.dataset.dossier;
    for (const b of document.querySelectorAll('[data-dossier]')) {
      b.classList.toggle('active', b === bouton);
    }
    rendre();
  });
}

// Au premier chargement, on ouvre le dossier qui contient quelque chose à
// faire. Arriver sur « Nouvelles » vide alors que trois commandes attendent en
// préparation obligerait à chercher.
async function demarrer() {
  await charger();
  if (commandes.some((c) => dossierDe(c) === 'nouvelle')) return;
  const premierRempli = ETAPES.find((etape) => commandes.some((c) => dossierDe(c) === etape));
  if (!premierRempli) return;
  document.querySelector(`[data-dossier="${premierRempli}"]`)?.click();
}

demarrer();
