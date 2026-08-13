<#
.SYNOPSIS
  Установка Docmost с нашими правками на Windows-сервер.

.DESCRIPTION
  Docmost живёт в контейнерах внутри WSL2. Этот скрипт готовит хост:
  проверяет и при необходимости ставит WSL, дистрибутив и Docker, а
  дальше передаёт дело deploy/install-linux.sh — чтобы само
  развёртывание было описано в одном месте, а не в двух.

  Что делает по шагам:
    1. проверяет права, версию Windows, поддержку виртуализации;
    2. ставит WSL2 и Ubuntu, если их нет (потребуется перезагрузка);
    3. правит .wslconfig, если виртуалке отведено мало памяти;
    4. ставит Docker внутри дистрибутива;
    5. забирает исходники и разворачивает стек;
    6. по желанию настраивает IIS, файрвол и автозапуск.

  Идемпотентный: повторный запуск обновляет код и пересобирает образ,
  но не трогает базу, тома и уже заполненный .env.

.PARAMETER AppUrl
  Адрес, по которому вики будет открываться. Обязателен, кроме -CheckOnly.

.PARAMETER CheckOnly
  Только проверить окружение и ничего не менять.

.PARAMETER UseGithub
  Брать код с GitHub, а не из внутреннего GitLab.

.PARAMETER SiteIp
  Если задан — после установки настроить IIS на этот адрес.

.EXAMPLE
  .\install.ps1 -CheckOnly

.EXAMPLE
  .\install.ps1 -AppUrl https://wiki.example.ru -SiteIp 192.168.88.238
#>
[CmdletBinding()]
param(
    [string] $AppUrl,
    [switch] $CheckOnly,
    [switch] $UseGithub,
    [string] $SiteIp,
    [string] $WslDistro = "Ubuntu-24.04",
    [int]    $WslMemoryGb = 8
)

$ErrorActionPreference = "Stop"
$script:Problems = 0
$script:NeedReboot = $false

function Ok   { param($m) Write-Host "  [+] $m" -ForegroundColor Green }
function Bad  { param($m) Write-Host "  [-] $m" -ForegroundColor Red; $script:Problems++ }
function Warn { param($m) Write-Host "  [!] $m" -ForegroundColor Yellow }
function Step { param($m) Write-Host ""; Write-Host $m -ForegroundColor White }

# --- 1. хост ----------------------------------------------------------

Step "Проверяю Windows"

$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) { Ok "запущено от администратора" }
else { Bad "нужен PowerShell от администратора" }

$build = [int](Get-CimInstance Win32_OperatingSystem).BuildNumber
$caption = (Get-CimInstance Win32_OperatingSystem).Caption
if ($build -ge 19041) { Ok "$caption (сборка $build)" }
else { Bad "$caption (сборка $build) — для WSL2 нужна 19041 или новее" }

# Виртуализация: без неё WSL2 не заведётся, а сообщение будет невнятным
$virt = (Get-CimInstance Win32_ComputerSystem).HypervisorPresent
if ($virt) {
    Ok "виртуализация включена"
} else {
    $fw = (Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled
    if ($fw) { Warn "гипервизор не запущен, но в BIOS виртуализация включена" }
    else { Bad "виртуализация выключена в BIOS — включите VT-x/AMD-V" }
}

$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGb -ge 8) { Ok "оперативной памяти $ramGb ГБ" }
else { Bad "оперативной памяти $ramGb ГБ — сборке нужно от 8 ГБ на машине" }

$freeGb = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
if ($freeGb -ge 20) { Ok "на диске C свободно $freeGb ГБ" }
else { Bad "на диске C свободно $freeGb ГБ, нужно от 20 ГБ" }

# --- 2. WSL -----------------------------------------------------------

Step "Проверяю WSL"

$wslExe = "$env:windir\system32\wsl.exe"
$hasWsl = Test-Path $wslExe

if ($hasWsl) {
    # wsl.exe отвечает в UTF-16, поэтому нулевые байты убираем — иначе
    # сравнение не находит ничего и версия теряется
    $ver = ((& $wslExe --version 2>&1 | Out-String) -replace "`0", "")
    if ($ver -match '(\d+\.\d+\.\d+)') { Ok "WSL установлен ($($Matches[1]))" }
    else { Ok "WSL установлен" }
} else {
    Bad "WSL не установлен"
}

$distros = @()
if ($hasWsl) {
    # -l -q выводит UTF-16 с нулевыми байтами, поэтому чистим
    $distros = (& $wslExe -l -q 2>$null) |
        ForEach-Object { ($_ -replace "`0", "").Trim() } |
        Where-Object { $_ }
}

$hasDistro = $distros -contains $WslDistro
if ($hasDistro) { Ok "дистрибутив $WslDistro на месте" }
else { Warn "дистрибутива $WslDistro нет — поставлю" }

# Память виртуалки: сборка клиента прожорлива, на 6 ГБ она уже вешала
# машину, когда рядом работали другие контейнеры.
$wslConfig = Join-Path $env:USERPROFILE ".wslconfig"
if (Test-Path $wslConfig) {
    $cfg = Get-Content $wslConfig -Raw
    if ($cfg -match 'memory\s*=\s*(\d+)GB') {
        $mem = [int]$Matches[1]
        if ($mem -ge 6) { Ok ".wslconfig отдаёт виртуалке $mem ГБ" }
        else { Warn ".wslconfig отдаёт виртуалке всего $mem ГБ — сборка может не влезть" }
    } else {
        Warn ".wslconfig есть, но потолок памяти не задан"
    }
} else {
    Warn ".wslconfig не найден — создам с потолком $WslMemoryGb ГБ"
}

# --- 3. Docker внутри дистрибутива ------------------------------------

Step "Проверяю Docker внутри WSL"

$dockerOk = $false
if ($hasDistro) {
    $out = (& $wslExe -d $WslDistro -u root -- bash -lc "command -v docker >/dev/null && docker --version || echo НЕТ" 2>&1) -replace "`0", ""
    if ($out -match 'Docker version') {
        Ok ($out.Trim())
        $daemon = (& $wslExe -d $WslDistro -u root -- bash -lc "docker info >/dev/null 2>&1 && echo ЖИВ || echo МЁРТВ" 2>&1) -replace "`0", ""
        if ($daemon -match 'ЖИВ') { Ok "демон отвечает"; $dockerOk = $true }
        else { Warn "демон не запущен — подниму при установке" }
    } else {
        Warn "Docker внутри дистрибутива не установлен — поставлю"
    }
} else {
    Warn "проверю Docker после установки дистрибутива"
}

# --- 4. связь ---------------------------------------------------------

Step "Проверяю связь"

$repoHost = if ($UseGithub) { "github.com" } else { "gitlab.mp-lab.ru" }
foreach ($h in @($repoHost, "registry-1.docker.io")) {
    try {
        $null = Invoke-WebRequest -Uri "https://$h" -TimeoutSec 15 -UseBasicParsing
        Ok "$h отвечает"
    } catch {
        # 401/403 значит хост жив и отвечает — для нас этого достаточно
        if ($_.Exception.Response) { Ok "$h отвечает" }
        else { Bad "$h недоступен: $($_.Exception.Message)" }
    }
}

# --- итог проверки ----------------------------------------------------

if ($script:Problems -gt 0) {
    Write-Host ""
    Write-Host "Не выполнено условий: $($script:Problems). Исправьте и запустите снова." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Окружение пригодно." -ForegroundColor Green

if ($CheckOnly) { exit 0 }

if (-not $AppUrl) {
    Write-Host ""
    Write-Host "Нужен адрес вики, например:" -ForegroundColor Yellow
    Write-Host "  .\install.ps1 -AppUrl https://wiki.example.ru"
    exit 1
}

# --- 5. установка недостающего ---------------------------------------

if (-not $hasWsl -or -not $hasDistro) {
    Step "Ставлю WSL и $WslDistro"
    & $wslExe --install -d $WslDistro
    Warn "нужна перезагрузка, после неё запустите скрипт ещё раз"
    $script:NeedReboot = $true
}

if ($script:NeedReboot) {
    Write-Host ""
    Write-Host "Перезагрузите сервер и запустите скрипт снова." -ForegroundColor Yellow
    exit 0
}

if (-not (Test-Path $wslConfig)) {
    Step "Создаю .wslconfig"
    @"
[wsl2]
# Потолок памяти для виртуалки. Сборка клиента прожорлива: на шести
# гигабайтах она уже вешала машину, когда рядом работали контейнеры.
memory=${WslMemoryGb}GB
swap=2GB
localhostForwarding=true
"@ | Set-Content -Path $wslConfig -Encoding utf8
    Ok "создан $wslConfig — применится после wsl --shutdown"
}

if (-not $dockerOk) {
    Step "Ставлю Docker внутри $WslDistro"
    $install = @'
set -e
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
service docker start >/dev/null 2>&1 || true
docker --version
'@
    $install = $install -replace "`r`n", "`n"
    $tmp = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tmp -Value $install -Encoding utf8 -NoNewline
    $wslTmp = (& $wslExe -d $WslDistro -u root -- wslpath -a ($tmp -replace '\\','/')) -replace "`0", ""
    & $wslExe -d $WslDistro -u root -- bash $wslTmp.Trim()
    Remove-Item $tmp -Force
    Ok "Docker готов"
}

# --- 6. развёртывание -------------------------------------------------

Step "Разворачиваю стек внутри WSL"

$repo = if ($UseGithub) {
    "https://github.com/Altair666/docmost.git"
} else {
    "https://gitlab.mp-lab.ru/grist_additional_widgets/docmost.git"
}

# Дальше всё делает линуксовый скрипт: он лежит в самом репозитории,
# поэтому логика развёртывания описана один раз, а не по разу на каждую
# операционную систему.
$bootstrap = @"
set -e
if [ ! -d /opt/docmost/.git ]; then
  git clone --branch custom-sso-integration $repo /opt/docmost
fi
git -C /opt/docmost submodule update --init apps/server/src/custom-sso
chmod +x /opt/docmost/deploy/install-linux.sh
/opt/docmost/deploy/install-linux.sh --url '$AppUrl' --repo '$repo'
"@
$bootstrap = $bootstrap -replace "`r`n", "`n"

$tmp2 = [System.IO.Path]::GetTempFileName()
Set-Content -Path $tmp2 -Value $bootstrap -Encoding utf8 -NoNewline
$wslTmp2 = (& $wslExe -d $WslDistro -u root -- wslpath -a ($tmp2 -replace '\\','/')) -replace "`0", ""
& $wslExe -d $WslDistro -u root -- bash $wslTmp2.Trim()
$deployCode = $LASTEXITCODE
Remove-Item $tmp2 -Force

if ($deployCode -ne 0) {
    Write-Host ""
    Write-Host "Развёртывание не прошло, смотрите вывод выше." -ForegroundColor Red
    exit 1
}

# --- 7. хост: IIS, файрвол, автозапуск --------------------------------

if ($SiteIp) {
    Step "Настраиваю IIS и автозапуск"
    $hostScript = Join-Path $PSScriptRoot "setup-windows-host.ps1"
    if (Test-Path $hostScript) {
        & $hostScript -SiteIp $SiteIp -WslDistro $WslDistro
    } else {
        Warn "рядом нет setup-windows-host.ps1 — пропускаю"
    }
} else {
    Warn "IIS не настраивал: адрес сайта не задан (-SiteIp)"
}

# --- итог -------------------------------------------------------------

Write-Host ""
Write-Host "Готово." -ForegroundColor Green
Write-Host @"

  исходники:  \\wsl`$\$WslDistro\opt\docmost
  стек:       \\wsl`$\$WslDistro\opt\docmost-stack
  слушает:    127.0.0.1:3000 внутри WSL

Что дальше:
  1. Откройте $AppUrl и пройдите мастер настройки — первая учётка
     станет владельцем. Сверка с Keycloak её никогда не отключает.
  2. Настройте вход: Настройки -> Keycloak SSO. Клиенту нужна служебная
     учётка с правом view-users, иначе не заработает ежесуточная сверка
     заблокированных.
  3. Проверить состояние:
     wsl -d $WslDistro -u root -- docker ps
"@
