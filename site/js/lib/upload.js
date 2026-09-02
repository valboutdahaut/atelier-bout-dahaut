// upload.js — dépose une photo dans Supabase Storage, retourne son URL publique.
// Utilisé par les formulaires admin (produit, post). Nécessite un client
// Supabase authentifié (voir supabase-client.js > getAuthenticatedClient).

import { PHOTOS_BUCKET } from '../config.js';

const TAILLE_MAX_OCTETS = 5 * 1024 * 1024; // 5 Mo, limite côté formulaire
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'];

export async function uploadPhoto(client, file, dossier) {
  if (!TYPES_ACCEPTES.includes(file.type)) {
    throw new Error('Format non supporté. Utilisez une image JPEG, PNG ou WebP.');
  }
  if (file.size > TAILLE_MAX_OCTETS) {
    throw new Error('Photo trop lourde (5 Mo maximum).');
  }

  const extension = file.name.split('.').pop();
  const nomFichier = `${dossier}/${crypto.randomUUID()}.${extension}`;

  const { error: erreurUpload } = await client.storage
    .from(PHOTOS_BUCKET)
    .upload(nomFichier, file, { cacheControl: '3600', upsert: false });

  if (erreurUpload) throw erreurUpload;

  const { data } = client.storage.from(PHOTOS_BUCKET).getPublicUrl(nomFichier);
  return data.publicUrl;
}
