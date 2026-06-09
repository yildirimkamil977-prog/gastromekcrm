#!/usr/bin/env bash
# Gastromek CRM — one-shot deploy for a fresh Ubuntu 24.04 Hetzner VPS.
# Run as root, from inside the deployment/ folder:
#     bash deploy.sh
#
# It auto-installs Docker, opens the firewall, auto-generates .env (no manual
# editing needed), then builds & starts the whole stack (MongoDB + FastAPI +
# React + Caddy with automatic HTTPS).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Gastromek CRM deployment starting"
echo "    App dir: $APP_DIR"

# --- 1. System packages ------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ufw fail2ban curl ca-certificates gnupg git unzip openssl

# --- 2. Firewall (SSH + HTTP + HTTPS) ---------------------------------------
ufw allow OpenSSH >/dev/null || true
ufw allow 80/tcp  >/dev/null || true
ufw allow 443/tcp >/dev/null || true
yes | ufw enable || true
ufw status || true

# --- 3. Docker + Compose plugin ---------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
    echo "==> Installing Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# --- 4. Auto-generate .env (no manual editing) ------------------------------
cd "$SCRIPT_DIR"
if [[ ! -f .env ]]; then
    echo "==> Generating .env automatically..."
    JWT="$(openssl rand -hex 32)"
    cat > .env <<EOF
DOMAIN=gastromekcrm.com
ACME_EMAIL=info@gastromek.de
MONGO_URL=mongodb://mongo:27017
DB_NAME=gastromek_db
CORS_ORIGINS=https://gastromekcrm.com
JWT_SECRET=$JWT
ADMIN_EMAIL=admin@gastromekcrm.com
ADMIN_PASSWORD=Gastromek2026!
ADMIN_NAME=Sistem Yoneticisi
PRODUCT_FEED_URL=https://api.myikas.com/api/admin/ms/149e1ffa-f004-4044-b059-10d86865ebab/5f782569-de17-4d4e-88a4-c65bd533ac9f/google/feed.xml
PUBLIC_BASE_URL=https://gastromekcrm.com
EOF
    echo "    Default admin login -> admin@gastromekcrm.com / Gastromek2026!"
    echo "    (Change it from Ayarlar > Benutzer after the first login.)"
fi

# --- 5. Build + launch -------------------------------------------------------
echo "==> Building images (first build can take a few minutes)..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/.env" build

echo "==> Starting stack..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/.env" up -d

echo "==> Waiting for services..."
sleep 8
docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps

echo ""
echo "==> DONE."
echo "    Visit: https://gastromekcrm.com"
echo "    (Caddy issues a free Let's Encrypt HTTPS cert automatically once DNS points here — may take ~30s.)"
echo "    Live logs: docker compose -f $SCRIPT_DIR/docker-compose.yml logs -f"
