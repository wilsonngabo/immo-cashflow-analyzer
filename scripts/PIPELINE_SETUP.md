# Automatisation de la pipeline (LeBonCoin + SeLoger + Bienveo)

La **pipeline ne se lance plus à la main** depuis l’interface. Elle est gérée automatiquement.

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

2. **Cron système** (ex. Planificateur de tâches Windows) : une fois par jour, appeler :
   ```text
   https://votre-domaine.com/api/cron/pipeline?secret=VOTRE_CRON_SECRET
   ```

## Lancement manuel (dépannage)

En ligne de commande, à la racine du projet :

```cmd
python scripts/pipeline.py
```

ou :

```cmd
python scripts/run_pipeline.py
```

En fin d’exécution, la pipeline affiche **la durée totale** et le nombre de listings :
- **Durée totale** : temps pour parcourir toutes les régions et tranches 25k€
- **Listings en base** / **Annonces distinctes**

## Fonctionnement (par région, tranches 25k€, Parquet)

- La pipeline parcourt **par région** (liste alignée avec le filtre région du site), puis pour chaque région par **département**, **tranche de prix 25k€** (0–25k, 25k–50k, …) et type de bien (appartement / maison).
- **Sortie** : un fichier Parquet par région dans `data/region_<slug>.parquet`. Lorsqu’on filtre par région sur le site, seules les lignes de cette région sont concernées (index SQL sur `region`).
- **Pas d’incrémental** : à chaque run, les Parquet sont recréés puis fusionnés dans `data/properties.db` pour le site.
- Dépendances Python : `pip install -r requirements.txt` (curl_cffi, pyarrow).

## Durée théorique (full run)

En **théorie**, pour un run complet (toutes les régions) :

- **18 régions**, ~**96 départements** au total, **80 tranches** de 25k€ (0 → 2M€), **2 types** de bien (appartement, maison).
- Soit **~15 360 recherches** (dépt × tranche × type). Chaque recherche peut déclencher **plusieurs requêtes API** (pagination par 100, jusqu’à 2 500 ou 50k annonces par recherche).
- Avec **1,5–3 s** entre chaque requête pour limiter les 403 Datadome, le nombre d’appels réels dépend du volume d’annonces par tranche.

**Estimation indicative : 15 à 40+ heures** pour un run complet (sans erreurs 403). En pratique, beaucoup de tranches renvoient peu de pages ; les régions très denses (Île-de-France, PACA, etc.) rallongent la durée.

Pour tester plus vite : `PIPELINE_LIMIT_REGIONS=1 python scripts/pipeline.py` (une seule région).

*(Si Python n’est pas dans le PATH, utilisez le chemin complet vers l’exécutable Python 3.12.)*
