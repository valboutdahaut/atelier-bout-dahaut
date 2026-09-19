-- =============================================================================
-- migration-2026-09-19-pages-legales.sql
-- =============================================================================
-- Crée les six textes des trois pages légales : mentions légales, politique de
-- confidentialité, CGU et CGV. Ces pages sont accessibles depuis le pied de
-- page du site (rubrique « Légal »), volontairement pas depuis le menu du haut,
-- et se modifient depuis Administration > Textes du site.
--
-- À exécuter UNE FOIS dans le SQL Editor de Supabase, sur la base en service.
-- Ne pas relancer seed.sql à la place : il réinsérerait les catégories et
-- échouerait sur la contrainte d'unicité.
--
-- « on conflict do nothing » : si ces clés existent déjà, la migration ne
-- touche à rien. Elle ne peut donc pas écraser un texte déjà rédigé.
--
-- MISE EN FORME des textes (voir site/js/lib/markdown-lite.js) :
--   une ligne vide sépare deux paragraphes
--   « ## » en début de ligne ouvre un sous-titre
--   « **texte** » met en gras
--
-- ATTENTION : les passages entre crochets sont des trous à combler. Ils
-- s'afficheraient tels quels sur le site public. À compléter dans l'admin
-- avant la bascule du domaine.
-- =============================================================================

insert into contenu_site (cle, valeur) values

-- --- Mentions légales --------------------------------------------------------
-- Reprend les informations déjà affichées au bas de la page Contact
-- (clés contact-mentions et contact-adresses), complétées de ce qu'un site
-- marchand doit indiquer en plus.
('mentions-titre', 'Mentions légales'),

('mentions-contenu', $txt$## Éditeur du site

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
[à compléter : adresse postale complète]$txt$),

-- --- Politique de confidentialité --------------------------------------------
-- Le contenu décrit ce que le site collecte RÉELLEMENT, d'après les tables
-- messages_contact et commandes du schéma. Seuls les engagements qui relèvent
-- d'une décision (durées de conservation, adresse de contact) sont laissés à
-- compléter.
('confidentialite-titre', 'Politique de confidentialité'),

('confidentialite-contenu', $txt$## Ce que ce site enregistre

Ce site n'utilise aucun traceur publicitaire et ne mesure pas votre navigation. Il n'enregistre que les informations que vous saisissez vous-même.

**Si vous envoyez un message depuis la page Contact** : votre nom, votre adresse e-mail, votre numéro de téléphone si vous le renseignez, ainsi que le sujet et le contenu de votre message.

**Si vous passez une commande** : votre nom, votre adresse e-mail, votre numéro de téléphone si vous le renseignez, votre adresse de livraison le cas échéant, et le détail de votre commande.

**Votre panier** reste dans votre navigateur et n'est transmis à l'atelier qu'au moment où vous validez votre commande.

## À quoi servent ces informations

À répondre à vos demandes et à traiter vos commandes, rien d'autre. Elles ne sont ni vendues, ni transmises à des tiers à des fins commerciales.

## Combien de temps elles sont conservées

[à compléter : durée de conservation des messages, puis des commandes]

## Où elles sont enregistrées

Sur les serveurs de Supabase, le prestataire technique qui héberge la base de données du site. Les données sont stockées sur l'infrastructure Amazon Web Services située à Paris, en France.

## Vos droits

Vous pouvez demander à consulter, à corriger ou à supprimer les informations qui vous concernent.
[à compléter : adresse e-mail à laquelle adresser ces demandes]$txt$),

-- --- CGU et CGV --------------------------------------------------------------
-- Volontairement réduit aux titres : des conditions de vente engagent
-- juridiquement l'atelier vis-à-vis de ses clients. Le contenu doit être
-- rédigé ou relu par l'artisane, pas produit automatiquement.
('cgu-cgv-titre', 'Conditions générales d''utilisation et de vente'),

('cgu-cgv-contenu', $txt$## Objet

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

[à compléter : droit applicable, et médiateur de la consommation]$txt$)

on conflict (cle) do nothing;

-- --- Vérification ------------------------------------------------------------
-- Doit renvoyer six lignes.
select cle, length(valeur) as taille
from contenu_site
where cle in (
  'mentions-titre', 'mentions-contenu',
  'confidentialite-titre', 'confidentialite-contenu',
  'cgu-cgv-titre', 'cgu-cgv-contenu'
)
order by cle;
