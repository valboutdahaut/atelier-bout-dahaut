-- =============================================================================
-- functions.sql — fonction RPC creer_commande()
-- =============================================================================
-- À exécuter après schema.sql et policies.sql.
--
-- C'est le SEUL chemin d'écriture pour une commande venant du site public
-- (aucune policy INSERT publique sur commandes/lignes_commande, voir
-- policies.sql). Le client n'envoie jamais de prix : cette fonction relit le
-- prix et le stock réels côté serveur, dans une transaction atomique.
-- =============================================================================

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
as $$
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
$$;

-- Le client public (anon, pas encore connecté) doit pouvoir appeler cette
-- fonction ; c'est la fonction elle-même (security definer) qui fait le
-- travail sensible, jamais un accès direct aux tables.
grant execute on function creer_commande(text, text, text, text, text, jsonb) to anon, authenticated;
