// photos-post.js — ordre d'affichage des photos d'une réalisation vitrine.
//
// Partagé par la galerie (vitrine-liste.js) et le bloc "À lire aussi" de la
// page d'une réalisation (vitrine-projet.js), pour que les deux grilles
// présentent les mêmes photos dans le même ordre.

/**
 * L'après d'abord, c'est lui qui donne envie ; l'avant ensuite, il raconte le
 * travail accompli ; puis les détails. En mode diptyque, un post sans photo
 * d'après démarre donc sur l'avant plutôt que sur un cadre vide.
 *
 * Une réalisation présentée sans avant / après n'a, par définition, pas d'avant
 * à donner au carrousel. La photo reste en base pour que recocher la case la
 * restaure, mais elle ne ressort nulle part tant que la case est décochée.
 *
 * À ne pas confondre avec le roulement de la page d'accueil
 * (lib/roulement-photos.js), qui ne retient qu'une seule photo par pièce, la
 * principale, et ne montre donc jamais d'avant ni de détail.
 *
 * @param {{photo_apres_url?: string, photo_avant_url?: string, photos_detail?: string[], avant_apres_actif?: boolean}} post
 * @returns {string[]}
 */
export function photosDuPost(post) {
  // Colonne absente tant que la migration du 09/10 n'est pas jouée : on
  // retombe alors sur le diptyque, l'affichage d'avant.
  const avant = (post.avant_apres_actif ?? true) ? post.photo_avant_url : null;
  return [post.photo_apres_url, avant, ...(post.photos_detail ?? [])].filter(Boolean);
}
