#!/usr/bin/env bash
#
# Удаление Docmost с сервера.
#
#   ./uninstall-linux.sh              показать, что будет удалено
#   ./uninstall-linux.sh --yes        удалить, данные сохранить
#   ./uninstall-linux.sh --yes --with-data   удалить вместе с базой
#
# По умолчанию ничего не трогает — только показывает план. Данные
# (база, вложения) удаляются лишь по отдельному требованию: восстановить
# их будет неоткуда.
set -uo pipefail

SRC_DIR=${SRC_DIR:-/opt/docmost}
STACK_DIR=${STACK_DIR:-/opt/docmost-stack}

CONFIRMED=0
WITH_DATA=0
KEEP_SOURCES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)       CONFIRMED=1 ;;
    --with-data)    WITH_DATA=1 ;;
    --keep-sources) KEEP_SOURCES=1 ;;
    -h|--help)      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "не понимаю довод: $1"; exit 1 ;;
  esac
  shift
done

say()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
item() { printf '  %s\n' "$1"; }
gone() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
skip() { printf '  \033[33m–\033[0m %s\n' "$1"; }

# --- что нашлось ------------------------------------------------------

say 'Нашёл на сервере'

CONTAINERS=$(docker ps -a --filter 'name=docmost-stack' --format '{{.Names}}' 2>/dev/null)
if [ -n "$CONTAINERS" ]; then
  echo "$CONTAINERS" | while read -r c; do item "контейнер $c"; done
else
  item 'контейнеров стека нет'
fi

IMAGES=$(docker images docmost-custom --format '{{.Tag}}' 2>/dev/null | sort -V)
if [ -n "$IMAGES" ]; then
  item "образов docmost-custom: $(echo "$IMAGES" | wc -l) ($(echo "$IMAGES" | tr '\n' ' '))"
else
  item 'образов нет'
fi

for v in docmost-stack_db_data docmost-stack_docmost_storage docmost-stack_redis_data; do
  if docker volume inspect "$v" >/dev/null 2>&1; then
    p=$(docker volume inspect "$v" -f '{{.Mountpoint}}')
    s=$(du -sh "$p" 2>/dev/null | cut -f1)
    item "том $v (${s:-?})"
  fi
done

[ -d "$SRC_DIR" ]   && item "исходники $SRC_DIR ($(du -sh "$SRC_DIR" 2>/dev/null | cut -f1))"
[ -d "$STACK_DIR" ] && item "стек $STACK_DIR"

# --- план -------------------------------------------------------------

say 'Что будет сделано'
item 'остановлены и удалены контейнеры стека'
item 'удалены образы docmost-custom всех версий'
item 'подрезан кеш сборки'
if [ "$WITH_DATA" -eq 1 ]; then
  printf '  \033[31m%s\033[0m\n' 'УДАЛЕНЫ ТОМА: база, вложения, Redis — безвозвратно'
else
  item 'тома с данными сохранены (удалить: --with-data)'
fi
if [ "$KEEP_SOURCES" -eq 1 ]; then
  item "исходники $SRC_DIR сохранены"
else
  item "удалены каталоги $SRC_DIR и $STACK_DIR"
fi
item 'НЕ трогаются: сам Docker, WSL, Keycloak и прочие контейнеры'

if [ "$CONFIRMED" -eq 0 ]; then
  printf '\n\033[33mЭто был только план. Чтобы выполнить, добавьте --yes\033[0m\n'
  exit 0
fi

if [ "$WITH_DATA" -eq 1 ]; then
  printf '\n\033[31mУдаляю вместе с данными. Последняя возможность прерваться — 5 секунд.\033[0m\n'
  sleep 5
fi

# --- удаление ---------------------------------------------------------

say 'Удаляю'

if [ -f "$STACK_DIR/docker-compose.yml" ]; then
  cd "$STACK_DIR"
  if [ "$WITH_DATA" -eq 1 ]; then
    docker compose down --volumes >/dev/null 2>&1 && gone 'стек остановлен, тома удалены'
  else
    docker compose down >/dev/null 2>&1 && gone 'стек остановлен, тома оставлены'
  fi
  cd /
else
  # Стека нет, но контейнеры могли остаться от прошлых заходов
  if [ -n "$CONTAINERS" ]; then
    echo "$CONTAINERS" | xargs -r docker rm -f >/dev/null 2>&1 && gone 'контейнеры удалены'
  else
    skip 'контейнеров не было'
  fi
fi

if [ -n "$IMAGES" ]; then
  echo "$IMAGES" | while read -r t; do
    docker rmi "docmost-custom:$t" >/dev/null 2>&1 && gone "образ v$t удалён"
  done
else
  skip 'образов не было'
fi

freed=$(docker builder prune --force 2>/dev/null | tail -1)
gone "кеш сборки: ${freed:-подрезан}"

if [ "$KEEP_SOURCES" -eq 0 ]; then
  # .env хранит пароли базы: если тома оставили, он ещё понадобится
  if [ "$WITH_DATA" -eq 0 ] && [ -f "$STACK_DIR/.env" ]; then
    cp "$STACK_DIR/.env" "/root/docmost-env-$(date +%Y%m%d).bak" 2>/dev/null \
      && gone "пароли сохранены в /root/docmost-env-$(date +%Y%m%d).bak"
  fi
  rm -rf "$SRC_DIR" "$STACK_DIR" && gone 'каталоги удалены'
else
  skip 'исходники оставлены'
fi

# --- итог -------------------------------------------------------------

say 'Готово'
docker ps -a --filter 'name=docmost' --format '{{.Names}}' | grep -q . \
  && item 'внимание: остались контейнеры со словом docmost в имени' \
  || item 'контейнеров Docmost не осталось'

if [ "$WITH_DATA" -eq 0 ]; then
  echo
  item 'Тома с данными на месте. Полностью убрать:'
  item '  docker volume rm docmost-stack_db_data docmost-stack_docmost_storage docmost-stack_redis_data'
fi

df -h / | tail -1 | sed 's/^/  свободно на диске: /'
