-- =============================================================================
-- seed.sql — données de démonstration, pour tester le site une fois branché
-- =============================================================================
-- Optionnel. À exécuter après schema.sql (et policies.sql si vous voulez
-- tester les policies avec un vrai statut brouillon/publié).
-- =============================================================================

-- --- Textes génériques (valeurs par défaut, reprises du site statique) ------
insert into contenu_site (cle, valeur) values
  ('hero-titre', 'Redonner vie<br>aux sièges<br><em>qui ont une histoire.</em>'),
  ('hero-soustitre', 'Tapissière-garnisseuse. Je restaure fauteuils, canapés et chaises dans les règles du métier, et je couds rideaux, coussins et abat-jour sur mesure.'),
  ('bio-titre', 'Un métier de patience, de crin et de fil.'),
  ('bio-texte', 'Formée à la tapisserie d''ameublement traditionnelle et contemporaine, j''accompagne chaque pièce du dégarnissage à la finition : sanglage, guindage, garniture, couture. Le choix du tissu se fait ensemble, à l''atelier ou au showroom.'),
  ('footer-texte', 'Rénover plutôt que remplacer : chaque siège remis en état est un meuble qui ne part pas à la déchetterie.'),
  -- Ces deux-là sont volontairement vides : à remplir depuis admin/textes.html
  -- une fois les vraies adresses et les liens réseaux sociaux disponibles.
  ('contact-adresses', ''),
  ('contact-reseaux', '')
on conflict (cle) do nothing;

-- --- Catégories boutique -----------------------------------------------------
insert into categories (type, nom, slug, ordre) values
  ('boutique', 'Abat-jour', 'abat-jour', 0),
  ('boutique', 'Lampes', 'lampes', 1),
  ('boutique', 'Coussins', 'coussins', 2),
  ('boutique', 'Rideaux', 'rideaux', 3);

-- --- Savoir-faire (vitrine) ----------------------------------------------------
insert into categories (type, nom, slug, ordre) values
  ('savoir_faire', 'Tapisserie', 'tapisserie', 0),
  ('savoir_faire', 'Couture d''ameublement', 'couture-ameublement', 1),
  ('savoir_faire', 'Abat-jour sur mesure', 'abat-jour-sur-mesure', 2);

-- --- Un produit publié + un en brouillon (pour tester les policies RLS) ------
insert into produits (categorie_id, titre, slug, sous_titre, description, prix_cents, stock, piece_unique, statut)
select id, 'Abat-jour conique, lin naturel', 'abat-jour-conique-lin-naturel-demo', 'Ø 25 cm · monté main',
       'Monté à la main sur carcasse laiton, doublure blanche pour une lumière chaude. Lin belge non traité.',
       8900, 1, true, 'publie'
from categories where slug = 'abat-jour' and type = 'boutique';

insert into produits (categorie_id, titre, slug, sous_titre, prix_cents, stock, statut)
select id, 'Coussin passepoilé, velours vert', 'coussin-passepoile-velours-vert-demo', '45 × 45 cm',
       5400, 0, 'brouillon' -- brouillon ET stock à 0 : ne doit apparaître nulle part côté public
from categories where slug = 'coussins' and type = 'boutique';

-- --- Un post vitrine publié -----------------------------------------------------
insert into posts_vitrine (savoir_faire_id, titre, slug, lieu, date_projet, resume, recit, tissu, duree, matieres_reemployees, mise_en_avant, statut)
select id, 'Bergère Louis XV, velours vert de gris', 'bergere-louis-xv-velours-vert-de-gris-demo', 'Gallardon', '2026-03-01',
       'Retrouvée dans un grenier de l''Eure-et-Loir, la carcasse était saine. Tout le reste était à refaire.',
       'Le dégarnissage a demandé deux jours. Sous la toile, le crin animal était encore bon : lavé, cardé, il a repris sa place.' || chr(10) || chr(10) || 'La finition est faite au clou de tapissier, posé à la main sur galon.',
       'Velours de coton, vert de gris', 'Trois semaines d''atelier', 'Crin animal, carcasse, ressorts', true, 'publie'
from categories where slug = 'tapisserie' and type = 'savoir_faire';
