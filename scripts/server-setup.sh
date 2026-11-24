#!/usr/bin/env bash
# Prepares a fresh Ubuntu/Debian test server and starts Readback with Docker.
# Run on the server:  bash scripts/server-setup.sh
# Safe to run again: it updates the code and rebuilds.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/joaoleal1124/readback-app.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-$HOME/readback-app}"

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

if ! command -v apt-get >/dev/null; then
  echo "Este script é para Ubuntu ou Debian." >&2
  exit 1
fi

if ! command -v docker >/dev/null; then
  say "A instalar o Docker"
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
command -v git >/dev/null || sudo apt-get install -y git

if [ -d "$APP_DIR/.git" ]; then
  say "A atualizar o código"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  say "A descarregar o código"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  say "Criado .env vazio (modo de demonstração). Preenche-o com os dados do Supabase quando os tiveres."
fi

if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then
  say "A abrir a porta 3000 na firewall"
  sudo ufw allow 3000/tcp
fi

say "A construir e arrancar a app (demora alguns minutos da primeira vez)"
sudo docker compose up -d --build

IP="$(hostname -I | awk '{print $1}')"
say "Pronto. Abre no navegador de um PC ou telemóvel na mesma rede: http://$IP:3000"
