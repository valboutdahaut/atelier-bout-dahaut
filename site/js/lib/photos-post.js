// photos-post.js — ordre d'affichage des photos d'une réalisation vitrine.
//
// Partagé par la galerie (vitrine-liste.js) et le bloc "À lire aussi" de la
// page d'une réalisation (vitrine-projet.js), pour que les deux grilles
// présentent les mêmes photos dans le même ordre.

/**
 * L'après d'abord, c'est lui qui donne envie ; l'avant ensuite, il raconte le
 * travail accompli ; puis les détails. Un post sans photo d'après démarre donc
 * sur l'avant plutôt que sur un cadre vide.
 *
 * @param {{photo_apres_url?: string, photo_avant_url?: string, photos_detail?: string[]}} post
 * @returns {string[]}
 */
export function photosDuPost(post) {
  return [post.photo_apres_url, post.photo_avant_url, ...(post.photos_detail ?? [])].filter(Boolean);
}
