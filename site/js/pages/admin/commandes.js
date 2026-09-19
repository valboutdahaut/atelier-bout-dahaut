// commandes.js — liste + détail dépliable + changement de statut.
//
// Depuis la mise en place du paiement en ligne, une commande existe en base
// AVANT d'être réglée : elle est créée au moment où le client valide ses
// coordonnées, puis il part sur la page de Stripe. Beaucoup n'iront pas au
// bout. La liste doit donc séparer nettement ce qui est payé de ce qui ne
// l'est pas, sinon l'atelier prépare un colis pour un panier abandonné.
// Par défaut on n'affiche que les commandes réglées.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatPrix, formatDate, echapper } from '../../lib/format.js';

const conteneur = document.getElementById('liste-commandes');
let client;
let filtre = 'payees';

const LIBELLES_PAIEMENT = {
  paye: 'Payée',
  en_attente: 'Paiement en cours',
  expire: 'Abandonnée',
  annule_client: 'Abandonnée',
  echoue: 'Paiement refusé',
  non_requis: 'Sans paiement en ligne',
};

// Une pastille verte pour ce qui est encaissé, grise pour ce qui est resté en
// chemin. Le rouge est réservé au paiement refusé, le seul cas qui demande une
// vérification.
const TEINTES_PAIEMENT = {
  paye: 'publie',
  non_requis: 'publie',
  echoue: 'alerte',
};

function libellePaiement(statut) {
  return LIBELLES_PAIEMENT[statut] ?? statut;
}

function libelleStatut(statut) {
  return { nouvelle: 'Nouvelle', en_preparation: 'En préparation', expediee: 'Expédiée', retiree: 'Retirée', annulee: 'Annulée' }[statut] ?? statut;
}

function detailPaiement(commande) {
  const lignes = [libellePaiement(commande.paiement_statut)];
  if (commande.paye_le) lignes.push(`Réglée le ${formatDate(commande.paye_le)}`);
  if (commande.paiement_statut === 'en_attente') {
    lignes.push('Les pièces restent réservées une heure, puis sont automatiquement remises en vente.');
  }
  return lignes.join('<br>');
}

async function charger() {
  client = await getAuthenticatedClient();

  let requete = client
    .from('commandes')
    .select('*, lignes_commande(*)')
    .order('created_at', { ascending: false });

  if (filtre === 'payees') requete = requete.in('paiement_statut', ['paye', 'non_requis']);

  const { data: commandes, error } = await requete;

  if (error) {
    conteneur.innerHTML = '<p class="empty-state">Erreur de chargement.</p>';
    console.error('commandes.js', error);
    return;
  }
  if (!commandes || commandes.length === 0) {
    conteneur.innerHTML = filtre === 'payees'
      ? '<p class="empty-state">Aucune commande réglée pour le moment.</p>'
      : '<p class="empty-state">Aucune commande pour le moment.</p>';
    return;
  }

  const template = document.getElementById('tpl-commande');
  conteneur.innerHTML = '';

  for (const commande of commandes) {
    const node = template.content.cloneNode(true);
    const resume = node.querySelector('[data-slot="resume"]');
    const detail = node.querySelector('[data-slot="detail"]');

    node.querySelector('[data-slot="numero"]').textContent = `${commande.numero} — ${formatDate(commande.created_at)}`;

    const badgePaiement = node.querySelector('[data-slot="paiement-badge"]');
    badgePaiement.textContent = libellePaiement(commande.paiement_statut);
    badgePaiement.classList.add(TEINTES_PAIEMENT[commande.paiement_statut] ?? 'brouillon');

    const badge = node.querySelector('[data-slot="statut-badge"]');
    badge.textContent = libelleStatut(commande.statut);
    badge.classList.add(commande.statut === 'nouvelle' ? 'brouillon' : 'publie');

    node.querySelector('[data-slot="client"]').textContent = `${commande.client_nom} · ${commande.client_email}`;
    node.querySelector('[data-slot="total"]').textContent = formatPrix(commande.total_cents);

    // Note laissée par marquer_commande_payee quand un paiement arrive après
    // que le stock a été rendu. Rare, mais il faut le voir tout de suite.
    if (commande.notes) {
      const alerte = node.querySelector('[data-slot="alerte"]');
      alerte.textContent = commande.notes;
      alerte.hidden = false;
    }

    node.querySelector('[data-slot="lignes"]').innerHTML =
      '<thead><tr><th>Produit</th><th>Qté</th><th>Prix</th></tr></thead><tbody>' +
      commande.lignes_commande.map((l) => `<tr><td>${echapper(l.titre_produit)}</td><td>${l.quantite}</td><td>${formatPrix(l.prix_unitaire_cents)}</td></tr>`).join('') +
      '</tbody>';

    // Coordonnées saisies par le client : elles passent par echapper(), sans
    // quoi un nom de rue contenant un chevron casserait l'affichage.
    node.querySelector('[data-slot="coordonnees"]').innerHTML =
      `${echapper(commande.client_telephone ?? '—')}<br>`
      + (commande.mode_retrait === 'livraison'
        ? echapper(commande.adresse_livraison ?? '').replace(/\n/g, '<br>')
        : 'Retrait au showroom');

    node.querySelector('[data-slot="paiement-detail"]').innerHTML = detailPaiement(commande);

    const select = node.querySelector('[data-slot="select-statut"]');
    select.value = commande.statut;

    resume.addEventListener('click', () => { detail.hidden = !detail.hidden; });

    node.querySelector('[data-action="enregistrer-statut"]').addEventListener('click', async () => {
      const { error } = await client.from('commandes').update({ statut: select.value }).eq('id', commande.id);
      if (error) alert("Impossible d'enregistrer le statut.");
      else charger();
    });

    conteneur.appendChild(node);
  }
}

document.querySelectorAll('[data-filtre]').forEach((bouton) => {
  bouton.addEventListener('click', () => {
    filtre = bouton.dataset.filtre;
    document.querySelectorAll('[data-filtre]').forEach((b) => b.classList.toggle('actif', b === bouton));
    conteneur.innerHTML = '<p class="empty-state">Chargement…</p>';
    charger();
  });
});

charger();
