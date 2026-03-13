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

## NordVPN + Plex (Linux)

La pipeline utilise NordVPN pour protéger votre IP lors du scraping. Si vous avez **Plex** sur la même machine, le trafic Plex peut être affecté car tout passe par le VPN.

**Solution : Allowlist NordVPN** — exclure le port Plex (32400) du tunnel VPN :

```bash
# Une fois configuré, Plex continue de fonctionner normalement pendant que la pipeline scrap via VPN
nordvpn allowlist add port 32400
```

- **Scraping** : trafic vers LBC/Bienveo → via VPN ✓  
- **Plex** : port 32400 → hors VPN, accès direct ✓  

Pour retirer la règle plus tard : `nordvpn allowlist remove port 32400`

Voir : [NordVPN Allowlist (Linux)](https://support.nordvpn.com/hc/en-us/articles/19618692366865)

## En cas de blocages persistants

- Mettre à jour curl_cffi : `pip install -U curl_cffi`
- Tester un proxy résidentiel (LBC_PROXY)
- Réduire la fréquence (augmenter les délais dans `pipeline.py` / `lbc_scrape.py`)
