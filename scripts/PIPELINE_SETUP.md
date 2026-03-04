# Automatisation Quotidienne (Pipeline)

Pour récupérer **toutes les annonces** automatiquement chaque jour (pipeline ETL), vous pouvez utiliser le script `pipeline.py`.

Ce script itère sur les 10 plus grandes villes de France (Paris, Lyon, Marseille...) et récupère jusqu'à **2000 annonces** par ville pour la location et l'achat, en contournant Datadome, puis fusionne les nouvelles annonces dans votre base `data/properties.json`.

## Comment le lancer manuellement :

Ouvrez un terminal dans le dossier du projet et lancez :
```cmd
python scripts/pipeline.py
```
*(Si Python n'est pas dans votre PATH, utilisez le chemin complet de l'exécutable Python 3.12 que nous venons d'installer).*

## Comment l'automatiser tous les jours (Windows) :

Puisque vous êtes sous Windows, le moyen le plus logique et autonome est d'utiliser le **Planificateur de Tâches Windows (Task Scheduler)**.

1. Appuyez sur la touche `Windows`, tapez **Planificateur de tâches** et ouvrez-le.
2. Cliquez sur **Créer une tâche de base...** dans le menu de droite.
3. Donnez un nom : `ImmoCashFlow - Pipeline LeBonCoin`.
4. Déclencheur : Choisissez **Tous les jours** (ex: à 02:00 du matin).
5. Action : Choisissez **Démarrer un programme**.
6. Configuration du programme :
   - **Programme/Script** : Mettez le chemin vers Python. Par exemple : `C:\Users\wilson\AppData\Local\Programs\Python\Python312\python.exe`
   - **Ajouter des arguments** : `scripts/pipeline.py`
   - **Commencer dans** : Mettez le chemin absolu vers votre dossier de projet : `C:\Users\wilson\GIT\immo-cashflow-analyzer`
7. Cliquez sur **Terminer**.

Et voilà ! Le script s'exécutera discrètement en arrière-plan chaque nuit, peuplant votre base de données avec des milliers d'annonces fraîches. Votre tableau de bord Web aura toujours accès à toutes ces données le lendemain matin.
