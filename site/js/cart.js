// cart.js — panier client, stocké en localStorage.
//
// Volontairement minimal : on ne stocke QUE {produit_id, quantite}, jamais le
// prix. Le prix est toujours relu depuis Supabase au moment de l'affichage,
// pour ne jamais montrer un prix périmé si l'admin l'a changé entre-temps.

const STORAGE_KEY = 'atelier-bdh-panier';

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(lignes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lignes));
  document.dispatchEvent(new CustomEvent('cart:changed', { detail: { lignes } }));
}

export function getCart() {
  return readRaw();
}

export function getCartCount() {
  return readRaw().reduce((total, l) => total + l.quantite, 0);
}

export function addToCart(produitId, quantite = 1) {
  const lignes = readRaw();
  const existante = lignes.find((l) => l.produit_id === produitId);
  if (existante) {
    existante.quantite += quantite;
  } else {
    lignes.push({ produit_id: produitId, quantite });
  }
  writeRaw(lignes);
}

export function setQuantite(produitId, quantite) {
  let lignes = readRaw();
  if (quantite <= 0) {
    lignes = lignes.filter((l) => l.produit_id !== produitId);
  } else {
    const ligne = lignes.find((l) => l.produit_id === produitId);
    if (ligne) ligne.quantite = quantite;
  }
  writeRaw(lignes);
}

export function removeFromCart(produitId) {
  const lignes = readRaw().filter((l) => l.produit_id !== produitId);
  writeRaw(lignes);
}

export function clearCart() {
  writeRaw([]);
}
