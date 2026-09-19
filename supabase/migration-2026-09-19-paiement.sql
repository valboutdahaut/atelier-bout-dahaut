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
-- jeton_client : chaîne imprévisible propre à chaque commande. Elle voyage
-- dans l'adresse de retour depuis Stripe et sert de preuve d'achat au visiteur,
-- qui n'est pas connecté et n'a donc aucun autre moyen de prouver que cette
-- commande est la sienne. Deux identifiants concaténés font 64 caractères
-- hexadécimaux, indevinables, sans dépendre d'une extension Postgres.
alter table commandes
  add column if not exists paiement_statut text not null default 'en_attente',
  add column if not exists stripe_session_id text,
  add column if not exists paye_le timestamptz,
  add column if not exists jeton_client text not null
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

alter table commandes drop constraint if exists commandes_paiement_statut_check;
alter table commandes
  add constraint commandes_paiement_statut_check
  check (paiement_statut in ('en_attente', 'paye', 'expire', 'echoue', 'annule_client', 'non_requis'));

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

  -- Idempotence : Stripe peut envoyer deux fois le même évènement, et le
  -- client peut lui-même annuler juste avant l'expiration. Sans ce garde-fou,
  -- le stock serait recrédité deux fois et deviendrait faux.
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
-- Deux façons de retrouver la commande. Normalement par l'identifiant de
-- session, enregistré juste après sa création chez Stripe. Mais un paiement
-- immédiat peut être signalé avant que cet enregistrement n'ait abouti : on
-- retombe alors sur l'identifiant de commande, que Stripe nous renvoie dans
-- les métadonnées de la session. Sans ce second chemin, un paiement encaissé
-- pourrait rester marqué en attente.
--
-- La version à un seul paramètre est supprimée d'abord : « create or replace »
-- ne remplace qu'une fonction de même signature, sinon les deux coexisteraient
-- et un appel à un argument deviendrait ambigu.
drop function if exists marquer_commande_payee(text);

create or replace function marquer_commande_payee(p_session_id text, p_commande_id uuid default null)
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

  if not found and p_commande_id is not null then
    select id, paiement_statut into v_id, v_statut
    from commandes where id = p_commande_id for update;
    if found then
      update commandes set stripe_session_id = p_session_id where id = v_id;
    end if;
  end if;

  if v_id is null then
    return false;
  end if;
  -- Idempotence, même raison que ci-dessus.
  if v_statut = 'paye' then
    return true;
  end if;

  -- Cas rare mais possible : le client a annulé dans un onglet, ce qui a remis
  -- les pièces en vente, puis a payé depuis un autre onglet resté ouvert sur
  -- la page Stripe. L'argent est arrivé, la commande redevient donc active,
  -- mais le stock a déjà été recrédité et la pièce a pu être revendue. On ne
  -- touche pas au stock : on laisse une note pour que l'atelier vérifie.
  if v_statut <> 'en_attente' then
    update commandes
    set notes = coalesce(notes || E'\n', '')
      || 'À VÉRIFIER : paiement reçu après libération du stock (' || v_statut || '). '
      || 'Confirmer que la pièce est toujours disponible avant de préparer.',
      statut = 'nouvelle'
    where id = v_id;
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
revoke execute on function marquer_commande_payee(text, uuid) from public, anon, authenticated;

-- --- 4. Ce que le visiteur a le droit de savoir ------------------------------
-- Au retour de Stripe, la page de confirmation doit dire si le paiement a
-- abouti. Le visiteur n'est pas connecté et aucune policy ne lui ouvre la table
-- commandes, à juste titre : elle contient les coordonnées de tout le monde.
--
-- Ces deux fonctions lui donnent le strict nécessaire, et seulement s'il
-- présente le couple numéro + jeton. Le jeton n'est connu que de lui, il a
-- voyagé dans l'adresse de retour construite par le serveur. Aucune donnée
-- personnelle n'est renvoyée : ni nom, ni adresse, ni téléphone.
create or replace function statut_commande(p_numero text, p_jeton text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $fn$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'numero', numero,
    'total_cents', total_cents,
    'mode_retrait', mode_retrait,
    'paiement_statut', paiement_statut
  ) into v
  from commandes
  where numero = p_numero and jeton_client = p_jeton;

  -- Renvoyer null plutôt qu'une erreur : un jeton faux et un numéro inexistant
  -- donnent la même réponse, rien n'est révélé par la différence.
  return v;
end;
$fn$;

-- Annulation à l'initiative du client : il a cliqué sur retour depuis la page
-- Stripe. Sans cela, sa commande garderait la pièce réservée pendant une heure
-- et il ne pourrait même pas la recommander lui-même, le stock étant à zéro.
create or replace function annuler_paiement_client(p_numero text, p_jeton text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  select id into v_id from commandes
  where numero = p_numero and jeton_client = p_jeton and paiement_statut = 'en_attente';
  if not found then
    return false;
  end if;
  return liberer_commande(v_id, 'annule_client');
end;
$fn$;

grant execute on function statut_commande(text, text) to anon, authenticated;
grant execute on function annuler_paiement_client(text, text) to anon, authenticated;

-- --- 5. Filet de sécurité ----------------------------------------------------
-- Normalement, Stripe prévient lui-même de l'expiration d'une session et le
-- stock repart en vente. Mais si le webhook est mal réglé, arrêté, ou que
-- Stripe n'arrive pas à joindre le serveur, une commande jamais payée garderait
-- la pièce réservée pour toujours. Cette purge repasse derrière : au-delà de
-- deux heures d'attente, largement plus que l'heure de validité d'une session
-- de paiement, la commande est libérée.
create or replace function purger_commandes_abandonnees()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_total integer := 0;
begin
  for v_id in
    select id from commandes
    where paiement_statut = 'en_attente'
      and created_at < now() - interval '2 hours'
  loop
    if liberer_commande(v_id, 'expire') then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$fn$;

revoke execute on function purger_commandes_abandonnees() from public, anon;
grant execute on function purger_commandes_abandonnees() to authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('purge-commandes-abandonnees');
exception when others then
  null; -- extension absente, ou tâche pas encore créée : sans conséquence
end $$;

do $$
begin
  perform cron.schedule('purge-commandes-abandonnees', '17 * * * *',
                        'select purger_commandes_abandonnees();');
  raise notice 'Purge des commandes abandonnées planifiée chaque heure.';
exception when others then
  raise notice 'pg_cron indisponible : seul Stripe libérera le stock. (%)', sqlerrm;
end $$;

-- --- Vérification ------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'commandes'
      and column_name in ('paiement_statut', 'stripe_session_id', 'paye_le', 'jeton_client')) as colonnes_4,
  (select count(*) from pg_proc where proname = 'liberer_commande')          as fn_liberer,
  (select count(*) from pg_proc where proname = 'marquer_commande_payee')    as fn_payee,
  (select count(*) from pg_proc where proname = 'statut_commande')           as fn_statut,
  (select count(*) from pg_proc where proname = 'annuler_paiement_client')   as fn_annuler,
  (select count(*) from pg_proc where proname = 'purger_commandes_abandonnees') as fn_purge,
  (select count(*) from pg_proc where proname = 'creer_commande')            as fn_commande;
