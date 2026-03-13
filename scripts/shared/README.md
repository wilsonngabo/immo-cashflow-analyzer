# scripts/shared — modules partagés

Modules réutilisés par les scripts de scraping et la pipeline.

| Module | Rôle |
|--------|------|
| `config.py` | Chemins (DATA_DIR, DB_FILE, LBC_PROGRESS_FILE) |
| `session.py` | Session HTTP avec TLS impersonation + proxy (make_session, get_proxies) |
| `db.py` | Schéma SQLite unifié (init_db, save_to_db) |
| `vpn.py` | Gestion VPN : Gluetun, host NordVPN, Docker NordVPN (tmknight) |
| `power.py` | Gestion énergie (prevent_sleep, allow_sleep — no-op sur Linux) |

## Usage

```python
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shared.session import make_session
from shared.db import init_db, save_to_db
```
