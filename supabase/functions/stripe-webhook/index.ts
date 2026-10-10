// stripe-webhook — Stripe prévient ici du sort de chaque paiement.
//
// POURQUOI CE N'EST PAS LE NAVIGATEUR QUI CONFIRME. Le retour du client sur la
// page de confirmation ne prouve rien : il peut fermer l'onglet avant, ou
// appeler l'adresse de confirmation à la main sans avoir payé. Seul Stripe sait
// si l'argent est arrivé, et il le dit ici, de serveur à serveur.
//
// Deux évènements sont traités :
//   checkout.session.completed  le paiement a réussi, la commande est réglée
//   checkout.session.expired    le client n'a pas payé à temps, on remet les
//                               pièces en vente (creer_commande a retiré le
//                               stock dès l'enregistrement de la commande)
//
// Un paiement confirmé déclenche aussi l'envoi du récapitulatif de commande au
// client et de l'avis à l'atelier, confiés à la fonction envoyer-confirmation.
// C'est le seul moment où l'on sait que l'achat est réel : avant le paiement,
// une commande n'est qu'un panier en attente.
//
// Déploiement : Supabase > Edge Functions > Deploy a new function > Via Editor,
// nommer la fonction « stripe-webhook » et coller ce fichier.
//
// IMPORTANT : cette fonction doit être déclarée SANS vérification de jeton
// (« Verify JWT » désactivé), car Stripe appelle sans jeton Supabase. Sa
// sécurité vient de la signature Stripe vérifiée ci-dessous, qui prouve que
// l'appel vient bien de Stripe et n'a pas été fabriqué.
//
// Secrets à renseigner dans Supabase :
//   STRIPE_SECRET_KEY       clé secrète Stripe
//   STRIPE_WEBHOOK_SECRET   « Signing secret » du webhook (whsec_…)
// La fonction envoyer-confirmation, appelée ici, a les siens.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const SIGNATURE_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

/**
 * Demande l'envoi du récapitulatif de commande.
 *
 * Volontairement tolérant : un échec d'envoi ne doit pas faire échouer le
 * traitement du paiement. Si l'on renvoyait une erreur à Stripe, il réessaierait
 * tout le traitement pour un e-mail, alors que l'argent est déjà encaissé et la
 * commande enregistrée. La commande reste alors visiblement sans confirmation,
 * ce que l'administration signale, et le renvoi se fait d'un bouton.
 *
 * L'appel présente la clé de service : c'est ce qui prouve à
 * envoyer-confirmation qu'il vient d'ici et non d'un visiteur.
 */
async function declencherConfirmation(commandeId: string | null, numero: string | null) {
  if (!commandeId && !numero) return;
  try {
    const reponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/envoyer-confirmation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ commande_id: commandeId, numero }),
    });
    if (!reponse.ok) {
      console.error('stripe-webhook : confirmation refusée', reponse.status, await reponse.text());
    }
  } catch (err) {
    console.error('stripe-webhook : confirmation injoignable', err);
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Signature absente', { status: 400 });

  // Le corps doit être lu tel quel : reconstruit à partir du JSON analysé, il
  // ne correspondrait plus à la signature, octet pour octet.
  const corps = await req.text();

  let evenement: Stripe.Event;
  try {
    evenement = await stripe.webhooks.constructEventAsync(corps, signature, SIGNATURE_SECRET);
  } catch (err) {
    console.error('stripe-webhook : signature invalide', err);
    return new Response('Signature invalide', { status: 400 });
  }

  try {
    const session = evenement.data.object as Stripe.Checkout.Session;

    if (
      evenement.type === 'checkout.session.completed'
      || evenement.type === 'checkout.session.async_payment_succeeded'
    ) {
      // GARDE-FOU : la fin du parcours d'achat ne veut pas dire que l'argent
      // est arrivé. Carte, PayPal, Google Pay et Revolut Pay sont immédiats,
      // mais Stripe propose aussi des moyens différés (prélèvement SEPA,
      // virement) où la confirmation tombe des jours plus tard. Or ces moyens
      // s'activent d'une case à cocher dans le tableau de bord, sans passer
      // par ce code : sans cette vérification, l'atelier verrait « payée » une
      // commande qui ne l'est pas encore, et enverrait le colis.
      //
      // Pour un moyen différé, Stripe envoie plus tard
      // checkout.session.async_payment_succeeded, traité ici aussi. Il faut
      // alors penser à s'y abonner dans la destination d'évènements Stripe.
      if (session.payment_status !== 'paid') {
        console.log('Parcours terminé mais paiement non confirmé', session.metadata?.numero, session.payment_status);
        return new Response('ok', { status: 200 });
      }

      // L'identifiant de commande est transmis en second : si l'enregistrement
      // de la session n'a pas abouti côté base, il reste le moyen de retrouver
      // la commande et de ne pas laisser un paiement encaissé en attente.
      const { error } = await supabase.rpc('marquer_commande_payee', {
        p_session_id: session.id,
        p_commande_id: session.metadata?.commande_id ?? null,
      });
      if (error) throw error;
      console.log('Commande réglée', session.metadata?.numero);

      await declencherConfirmation(
        session.metadata?.commande_id ?? null,
        session.metadata?.numero ?? null,
      );
    }

    if (evenement.type === 'checkout.session.expired') {
      const commandeId = session.metadata?.commande_id;
      if (commandeId) {
        const { error } = await supabase.rpc('liberer_commande', {
          p_commande_id: commandeId,
          p_raison: 'expire',
        });
        if (error) throw error;
        console.log('Stock libéré pour', session.metadata?.numero);
      }
    }

    // Toujours répondre 200 sur un évènement traité : un autre code ferait
    // réessayer Stripe indéfiniment.
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('stripe-webhook', err);
    // Là au contraire, une erreur de notre côté doit provoquer une nouvelle
    // tentative de Stripe : la commande ne doit pas rester non réglée.
    return new Response('Erreur de traitement', { status: 500 });
  }
});
