-- =============================================================================
-- migration-2026-10-10-confirmation-commande.sql
-- =============================================================================
-- Prépare l'envoi automatique de la confirmation de commande.
--
-- La loi impose de confirmer le contrat au client « sur un support durable »,
-- au plus tard à la livraison. Un reçu de paiement Stripe ne suffit pas : il
-- confirme un paiement, pas un contrat, et ne porte ni le détail des pièces,
-- ni le délai, ni le droit de rétractation.
--
-- Deux changements :
--
--   1. Une trace de l'envoi sur chaque commande. Stripe réessaie un webhook
--      qui a échoué, et sans cette trace le client recevrait deux fois la même
--      confirmation. Elle sert aussi à repérer, dans l'administration, une
--      commande payée dont la confirmation n'est pas partie.
--
--   2. Brevo rejoint la liste des sous-traitants de la politique de
--      confidentialité. Un prestataire qui reçoit le nom, l'adresse e-mail et
--      le détail de la commande doit y être nommé, sinon la page est fausse.
--
-- À exécuter UNE FOIS, après migration-2026-10-09-options-vitrine-boutique.sql.
-- =============================================================================

-- --- 1. Trace de l'envoi de la confirmation ----------------------------------
-- Volontairement une date et non un booléen : savoir QUAND la confirmation est
-- partie est ce qui permet de répondre à un client qui dit ne rien avoir reçu.
alter table commandes
  add column if not exists confirmation_envoyee_at timestamptz;

-- Les commandes déjà payées avant la mise en place ne recevront pas de
-- confirmation rétroactive : les marquer comme envoyées serait un mensonge, et
-- les laisser vides ferait croire à un envoi en échec. On note donc ce qui
-- s'est réellement passé, dans les notes, et seules les commandes à venir
-- entrent dans le nouveau circuit.
update commandes
set notes = coalesce(notes || E'\n', '')
  || 'Commande antérieure à la confirmation automatique (10/10/2026) : aucun '
  || 'récapitulatif n''a été envoyé par le site.'
where paiement_statut = 'paye'
  and confirmation_envoyee_at is null
  and coalesce(notes, '') not like '%antérieure à la confirmation automatique%';

-- --- 2. Brevo dans la politique de confidentialité ---------------------------
-- Même raison que pour Stripe le 6 octobre : la page affirmait qu'aucune
-- donnée n'était transmise à personne alors que les paiements passaient déjà
-- par un tiers. On ne refait pas l'erreur dans l'autre sens, en branchant un
-- service d'envoi avant de l'avoir déclaré.
insert into contenu_site (cle, valeur) values

('confidentialite-lieu', $txt$**Supabase** héberge la base de données du site : les textes, les photos, les messages et les commandes. Les données sont stockées sur l'infrastructure Amazon Web Services située à Paris, en France.

**Netlify** héberge les pages du site.

**Stripe** traite les paiements en ligne. Il reçoit à ce titre votre nom, votre adresse e-mail et le montant de votre commande. Son entité européenne est établie en Irlande.

**Brevo** achemine les e-mails de confirmation de commande. Il reçoit à ce titre votre nom, votre adresse e-mail, votre adresse de livraison le cas échéant et le détail de votre commande. C'est une société française, établie à Paris.$txt$),

-- La date affichée en tête de la politique de confidentialité doit suivre son
-- contenu, comme pour les conditions de vente.
('confidentialite-maj', $txt$10 octobre 2026$txt$)

on conflict (cle) do update set valeur = excluded.valeur;

-- --- Vérification ------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'commandes' and column_name = 'confirmation_envoyee_at')  as colonne_confirmation,
  (select count(*) from contenu_site
    where cle = 'confidentialite-lieu' and valeur like '%Brevo%')                as brevo_declare,
  (select valeur from contenu_site where cle = 'confidentialite-maj')            as date_confidentialite,
  (select count(*) from commandes where paiement_statut = 'paye')                as commandes_payees,
  (select count(*) from commandes
    where notes like '%antérieure à la confirmation automatique%')               as commandes_annotees;
