// messages.js — liste des messages de contact, détail dépliable, marquage lu.
// Pas de réponse intégrée : un lien mailto: suffit, Valérie répond depuis sa
// propre messagerie (voir plan).

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatDate } from '../../lib/format.js';

const tbody = document.getElementById('table-messages');
let client;

async function charger() {
  client = await getAuthenticatedClient();
  const { data, error } = await client.from('messages_contact').select('*').order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Erreur de chargement.</td></tr>';
    console.error('messages.js', error);
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Aucun message pour le moment.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  const templateDetail = document.getElementById('tpl-message-detail');

  for (const msg of data) {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.innerHTML = `
      <td>${msg.lu ? '' : '<span class="badge" style="background:var(--color-accent-deep)">NOUVEAU</span>'}</td>
      <td>${msg.nom}</td>
      <td>${msg.sujet ?? '—'}</td>
      <td>${formatDate(msg.created_at)}</td>
      <td>▾</td>
    `;
    tbody.appendChild(tr);

    const detailNode = templateDetail.content.cloneNode(true);
    detailNode.querySelector('.detail-row').hidden = true;
    detailNode.querySelector('[data-slot="email"]').textContent = msg.email;
    detailNode.querySelector('[data-slot="telephone"]').textContent = msg.telephone ?? '';
    detailNode.querySelector('[data-slot="message"]').textContent = msg.message;
    const lienMail = detailNode.querySelector('[data-slot="mailto"]');
    lienMail.href = `mailto:${msg.email}?subject=${encodeURIComponent('Re: ' + (msg.sujet ?? 'Votre message'))}`;

    const detailRow = detailNode.querySelector('.detail-row');
    tbody.appendChild(detailNode);
    const detailRowRef = tbody.lastElementChild;

    tr.addEventListener('click', async () => {
      detailRowRef.hidden = !detailRowRef.hidden;
      if (!msg.lu) {
        await client.from('messages_contact').update({ lu: true }).eq('id', msg.id);
        msg.lu = true;
        tr.querySelector('td').innerHTML = '';
      }
    });

    detailRowRef.querySelector('[data-action="marquer-lu"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await client.from('messages_contact').update({ lu: true }).eq('id', msg.id);
      charger();
    });
  }
}

charger();
