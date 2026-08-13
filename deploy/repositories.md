# Где живёт код

Два репозитория, каждый в двух местах — GitHub и внутренний GitLab.

| что | GitHub | GitLab |
|---|---|---|
| форк Docmost | `Altair666/docmost`, ветка `custom-sso-integration` | `grist_additional_widgets/docmost` |
| серверный модуль | `Altair666/docmost-custom-sso`, ветка `main` | `grist_additional_widgets/docmost-custom-sso` |

Модуль подключён сабмодулем в `apps/server/src/custom-sso`.

## Отправка изменений

У `origin` один адрес для получения (GitHub) и два для отправки, поэтому
обычная команда уходит сразу в оба места:

```
git push origin custom-sso-integration
```

Проверить, что настроено именно так:

```
git remote -v | grep origin
```

Должно быть три строки: одна `(fetch)` и две `(push)`.

Правки в сабмодуле коммитятся и отправляются **отдельно и первыми**, и
только потом в форке обновляется указатель:

```
cd apps/server/src/custom-sso && git push origin main
cd - && git add apps/server/src/custom-sso && git commit && git push origin custom-sso-integration
```

## Доступ к GitLab

Токен лежит в `/root/.git-credentials` с правами 600, git подставляет его
сам через `credential.helper store`. В адресах удалённых токена нет —
иначе он светился бы в каждом `git remote -v` и в `.git/config`.

Сертификат у GitLab внутренний, поэтому для этого хоста проверка
отключена точечно:

```
git config --global http."https://gitlab.mp-lab.ru/".sslVerify false
```

## Что осталось на GitHub

Адрес сабмодуля в `.gitmodules` указывает на GitHub. Свежий клон из
GitLab потянет модуль всё равно оттуда — если нужна полная
независимость от GitHub, адрес надо переписать, но тогда сломаются
существующие клоны.
