# Automatisation de la pipeline (LeBonCoin + SeLoger + Bienveo)

La **pipeline ne se lance plus à la main** depuis l’interface. Elle est gérée automatiquement.

> **Lancer depuis le serveur** : voir [scripts/SERVER_SETUP.md](SERVER_SETUP.md) pour démarrer l'app et la pipeline sur un serveur Linux (sans SSH depuis votre PC).

## Lancement automatique

- **Au démarrage du site** : 30 secondes après le démarrage du serveur Next.js (`next start` ou `next dev`), la pipeline est lancée une fois en arrière-plan.
- **Ensuite** : elle est relancée **toutes les 24 heures** (même processus Node).

Aucun clic ni configuration côté utilisateur n’est nécessaire pour que les annonces se mettent à jour.

## Option : cron externe (Vercel / hébergement sans processus long)

Si le site est hébergé en serverless (ex. Vercel), le processus ne tourne pas en continu : la pipeline ne peut pas être relancée toutes les 24 h par le serveur. Vous pouvez alors :

1. **Vercel Cron** : dans `vercel.json` ajouter par exemple :
   ```json
   "crons": [{ "path": "/api/cron/pipeline", "schedule": "0 2 * * *" }]
   ```
   et définir la variable d’environnement `CRON_SECRET` sur Vercel. Appeler l’URL avec `?secret=VOTRE_CRON_SECRET` (ou en en-tête `Authorization: Bearer VOTRE_CRON_SECRET`).

2. **Cron système** (Linux) : une fois par jour, appeler :
   ```text
   https://votre-domaine.com/api/cron/pipeline?secret=VOTRE_CRON_SECRET
   ```

## Lancement manuel (dépannage)

En ligne de commande, à la racine du projet :

```bash
python3 scripts/pipeline.py
```

En fin d’exécution, la pipeline affiche **la durée totale** et le nombre de listings :
- **Durée totale** : temps pour parcourir toutes les régions et tranches 25k€
- **Listings en base** / **Annonces distinctes**

## Fonctionnement (par région, tranches 25k€, Parquet)

- La pipeline parcourt **par région**, puis pour chaque région par **département**, **tranche de prix 200k€** (0–200k, 200k–400k, …) et **un seul type** (appartement + maison). Plafond **200 annonces** par recherche pour rester sous ~1 h.
- **Sortie** : un fichier Parquet par région dans `data/region_<slug>.parquet`. Lorsqu’on filtre par région sur le site, seules les lignes de cette région sont concernées (index SQL sur `region`).
- **Pas d’incrémental** : à chaque run, les Parquet sont recréés puis fusionnés dans `data/properties.db` pour le site.
- Dépendances Python : `pip install -r requirements.txt` (curl_cffi, pyarrow).

## Durée théorique (full run)

Pipeline **optimisée pour ~1 h max** :

- **Tranches de 200k€** (10 tranches : 0–200k, 200k–400k, … jusqu’à 2M) au lieu de 80 × 25k.
- **Un seul type de recherche** : appartement + maison en une requête (`both`).
- **Plafond 200 annonces** par (département × tranche) → au plus 2 appels API par recherche.

Avec **18 régions**, ~**96 départements**, **10 tranches**, **1 type** : ~960 recherches × 2 appels × 2,25 s ≈ **~1 h**.

Pour tester plus vite :
- `PIPELINE_REGION=Normandie python3 scripts/pipeline.py` (une seule région)
- `PIPELINE_REGION=Île-de-France python3 scripts/pipeline.py` (exemple)

*(Si Python n’est pas dans le PATH, utilisez le chemin complet vers l’exécutable Python 3.12.)*
