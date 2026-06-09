#!/usr/bin/env bash
# Gastromek CRM - Ubuntu 24.04 VPS bootstrap + deploy script
# Run as root on a fresh Hetzner VPS.
#
# Usage:
#   bash deploy.sh

set -euo pipefail

echo "==> Gastromek CRM deployment starting on $(hostname)"

# --- 1. Basic hardening + updates --------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ufw fail2ban curl ca-certificates gnupg git

# --- 2. Firewall -------------------------------------------------------------
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
yes | ufw enable || true
ufw status

# --- 3. Docker + Compose plugin ---------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
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

# --- 4. Clone / update code --------------------------------------------------
APP_DIR="/opt/gastromek"
REPO_URL="${REPO_URL:-}"

if [[ -z "$REPO_URL" && ! -d "$APP_DIR" ]]; then
    echo "!! REPO_URL is not set and $APP_DIR does not exist."
    echo "   Set REPO_URL env var (e.g. export REPO_URL=https://github.com/USER/gastromek.git) OR"
    echo "   upload the project to $APP_DIR manually, then re-run this script."
    exit 1
fi

if [[ -d "$APP_DIR/.git" ]]; then
    echo "==> Updating existing checkout..."
    git -C "$APP_DIR" pull --rebase
elif [[ -n "$REPO_URL" ]]; then
    echo "==> Cloning $REPO_URL → $APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
fi

# --- 5. Verify .env ----------------------------------------------------------
cd "$APP_DIR/deployment"

if [[ ! -f .env ]]; then
    echo ""
    echo "!! .env not found in $APP_DIR/deployment/"
    echo "   Copy .env.example to .env and fill the values before running this script:"
    echo "       cp $APP_DIR/deployment/.env.example $APP_DIR/deployment/.env"
    echo "       nano $APP_DIR/deployment/.env"
    exit 1
fi

# Ensure project source is symlinked/copied for Docker build context
rm -rf "$APP_DIR/deployment/backend/app_src"  "$APP_DIR/deployment/frontend/app_src" 2>/dev/null || true

# --- 6. Build + launch -------------------------------------------------------
echo "==> Building images..."
docker compose -f "$APP_DIR/deployment/docker-compose.yml" --env-file "$APP_DIR/deployment/.env" build

echo "==> Starting stack..."
docker compose -f "$APP_DIR/deployment/docker-compose.yml" --env-file "$APP_DIR/deployment/.env" up -d

echo "==> Waiting for services..."
sleep 8
docker compose -f "$APP_DIR/deployment/docker-compose.yml" ps

echo ""
echo "==> Done. Visit https://$(grep ^DOMAIN "$APP_DIR/deployment/.env" | cut -d= -f2)"
echo "   Caddy will issue a Let's Encrypt cert automatically (may take ~30s on first boot)."
echo "   Logs:  docker compose -f $APP_DIR/deployment/docker-compose.yml logs -f"
