// confirmation.js — affiche le récapitulatif renvoyé par la fonction RPC
// creer_commande (voir commande.js). Pas de second appel de lecture à
// Supabase : on n'a pas de policy SELECT publique sur "commandes" (RLS), la
// réponse de la fonction RPC est donc la seule source de vérité ici.

import { formatPrix } from '../lib/format.js';

const contenuEl = document.getElementById('contenu-confirmation');
const raw = sessionStorage.getItem('derniere-commande');

if (!raw) {
  contenuEl.innerHTML = `
    <h1 style="font-size:30px;margin:24px 0 12px">Aucune commande récente</h1>
    <p style="color:var(--color-text-muted)">Retournez à la <a href="/boutique/index.html">boutique</a> pour passer commande.</p>
  `;
} else {
  const commande = JSON.parse(raw);
  contenuEl.innerHTML = `
    <h1 style="font-size:30px;margin:24px 0 12px">Merci, c'est enregistré !</h1>
    <p style="color:var(--color-text-muted);margin-bottom:24px">
      Commande <strong>${commande.numero}</strong> — ${formatPrix(commande.total_cents)}<br>
      ${commande.mode_retrait === 'livraison' ? 'Livraison à l\'adresse indiquée.' : 'À retirer au showroom de Rambouillet.'}
    </p>
    <p style="font-size:13.5px;color:var(--color-text-faint)">Un email de confirmation n'est pas envoyé automatiquement sur cette version. Valérie prépare votre commande et vous recontacte.</p>
    <a class="btn btn-primary" href="/boutique/index.html" style="margin-top:24px;display:inline-flex">Retour à la boutique</a>
  `;
  sessionStorage.removeItem('derniere-commande');
}
