-- =============================================================================
-- migration-2026-09-19-legal-en-rubriques.sql
-- =============================================================================
-- Découpe les trois pages légales en rubriques.
--
-- Avant : une seule grande clé par page (mentions-contenu, etc.), dans laquelle
-- il fallait écrire les titres à la main avec « ## ». Résultat : un pavé
-- illisible, et une syntaxe à apprendre pour l'artisane.
--
-- Après : une clé par rubrique. Le titre de chaque rubrique est fixé dans le
-- HTML de la page, l'artisane ne remplit que le texte, dans un encadré nommé.
-- Une rubrique laissée vide disparaît entièrement de la page publique, ce qui
-- évite d'afficher « à compléter » aux visiteurs.
--
-- À exécuter UNE FOIS, après les migrations du 19/09/2026.
--
-- « on conflict do nothing » : si l'artisane a déjà rempli une rubrique, la
-- migration ne l'écrase pas.
-- =============================================================================

insert into contenu_site (cle, valeur) values

-- --- Mentions légales --------------------------------------------------------
('mentions-editeur', $q$L'Atelier du Bout d'à Haut
Entreprise personnelle artisan
RCS Chartres, Siren n° 839 565 397$q$),

('mentions-adresses', $q$Atelier : 33 rue du Bout d'à Haut, 28320 Gallardon
Showroom : 109 rue du Général De Gaulle - Passage Fleuri, 78120 Rambouillet$q$),

-- Vides volontairement : la rubrique n'apparaît pas tant qu'elle n'est pas
-- remplie, plutôt que d'afficher un « à compléter » au visiteur.
('mentions-responsable', ''),
('mentions-contact', ''),

('mentions-hebergement', $q$Le site est hébergé par Netlify.

Les textes, les photos et les commandes sont enregistrés chez Supabase, sur l'infrastructure Amazon Web Services située à Paris, en France.$q$),

-- --- Politique de confidentialité --------------------------------------------
-- Décrit ce que le site enregistre réellement, d'après les tables
-- messages_contact et commandes du schéma.
('confidentialite-collecte', $q$Ce site n'utilise aucun traceur publicitaire et ne mesure pas votre navigation. Il n'enregistre que les informations que vous saisissez vous-même.

**Si vous envoyez un message depuis la page Contact** : votre nom, votre adresse e-mail, votre numéro de téléphone si vous le renseignez, ainsi que le sujet et le contenu de votre message.

**Si vous passez une commande** : votre nom, votre adresse e-mail, votre numéro de téléphone si vous le renseignez, votre adresse de livraison le cas échéant, et le détail de votre commande.

**Votre panier** reste dans votre navigateur et n'est transmis à l'atelier qu'au moment où vous validez votre commande.$q$),

('confidentialite-usage', $q$À répondre à vos demandes et à traiter vos commandes, rien d'autre. Elles ne sont ni vendues, ni transmises à des tiers à des fins commerciales.$q$),

('confidentialite-duree', ''),

('confidentialite-lieu', $q$Sur les serveurs de Supabase, le prestataire technique qui héberge la base de données du site. Les données sont stockées sur l'infrastructure Amazon Web Services située à Paris, en France.$q$),

('confidentialite-droits', $q$Vous pouvez demander à consulter, à corriger ou à supprimer les informations qui vous concernent.$q$),

-- --- CGU et CGV --------------------------------------------------------------
-- Toutes vides : des conditions de vente engagent juridiquement l'atelier
-- envers ses clients, elles doivent être rédigées et relues, pas produites
-- automatiquement. Tant que tout est vide, la page annonce « en cours de
-- rédaction » au lieu d'afficher un titre seul.
('cgv-objet', ''),
('cgv-commandes', ''),
('cgv-prix', ''),
('cgv-livraison', ''),
('cgv-retractation', ''),
('cgv-garanties', ''),
('cgv-litiges', '')

on conflict (cle) do nothing;

-- --- Nettoyage ---------------------------------------------------------------
-- Les trois anciennes clés « pavé » ne sont plus lues par aucune page. Leur
-- contenu a été redistribué dans les rubriques ci-dessus ; les laisser en base
-- ne ferait qu'encombrer l'administration.
delete from contenu_site
where cle in ('mentions-contenu', 'confidentialite-contenu', 'cgu-cgv-contenu');

-- --- Vérification ------------------------------------------------------------
-- Doit renvoyer 17 rubriques, et 0 ancienne clé.
select
  count(*) filter (where cle ~ '^(mentions|confidentialite|cgv)-' and cle !~ '-titre$') as rubriques,
  count(*) filter (where cle in ('mentions-contenu', 'confidentialite-contenu', 'cgu-cgv-contenu')) as anciennes_cles
from contenu_site;
