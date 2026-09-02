// boutique-liste.js — grille de produits publiés, filtrable par catégorie et
// tranche de prix, triable. Pas de pagination : le catalogue d'un artisan
// reste petit, on charge tout et on filtre côté client.

import { supabase } from '../supabase-client.js';
import { formatPrix } from '../lib/format.js';

const grilleEl = document.getElementById('grille-produits');
const compteurEl = document.getElementById('compteur-produits');
const filtresCatEl = document.getElementById('filtres-categories');
const triEl = document.getElementById('tri');

let produits = [];
let categorieActive = '';

function tranchePrix() {
  const val = document.querySelector('input[name="prix"]:checked')?.value ?? '';
  if (!val) return null;
  const [min, max] = val.split('-');
  return { min: min ? Number(min) * 100 : 0, max: max ? Number(max) * 100 : Infinity };
}

async function chargerCategories() {
  const { data } = await supabase
    .from('categories')
    .select('id, nom')
    .eq('type', 'boutique')
    .eq('visible', true)
    .order('ordre');

  for (const cat of data ?? []) {
    const label = document.createElement('div');
    label.className = 'filter-row';
    label.innerHTML = `<button data-cat="${cat.id}" style="all:unset;cursor:pointer">${cat.nom}</button>`;
    filtresCatEl.appendChild(label);
  }

  filtresCatEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    categorieActive = btn.dataset.cat;
    afficher();
  });
}

async function chargerProduits() {
  const { data, error } = await supabase
    .from('produits')
    .select('id, titre, slug, sous_titre, prix_cents, photos, piece_unique, categorie_id, created_at')
    .eq('statut', 'publie')
    .gt('stock', 0);

  if (error) {
    grilleEl.innerHTML = '<p class="empty-state">Impossible de charger la boutique pour le moment.</p>';
    console.error('boutique-liste.js', error);
    return;
  }
  produits = data ?? [];
  afficher();
}

function afficher() {
  const tranche = tranchePrix();
  let items = produits.filter((p) => {
    if (categorieActive && p.categorie_id !== categorieActive) return false;
    if (tranche && (p.prix_cents < tranche.min || p.prix_cents > tranche.max)) return false;
    return true;
  });

  const tri = triEl.value;
  if (tri === 'prix-asc') items = [...items].sort((a, b) => a.prix_cents - b.prix_cents);
  else if (tri === 'prix-desc') items = [...items].sort((a, b) => b.prix_cents - a.prix_cents);
  else items = [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  compteurEl.textContent = `${items.length} pièce${items.length > 1 ? 's' : ''} disponible${items.length > 1 ? 's' : ''}`;

  grilleEl.innerHTML = '';
  if (items.length === 0) {
    grilleEl.innerHTML = '<p class="empty-state">Aucun produit ne correspond à ces filtres.</p>';
    return;
  }

  const template = document.getElementById('tpl-carte-produit');
  for (const p of items) {
    const node = template.content.cloneNode(true);
    const href = `/boutique/produit.html?slug=${encodeURIComponent(p.slug)}`;
    const photo = node.querySelector('.placeholder-img');
    photo.href = href;
    if (p.photos?.[0]) photo.style.background = `center/cover no-repeat url("${p.photos[0]}")`;
    const titre = node.querySelector('.card-title');
    titre.href = href;
    titre.textContent = p.titre;
    node.querySelector('[data-slot="sous-titre"]').textContent = p.sous_titre ?? (p.piece_unique ? 'Pièce unique' : '');
    node.querySelector('[data-slot="prix"]').textContent = formatPrix(p.prix_cents);
    grilleEl.appendChild(node);
  }
}

document.querySelectorAll('input[name="prix"]').forEach((r) => r.addEventListener('change', afficher));
triEl.addEventListener('change', afficher);

chargerCategories();
chargerProduits();
