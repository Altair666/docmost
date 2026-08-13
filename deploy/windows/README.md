# Развёртывание на Windows Server

Docmost работает в Docker внутри WSL2 и слушает `127.0.0.1:3000`.
Наружу его отдаёт IIS через ARR. На том же сервере может жить другой
продакшн, поэтому сайт вешается на конкретный IP, а не на `*:80`.

```
Windows Server
├── IIS
│   ├── чужие сайты (например Altium 365 на 9780/9785)
│   └── Docmost  ──ARR──► localhost:3000
└── WSL2 (Ubuntu, systemd)
    └── Docker Engine
        ├── docmost-custom:vN
        ├── postgres
        └── redis
```

## Файлы

| Файл | Что делает |
|---|---|
| `web.config` | правила проксирования: rewrite на `localhost:3000`, заголовки `X-Forwarded-*`, проброс ACME-challenge |
| `setup-windows-host.ps1` | создаёт пул и сайт IIS, включает ARR, разрешает серверные переменные, заводит правила файрвола и задачу автозапуска WSL |

## Порядок

1. Поставить **IIS URL Rewrite** и **Application Request Routing** — скрипт без них откажется работать.
   Установка ARR перезапускает IIS: если на сервере живой продакшн, делать в окно обслуживания.
2. Убедиться, что включена фича IIS `Web-WebSockets`.
3. Запустить из PowerShell от администратора:

```powershell
.\setup-windows-host.ps1 -SiteIp 192.168.88.238 -KeycloakPort 8080
```

Скрипт идемпотентный, повторный запуск ничего не ломает. В конце он сам
проверяет, что Docmost отвечает и что WebSocket отдаёт `101`.

## Грабли, на которые уже наступили

**ARR пишет `X-Forwarded-For` вместе с портом** (`10.0.0.5:61666`), а Docmost
сохраняет это значение в колонку типа `inet` — логин через прокси падает с 500
и `PostgresError: invalid input syntax for type inet` (код 22P02). Через
`localhost:3000` при этом всё работает, поэтому симптом легко списать на что
угодно другое. Лечится перезаписью заголовка на `{REMOTE_ADDR}` — это уже
сделано в `web.config`.

**Секция `allowedServerVariables` залочена** на уровне сервера и из
`web.config` не разрешается. Только `appcmd ... /commit:apphost` — скрипт
делает это сам. Если пропустить, каждый запрос отвечает `500.19`.

**WebSocket нельзя настраивать в `web.config`**: секция
`system.webServer/webSocket` тоже залочена, а на уровне сервера уже
`enabled="true"`. Попытка объявить её в `web.config` даёт `500.19`. Без
работающего Upgrade редактор Docmost молча уходит в read-only — без ошибки в
консоли, просто перестаёт сохранять.

**WSL гасит виртуалку**, когда из неё выходит последняя сессия — вместе с ней
падают все контейнеры. Поэтому задача автозапуска держит долгоживущий процесс
(`sleep infinity`), а не просто «стартует дистрибутив».

**Keycloak на отдельном порту недоступен из контейнера** без правила файрвола:
WSL пробрасывает порт только на `127.0.0.1`, наружу его отдаёт `netsh portproxy`,
а это уже обычное входящее соединение, которое файрвол режет по умолчанию.
Симптом — `Connect Timeout Error` в логах Docmost при том, что из браузера на
самом сервере Keycloak открывается.

## HTTPS

Правило `ACME challenge passthrough` в `web.config` уже заложено. Когда
появится домен и A-запись, выпуск сертификата через
[win-acme](https://www.win-acme.com/): `wacs.exe` → выбрать сайт → HTTP-01.
Порт 80 должен быть проброшен снаружи, иначе нужен DNS-01.

## Как запускать install.ps1

PowerShell по умолчанию не выполняет неподписанные скрипты (`RemoteSigned`
у нас в `LocalMachine`), поэтому политику обходим на один запуск — она
при этом нигде не меняется:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly
```

Только проверка окружения, ничего не меняется. Когда всё зелёное:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 `
  -AppUrl https://wiki.example.ru -SiteIp 192.168.88.238
```

Обязательно **от администратора** — иначе скрипт сразу это скажет и
остановится.

### Если файл скачали браузером

Windows помечает скачанные файлы, и PowerShell откажется их выполнять со
словами «не является подписанным цифровой подписью». Снимается меткой:

```powershell
Unblock-File .\install.ps1
```

### Как забрать установщик на чистую машину

Там ещё нет ни git, ни репозитория. Проект в GitLab закрытый, поэтому
обычная ссылка не подойдёт — нужен запрос к API с токеном:

```powershell
$token = '<токен GitLab>'
$url = 'https://gitlab.mp-lab.ru/api/v4/projects/' +
       'grist_additional_widgets%2Fdocmost/repository/files/' +
       'deploy%2Fwindows%2Finstall.ps1/raw?ref=custom-sso-integration'

# Сертификат у GitLab внутренний: на чистой машине проверка не пройдёт
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

Invoke-WebRequest -Uri $url -Headers @{ 'PRIVATE-TOKEN' = $token } `
  -OutFile install.ps1 -UseBasicParsing
```

Проверено: скачивается 13.7 КБ и разбирается без ошибок.

Дальше скрипт сам поставит WSL, дистрибутив и Docker, заберёт остальной
код и развернёт стек.

### Если правите скрипт

Сохранять только в **UTF-8 с BOM**. PowerShell 5.1 читает `.ps1` как
ANSI, и файл без метки превращается в кашу: русские строки ломаются, а
разбор падает с десятком невнятных ошибок. На этом уже спотыкались.

## Установщик одним файлом

`DocmostInstaller.exe` — тот же `install.ps1`, упакованный в исполняемый
файл. Нужен, чтобы запускать двойным щелчком: без обхода политики
запуска, без `Unblock-File` и без объяснений про PowerShell. Права
администратора он просит сам.

```
DocmostInstaller.exe -CheckOnly
DocmostInstaller.exe -AppUrl https://wiki.example.ru -SiteIp 192.168.88.238
```

Что важно знать, прежде чем нести его людям:

- **это не компиляция.** ps2exe кладёт скрипт в оболочку на .NET,
  внутри тот же PowerShell. Поведение ровно то же, выигрыш только в
  удобстве запуска;
- **файл не подписан.** На чужой машине SmartScreen скажет «Windows
  защитила ваш компьютер» — нужно нажать «Подробнее» → «Выполнить в
  любом случае». Антивирус тоже может насторожиться: упакованные
  скрипты подозрительны для него сами по себе. Если раздавать людям —
  подписать сертификатом организации;
- **он не обновляется сам.** Поправили `install.ps1` — пересоберите,
  иначе останетесь со старым поведением:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-exe.ps1
```

Для сборки нужен модуль `ps2exe`:

```powershell
Install-PackageProvider -Name NuGet -Force -Scope CurrentUser
Install-Module ps2exe -Scope CurrentUser -Force
```
