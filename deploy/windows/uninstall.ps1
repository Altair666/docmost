<#
.SYNOPSIS
  Удаление Docmost с Windows-сервера.

.DESCRIPTION
  Снимает всё, что ставил установщик: стек в контейнерах, образы,
  исходники, сайт IIS с пулом, правила файрвола, проброс портов и задачу
  автозапуска WSL.

  По умолчанию только показывает план и ничего не трогает. Данные —
  база и вложения — удаляются лишь по отдельному требованию: взять их
  потом будет неоткуда.

  Сам WSL и дистрибутив не удаляются: там могут жить другие вещи (у нас
  это Keycloak и локальный Grist). Для полного сноса есть -RemoveDistro,
  и он спросит ещё раз.

.PARAMETER Yes
  Выполнить, а не только показать.

.PARAMETER WithData
  Удалить и данные: базу, вложения, Redis.

.PARAMETER RemoveDistro
  Снести весь дистрибутив WSL целиком.

.EXAMPLE
  .\uninstall.ps1

.EXAMPLE
  .\uninstall.ps1 -Yes
#>
[CmdletBinding()]
param(
    [switch] $Yes,
    [switch] $WithData,
    [switch] $RemoveDistro,
    [string] $WslDistro = "Ubuntu-24.04",
    [string] $SiteName  = "Docmost",
    [string] $AppPool   = "DocmostProxy",
    [string] $TaskName  = "WSL-Docmost-Autostart"
)

$ErrorActionPreference = "Stop"

function Item { param($m) Write-Host "  $m" }
function Gone { param($m) Write-Host "  [x] $m" -ForegroundColor Green }
function Skip { param($m) Write-Host "  [-] $m" -ForegroundColor DarkGray }
function Say  { param($m) Write-Host ""; Write-Host $m -ForegroundColor White }

$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Нужен PowerShell от администратора." -ForegroundColor Red
    exit 1
}

$wslExe = "$env:windir\system32\wsl.exe"

# --- что нашлось ------------------------------------------------------

Say "Нашёл на этом сервере"

$site = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($site) { Item "сайт IIS «$SiteName» ($($site.State))" } else { Item "сайта IIS нет" }

$pool = Get-Item "IIS:\AppPools\$AppPool" -ErrorAction SilentlyContinue
if ($pool) { Item "пул приложений «$AppPool»" }

# По точному имени, а не по совпадению слова: установщик создаёт одно
# правило — «Docmost HTTP (TCP 80)». Всё остальное на этой машине
# принадлежит другим службам, включая отладочные, и трогать его нельзя.
$ourRules = @('Docmost HTTP (TCP 80)')
$rules = Get-NetFirewallRule -ErrorAction SilentlyContinue |
    Where-Object { $ourRules -contains $_.DisplayName }
foreach ($r in $rules) { Item "правило файрвола «$($r.DisplayName)»" }

$proxy = netsh interface portproxy show v4tov4 | Select-String '\d+\.\d+\.\d+\.\d+'
if ($proxy) { Item "правил проброса портов: $($proxy.Count) — не наши, останутся" }

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) { Item "задача автозапуска «$TaskName»" }

$distros = (& $wslExe -l -q 2>$null) | ForEach-Object { ($_ -replace "`0", "").Trim() } | Where-Object { $_ }
if ($distros -contains $WslDistro) { Item "дистрибутив WSL «$WslDistro»" }

# --- план -------------------------------------------------------------

Say "Что будет сделано"
Item "внутри WSL: остановлен стек, удалены образы и исходники"
if ($WithData) {
    Write-Host "  УДАЛЕНЫ ДАННЫЕ: база, вложения, Redis — безвозвратно" -ForegroundColor Red
} else {
    Item "данные сохранены (удалить: -WithData)"
}
Item "удалены сайт IIS и пул приложений"
Item "удалено правило файрвола «Docmost HTTP (TCP 80)»"
Item "удалена задача автозапуска"
if ($RemoveDistro) {
    Write-Host "  УДАЛЁН ВЕСЬ ДИСТРИБУТИВ WSL со всем, что в нём есть" -ForegroundColor Red
} else {
    Item "дистрибутив WSL остаётся: в нём могут работать другие службы"
}

if (-not $Yes) {
    Write-Host ""
    Write-Host "Это был только план. Чтобы выполнить, добавьте -Yes" -ForegroundColor Yellow
    exit 0
}

if ($WithData -or $RemoveDistro) {
    Write-Host ""
    Write-Host "Удаление необратимо. Наберите УДАЛИТЬ, чтобы продолжить:" -ForegroundColor Red
    $answer = Read-Host
    if ($answer -ne 'УДАЛИТЬ') {
        Write-Host "Отменено." -ForegroundColor Yellow
        exit 0
    }
}

# --- внутри WSL -------------------------------------------------------

Say "Убираю внутри WSL"

if ($distros -contains $WslDistro) {
    $args = "--yes"
    if ($WithData) { $args += " --with-data" }
    $cmd = "if [ -x /opt/docmost/deploy/uninstall-linux.sh ]; then /opt/docmost/deploy/uninstall-linux.sh $args; else echo 'скрипта удаления нет, пропускаю'; fi"
    & $wslExe -d $WslDistro -u root -- bash -lc $cmd
} else {
    Skip "дистрибутива нет"
}

# --- IIS --------------------------------------------------------------

Say "Убираю на стороне Windows"

Import-Module WebAdministration -ErrorAction SilentlyContinue

if ($site) {
    Remove-Website -Name $SiteName
    Gone "сайт «$SiteName» удалён"
} else { Skip "сайта не было" }

if ($pool) {
    Remove-WebAppPool -Name $AppPool
    Gone "пул «$AppPool» удалён"
} else { Skip "пула не было" }

foreach ($r in $rules) {
    Remove-NetFirewallRule -Name $r.Name
    Gone "правило «$($r.DisplayName)» удалено"
}
if (-not $rules) { Skip "правил файрвола не было" }

# Проброс портов установщик заводит только для Keycloak, и только если
# его порт передали доводом. Keycloak — не наша служба, поэтому здесь
# ничего не снимаем: чужие правила должен убирать тот, кто их ставил.
Skip 'проброс портов не трогаю: он заводился под сторонние службы'

if ($task) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Gone "задача «$TaskName» удалена"
} else { Skip "задачи не было" }

# --- дистрибутив ------------------------------------------------------

if ($RemoveDistro -and ($distros -contains $WslDistro)) {
    Say "Удаляю дистрибутив"
    & $wslExe --unregister $WslDistro
    Gone "«$WslDistro» удалён вместе со всем содержимым"
}

# --- итог -------------------------------------------------------------

Say "Готово"
if (-not $WithData) {
    Item "Данные остались в томах Docker внутри WSL."
    Item "Убрать совсем: wsl -d $WslDistro -u root -- docker volume rm docmost-stack_db_data docmost-stack_docmost_storage docmost-stack_redis_data"
}
if (-not $RemoveDistro) {
    Item "Дистрибутив WSL на месте: в нём могли остаться другие службы."
}
$freeGb = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
Item "на диске C свободно: $freeGb ГБ"
Item "Место, занятое диском WSL, само не вернётся — сжать: diskpart -> compact vdisk"
