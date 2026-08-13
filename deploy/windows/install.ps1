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
$script:StepNo = 0
$script:StepTotal = 7
$script:Started = Get-Date

# Запущено щелчком или из консоли. От этого зависит, ждать ли нажатия
# клавиши в конце: своё окно закроется вместе с нами и унесёт итог.
#
# Спрашиваем у самой консоли, сколько процессов к ней подключено. Только
# мы — окно наше, надо придержать. Есть кто-то ещё (командный процессор)
# — окно останется и без нас. По имени родителя это определялось неверно:
# при запуске из консоли родителем оказывался не powershell.
$script:Interactive = $false
try {
    if (-not ('ConsoleHelper' -as [type])) {
        Add-Type -Namespace '' -Name ConsoleHelper -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
public static extern uint GetConsoleProcessList(uint[] lpdwProcessList, uint dwProcessCount);
'@
    }
    $buf = New-Object uint32[] 16
    $count = [ConsoleHelper]::GetConsoleProcessList($buf, 16)
    $script:Interactive = ($count -le 1)
} catch {
    # Консоли нет вовсе (запуск из службы или перенаправленный вывод) —
    # держать нечего.
    $script:Interactive = $false
}

# Журнал: окно может закрыться, файл останется. Кладём в папку временных
# файлов — писать рядом с exe нельзя, его могут запустить с флешки или
# из сетевой папки.
$script:LogFile = Join-Path $env:TEMP ("docmost-install-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))

function Log {
    param($m)
    try { Add-Content -Path $script:LogFile -Value $m -Encoding utf8 } catch { }
}

function Ok   { param($m) Write-Host "  [+] $m" -ForegroundColor Green; Log "  [+] $m" }
function Bad  { param($m) Write-Host "  [-] $m" -ForegroundColor Red; Log "  [-] $m"; $script:Problems++ }
function Warn { param($m) Write-Host "  [!] $m" -ForegroundColor Yellow; Log "  [!] $m" }
function Step {
    param($m)
    $script:StepNo++
    $el = (Get-Date) - $script:Started
    $t = "{0:mm\:ss}" -f $el
    Write-Host ""
    Write-Host ("[{0}/{1}] {2}" -f $script:StepNo, $script:StepTotal, $m) -ForegroundColor White -NoNewline
    Write-Host ("   (прошло {0})" -f $t) -ForegroundColor DarkGray
    Log ""
    Log ("[{0}/{1}] {2}   (прошло {3})" -f $script:StepNo, $script:StepTotal, $m, $t)
}

# Любая ошибка, которую мы не предусмотрели, обязана быть показанной, а
# не унесённой закрывшимся окном.
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

# Окно, закрывшееся раньше, чем человек прочёл итог, — то же самое, что
# отсутствие итога.
function Hold {
    if ($script:Interactive) {
        Write-Host ""
        Write-Host "Нажмите любую клавишу, чтобы закрыть окно…" -ForegroundColor DarkGray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

# --- 1. хост ----------------------------------------------------------

Log ("Установщик Docmost, запуск {0:dd.MM.yyyy HH:mm:ss}" -f (Get-Date))

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

# Работающему стеку хватает 112 МБ (замер: приложение 68, база 39,
# Redis 5). Восемь гигабайт нужны не ему, а сборке: WSL по умолчанию
# забирает половину памяти машины, и на восьми ему достанется четыре —
# ровно нижняя граница, при которой сборка клиента не падает.
$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGb -ge 8) { Ok "оперативной памяти $ramGb ГБ" }
elseif ($ramGb -ge 4) { Warn "оперативной памяти $ramGb ГБ — вики будет работать, но собирать образ здесь тесно" }
else { Bad "оперативной памяти $ramGb ГБ — мало" }

# Замер чистого цикла: пик при установке около шести гигабайт, после
# уборки кеша остаётся около трёх. Просим восемь: два сверху — на то,
# что диск виртуалки WSL растёт по мере работы и сам не сжимается.
$freeGb = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
if ($freeGb -ge 8) { Ok "на диске C свободно $freeGb ГБ" }
elseif ($freeGb -ge 6) { Warn "на диске C свободно $freeGb ГБ — установка пройдёт, но впритык" }
else { Bad "на диске C свободно $freeGb ГБ, нужно хотя бы 6 ГБ (стеку в работе — 2.2)" }

# --- 2. WSL -----------------------------------------------------------

Step "Проверяю WSL"

$wslExe = "$env:windir\system32\wsl.exe"

# Запуск wsl.exe с чтением ответа и кода возврата.
#
# Тонкость: wsl.exe отвечает в UTF-16, и при обычном вызове его
# сообщения — в том числе об ошибках — превращаются в нечитаемую кашу.
# Менять кодировку всей консоли нельзя: тогда сыплется наш собственный
# вывод, проверено. Поэтому запускаем процесс и указываем кодировку
# только для его потоков.
#
# Вторая тонкость: в PowerShell 5.1 вывод внешней команды в поток ошибок
# при $ErrorActionPreference = Stop сам по себе становится сбоем, даже
# когда команда отработала верно. Здесь этого не происходит.
# Временный скрипт для запуска внутри WSL.
#
# Без метки порядка байтов: Set-Content -Encoding utf8 в PowerShell 5.1
# дописывает её в начало, и bash спотыкается на первой же строке —
# «line 1: ﻿set: command not found».
#
# И с переводами строк в виде одного знака: с парой знаков bash ругается
# на невидимый возврат каретки в конце каждой команды.
function Write-WslScript {
    param([string] $Path, [string] $Body)
    $clean = $Body -replace "`r`n", "`n"
    [System.IO.File]::WriteAllText($Path, $clean, (New-Object System.Text.UTF8Encoding($false)))
}

# Запуск внутри WSL с живым выводом на экран.
#
# Invoke-Wsl тут не годится: он копит вывод и отдаёт в конце, а нам надо
# видеть ход сборки. Зато приходится беречь консоль: wsl.exe меняет её
# кодовую страницу, и после него русский текст читается кашей.
function Invoke-WslLive {
    param([string[]] $WslArgs)

    $prev = $null
    try { $prev = [Console]::OutputEncoding } catch { }

    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        # Команды внутри дистрибутива отвечают в UTF-8; без этого их
        # вывод читается неверно.
        try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

        # Каждая строка идёт и на экран, и в журнал: при сбое иначе не
        # остаётся никаких следов, а именно это и подвело в прошлый раз.
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

# Какой версией WSL зарегистрирован дистрибутив. Это не мелочь: в
# первой версии нет настоящего ядра, и Docker в ней не работает —
# служба рапортует об успехе, а демон тут же падает.
function Get-WslVersion {
    param([string] $Name)

    $out = Invoke-Wsl @('-l', '-v') -Utf16
    foreach ($line in ($out.Text -split "`n")) {
        $clean = ($line -replace '^\s*\*\s*', '').Trim()
        if (-not $clean) { continue }
        $parts = $clean -split '\s{1,}'
        if ($parts.Count -ge 3 -and $parts[0] -eq $Name) {
            return [int]($parts[-1])
        }
    }
    return 0
}

function Invoke-Wsl {
    # Массивом, а не «остаточными доводами»: иначе PowerShell забирает
    # себе всё, что начинается с дефиса, и до wsl.exe это не доходит.
    param(
        [Parameter(Mandatory = $true)] [string[]] $WslArgs,
        # Собственные сообщения wsl.exe идут в UTF-16, а вывод команды,
        # запущенной внутри дистрибутива, — в UTF-8. Определить по
        # содержимому нельзя: байты UTF-16 с кириллицей оказываются
        # формально допустимым UTF-8 и молча читаются мусором.
        [switch] $Utf16
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $wslExe
    # ArgumentList есть только в новой .NET; в PowerShell 5.1 работает
    # старая, поэтому строку доводов собираем вручную.
    $psi.Arguments = (($WslArgs | ForEach-Object {
        $v = [string]$_
        if ($v -match '\s') { '"' + $v + '"' } else { $v }
    }) -join ' ')
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)

    # Читаем байтами: кодировка тут не одна. Свои сообщения wsl.exe
    # выдаёт в UTF-16, а вывод команды изнутри дистрибутива — в UTF-8.
    # Жёстко заданная кодировка портила второй случай.
    $outBytes = New-Object System.IO.MemoryStream
    $errBytes = New-Object System.IO.MemoryStream
    $proc.StandardOutput.BaseStream.CopyTo($outBytes)
    $proc.StandardError.BaseStream.CopyTo($errBytes)
    $proc.WaitForExit()

    $enc = if ($Utf16) {
        [System.Text.Encoding]::Unicode
    } else {
        [System.Text.Encoding]::UTF8
    }

    $decode = {
        param($ms)
        $b = $ms.ToArray()
        if ($b.Length -eq 0) { return '' }
        return $enc.GetString($b)
    }

    $text = ((& $decode $outBytes) + "`n" + (& $decode $errBytes)).Trim()

    return [pscustomobject]@{
        Text = $text
        Code = $proc.ExitCode
    }
}
$hasWsl = Test-Path $wslExe

if ($hasWsl) {
    $ver = (Invoke-Wsl @('--version') -Utf16).Text
    if ($ver -match '(\d+\.\d+\.\d+)') { Ok "WSL установлен ($($Matches[1]))" }
    else { Ok "WSL установлен" }
} else {
    Bad "WSL не установлен"
}

$distros = @()
if ($hasWsl) {
    $distros = ((Invoke-Wsl @('-l', '-q') -Utf16).Text -split "`n") |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ }
}

$hasDistro = $distros -contains $WslDistro
if ($hasDistro) {
    $ver = Get-WslVersion -Name $WslDistro
    if ($ver -eq 1) {
        # Не Bad: это чинится, и чиним мы сами ниже.
        Warn "дистрибутив $WslDistro первой версии — Docker в ней не работает, переведу во вторую"
    } else {
        Ok "дистрибутив $WslDistro на месте (WSL $ver)"
    }
} else {
    Warn "дистрибутива $WslDistro нет — поставлю"
}

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
    # Вывод команды изнутри дистрибутива приходит в UTF-8, поэтому без
    # -Utf16: с ним он читался бы иероглифами.
    $out = (Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc',
        'command -v docker >/dev/null && docker --version || echo НЕТ')).Text
    if ($out -match 'Docker version') {
        Ok ($out.Trim())
        $daemon = (Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc',
            'docker info >/dev/null 2>&1 && echo ЖИВ || echo МЁРТВ')).Text
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
    Write-Host "Журнал: $script:LogFile" -ForegroundColor DarkGray
    Hold
    exit 1
}

Write-Host ""
Write-Host "Окружение пригодно." -ForegroundColor Green

if ($CheckOnly) { Hold; exit 0 }

if (-not $AppUrl) {
    if ($script:Interactive) {
        # Запустили щелчком — спрашиваем прямо здесь, а не отправляем
        # человека читать про доводы командной строки.
        Write-Host ""
        Write-Host "По какому адресу будет открываться вики?" -ForegroundColor White
        Write-Host "  например: https://wiki.example.ru" -ForegroundColor DarkGray
        $AppUrl = (Read-Host "Адрес").Trim()

        if (-not $AppUrl) {
            Write-Host "Без адреса ставить нечего." -ForegroundColor Red
            Hold
            exit 1
        }

        Write-Host ""
        Write-Host "Настроить IIS, чтобы вики открывалась снаружи?" -ForegroundColor White
        Write-Host "  укажите IP сервера или оставьте пустым, чтобы пропустить" -ForegroundColor DarkGray
        $answer = (Read-Host "IP").Trim()
        if ($answer) { $SiteIp = $answer }
    } else {
        Write-Host ""
        Write-Host "Нужен адрес вики, например:" -ForegroundColor Yellow
        Write-Host "  .\install.ps1 -AppUrl https://wiki.example.ru"
        exit 1
    }
}

Write-Host ""
Write-Host "Ставлю по адресу $AppUrl" -ForegroundColor White
if ($SiteIp) { Write-Host "IIS будет настроен на $SiteIp" -ForegroundColor DarkGray }
Write-Host "Сборка образа занимает 10-20 минут, окно закрывать нельзя." -ForegroundColor DarkGray

# --- 5. установка недостающего ---------------------------------------

if (-not $hasWsl -or -not $hasDistro) {
    Step "Ставлю WSL и $WslDistro"

    # Компоненты Windows: без них wsl --install либо откажет, либо
    # поставит нерабочую первую версию.
    foreach ($f in @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')) {
        $state = (Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction SilentlyContinue).State
        if ($state -ne 'Enabled') {
            Write-Host "  включаю компонент $f" -ForegroundColor DarkGray
            $null = Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart -ErrorAction SilentlyContinue
            $script:NeedReboot = $true
        } else {
            Ok "компонент $f уже включён"
        }
    }

    if ($script:NeedReboot) {
        Warn "включены компоненты Windows — нужна перезагрузка"
    } else {
        # Имя дистрибутива в каталоге у разных версий Windows разное:
        # где-то Ubuntu-24.04, где-то просто Ubuntu. Спрашиваем у самой
        # системы, а не гадаем.
        $online = Invoke-Wsl @('--list', '--online') -Utf16
        $names = @()
        if ($online.Code -eq 0) {
            $names = ($online.Text -split "`n" | ForEach-Object {
                ($_ -split '\s{2,}')[0].Trim()
            }) | Where-Object {
                # Заголовок таблицы — не имя дистрибутива
                $_ -match '^[A-Za-z][A-Za-z0-9.\-]+$' -and $_ -notmatch '^(NAME|FRIENDLY)$'
            }
        }

        $pick = $WslDistro
        if ($names -and ($names -notcontains $WslDistro)) {
            $alt = $names | Where-Object { $_ -match '^Ubuntu' } | Select-Object -First 1
            if ($alt) {
                Warn "«$WslDistro» в каталоге нет, беру «$alt»"
                $pick = $alt
                $WslDistro = $alt
            }
        }

        # --no-launch не даёт дистрибутиву открыть окно первичной
        # настройки с вопросом о пользователе. Знают его не все версии:
        # на Windows 10 встречается WSL постарше, поэтому спрашиваем
        # справку, а не проверяем наугад по коду возврата.
        $help = Invoke-Wsl @('--help') -Utf16
        $canNoLaunch = ($help.Text -match '--no-launch')

        # Чтобы дистрибутив сразу встал второй версией: в первой Docker
        # не работает, а по умолчанию кое-где до сих пор стоит первая.
        $null = Invoke-Wsl @('--set-default-version', '2') -Utf16

        Write-Host "  ставлю $pick, это займёт несколько минут" -ForegroundColor DarkGray
        if (-not $canNoLaunch) {
            Warn 'эта версия WSL не умеет ставить без запуска — окно Ubuntu может открыться, отвечать на его вопросы не нужно'
        }

        if ($canNoLaunch) {
            $res = Invoke-Wsl @('--install', '-d', $pick, '--no-launch') -Utf16
        } else {
            $res = Invoke-Wsl @('--install', '-d', $pick) -Utf16
        }

        if ($res.Code -ne 0) {
            # «Параметр задан неверно» обычно означает старую встроенную
            # версию WSL: она знает --install, но не так, как нынешняя.
            # Обновляемся и пробуем ещё раз, прежде чем сдаваться.
            Warn 'установка не прошла, обновляю WSL и пробую снова'
            $upd = Invoke-Wsl @('--update') -Utf16
            Log "wsl --update: код $($upd.Code), ответ: $($upd.Text)"
            if ($upd.Code -eq 0) {
                $res = Invoke-Wsl @('--install', '-d', $pick, '--no-launch') -Utf16
                if ($res.Code -ne 0) { $res = Invoke-Wsl @('--install', '-d', $pick) -Utf16 }
            }
        }

        if ($res.Code -ne 0) {
            Write-Host ""
            Write-Host "Не удалось поставить дистрибутив автоматически." -ForegroundColor Red
            Write-Host "  ответ системы: $($res.Text)" -ForegroundColor DarkGray
            Log "wsl --install: код $($res.Code), ответ: $($res.Text)"
            Write-Host ""
            Write-Host "Что сделать вручную:" -ForegroundColor White
            Write-Host "  1. wsl --update" -ForegroundColor DarkGray
            Write-Host "  2. wsl --list --online   (посмотреть доступные имена)" -ForegroundColor DarkGray
            Write-Host "  3. wsl --install -d <имя из списка>" -ForegroundColor DarkGray
            Write-Host "  4. перезагрузиться и запустить установщик снова" -ForegroundColor DarkGray
            Write-Host ""
            Write-Host "Журнал: $script:LogFile" -ForegroundColor DarkGray
            Hold
            exit 1
        }

        Ok "дистрибутив $pick поставлен"

        # Обычно он готов сразу — проверяем, а не отправляем человека на
        # ещё одну перезагрузку вслепую.
        # Окно первичной настройки, если открылось, ждёт имени
        # пользователя. Оно нам не нужно: работаем от root, а учётку
        # заводить незачем. Закрываем сами.
        $wizards = Get-Process -ErrorAction SilentlyContinue |
            Where-Object { $_.ProcessName -match '^ubuntu' }
        foreach ($w in $wizards) {
            try {
                Stop-Process -Id $w.Id -Force -ErrorAction Stop
                Ok "закрыто окно первичной настройки ($($w.ProcessName))"
            } catch {
                Log "не смог закрыть $($w.ProcessName): $($_.Exception.Message)"
            }
        }

        $probe = Invoke-Wsl @('-d', $pick, '-u', 'root', '--', 'echo', 'wsl-готов')
        if ($probe.Code -eq 0 -and $probe.Text -match 'wsl-готов') {
            Ok 'дистрибутив отвечает, перезагрузка не нужна'

            # Убираем вопрос про имя пользователя и пароль, который
            # Ubuntu задаёт при первом запуске: вход сразу от root.
            # Здесь это оправдано — внутри работает только Docker, и все
            # наши команды идут от него же.
            #
            # Заодно поднимаем демон при запуске дистрибутива: без этого
            # после перезагрузки сервера контейнеры не вернутся, потому
            # что Docker внутри никто не стартует.
            $conf = "[user]`ndefault=root`n`n[boot]`ncommand = service docker start`n"
            $confTmp = [System.IO.Path]::GetTempFileName()
            Write-WslScript -Path $confTmp -Body $conf
            $c = Invoke-Wsl @('-d', $pick, '-u', 'root', '--', 'wslpath', '-a', ($confTmp -replace '\\','/'))
            $null = Invoke-Wsl @('-d', $pick, '-u', 'root', '--', 'cp', $c.Text.Trim(), '/etc/wsl.conf')
            Remove-Item $confTmp -Force -ErrorAction SilentlyContinue

            $check = Invoke-Wsl @('-d', $pick, '-u', 'root', '--', 'cat', '/etc/wsl.conf')
            if ($check.Text -match 'default=root') {
                Ok 'вход без вопросов о пользователе, Docker поднимается сам'
            } else {
                Warn 'не удалось записать /etc/wsl.conf — при первом входе спросит пользователя'
                Log "wsl.conf: код $($check.Code), ответ: $($check.Text)"
            }

            # Настройки читаются при запуске дистрибутива, поэтому
            # останавливаем: следующий вызов подхватит.
            $null = Invoke-Wsl @('--terminate', $pick) -Utf16

            # Версия WSL: в первой Docker не заработает никогда.
            $ver = Get-WslVersion -Name $pick
            if ($ver -eq 1) {
                Warn "«$pick» зарегистрирован первой версией WSL — в ней Docker не работает"
                Write-Host '  перевожу во вторую, это занимает несколько минут' -ForegroundColor DarkGray
                $conv = Invoke-Wsl @('--set-version', $pick, '2') -Utf16
                Log "set-version: код $($conv.Code), ответ: $($conv.Text)"

                $ver = Get-WslVersion -Name $pick
                if ($ver -eq 2) {
                    Ok 'переведён во вторую версию'
                } else {
                    Write-Host ""
                    Write-Host "Не удалось перевести «$pick» во вторую версию WSL." -ForegroundColor Red
                    Write-Host "  ответ системы: $($conv.Text)" -ForegroundColor DarkGray
                    Write-Host "  вручную: wsl --set-version $pick 2" -ForegroundColor DarkGray
                    Write-Host "Журнал: $script:LogFile" -ForegroundColor DarkGray
                    Hold
                    exit 1
                }
            } elseif ($ver -eq 2) {
                Ok 'дистрибутив второй версии, как и нужно'
            }

            $hasDistro = $true
            $dockerOk = $false
        } else {
            Log "проверка дистрибутива: код $($probe.Code), ответ: $($probe.Text)"
            Warn 'дистрибутив пока не отвечает — нужна перезагрузка'
            $script:NeedReboot = $true
        }
    }
}

if ($script:NeedReboot) {
    Write-Host ""
    Write-Host "Перезагрузите сервер и запустите скрипт снова." -ForegroundColor Yellow
    Hold
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
    Ok "создан $wslConfig"

    # Файл читается только при запуске виртуалки. Если она уже поднята,
    # новый потолок памяти не подействует, и сборка может не влезть.
    $null = Invoke-Wsl @('--shutdown') -Utf16
    Ok 'WSL остановлен, настройки применятся при следующем запуске'
}

# Дистрибутив мог существовать до нас и быть первой версии. Docker в
# ней не работает, поэтому переводим прежде, чем ставить его.
if ($hasDistro) {
    $ver = Get-WslVersion -Name $WslDistro
    if ($ver -eq 1) {
        Step "Перевожу $WslDistro во вторую версию WSL"
        Write-Host '  в первой версии нет настоящего ядра, и Docker в ней не запускается' -ForegroundColor DarkGray
        Write-Host '  перевод занимает несколько минут' -ForegroundColor DarkGray

        $conv = Invoke-Wsl @('--set-version', $WslDistro, '2') -Utf16
        Log "set-version: код $($conv.Code), ответ: $($conv.Text)"

        if ((Get-WslVersion -Name $WslDistro) -eq 2) {
            Ok 'переведён во вторую версию'
            # Docker после перевода надо ставить заново: файловая
            # система дистрибутива пересоздаётся.
            $dockerOk = $false
        } else {
            Write-Host ""
            Write-Host "Не удалось перевести «$WslDistro» во вторую версию." -ForegroundColor Red
            Write-Host "  ответ системы: $($conv.Text)" -ForegroundColor DarkGray
            Write-Host "  вручную: wsl --set-version $WslDistro 2" -ForegroundColor DarkGray
            Write-Host "Журнал: $script:LogFile" -ForegroundColor DarkGray
            Hold
            exit 1
        }
    }
}

if (-not $dockerOk) {
    Step "Ставлю Docker внутри $WslDistro"

    # Частая беда: снаружи сеть есть, а изнутри дистрибутива не
    # разрешаются имена — тогда apt падает невнятно. Проверяем заранее,
    # чтобы не гадать по обрывкам вывода.
    $net = Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc',
        'getent hosts download.docker.com >/dev/null 2>&1 && echo связь-есть || echo связи-нет')
    if ($net.Text -notmatch 'связь-есть') {
        Write-Host ""
        Write-Host "Изнутри $WslDistro не разрешаются имена — apt работать не сможет." -ForegroundColor Red
        Write-Host "  Обычно помогает: wsl --shutdown, затем запустить установщик снова." -ForegroundColor DarkGray
        Write-Host "  Если не помогло, дело в DNS внутри WSL (частый случай при включённом VPN)." -ForegroundColor DarkGray
        Log "проверка связи внутри WSL: $($net.Text)"
        Write-Host "Журнал: $script:LogFile" -ForegroundColor DarkGray
        Hold
        exit 1
    }
    Ok 'связь изнутри дистрибутива есть' 
    $install = @'
set -e
if ! command -v docker >/dev/null 2>&1; then
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

    $conv = Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'wslpath', '-a', ($tmp -replace '\\','/'))
    $wslTmp = $conv.Text.Trim()

    $code = Invoke-WslLive @('-d', $WslDistro, '-u', 'root', '--', 'bash', $wslTmp)
    Remove-Item $tmp -Force

    if ($code -ne 0) {
        Write-Host ""
        Write-Host "Не удалось поставить Docker внутри $WslDistro." -ForegroundColor Red
        Write-Host "Журнал: $script:LogFile" -ForegroundColor DarkGray
        Hold
        exit 1
    }
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
else
  # Иначе повторный запуск возьмёт прежнюю версию скриптов развёртывания
  # с диска, и все свежие исправления пройдут мимо.
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

$conv2 = Invoke-Wsl @('-d', $WslDistro, '-u', 'root', '--', 'wslpath', '-a', ($tmp2 -replace '\\','/'))
$wslTmp2 = $conv2.Text.Trim()

$deployCode = Invoke-WslLive @('-d', $WslDistro, '-u', 'root', '--', 'bash', $wslTmp2)
Remove-Item $tmp2 -Force

if ($deployCode -ne 0) {
    Write-Host ""
    Write-Host "Развёртывание не прошло." -ForegroundColor Red
    Write-Host "Вывод выше, он же в журнале: $script:LogFile" -ForegroundColor DarkGray
    Write-Host "Подробности сборки: \\wsl`$\$WslDistro\opt\docmost-stack\build.log" -ForegroundColor DarkGray
    Hold
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

Write-Host ("Всего заняло {0:mm\:ss}" -f ((Get-Date) - $script:Started)) -ForegroundColor DarkGray
Hold
