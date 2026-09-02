// boutique-produit.js — fiche produit, lue via ?slug=, ajout au panier.

import { supabase } from '../supabase-client.js';
import { formatPrix } from '../lib/format.js';
import { addToCart } from '../cart.js';

const contenuEl = document.getElementById('contenu-produit');
const filAriane = document.getElementById('fil-ariane');
const slug = new URLSearchParams(location.search).get('slug');

let quantite = 1;
let produitCourant = null;

async function charger() {
  if (!slug) return introuvable();

  const { data: produit, error } = await supabase
    .from('produits')
    .select('*, categories(nom)')
    .eq('slug', slug)
    .eq('statut', 'publie')
    .single();

  if (error || !produit) return introuvable();

  produitCourant = produit;
  document.title = `${produit.titre} — L'Atelier du Bout d'à Haut`;
  document.getElementById('page-title').textContent = document.title;
  filAriane.innerHTML = `<a href="/boutique/index.html">Boutique</a> / <span style="color:var(--color-text)">${produit.titre}</span>`;

  const template = document.getElementById('tpl-produit');
  const node = template.content.cloneNode(true);

  const photoPrincipale = node.querySelector('[data-slot="photo-principale"]');
  const photos = produit.photos ?? [];
  if (photos[0]) photoPrincipale.style.background = `center/cover no-repeat url("${photos[0]}")`;
  else photoPrincipale.innerHTML = '<span>photo à venir</span>';

  const miniaturesEl = node.querySelector('[data-slot="miniatures"]');
  photos.forEach((url, i) => {
    const div = document.createElement('div');
    div.className = 'placeholder-img';
    div.style.background = `center/cover no-repeat url("${url}")`;
    div.style.cursor = 'pointer';
    if (i === 0) div.style.outline = '2px solid var(--color-accent-deep)';
    div.addEventListener('click', () => { photoPrincipale.style.background = div.style.background; });
    miniaturesEl.appendChild(div);
  });

  node.querySelector('[data-slot="categorie"]').textContent =
    `${produit.categories?.nom ?? 'Boutique'}${produit.piece_unique ? ' · pièce unique' : ''}`;
  node.querySelector('[data-slot="titre"]').textContent = produit.titre;
  node.querySelector('[data-slot="prix"]').textContent = formatPrix(produit.prix_cents);
  node.querySelector('[data-slot="description"]').textContent = produit.description ?? '';

  const stockEl = node.querySelector('[data-slot="stock"]');
  if (produit.stock > 0) {
    stockEl.innerHTML = `<span style="width:7px;height:7px;background:var(--color-accent-deep);border-radius:50%"></span>En stock — ${produit.stock} exemplaire${produit.stock > 1 ? 's' : ''}`;
  } else {
    stockEl.innerHTML = `<span style="color:var(--color-text-faint)">Épuisé</span>`;
  }

  contenuEl.innerHTML = '';
  contenuEl.appendChild(node);
  wireQuantite(produit.stock);
}

function wireQuantite(stockMax) {
  const qtySpan = document.querySelector('[data-slot="quantite"]');
  const btnAjouter = document.getElementById('btn-ajouter-panier');

  if (stockMax <= 0) {
    btnAjouter.disabled = true;
    btnAjouter.textContent = 'Épuisé';
    return;
  }

  document.querySelector('[data-action="moins"]').addEventListener('click', () => {
    quantite = Math.max(1, quantite - 1);
    qtySpan.textContent = quantite;
  });
  document.querySelector('[data-action="plus"]').addEventListener('click', () => {
    quantite = Math.min(stockMax, quantite + 1);
    qtySpan.textContent = quantite;
  });
  btnAjouter.addEventListener('click', () => {
    addToCart(produitCourant.id, quantite);
    btnAjouter.textContent = 'Ajouté ✓';
    setTimeout(() => { btnAjouter.textContent = 'Ajouter au panier'; }, 1500);
  });
}

function introuvable() {
  contenuEl.innerHTML = '<p class="empty-state" style="padding:96px 0">Produit introuvable ou plus disponible.</p>';
}

charger();
