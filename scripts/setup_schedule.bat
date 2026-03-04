@echo off
set SCRIPT_PATH=%~dp0pipeline.py
set PYTHON_EXE=python

echo Configuration de la tache planifiee pour Immo Cashflow...
echo Le script tournera tous les jours a 08:00.

schtasks /create /tn "ImmoCashflowPipeline" /tr "%PYTHON_EXE% %SCRIPT_PATH%" /sc daily /st 08:00 /f

if %errorlevel% equ 0 (
    echo [SUCCES] La tache a ete creee avec succes.
) else (
    echo [ERREUR] Impossible de creer la tache planifiee. Verifiez les droits administrateur.
)
pause
