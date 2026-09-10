// produits-liste.js — table admin de tous les produits (tous statuts), avec
// recherche, filtres et tri.
//
// Tout est chargé une fois puis filtré dans le navigateur : le catalogue d'un
// artisan reste petit, et cela rend chaque changement de filtre instantané,
// sans aller-retour avec la base.

import { getAuthenticatedClient } from '../../supabase-client.js';
import { formatPrix, echapper } from '../../lib/format.js';

const tbody = document.getElementById('table-produits');
const compteurEl = document.getElementById('compteur-produits');
const champs = {
  recherche: document.getElementById('f-recherche'),
  categorie: document.getElementById('f-categorie'),
  statut: document.getElementById('f-statut'),
  prixMin: document.getElementById('f-prix-min'),
  prixMax: document.getElementById('f-prix-max'),
  tri: document.getElementById('f-tri'),
};

let produits = [];
let client;

// Comparaison de textes en français : "Écran" doit se ranger avec les E, et
// "abat-jour" avec les A, ce qu'une comparaison brute de chaînes ne fait pas.
const collateur = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

const TRIS = {
  recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  ancien: (a, b) => new Date(a.created_at) - new Date(b.created_at),
  'titre-az': (a, b) => collateur.compare(a.titre, b.titre),
  'titre-za': (a, b) => collateur.compare(b.titre, a.titre),
  'prix-asc': (a, b) => a.prix_cents - b.prix_cents,
  'prix-desc': (a, b) => b.prix_cents - a.prix_cents,
  'stock-asc': (a, b) => a.stock - b.stock,
  'stock-desc': (a, b) => b.stock - a.stock,
};

function filtrer() {
  const recherche = champs.recherche.value.trim().toLowerCase();
  const categorie = champs.categorie.value;
  const statut = champs.statut.value;
  // Les bornes de prix sont saisies en euros, les prix stockés en centimes.
  const min = champs.prixMin.value === '' ? null : Number(champs.prixMin.value) * 100;
  const max = champs.prixMax.value === '' ? null : Number(champs.prixMax.value) * 100;

  return produits.filter((p) => {
    if (recherche && !p.titre.toLowerCase().includes(recherche)) return false;
    if (categorie && p.categorie_id !== categorie) return false;
    if (statut && p.statut !== statut) return false;
    if (min !== null && p.prix_cents < min) return false;
    if (max !== null && p.prix_cents > max) return false;
    return true;
  });
}

function afficher() {
  const items = filtrer().sort(TRIS[champs.tri.value] ?? TRIS.recent);

  const total = produits.length;
  compteurEl.textContent = items.length === total
    ? `${total} produit${total > 1 ? 's' : ''}`
    : `${items.length} produit${items.length > 1 ? 's' : ''} sur ${total}`;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${
      total === 0 ? 'Aucun produit pour le moment.' : 'Aucun produit ne correspond à ces filtres.'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((p) => `
    <tr>
      <td><img class="thumb" src="${p.photos?.[0] ?? ''}" alt=""></td>
      <td><a href="/admin/produits/edition.html?id=${p.id}">${echapper(p.titre)}</a></td>
      <td>${echapper(p.categories?.nom ?? '—')}</td>
      <td>${formatPrix(p.prix_cents)}</td>
      <td>${p.stock}</td>
      <td><span class="status-pill ${p.statut}">${p.statut === 'publie' ? 'En ligne' : 'Brouillon'}</span></td>
      <td><a href="/admin/produits/edition.html?id=${p.id}">Modifier</a></td>
    </tr>`).join('');
}

async function chargerCategories() {
  const { data } = await client.from('categories').select('id, nom').eq('type', 'boutique').order('ordre');
  for (const c of data ?? []) {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.nom;
    champs.categorie.appendChild(option);
  }
}

async function charger() {
  client = await getAuthenticatedClient();
  await chargerCategories();

  const { data, error } = await client
    .from('produits')
    .select('id, titre, prix_cents, stock, statut, photos, categorie_id, created_at, categories(nom)')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Erreur de chargement.</td></tr>`;
    compteurEl.textContent = '';
    console.error('produits-liste.js', error);
    return;
  }

  produits = data ?? [];
  afficher();
}

for (const champ of Object.values(champs)) {
  // "input" plutôt que "change" : la liste se met à jour à la frappe, sans
  // avoir à quitter le champ de recherche.
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
