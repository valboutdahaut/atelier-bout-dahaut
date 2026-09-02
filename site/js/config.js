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

export const SUPABASE_URL = 'https://ftdkiujpuulfulfugbmv.supabase.co';

// Supabase nomme désormais cette clé "Publishable key" (anciennement "anon").
export const SUPABASE_ANON_KEY = 'sb_publishable_eIy99TifzXCjwdH5oIPbOw_tUf5rhj1';

// Nom du bucket Supabase Storage où sont déposées les photos (voir supabase/storage.sql)
export const PHOTOS_BUCKET = 'photos';
