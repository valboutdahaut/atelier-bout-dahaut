-- =============================================================================
-- migration-2026-09-21-statuts-commandes.sql
-- =============================================================================
-- Trois changements sur le suivi des commandes :
--
--   1. « Retirée » devient « Livrée ».
--   2. Annuler une commande depuis l'administration peut remettre les pièces
--      en vente. Jusqu'ici, changer le statut ne faisait que changer une
--      étiquette : une commande payée puis annulée laissait sa pièce invisible
--      dans la boutique, pour toujours.
--   3. Un indicateur dit si les pièces d'une commande sont déjà reparties en
--      vente, pour qu'elles ne puissent pas l'être deux fois.
--
-- À exécuter UNE FOIS, après migration-2026-09-19-paiement.sql.
-- =============================================================================

-- --- 1. « Retirée » devient « Livrée » ---------------------------------------
-- L'ordre compte : la contrainte doit tomber avant que les lignes existantes ne
-- puissent changer de valeur.
alter table commandes drop constraint if exists commandes_statut_check;
update commandes set statut = 'livree' where statut = 'retiree';
alter table commandes
  add constraint commandes_statut_check
  check (statut in ('nouvelle', 'en_preparation', 'expediee', 'livree', 'annulee'));

-- --- 2. Les pièces sont-elles déjà reparties en vente ? ----------------------
-- Sans cette mémoire, une annulation enregistrée deux fois crediterait le stock
-- deux fois, et la boutique afficherait des pièces qui n'existent pas.
alter table commandes
  add column if not exists stock_rendu boolean not null default false;

-- Les commandes déjà libérées par Stripe ou par le client l'ont été avant
-- l'existence de cette colonne : on rattrape leur état.
update commandes
set stock_rendu = true
where paiement_statut in ('expire', 'annule_client') and stock_rendu = false;

-- --- 3. Libération automatique : elle marque désormais le passage -----------
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
  -- client peut lui-même annuler juste avant l'expiration.
  if v_statut <> 'en_attente' then
    return false;
  end if;

  update produits p
  set stock = p.stock + l.quantite, updated_at = now()
  from lignes_commande l
  where l.commande_id = p_commande_id and l.produit_id = p.id;

  update commandes
  set statut = 'annulee', paiement_statut = p_raison, stock_rendu = true
  where id = p_commande_id;

  return true;
end;
$fn$;

revoke execute on function liberer_commande(uuid, text) from public, anon, authenticated;

-- --- 4. Changement de statut depuis l'administration -------------------------
-- Passe par une fonction plutôt que par une mise à jour directe de la table :
-- changer le statut peut devoir toucher au stock, et cette décision ne doit pas
-- dépendre de ce que le navigateur veut bien envoyer.
create or replace function changer_statut_commande(
  p_commande_id uuid,
  p_statut text,
  p_remettre_en_vente boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ancien text;
  v_rendu boolean;
  v_manquant text;
begin
  if not est_admin() then
    raise exception 'Réservé à l''administration';
  end if;
  if p_statut not in ('nouvelle', 'en_preparation', 'expediee', 'livree', 'annulee') then
    raise exception 'Statut inconnu : %', p_statut;
  end if;

  select statut, stock_rendu into v_ancien, v_rendu
  from commandes where id = p_commande_id for update;
  if not found then
    raise exception 'Commande introuvable';
  end if;

  -- Annulation. C'est le seul moment où les pièces peuvent repartir en vente,
  -- et le choix revient à l'atelier : une cliente qui se rétracte rend un
  -- fauteuil vendable, une pièce abîmée pendant l'emballage ne l'est pas.
  if p_statut = 'annulee' and p_remettre_en_vente and not v_rendu then
    update produits p
    set stock = p.stock + l.quantite, updated_at = now()
    from lignes_commande l
    where l.commande_id = p_commande_id and l.produit_id = p.id;
    v_rendu := true;
  end if;

  -- Retour en arrière sur une annulation. La commande redevient à préparer
  -- alors que ses pièces sont déjà reparties en vente : il faut les reprendre,
  -- sinon la boutique promet un stock qu'elle n'a plus. Si une pièce a été
  -- revendue entre-temps, on refuse plutôt que de fausser le stock en silence.
  if v_ancien = 'annulee' and p_statut <> 'annulee' and v_rendu then
    select string_agg(p.titre, ', ') into v_manquant
    from lignes_commande l
    join produits p on p.id = l.produit_id
    where l.commande_id = p_commande_id and p.stock < l.quantite;

    if v_manquant is not null then
      raise exception 'Plus assez de stock pour réactiver cette commande : %', v_manquant;
    end if;

    update produits p
    set stock = p.stock - l.quantite, updated_at = now()
    from lignes_commande l
    where l.commande_id = p_commande_id and l.produit_id = p.id;
    v_rendu := false;
  end if;

  update commandes set statut = p_statut, stock_rendu = v_rendu where id = p_commande_id;

  return jsonb_build_object('statut', p_statut, 'stock_rendu', v_rendu);
end;
$fn$;

revoke execute on function changer_statut_commande(uuid, text, boolean) from public, anon;
grant execute on function changer_statut_commande(uuid, text, boolean) to authenticated;

-- --- Vérification ------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'commandes' and column_name = 'stock_rendu')        as colonne_stock_rendu,
  (select count(*) from pg_proc where proname = 'changer_statut_commande') as fn_changer_statut,
  (select count(*) from commandes where statut = 'retiree')                as reste_des_retirees,
  (select string_agg(distinct statut, ', ') from commandes)                as statuts_en_base;
