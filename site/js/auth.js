// auth.js — garde d'accès de l'espace d'administration.
//
// Authentification par lien magique (Supabase Auth) : Valérie saisit son
// adresse email, reçoit un lien, clique dessus, elle est connectée. Aucun mot
// de passe à retenir.
//
// Deux usages, pilotés par un attribut sur <body> :
//  - <body data-admin-guard="true">  : page protégée. Redirige vers la page de
//    connexion si personne n'est connecté, sinon affiche l'email dans la
//    barre latérale et branche le lien "Se déconnecter".
//  - <body data-admin-login="true">  : page de connexion.

import { supabase } from './supabase-client.js';

const LOGIN_PAGE = '/admin/login.html';
const DASHBOARD_PAGE = '/admin/index.html';

// Au retour d'un lien magique, le jeton arrive dans l'adresse de la page et le
// SDK doit d'abord le traiter. getSession() attend normalement ce traitement,
// mais on prévoit un filet : si l'adresse contient un jeton et qu'aucune
// session n'est encore établie, on attend le premier évènement de connexion.
async function recupererSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;

  const jetonDansUrl = window.location.hash.includes('access_token');
  if (!jetonDansUrl) return null;

  return new Promise((resolve) => {
    const minuteur = setTimeout(() => resolve(null), 5000);
    supabase.auth.onAuthStateChange((_evenement, sessionRecue) => {
      if (sessionRecue) {
        clearTimeout(minuteur);
        resolve(sessionRecue);
      }
    });
  });
}

async function protegerPage() {
  const session = await recupererSession();

  if (!session) {
    window.location.replace(LOGIN_PAGE);
    return;
  }

  const afficherCompte = () => {
    const emailEl = document.getElementById('admin-user-email');
    if (emailEl) emailEl.textContent = session.user.email;

    const lienDeconnexion = document.getElementById('admin-logout');
    if (lienDeconnexion) {
      lienDeconnexion.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.replace(LOGIN_PAGE);
      });
    }
  };

  // La barre latérale est injectée par include.js. Ce module dépendant de la
  // bibliothèque Supabase (chargée depuis un CDN), il peut arriver après
  // l'injection : on teste l'indicateur plutôt que de s'abonner à un
  // évènement potentiellement déjà passé.
  if (window.__includesReady) {
    afficherCompte();
  } else {
    document.addEventListener('includes:ready', afficherCompte);
  }
}

async function preparerPageConnexion() {
  const session = await recupererSession();
  if (session) {
    window.location.replace(DASHBOARD_PAGE);
    return;
  }

  const formulaire = document.getElementById('login-form');
  const champEmail = document.getElementById('login-email');
  const bouton = document.getElementById('login-btn');
  const message = document.getElementById('login-message');
  if (!formulaire) return;

  const afficherMessage = (texte, type) => {
    if (!message) return;
    message.textContent = texte;
    message.className = `status-msg ${type}`;
    message.hidden = false;
  };

  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = champEmail.value.trim();
    if (!email) return;

    bouton.disabled = true;
    bouton.textContent = 'Envoi en cours...';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${DASHBOARD_PAGE}` },
    });

    bouton.disabled = false;
    bouton.textContent = 'Recevoir le lien de connexion';

    if (error) {
      afficherMessage(`Envoi impossible : ${error.message}`, 'error');
      return;
    }

    afficherMessage(
      `Un lien de connexion vient d'être envoyé à ${email}. Ouvrez votre boîte mail et cliquez dessus pour accéder à l'administration.`,
      'success'
    );
    formulaire.reset();
  });
}

if (document.body.dataset.adminGuard === 'true') protegerPage();
if (document.body.dataset.adminLogin === 'true') preparerPageConnexion();
