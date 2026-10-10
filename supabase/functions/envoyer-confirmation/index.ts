// envoyer-confirmation — envoie au client le récapitulatif de sa commande, et
// prévient l'atelier.
//
// POURQUOI CET E-MAIL EXISTE. Le code de la consommation impose de confirmer le
// contrat au client « sur un support durable », au plus tard à la livraison. Un
// reçu de paiement Stripe ne suffit pas : il prouve qu'un paiement a eu lieu,
// pas ce qui a été acheté, ni sous quel délai, ni avec quel droit de
// rétractation. D'où ce récapitulatif, qui reprend tout ce que le client devait
// savoir avant d'acheter et qu'il doit pouvoir retrouver après.
//
// Il sert aussi à l'atelier : jusqu'ici, une commande payée n'alertait
// personne, il fallait penser à ouvrir l'administration pour la découvrir.
//
// QUI PEUT L'APPELER. Deux appelants seulement :
//   - stripe-webhook, qui présente la clé de service ;
//   - l'administration, dont le jeton doit appartenir à une adresse reconnue
//     par est_admin().
// La vérification de jeton de Supabase ne suffirait pas : la clé publique du
// site est, par construction, connue de tous les visiteurs. Sans le contrôle
// ci-dessous, n'importe qui pourrait faire envoyer des e-mails au nom de
// l'atelier.
//
// Déploiement : Supabase > Edge Functions > Deploy a new function > Via Editor,
// nommer la fonction « envoyer-confirmation » et coller ce fichier. Laisser la
// vérification de jeton activée.
//
// Secrets à renseigner dans Supabase > Edge Functions > Secrets :
//   BREVO_API_KEY      clé API de Brevo (jamais dans site/js/)
//   EXPEDITEUR_EMAIL   adresse d'envoi, sur un domaine authentifié chez Brevo
//   ATELIER_EMAIL      adresse qui reçoit l'avis de nouvelle commande
//   SITE_URL           adresse du site, sans barre oblique finale
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const EXPEDITEUR_EMAIL = Deno.env.get('EXPEDITEUR_EMAIL') ?? '';
const EXPEDITEUR_NOM = Deno.env.get('EXPEDITEUR_NOM') ?? "L'Atelier du Bout d'à Haut";
const ATELIER_EMAIL = Deno.env.get('ATELIER_EMAIL') ?? '';
const SITE = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '');
const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const admin = createClient(URL_SUPABASE, CLE_SERVICE);

// Textes repris de l'administration plutôt que recopiés ici : ils sont déjà
// affichés sur le site avant l'achat, et l'e-mail doit dire exactement la même
// chose. Deux versions d'un droit de rétractation, c'est une contradiction qui
// se retourne contre le vendeur.
const CLES_TEXTES = [
  'boutique-tva',
  'boutique-delai-expedition',
  'boutique-delai-retrait',
  'cgv-retractation',
  'cgv-formulaire',
  'cgv-vendeur',
];

// --- Couleurs du site -------------------------------------------------------
// Reprises de css/tokens.css. Écrites en dur et en style sur chaque balise :
// les messageries ignorent les feuilles de style et les variables CSS.
const C = {
  fond: '#F4EDDE',
  papier: '#FBF7EC',
  texte: '#1B2A41',
  attenue: 'rgba(27,42,65,.72)',
  pale: 'rgba(27,42,65,.5)',
  bord: 'rgba(27,42,65,.15)',
  doux: '#C0D4C9',
  profond: '#7FA6A2',
};

// --- Outils de rendu --------------------------------------------------------

function echapper(texte: string): string {
  return String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Même mise en forme que sur le site (voir js/lib/markdown-lite.js) : des
 * paragraphes séparés par une ligne vide, « ## » pour un sous-titre, deux
 * étoiles pour du gras. Porté ici parce qu'une fonction serveur n'a pas de
 * document HTML à sa disposition pour échapper le texte.
 */
function enligne(texte: string): string {
  return echapper(texte)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function rendreTexte(texte: string): string {
  if (!texte) return '';
  return texte
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((bloc) => {
      const ligne = bloc.trim();
      if (ligne.startsWith('## ')) {
        return `<p style="margin:18px 0 8px;font-size:15px;font-weight:600;color:${C.texte}">${enligne(ligne.slice(3))}</p>`;
      }
      return `<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:${C.attenue}">${enligne(ligne).replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

/** La même chose en texte brut, pour les messageries qui refusent le HTML. */
function aplatir(texte: string): string {
  if (!texte) return '';
  return texte
    .replace(/\r\n?/g, '\n')
    .replace(/^## (.*)$/gm, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .trim();
}

const prix = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents ?? 0) / 100);

const jour = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(iso));

/** Prénom seul, pour s'adresser au client sans le vouvoyer par son nom entier. */
function prenom(nomComplet: string): string {
  return (nomComplet ?? '').trim().split(/\s+/)[0] || '';
}

// --- Autorisation -----------------------------------------------------------

type Appelant = 'webhook' | 'administration';

/**
 * Renvoie qui appelle, ou null si l'appel doit être refusé.
 *
 * La clé de service identifie un appel interne. Pour tout le reste, on
 * interroge la base avec le jeton reçu : est_admin() ne répond vrai que si
 * l'adresse portée par ce jeton figure dans la liste des administrateurs.
 * C'est la base qui tranche, pas cette fonction, et la règle reste donc à un
 * seul endroit.
 */
async function autoriser(req: Request): Promise<Appelant | null> {
  const entete = req.headers.get('authorization') ?? '';
  const jeton = entete.replace(/^Bearer\s+/i, '').trim();
  if (!jeton) return null;
  if (CLE_SERVICE && jeton === CLE_SERVICE) return 'webhook';

  const client = createClient(URL_SUPABASE, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  });
  const { data, error } = await client.rpc('est_admin');
  if (error) {
    console.error('envoyer-confirmation : est_admin', error);
    return null;
  }
  return data === true ? 'administration' : null;
}

// --- Lecture de la commande -------------------------------------------------

const COLONNES_COMMANDE = 'id, numero, created_at, client_nom, client_email, mode_retrait, '
  + 'adresse_livraison, sous_total_cents, livraison_cents, total_cents, paiement_statut, '
  + 'confirmation_envoyee_at';

async function chargerCommande(commandeId: string | null, numero: string | null) {
  // Deux chemins d'accès plutôt qu'un filtre construit au vol : l'appel interne
  // connaît l'identifiant, le renvoi manuel peut n'avoir que le numéro.
  const depart = () => admin.from('commandes').select(COLONNES_COMMANDE);
  const { data: commande, error } = commandeId
    ? await depart().eq('id', commandeId).maybeSingle()
    : await depart().eq('numero', numero ?? '').maybeSingle();
  if (error) throw error;
  if (!commande) return null;

  const { data: lignes, error: erreurLignes } = await admin
    .from('lignes_commande')
    .select('titre_produit, prix_unitaire_cents, quantite')
    .eq('commande_id', commande.id);
  if (erreurLignes) throw erreurLignes;

  return { commande, lignes: lignes ?? [] };
}

async function chargerTextes(): Promise<Record<string, string>> {
  const { data, error } = await admin
    .from('contenu_site')
    .select('cle, valeur')
    .in('cle', CLES_TEXTES);
  if (error) throw error;
  const textes: Record<string, string> = {};
  for (const { cle, valeur } of data ?? []) textes[cle] = valeur ?? '';
  return textes;
}

// --- Composition de l'e-mail au client --------------------------------------

function titreSection(libelle: string): string {
  return `<p style="margin:28px 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.pale}">${echapper(libelle)}</p>`;
}

function emailClient(commande: any, lignes: any[], textes: Record<string, string>) {
  const retrait = commande.mode_retrait === 'retrait_showroom';
  const delai = retrait ? textes['boutique-delai-retrait'] : textes['boutique-delai-expedition'];

  const rangees = lignes.map((l) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${C.bord};font-size:14px;color:${C.texte}">
        ${echapper(l.titre_produit)}
        <span style="color:${C.pale}">&times;&nbsp;${l.quantite}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid ${C.bord};font-size:14px;color:${C.texte};text-align:right;white-space:nowrap">
        ${prix(l.prix_unitaire_cents * l.quantite)}
      </td>
    </tr>`).join('');

  const ligneTotal = (libelle: string, valeur: string, fort = false) => `
    <tr>
      <td style="padding:${fort ? '12px 0 0' : '6px 0 0'};font-size:${fort ? '16px' : '14px'};color:${fort ? C.texte : C.attenue};${fort ? 'font-weight:600' : ''}">${libelle}</td>
      <td style="padding:${fort ? '12px 0 0' : '6px 0 0'};font-size:${fort ? '16px' : '14px'};color:${fort ? C.texte : C.attenue};text-align:right;white-space:nowrap;${fort ? 'font-weight:600' : ''}">${valeur}</td>
    </tr>`;

  const recuperation = retrait
    ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:${C.attenue}">Retrait au showroom de Rambouillet, sans frais.</p>`
    : `<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:${C.attenue}">Livraison à l'adresse suivante&nbsp;:<br>${echapper(commande.adresse_livraison ?? '').replace(/\n/g, '<br>')}</p>`;

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Votre commande ${echapper(commande.numero)}</title></head>
<body style="margin:0;padding:0;background:${C.fond}">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px 48px;background:${C.papier};font-family:Helvetica,Arial,sans-serif">

    <p style="margin:0 0 24px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${C.profond}">L'Atelier du Bout d'à Haut</p>

    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:${C.texte};font-weight:600">Votre commande est confirmée</h1>

    <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:${C.attenue}">
      Bonjour ${echapper(prenom(commande.client_nom))}, merci pour votre commande et pour votre confiance.
    </p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:${C.attenue}">
      <strong>Conservez cet e-mail</strong>&nbsp;: il récapitule votre achat et vaut confirmation de votre commande.
    </p>

    <div style="margin:24px 0;padding:14px 16px;background:${C.doux};font-size:14px;color:${C.texte}">
      Commande n°&nbsp;<strong>${echapper(commande.numero)}</strong> du ${jour(commande.created_at)}
    </div>

    ${titreSection('Votre commande')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${rangees}
      ${ligneTotal('Sous-total', prix(commande.sous_total_cents))}
      ${ligneTotal(retrait ? 'Retrait au showroom' : 'Livraison', commande.livraison_cents > 0 ? prix(commande.livraison_cents) : 'Gratuit')}
      ${ligneTotal('Total payé', prix(commande.total_cents), true)}
    </table>
    <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:${C.pale}">${echapper(textes['boutique-tva'] ?? '')}</p>

    ${titreSection('Récupération')}
    ${recuperation}
    ${delai ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:${C.attenue}">${enligne(delai)}</p>` : ''}

    ${titreSection('Droit de rétractation')}
    ${rendreTexte(textes['cgv-retractation'] ?? '')}

    <div style="margin:18px 0;padding:16px;border:1px solid ${C.bord};background:${C.fond}">
      ${rendreTexte(textes['cgv-formulaire'] ?? '')}
    </div>

    ${titreSection('Garanties légales')}
    <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:${C.attenue}">
      Vous bénéficiez de la garantie légale de conformité pendant deux ans à compter de la livraison,
      et de la garantie des vices cachés pendant deux ans à compter de la découverte du défaut.
      Le détail figure dans l'encadré officiel de nos
      <a href="${SITE}/cgu-cgv.html#cgv" style="color:${C.profond}">conditions générales de vente</a>.
    </p>

    ${titreSection('Votre vendeur')}
    ${rendreTexte(textes['cgv-vendeur'] ?? '')}

    <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid ${C.bord};font-size:12px;line-height:1.7;color:${C.pale}">
      Cet e-mail vous est envoyé parce que vous avez passé commande sur
      <a href="${SITE}" style="color:${C.profond}">notre boutique en ligne</a>.
      Pour toute question, répondez simplement à ce message.
    </p>
  </div>
</body></html>`;

  const texte = [
    "L'ATELIER DU BOUT D'À HAUT",
    '',
    'VOTRE COMMANDE EST CONFIRMÉE',
    '',
    `Bonjour ${prenom(commande.client_nom)}, merci pour votre commande et pour votre confiance.`,
    'Conservez cet e-mail : il récapitule votre achat et vaut confirmation de votre commande.',
    '',
    `Commande n° ${commande.numero} du ${jour(commande.created_at)}`,
    '',
    'VOTRE COMMANDE',
    ...lignes.map((l) => `- ${l.titre_produit} x ${l.quantite} : ${prix(l.prix_unitaire_cents * l.quantite)}`),
    `Sous-total : ${prix(commande.sous_total_cents)}`,
    `${retrait ? 'Retrait au showroom' : 'Livraison'} : ${commande.livraison_cents > 0 ? prix(commande.livraison_cents) : 'Gratuit'}`,
    `Total payé : ${prix(commande.total_cents)}`,
    aplatir(textes['boutique-tva'] ?? ''),
    '',
    'RÉCUPÉRATION',
    retrait
      ? 'Retrait au showroom de Rambouillet, sans frais.'
      : `Livraison à l'adresse suivante :\n${commande.adresse_livraison ?? ''}`,
    aplatir(delai ?? ''),
    '',
    'DROIT DE RÉTRACTATION',
    aplatir(textes['cgv-retractation'] ?? ''),
    '',
    aplatir(textes['cgv-formulaire'] ?? ''),
    '',
    'GARANTIES LÉGALES',
    'Vous bénéficiez de la garantie légale de conformité pendant deux ans à compter de la livraison, '
      + 'et de la garantie des vices cachés pendant deux ans à compter de la découverte du défaut. '
      + `Le détail figure dans l'encadré officiel de nos conditions générales de vente : ${SITE}/cgu-cgv.html#cgv`,
    '',
    'VOTRE VENDEUR',
    aplatir(textes['cgv-vendeur'] ?? ''),
    '',
    `Pour toute question, répondez simplement à ce message. ${SITE}`,
  ].join('\n');

  return { sujet: `Votre commande ${commande.numero} est confirmée`, html, texte };
}

// --- Composition de l'avis à l'atelier --------------------------------------

function emailAtelier(commande: any, lignes: any[]) {
  const retrait = commande.mode_retrait === 'retrait_showroom';
  const details = lignes
    .map((l) => `${echapper(l.titre_produit)} &times;&nbsp;${l.quantite}`)
    .join('<br>');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Nouvelle commande ${echapper(commande.numero)}</title></head>
<body style="margin:0;padding:0;background:${C.fond}">
  <div style="max-width:560px;margin:0 auto;padding:28px 24px 36px;background:${C.papier};font-family:Helvetica,Arial,sans-serif">
    <h1 style="margin:0 0 16px;font-size:20px;color:${C.texte};font-weight:600">Nouvelle commande payée</h1>
    <p style="margin:0 0 6px;font-size:14px;color:${C.texte}">
      <strong>${echapper(commande.numero)}</strong> &middot; ${prix(commande.total_cents)} &middot;
      ${retrait ? 'retrait au showroom' : 'livraison à domicile'}
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${C.attenue}">
      ${echapper(commande.client_nom)}<br>
      ${echapper(commande.client_email)}
      ${commande.adresse_livraison ? '<br>' + echapper(commande.adresse_livraison).replace(/\n/g, '<br>') : ''}
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:${C.texte}">${details}</p>
    <p style="margin:0;font-size:14px">
      <a href="${SITE}/admin/commandes.html" style="color:${C.profond}">Ouvrir la commande dans l'administration</a>
    </p>
    <p style="margin:24px 0 0;padding-top:14px;border-top:1px solid ${C.bord};font-size:12px;color:${C.pale}">
      Le client a reçu son récapitulatif de commande.
    </p>
  </div>
</body></html>`;

  const texte = [
    'NOUVELLE COMMANDE PAYÉE',
    '',
    `${commande.numero} · ${prix(commande.total_cents)} · ${retrait ? 'retrait au showroom' : 'livraison à domicile'}`,
    commande.client_nom,
    commande.client_email,
    commande.adresse_livraison ?? '',
    '',
    ...lignes.map((l) => `- ${l.titre_produit} x ${l.quantite}`),
    '',
    `Administration : ${SITE}/admin/commandes.html`,
    'Le client a reçu son récapitulatif de commande.',
  ].join('\n');

  return {
    sujet: `Nouvelle commande ${commande.numero} (${prix(commande.total_cents)})`,
    html,
    texte,
  };
}

// --- Envoi ------------------------------------------------------------------

async function envoyer(destinataire: { email: string; nom?: string }, message: { sujet: string; html: string; texte: string }, repondreA?: string) {
  // Nommé « appel » et non « reponse » : ce fichier a déjà une fonction
  // reponse() pour répondre à l'appelant, et deux sens pour un même mot dans
  // un fichier est un piège qu'on finit par y tomber.
  const appel = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: EXPEDITEUR_NOM, email: EXPEDITEUR_EMAIL },
      to: [{ email: destinataire.email, name: destinataire.nom }],
      // L'adresse d'envoi est sur le domaine de l'atelier, mais c'est la boîte
      // qu'il consulte vraiment qui doit recevoir les réponses.
      ...(repondreA ? { replyTo: { email: repondreA } } : {}),
      subject: message.sujet,
      htmlContent: message.html,
      textContent: message.texte,
      tags: ['confirmation-commande'],
    }),
  });

  if (!appel.ok) {
    const detail = await appel.text();
    throw new Error(`Brevo ${appel.status} : ${detail.slice(0, 300)}`);
  }
  const corps = await appel.json().catch(() => ({})) as { messageId?: string };
  return corps.messageId ?? null;
}

// --- Entrée -----------------------------------------------------------------

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
    headers: { ...cors(req), 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return reponse(req, { erreur: 'Méthode non autorisée' }, 405);

  if (!BREVO_API_KEY || !EXPEDITEUR_EMAIL) {
    console.error('envoyer-confirmation : BREVO_API_KEY ou EXPEDITEUR_EMAIL manquant');
    return reponse(req, { erreur: 'Service d\'envoi non configuré' }, 500);
  }

  const appelant = await autoriser(req);
  if (!appelant) return reponse(req, { erreur: 'Non autorisé' }, 401);

  try {
    const corps = await req.json().catch(() => ({})) as {
      commande_id?: string;
      numero?: string;
      forcer?: boolean;
    };
    const commandeId = corps.commande_id ?? null;
    const numero = corps.numero ?? null;
    const forcer = corps.forcer === true;
    if (!commandeId && !numero) return reponse(req, { erreur: 'Commande non précisée' }, 400);

    const trouve = await chargerCommande(commandeId, numero);
    if (!trouve) return reponse(req, { erreur: 'Commande introuvable' }, 404);
    const { commande, lignes } = trouve;

    // On ne confirme que ce qui est réellement payé. Une commande en attente
    // recevrait sinon une confirmation d'achat sans qu'un euro soit arrivé.
    if (commande.paiement_statut !== 'paye') {
      return reponse(req, { erreur: 'Commande non réglée', paiement_statut: commande.paiement_statut }, 409);
    }

    // Idempotence. Stripe réessaie un webhook qui a échoué, et deux
    // confirmations pour un même achat inquiètent le client autant qu'une
    // absence de confirmation. Le renvoi manuel depuis l'administration passe
    // outre, c'est tout son intérêt.
    if (commande.confirmation_envoyee_at && !forcer) {
      return reponse(req, {
        deja_envoyee: true,
        envoyee_le: commande.confirmation_envoyee_at,
      });
    }

    const textes = await chargerTextes();

    const messageId = await envoyer(
      { email: commande.client_email, nom: commande.client_nom },
      emailClient(commande, lignes, textes),
      ATELIER_EMAIL || undefined,
    );

    // La date n'est posée qu'après un envoi réussi : en cas d'échec, la
    // commande reste visiblement sans confirmation, ce que l'administration
    // signale, plutôt que de laisser croire à un envoi qui n'a pas eu lieu.
    const { error } = await admin
      .from('commandes')
      .update({ confirmation_envoyee_at: new Date().toISOString() })
      .eq('id', commande.id);
    if (error) console.error('envoyer-confirmation : horodatage', error);

    // L'avis à l'atelier passe en second et son échec n'est pas bloquant : le
    // client, lui, a bien reçu sa confirmation, et la commande reste visible
    // dans l'administration de toute façon.
    if (ATELIER_EMAIL) {
      try {
        await envoyer({ email: ATELIER_EMAIL }, emailAtelier(commande, lignes));
      } catch (err) {
        console.error("envoyer-confirmation : avis à l'atelier", err);
      }
    }

    console.log('Confirmation envoyée', commande.numero, 'par', appelant);
    return reponse(req, { envoyee: true, numero: commande.numero, message_id: messageId });
  } catch (err) {
    console.error('envoyer-confirmation', err);
    return reponse(req, { erreur: String((err as Error)?.message ?? err) }, 502);
  }
});
