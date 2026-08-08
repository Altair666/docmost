<#
.SYNOPSIS
  Настройка Windows-хоста под Docmost: IIS reverse proxy, автозапуск WSL, файрвол.

.DESCRIPTION
  Docmost крутится в Docker внутри WSL2 и слушает 127.0.0.1:3000.
  Наружу его отдаёт IIS через ARR — на том же сервере может жить другой
  продакшн (у нас Altium 365 на 9780/9785), поэтому сайт вешается на
  конкретный IP, а не на *:80.

  Скрипт идемпотентный: повторный запуск ничего не ломает.
  Запускать в PowerShell от администратора.

.PARAMETER SiteIp
  IP, на который вешается сайт Docmost.

.PARAMETER KeycloakPort
  Порт Keycloak. Правило файрвола нужно, потому что без него Keycloak
  отвечает только с самой Windows: из WSL и из контейнера — таймаут.
  Передайте 0, чтобы пропустить этот шаг.

.EXAMPLE
  .\setup-windows-host.ps1 -SiteIp 192.168.88.238 -KeycloakPort 8080
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $SiteIp,
    [string] $SiteName = "Docmost",
    [string] $AppPool = "DocmostProxy",
    [string] $PhysicalPath = "C:\inetpub\docmost-proxy",
    [string] $WslDistro = "Ubuntu-24.04",
    [int]    $BackendPort = 3000,
    [int]    $KeycloakPort = 0
)

$ErrorActionPreference = "Stop"
Import-Module WebAdministration

$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }

# --- 0. предусловия -----------------------------------------------------
Write-Step "Проверяю URL Rewrite и ARR"
$modules = Get-ItemProperty `
    HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*, `
    HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* `
    -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match 'Rewrite|Request Routing' } |
    Select-Object -ExpandProperty DisplayName

if (-not ($modules -match 'Rewrite')) {
    throw "Не установлен IIS URL Rewrite: https://www.iis.net/downloads/microsoft/url-rewrite"
}
if (-not ($modules -match 'Request Routing')) {
    throw "Не установлен Application Request Routing: https://www.iis.net/downloads/microsoft/application-request-routing"
}
if ((Get-WindowsFeature -Name Web-WebSockets).InstallState -ne 'Installed') {
    throw "Не установлена фича IIS Web-WebSockets — без неё редактор Docmost уйдёт в read-only"
}

# --- 1. ARR на уровне сервера -------------------------------------------
Write-Step "Включаю проксирование ARR"
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'enabled' -Value 'True'
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'preserveHostHeader' -Value 'True'
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'reverseRewriteHostInResponseHeaders' -Value 'False'
# без этого ломается стриминг (SSE) и живые обновления
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'responseBufferLimit' -Value 0

# --- 2. пул и сайт -------------------------------------------------------
Write-Step "Пул приложений $AppPool"
if (-not (Test-Path "IIS:\AppPools\$AppPool")) { New-WebAppPool -Name $AppPool | Out-Null }
Set-ItemProperty "IIS:\AppPools\$AppPool" -Name managedRuntimeVersion -Value ""      # No Managed Code
Set-ItemProperty "IIS:\AppPools\$AppPool" -Name startMode -Value "AlwaysRunning"
Set-ItemProperty "IIS:\AppPools\$AppPool" -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)
Set-ItemProperty "IIS:\AppPools\$AppPool" -Name recycling.periodicRestart.time -Value ([TimeSpan]::Zero)

Write-Step "Каталог сайта и web.config"
if (-not (Test-Path $PhysicalPath)) { New-Item -ItemType Directory -Path $PhysicalPath -Force | Out-Null }
$srcConfig = Join-Path $scriptDir "web.config"
if (-not (Test-Path $srcConfig)) { throw "Рядом со скриптом нет web.config" }
# -Encoding utf8: иначе комментарии превращаются в кракозябры
Copy-Item $srcConfig (Join-Path $PhysicalPath "web.config") -Force

if ($BackendPort -ne 3000) {
    $cfgPath = Join-Path $PhysicalPath "web.config"
    (Get-Content $cfgPath -Raw).Replace("http://localhost:3000/", "http://localhost:$BackendPort/") |
        Set-Content -Path $cfgPath -Encoding utf8
}

Write-Step "Сайт $SiteName на ${SiteIp}:80"
if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) { Remove-Website -Name $SiteName }
New-Website -Name $SiteName -PhysicalPath $PhysicalPath -ApplicationPool $AppPool `
            -IPAddress $SiteIp -Port 80 -HostHeader "" | Out-Null
Set-ItemProperty "IIS:\Sites\$SiteName" -Name serverAutoStart -Value $true

# --- 3. разрешение серверных переменных ---------------------------------
# Секция залочена на уровне сервера, из web.config не разрешается —
# только через applicationHost.config, то есть appcmd.
Write-Step "Разрешаю серверные переменные для сайта"
foreach ($v in @("HTTP_X_FORWARDED_PROTO", "HTTP_X_FORWARDED_HOST", "HTTP_X_FORWARDED_FOR")) {
    & $appcmd set config "$SiteName" -section:system.webServer/rewrite/allowedServerVariables /+"[name='$v']" /commit:apphost | Out-Null
}
& $appcmd list config "$SiteName" -section:system.webServer/rewrite/allowedServerVariables

# --- 4. файрвол ----------------------------------------------------------
Write-Step "Правила файрвола"
if (-not (Get-NetFirewallRule -DisplayName "Docmost HTTP (TCP 80)" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "Docmost HTTP (TCP 80)" -Direction Inbound -Protocol TCP `
        -LocalPort 80 -Action Allow -Profile Any | Out-Null
}
if ($KeycloakPort -gt 0) {
    $ruleName = "Keycloak (TCP $KeycloakPort)"
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP `
            -LocalPort $KeycloakPort -Action Allow -Profile Any `
            -Description "Без этого правила Keycloak отвечает только с самой Windows: из WSL и из контейнера Docmost — таймаут" | Out-Null
    }
    # WSL пробрасывает порт только на 127.0.0.1, для локалки нужен portproxy
    $existing = netsh interface portproxy show v4tov4 | Select-String "$SiteIp\s+$KeycloakPort"
    if (-not $existing) {
        netsh interface portproxy add v4tov4 listenaddress=$SiteIp listenport=$KeycloakPort `
              connectaddress=127.0.0.1 connectport=$KeycloakPort | Out-Null
    }
}

# --- 5. автозапуск WSL ---------------------------------------------------
# Действие намеренно долгоживущее (sleep infinity): WSL гасит виртуалку,
# когда из неё выходит последняя сессия, и вместе с ней падает Docmost.
Write-Step "Задача автозапуска WSL"
$taskName = "WSL-Docmost-Autostart"
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}
$action    = New-ScheduledTaskAction -Execute "C:\Windows\System32\wsl.exe" -Argument "-d $WslDistro -u root -e sleep infinity"
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\Administrator" -LogonType S4U -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) `
                                          -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
                       -Principal $principal -Settings $settings `
                       -Description "Держит WSL2 с Docker Engine запущенным с момента загрузки, чтобы Docmost поднимался без интерактивного логина" | Out-Null
Start-ScheduledTask -TaskName $taskName

# --- 6. проверка ---------------------------------------------------------
Write-Step "Проверяю"
Start-Sleep -Seconds 5
try {
    $r = Invoke-WebRequest -Uri "http://$SiteIp/" -UseBasicParsing -TimeoutSec 20
    Write-Host "  Docmost через IIS: HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Warning "  Docmost не ответил: $($_.Exception.Message)"
}

$ws = & curl.exe -s -o NUL -D - --max-time 8 `
        -H "Connection: Upgrade" -H "Upgrade: websocket" `
        -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" `
        "http://$SiteIp/collab" 2>&1 | Select-Object -First 1
if ($ws -match "101") {
    Write-Host "  WebSocket через ARR: 101 Switching Protocols" -ForegroundColor Green
} else {
    Write-Warning "  WebSocket не проходит ($ws) — редактор уйдёт в read-only"
}

Write-Host "Готово." -ForegroundColor Green
