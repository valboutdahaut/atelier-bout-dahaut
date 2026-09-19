-- =============================================================================
-- migration-2026-09-19-paiement.sql
-- =============================================================================
-- Prépare la base au paiement en ligne par Stripe.
--
-- Principe : le montant n'est JAMAIS envoyé par le navigateur. La commande est
-- d'abord enregistrée par creer_commande(), qui relit les vrais prix en base ;
-- la fonction serveur de paiement retrouve ensuite cette commande par son
-- numéro et facture son total_cents. Un visiteur qui trafique la page ne peut
-- donc pas changer ce qu'il paie.
--
-- creer_commande() n'est pas modifiée : elle renvoie déjà le numéro, qui suffit.
--
-- À exécuter UNE FOIS sur le projet de Paris, APRÈS functions.sql.
-- =============================================================================

-- --- 1. Suivi du paiement ----------------------------------------------------
alter table commandes
  add column if not exists paiement_statut text not null default 'en_attente',
  add column if not exists stripe_session_id text,
  add column if not exists paye_le timestamptz;

alter table commandes drop constraint if exists commandes_paiement_statut_check;
alter table commandes
  add constraint commandes_paiement_statut_check
  check (paiement_statut in ('en_attente', 'paye', 'expire', 'echoue', 'non_requis'));

create index if not exists idx_commandes_session on commandes (stripe_session_id);

-- --- 2. Libération du stock --------------------------------------------------
-- creer_commande() retire le stock dès l'enregistrement, pour éviter que deux
-- clients n'achètent la même pièce unique pendant qu'ils paient. Contrepartie
-- indispensable : si le paiement n'aboutit pas, il faut remettre les pièces en
-- vente. Sans cette fonction, un panier abandonné immobiliserait un fauteuil
-- pour toujours.
create or replace function liberer_commande(p_commande_id uuid, p_raison text default 'expire')
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_statut text;
begin
  select paiement_statut into v_statut from commandes where id = p_commande_id for update;
  if not found then
    return false;
  end if;

  -- Idempotence : Stripe peut envoyer deux fois le même évènement. Sans ce
  -- garde-fou, le stock serait recrédité deux fois et deviendrait faux.
  if v_statut <> 'en_attente' then
    return false;
  end if;

  update produits p
  set stock = p.stock + l.quantite, updated_at = now()
  from lignes_commande l
  where l.commande_id = p_commande_id and l.produit_id = p.id;

  update commandes
  set statut = 'annulee', paiement_statut = p_raison
  where id = p_commande_id;

  return true;
end;
$fn$;

-- --- 3. Encaissement ---------------------------------------------------------
create or replace function marquer_commande_payee(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_statut text;
begin
  select id, paiement_statut into v_id, v_statut
  from commandes where stripe_session_id = p_session_id for update;
  if not found then
    return false;
  end if;
  -- Idempotence, même raison que ci-dessus.
  if v_statut = 'paye' then
    return true;
  end if;

  update commandes
  set paiement_statut = 'paye', paye_le = now()
  where id = v_id;

  return true;
end;
$fn$;

-- Ces deux fonctions ne sont appelées que par les fonctions serveur, qui
-- s'authentifient avec la clé de service. Aucun visiteur ne doit pouvoir
-- libérer un stock ou déclarer une commande payée.
revoke execute on function liberer_commande(uuid, text) from public, anon, authenticated;
revoke execute on function marquer_commande_payee(text) from public, anon, authenticated;

-- --- Vérification ------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'commandes'
      and column_name in ('paiement_statut', 'stripe_session_id', 'paye_le')) as colonnes,
  (select count(*) from pg_proc where proname = 'liberer_commande')           as fn_liberer,
  (select count(*) from pg_proc where proname = 'marquer_commande_payee')     as fn_payee,
  (select count(*) from pg_proc where proname = 'creer_commande')             as fn_commande;
