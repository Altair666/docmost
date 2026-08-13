#!/usr/bin/env bash
# Отправка в оба места, но по очереди и с потолком по времени.
#
# Один общий push удобен, пока оба адреса отвечают. Стоит GitHub
# задуматься — вместе с ним висит и GitLab, и непонятно, что доехало.
# Поэтому здесь адреса разведены, и у каждого свой срок ожидания.
set -uo pipefail

push_one() { # каталог, имя удалённого, ветка
  cd "$1" || return 1
  local out
  out=$(timeout 180 git push "$2" "$3" 2>&1)
  local code=$?

  if [ $code -eq 124 ]; then
    echo "  $2: не дождался за 180 секунд"
  elif [ $code -ne 0 ]; then
    echo "  $2: не вышло — $(echo "$out" | tail -1)"
  elif echo "$out" | grep -q 'Everything up-to-date'; then
    echo "  $2: и так свежий"
  else
    echo "  $2: отправлено"
  fi
}

echo '=== серверный модуль ==='
push_one /opt/docmost/apps/server/src/custom-sso gitlab main
push_one /opt/docmost/apps/server/src/custom-sso origin main

echo '=== форк ==='
# У origin два адреса отправки, поэтому здесь только GitLab и GitHub
# по отдельности: gitlab добавлен своим именем, github — это первый
# адрес origin.
push_one /opt/docmost gitlab custom-sso-integration
push_one /opt/docmost origin custom-sso-integration

echo
echo '=== где какая вершина ==='
cd /opt/docmost
echo "  здесь:  $(git rev-parse --short=12 custom-sso-integration)"
for r in gitlab origin; do
  echo "  $r: $(timeout 60 git ls-remote "$r" refs/heads/custom-sso-integration 2>/dev/null | cut -c1-12)"
done
