// posts-liste.js — table admin de tous les posts vitrine (tous statuts), avec
// recherche, filtres et tri.
//
// Même parti pris que la liste des produits : tout est chargé une fois puis
// filtré dans le navigateur, ce qui rend chaque changement instantané.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatDate, echapper } from '../../lib/format.js';

const tbody = document.getElementById('table-posts');
const compteurEl = document.getElementById('compteur-posts');
const champs = {
  recherche: document.getElementById('f-recherche'),
  savoirFaire: document.getElementById('f-savoir-faire'),
  statut: document.getElementById('f-statut'),
  dateMin: document.getElementById('f-date-min'),
  dateMax: document.getElementById('f-date-max'),
  tri: document.getElementById('f-tri'),
};

let posts = [];
let client;

const collateur = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

const TRIS = {
  'date-desc': (a, b) => new Date(b.date_projet) - new Date(a.date_projet),
  'date-asc': (a, b) => new Date(a.date_projet) - new Date(b.date_projet),
  'titre-az': (a, b) => collateur.compare(a.titre, b.titre),
  'titre-za': (a, b) => collateur.compare(b.titre, a.titre),
  recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  ancien: (a, b) => new Date(a.created_at) - new Date(b.created_at),
};

function filtrer() {
  const recherche = champs.recherche.value.trim().toLowerCase();
  const savoirFaire = champs.savoirFaire.value;
  const statut = champs.statut.value;
  // date_projet est stockée en AAAA-MM-JJ, comme la valeur d'un champ date :
  // la comparaison de chaînes suffit et évite les pièges de fuseau horaire.
  const dateMin = champs.dateMin.value;
  const dateMax = champs.dateMax.value;

  return posts.filter((p) => {
    if (recherche && !p.titre.toLowerCase().includes(recherche)) return false;
    if (savoirFaire && p.savoir_faire_id !== savoirFaire) return false;
    if (statut && p.statut !== statut) return false;
    if (dateMin && p.date_projet < dateMin) return false;
    if (dateMax && p.date_projet > dateMax) return false;
    return true;
  });
}

function afficher() {
  const items = filtrer().sort(TRIS[champs.tri.value] ?? TRIS['date-desc']);

  const total = posts.length;
  compteurEl.textContent = items.length === total
    ? `${total} réalisation${total > 1 ? 's' : ''}`
    : `${items.length} réalisation${items.length > 1 ? 's' : ''} sur ${total}`;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${
      total === 0 ? 'Aucun post pour le moment.' : 'Aucune réalisation ne correspond à ces filtres.'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((p) => `
    <tr>
      <td><img class="thumb" src="${p.photo_apres_url ?? ''}" alt=""></td>
      <td><a href="/admin/posts/edition.html?id=${p.id}">${echapper(p.titre)}</a></td>
      <td>${echapper(p.categories?.nom ?? '—')}</td>
      <td>${formatDate(p.date_projet)}</td>
      <td><span class="status-pill ${p.statut}">${p.statut === 'publie' ? 'En ligne' : 'Brouillon'}</span></td>
      <td><a href="/admin/posts/edition.html?id=${p.id}">Modifier</a></td>
    </tr>`).join('');
}

async function chargerSavoirFaire() {
  const { data } = await client.from('categories').select('id, nom').eq('type', 'savoir_faire').order('ordre');
  for (const c of data ?? []) {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.nom;
    champs.savoirFaire.appendChild(option);
  }
}

async function charger() {
  client = await getAuthenticatedClient();
  await chargerSavoirFaire();

  const { data, error } = await client
    .from('posts_vitrine')
    .select('id, titre, statut, date_projet, created_at, photo_apres_url, savoir_faire_id, categories(nom)')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Erreur de chargement.</td></tr>`;
    compteurEl.textContent = '';
    console.error('posts-liste.js', error);
    return;
  }

  posts = data ?? [];
  afficher();
}

for (const champ of Object.values(champs)) {
  champ.addEventListener('input', afficher);
}

document.getElementById('f-reset').addEventListener('click', () => {
  for (const champ of Object.values(champs)) {
    if (champ.tagName === 'SELECT') champ.selectedIndex = 0;
    else champ.value = '';
  }
  afficher();
});

charger();
