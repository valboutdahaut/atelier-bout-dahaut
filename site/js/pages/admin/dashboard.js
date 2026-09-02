// dashboard.js — vue d'ensemble admin. Utilise le client authentifié partout
// car on doit voir les brouillons, les commandes et les messages (RLS réserve
// tout ça à l'admin connecté).

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatPrix } from '../../lib/format.js';

async function charger() {
  const client = await getAuthenticatedClient();

  const [{ count: commandesNouvelles }, { count: messagesNonLus }, { data: postsBrouillons }] = await Promise.all([
    client.from('commandes').select('id', { count: 'exact', head: true }).eq('statut', 'nouvelle'),
    client.from('messages_contact').select('id', { count: 'exact', head: true }).eq('lu', false),
    client.from('posts_vitrine').select('id', { count: 'exact', head: true }).eq('statut', 'brouillon'),
  ]);

  const aTraiterEl = document.getElementById('a-traiter');
  const lignes = [
    { label: `${commandesNouvelles ?? 0} commande${commandesNouvelles === 1 ? '' : 's'} à traiter`, href: '/admin/commandes.html' },
    { label: `${messagesNonLus ?? 0} message${messagesNonLus === 1 ? '' : 's'} de contact non lu${messagesNonLus === 1 ? '' : 's'}`, href: '/admin/messages.html' },
    { label: `${postsBrouillons?.length ?? 0} post${(postsBrouillons?.length ?? 0) === 1 ? '' : 's'} en brouillon`, href: '/admin/posts/index.html' },
  ];
  aTraiterEl.innerHTML = lignes.map((l) => `<a href="${l.href}">${l.label} <span style="color:var(--color-accent-deep)">→</span></a>`).join('');

  const { data: produits } = await client
    .from('produits')
    .select('titre, stock, prix_cents, photos')
    .order('created_at', { ascending: false })
    .limit(3);

  document.querySelector('#table-derniers-produits tbody').innerHTML =
    (produits ?? []).map((p) => `
      <tr>
        <td><img class="thumb" src="${p.photos?.[0] ?? ''}" alt=""></td>
        <td>${p.titre}<br><span style="color:var(--color-text-muted);font-size:13px">Stock ${p.stock}</span></td>
        <td style="text-align:right">${formatPrix(p.prix_cents)}</td>
      </tr>`).join('') || '<tr><td class="empty-state">Aucun produit pour le moment.</td></tr>';

  const { data: posts } = await client
    .from('posts_vitrine')
    .select('titre, statut, photo_apres_url')
    .order('created_at', { ascending: false })
    .limit(3);

  document.querySelector('#table-derniers-posts tbody').innerHTML =
    (posts ?? []).map((p) => `
      <tr>
        <td><img class="thumb" src="${p.photo_apres_url ?? ''}" alt=""></td>
        <td>${p.titre}</td>
        <td><span class="status-pill ${p.statut}">${p.statut === 'publie' ? 'En ligne' : 'Brouillon'}</span></td>
      </tr>`).join('') || '<tr><td class="empty-state">Aucun post pour le moment.</td></tr>';
}

charger();
