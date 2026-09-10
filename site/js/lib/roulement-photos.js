// roulement-photos.js — fait défiler les photos du site dans les zones images
// de la page d'accueil.
//
// Règles retenues avec Tom :
//   1. Côté boutique, seules les pièces réellement achetables alimentent le
//      roulement : publiées ET encore en stock. Montrer en grand une pièce
//      déjà vendue serait une promesse que le site ne peut pas tenir.
//   2. Une seule photo par pièce, toujours la principale : la vignette pour un
//      produit, la photo "après" pour une réalisation. Les photos secondaires
//      (détails, "avant") restent réservées aux fiches.
//   3. Toutes les zones changent ensemble, toutes les 10 secondes.
//
// Les zones démarrent à des positions différentes dans la liste pour éviter
// d'afficher deux fois la même photo au même moment.

const INTERVALLE_MS = 10000;

function urlCss(url) {
  return String(url).replace(/"/g, '%22');
}

/**
 * Photos principales des pièces visibles sur le site public.
 * @returns {Promise<Array<{url: string, slug: string}>>} slug = catégorie ou savoir-faire
 */
export async function chargerPhotosPrincipales(supabase) {
  const [produits, posts] = await Promise.all([
    supabase
      .from('produits')
      .select('photos, categories(slug)')
      .eq('statut', 'publie')
      .gt('stock', 0),
    supabase
      .from('posts_vitrine')
      .select('photo_apres_url, categories(slug)')
      .eq('statut', 'publie'),
  ]);

  if (produits.error) console.error('roulement-photos.js : produits', produits.error);
  if (posts.error) console.error('roulement-photos.js : posts vitrine', posts.error);

  const liste = [
    ...(produits.data ?? []).map((p) => ({ url: p.photos?.[0], slug: p.categories?.slug })),
    ...(posts.data ?? []).map((p) => ({ url: p.photo_apres_url, slug: p.categories?.slug })),
  ].filter((p) => p.url);

  // Ordre mélangé : sans cela, le haut de la page d'accueil montrerait toujours
  // les mêmes pièces dans le même ordre à chaque visite.
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

/**
 * Prépare une zone : y insère le calque qui portera les photos.
 * Le calque est superposé au motif de remplissage, qui réapparaît donc tout
 * seul si la zone n'a aucune photo à montrer.
 */
function preparerZone(el) {
  el.classList.add('roulement-zone');
  const calque = document.createElement('span');
  calque.className = 'roulement-img';
  el.appendChild(calque);
  return calque;
}

/**
 * Démarre le roulement sur les zones portant l'attribut data-roulement.
 * La valeur de l'attribut, si elle est renseignée, limite la zone à certaines
 * catégories (slugs séparés par des espaces) pour rester cohérente avec sa
 * légende : la vignette "Tapisserie" ne doit pas montrer un abat-jour.
 */
export function demarrerRoulement(photos) {
  if (photos.length === 0) return;

  const zones = Array.from(document.querySelectorAll('[data-roulement]')).map((el, i) => {
    const filtre = (el.dataset.roulement ?? '').trim().split(/\s+/).filter(Boolean);
    // Une zone dont la catégorie n'a encore aucune photo retombe sur la liste
    // complète : mieux vaut une photo un peu à côté qu'un cadre vide.
    const propres = filtre.length > 0 ? photos.filter((p) => filtre.includes(p.slug)) : [];
    const liste = propres.length > 0 ? propres : photos;

    return {
      calque: preparerZone(el),
      texteVide: el.querySelector('span:not(.roulement-img)'),
      liste,
      // Décalage régulier dans la liste pour que deux zones ne montrent pas la
      // même photo au même instant tant qu'il y en a assez.
      index: Math.floor((i * liste.length) / 5) % liste.length,
    };
  });

  const afficher = (zone) => {
    const photo = zone.liste[zone.index];
    zone.calque.style.backgroundImage = `url("${urlCss(photo.url)}")`;
    zone.calque.classList.add('visible');
    // Le texte descriptif du gabarit ("photo — fauteuil crapaud restauré")
    // n'a plus lieu d'être une fois une vraie photo affichée.
    zone.texteVide?.remove();
    zone.texteVide = null;
  };

  for (const zone of zones) afficher(zone);

  // Un seul minuteur pour toutes les zones : elles changent ensemble, et le
  // navigateur n'a qu'un rendez-vous à honorer au lieu de cinq.
  setInterval(() => {
    for (const zone of zones) {
      if (zone.liste.length < 2) continue;
      zone.index = (zone.index + 1) % zone.liste.length;

      // Disparition, changement d'image hors écran, réapparition : le fondu
      // est porté par la transition CSS de .roulement-img.
      zone.calque.classList.remove('visible');
      setTimeout(() => afficher(zone), 700);

      // La photo d'après est chargée pendant que celle-ci est encore à l'écran,
      // pour que la suivante apparaisse sans temps mort.
      const suivante = zone.liste[(zone.index + 1) % zone.liste.length];
      new Image().src = suivante.url;
    }
  }, INTERVALLE_MS);
}
