// recadrage.js — fenêtre de recadrage des photos, dans l'administration.
//
// L'atelier choisit ce qui entre dans le cadre du site : la photo se déplace à
// la souris ou au doigt, et se resserre ou s'élargit avec le curseur. Le cadre
// a les proportions imposées par le site (voir formats-photo.js), ce qui est
// montré ici est donc exactement ce que le visiteur verra.
//
// Le recadrage est appliqué à la photo elle-même, avant l'envoi : le fichier
// déposé sur Supabase est déjà au bon format. Aucun réglage de cadrage n'est
// stocké en base, et toutes les pages du site affichent le résultat sans avoir
// à connaître cet outil.
//
// Aucune bibliothèque : le site n'a ni dépendance ni étape de build, et
// l'outil tient en un canvas et quelques écouteurs.

import {
  ZOOM_MAX, cadrageInitial, contraindre, deplacer, placement, tailleSortie, zoomPhotoEntiere,
} from './cadrage.js';
import { COTE_MAX_DEFAUT, QUALITE_DEFAUT } from './redimensionner-image.js';

// L'aperçu est redessiné à chaque mouvement. Le faire depuis une photo de
// téléphone de 12 millions de pixels saccade sur un appareil modeste : on
// travaille sur une copie réduite, et la photo d'origine ne sert qu'une fois,
// pour produire le fichier final.
const COTE_APERCU = 1600;

const PAS_ZOOM = 1.15;      // un clic sur + ou −
const PAS_CLAVIER = 16;     // une flèche, en pixels d'écran

/**
 * Couleur des marges quand la photo ne remplit pas le cadre : celle du fond
 * des pages, pour que la photo semble posée sur le site. Elle est inscrite
 * dans le fichier envoyé (un JPEG n'a pas de transparence) : si le fond du
 * site changeait un jour, les photos publiées avec des marges garderaient
 * l'ancienne teinte et devraient être recadrées.
 */
function couleurDeFond() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#F4EDDE';
}

function dessiner(canvas, image, cadrage, photo, fond) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const p = placement(cadrage, photo, { largeur: canvas.width, hauteur: canvas.height });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, p.x, p.y, p.largeur, p.hauteur);
}

/** Copie réduite de la photo pour l'aperçu, ou la photo elle-même si elle est déjà petite. */
function preparerApercu(bitmap) {
  const grandCote = Math.max(bitmap.width, bitmap.height);
  if (grandCote <= COTE_APERCU) return bitmap;
  const echelle = COTE_APERCU / grandCote;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * echelle);
  canvas.height = Math.round(bitmap.height * echelle);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function construireFenetre(ratio) {
  const dialog = document.createElement('dialog');
  dialog.className = 'recadrage';
  dialog.setAttribute('aria-labelledby', 'recadrage-titre');
  // Le gabarit ne contient que du texte fixe : rien ne vient de l'extérieur.
  dialog.innerHTML = `
    <h2 id="recadrage-titre">Recadrer la photo</h2>
    <p class="recadrage-aide">Faites glisser la photo pour choisir ce qui apparaît dans le cadre. Le curseur la rapproche ou l'éloigne. Ce que vous voyez dans le cadre est ce qui sera affiché sur le site.</p>
    <div class="recadrage-cadre" tabindex="0" role="group"
         aria-label="Photo à cadrer. Les flèches du clavier la déplacent, les touches plus et moins règlent le zoom.">
      <canvas></canvas>
    </div>
    <div class="recadrage-zoom">
      <button type="button" class="recadrage-pas" data-zoom="-1" aria-label="Éloigner la photo">−</button>
      <input type="range" step="0.01" aria-label="Zoom">
      <button type="button" class="recadrage-pas" data-zoom="1" aria-label="Rapprocher la photo">+</button>
    </div>
    <div class="recadrage-raccourcis">
      <button type="button" data-action="entiere">Photo entière</button>
      <button type="button" data-action="remplir">Remplir le cadre</button>
    </div>
    <p class="recadrage-note" data-slot="note" hidden>Photo entière : les marges prennent la couleur du fond du site.</p>
    <p class="status-msg error" data-slot="erreur" role="alert" hidden></p>
    <div class="recadrage-actions">
      <button type="button" class="btn btn-outline" data-action="annuler">Annuler</button>
      <button type="button" class="btn btn-accent" data-action="valider">Valider le cadrage</button>
    </div>
  `;
  dialog.querySelector('.recadrage-cadre').style.setProperty('--ratio', String(ratio));
  return dialog;
}

/**
 * Ouvre la fenêtre de recadrage et attend la décision de l'atelier.
 *
 * L'envoi se fait fenêtre ouverte : elle affiche « Envoi en cours » puis se
 * ferme une fois la photo en ligne. Si l'envoi échoue, le cadrage n'est pas
 * perdu, il suffit de valider de nouveau.
 *
 * @template T
 * @param {object} options
 * @param {Blob} options.source photo à cadrer (fichier choisi, ou photo déjà en ligne)
 * @param {string} [options.nom] nom du fichier d'origine, repris pour le fichier produit
 * @param {number} options.ratio largeur / hauteur du cadre
 * @param {(fichier: File) => Promise<T>} options.envoyer reçoit la photo recadrée
 * @returns {Promise<T | null>} ce que renvoie `envoyer`, ou null si l'atelier annule
 */
export async function ouvrirRecadrage({ source, nom = 'photo', ratio, envoyer }) {
  let bitmap;
  try {
    // imageOrientation: 'from-image' : sans cette option, une photo prise
    // debout au téléphone arriverait couchée dans le cadre.
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch (err) {
    console.error('recadrage.js : photo illisible', err);
    throw new Error('Cette photo ne peut pas être lue. Essayez avec une image JPEG, PNG ou WebP.');
  }

  const photo = { largeur: bitmap.width, hauteur: bitmap.height };
  const apercu = preparerApercu(bitmap);
  const fond = couleurDeFond();
  const zoomMin = zoomPhotoEntiere(photo, ratio);
  // Une photo déjà au format n'a rien à dézoomer : les raccourcis ne feraient rien.
  const dejaAuFormat = zoomMin > 0.999;

  const dialog = construireFenetre(ratio);
  const cadre = dialog.querySelector('.recadrage-cadre');
  const canvas = dialog.querySelector('canvas');
  const curseur = dialog.querySelector('input[type="range"]');
  const note = dialog.querySelector('[data-slot="note"]');
  const erreurEl = dialog.querySelector('[data-slot="erreur"]');
  const btnValider = dialog.querySelector('[data-action="valider"]');
  const btnAnnuler = dialog.querySelector('[data-action="annuler"]');

  // Le curseur travaille sur le logarithme du zoom : chaque cran rapproche
  // d'une même proportion, alors qu'un curseur linéaire concentrerait tout le
  // réglage fin sur son premier quart.
  curseur.min = String(Math.log2(zoomMin));
  curseur.max = String(Math.log2(ZOOM_MAX));
  dialog.querySelector('.recadrage-raccourcis').hidden = dejaAuFormat;

  let cadrage = cadrageInitial();
  let envoiEnCours = false;
  let dessinPrevu = false;

  const tailleCadre = () => ({ largeur: cadre.clientWidth, hauteur: cadre.clientHeight });

  function rafraichir() {
    curseur.value = String(Math.log2(cadrage.zoom));
    note.hidden = cadrage.zoom >= 0.999;
    // Un seul dessin par image affichée, quel que soit le nombre de
    // mouvements reçus entre-temps.
    if (dessinPrevu) return;
    dessinPrevu = true;
    requestAnimationFrame(() => {
      dessinPrevu = false;
      if (canvas.width > 0 && canvas.height > 0) dessiner(canvas, apercu, cadrage, photo, fond);
    });
  }

  function regler(nouveau) {
    if (envoiEnCours) return;
    cadrage = contraindre(nouveau, photo, ratio);
    rafraichir();
  }

  const zoomer = (facteur) => regler({ ...cadrage, zoom: cadrage.zoom * facteur });
  const glisser = (dx, dy) => { if (!envoiEnCours) { cadrage = deplacer(cadrage, photo, tailleCadre(), dx, dy); rafraichir(); } };

  // Le canvas suit la taille réelle du cadre, densité d'écran comprise : sans
  // cela l'aperçu serait flou sur un téléphone ou un écran Retina.
  const observateur = new ResizeObserver(() => {
    const densite = window.devicePixelRatio || 1;
    canvas.width = Math.round(cadre.clientWidth * densite);
    canvas.height = Math.round(cadre.clientHeight * densite);
    rafraichir();
  });
  observateur.observe(cadre);

  // --- Souris et doigts ------------------------------------------------------
  // Un pointeur déplace la photo. Deux pointeurs (pincement sur un écran
  // tactile) règlent le zoom, comme dans une galerie de photos.
  const pointeurs = new Map();
  const ecart = () => {
    const [a, b] = [...pointeurs.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  cadre.addEventListener('pointerdown', (e) => {
    cadre.setPointerCapture(e.pointerId);
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  cadre.addEventListener('pointermove', (e) => {
    const precedent = pointeurs.get(e.pointerId);
    if (!precedent) return;
    const ecartAvant = pointeurs.size === 2 ? ecart() : 0;
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointeurs.size === 2) {
      if (ecartAvant > 0) zoomer(ecart() / ecartAvant);
    } else {
      glisser(e.clientX - precedent.x, e.clientY - precedent.y);
    }
  });
  for (const fin of ['pointerup', 'pointercancel']) {
    cadre.addEventListener(fin, (e) => pointeurs.delete(e.pointerId));
  }
  cadre.addEventListener('wheel', (e) => {
    // Sans cela, la molette ferait défiler la fenêtre en même temps.
    e.preventDefault();
    zoomer(Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  // --- Clavier -----------------------------------------------------------------
  cadre.addEventListener('keydown', (e) => {
    const pas = e.shiftKey ? PAS_CLAVIER * 4 : PAS_CLAVIER;
    const gestes = {
      ArrowLeft: () => glisser(pas, 0),
      ArrowRight: () => glisser(-pas, 0),
      ArrowUp: () => glisser(0, pas),
      ArrowDown: () => glisser(0, -pas),
      '+': () => zoomer(PAS_ZOOM),
      '=': () => zoomer(PAS_ZOOM),
      '-': () => zoomer(1 / PAS_ZOOM),
    };
    if (!gestes[e.key]) return;
    e.preventDefault();
    gestes[e.key]();
  });

  // --- Curseur et boutons ------------------------------------------------------
  curseur.addEventListener('input', () => regler({ ...cadrage, zoom: 2 ** Number(curseur.value) }));
  for (const btn of dialog.querySelectorAll('.recadrage-pas')) {
    btn.addEventListener('click', () => zoomer(btn.dataset.zoom === '1' ? PAS_ZOOM : 1 / PAS_ZOOM));
  }
  dialog.querySelector('[data-action="entiere"]').addEventListener('click', () => regler({ zoom: zoomMin, cx: 0.5, cy: 0.5 }));
  dialog.querySelector('[data-action="remplir"]').addEventListener('click', () => regler({ ...cadrage, zoom: 1 }));

  /** Le fichier final, produit depuis la photo d'origine et non depuis l'aperçu. */
  async function produireFichier() {
    const taille = tailleSortie(cadrage, photo, ratio, COTE_MAX_DEFAUT);
    const sortie = document.createElement('canvas');
    sortie.width = taille.largeur;
    sortie.height = taille.hauteur;
    dessiner(sortie, bitmap, cadrage, photo, fond);
    const blob = await new Promise((resolve) => sortie.toBlob(resolve, 'image/jpeg', QUALITE_DEFAUT));
    if (!blob) throw new Error('Le recadrage a échoué. Réessayez, ou choisissez une autre photo.');
    const base = String(nom).replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  }

  return new Promise((resolve) => {
    function fermer(resultat) {
      observateur.disconnect();
      bitmap.close();
      dialog.close();
      dialog.remove();
      resolve(resultat);
    }

    btnAnnuler.addEventListener('click', () => fermer(null));
    // Touche Échap. Pendant l'envoi elle est ignorée : fermer la fenêtre
    // laisserait croire que la photo n'a pas été ajoutée alors qu'elle part.
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (!envoiEnCours) fermer(null);
    });

    btnValider.addEventListener('click', async () => {
      envoiEnCours = true;
      erreurEl.hidden = true;
      btnValider.disabled = true;
      btnAnnuler.disabled = true;
      btnValider.textContent = 'Envoi en cours…';
      try {
        const fichier = await produireFichier();
        fermer(await envoyer(fichier));
      } catch (err) {
        console.error('recadrage.js : envoi', err);
        // Le message de Supabase est technique et en anglais : seuls nos
        // propres messages, écrits pour l'atelier, sont affichés tels quels.
        erreurEl.textContent = err instanceof Error && err.name === 'Error' && err.message
          ? err.message
          : "La photo n'a pas pu être envoyée. Vérifiez votre connexion, puis validez de nouveau.";
        erreurEl.hidden = false;
        envoiEnCours = false;
        btnValider.disabled = false;
        btnAnnuler.disabled = false;
        btnValider.textContent = 'Valider le cadrage';
      }
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    // Le cadre reçoit le focus : les flèches du clavier agissent tout de suite.
    cadre.focus();
  });
}
