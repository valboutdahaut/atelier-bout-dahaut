// contact.js — pré-remplit le sujet si on arrive depuis un lien "projet
// similaire" (?sujet=...&post=...), puis insère le message dans
// messages_contact (policy INSERT publique, voir supabase/policies.sql).

import { supabase } from '../supabase-client.js';

const params = new URLSearchParams(location.search);
const sujetPrerempli = params.get('sujet');
const postId = params.get('post');
if (sujetPrerempli) document.getElementById('sujet').value = sujetPrerempli;

const form = document.getElementById('form-contact');
const statutEl = document.getElementById('statut-contact');
const btn = document.getElementById('btn-envoyer');

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
