-- =============================================================================
-- migration-2026-10-11-avoirs.sql
-- =============================================================================
-- Permet d'émettre un avoir sur une commande facturée.
--
-- POURQUOI. Une facture émise ne se supprime pas et ne se modifie pas. Quand une
-- vente est annulée ou qu'une cliente se rétracte, on émet un second document
-- qui annule le premier : l'avoir. C'était la limite laissée ouverte en posant
-- la facturation ce matin.
--
-- CE QUI EST COUVERT. L'avoir TOTAL, qui annule l'intégralité d'une facture.
-- C'est le cas réel dans une boutique de cette taille : une cliente se
-- rétracte, on rembourse tout. L'avoir partiel, où l'on ne reprend qu'une ligne
-- sur trois, demande de choisir ce qu'on reprend, de recalculer, et de trancher
-- le sort des frais de livraison. Il viendra si le besoin se présente.
--
-- CE QUI N'EST PAS COUVERT. Le remboursement lui-même, qui reste à faire dans
-- Stripe. Donner à l'administration le pouvoir de sortir de l'argent du compte
-- bancaire est une décision à part, qui mérite sa propre réflexion.
--
-- SÉRIE DISTINCTE. Les avoirs ont leur propre compteur, continu lui aussi. Les
-- mélanger à la série des factures rendrait illisible l'une comme l'autre.
--
-- À exécuter UNE FOIS, après migration-2026-10-11-factures.sql.
-- =============================================================================

-- --- 1. Le compteur et les colonnes ------------------------------------------
create sequence if not exists avoirs_numero_seq;

alter table commandes
  add column if not exists avoir_numero text unique,
  add column if not exists avoir_emis_le timestamptz,
  add column if not exists avoir_motif text;

-- --- 2. Émettre un avoir -----------------------------------------------------
-- Réservée à l'administration : c'est un acte comptable, pas une action de
-- visiteur. Idempotente, comme l'attribution d'un numéro de facture : rappelée
-- sur une commande déjà avoirée, elle rend le même numéro.
create or replace function emettre_avoir(p_commande_id uuid, p_motif text default null)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_facture text;
  v_avoir text;
begin
  if not est_admin() then
    raise exception 'Réservé à l''administration';
  end if;

  select facture_numero, avoir_numero into v_facture, v_avoir
  from commandes where id = p_commande_id for update;

  if not found then
    raise exception 'Commande introuvable';
  end if;

  -- Déjà avoirée : on rend le même numéro, jamais un second.
  if v_avoir is not null then
    return v_avoir;
  end if;

  -- Pas d'avoir sans facture : un avoir annule un document qui doit exister.
  if v_facture is null then
    raise exception 'Cette commande n''a pas de facture à annuler';
  end if;

  v_avoir := 'AV-' || to_char(now(), 'YYYY') || '-'
           || lpad(nextval('avoirs_numero_seq')::text, 4, '0');

  update commandes
  set avoir_numero = v_avoir,
      avoir_emis_le = now(),
      avoir_motif = nullif(trim(coalesce(p_motif, '')), '')
  where id = p_commande_id;

  return v_avoir;
end;
$fn$;

revoke execute on function emettre_avoir(uuid, text) from public, anon;
grant execute on function emettre_avoir(uuid, text) to authenticated;

-- --- 3. La lecture par jeton rend aussi l'avoir ------------------------------
-- Même fonction qu'avant, enrichie : la page imprimable sert les deux
-- documents, et le client doit pouvoir consulter l'avoir comme sa facture.
create or replace function facture_commande(p_numero text, p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_commande commandes%rowtype;
  v_lignes jsonb;
begin
  select * into v_commande
  from commandes
  where numero = p_numero and jeton_client = p_jeton;

  if not found or v_commande.facture_numero is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'titre', titre_produit,
           'quantite', quantite,
           'prix_unitaire_cents', prix_unitaire_cents
         ) order by titre_produit), '[]'::jsonb)
  into v_lignes
  from lignes_commande where commande_id = v_commande.id;

  return jsonb_build_object(
    'facture_numero', v_commande.facture_numero,
    'facture_emise_le', v_commande.facture_emise_le,
    'avoir_numero', v_commande.avoir_numero,
    'avoir_emis_le', v_commande.avoir_emis_le,
    'avoir_motif', v_commande.avoir_motif,
    'commande_numero', v_commande.numero,
    'commande_le', v_commande.created_at,
    'paye_le', v_commande.paye_le,
    'client_nom', v_commande.client_nom,
    'client_email', v_commande.client_email,
    'adresse', v_commande.adresse_livraison,
    'mode_retrait', v_commande.mode_retrait,
    'sous_total_cents', v_commande.sous_total_cents,
    'livraison_cents', v_commande.livraison_cents,
    'total_cents', v_commande.total_cents,
    'lignes', v_lignes
  );
end;
$fn$;

grant execute on function facture_commande(text, text) to anon, authenticated;

-- --- Vérification ------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'commandes' and column_name = 'avoir_numero')     as colonne_avoir,
  (select count(*) from pg_proc where proname = 'emettre_avoir')         as fn_emettre,
  (select count(*) from pg_proc
    where proname = 'facture_commande' and prosrc like '%avoir_numero%') as lecture_enrichie,
  (select count(*) from commandes where avoir_numero is not null)        as avoirs_emis;
