// cadrage.js — la géométrie du recadrage, sans aucun élément de page.
//
// L'outil de recadrage (recadrage.js) dessine l'aperçu et produit le fichier
// final avec les mêmes fonctions : ce qui est montré à l'écran est, au pixel
// près, ce qui est envoyé. Les calculs sont isolés ici pour pouvoir être
// vérifiés seuls, sans ouvrir de navigateur.
//
// Un cadrage tient en trois nombres :
//   zoom   1 = la photo remplit le cadre au plus juste, sans marge ni excès.
//          Au-dessus, on resserre. En dessous, la photo ne remplit plus le
//          cadre et des marges apparaissent, jusqu'à la photo entière.
//   cx, cy le point de la photo placé au centre du cadre, en fraction de sa
//          largeur et de sa hauteur (0,5 ; 0,5 = le milieu de la photo).
//
// Exprimé ainsi, un cadrage ne dépend pas de la taille du cadre : il reste
// valable si la fenêtre change de taille, et sert tel quel pour l'aperçu comme
// pour le fichier final.

// Au-delà, on agrandit des pixels qui n'existent pas : la photo publiée
// serait floue.
export const ZOOM_MAX = 4;

/** Échelle (pixels de cadre par pixel de photo) à laquelle la photo remplit le cadre. */
function echelleRemplissage(photo, cadre) {
  return Math.max(cadre.largeur / photo.largeur, cadre.hauteur / photo.hauteur);
}

/**
 * Zoom auquel la photo tient en entier dans le cadre. Vaut 1 quand la photo a
 * déjà les proportions du cadre : il n'y a alors rien à dézoomer.
 * @param {{largeur: number, hauteur: number}} photo
 * @param {number} ratio largeur / hauteur du cadre
 */
export function zoomPhotoEntiere(photo, ratio) {
  const ratioPhoto = photo.largeur / photo.hauteur;
  return Math.min(ratioPhoto / ratio, ratio / ratioPhoto);
}

/** Cadrage de départ : la photo remplit le cadre, centrée. */
export function cadrageInitial() {
  return { zoom: 1, cx: 0.5, cy: 0.5 };
}

/**
 * Position sur un axe. Quand la photo dépasse le cadre, elle ne peut pas s'en
 * décoller : aucun vide ne doit apparaître d'un côté alors qu'il reste de la
 * photo de l'autre. Quand elle est plus petite que le cadre, elle est centrée
 * d'office : des marges inégales n'auraient l'air que d'une erreur.
 */
function placerSurAxe(centre, taillePhoto, tailleCadre) {
  if (taillePhoto <= tailleCadre) return (tailleCadre - taillePhoto) / 2;
  const position = tailleCadre / 2 - centre * taillePhoto;
  return Math.min(0, Math.max(tailleCadre - taillePhoto, position));
}

/**
 * Rectangle où dessiner la photo, dans le repère du cadre (origine en haut à
 * gauche). Les coordonnées peuvent être négatives : la photo dépasse alors du
 * cadre, qui masque ce qui déborde.
 * @param {{zoom: number, cx: number, cy: number}} cadrage
 * @param {{largeur: number, hauteur: number}} photo
 * @param {{largeur: number, hauteur: number}} cadre
 */
export function placement(cadrage, photo, cadre) {
  const echelle = cadrage.zoom * echelleRemplissage(photo, cadre);
  const largeur = photo.largeur * echelle;
  const hauteur = photo.hauteur * echelle;
  return {
    x: placerSurAxe(cadrage.cx, largeur, cadre.largeur),
    y: placerSurAxe(cadrage.cy, hauteur, cadre.hauteur),
    largeur,
    hauteur,
  };
}

/**
 * Ramène un cadrage dans les limites permises : zoom borné, photo jamais
 * décollée du cadre. Le centre renvoyé est celui réellement obtenu, pour qu'un
 * glissement au-delà du bord ne s'accumule pas en silence et n'oblige pas à
 * « revenir » d'autant avant que la photo ne bouge de nouveau.
 * @param {{zoom: number, cx: number, cy: number}} cadrage
 * @param {{largeur: number, hauteur: number}} photo
 * @param {number} ratio largeur / hauteur du cadre
 */
export function contraindre(cadrage, photo, ratio) {
  const zoom = Math.min(ZOOM_MAX, Math.max(zoomPhotoEntiere(photo, ratio), cadrage.zoom));
  // Cadre de hauteur 1 : seules les proportions comptent ici.
  const cadre = { largeur: ratio, hauteur: 1 };
  const p = placement({ ...cadrage, zoom }, photo, cadre);
  return {
    zoom,
    cx: (cadre.largeur / 2 - p.x) / p.largeur,
    cy: (cadre.hauteur / 2 - p.y) / p.hauteur,
  };
}

/**
 * Déplace la photo d'une distance donnée en pixels d'écran.
 * @param {{zoom: number, cx: number, cy: number}} cadrage
 * @param {{largeur: number, hauteur: number}} photo
 * @param {{largeur: number, hauteur: number}} cadre le cadre tel qu'affiché
 * @param {number} dx vers la droite
 * @param {number} dy vers le bas
 */
export function deplacer(cadrage, photo, cadre, dx, dy) {
  const p = placement(cadrage, photo, cadre);
  const ratio = cadre.largeur / cadre.hauteur;
  // Tirer la photo vers la droite amène au centre un point situé plus à gauche.
  return contraindre({ ...cadrage, cx: cadrage.cx - dx / p.largeur, cy: cadrage.cy - dy / p.hauteur }, photo, ratio);
}

/**
 * Dimensions du fichier à produire. On ne garde que les pixels utiles : la
 * partie de la photo visible dans le cadre, plafonnée au grand côté retenu
 * pour tout le site (voir redimensionner-image.js). Jamais d'agrandissement.
 * @param {{zoom: number}} cadrage
 * @param {{largeur: number, hauteur: number}} photo
 * @param {number} ratio largeur / hauteur du cadre
 * @param {number} coteMax grand côté maximal, en pixels
 */
export function tailleSortie(cadrage, photo, ratio, coteMax) {
  const cadre = { largeur: ratio, hauteur: 1 };
  const echelle = cadrage.zoom * echelleRemplissage(photo, cadre);
  // Ce que le cadre couvre, compté en pixels de la photo d'origine.
  const largeurVue = cadre.largeur / echelle;
  const hauteurVue = cadre.hauteur / echelle;
  const reduction = Math.min(1, coteMax / Math.max(largeurVue, hauteurVue));
  // La hauteur se déduit de la largeur arrondie, et non l'inverse : arrondir
  // les deux séparément ferait parfois sortir le fichier du format d'un pixel.
  const largeur = Math.max(1, Math.round(largeurVue * reduction));
  return { largeur, hauteur: Math.max(1, Math.round(largeur / ratio)) };
}
