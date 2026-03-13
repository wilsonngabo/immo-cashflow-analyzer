# Scraping – sources et bonnes pratiques

Références utilisées pour garder le scraping **efficace en coût** et fiable (LBC, SeLoger, etc.).

## Liens et sources

- **Reddit r/webscraping** – outils et coût :  
  https://www.reddit.com/r/webscraping/comments/1co6a3g/what_is_the_most_cost_efficient_tool_to_scrape_a/

- **curl_cffi** (TLS fingerprint impersonation, contournement de nombreux anti-bots) :  
  https://curl-cffi.readthedocs.io/  
  https://github.com/yifeikong/curl_cffi

- **LeBonCoin API / pagination** :  
  https://github.com/thomasync/leboncoin-api-search  
  https://github.com/etienne-hd/lbc

- **Guides généraux** : préférer les APIs/JSON quand c’est possible ; pour du HTTP, curl_cffi est souvent le meilleur rapport coût/perf ; pour du JS obligatoire, Playwright/Scrapling.

## Ce qu’on fait dans ce projet

- **curl_cffi** pour LBC (impersonation Chrome/Edge, pas de navigateur lourd).
- **Proxy optionnel** : `LBC_PROXY` ou `HTTPS_PROXY` (ex. proxy résidentiel) si Datadome bloque trop :
  ```bash
  LBC_PROXY=http://user:pass@host:port python scripts/pipeline.py
  ```
- **Bypass après 3 échecs** : pause 45 s + nouvelle session (autre impersonation) pour continuer la pipeline.
- **Délais** 1,5–3 s entre requêtes pour limiter les 403.
- **Tranches larges** (200k€) et **une recherche** appart+maison pour rester sous ~1 h de run.

## NordVPN + Plex / Gluetun (recommandé)

Si vous avez **Plex** avec **Gluetun** sur la même machine, utilisez un **Gluetun dédié** pour le scraping. Plex et scraping ont chacun leur propre tunnel VPN — aucun impact mutuel.

### Gluetun dédié pour LBC (docker-compose.scraper-vpn.yml)

```bash
# 1. Créer .env avec identifiants NordVPN
cp .env.example .env
# Éditer .env : NORDVPN_USER, NORDVPN_PASSWORD

# 2. Démarrer le Gluetun scraper (séparé du Gluetun Plex)
docker compose -f docker-compose.scraper-vpn.yml up -d

# 3. Lancer la pipeline avec proxy (Plex inchangé)
SCRAPER_VPN_PROXY_MODE=1 python scripts/pipeline.py --lbc-only
```

Rotation IP sur bloc : `docker restart gluetun-scraper` (automatique dans la pipeline)

### Alternative : NordVPN sur l'hôte + Plex dans Gluetun

Si Plex est dans Gluetun et NordVPN sur l'hôte : le trafic Plex ne passe pas par l'hôte. Allowlist possible : `nordvpn allowlist add port 32400`

## En cas de blocages persistants

- Mettre à jour curl_cffi : `pip install -U curl_cffi`
- Tester un proxy résidentiel (LBC_PROXY)
- Réduire la fréquence (augmenter les délais dans `pipeline.py` / `lbc_scrape.py`)
