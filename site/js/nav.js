// nav.js — comportement du header public une fois injecté : lien actif,
// menu mobile, badge panier. S'exécute après l'évènement "includes:ready".

import { getCartCount } from './cart.js';
import { appliquerContenuSite } from './site-content.js';

function markActiveLink() {
  const section = document.body.dataset.navSection; // ex: data-nav-section="boutique" sur <body>
  if (!section) return;
  const link = document.querySelector(`.site-nav a[data-nav="${section}"]`);
  if (link) link.classList.add('active');
}

function wireMobileToggle() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

function updateCartBadge() {
  const el = document.getElementById('cart-count');
  if (el) el.textContent = String(getCartCount());
}

document.addEventListener('includes:ready', () => {
  markActiveLink();
  wireMobileToggle();
  updateCartBadge();
  appliquerContenuSite();
});

// Le panier peut changer sans rechargement de page (ajout depuis produit.html) :
// on écoute un évènement custom "cart:changed" émis par cart.js.
document.addEventListener('cart:changed', updateCartBadge);
