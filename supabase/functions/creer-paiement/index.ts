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

// Le navigateur interroge cette fonction depuis un autre domaine que Supabase :
// sans ces en-têtes, il refuse la réponse.
const CORS = {
  'Access-Control-Allow-Origin': SITE || '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reponse(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reponse({ erreur: 'Méthode non autorisée' }, 405);

  try {
    const { numero, email } = await req.json();
    if (!numero || !email) return reponse({ erreur: 'Requête incomplète' }, 400);

    // L'email doit correspondre : sans cela, connaître un numéro de commande
    // suffirait à lire le montant payé par quelqu'un d'autre.
    const { data: commande, error } = await supabase
      .from('commandes')
      .select('id, numero, client_email, total_cents, paiement_statut')
      .eq('numero', numero)
      .maybeSingle();

    if (error) throw error;
    if (!commande || commande.client_email.toLowerCase() !== String(email).toLowerCase()) {
      return reponse({ erreur: 'Commande introuvable' }, 404);
    }
    if (commande.paiement_statut === 'paye') {
      return reponse({ erreur: 'Cette commande est déjà réglée' }, 409);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: commande.client_email,
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
      success_url: `${SITE}/boutique/confirmation.html?commande=${encodeURIComponent(commande.numero)}`,
      cancel_url: `${SITE}/boutique/panier.html?paiement=annule`,
    });

    await supabase
      .from('commandes')
      .update({ stripe_session_id: session.id })
      .eq('id', commande.id);

    return reponse({ url: session.url });
  } catch (err) {
    console.error('creer-paiement', err);
    return reponse({ erreur: 'Le paiement n\'a pas pu être préparé' }, 500);
  }
});
