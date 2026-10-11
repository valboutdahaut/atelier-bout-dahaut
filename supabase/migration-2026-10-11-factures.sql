-- =============================================================================
-- migration-2026-10-11-factures.sql
-- =============================================================================
-- Donne un numéro de facture à chaque commande réglée.
--
-- POURQUOI. Une vente à distance à un particulier donne lieu à facture. Le
-- récapitulatif envoyé depuis le 10/10 en porte déjà presque toutes les
-- mentions, par l'identité du vendeur, le détail des articles, le total et la
-- franchise de TVA. Il lui manque l'essentiel d'une facture : un numéro.
--
-- LA CONTRAINTE QUI COMMANDE TOUT LE RESTE. Une numérotation de factures doit
-- être continue et chronologique, SANS TROU. C'est la première chose que
-- regarde un contrôle. D'où trois décisions :
--
--   1. Le numéro vient d'une séquence Postgres, jamais d'un calcul du genre
--      « le plus grand numéro plus un », qui se trompe dès que deux commandes
--      sont réglées à la même seconde.
--
--   2. La séquence ne se réinitialise pas chaque année. L'année figure dans le
--      préfixe pour la lisibilité, mais le compteur continue : FA-2027-0043
--      suit FA-2026-0042. Repartir à 1 chaque année obligerait à garantir
--      l'absence de doublon au passage de minuit le 31 décembre, pour un
--      confort de lecture.
--
--   3. Le numéro est attribué au PAIEMENT CONFIRMÉ, pas à l'enregistrement de
--      la commande. Un panier abandonné ne doit pas consommer un numéro : il
--      en resterait un trou définitif dans la série.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS. L'avoir. Une commande facturée puis
-- annulée conserve sa facture : on émet un second document qui l'annule, on ne
-- supprime jamais le premier. Tant que l'avoir n'est pas construit, une
-- annulation après facturation se règle à la main avec le comptable.
--
-- À exécuter UNE FOIS, après migration-2026-10-11-admin-troisieme-adresse.sql.
-- =============================================================================

-- --- 1. Le compteur et les colonnes ------------------------------------------
create sequence if not exists factures_numero_seq;

alter table commandes
  add column if not exists facture_numero text unique,
  add column if not exists facture_emise_le timestamptz;

-- --- 2. Attribuer un numéro --------------------------------------------------
-- Idempotente : rappelée sur une commande déjà facturée, elle rend le numéro
-- existant sans en consommer un nouveau. C'est indispensable, le webhook de
-- Stripe pouvant rejouer un évènement et l'atelier pouvant renvoyer un
-- récapitulatif depuis l'administration.
create or replace function attribuer_numero_facture(p_commande_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_numero text;
  v_statut text;
begin
  select facture_numero, paiement_statut into v_numero, v_statut
  from commandes where id = p_commande_id for update;

  if not found then
    return null;
  end if;

  -- Déjà facturée : on rend le même numéro, toujours.
  if v_numero is not null then
    return v_numero;
  end if;

  -- Pas de facture sans encaissement. Une commande en attente qui recevrait un
  -- numéro laisserait un trou dans la série si elle n'aboutissait jamais.
  if v_statut not in ('paye', 'non_requis') then
    return null;
  end if;

  v_numero := 'FA-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('factures_numero_seq')::text, 4, '0');

  update commandes
  set facture_numero = v_numero, facture_emise_le = now()
  where id = p_commande_id;

  return v_numero;
end;
$fn$;

revoke execute on function attribuer_numero_facture(uuid) from public, anon;
grant execute on function attribuer_numero_facture(uuid) to authenticated, service_role;

-- --- 3. Lire sa facture, sans compte -----------------------------------------
-- Même principe que statut_commande() : le client n'a pas de compte, il prouve
-- son achat par le jeton inscrit dans l'adresse de retour, impossible à
-- deviner. La fonction ne répond que sur présentation du bon couple numéro et
-- jeton, et refuse une commande non réglée.
--
-- Contrairement à statut_commande(), elle renvoie bien des données
-- personnelles : une facture porte par obligation le nom et l'adresse de son
-- destinataire. C'est le jeton qui en fait une consultation légitime.
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

-- --- 4. Rattraper les commandes déjà réglées ---------------------------------
-- Les commandes payées avant aujourd'hui n'ont pas de numéro. Leur en attribuer
-- un, dans l'ordre chronologique de leur encaissement, pour que la série parte
-- du début de l'activité et non du jour de cette migration.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from commandes
    where paiement_statut in ('paye', 'non_requis') and facture_numero is null
    order by coalesce(paye_le, created_at)
  loop
    perform attribuer_numero_facture(v_id);
  end loop;
end $$;

-- --- Vérification ------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'commandes' and column_name = 'facture_numero')      as colonne_numero,
  (select count(*) from pg_proc where proname = 'attribuer_numero_facture') as fn_attribuer,
  (select count(*) from pg_proc where proname = 'facture_commande')         as fn_lecture,
  (select count(*) from commandes where facture_numero is not null)         as factures_emises,
  (select count(*) from commandes
    where paiement_statut in ('paye', 'non_requis') and facture_numero is null) as reglees_sans_facture,
  (select string_agg(facture_numero, ', ' order by facture_numero)
     from commandes where facture_numero is not null)                        as numeros;
