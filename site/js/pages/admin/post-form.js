// post-form.js — commun à nouveau.html et edition.html (posts vitrine).

import { getAuthenticatedClient } from '../../supabase-client.js';
import { creerPosteDePhotos } from '../../lib/photo-cadree.js';
import { slugify } from '../../lib/slugify.js';
import { creerVignette, creerCroix, creerBoutonRecadrer, imageDeFond } from '../../lib/vignette-photo.js';

const idPost = new URLSearchParams(location.search).get('id');
const estEdition = Boolean(idPost);

const form = document.getElementById('form-post');
const erreurEl = document.getElementById('erreur-post');
const zoneDetail = document.getElementById('zone-detail');
const caseAvantApres = document.getElementById('avant_apres_actif');
const zonePhotosProjet = document.getElementById('zone-photos-projet');

let photoAvant = null;
let photoApres = null;
let photosDetail = [];
let client;
let poste; // choisir, cadrer, envoyer : voir lib/photo-cadree.js

function signalerErreur(err) {
  erreurEl.textContent = err.message;
  erreurEl.hidden = false;
}

/**
 * Lance une opération sur une photo (ajout ou recadrage) et affiche son
 * éventuel échec dans le formulaire. Sans cela, une photo refusée ou un envoi
 * raté ne laissait aucune trace à l'écran : la zone restait vide, sans raison.
 * @param {() => Promise<string | null>} operation rend l'adresse de la photo, ou null si annulé
 * @param {(url: string) => void} surSucces
 */
async function traiterPhoto(operation, surSucces) {
  erreurEl.hidden = true;
  try {
    const url = await operation();
    if (url) surSucces(url);
  } catch (err) {
    signalerErreur(err);
  }
}

function poserPhotoUnique(nom, url) {
  if (nom === 'avant') photoAvant = url; else photoApres = url;
  rendreDropzoneUnique(nom, url);
}

// Les zones "avant" et "après" n'accueillent qu'une photo : au lieu de créer
// une vignette à côté, on habille la zone de dépôt elle-même. L'input de
// fichier est conservé, ce qui permet de remplacer la photo en cliquant
// dessus, et la croix permet de la retirer complètement.
function rendreDropzoneUnique(nom, url) {
  const dz = document.querySelector(`[data-slot-photo="${nom}"]`);
  dz.classList.add('photo-vignette', 'dropzone-remplie');
  dz.style.backgroundImage = imageDeFond(url);
  // Retire le libellé ("Glisser la photo « avant »") sans toucher à l'input :
  // le supprimer rendrait la photo impossible à remplacer par la suite.
  for (const noeud of Array.from(dz.childNodes)) {
    if (noeud.nodeType === Node.TEXT_NODE) noeud.remove();
  }
  dz.querySelector('.photo-supprimer')?.remove();
  dz.querySelector('.photo-recadrer')?.remove();
  dz.appendChild(creerCroix(() => viderDropzoneUnique(nom)));
  dz.appendChild(creerBoutonRecadrer(() => traiterPhoto(() => poste.recadrer(url), (nouvelle) => poserPhotoUnique(nom, nouvelle))));
}

/**
 * Texte d'une zone de dépôt vide. Celui de la photo de droite dépend du mode :
 * « après » n'a de sens qu'en face d'un « avant ».
 */
function libelleDropzone(nom) {
  if (nom === 'avant') return 'Glisser la photo « avant »';
  return caseAvantApres.checked ? 'Glisser la photo « après »' : 'Glisser la photo du résultat';
}

function viderDropzoneUnique(nom) {
  const dz = document.querySelector(`[data-slot-photo="${nom}"]`);
  dz.classList.remove('photo-vignette', 'dropzone-remplie');
  dz.style.backgroundImage = '';
  dz.querySelector('.photo-supprimer')?.remove();
  dz.querySelector('.photo-recadrer')?.remove();
  dz.insertBefore(document.createTextNode(libelleDropzone(nom)), dz.firstChild);
  if (nom === 'avant') photoAvant = null; else photoApres = null;
}

/**
 * Adapte le formulaire au mode choisi.
 *
 * Décocher ne supprime PAS la photo « avant » déjà envoyée : elle reste en
 * base, simplement plus affichée sur le site, et revient telle quelle si la
 * case est recochée. Sans ça, une hésitation coûterait une photo.
 */
function basculerAvantApres() {
  const actif = caseAvantApres.checked;
  zonePhotosProjet.querySelector('[data-champ-photo="avant"]').hidden = !actif;
  zonePhotosProjet.classList.toggle('photo-seule', !actif);
  document.querySelector('[data-libelle-photo="apres"]').textContent = actif ? 'Photo après' : 'Photo du résultat';

  // Le texte ne se réécrit que si la zone est vide : une zone remplie montre
  // la photo, et son libellé a déjà été retiré.
  const dz = document.querySelector('[data-slot-photo="apres"]');
  if (!dz.classList.contains('dropzone-remplie')) {
    for (const noeud of Array.from(dz.childNodes)) {
      if (noeud.nodeType === Node.TEXT_NODE) noeud.remove();
    }
    dz.insertBefore(document.createTextNode(libelleDropzone('apres')), dz.firstChild);
  }
}

function rendreDetail() {
  zoneDetail.querySelectorAll('[data-photo-detail]').forEach((el) => el.remove());
  const dropzone = zoneDetail.querySelector('[data-slot-photo="detail"]');
  photosDetail.forEach((url, i) => {
    const div = creerVignette(
      url,
      () => { photosDetail.splice(i, 1); rendreDetail(); },
      () => traiterPhoto(() => poste.recadrer(url), (nouvelle) => {
        // Retrouvée par son adresse et non par son rang : une autre photo a pu
        // être retirée pendant que la fenêtre de recadrage était ouverte.
        const rang = photosDetail.indexOf(url);
        if (rang !== -1) photosDetail[rang] = nouvelle;
        rendreDetail();
      })
    );
    div.dataset.photoDetail = 'true';
    zoneDetail.insertBefore(div, dropzone);
  });
  dropzone.style.display = photosDetail.length >= 3 ? 'none' : 'flex';
}

function wireDropzones() {
  document.querySelectorAll('[data-slot-photo="avant"], [data-slot-photo="apres"]').forEach((dz) => {
    const input = dz.querySelector('input[type="file"]');
    dz.addEventListener('click', () => { if (input) input.click(); });
    input?.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      await traiterPhoto(() => poste.ajouter(file), (url) => poserPhotoUnique(dz.dataset.slotPhoto, url));
      // Vidé dans tous les cas : sans cela, rechoisir la même photo après une
      // annulation ne déclencherait rien, le champ n'ayant pas changé.
      input.value = '';
    });
  });

  const dzDetail = zoneDetail.querySelector('[data-slot-photo="detail"]');
  const inputDetail = dzDetail.querySelector('input[type="file"]');
  dzDetail.addEventListener('click', () => inputDetail.click());
  inputDetail.addEventListener('change', async () => {
    const file = inputDetail.files[0];
    if (!file) return;
    await traiterPhoto(() => poste.ajouter(file), (url) => { photosDetail.push(url); rendreDetail(); });
    inputDetail.value = '';
  });
}

async function chargerSavoirFaire() {
  const { data } = await client.from('categories').select('id, nom').eq('type', 'savoir_faire').order('ordre');
  document.getElementById('savoir_faire').innerHTML = (data ?? []).map((c) => `<option value="${c.id}">${c.nom}</option>`).join('');
}

async function chargerPostExistant() {
  const { data, error } = await client.from('posts_vitrine').select('*').eq('id', idPost).single();
  if (error || !data) {
    erreurEl.textContent = 'Post introuvable.';
    erreurEl.hidden = false;
    return;
  }
  form.titre.value = data.titre;
  form.savoir_faire_id.value = data.savoir_faire_id ?? '';
  form.lieu.value = data.lieu ?? '';
  form.date_projet.value = data.date_projet ?? '';
  form.duree.value = data.duree ?? '';
  form.tissu.value = data.tissu ?? '';
  form.matieres_reemployees.value = data.matieres_reemployees ?? '';
  form.resume.value = data.resume ?? '';
  form.recit.value = data.recit ?? '';
  form.mise_en_avant.checked = data.mise_en_avant;
  caseAvantApres.checked = data.avant_apres_actif ?? true;

  photoAvant = data.photo_avant_url;
  photoApres = data.photo_apres_url;
  photosDetail = data.photos_detail ?? [];
  if (photoAvant) rendreDropzoneUnique('avant', photoAvant);
  if (photoApres) rendreDropzoneUnique('apres', photoApres);
  rendreDetail();
  basculerAvantApres();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erreurEl.hidden = true;

  const donnees = new FormData(form, e.submitter);
  const enregistrement = {
    titre: donnees.get('titre'),
    savoir_faire_id: donnees.get('savoir_faire_id'),
    lieu: donnees.get('lieu') || null,
    date_projet: donnees.get('date_projet'),
    duree: donnees.get('duree') || null,
    tissu: donnees.get('tissu') || null,
    matieres_reemployees: donnees.get('matieres_reemployees') || null,
    resume: donnees.get('resume') || null,
    recit: donnees.get('recit'),
    mise_en_avant: donnees.get('mise_en_avant') === 'on',
    avant_apres_actif: donnees.get('avant_apres_actif') === 'on',
    photo_avant_url: photoAvant,
    photo_apres_url: photoApres,
    photos_detail: photosDetail,
    statut: donnees.get('statut'),
  };

  let resultat;
  if (estEdition) {
    resultat = await client.from('posts_vitrine').update(enregistrement).eq('id', idPost);
  } else {
    enregistrement.slug = slugify(enregistrement.titre) + '-' + Math.random().toString(36).slice(2, 6);
    resultat = await client.from('posts_vitrine').insert(enregistrement);
  }

  if (resultat.error) {
    erreurEl.textContent = "Erreur à l'enregistrement, merci de réessayer.";
    erreurEl.hidden = false;
    console.error('post-form.js', resultat.error);
    return;
  }

  window.location.href = '/admin/posts/index.html';
});

const btnSupprimer = document.getElementById('btn-supprimer');
if (btnSupprimer) {
  btnSupprimer.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!confirm('Supprimer définitivement ce post ?')) return;
    const { error } = await client.from('posts_vitrine').delete().eq('id', idPost);
    if (error) { alert('Impossible de supprimer ce post.'); return; }
    window.location.href = '/admin/posts/index.html';
  });
}

async function init() {
  client = await getAuthenticatedClient();
  poste = creerPosteDePhotos({ client, dossier: 'posts', zone: 'vitrine' });
  wireDropzones();
  caseAvantApres.addEventListener('change', basculerAvantApres);
  basculerAvantApres();
  await chargerSavoirFaire();
  if (estEdition) await chargerPostExistant();
}

init();
