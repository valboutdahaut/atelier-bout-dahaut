// vignette-photo.js — vignette d'une photo déjà envoyée, dans les formulaires
// d'administration, avec sa croix de suppression.
//
// Avant, la photo se retirait en cliquant n'importe où dessus, sans autre
// indice qu'une infobulle au survol : invisible sur mobile, et surtout une
// suppression au premier clic maladroit. La croix rend l'action explicite, et
// le reste de la vignette redevient libre pour d'autres usages.

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
 * Vignette complète : la photo en fond, la croix par-dessus.
 * @param {string} url
 * @param {() => void} onSupprimer
 */
export function creerVignette(url, onSupprimer) {
  const div = document.createElement('div');
  div.className = 'placeholder-img photo-vignette';
  div.style.background = `center/cover no-repeat url("${String(url).replace(/"/g, '%22')}")`;
  div.appendChild(creerCroix(onSupprimer));
  return div;
}
