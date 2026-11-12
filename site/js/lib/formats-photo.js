// formats-photo.js — proportions imposées aux photos du site.
//
// La valeur n'est pas écrite ici : elle est lue dans css/tokens.css
// (--format-photo-boutique, --format-photo-vitrine), là où les cadres du site
// prennent déjà la leur. Une seule source, donc aucun risque que l'outil de
// recadrage prépare une photo dans un format que les pages n'affichent pas.

// Repli si la feuille de style n'est pas chargée ou si la valeur est illisible :
// le carré, format en vigueur à la mise en place du recadrage.
const RATIO_DE_REPLI = 1;

/**
 * Convertit l'écriture CSS d'un format (« 4 / 3 », « 1 / 1 », « 1.5 ») en nombre.
 * Séparée de la lecture du CSS pour pouvoir être vérifiée sans navigateur.
 * @param {string} texte
 * @returns {number} largeur divisée par hauteur
 */
export function lireRatio(texte) {
  const [largeur, hauteur = '1'] = String(texte ?? '').split('/').map((morceau) => Number(morceau.trim()));
  const ratio = largeur / hauteur;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : RATIO_DE_REPLI;
}

/**
 * @param {'boutique' | 'vitrine'} zone
 * @returns {number} largeur divisée par hauteur (1 = carré)
 */
export function formatPhoto(zone) {
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(`--format-photo-${zone}`);
  return lireRatio(valeur);
}
