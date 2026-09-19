-- =============================================================================
-- migration-2026-09-19-reprise-contenu.sql
-- =============================================================================
-- Reprend le contenu réel de l'ancien projet Supabase (Londres, eu-west-2)
-- dans le nouveau projet de Paris (eu-west-3).
--
-- Généré automatiquement le 19/09/2026 à partir des données en service.
-- Les adresses des photos ont été réécrites vers le nouveau projet :
--   ftdkiujpuulfulfugbmv -> bsjwyystdxhltqwdbznt
--
-- À exécuter APRÈS schema.sql, policies.sql et storage.sql, et APRÈS avoir
-- re-téléversé les photos dans le bucket "photos" en conservant exactement
-- les mêmes noms de fichiers (sinon les fiches pointeront dans le vide).
--
-- Ne pas exécuter seed.sql sur ce projet : il ajouterait des produits de
-- démonstration dont on ne veut pas.
-- =============================================================================

-- --- Catégories (identifiants d'origine conservés) ---------------------------
insert into categories (id, type, nom, slug, ordre, visible) values
  ('69a58bfb-21a6-45b6-ac2f-e2cdd7e24f1a', 'boutique', 'Abat-jour', 'abat-jour', 0, true),
  ('95538da7-5960-4b92-9f24-27036fd08e70', 'boutique', 'Lampes', 'lampes', 1, true),
  ('1fa081d5-35cc-493d-afa5-a0a5727dbe3b', 'boutique', 'Coussins', 'coussins', 2, true),
  ('19542931-8e0c-4d4a-b772-a62bcc8a983c', 'boutique', 'Rideaux', 'rideaux', 3, true),
  ('64d8b5aa-f77c-4b25-98b3-353b0d381840', 'savoir_faire', 'Tapisserie', 'tapisserie', 0, true),
  ('ef22bf6f-8ed6-4182-9cd0-8c08187162e8', 'savoir_faire', $q$Couture d'ameublement$q$, 'couture-ameublement', 1, true),
  ('50b94312-9f3f-4d1e-b843-e29ac82c1fbd', 'savoir_faire', 'Abat-jour sur mesure', 'abat-jour-sur-mesure', 2, true)
on conflict (id) do nothing;

-- --- Textes du site ----------------------------------------------------------
insert into contenu_site (cle, valeur) values
  ('footer-texte', 'Rénover plutôt que remplacer : chaque siège remis en état est un meuble qui ne part pas à la déchetterie.'),
  ('hero-titre', $q$Redonner vie
aux sièges
<em>qui ont une histoire.</em>$q$),
  ('hero-soustitre', 'Tapissière-garnisseuse. Je restaure fauteuils, canapés et chaises dans les règles du métier, et je couds rideaux, coussins et abat-jour sur mesure !'),
  ('mentions-titre', 'Mentions légales'),
  ('mentions-contenu', $q$## Éditeur du site

L'Atelier du Bout d'à Haut
Entreprise personnelle artisan
RCS Chartres, Siren n° 839 565 397

## Adresses

Atelier : 33 rue du Bout d'à Haut, 28320 Gallardon
Showroom : 109 rue du Général De Gaulle - Passage Fleuri, 78120 Rambouillet

## Responsable de la publication

[à compléter : prénom et nom de la personne responsable du contenu du site]

## Nous écrire

[à compléter : adresse e-mail de contact]

## Hébergement du site

Le site est hébergé par Netlify.
[à compléter : adresse postale complète de l'hébergeur]

Les textes, les photos et les commandes sont enregistrés chez Supabase.
[à compléter : adresse postale complète]$q$),
  ('confidentialite-titre', 'Politique de confidentialité'),
  ('confidentialite-contenu', $q$## Ce que ce site enregistre

Ce site n'utilise aucun traceur publicitaire et ne mesure pas votre navigation. Il n'enregistre que les informations que vous saisissez vous-même.

**Si vous envoyez un message depuis la page Contact** : votre nom, votre adresse e-mail, votre numéro de téléphone si vous le renseignez, ainsi que le sujet et le contenu de votre message.

**Si vous passez une commande** : votre nom, votre adresse e-mail, votre numéro de téléphone si vous le renseignez, votre adresse de livraison le cas échéant, et le détail de votre commande.

**Votre panier** reste dans votre navigateur et n'est transmis à l'atelier qu'au moment où vous validez votre commande.

## À quoi servent ces informations

À répondre à vos demandes et à traiter vos commandes, rien d'autre. Elles ne sont ni vendues, ni transmises à des tiers à des fins commerciales.

## Combien de temps elles sont conservées

[à compléter : durée de conservation des messages, puis des commandes]

## Où elles sont enregistrées

Sur les serveurs de Supabase, le prestataire technique qui héberge la base de données du site.
[à compléter : pays d'hébergement des données]

## Vos droits

Vous pouvez demander à consulter, à corriger ou à supprimer les informations qui vous concernent.
[à compléter : adresse e-mail à laquelle adresser ces demandes]$q$),
  ('cgu-cgv-titre', $q$Conditions générales d'utilisation et de vente$q$),
  ('cgu-cgv-contenu', $q$## Objet

[à compléter : ce que couvrent ces conditions, et le fait que toute commande vaut acceptation]

## Commandes

[à compléter : comment une commande est passée, puis confirmée]

## Prix et paiement

[à compléter : devise, TVA applicable, moyens de paiement acceptés]

## Livraison et retrait

[à compléter : délais, zones livrées, conditions de retrait au showroom]

## Droit de rétractation

[à compléter : délai, modalités de retour, et sort des pièces réalisées sur mesure]

## Garanties

[à compléter]

## Litiges

[à compléter : droit applicable, et médiateur de la consommation]$q$),
  ('bio-titre', 'Un métier de patience, de crin et de fil.'),
  ('bio-texte', $q$Formée à la tapisserie d'ameublement traditionnelle et contemporaine, j'accompagne chaque pièce du dégarnissage à la finition : sanglage, guindage, garniture, couture. Le choix du tissu se fait ensemble, à l'atelier ou au showroom.$q$),
  ('apropos-titre', $q$Un métier appris à l'établi, transmis par la main.$q$),
  ('apropos-intro', $q$Formée à la tapisserie d'ameublement traditionnelle et contemporaine, j'accompagne chaque pièce du dégarnissage à la finition : sanglage, guindage, garniture, couture. Le choix du tissu se fait ensemble, à l'atelier ou au showroom.$q$),
  ('apropos-formations', ''),
  ('contact-adresses', $q$Atelier : 33 rue du Bout d'à Haut, 28320 Gallardon
Showroom : 109 rue du Général De Gaulle - Passage Fleuri, 78120 Rambouillet$q$),
  ('contact-mentions', $q$L'Atelier du Bout d'à Haut, Entreprise personnelle artisan
RCS Chartres Siren N° 839 565 397$q$),
  ('contact-reseaux', $q$instagram | @atelierboutdahaut | https://www.instagram.com/atelierboutdahaut
facebook | L'Atelier du Bout d'à Haut | https://www.facebook.com/atelierduboutdahaut/
pinterest | @latelierduboutd | https://fr.pinterest.com/latelierduboutd/$q$)
on conflict (cle) do update set valeur = excluded.valeur;

-- --- Produits boutique -------------------------------------------------------
insert into produits (id, categorie_id, titre, slug, sous_titre, description, prix_cents, stock, piece_unique, photos, statut) values
  ('8f6b48c9-e577-4930-8ff1-69866a104020', '69a58bfb-21a6-45b6-ac2f-e2cdd7e24f1a', 'Abat-jour test', 'abat-jour-conique-lin-naturel-demo', 'Ø 25 cm · monté main', 'Monté à la main sur carcasse laiton, doublure blanche pour une lumière chaude. Lin belge non traité.', 8900, 1, true, array['https://bsjwyystdxhltqwdbznt.supabase.co/storage/v1/object/public/photos/produits/d51f2fd1-d80d-40d5-9533-cf4fca7a2704.jpg', 'https://bsjwyystdxhltqwdbznt.supabase.co/storage/v1/object/public/photos/produits/e960064c-debf-41ed-81fc-f4985613c434.jpg']::text[], 'publie')
on conflict (id) do nothing;

-- --- Réalisations vitrine ----------------------------------------------------
insert into posts_vitrine (id, savoir_faire_id, titre, slug, lieu, date_projet, resume, recit, photo_avant_url, photo_apres_url, photos_detail, tissu, duree, matieres_reemployees, mise_en_avant, statut) values
  ('57efabea-1a74-458f-8ff2-ea61b0b010e3', '64d8b5aa-f77c-4b25-98b3-353b0d381840', 'Bergère Louis XV, velours vert de gris', 'bergere-louis-xv-velours-vert-de-gris-demo', 'Gallardon', '2026-03-01', $q$Retrouvée dans un grenier de l'Eure-et-Loir, la carcasse était saine. Tout le reste était à refaire.$q$, $q$Le dégarnissage a demandé deux jours. Sous la toile, le crin animal était encore bon : lavé, cardé, il a repris sa place.

La finition est faite au clou de tapissier, posé à la main sur galon.$q$, 'https://bsjwyystdxhltqwdbznt.supabase.co/storage/v1/object/public/photos/posts/5bc341ad-d5b4-47ef-bcec-e868ac7fcfad.JPG', 'https://bsjwyystdxhltqwdbznt.supabase.co/storage/v1/object/public/photos/posts/58a632ab-3603-4ed9-8912-54d38d462345.JPG', array['https://bsjwyystdxhltqwdbznt.supabase.co/storage/v1/object/public/photos/posts/db7090d6-b9ca-4f47-837e-672082f0a66e.jpg', 'https://bsjwyystdxhltqwdbznt.supabase.co/storage/v1/object/public/photos/posts/647cd388-9f8d-4094-8bb8-959b76a2ab2a.jpg', 'https://bsjwyystdxhltqwdbznt.supabase.co/storage/v1/object/public/photos/posts/79cb8174-380c-4026-a067-9acd9fbea3f3.jpg']::text[], 'Velours de coton, vert de gris', $q$Trois semaines d'atelier$q$, 'Crin animal, carcasse, ressorts', true, 'publie'),
  ('b686997f-df4b-4231-bfc5-27debbf5fbc9', '64d8b5aa-f77c-4b25-98b3-353b0d381840', 'xdzdq', 'xdzdq-ufqt', null, '2026-09-11', null, 'dqzD', 'https://bsjwyystdxhltqwdbznt.supabase.co/storage/v1/object/public/photos/posts/9f85bca2-c642-4ffd-a557-e50ff2d2dca8.jpg', 'https://bsjwyystdxhltqwdbznt.supabase.co/storage/v1/object/public/photos/posts/0fad7f78-cae3-412b-8fdb-775450aa88df.jpg', '{}'::text[], null, null, null, false, 'publie')
on conflict (id) do nothing;

-- --- Vérification ------------------------------------------------------------
select 'categories' as table_, count(*) from categories
union all select 'contenu_site', count(*) from contenu_site
union all select 'produits', count(*) from produits
union all select 'posts_vitrine', count(*) from posts_vitrine;
