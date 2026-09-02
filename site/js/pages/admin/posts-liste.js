// posts-liste.js — table admin de tous les posts vitrine (tous statuts).

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatDate } from '../../lib/format.js';

async function charger() {
  const client = await getAuthenticatedClient();
  const { data, error } = await client
    .from('posts_vitrine')
    .select('id, titre, statut, date_projet, photo_apres_url, categories(nom)')
    .order('created_at', { ascending: false });

  const tbody = document.getElementById('table-posts');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Erreur de chargement.</td></tr>`;
    console.error('posts-liste.js', error);
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Aucun post pour le moment.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((p) => `
    <tr>
      <td><img class="thumb" src="${p.photo_apres_url ?? ''}" alt=""></td>
      <td><a href="/admin/posts/edition.html?id=${p.id}">${p.titre}</a></td>
      <td>${p.categories?.nom ?? '—'}</td>
      <td>${formatDate(p.date_projet)}</td>
      <td><span class="status-pill ${p.statut}">${p.statut === 'publie' ? 'En ligne' : 'Brouillon'}</span></td>
      <td><a href="/admin/posts/edition.html?id=${p.id}">Modifier</a></td>
    </tr>`).join('');
}

charger();
