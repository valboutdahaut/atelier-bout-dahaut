// contact.js — pré-remplit le sujet si on arrive depuis un lien "projet
// similaire" (?sujet=...&post=...), insère le message dans messages_contact
// (policy INSERT publique, voir supabase/policies.sql), et affiche les
// réseaux sociaux avec leur logo.

import { supabase } from '../supabase-client.js';
import { creerLogo, logoReseau } from '../lib/logos-reseaux.js';

const params = new URLSearchParams(location.search);
const sujetPrerempli = params.get('sujet');
const postId = params.get('post');
if (sujetPrerempli) document.getElementById('sujet').value = sujetPrerempli;

const form = document.getElementById('form-contact');
const statutEl = document.getElementById('statut-contact');
const btn = document.getElementById('btn-envoyer');

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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = 'Envoi…';
  statutEl.hidden = true;

  const donnees = new FormData(form);
  const { error } = await supabase.from('messages_contact').insert({
    nom: donnees.get('nom'),
    email: donnees.get('email'),
    telephone: donnees.get('telephone') || null,
    sujet: donnees.get('sujet') || null,
    message: donnees.get('message'),
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
