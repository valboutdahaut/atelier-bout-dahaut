// messages.js — messagerie de contact : trois dossiers (nouveaux, traités,
// archivés), filtres par sujet et recherche, pièces jointes, réponse par Gmail.
//
// Un message archivé reste consultable un mois, puis disparaît. La suppression
// est faite par la fonction SQL purger_messages_archives(), appelée à
// l'ouverture des archives et, si l'extension est disponible, chaque nuit par
// une tâche planifiée. Deux déclencheurs valent mieux qu'un : la purge ne doit
// pas dépendre de la venue de l'artisane, ni d'une extension qui pourrait ne
// pas être activée.
//
// Tout ce qui vient d'un visiteur (nom, sujet, message) est posé avec
// textContent et jamais injecté en HTML : ces textes sont saisis par le public,
// les traiter comme du code exécuterait n'importe quoi dans la session
// d'administration.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatDate } from '../../lib/format.js';

const BUCKET = 'messages-photos';
const JOURS_AVANT_SUPPRESSION = 30;

const tbody = document.getElementById('table-messages');
const dossiersEl = document.getElementById('dossiers');
const filtreSujet = document.getElementById('filtre-sujet');
const filtreRecherche = document.getElementById('filtre-recherche');
const btnReinit = document.getElementById('btn-reinit');
const compteEl = document.getElementById('compte-resultats');
const template = document.getElementById('tpl-message-detail');

let client;
let messages = [];
let dossier = 'nouveau';

const LIBELLES = { nouveau: 'Nouveaux messages', traite: 'Traités', archive: 'Archivés' };

/** Sujet affiché : le sujet libre prend la place d'« Autre ». */
function sujetAffiche(msg) {
  if (msg.sujet === 'Autre' && msg.sujet_libre) return msg.sujet_libre;
  return msg.sujet ?? '—';
}

/** Date de suppression d'un message archivé. */
function echeance(msg) {
  if (!msg.archive_le) return null;
  const d = new Date(msg.archive_le);
  d.setDate(d.getDate() + JOURS_AVANT_SUPPRESSION);
  return d;
}

function majCompteurs() {
  for (const statut of Object.keys(LIBELLES)) {
    const el = dossiersEl.querySelector(`[data-compteur="${statut}"]`);
    if (el) el.textContent = String(messages.filter((m) => m.statut === statut).length);
  }
}

/** La liste des sujets suit ce qui a réellement été reçu, pas une liste figée. */
function majListeSujets() {
  const actuel = filtreSujet.value;
  const sujets = [...new Set(messages.map(sujetAffiche))].sort((a, b) => a.localeCompare(b, 'fr'));
  filtreSujet.replaceChildren(new Option('Tous les sujets', ''));
  for (const s of sujets) filtreSujet.appendChild(new Option(s, s));
  filtreSujet.value = sujets.includes(actuel) ? actuel : '';
}

function messagesVisibles() {
  const recherche = filtreRecherche.value.trim().toLowerCase();
  const sujet = filtreSujet.value;
  return messages.filter((m) => {
    if (m.statut !== dossier) return false;
    if (sujet && sujetAffiche(m) !== sujet) return false;
    if (!recherche) return true;
    return [m.nom, m.email, m.message, sujetAffiche(m)]
      .filter(Boolean)
      .some((champ) => champ.toLowerCase().includes(recherche));
  });
}

async function changerStatut(msg, statut) {
  const maj = { statut };
  // La date d'archivage fait courir le délai avant suppression. Elle est
  // remise à zéro quand le message ressort des archives, sinon un message
  // restauré puis ré-archivé disparaîtrait plus tôt que prévu.
  maj.archive_le = statut === 'archive' ? new Date().toISOString() : null;

  const { error } = await client.from('messages_contact').update(maj).eq('id', msg.id);
  if (error) {
    console.error('messages.js : changement de statut', error);
    alert("Le changement n'a pas pu être enregistré.");
    return;
  }
  Object.assign(msg, maj);
  majCompteurs();
  afficher();
}

/** Liens temporaires vers les pièces jointes : le bucket est privé. */
async function afficherPhotos(conteneur, chemins) {
  if (!chemins || chemins.length === 0) return;
  const { data, error } = await client.storage.from(BUCKET).createSignedUrls(chemins, 3600);
  if (error) {
    console.error('messages.js : liens des photos', error);
    return;
  }
  for (const item of data ?? []) {
    if (!item.signedUrl) continue;
    const a = document.createElement('a');
    a.href = item.signedUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const img = document.createElement('img');
    img.src = item.signedUrl;
    img.alt = 'Photo jointe au message';
    img.loading = 'lazy';
    a.appendChild(img);
    conteneur.appendChild(a);
  }
  conteneur.hidden = false;
}

function construireLigne(msg) {
  const tr = document.createElement('tr');
  tr.style.cursor = 'pointer';
  for (const valeur of [msg.nom, sujetAffiche(msg), formatDate(msg.created_at), '▾']) {
    const td = document.createElement('td');
    td.textContent = valeur;
    tr.appendChild(td);
  }

  const detail = template.content.cloneNode(true);
  const ligneDetail = detail.querySelector('.detail-row');
  ligneDetail.hidden = true;

  detail.querySelector('[data-slot="email"]').textContent = msg.email;
  detail.querySelector('[data-slot="telephone"]').textContent = msg.telephone ?? '';
  detail.querySelector('[data-slot="message"]').textContent = msg.message;

  const sujetComplet = detail.querySelector('[data-slot="sujet-complet"]');
  sujetComplet.textContent = msg.sujet === 'Autre' && msg.sujet_libre
    ? `Autre : ${msg.sujet_libre}`
    : sujetAffiche(msg);

  // Réponse depuis la boîte Gmail de l'atelier. Un lien mailto: ouvrirait le
  // logiciel de messagerie du poste, souvent aucun ou mal configuré.
  const repondre = detail.querySelector('[data-slot="repondre"]');
  const objet = `Re : ${sujetAffiche(msg)}`;
  repondre.href = 'https://mail.google.com/mail/?view=cm&fs=1'
    + `&to=${encodeURIComponent(msg.email)}`
    + `&su=${encodeURIComponent(objet)}`;

  const echeanceEl = detail.querySelector('[data-slot="echeance"]');
  const date = echeance(msg);
  if (msg.statut === 'archive' && date) {
    echeanceEl.textContent = `Suppression définitive le ${formatDate(date.toISOString())}.`;
    echeanceEl.hidden = false;
  }

  const btnTraite = detail.querySelector('[data-action="traite"]');
  const btnArchive = detail.querySelector('[data-action="archive"]');
  const btnRestaurer = detail.querySelector('[data-action="restaurer"]');
  btnTraite.hidden = msg.statut === 'traite';
  btnArchive.hidden = msg.statut === 'archive';
  btnRestaurer.hidden = msg.statut !== 'archive';

  btnTraite.addEventListener('click', (e) => { e.stopPropagation(); changerStatut(msg, 'traite'); });
  btnArchive.addEventListener('click', (e) => { e.stopPropagation(); changerStatut(msg, 'archive'); });
  btnRestaurer.addEventListener('click', (e) => { e.stopPropagation(); changerStatut(msg, 'traite'); });

  const photosEl = detail.querySelector('[data-slot="photos"]');
  let photosChargees = false;

  tr.addEventListener('click', async () => {
    ligneDetail.hidden = !ligneDetail.hidden;
    // Les liens temporaires ne sont demandés qu'à la première ouverture : les
    // fabriquer pour toute la liste ferait autant de requêtes inutiles.
    if (!ligneDetail.hidden && !photosChargees) {
      photosChargees = true;
      await afficherPhotos(photosEl, msg.photos);
    }
  });

  return [tr, ligneDetail];
}

function afficher() {
  const visibles = messagesVisibles();
  const total = messages.filter((m) => m.statut === dossier).length;

  compteEl.textContent = visibles.length === total
    ? `${total} message${total > 1 ? 's' : ''}`
    : `${visibles.length} message${visibles.length > 1 ? 's' : ''} sur ${total}`;

  if (visibles.length === 0) {
    const vide = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'empty-state';
    td.textContent = total === 0
      ? `Aucun message dans « ${LIBELLES[dossier]} ».`
      : 'Aucun message ne correspond à ces filtres.';
    vide.appendChild(td);
    tbody.replaceChildren(vide);
    return;
  }

  tbody.replaceChildren(...visibles.flatMap(construireLigne));
}

async function charger() {
  client = await getAuthenticatedClient();

  // Purge à l'ouverture, en plus de la tâche nocturne. Un échec n'est pas
  // bloquant : la liste s'affiche quand même.
  const { error: erreurPurge } = await client.rpc('purger_messages_archives');
  if (erreurPurge) console.warn('messages.js : purge impossible', erreurPurge);

  const { data, error } = await client
    .from('messages_contact')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'empty-state';
    td.textContent = 'Erreur de chargement.';
    tr.appendChild(td);
    tbody.replaceChildren(tr);
    console.error('messages.js', error);
    return;
  }

  messages = data ?? [];
  majCompteurs();
  majListeSujets();
  afficher();
}

dossiersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.dossier');
  if (!btn) return;
  dossier = btn.dataset.dossier;
  for (const b of dossiersEl.querySelectorAll('.dossier')) {
    b.classList.toggle('active', b === btn);
  }
  afficher();
});

filtreSujet.addEventListener('change', afficher);
filtreRecherche.addEventListener('input', afficher);
btnReinit.addEventListener('click', () => {
  filtreSujet.value = '';
  filtreRecherche.value = '';
  afficher();
});

charger();
