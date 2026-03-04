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

*(Si Python n’est pas dans le PATH, utilisez le chemin complet vers l’exécutable Python 3.12.)*
