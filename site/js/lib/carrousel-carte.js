// carrousel-carte.js — média des cartes des grilles Vitrine et Boutique :
// la photo grandit légèrement au survol (CSS seul, voir components.css) et
// deux flèches permettent de parcourir les autres photos de la même pièce
// sans quitter la grille.
//
// Les flèches sont retirées du DOM quand il n'y a qu'une seule photo : une
// flèche qui ne fait rien est plus déroutante qu'une flèche absente.

// Une URL est injectée dans une propriété CSS : un guillemet dans le nom de
// fichier fermerait le url("...") et casserait la règle. Supabase n'en produit
// pas, mais la photo peut avoir été téléversée sous n'importe quel nom.
function urlCss(url) {
  return String(url).replace(/"/g, '%22');
}

/**
 * @param {Element} media   conteneur .card-media (déjà présent dans le template)
 * @param {string[]} photos URLs des photos de la pièce, la première fait la couverture
 */
export function monterCarrousel(media, photos) {
  const img = media.querySelector('.card-media-img');
  const fleches = Array.from(media.querySelectorAll('.card-media-nav'));
  const liste = (photos ?? []).filter(Boolean);

  // Aucune photo : on laisse le motif de remplissage en place.
  if (liste.length === 0) {
    for (const f of fleches) f.remove();
    return;
  }

  let index = 0;
  const afficher = () => {
    // La classe placeholder-img pose un dégradé en raccourci `background`,
    // qui écraserait la photo : on la retire dès qu'il y a une vraie image.
    img.classList.remove('placeholder-img');
    img.style.backgroundImage = `url("${urlCss(liste[index])}")`;
  };
  afficher();

  if (liste.length === 1) {
    for (const f of fleches) f.remove();
    return;
  }

  // Les photos suivantes sont chargées en tâche de fond pour que le premier
  // clic sur une flèche affiche l'image immédiatement, sans blanc.
  for (const url of liste.slice(1)) new Image().src = url;

  for (const fleche of fleches) {
    fleche.addEventListener('click', (e) => {
      // La flèche est posée au-dessus du lien vers la fiche : sans cela, un
      // clic sur la flèche quitterait la page.
      e.preventDefault();
      e.stopPropagation();
      index = (index + Number(fleche.dataset.dir) + liste.length) % liste.length;
      afficher();
    });
  }
}
