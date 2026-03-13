# NordVPN — configuration sécurisée pour le scraping

## Option A : tmknight/docker-nordvpn (recommandé si Gluetun échoue)

Utilise le **client NordVPN officiel** + token. Plex inchangé. **Rotation automatique** au bloc LBC (disconnect/connect).

1. Générer un token : [Nord Account → Generate new token](https://support.nordvpn.com/hc/en-us/articles/20286980309265)
2. Dans `.env` : `NORDVPN_WIREGUARD_TOKEN=votre_token`
3. Lancer : `./scripts/run_lbc_vpn_docker.sh`  
   ou : `docker compose -f docker-compose.nordvpn.yml run --rm scraper`

## Option B : Gluetun (OpenVPN)

Username + Password depuis :
https://my.nordaccount.com/dashboard/nordvpn/manual-configuration/service-credentials/

Dans `.env` : `NORDVPN_USER` et `NORDVPN_PASSWORD`

## Option C : Gluetun WireGuard (si OpenVPN échoue)

Clé privée WireGuard (44 chars base64) depuis :
https://my.nordaccount.com/dashboard/nordvpn/manual-configuration/

Dans .env : `VPN_TYPE=wireguard` et `NORDVPN_WIREGUARD_PRIVATE_KEY=votre_clé`
WIREGUARD_MTU=1300 est déjà dans le docker-compose (aide si NAT / homelab).

## Configuration locale (jamais en ligne)

1. **Créer `.env`** à la racine du projet :
   ```bash
   cp .env.example .env
   chmod 600 .env
   ```

2. **Éditer `.env`** (éditeur local uniquement) :
   ```
   NORDVPN_USER=votre_username
   NORDVPN_PASSWORD=votre_password
   ```

3. **Vérifier** que `.env` n’est pas versionné :
   ```bash
   git status   # .env ne doit pas apparaître
   ```

## Bonnes pratiques

| À faire | À éviter |
|--------|----------|
| Garder `.env` local uniquement | Envoyer des identifiants en chat/email |
| `chmod 600 .env` | Commiter `.env` dans git |
| Utiliser les service credentials | Utiliser email/mot de passe de connexion |
| Régénérer les identifiants si doute | Partager des captures d’écran avec tokens |

## Lancer le scraper VPN

```bash
docker compose -f docker-compose.scraper-vpn.yml up -d
SCRAPER_VPN_PROXY_MODE=1 PIPELINE_REGION=Normandie python scripts/pipeline.py --lbc-only
```
