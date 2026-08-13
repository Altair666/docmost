<#
.SYNOPSIS
  Собирает install.ps1 в исполняемый файл.

.DESCRIPTION
  Нужен, чтобы установщик запускался двойным щелчком: без обхода
  политики запуска, без Unblock-File и без объяснений про PowerShell.

  Честная оговорка: ps2exe не компилирует скрипт, а упаковывает его в
  оболочку на .NET. Внутри тот же PowerShell, поведение то же. Смысл
  только в удобстве запуска.

  Файл выходит неподписанным, поэтому на чужой машине SmartScreen
  покажет «Windows защитила ваш компьютер» — нужно нажать «Подробнее» и
  «Выполнить в любом случае». Антивирус тоже может насторожиться:
  упакованные скрипты для него подозрительны сами по себе. Если exe
  пойдёт людям, его стоит подписать сертификатом организации.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\build-exe.ps1
#>
[CmdletBinding()]
param(
    [string] $Source = (Join-Path $PSScriptRoot 'install.ps1'),
    [string] $Output = (Join-Path $PSScriptRoot 'DocmostInstaller.exe'),
    [string] $Icon   = (Join-Path $PSScriptRoot 'docmost.ico'),
    [string] $Version = '1.1.0'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Write-Host 'Нет модуля ps2exe. Поставить:' -ForegroundColor Yellow
    Write-Host '  Install-PackageProvider -Name NuGet -Force -Scope CurrentUser'
    Write-Host '  Install-Module ps2exe -Scope CurrentUser -Force'
    exit 1
}

if (-not (Test-Path $Source)) {
    Write-Host "Нет исходника: $Source" -ForegroundColor Red
    exit 1
}

# Значка может не быть в свежем клоне — рисуем на месте
if (-not (Test-Path $Icon)) {
    $maker = Join-Path $PSScriptRoot 'make-icon.ps1'
    if (Test-Path $maker) {
        Write-Host 'Значка нет, рисую' -ForegroundColor DarkGray
        & $maker | Out-Null
    }
}

Import-Module ps2exe

Write-Host "Собираю $Output" -ForegroundColor White

$iconArg = @{}
if (Test-Path $Icon) { $iconArg['iconFile'] = $Icon }

Invoke-PS2EXE @iconArg `
    -inputFile  $Source `
    -outputFile $Output `
    -title       'Установщик Docmost' `
    -description 'Разворачивает Docmost с нашими правками: WSL, Docker, стек в контейнерах' `
    -company     'MP-Lab' `
    -product     'Docmost' `
    -version     $Version `
    -requireAdmin `
    -noConsole:$false `
    -noError:$false

if (Test-Path $Output) {
    $kb = [math]::Round((Get-Item $Output).Length / 1KB, 1)
    Write-Host "Готово: $Output ($kb КБ)" -ForegroundColor Green
    Write-Host ''
    Write-Host 'Запуск: двойным щелчком (сам попросит права администратора)'
    Write-Host 'или из консоли с доводами:'
    Write-Host '  .\DocmostInstaller.exe -CheckOnly'
    Write-Host '  .\DocmostInstaller.exe -AppUrl https://wiki.example.ru -SiteIp 192.168.88.238'
} else {
    Write-Host 'Сборка не дала файла' -ForegroundColor Red
    exit 1
}
