# Partager le site avec quelqu’un à distance (ex. Allemagne)

Plusieurs options pour rendre ton serveur accessible depuis internet (ordinateur distant, VPS, etc.).

---

## Option 1 : Cloudflare Tunnel (recommandé, gratuit)

Aucun port à ouvrir, fonctionne derrière NAT/Firewall.

1. **Installer cloudflared**
   ```bash
   # Linux
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
   chmod +x cloudflared
   sudo mv cloudflared /usr/local/bin/
   ```

2. **Créer un tunnel**
   ```bash
   cloudflared tunnel login   # ouvre le navigateur pour te connecter à Cloudflare
   cloudflared tunnel create rendement-immo
   ```

3. **Configurer le tunnel** – crée `~/.cloudflared/config.yml` :
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /home/<USER>/.cloudflared/<TUNNEL_ID>.json

   ingress:
     - hostname: rendement-immo.ton-domaine.com   # ou un sous-domaine *.trycloudflare.com
       service: http://localhost:3000
     - service: http_status:404
   ```

4. **Lancer le tunnel**
   ```bash
   cloudflared tunnel run rendement-immo
   ```

5. **Lier le hostname** (dans le dashboard Cloudflare)  
   Tu obtiendras une URL publique que ta sœur pourra utiliser depuis l’Allemagne.

---

## Option 2 : ngrok (rapide, gratuit)

1. Créer un compte sur [ngrok.com](https://ngrok.com) et récupérer ton auth token.

2. Installer et configurer :
   ```bash
   # npm
   npx ngrok http 3000

   # ou installer globalement
   curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update && sudo apt install ngrok
   ngrok config add-authtoken <TOKEN>
   ngrok http 3000
   ```

3. ngrok affiche une URL type `https://xxxx.ngrok-free.app`. Partage-la avec ta sœur.

---

## Option 3 : Serveur avec IP publique (VPS)

Si tu tournes sur un VPS (Hetzner, DigitalOcean, OVH, etc.) :

1. **Démarrer l’app en Docker**
   ```bash
   docker compose -f docker-compose.server.yml up -d --build
   ```

2. **Ouvrir le port 3000** dans le pare-feu du serveur (UFW, iptables, ou pare-feu cloud).

3. **Accès** : `http://<IP_DE_TON_SERVEUR>:3000`

4. (Optionnel) Mettre un reverse proxy (nginx + Let’s Encrypt) pour HTTPS et un nom de domaine.

---

## Démarrer le serveur avant de partager

**En local (dev) :**
```bash
pnpm dev
# ou pour écouter sur toutes les interfaces (réseau local) :
pnpm dev:sample
```

**En production (Docker) :**
```bash
docker compose -f docker-compose.server.yml up -d
```

---

## Résumé rapide

| Option           | Avantages                          | Inconvénients                    |
|------------------|------------------------------------|----------------------------------|
| Cloudflare Tunnel | Gratuit, pas de port à ouvrir      | Nécessite un compte Cloudflare  |
| ngrok            | Très rapide à lancer               | URL change si pas de plan payant |
| VPS              | Contrôle total, URL stable          | Coût serveur, configuration admin |
