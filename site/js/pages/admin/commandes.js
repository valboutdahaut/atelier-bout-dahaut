// commandes.js — liste + détail dépliable + changement de statut.
// Portée volontairement minimale (voir plan) : pas de facturation, pas
// d'emails automatiques.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatPrix, formatDate } from '../../lib/format.js';

const conteneur = document.getElementById('liste-commandes');
let client;

async function charger() {
  client = await getAuthenticatedClient();
  const { data: commandes, error } = await client
    .from('commandes')
    .select('*, lignes_commande(*)')
    .order('created_at', { ascending: false });

  if (error) {
    conteneur.innerHTML = '<p class="empty-state">Erreur de chargement.</p>';
    console.error('commandes.js', error);
    return;
  }
  if (!commandes || commandes.length === 0) {
    conteneur.innerHTML = '<p class="empty-state">Aucune commande pour le moment.</p>';
    return;
  }

  const template = document.getElementById('tpl-commande');
  conteneur.innerHTML = '';

  for (const commande of commandes) {
    const node = template.content.cloneNode(true);
    const resume = node.querySelector('[data-slot="resume"]');
    const detail = node.querySelector('[data-slot="detail"]');

    node.querySelector('[data-slot="numero"]').textContent = `${commande.numero} — ${formatDate(commande.created_at)}`;
    const badge = node.querySelector('[data-slot="statut-badge"]');
    badge.textContent = libelleStatut(commande.statut);
    badge.classList.add(commande.statut === 'nouvelle' ? 'brouillon' : 'publie');
    node.querySelector('[data-slot="client"]').textContent = `${commande.client_nom} · ${commande.client_email}`;
    node.querySelector('[data-slot="total"]').textContent = formatPrix(commande.total_cents);

    node.querySelector('[data-slot="lignes"]').innerHTML =
      '<thead><tr><th>Produit</th><th>Qté</th><th>Prix</th></tr></thead><tbody>' +
      commande.lignes_commande.map((l) => `<tr><td>${l.titre_produit}</td><td>${l.quantite}</td><td>${formatPrix(l.prix_unitaire_cents)}</td></tr>`).join('') +
      '</tbody>';

    node.querySelector('[data-slot="coordonnees"]').innerHTML =
      `${commande.client_telephone ?? '—'}<br>${commande.mode_retrait === 'livraison' ? commande.adresse_livraison ?? '' : 'Retrait au showroom'}`;

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

function libelleStatut(statut) {
  return { nouvelle: 'Nouvelle', en_preparation: 'En préparation', expediee: 'Expédiée', retiree: 'Retirée', annulee: 'Annulée' }[statut] ?? statut;
}

charger();
