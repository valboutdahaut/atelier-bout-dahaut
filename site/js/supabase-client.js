// supabase-client.js — accès Supabase, sans étape de build.
//
// On charge le SDK Supabase JS depuis un CDN en ESM (esm.sh). Pas de npm/bundler
// puisque la stack choisie est HTML/CSS/JS simple.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Client "public" : lecture du contenu publié, insertion de messages de
// contact, appel de la fonction RPC creer_commande. Couvert par les policies
// RLS "lecture publique du publié" — voir supabase/policies.sql.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Client "admin" : à utiliser uniquement sur les pages /admin/*, une fois
// Valérie connectée via Netlify Identity. On reconstruit le header
// Authorization à chaque appel (pas un client mis en cache une fois pour
// toutes) car le jeton Netlify Identity expire et doit être rafraîchi.
export function getAuthenticatedClient() {
  const user = window.netlifyIdentity && window.netlifyIdentity.currentUser();
  if (!user) {
    throw new Error('Aucun utilisateur admin connecté (getAuthenticatedClient appelé hors session).');
  }
  const jwt = user.jwt(); // rafraîchit le token si besoin, retourne une Promise
  return jwt.then((token) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
  );
}
