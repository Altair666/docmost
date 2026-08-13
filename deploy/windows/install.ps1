<#
.SYNOPSIS
  Установка Docmost с нашими правками на Windows.

.DESCRIPTION
  Docmost живёт в контейнерах внутри WSL2. Скрипт готовит хост и
  разворачивает стек.

  Работает в четыре захода, и порядок здесь принципиален:

    1. ОПИСЬ. Собираем состояние всего, что нужно, и ничего не меняем.
    2. ПЛАН. Показываем, что будет установлено и изменено.
    3. УСТАНОВКА. Ставим недостающее в порядке зависимостей.
    4. РАЗВЁРТЫВАНИЕ. Передаём дело deploy/install-linux.sh, чтобы
       порядок развёртывания был описан один раз, а не по разу на
       систему.

  Раньше проверки и установка шли вперемешку: скрипт узнавал о нехватке
  очередного компонента посреди работы. Так нельзя — человек должен
  видеть весь список заранее.

  Годится и для Windows Server: набор компонентов тот же, но у старых
  серверных выпусков поддержка WSL2 неполная, о чём скрипт предупредит.

  Идемпотентный: повторный запуск обновляет код и пересобирает образ, но
  не трогает базу, тома и уже заполненный .env.

.PARAMETER AppUrl
  Адрес, по которому будет открываться вики. Обязателен, кроме -CheckOnly.

.PARAMETER CheckOnly
  Только опись и план, ничего не менять.

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
$script:Todo = @()
$script:NeedReboot = $false
$script:StepNo = 0
$script:StepTotal = 4
$script:Started = Get-Date
$script:LogFile = Join-Path $env:TEMP ("docmost-install-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))

$wslExe = "$env:windir\system32\wsl.exe"

# ----------------------------------------------------------------------
# Вывод
# ----------------------------------------------------------------------

function Log {
    param($m)
    try { Add-Content -Path $script:LogFile -Value $m -Encoding utf8 } catch { }
}

function Ok   { param($m) Write-Host "  [+] $m" -ForegroundColor Green;  Log "  [+] $m" }
function Bad  { param($m) Write-Host "  [-] $m" -ForegroundColor Red;    Log "  [-] $m"; $script:Problems++ }
function Warn { param($m) Write-Host "  [!] $m" -ForegroundColor Yellow; Log "  [!] $m" }
function Note { param($m) Write-Host "  $m" -ForegroundColor DarkGray;   Log "  $m" }

function Step {
    param($m)
    $script:StepNo++
    $t = "{0:mm\:ss}" -f ((Get-Date) - $script:Started)
    Write-Host ""
    Write-Host ("[{0}/{1}] {2}" -f $script:StepNo, $script:StepTotal, $m) -ForegroundColor White -NoNewline
    Write-Host ("   (прошло {0})" -f $t) -ForegroundColor DarkGray
    Log ""
    Log ("[{0}/{1}] {2}   (прошло {3})" -f $script:StepNo, $script:StepTotal, $m, $t)
}

# Записываем, что придётся сделать. Список показывается целиком перед
# установкой — в этом весь смысл разделения на опись и работу.
function Todo {
    param([string] $Key, [string] $Text)
    $script:Todo += [pscustomobject]@{ Key = $Key; Text = $Text }
}

function Need { param([string] $Key) return ($script:Todo | Where-Object { $_.Key -eq $Key }).Count -gt 0 }

# Запущено щелчком или из консоли: своё окно закроется вместе с нами и
# унесёт итог. Спрашиваем у консоли, сколько процессов к ней подключено.
$script:Interactive = $false
try {
    if (-not ('ConsoleHelper' -as [type])) {
        Add-Type -Namespace '' -Name ConsoleHelper -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
public static extern uint GetConsoleProcessList(uint[] lpdwProcessList, uint dwProcessCount);
'@
    }
    $buf = New-Object uint32[] 16
    $script:Interactive = ([ConsoleHelper]::GetConsoleProcessList($buf, 16) -le 1)
} catch { $script:Interactive = $false }

function Hold {
    if ($script:Interactive) {
        Write-Host ""
        Write-Host "Нажмите любую клавишу, чтобы закрыть окно…" -ForegroundColor DarkGray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

function Die {
    param([string] $Message, [string[]] $Hints = @())
    Write-Host ""
    Write-Host $Message -ForegroundColor Red
    Log "ОТКАЗ: $Message"
    foreach ($h in $Hints) { Note $h }
    Write-Host "Журнал: $script:LogFile" -ForegroundColor DarkGray
    Hold
    exit 1
}

trap {
    Write-Host ""
    Write-Host "Установка прервалась." -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    if ($_.InvocationInfo) {
        Write-Host "  строка $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())" -ForegroundColor DarkGray
    }
    Log "ОШИБКА: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Журнал: $script:LogFile" -ForegroundColor DarkGray
    Hold
    exit 1
}

# ----------------------------------------------------------------------
# Работа с WSL
# ----------------------------------------------------------------------

# Запуск wsl.exe с чтением ответа.
#
# Кодировка не одна: собственные сообщения wsl.exe идут в UTF-16, а вывод
# команды изнутри дистрибутива — в UTF-8. Определить по содержимому
# нельзя, байты UTF-16 с кириллицей оказываются формально допустимым
# UTF-8 и молча читаются мусором. Поэтому указываем явно.
function Invoke-Wsl {
    param(
        [Parameter(Mandatory = $true)] [string[]] $WslArgs,
        [switch] $Utf16
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $wslExe
    # ArgumentList есть только в новой .NET; в PowerShell 5.1 старая.
    $psi.Arguments = (($WslArgs | ForEach-Object {
        $v = [string]$_
        if ($v -match '\s') { '"' + $v + '"' } else { $v }
    }) -join ' ')
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    $out = New-Object System.IO.MemoryStream
    $err = New-Object System.IO.MemoryStream
    $proc.StandardOutput.BaseStream.CopyTo($out)
    $proc.StandardError.BaseStream.CopyTo($err)
    $proc.WaitForExit()

    $enc = if ($Utf16) { [System.Text.Encoding]::Unicode } else { [System.Text.Encoding]::UTF8 }
    $text = (($enc.GetString($out.ToArray()) + "`n" + $enc.GetString($err.ToArray())) -replace "`0", "").Trim()

    return [pscustomobject]@{ Text = $text; Code = $proc.ExitCode }
}

# То же, но с живым выводом: сборку надо видеть по ходу. Каждая строка
# идёт и на экран, и в журнал — иначе при сбое не остаётся следов.
# Консоль после вызова возвращается в прежнее состояние: wsl.exe меняет
# её кодовую страницу, и русский текст после него читается кашей.
function Invoke-WslLive {
    param([string[]] $WslArgs)

    $prev = $null
    try { $prev = [Console]::OutputEncoding } catch { }
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
        & $wslExe @WslArgs 2>&1 | ForEach-Object {
            $line = [string]$_
            Write-Host $line
            Log $line
        }
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevPref
        if ($prev) { try { [Console]::OutputEncoding = $prev } catch { } }
    }
}

# Временный скрипт для запуска внутри WSL: без метки порядка байтов и с
# переводами строк в один знак. Set-Content -Encoding utf8 в PowerShell
# 5.1 дописывает метку, и bash спотыкается о неё на первой же строке.
function Write-WslScript {
    param([string] $Path, [string] $Body)
    $clean = $Body -replace "`r`n", "`n"
    [System.IO.File]::WriteAllText($Path, $clean, (New-Object System.Text.UTF8Encoding($false)))
}

# Отзывается ли дистрибутив вообще. Без этой проверки любая команда
# внутри него отказывает по одной и той же причине, а выглядит каждый
# раз по-новому: то файл не записался, то имена не разрешились.
function Assert-Distro {
    param([string] $Name)

    $probe = Invoke-Wsl @('-d', $Name, '-u', 'root', '--', 'echo', 'отзывается')
    if ($probe.Code -eq 0 -and $probe.Text -match 'отзывается') { return }

    $list = ((Invoke-Wsl @('-l', '-q') -Utf16).Text -split "`n") |
        ForEach-Object { $_.Trim() } | Where-Object { $_ }

    # Когда дистрибутива нет, отвечает сам wsl.exe, а он говорит в
    # UTF-16 — прочитанный как UTF-8, его ответ превращается в кашу.
    $readable = (Invoke-Wsl @('-d', $Name, '-u', 'root', '--', 'true') -Utf16).Text
    if (-not $readable) { $readable = $probe.Text }

    Log "проверка дистрибутива «$Name»: код $($probe.Code), ответ: $readable"

    $hints = @("ответ системы: $readable")
    if ($list) {
        $hints += "установленные дистрибутивы: " + ($list -join ', ')
        $hints += "запустите с нужным именем: -WslDistro <имя из списка>"
    } else {
        $hints += 'установленных дистрибутивов нет вовсе'
    }

    Die "Дистрибутив «$Name» не отзывается." $hints
}

function Get-WslVersion {
    param([string] $Name)
    $out = Invoke-Wsl @('-l', '-v') -Utf16
    foreach ($line in ($out.Text -split "`n")) {
        $clean = ($line -replace '^\s*\*\s*', '').Trim()
        if (-not $clean) { continue }
        $parts = $clean -split '\s{1,}'
        if ($parts.Count -ge 3 -and $parts[0] -eq $Name) { return [int]($parts[-1]) }
    }
    return 0
}

# Установлен ли компонент ядра WSL2. Три способа: старые сборки не знают
# «--version», поэтому одного признака мало.
function Test-Wsl2Kernel {
    $v = Invoke-Wsl @('--version') -Utf16
    if ($v.Code -eq 0 -and $v.Text -match '(ядра|[Kk]ernel)\D*([\d.]+)') {
        return [pscustomobject]@{ Present = $true; Detail = "версия $($Matches[2])" }
    }

    $paths = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    $pkg = Get-ItemProperty $paths -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -match 'Subsystem for Linux' } | Select-Object -First 1
    if ($pkg) { return [pscustomobject]@{ Present = $true; Detail = "пакет $($pkg.DisplayVersion)" } }

    foreach ($f in @((Join-Path $env:ProgramFiles 'WSL\tools\kernel'), "$env:windir\System32\lxss\tools\kernel")) {
        if (Test-Path $f) { return [pscustomobject]@{ Present = $true; Detail = 'файл ядра на месте' } }
    }

    return [pscustomobject]@{ Present = $false; Detail = 'не найден' }
}

# Ядро WSL2 — отдельный компонент. Без него вторая версия не включается.
function Install-Wsl2Kernel {
    Note 'ставлю компонент ядра WSL2'

    $upd = Invoke-Wsl @('--update') -Utf16
    Log "wsl --update: код $($upd.Code), ответ: $($upd.Text)"
    if ($upd.Code -eq 0 -and (Test-Wsl2Kernel).Present) {
        Ok 'ядро обновлено штатным способом'
        return $true
    }

    # Старые сборки не умеют --update. Берём пакет напрямую — тот самый,
    # на который ведёт ссылка из сообщения об ошибке.
    $url = 'https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi'
    $msi = Join-Path $env:TEMP 'wsl_update_x64.msi'
    try {
        Note 'скачиваю пакет обновления ядра (16 МБ)'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing -TimeoutSec 300
        Note 'устанавливаю'
        $proc = Start-Process msiexec.exe -ArgumentList '/i', "`"$msi`"", '/qn', '/norestart' -Wait -PassThru
        Log "msiexec: код $($proc.ExitCode)"
        Remove-Item $msi -Force -ErrorAction SilentlyContinue
        if ($proc.ExitCode -eq 0 -or $proc.ExitCode -eq 3010) {
            Ok 'компонент ядра установлен'
            return $true
        }
        Warn "установка пакета вернула код $($proc.ExitCode)"
        return $false
    } catch {
        Warn "не удалось поставить ядро: $($_.Exception.Message)"
        Log "скачивание ядра: $($_.Exception.Message)"
        return $false
    }
}

# ======================================================================
# 1. ОПИСЬ — только смотрим, ничего не меняем
# ======================================================================

Log ("Установщик Docmost, запуск {0:dd.MM.yyyy HH:mm:ss}" -f (Get-Date))
Step 'Опись: что уже есть'

# --- права и система ---

$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) { Ok 'запущено от администратора' } else { Bad 'нужен PowerShell от администратора' }

$os = Get-CimInstance Win32_OperatingSystem
$build = [int]$os.BuildNumber
$isServer = ($os.ProductType -ne 1)
$kind = if ($isServer) { 'сервер' } else { 'рабочая станция' }

if ($build -ge 19041) {
    Ok "$($os.Caption) — $kind, сборка $build"
} else {
    Bad "$($os.Caption) (сборка $build) — для WSL2 нужна 19041 или новее"
}

# У серверных выпусков до 2022 поддержка WSL2 неполная: ядро ставится,
# но «wsl --install» там работает иначе, и часть машин требует ручных
# шагов. Предупреждаем заранее, а не посреди установки.
if ($isServer -and $build -lt 20348) {
    Warn 'серверный выпуск старше 2022 — WSL2 поддерживается частично, возможны ручные шаги'
}

if ((Get-CimInstance Win32_ComputerSystem).HypervisorPresent) {
    Ok 'виртуализация включена'
} elseif ((Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled) {
    Warn 'гипервизор не запущен, но в BIOS виртуализация включена'
} else {
    Bad 'виртуализация выключена в BIOS — включите VT-x/AMD-V'
}

$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGb -ge 8) { Ok "оперативной памяти $ramGb ГБ" }
elseif ($ramGb -ge 4) { Warn "оперативной памяти $ramGb ГБ — вики будет работать, но собирать образ здесь тесно" }
else { Bad "оперативной памяти $ramGb ГБ — мало" }

$freeGb = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
if ($freeGb -ge 8) { Ok "на диске C свободно $freeGb ГБ" }
elseif ($freeGb -ge 6) { Warn "на диске C свободно $freeGb ГБ — установка пройдёт, но впритык" }
else { Bad "на диске C свободно $freeGb ГБ, нужно хотя бы 6 ГБ (стеку в работе — 2.2)" }

# --- компоненты Windows ---

foreach ($f in @(
    @{ Name = 'Microsoft-Windows-Subsystem-Linux'; Title = 'подсистема Linux' },
    @{ Name = 'VirtualMachinePlatform';            Title = 'платформа виртуальной машины' }
)) {
    $state = $null
    try { $state = (Get-WindowsOptionalFeature -Online -FeatureName $f.Name -ErrorAction Stop).State } catch { }

    if ($state -eq 'Enabled') {
        Ok "компонент «$($f.Title)» включён"
    } elseif ($null -eq $state) {
        # На серверных выпусках список компонентов другой; там же есть
        # Install-WindowsFeature. Не считаем это отказом.
        Warn "компонент «$($f.Title)» не найден в списке — проверю при установке"
        Todo 'feature' "включить компонент «$($f.Title)»"
    } else {
        Warn "компонент «$($f.Title)» выключен"
        Todo 'feature' "включить компонент «$($f.Title)» (потребуется перезагрузка)"
    }
}

# --- сам WSL ---

$hasWsl = Test-Path $wslExe
if ($hasWsl) {
    $ver = (Invoke-Wsl @('--version') -Utf16).Text
    if ($ver -match '(\d+\.\d+\.\d+)') { Ok "WSL установлен ($($Matches[1]))" } else { Ok 'WSL установлен' }
} else {
    Warn 'WSL не установлен'
    Todo 'wsl' 'установить WSL'
}

$kernel = Test-Wsl2Kernel
if ($kernel.Present) {
    Ok "компонент ядра WSL2 на месте ($($kernel.Detail))"
} else {
    Warn 'компонента ядра WSL2 нет — без него вторая версия не включится'
    Todo 'kernel' 'установить компонент ядра WSL2'
}

$distros = @()
if ($hasWsl) {
    $distros = ((Invoke-Wsl @('-l', '-q') -Utf16).Text -split "`n") |
        ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

$hasDistro = $distros -contains $WslDistro
$distroVer = 0
if ($hasDistro) {
    $distroVer = Get-WslVersion -Name $WslDistro
    if ($distroVer -eq 1) {
        Warn "дистрибутив $WslDistro первой версии — Docker в ней не работает"
        Todo 'convert' "перевести $WslDistro во вторую версию WSL"
    } else {
        Ok "дистрибутив $WslDistro на месте (WSL $distroVer)"
    }
} else {
    Warn "дистрибутива $WslDistro нет"
    Todo 'distro' "установить дистрибутив $WslDistro"
}

$wslConfig = Join-Path $env:USERPROFILE '.wslconfig'
if (Test-Path $wslConfig) {
    $cfg = Get-Content $wslConfig -Raw
    if ($cfg -match 'memory\s*=\s*(\d+)GB') {
        $mem = [int]$Matches[1]
        if ($mem -ge 6) { Ok ".wslconfig отдаёт виртуалке $mem ГБ" }
        else { Warn ".wslconfig отдаёт виртуалке всего $mem ГБ — сборка может не влезть" }
    } else {
        Warn '.wslconfig есть, но потолок памяти не задан'
    }
} else {
    Warn '.wslconfig не найден'
    Todo 'wslconfig' "создать .wslconfig с потолком памяти $WslMemoryGb ГБ"
}

# --- Docker внутри дистрибутива ---

$dockerOk = $false
if ($hasDistro -and $distroVer -ne 1) {
    $out = (Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc',
        'command -v dockerd >/dev/null && docker --version || echo НЕТ')).Text
    if ($out -match 'Docker version') {
        Ok ($out.Trim())
        $daemon = (Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc',
            'docker info >/dev/null 2>&1 && echo ЖИВ || echo МЁРТВ')).Text
        if ($daemon -match 'ЖИВ') { Ok 'демон отвечает'; $dockerOk = $true }
        else { Warn 'демон не запущен — поднимет скрипт развёртывания' }
    } else {
        Warn 'Docker внутри дистрибутива не установлен'
        Todo 'docker' 'установить Docker внутри дистрибутива'
    }
} else {
    Warn 'Docker проверю после подготовки дистрибутива'
    Todo 'docker' 'установить Docker внутри дистрибутива'
}

# --- связь ---

$repoHost = if ($UseGithub) { 'github.com' } else { 'gitlab.mp-lab.ru' }
foreach ($h in @($repoHost, 'registry-1.docker.io')) {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $null = Invoke-WebRequest -Uri "https://$h" -TimeoutSec 15 -UseBasicParsing
        Ok "$h отвечает"
    } catch {
        if ($_.Exception.Response) { Ok "$h отвечает" }
        else { Bad "$h недоступен: $($_.Exception.Message)" }
    }
}

# ======================================================================
# 2. ПЛАН
# ======================================================================

Step 'План'

if ($script:Problems -gt 0) {
    Die "Не выполнено условий: $($script:Problems). Это то, что скрипт исправить не может."
}

if ($script:Todo.Count -eq 0) {
    Ok 'всё необходимое уже установлено'
} else {
    Write-Host '  будет сделано:' -ForegroundColor White
    $i = 0
    foreach ($t in $script:Todo) {
        $i++
        Write-Host ("    {0}. {1}" -f $i, $t.Text)
        Log ("    {0}. {1}" -f $i, $t.Text)
    }
}

Note 'затем: развёртывание стека и сборка образа (10–20 минут)'
if ($SiteIp) { Note "затем: настройка IIS на $SiteIp" }

if ($CheckOnly) {
    Write-Host ""
    Write-Host 'Это была только опись. Чтобы установить, запустите без -CheckOnly.' -ForegroundColor Yellow
    Hold
    exit 0
}

if (-not $AppUrl) {
    if ($script:Interactive) {
        Write-Host ""
        Write-Host 'По какому адресу будет открываться вики?' -ForegroundColor White
        Note 'например: https://wiki.example.ru'
        $AppUrl = (Read-Host 'Адрес').Trim()
        if (-not $AppUrl) { Die 'Без адреса ставить нечего.' }

        Write-Host ""
        Write-Host 'Настроить IIS, чтобы вики открывалась снаружи?' -ForegroundColor White
        Note 'укажите IP сервера или оставьте пустым, чтобы пропустить'
        $answer = (Read-Host 'IP').Trim()
        if ($answer) { $SiteIp = $answer }
    } else {
        Write-Host ""
        Write-Host 'Нужен адрес вики, например:' -ForegroundColor Yellow
        Write-Host '  .\install.ps1 -AppUrl https://wiki.example.ru'
        exit 1
    }
}

Write-Host ""
Write-Host "Ставлю по адресу $AppUrl" -ForegroundColor White
Note 'окно закрывать нельзя до конца установки'

# ======================================================================
# 3. УСТАНОВКА — всё недостающее, в порядке зависимостей
# ======================================================================

Step 'Устанавливаю недостающее'

# --- компоненты Windows ---

if (Need 'feature') {
    foreach ($f in @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')) {
        $state = $null
        try { $state = (Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction Stop).State } catch { }
        if ($state -eq 'Enabled') { continue }

        Note "включаю $f"
        try {
            $r = Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart -ErrorAction Stop
            if ($r.RestartNeeded) { $script:NeedReboot = $true }
        } catch {
            # На серверных выпусках часть компонентов ставится иначе
            if ($isServer -and (Get-Command Install-WindowsFeature -ErrorAction SilentlyContinue)) {
                Note 'пробую серверным способом'
                try {
                    $r2 = Install-WindowsFeature -Name $f -ErrorAction Stop
                    if ($r2.RestartNeeded -ne 'No') { $script:NeedReboot = $true }
                } catch {
                    Die "не удалось включить компонент $f" @("вручную: dism /online /enable-feature /featurename:$f /all")
                }
            } else {
                Die "не удалось включить компонент $f" @("вручную: dism /online /enable-feature /featurename:$f /all")
            }
        }
        Ok "компонент $f включён"
    }

    if ($script:NeedReboot) {
        Write-Host ""
        Write-Host 'Компоненты Windows включены — нужна перезагрузка.' -ForegroundColor Yellow
        Write-Host 'После неё запустите установщик снова: он продолжит с этого места.' -ForegroundColor Yellow
        Log 'остановка: нужна перезагрузка после включения компонентов'
        Hold
        exit 0
    }
}

# --- ядро WSL2 ---

if ((Need 'kernel') -or (Need 'wsl')) {
    if (-not (Install-Wsl2Kernel)) {
        Die 'Без компонента ядра вторая версия WSL не включится.' @('поставить вручную: https://aka.ms/wsl2kernel')
    }
}

# Вторая версия по умолчанию: в первой Docker не работает.
$setDef = Invoke-Wsl @('--set-default-version', '2') -Utf16
Log "set-default-version: код $($setDef.Code), ответ: $($setDef.Text)"

# --- дистрибутив ---

if (Need 'distro') {
    # Имя в каталоге у разных версий Windows разное: где-то Ubuntu-24.04,
    # где-то только Ubuntu. Спрашиваем у самой системы.
    $online = Invoke-Wsl @('--list', '--online') -Utf16
    $names = @()
    if ($online.Code -eq 0) {
        $names = ($online.Text -split "`n" | ForEach-Object { ($_ -split '\s{2,}')[0].Trim() }) |
            Where-Object { $_ -match '^[A-Za-z][A-Za-z0-9.\-]+$' -and $_ -notmatch '^(NAME|FRIENDLY)$' }
    }

    $pick = $WslDistro
    if ($names -and ($names -notcontains $WslDistro)) {
        $alt = $names | Where-Object { $_ -match '^Ubuntu' } | Select-Object -First 1
        if ($alt) { Warn "«$WslDistro» в каталоге нет, беру «$alt»"; $pick = $alt; $WslDistro = $alt }
    }

    # --no-launch не даёт дистрибутиву открыть окно первичной настройки
    # с вопросом о пользователе. Знают его не все версии.
    $help = Invoke-Wsl @('--help') -Utf16
    $canNoLaunch = ($help.Text -match '--no-launch')
    if (-not $canNoLaunch) { Warn 'эта версия WSL не умеет ставить без запуска — окно Ubuntu может открыться, отвечать в нём не нужно' }

    Note "ставлю $pick, несколько минут"
    # Запоминаем время: по нему потом отличим окно, которое открыла наша
    # установка, от чужого терминала, открытого человеком.
    $installStart = Get-Date
    $res = if ($canNoLaunch) {
        Invoke-Wsl @('--install', '-d', $pick, '--no-launch') -Utf16
    } else {
        Invoke-Wsl @('--install', '-d', $pick) -Utf16
    }

    if ($res.Code -ne 0) {
        Warn 'установка не прошла, обновляю WSL и пробую снова'
        $upd = Invoke-Wsl @('--update') -Utf16
        Log "wsl --update: код $($upd.Code), ответ: $($upd.Text)"
        $res = Invoke-Wsl @('--install', '-d', $pick) -Utf16
    }

    if ($res.Code -ne 0) {
        Die 'Не удалось поставить дистрибутив.' @(
            "ответ системы: $($res.Text)",
            'вручную: wsl --list --online, затем wsl --install -d <имя>'
        )
    }

    # Окно первичной настройки, если открылось, ждёт имени пользователя.
    # Оно не нужно: работаем от root.
    #
    # Закрываем только то, что запустилось после начала установки: у
    # человека может быть открыт свой терминал Ubuntu, и трогать его мы
    # права не имеем. Там, где WSL умеет --no-launch (в том числе на
    # Windows 11), окно и не появляется — цикл просто ничего не найдёт.
    if (-not $canNoLaunch) {
        foreach ($w in (Get-Process -ErrorAction SilentlyContinue |
                        Where-Object { $_.ProcessName -match '^ubuntu' })) {
            try {
                if ($w.StartTime -lt $installStart) {
                    Log "оставляю чужой процесс $($w.ProcessName), запущен в $($w.StartTime)"
                    continue
                }
                Stop-Process -Id $w.Id -Force -ErrorAction Stop
                Ok 'закрыто окно первичной настройки'
            } catch {
                Log "не смог закрыть $($w.ProcessName): $($_.Exception.Message)"
            }
        }
    }

    $probe = Invoke-Wsl @('-d', $pick, '-u', 'root', '--', 'echo', 'wsl-готов')
    if ($probe.Code -ne 0 -or $probe.Text -notmatch 'wsl-готов') {
        Log "проверка дистрибутива: код $($probe.Code), ответ: $($probe.Text)"
        Write-Host ""
        Write-Host 'Дистрибутив установлен, но пока не отвечает — нужна перезагрузка.' -ForegroundColor Yellow
        Hold
        exit 0
    }
    Ok "дистрибутив $pick установлен и отвечает"

    if ((Get-WslVersion -Name $pick) -eq 1) { Todo 'convert' "перевести $pick во вторую версию" }
}

# --- перевод во вторую версию ---

if (Need 'convert') {
    Note 'перевожу дистрибутив во вторую версию WSL, несколько минут'
    $conv = Invoke-Wsl @('--set-version', $WslDistro, '2') -Utf16
    Log "set-version: код $($conv.Code), ответ: $($conv.Text)"

    if ($conv.Text -match 'ядра|kernel') {
        if (Install-Wsl2Kernel) {
            $conv = Invoke-Wsl @('--set-version', $WslDistro, '2') -Utf16
            Log "set-version (после ядра): код $($conv.Code), ответ: $($conv.Text)"
        }
    }

    if ((Get-WslVersion -Name $WslDistro) -ne 2) {
        Die 'Не удалось перевести дистрибутив во вторую версию.' @(
            "ответ системы: $($conv.Text)",
            "вручную: wsl --set-version $WslDistro 2"
        )
    }
    Ok 'переведён во вторую версию'
    # Файловая система пересоздаётся, Docker надо ставить заново
    $dockerOk = $false
}

# --- настройки дистрибутива ---

# Дальше всё делается внутри дистрибутива, поэтому сперва убеждаемся,
# что он вообще отзывается. Иначе каждая следующая ошибка будет врать о
# своей причине.
Assert-Distro -Name $WslDistro

# Убираем вопрос про имя пользователя при первом запуске и поднимаем
# демона при старте: иначе после перезагрузки вики не вернётся сама.
# Пишем прямо из оболочки: временный файл, перевод пути и копирование —
# три звена там, где хватает одного, и каждое может подвести.
$confBody = "[user]\ndefault=root\n\n[boot]\ncommand = service docker start\n"
$w = Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc',
    "printf '$confBody' > /etc/wsl.conf && cat /etc/wsl.conf")
if ($w.Code -eq 0 -and $w.Text -match 'default=root') {
    Ok 'вход без вопросов о пользователе, Docker поднимается при старте'
} else {
    Warn "не удалось записать /etc/wsl.conf (код $($w.Code)): $($w.Text)"
    Log "wsl.conf: код $($w.Code), ответ: $($w.Text)"
}

if (Need 'wslconfig') {
    @"
[wsl2]
# Потолок памяти для виртуалки. Сборка клиента прожорлива: на шести
# гигабайтах она вешала машину, когда рядом работали контейнеры.
memory=${WslMemoryGb}GB
swap=2GB
localhostForwarding=true
"@ | Set-Content -Path $wslConfig -Encoding utf8
    Ok "создан $wslConfig"
}

# Настройки читаются при запуске виртуалки — останавливаем, чтобы
# подействовали.
$null = Invoke-Wsl @('--shutdown') -Utf16

# --- Docker ---

if (-not $dockerOk) {
    Note 'ставлю Docker внутри дистрибутива'

    # Частая беда: снаружи сеть есть, а изнутри не разрешаются имена.
    $probeDns = {
        $r = Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc',
            'getent hosts download.docker.com >/dev/null 2>&1 && echo связь-есть || echo связи-нет')
        if ($r.Code -ne 0) { Log "проверка связи: код $($r.Code), ответ: $($r.Text)" }
        $r.Text
    }

    if ((& $probeDns) -notmatch 'связь-есть') {
        Warn 'изнутри дистрибутива не разрешаются имена — чиню'

        # WSL сам сочиняет /etc/resolv.conf, и на машинах с VPN или
        # своим DNS он выходит нерабочим. Запрещаем и прописываем
        # распознаватели хоста, а к ним про запас общедоступный.
        $dns = @()
        try {
            $dns = (Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction Stop |
                Where-Object { $_.ServerAddresses } |
                Select-Object -ExpandProperty ServerAddresses -Unique) |
                Where-Object { $_ -notmatch '^127\.' } | Select-Object -First 3
        } catch { }
        # Обязательно списком: при одном найденном адресе это строка,
        # и «+=» склеит её со следующей вместо добавления в список.
        $dns = @($dns) | Where-Object { $_ }
        $dns = @($dns) + '8.8.8.8' | Select-Object -Unique
        Note ("распознаватели: " + ($dns -join ', '))

        $lines = ($dns | ForEach-Object { "nameserver $_" }) -join '\n'
        $fix = "grep -q generateResolvConf /etc/wsl.conf 2>/dev/null || printf '\n[network]\ngenerateResolvConf=false\n' >> /etc/wsl.conf; rm -f /etc/resolv.conf; printf '$lines\n' > /etc/resolv.conf; cat /etc/resolv.conf"
        $r = Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc', $fix)
        Log "починка DNS: код $($r.Code), ответ: $($r.Text)"

        # Настройки читаются при запуске дистрибутива
        $null = Invoke-Wsl @('--terminate', $WslDistro) -Utf16
        Start-Sleep -Seconds 3

        if ((& $probeDns) -match 'связь-есть') {
            Ok 'имена разрешаются, продолжаю'
        } else {
            Die "Изнутри $WslDistro не разрешаются имена даже после починки." @(
                'проверьте вручную: wsl -d ' + $WslDistro + ' -u root -- cat /etc/resolv.conf',
                'и связь: wsl -d ' + $WslDistro + ' -u root -- ping -c1 1.1.1.1',
                'если пингуется, а имена нет — мешает DNS сети или VPN'
            )
        }
    } else {
        Ok 'связь изнутри дистрибутива есть'
    }

    $install = @'
set -e
if ! command -v dockerd >/dev/null 2>&1; then
  apt-get update -q
  apt-get install -y -q ca-certificates curl gnupg git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
service docker start >/dev/null 2>&1 || true
docker --version
'@
    $tmp = [System.IO.Path]::GetTempFileName()
    Write-WslScript -Path $tmp -Body $install
    $conv2 = Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'wslpath', '-a', ($tmp -replace '\\','/'))
    $code = Invoke-WslLive @('-d', $WslDistro, '-u', 'root', '--', 'bash', $conv2.Text.Trim())
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue

    if ($code -ne 0) { Die "Не удалось поставить Docker внутри $WslDistro." }
    Ok 'Docker готов'
}

# ======================================================================
# 4. РАЗВЁРТЫВАНИЕ
# ======================================================================

Step 'Разворачиваю стек'

$repo = if ($UseGithub) {
    'https://github.com/Altair666/docmost.git'
} else {
    'https://gitlab.mp-lab.ru/grist_additional_widgets/docmost.git'
}

# Дальше всё делает линуксовый скрипт из самого репозитория: порядок
# развёртывания описан один раз, а не по разу на операционную систему.
$bootstrap = @"
set -e

if [ ! -d /opt/docmost/.git ]; then
  git clone --branch custom-sso-integration $repo /opt/docmost
else
  # Иначе повторный запуск возьмёт прежнюю версию скриптов с диска, и
  # свежие исправления пройдут мимо.
  echo 'обновляю исходники'
  git -C /opt/docmost fetch --quiet origin custom-sso-integration || echo '  обновить не вышло, работаю тем, что есть'
  git -C /opt/docmost checkout --quiet custom-sso-integration || true
  git -C /opt/docmost merge --quiet --ff-only FETCH_HEAD 2>/dev/null || echo '  перемотать не вышло, работаю тем, что есть'
fi

git -C /opt/docmost submodule update --init apps/server/src/custom-sso
chmod +x /opt/docmost/deploy/install-linux.sh
echo "версия скриптов: `$(git -C /opt/docmost rev-parse --short HEAD)"
/opt/docmost/deploy/install-linux.sh --url '$AppUrl' --repo '$repo'
"@

$tmp2 = [System.IO.Path]::GetTempFileName()
Write-WslScript -Path $tmp2 -Body $bootstrap
$conv3 = Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'wslpath', '-a', ($tmp2 -replace '\\','/'))
$deployCode = Invoke-WslLive @('-d', $WslDistro, '-u', 'root', '--', 'bash', $conv3.Text.Trim())
Remove-Item $tmp2 -Force -ErrorAction SilentlyContinue

if ($deployCode -ne 0) {
    Die 'Развёртывание не прошло.' @(
        "вывод выше, он же в журнале",
        "подробности сборки: \\wsl`$\$WslDistro\opt\docmost-stack\build.log"
    )
}

# --- хост: IIS ---

if ($SiteIp) {
    $hostScript = Join-Path $PSScriptRoot 'setup-windows-host.ps1'
    if (Test-Path $hostScript) {
        Note 'настраиваю IIS и автозапуск'
        & $hostScript -SiteIp $SiteIp -WslDistro $WslDistro
    } else {
        Warn 'рядом нет setup-windows-host.ps1 — IIS не настраивал'
    }
}

# ======================================================================

Write-Host ""
Write-Host 'Готово.' -ForegroundColor Green
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

Write-Host ("Всего заняло {0:mm\:ss}" -f ((Get-Date) - $script:Started)) -ForegroundColor DarkGray
Write-Host "Журнал: $script:LogFile" -ForegroundColor DarkGray
Hold
