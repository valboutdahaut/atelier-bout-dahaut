// config.js — réglages publics du site.
//
// SUPABASE_ANON_KEY n'est PAS un secret : elle est conçue pour être visible
// côté client, la sécurité réelle vient des policies RLS (voir
// ../../supabase/policies.sql). Ne jamais mettre ici la clé "service_role".
//
// À REMPLIR par Tom une fois le projet Supabase créé (Project Settings > API).

export const SUPABASE_URL = 'https://VOTRE-PROJET.supabase.co';
export const SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON_PUBLIQUE';

// Nom du bucket Supabase Storage où sont déposées les photos (voir supabase/storage.sql)
export const PHOTOS_BUCKET = 'photos';
