#!/usr/bin/env bash
# Сборка боевого образа. Номер версии — единственный довод:
#   /opt/shots/build.sh 34
#
# Он же уходит в тег образа, в довод сборки и в бейдж настроек, поэтому
# разъехаться им негде. Раньше номер жил ещё и константой в коде, я его
# забывал поднимать, и в настройках висело 0.95.21 при образе v33.
set -euo pipefail

N="${1:-}"
if [ -z "$N" ]; then
  echo 'нужен номер сборки: build.sh 34'
  exit 1
fi

PREV=$(grep -oP 'image: docmost-custom:v\K\d+' /opt/docmost-stack/docker-compose.yml)
LOG=/opt/shots/build-v$N.log

echo "собираю v$N (сейчас в стеке v$PREV)"

# Сборка съедает всю память виртуалки. Если рядом работают dev-сервер,
# локальный Grist и Keycloak, машина уходит в своп и перестаёт отвечать
# вместе с боевым стеком — проверено на собственной шкуре.
echo '--- гашу лишнее ---'
docker stop docmost-dev grist-local keycloak-test >/dev/null 2>&1 || true
free -m | head -2

cd /opt/docmost
docker build \
  --build-arg CUSTOM_BUILD="$N" \
  --build-arg NODE_OPTIONS=--max-old-space-size=2048 \
  -t "docmost-custom:v$N" . > "$LOG" 2>&1 || true

echo '--- ошибки из журнала ---'
grep -nE "error|Error:|ERROR" "$LOG" | grep -v "0 errors" | head -20 || true

if grep -q "naming to docker.io/library/docmost-custom:v$N" "$LOG"; then
  echo "--- образ собран, переключаю стек с v$PREV на v$N ---"
  sed -i "s/image: docmost-custom:v$PREV/image: docmost-custom:v$N/" \
    /opt/docmost-stack/docker-compose.yml
  cd /opt/docmost-stack
  docker compose up -d docmost 2>&1 | tail -3
else
  echo '--- образ не собран, стек не трогаю ---'
fi

echo '--- возвращаю Keycloak ---'
docker start keycloak-test >/dev/null 2>&1 || true

echo '--- итог ---'
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
free -m | head -2
