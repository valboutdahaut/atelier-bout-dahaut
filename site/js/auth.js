// auth.js — garde d'accès admin via Netlify Identity.
//
// Nécessite <script src="https://identity.netlify.com/v1/netlify-identity-widget.js">
// dans le <head> de la page (voir admin/login.html et les pages admin/*.html).
//
// Deux usages :
//  - Sur les pages protégées : <body data-admin-guard="true"> redirige vers
//    login.html si personne n'est connecté, sinon affiche l'email dans la
//    sidebar et branche le lien "Se déconnecter".
//  - Sur admin/login.html : <body data-admin-login="true"> ouvre le widget de
//    connexion et redirige vers le dashboard une fois connecté.

const LOGIN_PAGE = '/admin/login.html';
const DASHBOARD_PAGE = '/admin/index.html';

function waitForIdentity() {
  return new Promise((resolve) => {
    if (window.netlifyIdentity) return resolve(window.netlifyIdentity);
    document.addEventListener('DOMContentLoaded', () => resolve(window.netlifyIdentity), { once: true });
  });
}

async function guardAdminPage() {
  const identity = await waitForIdentity();
  if (!identity) {
    console.error("Netlify Identity ne s'est pas chargé (widget bloqué ou script manquant).");
    return;
  }
  identity.init();

  const user = identity.currentUser();
  if (!user) {
    window.location.replace(LOGIN_PAGE);
    return;
  }

  document.addEventListener('includes:ready', () => {
    const emailEl = document.getElementById('admin-user-email');
    if (emailEl) emailEl.textContent = user.email;
    const logoutLink = document.getElementById('admin-logout');
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        identity.logout();
      });
    }
  });

  identity.on('logout', () => window.location.replace(LOGIN_PAGE));
}

async function wireLoginPage() {
  const identity = await waitForIdentity();
  if (!identity) return;
  identity.init();

  if (identity.currentUser()) {
    window.location.replace(DASHBOARD_PAGE);
    return;
  }

  identity.on('login', () => window.location.replace(DASHBOARD_PAGE));

  const btn = document.getElementById('login-btn');
  if (btn) btn.addEventListener('click', () => identity.open('login'));
}

if (document.body.dataset.adminGuard === 'true') {
  guardAdminPage();
}
if (document.body.dataset.adminLogin === 'true') {
  wireLoginPage();
}
