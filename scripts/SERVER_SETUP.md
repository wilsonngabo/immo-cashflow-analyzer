# Lancer l'app depuis le serveur

Ce guide explique comment faire tourner l'application et la pipeline **sur un serveur Linux** (VPS, machine locale, etc.), sans avoir à lancer les commandes depuis votre ordinateur.

## Prérequis

- Node.js (npm ou pnpm)
- Python 3.9+ avec `pip install -r requirements.txt`
- NordVPN (optionnel, pour LBC avec protection IP)

## 1. Démarrer l'application sur le serveur

```bash
cd ~/immo-cashflow-analyzer

# Installer les dépendances (une fois)
npm install   # ou pnpm install
pip install -r requirements.txt

# Lancer en production
npm run build && npm run start
# ou: pnpm build && pnpm start
```

L'app écoute sur **http://localhost:3000** (ou le port défini par `PORT`).

### Garder l'app tourner en permanence

**Option A — PM2 (recommandé)**  
```bash
npm install -g pm2
pm2 start npm --name "immo-cashflow" -- run start
pm2 save && pm2 startup
```

**Option B — systemd**  
Créer `/etc/systemd/system/immo-cashflow.service` :
```ini
[Unit]
Description=Immo Cashflow Analyzer
After=network.target

[Service]
Type=simple
User=wilson
WorkingDirectory=/home/wilson/immo-cashflow-analyzer
ExecStart=/usr/bin/npm run start
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```
Puis : `sudo systemctl enable --now immo-cashflow`

---

## 2. Lancer la pipeline depuis le serveur

### Option A : Depuis le navigateur ou curl

Une fois l'app démarrée, appelez l’API depuis **n’importe où** (navigateur, autre machine) :

```
http://VOTRE-SERVEUR:3000/api/cron/pipeline?secret=VOTRE_CRON_SECRET
```

Avec paramètres optionnels :
- **Bienveo seulement** : `?secret=XXX&mode=bienveo-only&no_vpn=1`
- **Région** : `?secret=XXX&mode=bienveo-only&no_vpn=1&region=Normandie`

Créez un secret dans `.env.local` :
```
CRON_SECRET=votre_secret_aleatoire
```

### Option B : Cron sur le serveur

La pipeline se lance automatiquement tous les jours à 08:00 :

```bash
# Configurer CRON_SECRET dans .env.local ou export
export CRON_SECRET="votre_secret"

./scripts/setup_schedule.sh
```

Ou ajouter manuellement à la crontab :
```
0 8 * * * curl -sf 'http://localhost:3000/api/cron/pipeline?secret=VOTRE_SECRET&mode=bienveo-only&no_vpn=1' || true
```

### Option C : Cron Python direct (sans passer par l'app)

Si vous ne voulez pas dépendre de l’app Next.js :

```bash
crontab -e
# Ajouter :
0 8 * * * cd /home/wilson/immo-cashflow-analyzer && PYTHONUNBUFFERED=1 python3 -u scripts/pipeline.py --bienveo-only --no-vpn >> /tmp/pipeline.log 2>&1
```

---

## 3. URLs de déclenchement

| URL | Usage |
|-----|-------|
| `GET /api/cron/pipeline?secret=XXX` | Pipeline complète |
| `GET /api/cron/pipeline?secret=XXX&mode=bienveo-only&no_vpn=1` | Bienveo uniquement, sans VPN |
| `GET /api/cron/pipeline?secret=XXX&mode=bienveo-only&no_vpn=1&region=Normandie` | Bienveo + Normandie seulement |
| `POST /api/pipeline` avec body `{"mode":"bienveo-only","no_vpn":true}` | Même chose en POST |

---

## 4. Accès distant

Pour accéder depuis un autre ordinateur :

- **Firewall** : ouvrir le port 3000 (`sudo ufw allow 3000`)
- **Reverse proxy** (nginx) : configurer un domaine et HTTPS
- **SSH tunnel** : `ssh -L 3000:localhost:3000 user@serveur` puis ouvrir http://localhost:3000

---

## 5. NordVPN + Plex

Si NordVPN et Plex tournent sur la même machine, exclure Plex du VPN :

```bash
nordvpn allowlist add port 32400
```

Voir `scripts/SCRAPING.md` pour plus de détails.
