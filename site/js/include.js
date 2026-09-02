// include.js — injecte header/footer/sidebar sans framework.
//
// Usage dans une page : <div data-include="header-public"></div>
// Nécessite de servir le site via un serveur HTTP local (ex: `npx serve site`),
// pas en ouvrant les fichiers en file:// (fetch() est bloqué sur ce protocole).
//
// Une fois injecté, déclenche un évènement "includes:ready" sur `document`
// pour que les scripts de page (nav.js, cart.js, auth.js) puissent agir sur
// le contenu injecté (marquer le lien actif, afficher l'email admin, etc.)

(function () {
  async function injectAll() {
    const targets = document.querySelectorAll('[data-include]');
    await Promise.all(
      Array.from(targets).map(async (el) => {
        const name = el.getAttribute('data-include');
        try {
          const res = await fetch(`/partials/${name}.html`);
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          el.outerHTML = await res.text();
        } catch (err) {
          console.error(`include.js : impossible de charger le partial "${name}"`, err);
          el.innerHTML = `<div class="status-msg error">Erreur de chargement (${name})</div>`;
        }
      })
    );
    // Indicateur global en plus de l'évènement : un module qui finit de se
    // charger APRÈS l'injection (typiquement nav.js, qui doit d'abord
    // télécharger la bibliothèque Supabase depuis un CDN) manquerait sinon
    // l'évènement et ne s'exécuterait jamais.
    window.__includesReady = true;
    document.dispatchEvent(new CustomEvent('includes:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAll);
  } else {
    injectAll();
  }
})();
