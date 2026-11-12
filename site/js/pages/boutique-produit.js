// boutique-produit.js — fiche produit, lue via ?slug=, ajout au panier.

import { supabase } from '../supabase-client.js';
import { appliquerContenuSite } from '../site-content.js';
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
  const miniaturesEl = node.querySelector('[data-slot="miniatures"]');
  const imageCss = (url) => `url("${String(url).replace(/"/g, '%22')}")`;

  // Même règle que dans la grille de la boutique : cadre au format du site,
  // photo entière à l'intérieur (.photo-posee, components.css).
  function afficherEnGrand(url, miniature) {
    photoPrincipale.classList.add('photo-posee');
    photoPrincipale.style.backgroundImage = imageCss(url);
    // Le repère suit la miniature choisie : il restait sur la première quelle
    // que soit la photo affichée en grand.
    for (const m of miniaturesEl.children) m.classList.toggle('active', m === miniature);
  }

  photos.forEach((url) => {
    const div = document.createElement('div');
    div.className = 'placeholder-img photo-posee';
    div.style.backgroundImage = imageCss(url);
    div.addEventListener('click', () => afficherEnGrand(url, div));
    miniaturesEl.appendChild(div);
  });

  if (photos[0]) afficherEnGrand(photos[0], miniaturesEl.firstElementChild);
  else photoPrincipale.innerHTML = '<span>photo à venir</span>';

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

  // Pièce qui ne part pas en colis. La fonction serveur refuse de toute façon
  // la livraison, mais le client doit le savoir ici, avant de remplir son
  // panier, et non en découvrir la raison à l'étape du paiement.
  if (produit.retrait_showroom_seul) {
    const avis = node.querySelector('[data-slot="avis-retrait"]');
    avis.textContent = 'Retrait au showroom de Rambouillet uniquement : cette pièce ne peut pas être expédiée.';
    avis.hidden = false;
    // Le délai d'expédition ne s'applique pas à une pièce qui ne part jamais en
    // colis : l'afficher annoncerait un envoi qui n'aura pas lieu.
    node.querySelector('[data-slot="ligne-expedition"]').remove();
  }

  contenuEl.innerHTML = '';
  contenuEl.appendChild(node);

  // Les textes modifiables de cette fiche (mention de TVA, délai) vivent dans
  // le <template> : ils n'étaient pas encore dans la page quand nav.js a
  // hydraté contenu_site, et gardaient donc le texte écrit en dur dans le
  // gabarit. Une modification depuis l'administration ne se voyait pas ici.
  appliquerContenuSite();

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
