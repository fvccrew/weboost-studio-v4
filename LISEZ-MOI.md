# Weboost Studio — site complet

Contenu prêt à déployer. **Copiez tout à la racine de votre hébergement**, en
conservant l'arborescence `assets/`.

## Arborescence

```
index.html                                   Accueil (preloader + 6 sections)
creation-site-internet-saint-tropez.html     ⚠ URL déjà indexée par Google
creation-site-internet-cavalaire.html        ⚠ URL déjà indexée (position 12)
creation-site-internet-sainte-maxime.html
creation-site-internet-cogolin.html
creation-site-internet-grimaud.html
creation-site-internet-la-croix-valmer.html
developpeur-web-var.html                     ⚠ URL déjà indexée
mentions-legales.html
politique-confidentialite.html
sitemap.xml · robots.txt · .htaccess
assets/css/site.css       feuille partagée par les 6 pages villes
assets/js/gsap.min.js     animation (v3, officielle npm)
assets/js/preloader.js    intro de l'accueil
assets/js/site.js         moteur de l'accueil
assets/fonts/*.woff2      5 polices, réduites aux 125 glyphes du site
assets/img/*.webp         22 images, 2 à 3 tailles chacune
assets/video/golfe.*      la vidéo d'ambiance, en MP4 et WebM
contact.php               traitement du formulaire (envoi par mail)
favicon.ico · site.webmanifest
```

## À faire avant la mise en ligne

1. **Remplacer entièrement le contenu du dossier `www` par cette archive.**
   L'ancien `.htaccess` redirige tout vers l'accueil : conservé, il rendrait
   les six pages communes inaccessibles. Celui fourni ici le remplace et
   contient les redirections correctes des anciennes URL.
2. **`contact.php` est inclus dans l'archive.** Le formulaire lui envoie
   exactement les champs qu'il attend : `name`, `email`, `phone`, `project`,
   `message`, plus le champ piège `website`. Les emails partent vers
   contact@weboost-studio.fr. Ne pas le remplacer par un service tiers, la
   politique de confidentialité deviendrait fausse.
3. **Soumettre `sitemap.xml`** dans la Search Console.

## Optimisations déjà en place

- Aucune ressource externe : polices et scripts servis depuis le domaine.
- Images en WebP, `srcset` multi-tailles, `loading="lazy"` sous la ligne de
  flottaison, `fetchpriority="high"` sur l'image du hero.
- Dimensions déclarées sur chaque image : aucun décalage de mise en page.
- Cache d'un an sur `assets/`, aucun cache sur le HTML (voir `.htaccess`).
- Données structurées sur chaque page : ProfessionalService, WebPage,
  BreadcrumbList, FAQPage.
- Redirections 301 des anciennes URL, une-pour-une.

## Points de vigilance

- **Les trois projets du portfolio sont des démonstrations.** Le site le dit
  explicitement. À remplacer par de vrais clients dès que possible.
- **Tarifs affichés : 600 € et 1 300 €.** Vérifiez la cohérence avec vos devis.
- **Les pages villes non publiées** (Ramatuelle, Gassin, La Môle, Le Plan-de-la-Tour,
  La Garde-Freinet, Rayol-Canadel) sont mentionnées sans lien. Ne créez pas de
  liens vers elles tant que les pages n'existent pas.
