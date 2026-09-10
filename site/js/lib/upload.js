// upload.js — dépose une photo dans Supabase Storage, retourne son URL publique.
// Utilisé par les formulaires admin (produit, post). Nécessite un client
// Supabase authentifié (voir supabase-client.js > getAuthenticatedClient).

import { PHOTOS_BUCKET } from '../config.js';
import { redimensionner } from './redimensionner-image.js';

// La photo étant allégée juste après, la limite ne sert plus qu'à écarter les
// fichiers manifestement hors sujet (une vidéo, un scan géant). Elle est donc
// généreuse : un téléphone récent produit couramment 5 à 8 Mo par photo, et
// refuser ces fichiers-là bloquerait l'usage normal.
const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'];

export async function uploadPhoto(client, file, dossier) {
  if (!TYPES_ACCEPTES.includes(file.type)) {
    throw new Error('Format non supporté. Utilisez une image JPEG, PNG ou WebP.');
  }
  if (file.size > TAILLE_MAX_OCTETS) {
    throw new Error('Photo trop lourde (20 Mo maximum).');
  }

  // Allègement avant l'envoi : une photo de téléphone passe typiquement de
  // 3 Mo à 300 Ko, sans différence visible dans les zones du site.
  const photo = await redimensionner(file);

  const extension = photo.name.split('.').pop();
  const nomFichier = `${dossier}/${crypto.randomUUID()}.${extension}`;

  const { error: erreurUpload } = await client.storage
    .from(PHOTOS_BUCKET)
    .upload(nomFichier, photo, { cacheControl: '3600', upsert: false });

  if (erreurUpload) throw erreurUpload;

  const { data } = client.storage.from(PHOTOS_BUCKET).getPublicUrl(nomFichier);
  return data.publicUrl;
}
