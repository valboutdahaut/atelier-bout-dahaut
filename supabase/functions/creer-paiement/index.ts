// creer-paiement — fonction serveur appelée par la page de commande.
//
// Rôle : créer une session de paiement Stripe pour une commande déjà
// enregistrée, et renvoyer l'adresse de la page de paiement.
//
// POURQUOI UNE FONCTION SERVEUR. Le site est un ensemble de fichiers statiques :
// tout ce qu'il contient est modifiable par le visiteur. Si le montant partait
// du navigateur, n'importe qui pourrait payer un fauteuil 1 €. Ici le montant
// est relu en base à partir du numéro de commande, que le client ne peut pas
// falsifier à son avantage : il paierait simplement le vrai prix.
//
// Déploiement : Supabase > Edge Functions > Deploy a new function > Via Editor,
// nommer la fonction « creer-paiement » et coller ce fichier.
//
// Variables d'environnement à renseigner dans Supabase (Edge Functions >
// Secrets), jamais dans le code :
//   STRIPE_SECRET_KEY   clé secrète Stripe (sk_test_… puis sk_live_…)
//   SITE_URL            adresse du site, sans barre oblique finale
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournies automatiquement.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const SITE = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');

// Le navigateur interroge cette fonction depuis un autre domaine que Supabase.
// Avant le vrai appel, il demande donc l'autorisation en annonçant les en-têtes
// qu'il compte joindre, et si un seul n'est pas accepté il annule tout sans
// rien envoyer.
//
// Cette liste n'est volontairement PAS écrite en dur : la bibliothèque Supabase
// ajoute des en-têtes de son cru (x-client-info, et d'autres selon les
// versions). Un seul oubli bloque tout le paiement, côté navigateur, sans
// laisser la moindre trace dans les journaux du serveur. On renvoie donc ce que
// le navigateur demande. Ce n'est pas un relâchement : c'est l'origine qui
// protège cette fonction, et elle reste limitée au site.
function cors(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': SITE || '*',
    'Access-Control-Allow-Headers':
      req.headers.get('access-control-request-headers') ?? 'authorization, content-type, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin, Access-Control-Request-Headers',
  };
}

function reponse(req: Request, corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reponse(req, { erreur: 'Méthode non autorisée' }, 405);

  try {
    const { numero, email } = await req.json();
    if (!numero || !email) return reponse(req, { erreur: 'Requête incomplète' }, 400);

    // L'email doit correspondre : sans cela, connaître un numéro de commande
    // suffirait à lire le montant payé par quelqu'un d'autre.
    const { data: commande, error } = await supabase
      .from('commandes')
      .select('id, numero, client_email, total_cents, paiement_statut, jeton_client')
      .eq('numero', numero)
      .maybeSingle();

    if (error) throw error;
    if (!commande || commande.client_email.toLowerCase() !== String(email).toLowerCase()) {
      return reponse(req, { erreur: 'Commande introuvable' }, 404);
    }
    if (commande.paiement_statut === 'paye') {
      return reponse(req, { erreur: 'Cette commande est déjà réglée' }, 409);
    }

    // Les deux adresses de retour portent le jeton de la commande : c'est la
    // seule preuve que le visiteur, qui n'est pas connecté, peut présenter
    // ensuite pour savoir si son paiement a abouti, ou pour annuler.
    const retour = `commande=${encodeURIComponent(commande.numero)}`
      + `&jeton=${encodeURIComponent(commande.jeton_client)}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: commande.client_email,
      locale: 'fr',
      // payment_method_types n'est volontairement pas renseigné : Stripe
      // propose alors les moyens de paiement cochés dans le tableau de bord.
      // Activer la carte, PayPal ou le paiement en plusieurs fois se fait donc
      // sans toucher à ce fichier.
      //
      // Une seule ligne au montant total : le détail des articles vit déjà
      // dans lignes_commande, le dupliquer chez Stripe créerait deux vérités.
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: commande.total_cents,
          product_data: { name: `Commande ${commande.numero}` },
        },
      }],
      // Le délai court volontairement : le stock est réservé pendant ce temps,
      // une pièce unique ne doit pas rester bloquée une journée entière.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      metadata: { commande_id: commande.id, numero: commande.numero },
      success_url: `${SITE}/boutique/confirmation.html?${retour}`,
      cancel_url: `${SITE}/boutique/panier.html?paiement=annule&${retour}`,
    });

    await supabase
      .from('commandes')
      .update({ stripe_session_id: session.id })
      .eq('id', commande.id);

    return reponse(req, { url: session.url });
  } catch (err) {
    console.error('creer-paiement', err);
    return reponse(req, { erreur: 'Le paiement n\'a pas pu être préparé' }, 500);
  }
});
