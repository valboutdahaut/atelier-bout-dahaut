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
//   4. Deux zones ne montrent jamais la même photo au même moment, tant qu'il y
//      a assez de photos publiées pour cela.
//   5. Les trois vignettes du bas ne montrent que des pièces de leur catégorie.
//      Si la catégorie est vide, la vignette n'affiche rien plutôt qu'une pièce
//      d'un autre savoir-faire.

const INTERVALLE_MS = 10000;
const FONDU_MS = 700;

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
 * Prépare une zone : y insère les deux calques qui porteront les photos.
 * Deux et non un : la photo qui arrive apparaît par-dessus la précédente, qui
 * reste opaque pendant tout le fondu. Avec un seul calque, la zone redevenait
 * transparente entre deux photos et laissait voir le motif rayé du gabarit.
 * Les calques sont superposés à ce motif, qui réapparaît donc tout seul si la
 * zone n'a aucune photo à montrer.
 */
function preparerZone(el) {
  el.classList.add('roulement-zone');
  const calques = [document.createElement('span'), document.createElement('span')];
  for (const calque of calques) {
    calque.className = 'roulement-img';
    el.appendChild(calque);
  }
  return calques;
}

/**
 * Charge la photo hors écran et attend qu'elle soit prête.
 * Renvoie false si elle n'arrive pas : mieux vaut garder la photo précédente
 * à l'écran que faire apparaître un calque vide.
 */
function precharger(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Écarte les zones qui viseraient la même photo au même instant.
 * Deux zones peuvent y arriver sans partager la même liste : une photo de
 * tapisserie est à la fois dans la liste complète du haut de page et dans celle
 * de la vignette "Tapisserie".
 *
 * Les zones les plus contraintes se servent en premier : une vignette limitée à
 * une catégorie qui ne compte qu'une photo n'a aucune marge de manœuvre, alors
 * que les grandes images du haut piochent dans tout le site et peuvent se
 * décaler. À égalité, l'ordre de la page départage, donc les deux grandes zones
 * gardent leur priorité l'une par rapport à l'autre.
 *
 * S'il y a moins de photos publiées que de zones, des répétitions subsistent :
 * c'est arithmétique, pas un défaut.
 */
function eviterDoublons(zones) {
  const prises = new Set();
  const ordre = [...zones].sort((a, b) => a.liste.length - b.liste.length);
  for (const zone of ordre) {
    for (let pas = 0; pas < zone.liste.length; pas++) {
      const candidat = (zone.index + pas) % zone.liste.length;
      if (!prises.has(zone.liste[candidat].url)) {
        zone.index = candidat;
        break;
      }
    }
    prises.add(zone.liste[zone.index].url);
  }
}

/** Fait apparaître la photo courante de la zone, en fondu par-dessus l'actuelle. */
async function montrer(zone) {
  const photo = zone.liste[zone.index];
  if (photo.url === zone.urlAffichee) return; // zone à une seule photo
  if (zone.enCours) return; // photo précédente pas encore arrivée
  zone.enCours = true;

  const pret = await precharger(photo.url);
  zone.enCours = false;
  if (!pret) return;

  const entrant = zone.calques[1 - zone.actif];
  const sortant = zone.calques[zone.actif];

  entrant.style.backgroundImage = `url("${urlCss(photo.url)}")`;
  entrant.classList.add('dessus'); // le calque qui arrive passe au-dessus
  sortant.classList.remove('dessus');
  void entrant.offsetWidth; // fige l'état de départ, sinon le fondu est sauté
  entrant.classList.add('visible');
  zone.actif = 1 - zone.actif;
  zone.urlAffichee = photo.url;

  // Le calque sortant ne s'efface qu'une fois entièrement recouvert, donc sans
  // jamais laisser voir le fond rayé. Le garde-fou sert au cas où une photo
  // mettrait plus longtemps à arriver que l'intervalle entre deux tours : sans
  // lui, cette minuterie effacerait un calque entre-temps remis à l'écran.
  clearTimeout(zone.minuterie);
  zone.minuterie = setTimeout(() => {
    if (sortant !== zone.calques[zone.actif]) sortant.classList.remove('visible');
  }, FONDU_MS);

  // Le texte descriptif du gabarit ("photo — fauteuil crapaud restauré")
  // n'a plus lieu d'être une fois une vraie photo affichée.
  zone.texteVide?.remove();
  zone.texteVide = null;

  // Le motif rayé non plus. On attend la fin du premier fondu pour ne pas faire
  // clignoter la zone pendant qu'elle est encore à moitié transparente.
  if (zone.premiere) {
    zone.premiere = false;
    setTimeout(() => zone.el.classList.add('roulement-actif'), FONDU_MS);
  }

  // La photo d'après est chargée pendant que celle-ci est encore à l'écran,
  // pour que la suivante apparaisse sans temps mort.
  const suivante = zone.liste[(zone.index + 1) % zone.liste.length];
  if (suivante.url !== photo.url) new Image().src = suivante.url;
}

/**
 * Démarre le roulement sur les zones portant l'attribut data-roulement.
 * La valeur de l'attribut, si elle est renseignée, limite la zone à certaines
 * catégories (slugs séparés par des espaces) pour rester cohérente avec sa
 * légende : la vignette "Tapisserie" ne doit pas montrer un abat-jour.
 */
export function demarrerRoulement(photos) {
  if (photos.length === 0) return;

  const zones = [];
  for (const el of document.querySelectorAll('[data-roulement]')) {
    const filtre = (el.dataset.roulement ?? '').trim().split(/\s+/).filter(Boolean);
    const liste = filtre.length > 0 ? photos.filter((p) => filtre.includes(p.slug)) : photos;

    // Une vignette de savoir-faire ne montre que des pièces de sa catégorie, et
    // rien du tout si cette catégorie est encore vide. Elle garde alors son
    // gabarit d'origine : un abat-jour sous la légende "Tapisserie" tromperait
    // le visiteur, un cadre neutre non.
    if (liste.length === 0) continue;

    zones.push({
      el,
      calques: preparerZone(el),
      actif: 0,
      texteVide: el.querySelector('span:not(.roulement-img)'),
      liste,
      index: 0,
      urlAffichee: null,
      enCours: false,
      premiere: true,
    });
  }
  if (zones.length === 0) return;

  // Départ décalé d'un cran : deux zones qui puisent dans la même liste ne
  // commencent jamais sur la même photo, et comme elles avancent toutes d'un
  // cran en même temps, l'écart se conserve. Le calcul précédent répartissait
  // les départs sur toute la longueur de la liste, ce qui donnait zéro pour
  // les deux premières zones dès que le site comptait moins de cinq photos.
  const departs = new Map();
  for (const zone of zones) {
    const rang = departs.get(zone.liste) ?? 0;
    zone.index = rang % zone.liste.length;
    departs.set(zone.liste, rang + 1);
  }

  eviterDoublons(zones);
  for (const zone of zones) montrer(zone);

  // Un seul minuteur pour toutes les zones : elles changent ensemble, et le
  // navigateur n'a qu'un rendez-vous à honorer au lieu de cinq.
  setInterval(() => {
    for (const zone of zones) {
      if (zone.liste.length < 2) continue;
      zone.index = (zone.index + 1) % zone.liste.length;
    }
    eviterDoublons(zones);
    for (const zone of zones) montrer(zone);
  }, INTERVALLE_MS);
}
