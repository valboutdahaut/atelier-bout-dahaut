-- =============================================================================
-- migration-2026-10-11-avoirs-partiels.sql
-- =============================================================================
-- Permet d'émettre un avoir sur une partie d'une commande, et plusieurs avoirs
-- sur une même facture.
--
-- CE QUI CHANGE, ET POURQUOI. L'avoir était rangé dans trois colonnes de la
-- fiche de commande : une commande, un avoir, pas davantage. Tant que l'avoir
-- était total, c'était suffisant, on n'annule une facture qu'une fois. Avec
-- l'avoir partiel, le cas réel apparaît : une cliente renvoie un article, puis
-- un second trois semaines plus tard. Il faut deux documents.
--
-- Les avoirs deviennent donc une table, avec leurs lignes, rattachée à la
-- commande. Le moment est choisi : il n'y a au plus qu'un avoir de test en
-- base. Dans six mois, ce seraient de vrais documents comptables à déménager.
--
-- LE MONTANT EST CALCULÉ PAR LE SERVEUR, jamais transmis par le navigateur.
-- Même principe que pour les commandes : l'administration dit ce qu'elle
-- reprend, la base relit les prix réels et fait l'addition.
--
-- LES FRAIS DE LIVRAISON NE SUIVENT PAS AUTOMATIQUEMENT. En cas de rétractation
-- totale, le vendeur doit rembourser les frais de livraison initiaux. En cas de
-- retour partiel, non : la cliente garde une partie de la commande et la
-- livraison a bien été effectuée. C'est donc un choix explicite à chaque avoir.
--
-- À exécuter UNE FOIS, après migration-2026-10-11-avoirs.sql.
-- =============================================================================

-- --- 1. Les tables -----------------------------------------------------------
-- La séquence vient de la migration précédente, mais on ne présume pas qu'elle
-- a été jouée : une migration doit pouvoir s'exécuter seule.
create sequence if not exists avoirs_numero_seq;

create table if not exists avoirs (
  id uuid primary key default gen_random_uuid(),
  -- « restrict » et non « cascade » : un document comptable ne disparaît pas
  -- avec la ligne qui l'a produit. Les commandes réglées sont de toute façon
  -- conservées dix ans, et seules les commandes jamais payées sont purgées,
  -- lesquelles n'ont ni facture ni avoir.
  commande_id uuid not null references commandes(id) on delete restrict,
  numero text not null unique,
  emis_le timestamptz not null default now(),
  motif text,
  inclut_livraison boolean not null default false,
  total_cents integer not null check (total_cents >= 0)
);

create index if not exists avoirs_commande_idx on avoirs(commande_id);

create table if not exists avoir_lignes (
  id uuid primary key default gen_random_uuid(),
  avoir_id uuid not null references avoirs(id) on delete cascade,
  -- Référence conservée pour savoir ce qui reste reprenable, mais le titre et
  -- le prix sont recopiés : un document comptable ne doit pas changer parce
  -- qu'un produit a été renommé ou supprimé du catalogue.
  ligne_commande_id uuid references lignes_commande(id) on delete set null,
  titre_produit text not null,
  prix_unitaire_cents integer not null,
  quantite integer not null check (quantite > 0)
);

create index if not exists avoir_lignes_avoir_idx on avoir_lignes(avoir_id);

-- --- 2. Qui peut les lire ----------------------------------------------------
-- Seule l'administration, directement. Le client passe par facture_commande(),
-- qui vérifie son jeton et contourne ces règles en tant que fonction définie
-- par son propriétaire.
alter table avoirs enable row level security;
alter table avoir_lignes enable row level security;

drop policy if exists "admin_avoirs" on avoirs;
create policy "admin_avoirs" on avoirs for all using (est_admin()) with check (est_admin());

drop policy if exists "admin_avoir_lignes" on avoir_lignes;
create policy "admin_avoir_lignes" on avoir_lignes for all using (est_admin()) with check (est_admin());

-- --- 3. Reprendre les avoirs déjà émis ---------------------------------------
-- Ils étaient tous totaux : on recopie donc l'intégralité des lignes de la
-- commande, frais de livraison compris.
-- Sur une installation neuve, ces colonnes n'ont jamais existé : le bloc est
-- conditionné pour que la migration passe dans les deux cas.
do $migration$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'commandes' and column_name = 'avoir_numero'
  ) then
    insert into avoirs (commande_id, numero, emis_le, motif, inclut_livraison, total_cents)
    select c.id, c.avoir_numero, coalesce(c.avoir_emis_le, now()), c.avoir_motif, true, c.total_cents
    from commandes c
    where c.avoir_numero is not null
      and not exists (select 1 from avoirs a where a.numero = c.avoir_numero);

    insert into avoir_lignes (avoir_id, ligne_commande_id, titre_produit, prix_unitaire_cents, quantite)
    select a.id, l.id, l.titre_produit, l.prix_unitaire_cents, l.quantite
    from avoirs a
    join lignes_commande l on l.commande_id = a.commande_id
    where not exists (select 1 from avoir_lignes al where al.avoir_id = a.id);
  end if;
end $migration$;

-- Les anciennes colonnes disparaissent : deux sources de vérité sur un même
-- document comptable finiraient par se contredire.
alter table commandes
  drop column if exists avoir_numero,
  drop column if exists avoir_emis_le,
  drop column if exists avoir_motif;

-- --- 4. Ce qui reste reprenable sur une commande -----------------------------
-- L'administration en a besoin pour proposer les bonnes quantités, et la
-- fonction d'émission pour refuser de reprendre plus que ce qui a été vendu.
create or replace function lignes_reprenables(p_commande_id uuid)
returns table (
  ligne_id uuid,
  titre_produit text,
  prix_unitaire_cents integer,
  quantite_commandee integer,
  quantite_deja_reprise integer,
  quantite_reprenable integer
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    l.id,
    l.titre_produit,
    l.prix_unitaire_cents,
    l.quantite,
    coalesce(reprises.total, 0)::integer,
    (l.quantite - coalesce(reprises.total, 0))::integer
  from lignes_commande l
  left join (
    select al.ligne_commande_id, sum(al.quantite) as total
    from avoir_lignes al
    join avoirs a on a.id = al.avoir_id
    where a.commande_id = p_commande_id
    group by al.ligne_commande_id
  ) reprises on reprises.ligne_commande_id = l.id
  where l.commande_id = p_commande_id
  order by l.titre_produit;
$fn$;

revoke execute on function lignes_reprenables(uuid) from public, anon;
grant execute on function lignes_reprenables(uuid) to authenticated;

-- --- 5. Émettre un avoir -----------------------------------------------------
-- Remplace la version totale. p_lignes est un tableau [{ligne_id, quantite}],
-- sans aucun montant : les prix sont relus en base.
-- Signature différente de la version totale : il faut retirer l'ancienne,
-- « create or replace » ne pouvant pas changer une liste d'arguments.
drop function if exists emettre_avoir(uuid, text);

create or replace function emettre_avoir(
  p_commande_id uuid,
  p_motif text,
  p_lignes jsonb,
  p_inclut_livraison boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_commande commandes%rowtype;
  v_entree jsonb;
  v_ligne lignes_commande%rowtype;
  v_quantite integer;
  v_reprenable integer;
  v_total integer := 0;
  v_numero text;
  v_avoir_id uuid;
  v_a_inserer jsonb := '[]'::jsonb;
begin
  if not est_admin() then
    raise exception 'Réservé à l''administration';
  end if;

  select * into v_commande from commandes where id = p_commande_id for update;
  if not found then
    raise exception 'Commande introuvable';
  end if;
  if v_commande.facture_numero is null then
    raise exception 'Cette commande n''a pas de facture à annuler';
  end if;
  if p_lignes is null or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Aucun article sélectionné';
  end if;

  for v_entree in select * from jsonb_array_elements(p_lignes)
  loop
    v_quantite := (v_entree->>'quantite')::integer;
    if v_quantite is null or v_quantite <= 0 then
      raise exception 'Quantité invalide';
    end if;

    select * into v_ligne from lignes_commande
    where id = (v_entree->>'ligne_id')::uuid and commande_id = p_commande_id;
    if not found then
      raise exception 'Article absent de cette commande';
    end if;

    -- On ne reprend jamais plus que ce qui reste, avoirs précédents déduits.
    select quantite_reprenable into v_reprenable
    from lignes_reprenables(p_commande_id) where ligne_id = v_ligne.id;

    if v_quantite > coalesce(v_reprenable, 0) then
      raise exception 'Déjà repris : % ne peut plus être avoiré que % fois',
        v_ligne.titre_produit, coalesce(v_reprenable, 0);
    end if;

    v_total := v_total + v_ligne.prix_unitaire_cents * v_quantite;
    v_a_inserer := v_a_inserer || jsonb_build_object(
      'ligne_id', v_ligne.id,
      'titre', v_ligne.titre_produit,
      'prix', v_ligne.prix_unitaire_cents,
      'quantite', v_quantite
    );
  end loop;

  if p_inclut_livraison then
    v_total := v_total + coalesce(v_commande.livraison_cents, 0);
  end if;

  v_numero := 'AV-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('avoirs_numero_seq')::text, 4, '0');

  insert into avoirs (commande_id, numero, motif, inclut_livraison, total_cents)
  values (p_commande_id, v_numero, nullif(trim(coalesce(p_motif, '')), ''),
          p_inclut_livraison, v_total)
  returning id into v_avoir_id;

  insert into avoir_lignes (avoir_id, ligne_commande_id, titre_produit, prix_unitaire_cents, quantite)
  select v_avoir_id, (l->>'ligne_id')::uuid, l->>'titre',
         (l->>'prix')::integer, (l->>'quantite')::integer
  from jsonb_array_elements(v_a_inserer) as l;

  return jsonb_build_object('numero', v_numero, 'total_cents', v_total);
end;
$fn$;

revoke execute on function emettre_avoir(uuid, text, jsonb, boolean) from public, anon;
grant execute on function emettre_avoir(uuid, text, jsonb, boolean) to authenticated;

-- --- 6. La lecture par jeton suit --------------------------------------------
-- Elle rend désormais la liste des avoirs, avec leurs lignes : la page
-- imprimable doit pouvoir en afficher un parmi plusieurs.
create or replace function facture_commande(p_numero text, p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_commande commandes%rowtype;
  v_lignes jsonb;
  v_avoirs jsonb;
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

  select coalesce(jsonb_agg(jsonb_build_object(
           'numero', a.numero,
           'emis_le', a.emis_le,
           'motif', a.motif,
           'inclut_livraison', a.inclut_livraison,
           'total_cents', a.total_cents,
           'lignes', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'titre', al.titre_produit,
                      'quantite', al.quantite,
                      'prix_unitaire_cents', al.prix_unitaire_cents
                    ) order by al.titre_produit), '[]'::jsonb)
             from avoir_lignes al where al.avoir_id = a.id
           )
         ) order by a.emis_le), '[]'::jsonb)
  into v_avoirs
  from avoirs a where a.commande_id = v_commande.id;

  return jsonb_build_object(
    'facture_numero', v_commande.facture_numero,
    'facture_emise_le', v_commande.facture_emise_le,
    'avoirs', v_avoirs,
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
  (select count(*) from information_schema.tables where table_name = 'avoirs')       as table_avoirs,
  (select count(*) from information_schema.tables where table_name = 'avoir_lignes') as table_lignes,
  (select count(*) from information_schema.columns
    where table_name = 'commandes' and column_name = 'avoir_numero')                 as ancienne_colonne_restante,
  (select count(*) from pg_proc where proname = 'lignes_reprenables')                as fn_reprenables,
  (select count(*) from avoirs)                                                      as avoirs_repris,
  (select count(*) from avoir_lignes)                                                as lignes_reprises;
