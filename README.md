# Vitrine + Marketplace — L'Atelier du Bout d'à Haut

Statut : en cours (maquette Claude Design finalisée, site HTML/CSS/JS implémenté, reste à créer les comptes Supabase/Netlify et déployer)

## Contexte

Refonte moderne du site de **L'Atelier du Bout d'à Haut**, artisane tapissière-garnisseuse (atelier à Gallardon, showroom à Rambouillet).

Ancien site : https://www.latelierduboutdahaut.fr/ (site daté visuellement, construit sur un créateur de site IONOS/1&1). On garde les mêmes codes couleurs et la même typo de fond, adoucis et modernisés, ainsi que la structure de contenu existante (tapissier / couture d'ameublement / abat-jour, blog "Le Boudoir", démarche d'économie circulaire).

## Objectif du site

Trois parties, plus un espace d'administration à liberté totale sur le fond (jamais sur la forme) :

1. **Vitrine** : grosses pièces (fauteuils, canapés, chaises), présentées comme un portfolio avec récits avant/après. Pas de vente directe, juste du contact.
2. **Marketplace** : petites pièces en vente directe (abat-jours, lampes, rideaux, coussins).
3. **Admin** : formulaires guidés pour ajouter un produit boutique ou un post vitrine, sans jamais pouvoir toucher à la mise en page.

## Structure du dossier

```
atelier-bout-dahaut/
├── Atelier du Bout d'a Haut.dc.html   Maquette Claude Design (référence visuelle, ne pas déployer)
├── support.js, uploads/, assets/       Fichiers du canvas de design (référence)
├── supabase/                           Scripts SQL à exécuter une fois (voir plus bas)
├── netlify.toml                        Config de déploiement
└── site/                               LE SITE RÉEL — tout ce qui est déployé sur Netlify
```

Stack : HTML/CSS/JS simple, sans framework ni étape de build. Les données (produits, posts, commandes) vivent dans Supabase, interrogées directement depuis le JS du navigateur. L'admin est protégé par Netlify Identity.

## Dépôt Git

Ce dossier est un **dépôt Git indépendant**, avec son propre historique, sa propre branche `main`, son propre `.gitignore` et son propre `.gitattributes`. Il se trouve physiquement à l'intérieur du workspace Jarvis de Tom (qui l'ignore volontairement), mais il n'en fait pas partie.

C'est délibéré : un transfert de dépôt GitHub emporte **tout l'historique**, y compris les fichiers supprimés depuis. Si le code du site partageait le dépôt Jarvis, il serait impossible de le transférer à la cliente sans lui livrer aussi le contenu personnel du workspace (profil, objectifs, historique de sessions). La séparation devait donc être faite avant le premier envoi sur GitHub, pas au moment de la livraison.

Conséquence pratique : toutes les commandes Git de ce projet doivent être lancées **depuis ce dossier**, pas depuis la racine du workspace Jarvis.

## Lancer le site en local

Le site utilise `fetch()` pour injecter le header/footer (`site/js/include.js`), ce qui ne fonctionne pas en ouvrant les fichiers directement (`file://`). Il faut un serveur HTTP local :

```
npx serve site
```

Puis ouvrir l'URL affichée (ex. http://localhost:3000). Sans configuration Supabase, les pages publiques se chargent mais restent vides (erreurs réseau visibles dans la console) — normal, voir l'étape suivante.

## Mettre en place Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Dans le SQL Editor, exécuter dans l'ordre : `supabase/schema.sql`, puis `supabase/policies.sql` **après avoir remplacé `valerie@EXEMPLE.fr` par la vraie adresse email de Valérie**, puis `supabase/functions.sql`, puis `supabase/storage.sql`. `supabase/seed.sql` est optionnel, utile pour tester.
3. Copier l'URL et la clé anon publique du projet (Project Settings > API) dans `site/js/config.js`
4. **Point d'attention** : pour que `est_admin()` reconnaisse Valérie une fois connectée via Netlify Identity, il faut copier le secret de signature JWT de Netlify Identity (Site settings > Identity, une fois le site Netlify créé) dans Supabase (Project Settings > API > JWT Settings, secret "legacy"). À tester avant de considérer l'admin fonctionnel — si ce réglage n'est plus disponible sur les projets Supabase récents, revenir vers Claude pour une solution alternative (petite fonction Netlify comme pont d'auth).

## Mettre en place Netlify

1. New site from Git, sélectionner le dépôt de ce site
2. Aucun **Base directory** à renseigner : ce dossier est la racine du dépôt, `netlify.toml` fait le reste (il publie `site/`)
3. Site settings > Identity > Enable Identity, puis inviter l'email de Valérie
4. Vérifier le point d'attention Supabase ci-dessus

## Décisions de scope prises pendant l'implémentation

La maquette (10 écrans) ne détaillait pas tout. Ce qui a été tranché sans repasser par Tom, documenté ici pour traçabilité :

- **Textes génériques du site** (hero, bio, footer) : rendus éditables via une page admin dédiée (`admin/textes.html` + table `contenu_site`), cohérent avec l'objectif initial de liberté totale sur le fond, même si la maquette ne montrait pas cette section
- **Page Contact** : construite de toutes pièces (formulaire simple), absente de la maquette mais indispensable
- **Lien nav "Savoir-faire"** → ancre sur la section de l'accueil ; **"Le Boudoir"** → alias vers la vitrine (voir le README historique de l'ancien site)
- **Filtres boutique** (prix) codés en dur ; seules les catégories sont éditables par l'admin
- **Commandes / Messages de contact en admin** : portée minimale (liste + détail + statut), pas de facturation ni d'emails automatiques
- **Pagination boutique** : non implémentée (catalogue d'artisan, volume attendu faible) ; filtre "Disponibilité" de la maquette non repris (le stock filtre déjà les produits épuisés)

## Identité visuelle

| Rôle | Couleur | Hex | Confiance |
|---|---|---|---|
| Fond | Blanc cassé | `#F4EDDE` | fournie par Tom |
| Accent principal | Ile de Malte (Tollens CR4123-1) | `#C0D4C9` | moyenne, non confirmée sur une source primaire |
| Accent secondaire | Vert profond assorti | `#7FA6A2` | proposition Claude, à valider visuellement |
| Texte | Bleu marine | `#1B2A41` | proposition Claude, à valider visuellement |

Typographie : **Libre Baskerville** en titres (reprise de l'ancien site, vérifiée dans son code source), **Work Sans** en texte courant (proposition Claude pour la lisibilité web).

### Sources

- Ancien site (structure, contenu, police) : https://www.latelierduboutdahaut.fr/
- Bain de mer CR4120-6 `#C3DDDC` (couleur explorée puis remplacée par Ile de Malte) : https://www.photoshoplus.fr/couleurs/couleurs-tollens/
- Ile de Malte CR4123-1 : pas de page officielle retrouvée, valeur basée sur des résultats de recherche concordants mais non vérifiés directement. **À confirmer avec un nuancier Tollens si possible.**

## Historique — prompt de design (déjà utilisé, gardé pour référence)

```
Crée une maquette multi-écrans pour le site de L'Atelier du Bout d'à Haut,
artisane tapissière-garnisseuse (atelier à Gallardon, showroom à Rambouillet).
Format : mockup UI / canvas de design, pas de code fonctionnel.

IDENTITÉ VISUELLE
Palette :
- Fond : blanc cassé #F4EDDE
- Accent principal : vert "Ile de Malte" #C0D4C9 (aplats doux, fonds de
  section, éléments décoratifs)
- Accent secondaire : vert profond #7FA6A2 (boutons, hover, éléments
  d'action)
- Texte : bleu marine #1B2A41
Typographie : Libre Baskerville pour les titres (élégant, classique),
Work Sans pour le texte courant (sobre, lisible, moderne).
Ambiance : version modernisée et épurée de l'identité actuelle de
l'atelier (aujourd'hui un site un peu daté visuellement) : mêmes codes
couleurs adoucis, mise en page plus aérée et plus contemporaine.

STRUCTURE DU SITE (3 parties + admin)

1. Page d'accueil
   Hero sur une pièce phare (fauteuil restauré), courte présentation de
   l'artisane, deux accès clairs : "Vitrine" et "Boutique".

2. Vitrine (grosses pièces : fauteuils, canapés, chaises)
   Galerie de réalisations façon portfolio, organisée autour des trois
   savoir-faire de l'atelier : tapisserie, couture d'ameublement, abat-jour
   sur mesure. Chaque pièce = photos avant/après + récit du projet (style
   article de blog, dans l'esprit du blog existant "Le Boudoir"). Pas de
   prix ni d'achat direct, CTA "Me contacter pour un projet similaire".
   Une mention discrète de la démarche d'économie circulaire (rénovation
   plutôt que remplacement) fait partie de l'identité de l'atelier.

3. Marketplace (petites pièces : abat-jours, lampes, rideaux, coussins)
   Grille produits en vente directe. Fiche produit : photos, prix,
   description, bouton d'achat. Mini tunnel panier (mockup, pas de vrai
   paiement).

4. Espace administrateur
   Tableau de bord simple avec deux actions principales :
   - "Ajouter un produit boutique" (formulaire : photos, titre, prix,
     description, stock)
   - "Ajouter un post vitrine" (formulaire : photos avant/après, titre,
     texte du récit)

   Contrainte clé : l'admin peut tout modifier sur le FOND (textes, photos,
   produits, posts) mais jamais sur la FORME (mise en page, couleurs,
   structure). Les formulaires sont donc simples et guidés, pas un éditeur
   de mise en page libre.

COHÉRENCE
Même identité visuelle sur vitrine, boutique et admin (l'admin peut être
plus sobre/fonctionnel, style back-office). Responsive mobile + desktop.
```

## Prochaine étape

1. Créer le projet Supabase et exécuter les scripts SQL (voir plus haut)
2. Remplir `site/js/config.js`
3. Créer le site Netlify, activer Identity, inviter Valérie
4. Vérifier le pont d'authentification Netlify Identity ↔ Supabase
5. Remplacer les placeholders photo par de vraies photos une fois le catalogue réel saisi
