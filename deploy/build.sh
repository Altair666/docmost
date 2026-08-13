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

# Кеш сборки не убирается сам и растёт от прохода к проходу: у нас он
# добрался до 45 ГБ за пятнадцать сборок. Старые образы тоже копятся —
# держим три последних, остальные ни к чему.
echo '--- убираю старьё ---'
docker builder prune --force --filter 'until=168h' 2>&1 | tail -1 | sed 's/^/  кеш: /'

docker images docmost-custom --format '{{.Tag}}' \
  | sort -V -r | tail -n +4 | while read -r old; do
      docker rmi "docmost-custom:$old" >/dev/null 2>&1 \
        && echo "  убран образ v$old" || true
    done

echo '--- возвращаю отладочные ---'
# Ровно те же, что гасили выше. Раньше поднимался только Keycloak, и
# dev-сервер с Grist оставались лежать после каждой сборки.
for c in docmost-dev grist-local keycloak-test; do
  docker start "$c" >/dev/null 2>&1 || true
done

sleep 5
for c in docmost-dev grist-local keycloak-test; do
  state=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo 'нет такого')
  if [ "$state" = running ]; then
    echo "  $c: работает"
  else
    echo "  $c: НЕ ПОДНЯЛСЯ ($state)"
  fi
done

echo '--- итог ---'
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
free -m | head -2
