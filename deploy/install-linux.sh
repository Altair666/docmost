#!/usr/bin/env bash
#
# Развёртывание Docmost с нашими правками на чистом Linux-сервере.
#
#   ./install-linux.sh --check              только проверить окружение
#   ./install-linux.sh --url http://wiki    поставить и запустить
#
# Скрипт идемпотентный: повторный запуск обновляет код и пересобирает
# образ, но не трогает базу, тома и уже заполненный .env.
#
# Ставится всё в контейнерах: на хосте нужен только Docker и git.
set -uo pipefail

# --- настройки по умолчанию -------------------------------------------

REPO_GITLAB=https://gitlab.mp-lab.ru/grist_additional_widgets/docmost.git
REPO_GITHUB=https://github.com/Altair666/docmost.git
BRANCH=custom-sso-integration

SRC_DIR=${SRC_DIR:-/opt/docmost}
STACK_DIR=${STACK_DIR:-/opt/docmost-stack}

REPO="$REPO_GITLAB"
APP_URL=""
BIND="127.0.0.1:3000"
CHECK_ONLY=0
TAG=""

# Сколько нужно на сборку. Цифры не с потолка: на 6 ГБ сборка клиента
# уже вешала машину, когда рядом работали другие контейнеры.
MIN_FREE_MB=4000
MIN_DISK_GB=10

# --- разбор доводов ---------------------------------------------------

while [ $# -gt 0 ]; do
  case "$1" in
    --check)    CHECK_ONLY=1 ;;
    --github)   REPO="$REPO_GITHUB" ;;
    --repo)     REPO="$2"; shift ;;
    --url)      APP_URL="$2"; shift ;;
    --bind)     BIND="$2"; shift ;;
    --tag)      TAG="$2"; shift ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "не понимаю довод: $1"; exit 1 ;;
  esac
  shift
done

# --- оформление -------------------------------------------------------

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; PROBLEMS=$((PROBLEMS+1)); }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

PROBLEMS=0

# --- проверки ---------------------------------------------------------

step 'Проверяю окружение'

if [ "$(id -u)" -eq 0 ]; then
  ok 'запущено от root'
else
  bad 'нужен root: sudo ./install-linux.sh …'
fi

if command -v git >/dev/null 2>&1; then
  ok "git есть ($(git --version | awk '{print $3}'))"
else
  bad 'нет git — поставьте: apt install git / dnf install git'
fi

if command -v docker >/dev/null 2>&1; then
  ok "docker есть ($(docker --version | awk '{print $3}' | tr -d ,))"
  if docker info >/dev/null 2>&1; then
    ok 'демон docker отвечает'
  else
    bad 'демон docker не отвечает — systemctl start docker'
  fi
else
  bad 'нет docker — https://docs.docker.com/engine/install/'
fi

if docker compose version >/dev/null 2>&1; then
  ok "плагин compose есть ($(docker compose version --short 2>/dev/null))"
else
  bad 'нет плагина docker compose (пакет docker-compose-plugin)'
fi

# Сборщик BuildKit нужен для многослойной сборки из нашего Dockerfile
if docker buildx version >/dev/null 2>&1; then
  ok 'buildx на месте'
else
  warn 'нет buildx — сборка пойдёт старым способом, это медленнее'
fi

FREE_MB=$(free -m | awk '/^Mem:/ {print $7}')
if [ "${FREE_MB:-0}" -ge "$MIN_FREE_MB" ]; then
  ok "свободной памяти ${FREE_MB} МБ"
else
  bad "свободно ${FREE_MB} МБ, а сборке нужно от ${MIN_FREE_MB} МБ — погасите лишнее"
fi

DISK_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
if [ "${DISK_GB:-0}" -ge "$MIN_DISK_GB" ]; then
  ok "на диске свободно ${DISK_GB} ГБ"
else
  bad "на диске ${DISK_GB} ГБ, нужно от ${MIN_DISK_GB} ГБ"
fi

if command -v openssl >/dev/null 2>&1; then
  ok 'openssl есть (нужен для паролей)'
else
  warn 'нет openssl — пароли возьму из /dev/urandom'
fi

step 'Проверяю связь'
for host in "$REPO" https://registry-1.docker.io; do
  name=$(echo "$host" | sed -E 's#https?://([^/]+).*#\1#')
  if curl -sk --max-time 15 -o /dev/null "https://$name"; then
    ok "$name отвечает"
  else
    bad "$name недоступен"
  fi
done

if [ "$PROBLEMS" -gt 0 ]; then
  printf '\n\033[31mНе хватает %d условий — исправьте и запустите снова.\033[0m\n' "$PROBLEMS"
  exit 1
fi

printf '\n\033[32mОкружение готово.\033[0m\n'
[ "$CHECK_ONLY" -eq 1 ] && exit 0

if [ -z "$APP_URL" ]; then
  echo
  echo 'Нужен адрес, по которому вики будет открываться, например:'
  echo '  ./install-linux.sh --url https://wiki.example.ru'
  exit 1
fi

# --- исходники --------------------------------------------------------

step 'Забираю исходники'

if [ -d "$SRC_DIR/.git" ]; then
  echo "  уже есть в $SRC_DIR, обновляю"
  git -C "$SRC_DIR" fetch --quiet origin "$BRANCH" || true
  git -C "$SRC_DIR" checkout --quiet "$BRANCH"
  git -C "$SRC_DIR" pull --quiet --ff-only origin "$BRANCH" || \
    warn 'обновить не вышло, собираю то, что лежит'
else
  # Ветку указываем явно: по умолчанию у GitHub стоит main — чистый
  # апстрим Docmost без наших правок.
  git clone --branch "$BRANCH" "$REPO" "$SRC_DIR" || exit 1
fi

# Сабмодуль ee приватный у docmost и для сборки не нужен, поэтому
# берём поимённо только свой.
git -C "$SRC_DIR" submodule update --init apps/server/src/custom-sso || {
  echo '  не смог получить модуль custom-sso — без него сборка не пройдёт'
  exit 1
}
ok "исходники в $SRC_DIR ($(git -C "$SRC_DIR" rev-parse --short HEAD))"

# --- стек и .env ------------------------------------------------------

step 'Готовлю стек'

mkdir -p "$STACK_DIR"
cp "$SRC_DIR/deploy/docker-compose.yml" "$STACK_DIR/docker-compose.yml"
ok "compose положен в $STACK_DIR"

rnd() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

if [ -f "$STACK_DIR/.env" ]; then
  ok '.env уже есть, не трогаю (пароли остаются прежними)'
else
  cat > "$STACK_DIR/.env" <<ENV
# ---- создано установщиком, пароли случайные ----
APP_URL=$APP_URL
APP_SECRET=$(rnd 32)
JWT_TOKEN_EXPIRES_IN=30d

# Наружу отдаёт обратный прокси, поэтому слушаем петлю.
DOCMOST_BIND=$BIND

POSTGRES_DB=docmost
POSTGRES_USER=docmost
POSTGRES_PASSWORD=$(rnd 16)

# ---- Keycloak: можно заполнить здесь, можно в интерфейсе ----
CUSTOM_OIDC_ISSUER=
CUSTOM_OIDC_CLIENT_ID=
CUSTOM_OIDC_CLIENT_SECRET=
CUSTOM_OIDC_REDIRECT_URI=$APP_URL/api/auth/oidc/callback
ENV
  chmod 600 "$STACK_DIR/.env"
  ok '.env создан, пароли сгенерированы'
fi

# --- сборка -----------------------------------------------------------

step 'Собираю образ'

if [ -z "$TAG" ]; then
  # Номер сборки — от даты: он же ляжет в бейдж настроек.
  TAG=$(date +%y%m%d)
fi

echo "  тег: docmost-custom:v$TAG (сборка идёт 10–20 минут)"
if docker build --build-arg CUSTOM_BUILD="$TAG" \
     -t "docmost-custom:v$TAG" "$SRC_DIR" > "$STACK_DIR/build.log" 2>&1; then
  ok 'образ собран'
else
  bad "сборка не прошла, смотрите $STACK_DIR/build.log"
  tail -20 "$STACK_DIR/build.log"
  exit 1
fi

grep -q '^DOCMOST_IMAGE_TAG=' "$STACK_DIR/.env" \
  && sed -i "s/^DOCMOST_IMAGE_TAG=.*/DOCMOST_IMAGE_TAG=v$TAG/" "$STACK_DIR/.env" \
  || echo "DOCMOST_IMAGE_TAG=v$TAG" >> "$STACK_DIR/.env"

# --- запуск -----------------------------------------------------------

step 'Запускаю'

cd "$STACK_DIR"
docker compose up -d 2>&1 | tail -4

echo '  жду, пока поднимется…'
for _ in $(seq 1 60); do
  if docker compose logs docmost 2>/dev/null | grep -q 'Nest application successfully started'; then
    break
  fi
  sleep 3
done

if docker compose logs docmost 2>/dev/null | grep -q 'Nest application successfully started'; then
  ok 'Docmost запустился'
else
  bad 'не дождался запуска, смотрите: docker compose logs docmost'
  exit 1
fi

PORT=${BIND##*:}
if curl -s --max-time 15 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login" | grep -q 200; then
  ok "страница входа отвечает на 127.0.0.1:$PORT"
else
  warn 'страница входа пока не отвечает — подождите полминуты'
fi

# --- итог -------------------------------------------------------------

cat <<FIN

$(printf '\033[1mГотово.\033[0m')

  исходники:  $SRC_DIR
  стек:       $STACK_DIR
  образ:      docmost-custom:v$TAG
  слушает:    $BIND

Что дальше:
  1. Направьте на этот порт обратный прокси (nginx, IIS) на адрес $APP_URL.
  2. Откройте $APP_URL и пройдите мастер настройки — первая учётка
     станет владельцем. Её сверка с Keycloak никогда не отключает.
  3. Настройте вход через Keycloak: Настройки → Keycloak SSO.
     Клиенту нужна служебная учётка с правом view-users, иначе не будет
     работать ежесуточная сверка заблокированных.

Обновиться потом: этот же скрипт с теми же доводами — база и тома
останутся на месте.
FIN
