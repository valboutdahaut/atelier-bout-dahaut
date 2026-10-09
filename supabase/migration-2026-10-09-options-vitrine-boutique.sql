-- =============================================================================
-- migration-2026-10-09-options-vitrine-boutique.sql
-- =============================================================================
-- Deux options que l'atelier règle lui-même, une par type de fiche :
--
--   1. VITRINE : une réalisation n'a pas toujours de photo « avant ». Un
--      rideau neuf, un abat-jour créé de zéro, un coussin : il n'y a rien à
--      montrer avant. L'option dit si la fiche présente un diptyque
--      avant / après ou une seule photo de résultat.
--
--   2. BOUTIQUE : certaines pièces ne peuvent pas partir en colis (volume,
--      fragilité, pièce à voir avant de l'emporter). L'option les réserve au
--      retrait au showroom, et la fonction de commande refuse alors la
--      livraison.
--
--   3. DÉLAIS : l'expédition passe à 3 à 5 jours ouvrés, et le retrait au
--      showroom à 1 à 2 jours ouvrés. Les deux ne sont plus le même délai : la
--      phrase unique qui les portait est remplacée par deux textes, et les
--      conditions de vente sont reprises en conséquence.
--
-- À exécuter UNE FOIS, après migration-2026-10-06-cgv-cgu.sql.
-- =============================================================================

-- --- 1. Vitrine : diptyque avant / après, ou photo seule ---------------------
-- Défaut à true : les réalisations déjà publiées gardent exactement la mise en
-- page qu'elles ont aujourd'hui. L'option ne vide jamais photo_avant_url, elle
-- décide seulement de son affichage, pour que décocher puis recocher ne fasse
-- pas perdre une photo déjà envoyée.
alter table posts_vitrine
  add column if not exists avant_apres_actif boolean not null default true;

-- --- 2. Boutique : pièce à retirer au showroom uniquement --------------------
alter table produits
  add column if not exists retrait_showroom_seul boolean not null default false;

-- --- 3. La commande refuse la livraison d'une pièce réservée au showroom -----
-- Le navigateur masque déjà le choix « livraison » dans ce cas, mais ça ne
-- suffit pas : une page de commande restée ouverte pendant que l'atelier coche
-- la case enverrait encore une livraison, et le colis serait promis pour une
-- pièce qui ne peut pas partir. La règle est donc posée ici, à l'endroit où la
-- commande s'écrit vraiment.
--
-- Signature inchangée : create or replace suffit, aucun drop nécessaire.
create or replace function creer_commande(
  p_client_nom text,
  p_client_email text,
  p_client_telephone text,
  p_mode_retrait text,
  p_adresse_livraison text,
  p_lignes jsonb -- [{produit_id, quantite}, ...] — PAS de prix envoyé par le client
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ligne jsonb;
  v_produit produits%rowtype;
  v_quantite integer;
  v_sous_total integer := 0;
  v_livraison integer;
  v_total integer;
  v_numero text;
  v_commande_id uuid;
  v_lignes_a_inserer jsonb := '[]'::jsonb;
begin
  if p_mode_retrait not in ('livraison', 'retrait_showroom') then
    raise exception 'Mode de retrait invalide';
  end if;
  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Le panier est vide';
  end if;

  -- Relit prix + stock réels, verrouille les lignes produit le temps de la
  -- transaction pour éviter que deux commandes simultanées ne survendent la
  -- même pièce unique.
  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    v_quantite := (v_ligne->>'quantite')::integer;
    if v_quantite <= 0 then
      raise exception 'Quantité invalide';
    end if;

    select * into v_produit from produits
      where id = (v_ligne->>'produit_id')::uuid and statut = 'publie'
      for update;

    if not found then
      raise exception 'Produit introuvable ou plus en vente';
    end if;

    -- Pièce réservée au retrait : la commande entière passe en retrait, on ne
    -- sait pas livrer la moitié d'un panier. Le mot « showroom » dans le
    -- message est reconnu par commande.js, qui en tire une explication claire.
    if p_mode_retrait = 'livraison' and v_produit.retrait_showroom_seul then
      raise exception 'Retrait au showroom obligatoire pour %', v_produit.titre;
    end if;

    -- ---------------------------------------------------------------------
    -- POINT DE DÉCISION MÉTIER (à personnaliser si besoin) :
    -- que fait-on si le stock est insuffisant pour cette ligne ?
    -- Ici : on rejette TOUTE la commande (comportement le plus simple et le
    -- plus sûr — le client garde son panier intact et peut ajuster). Deux
    -- autres options possibles : réduire silencieusement la quantité au
    -- stock disponible, ou renvoyer un statut partiel au client pour qu'il
    -- choisisse. Voir la discussion dans le plan d'implémentation du projet.
    -- ---------------------------------------------------------------------
    if v_produit.stock < v_quantite then
      raise exception 'Stock insuffisant pour %', v_produit.titre;
    end if;

    update produits set stock = stock - v_quantite, updated_at = now() where id = v_produit.id;

    v_sous_total := v_sous_total + v_produit.prix_cents * v_quantite;
    v_lignes_a_inserer := v_lignes_a_inserer || jsonb_build_object(
      'produit_id', v_produit.id,
      'titre_produit', v_produit.titre,
      'prix_unitaire_cents', v_produit.prix_cents,
      'quantite', v_quantite
    );
  end loop;

  v_livraison := case when p_mode_retrait = 'livraison' then 890 else 0 end;
  v_total := v_sous_total + v_livraison;
  v_numero := 'CMD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('commandes_numero_seq')::text, 4, '0');

  insert into commandes (
    numero, client_nom, client_email, client_telephone,
    mode_retrait, adresse_livraison, sous_total_cents, livraison_cents, total_cents
  ) values (
    v_numero, p_client_nom, p_client_email, p_client_telephone,
    p_mode_retrait, p_adresse_livraison, v_sous_total, v_livraison, v_total
  ) returning id into v_commande_id;

  insert into lignes_commande (commande_id, produit_id, titre_produit, prix_unitaire_cents, quantite)
  select v_commande_id, (l->>'produit_id')::uuid, l->>'titre_produit', (l->>'prix_unitaire_cents')::integer, (l->>'quantite')::integer
  from jsonb_array_elements(v_lignes_a_inserer) as l;

  return jsonb_build_object('numero', v_numero, 'total_cents', v_total, 'mode_retrait', p_mode_retrait);
end;
$fn$;

grant execute on function creer_commande(text, text, text, text, text, jsonb) to anon, authenticated;

-- --- 4. Les délais annoncés au client ----------------------------------------
-- Expédition sous 3 à 5 jours ouvrés, retrait au showroom sous 1 à 2 jours
-- ouvrés. Les deux délais diffèrent désormais : une phrase unique ne peut plus
-- les porter sans être à moitié fausse, et surtout elle annoncerait une
-- expédition sur la fiche d'une pièce qui ne part jamais en colis. D'où deux
-- clés, dont une seule s'affiche dans ce cas.
--
-- « jours ouvrés » des deux côtés, y compris pour le retrait : une commande
-- passée un samedi soir ne peut pas promettre un retrait le dimanche.
insert into contenu_site (cle, valeur) values

('boutique-delai-expedition', $txt$Votre commande est expédiée sous 3 à 5 jours ouvrés, à compter de la confirmation du paiement.$txt$),

('boutique-delai-retrait', $txt$En retrait au showroom, votre commande est disponible sous 1 à 2 jours ouvrés, à compter de la confirmation du paiement.$txt$),

-- Les conditions de vente portent les mêmes délais. Elles disent en plus ce
-- qui se passe pour une pièce qui ne peut pas être expédiée : c'est une
-- restriction de vente, elle a sa place dans le contrat et pas seulement dans
-- l'interface.
('cgv-fabrication', $txt$Les produits étant fabriqués artisanalement, certains articles sont réalisés après commande.

Les commandes passées sur la boutique en ligne sont **expédiées sous 3 à 5 jours ouvrés** à compter de la confirmation du paiement.

Lorsque le client choisit le retrait au showroom, sa commande est **mise à disposition sous 1 à 2 jours ouvrés** à compter de la confirmation du paiement.

Les pièces réalisées sur mesure ou sur devis ne sont pas vendues par la boutique en ligne. Leur délai est convenu directement avec l'atelier au moment du devis, en fonction de la nature du projet et du plan de charge.$txt$),

('cgv-livraison', $txt$Les livraisons sont effectuées **en France uniquement**. L'atelier ne livre pas à l'étranger.

Le client peut également choisir de retirer sa commande au showroom de Rambouillet, sans frais.

Certaines pièces ne peuvent pas être expédiées, en raison notamment de leur volume ou de leur fragilité. Elles sont alors disponibles **en retrait au showroom uniquement**. Cette restriction est indiquée sur la fiche du produit, avant l'ajout au panier, et rappelée au moment de la commande.

Les frais de livraison sont indiqués avant la validation de la commande. Le transporteur est choisi par L'Atelier du Bout d'à Haut en fonction notamment de la nature, du poids et du volume de la commande, ainsi que de sa destination.

Le vendeur est responsable de la bonne exécution du contrat à l'égard du consommateur, y compris lorsque la livraison est réalisée par un transporteur. En cas de retard ou de difficulté de livraison, le client est invité à contacter rapidement L'Atelier du Bout d'à Haut.

## À la réception

Le client est invité à vérifier l'état apparent du colis et du produit lors de sa réception.

En cas de dommage apparent, il est recommandé de conserver tous les éléments permettant de constater le problème et d'en informer rapidement L'Atelier du Bout d'à Haut. Cette recommandation ne limite pas les droits du client au titre des garanties légales.$txt$),

-- Les conditions de vente changent sur le fond : la date affichée en tête doit
-- suivre, sinon un client lit un texte modifié sous une date périmée.
('cgv-maj', $txt$9 octobre 2026$txt$)

on conflict (cle) do update set valeur = excluded.valeur;

-- L'ancienne clé unique n'a plus d'emploi. Laissée en base, elle resterait
-- modifiable dans l'administration sans s'afficher nulle part, et l'atelier
-- corrigerait un jour un délai sans effet sur le site.
delete from contenu_site where cle = 'boutique-delai';

-- --- Vérification ------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'posts_vitrine' and column_name = 'avant_apres_actif')     as colonne_avant_apres,
  (select count(*) from information_schema.columns
    where table_name = 'produits' and column_name = 'retrait_showroom_seul')      as colonne_retrait_showroom,
  (select count(*) from pg_proc
    where proname = 'creer_commande'
      and prosrc like '%retrait_showroom_seul%')                                  as commande_protegee,
  (select count(*) from produits where retrait_showroom_seul)                      as produits_showroom_seul,
  (select count(*) from contenu_site
    where cle in ('boutique-delai-expedition', 'boutique-delai-retrait'))          as deux_delais,
  (select count(*) from contenu_site where cle = 'boutique-delai')                 as ancienne_cle_restante,
  (select valeur from contenu_site where cle = 'cgv-maj')                          as date_des_cgv;
