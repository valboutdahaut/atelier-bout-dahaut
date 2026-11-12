// photo-cadree.js — le parcours « choisir, cadrer, envoyer » d'une photo, commun
// aux formulaires produit et post de l'administration.
//
// Chaque formulaire crée son poste d'envoi une fois, avec son dossier de
// stockage et son format, puis ne manipule plus que des adresses de photos.

import { uploadPhoto, verifierPhoto } from './upload.js';
import { ouvrirRecadrage } from './recadrage.js';
import { formatPhoto } from './formats-photo.js';

/**
 * @param {object} options
 * @param {import('@supabase/supabase-js').SupabaseClient} options.client client authentifié
 * @param {'produits' | 'posts'} options.dossier dossier du bucket où déposer les photos
 * @param {'boutique' | 'vitrine'} options.zone dont le format s'impose à la photo
 */
export function creerPosteDePhotos({ client, dossier, zone }) {
  const ratio = formatPhoto(zone);

  // La photo telle qu'elle a été choisie, gardée le temps que la page reste
  // ouverte. Reprendre un cadrage repart ainsi de la photo complète, et non de
  // la version déjà rognée : sans cela, on ne pourrait que resserrer, jamais
  // récupérer ce qu'un premier cadrage a laissé dehors.
  const originaux = new Map();

  function cadrerPuisEnvoyer(source, nom) {
    return ouvrirRecadrage({
      source,
      nom,
      ratio,
      envoyer: async (fichier) => {
        const url = await uploadPhoto(client, fichier, dossier);
        originaux.set(url, { source, nom });
        return url;
      },
    });
  }

  return {
    /**
     * Nouvelle photo, tout juste choisie sur l'appareil.
     * @param {File} fichier
     * @returns {Promise<string | null>} adresse de la photo en ligne, ou null si l'atelier annule
     */
    ajouter(fichier) {
      verifierPhoto(fichier);
      return cadrerPuisEnvoyer(fichier, fichier.name);
    },

    /**
     * Reprend le cadrage d'une photo déjà en ligne. Une nouvelle photo est
     * envoyée : l'adresse change, à l'appelant de remplacer l'ancienne.
     * @param {string} url
     * @returns {Promise<string | null>} nouvelle adresse, ou null si l'atelier annule
     */
    async recadrer(url) {
      let original = originaux.get(url);
      if (!original) {
        // Photo publiée lors d'une visite précédente : on la relit depuis le
        // site. Passer par fetch, et non par une balise image, donne un
        // fichier que le canvas a le droit d'exporter.
        let reponse;
        try {
          // Sans passer par le cache : la photo y est déjà, chargée pour la
          // vignette sans autorisation de lecture, et le navigateur pourrait
          // resservir cette copie-là, que le canvas refuserait d'exporter.
          reponse = await fetch(url, { cache: 'no-store' });
        } catch (err) {
          reponse = null;
          console.error('photo-cadree.js : lecture de la photo', err);
        }
        if (!reponse?.ok) throw new Error("Cette photo n'a pas pu être récupérée. Vérifiez votre connexion, puis réessayez.");
        const nom = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'photo');
        original = { source: await reponse.blob(), nom };
      }
      return cadrerPuisEnvoyer(original.source, original.nom);
    },
  };
}
