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

# Сборка съедает почти всю память виртуалки, поэтому соседние
# контейнеры на время сборки лучше погасить: проверено на своей шкуре —
# машина уходила в своп и переставала отвечать вместе с боевым стеком.
#
# Список задаётся снаружи и по умолчанию пуст: на обычном сервере рядом
# ничего лишнего нет. На отладочной машине это делается так:
#   EXTRA_STOP='docmost-dev grist-local keycloak-test' deploy/build.sh 36
EXTRA_STOP=${EXTRA_STOP:-}

if [ -n "$EXTRA_STOP" ]; then
  echo '--- гашу лишнее на время сборки ---'
  # shellcheck disable=SC2086
  docker stop $EXTRA_STOP >/dev/null 2>&1 || true
fi
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

if [ -n "$EXTRA_STOP" ]; then
echo '--- возвращаю погашенное ---'
# Ровно те же, что гасили выше: docker stop помечает контейнер
# остановленным вручную, и сам докер его больше не поднимет — значит
# поднимать обязан тот, кто останавливал.
for c in $EXTRA_STOP; do
  docker start "$c" >/dev/null 2>&1 || true
done

sleep 5
for c in $EXTRA_STOP; do
  state=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo 'нет такого')
  if [ "$state" = running ]; then
    echo "  $c: работает"
  else
    echo "  $c: НЕ ПОДНЯЛСЯ ($state)"
  fi
done
fi

echo '--- итог ---'
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
free -m | head -2
