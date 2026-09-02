// supabase-client.js — accès Supabase, sans étape de build.
//
// On charge le SDK Supabase JS depuis un CDN en ESM (esm.sh). Pas de npm/bundler
// puisque la stack choisie est HTML/CSS/JS simple.
//
// L'authentification de l'admin passe par Supabase Auth (lien magique envoyé
// par email). Le SDK gère lui-même la session : une fois Valérie connectée,
// le même client `supabase` envoie automatiquement son jeton à chaque requête,
// et les policies RLS (voir supabase/policies.sql) la reconnaissent via
// auth.jwt() ->> 'email'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,      // garde la session entre deux visites
    autoRefreshToken: true,    // renouvelle le jeton avant expiration
    detectSessionInUrl: true,  // indispensable au retour du lien magique
  },
});

// Utilisé par toutes les pages d'administration avant d'écrire en base.
// Renvoie le client seulement si une session est active ; sinon lève une
// erreur, ce qui évite d'envoyer des requêtes vouées à être refusées.
export async function getAuthenticatedClient() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Aucune session administrateur active. Reconnectez-vous.');
  }
  return supabase;
}
