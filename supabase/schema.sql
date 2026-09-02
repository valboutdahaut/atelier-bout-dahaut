-- =============================================================================
-- schema.sql — L'Atelier du Bout d'à Haut
-- =============================================================================
-- À exécuter une fois dans le SQL Editor de Supabase (Project > SQL Editor),
-- avant policies.sql, functions.sql et storage.sql.
--
-- Montants en centimes (integer) pour éviter les soucis d'arrondi flottant.
-- =============================================================================

create extension if not exists pgcrypto; -- pour gen_random_uuid()

-- --- categories -------------------------------------------------------------
-- Une seule table pour les catégories boutique ET les savoir-faire vitrine
-- (même structure, même panneau admin).
create table categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('boutique', 'savoir_faire')),
  nom text not null,
  slug text not null,
  ordre integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (type, slug)
);

-- --- contenu_site -------------------------------------------------------------
-- Textes génériques éditables (hero, bio de l'artisane, footer). La clé
-- correspond à l'id de l'élément HTML sur le site public (voir site-content.js).
create table contenu_site (
  cle text primary key,
  valeur text not null default ''
);

-- --- produits -----------------------------------------------------------------
create table produits (
  id uuid primary key default gen_random_uuid(),
  categorie_id uuid references categories(id) on delete set null,
  titre text not null,
  slug text not null unique,
  sous_titre text,
  description text,
  prix_cents integer not null check (prix_cents >= 0),
  stock integer not null default 0 check (stock >= 0),
  piece_unique boolean not null default false,
  photos text[] not null default '{}',
  statut text not null default 'brouillon' check (statut in ('brouillon', 'publie')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- posts_vitrine --------------------------------------------------------------
create table posts_vitrine (
  id uuid primary key default gen_random_uuid(),
  savoir_faire_id uuid references categories(id) on delete set null,
  titre text not null,
  slug text not null unique,
  lieu text,
  date_projet date not null default current_date,
  resume text,
  recit text not null default '',
  photo_avant_url text,
  photo_apres_url text,
  photos_detail text[] not null default '{}',
  tissu text,
  duree text,
  matieres_reemployees text,
  mise_en_avant boolean not null default false,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'publie')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- commandes ------------------------------------------------------------------
create table commandes (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  client_nom text not null,
  client_email text not null,
  client_telephone text,
  mode_retrait text not null check (mode_retrait in ('livraison', 'retrait_showroom')),
  adresse_livraison text,
  sous_total_cents integer not null,
  livraison_cents integer not null default 0,
  total_cents integer not null,
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'en_preparation', 'expediee', 'retiree', 'annulee')),
  notes text,
  created_at timestamptz not null default now()
);

-- --- lignes_commande --------------------------------------------------------------
create table lignes_commande (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes(id) on delete cascade,
  produit_id uuid references produits(id) on delete set null,
  titre_produit text not null,      -- copie figée au moment de la commande
  prix_unitaire_cents integer not null,
  quantite integer not null check (quantite > 0)
);

-- --- messages_contact --------------------------------------------------------------
create table messages_contact (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  email text not null,
  telephone text,
  sujet text,
  message text not null,
  post_vitrine_id uuid references posts_vitrine(id) on delete set null,
  lu boolean not null default false,
  created_at timestamptz not null default now()
);

-- --- séquence pour le numéro de commande (ex. CMD-2026-0001) -----------------
create sequence commandes_numero_seq;
