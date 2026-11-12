// vignette-photo.js — vignette d'une photo déjà envoyée, dans les formulaires
// d'administration, avec sa croix de suppression.
//
// Avant, la photo se retirait en cliquant n'importe où dessus, sans autre
// indice qu'une infobulle au survol : invisible sur mobile, et surtout une
// suppression au premier clic maladroit. La croix rend l'action explicite, et
// le reste de la vignette redevient libre pour d'autres usages.

/**
 * Adresse d'une photo prête à entrer dans une propriété CSS. Un guillemet dans
 * le nom du fichier fermerait le url("...") et casserait la règle.
 * @param {string} url
 */
export function imageDeFond(url) {
  return `url("${String(url).replace(/"/g, '%22')}")`;
}

/**
 * Bouton de suppression à poser sur une vignette.
 * @param {() => void} onSupprimer
 */
export function creerCroix(onSupprimer) {
  const btn = document.createElement('button');
  btn.type = 'button';               // sans cela, le bouton soumettrait le formulaire
  btn.className = 'photo-supprimer';
  btn.textContent = '×';
  btn.title = 'Retirer cette photo';
  btn.setAttribute('aria-label', 'Retirer cette photo');
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    // La zone de dépôt en dessous ouvre le sélecteur de fichier au clic :
    // sans cette ligne, retirer une photo rouvrirait aussitôt l'explorateur.
    e.stopPropagation();
    onSupprimer();
  });
  return btn;
}

/**
 * Bouton « Recadrer » à poser sur une vignette. En toutes lettres plutôt qu'en
 * pictogramme : l'action est nouvelle, et rien ne dit à première vue ce que
 * ferait un symbole de cadre posé sur une photo.
 * @param {() => void} onRecadrer
 */
export function creerBoutonRecadrer(onRecadrer) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'photo-recadrer';
  btn.textContent = 'Recadrer';
  btn.title = 'Choisir ce qui apparaît dans le cadre';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // même raison que pour la croix
    onRecadrer();
  });
  return btn;
}

/**
 * Vignette complète : la photo en fond, la croix par-dessus, et le bouton de
 * recadrage quand la vignette en propose un.
 *
 * Seule l'image est posée en ligne. Sa taille et sa position viennent de la
 * classe .photo-vignette : le formulaire de contact la veut plein cadre,
 * l'administration la veut entière, dans le cadre au format du site.
 * @param {string} url
 * @param {() => void} onSupprimer
 * @param {() => void} [onRecadrer] absent sur le formulaire de contact
 */
export function creerVignette(url, onSupprimer, onRecadrer) {
  const div = document.createElement('div');
  div.className = 'placeholder-img photo-vignette';
  div.style.backgroundImage = imageDeFond(url);
  div.appendChild(creerCroix(onSupprimer));
  if (onRecadrer) div.appendChild(creerBoutonRecadrer(onRecadrer));
  return div;
}
