// produits-liste.js — table admin de tous les produits (tous statuts).

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatPrix } from '../../lib/format.js';

async function charger() {
  const client = await getAuthenticatedClient();
  const { data, error } = await client
    .from('produits')
    .select('id, titre, prix_cents, stock, statut, photos, categories(nom)')
    .order('created_at', { ascending: false });

  const tbody = document.getElementById('table-produits');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Erreur de chargement.</td></tr>`;
    console.error('produits-liste.js', error);
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Aucun produit pour le moment.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((p) => `
    <tr>
      <td><img class="thumb" src="${p.photos?.[0] ?? ''}" alt=""></td>
      <td><a href="/admin/produits/edition.html?id=${p.id}">${p.titre}</a></td>
      <td>${p.categories?.nom ?? '—'}</td>
      <td>${formatPrix(p.prix_cents)}</td>
      <td>${p.stock}</td>
      <td><span class="status-pill ${p.statut}">${p.statut === 'publie' ? 'En ligne' : 'Brouillon'}</span></td>
      <td><a href="/admin/produits/edition.html?id=${p.id}">Modifier</a></td>
    </tr>`).join('');
}

charger();
