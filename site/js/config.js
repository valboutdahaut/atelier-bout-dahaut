// config.js — réglages publics du site.
//
// SUPABASE_ANON_KEY n'est PAS un secret : elle est conçue pour être visible
// côté client, la sécurité réelle vient des policies RLS (voir
// ../../supabase/policies.sql). Vérifié en conditions réelles : avec cette
// clé, la lecture du contenu publié est autorisée, mais toute écriture et
// tout accès aux commandes ou messages clients sont refusés par la base.
//
// Ne jamais mettre ici la clé "service_role" / "Secret key", qui elle
// contourne toutes ces protections.

// Projet hébergé à Paris (eu-west-3). Le projet d'origine était à Londres
// (eu-west-2) : la base a été déplacée le 19/09/2026 pour que les données
// personnelles des clients restent dans l'Union européenne. La région d'un
// projet Supabase ne se change pas, il a fallu en créer un nouveau.
export const SUPABASE_URL = 'https://bsjwyystdxhltqwdbznt.supabase.co';

// Supabase nomme désormais cette clé "Publishable key" (anciennement "anon").
export const SUPABASE_ANON_KEY = 'sb_publishable_mCPVmNrtQDnC42QL8vaaXA_0yEVG4qr';

// Nom du bucket Supabase Storage où sont déposées les photos (voir supabase/storage.sql)
export const PHOTOS_BUCKET = 'photos';
