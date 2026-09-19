// contact.js — pré-remplit le sujet si on arrive depuis un lien "projet
// similaire" (?sujet=...&post=...), insère le message dans messages_contact
// (policy INSERT publique, voir supabase/policies.sql), et affiche les
// réseaux sociaux avec leur logo.

import { supabase } from '../supabase-client.js';
import { creerLogo, logoReseau } from '../lib/logos-reseaux.js';
import { redimensionner } from '../lib/redimensionner-image.js';
import { creerVignette } from '../lib/vignette-photo.js';

const params = new URLSearchParams(location.search);
const postId = params.get('post');

const form = document.getElementById('form-contact');
const statutEl = document.getElementById('statut-contact');
const btn = document.getElementById('btn-envoyer');
const selectSujet = document.getElementById('sujet');
const champSujetLibre = document.getElementById('champ-sujet-libre');
const inputSujetLibre = document.getElementById('sujet-libre');

// --- Sujet ------------------------------------------------------------------
// Le lien « projet similaire » d'une réalisation arrive avec un sujet en clair
// dans l'adresse, qui ne correspond à aucune option de la liste. On le range
// donc dans « Autre » et on le recopie dans le champ libre, plutôt que de
// laisser la liste sur son état vide et de perdre l'information.
const sujetPrerempli = params.get('sujet');

function basculerSujetLibre() {
  const libre = selectSujet.value === 'Autre';
  champSujetLibre.hidden = !libre;
  inputSujetLibre.required = libre;
  if (!libre) inputSujetLibre.value = '';
}

selectSujet.addEventListener('change', basculerSujetLibre);

if (sujetPrerempli) {
  const existe = [...selectSujet.options].some((o) => o.value === sujetPrerempli);
  selectSujet.value = existe ? sujetPrerempli : 'Autre';
  basculerSujetLibre();
  if (!existe) inputSujetLibre.value = sujetPrerempli;
}

// --- Réseaux sociaux --------------------------------------------------------
// Une ligne par réseau, saisie dans l'administration :
//   instagram | @atelierboutdahaut | https://www.instagram.com/atelierboutdahaut
// Le premier champ choisit le logo, le deuxième s'affiche, le troisième est la
// destination du lien. La clé "contact-reseaux" n'est volontairement l'id
// d'aucun élément de la page : site-content.js l'ignore donc, et c'est ce
// fichier qui la met en forme.

const sectionReseaux = document.querySelector('[data-section="reseaux"]');
const listeReseaux = document.getElementById('reseaux-liste');

function creerLienReseau(ligne) {
  const [cle = '', nom = '', url = ''] = ligne.split('|').map((c) => c.trim());
  if (!url) return null;

  const a = document.createElement('a');
  a.className = 'reseau-lien';
  a.href = url;
  a.target = '_blank';
  // noopener protège la page d'origine : sans lui, le site ouvert garde une
  // référence vers cet onglet et peut le rediriger ailleurs.
  a.rel = 'noopener noreferrer';

  a.appendChild(creerLogo(cle));

  const texte = document.createElement('span');
  // À défaut de nom saisi, on retombe sur celui du réseau plutôt que sur un
  // lien vide et incompréhensible.
  texte.textContent = nom || logoReseau(cle).nom;
  a.appendChild(texte);

  return a;
}

async function afficherReseaux() {
  const { data, error } = await supabase
    .from('contenu_site')
    .select('valeur')
    .eq('cle', 'contact-reseaux')
    .maybeSingle();

  if (error) {
    console.error('contact.js : impossible de charger les réseaux', error);
    return;
  }

  const liens = (data?.valeur ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(creerLienReseau)
    .filter(Boolean);

  // La section reste masquée tant qu'aucun réseau n'est renseigné : mieux vaut
  // une page plus courte qu'un titre « Suivre l'atelier » suivi d'un vide.
  if (liens.length === 0) return;

  listeReseaux.replaceChildren(...liens);
  sectionReseaux.hidden = false;
}

afficherReseaux();

// --- Photos jointes ---------------------------------------------------------
// Trois au maximum, allégées dans le navigateur avant l'envoi. Compression plus
// forte que pour les photos du site : elles servent à comprendre une demande,
// pas à être publiées. Une photo de téléphone de 4 Mo tombe ainsi sous 200 Ko,
// ce qui évite un envoi interminable en 4G depuis un salon.
const MAX_PHOTOS = 3;
const BUCKET_MESSAGES = 'messages-photos';

const inputPhotos = document.getElementById('photos-message');
const apercuEl = document.getElementById('apercu-photos');
let photosChoisies = []; // { fichier: File, apercu: string }

function rafraichirApercus() {
  apercuEl.replaceChildren(
    ...photosChoisies.map((p) =>
      creerVignette(p.apercu, () => {
        URL.revokeObjectURL(p.apercu);
        photosChoisies = photosChoisies.filter((autre) => autre !== p);
        rafraichirApercus();
      })
    )
  );
  // Au-delà de trois photos, le sélecteur disparaît plutôt que d'accepter un
  // choix qui serait refusé ensuite.
  inputPhotos.hidden = photosChoisies.length >= MAX_PHOTOS;
}

inputPhotos.addEventListener('change', async () => {
  const place = MAX_PHOTOS - photosChoisies.length;
  const fichiers = [...inputPhotos.files].slice(0, place);
  // Le champ est vidé tout de suite : sans cela, rechoisir le même fichier
  // après l'avoir retiré ne déclencherait aucun évènement.
  inputPhotos.value = '';

  for (const fichier of fichiers) {
    const allege = await redimensionner(fichier, { coteMax: 1400, qualite: 0.7 });
    photosChoisies.push({ fichier: allege, apercu: URL.createObjectURL(allege) });
  }
  rafraichirApercus();
});

/**
 * Dépose les photos dans le bucket privé et renvoie leurs chemins.
 * On stocke le chemin et non une adresse complète : le bucket étant privé,
 * l'administration fabrique un lien temporaire au moment de l'affichage.
 */
async function envoyerPhotos() {
  const chemins = [];
  for (const { fichier } of photosChoisies) {
    const extension = (fichier.name.match(/\.[^.]+$/) ?? ['.jpg'])[0].toLowerCase();
    const chemin = `${crypto.randomUUID()}${extension}`;
    const { error } = await supabase.storage
      .from(BUCKET_MESSAGES)
      .upload(chemin, fichier, { contentType: fichier.type, upsert: false });
    if (error) throw error;
    chemins.push(chemin);
  }
  return chemins;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = 'Envoi…';
  statutEl.hidden = true;

  const donnees = new FormData(form);

  let photos = [];
  try {
    if (photosChoisies.length > 0) {
      btn.textContent = `Envoi des photos…`;
      photos = await envoyerPhotos();
    }
  } catch (err) {
    console.error('contact.js : envoi des photos', err);
    statutEl.textContent = "Vos photos n'ont pas pu être envoyées. Réessayez, ou envoyez votre message sans photo.";
    statutEl.className = 'status-msg error';
    statutEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Envoyer';
    return;
  }

  btn.textContent = 'Envoi…';
  const { error } = await supabase.from('messages_contact').insert({
    nom: donnees.get('nom'),
    email: donnees.get('email'),
    telephone: donnees.get('telephone') || null,
    sujet: donnees.get('sujet') || null,
    sujet_libre: donnees.get('sujet-libre') || null,
    message: donnees.get('message'),
    photos,
    post_vitrine_id: postId || null,
  });

  if (error) {
    statutEl.textContent = "Une erreur est survenue, merci de réessayer ou d'écrire directement par email.";
    statutEl.className = 'status-msg error';
    statutEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Envoyer';
    console.error('contact.js', error);
    return;
  }

  form.hidden = true;
  statutEl.textContent = 'Message envoyé, merci ! Vous aurez une réponse sous 48h.';
  statutEl.className = 'status-msg success';
  statutEl.hidden = false;
});
