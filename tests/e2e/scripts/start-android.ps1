# Reuses an installed image. Never downloads images or wipes an existing AVD.
param([switch]$Headless)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$sdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$adbPath = Join-Path $sdkPath 'platform-tools/adb.exe'
$emulatorPath = Join-Path $sdkPath 'emulator/emulator.exe'
$imagePath = Join-Path $sdkPath 'system-images/android-34/google_apis_playstore/x86_64'
foreach ($requiredPath in @($adbPath, $emulatorPath, (Join-Path $imagePath 'system.img'))) {
    if (!(Test-Path -LiteralPath $requiredPath)) {
        throw 'BLOCKED: Android SDK, emulator or the existing Android 14 Google Play x86_64 image is missing. No download attempted.'
    }
}
$env:ANDROID_HOME = $sdkPath
$env:ANDROID_USER_HOME = Join-Path $env:USERPROFILE '.android'
$env:ANDROID_EMULATOR_HOME = $env:ANDROID_USER_HOME
$env:ANDROID_AVD_HOME = Join-Path $projectRoot 'tests/e2e/.tools/avd'
$avdName = 'Commito_E2E'
$avdPath = Join-Path $env:ANDROID_AVD_HOME "$avdName.avd"
New-Item -ItemType Directory -Path $avdPath -Force | Out-Null
$avdConfig = Join-Path $avdPath 'config.ini'
if (!(Test-Path -LiteralPath $avdConfig)) {
    @"
AvdId=$avdName
avd.ini.displayname=Commito E2E Android 14
avd.ini.encoding=UTF-8
abi.type=x86_64
tag.id=google_apis_playstore
tag.display=Google Play
PlayStore.enabled=true
image.sysdir.1=$imagePath\
hw.cpu.arch=x86_64
hw.cpu.ncore=2
hw.ramSize=2048
hw.device.name=pixel_7
hw.device.manufacturer=Google
hw.lcd.width=1080
hw.lcd.height=2400
hw.lcd.density=420
hw.keyboard=yes
hw.gpu.enabled=yes
hw.gpu.mode=auto
disk.dataPartition.size=4G
fastboot.forceColdBoot=yes
showDeviceFrame=no
"@ | Set-Content -LiteralPath $avdConfig -Encoding ASCII
    @"
avd.ini.encoding=UTF-8
path=$avdPath
target=android-34
"@ | Set-Content -LiteralPath (Join-Path $env:ANDROID_AVD_HOME "$avdName.ini") -Encoding ASCII
}
# Ensure a host key exists before a fresh guest is initialized. Never overwrite
# an existing host key or print its content. The guest receives its public key.
$adbKeyPath = Join-Path $env:ANDROID_USER_HOME 'adbkey'
if (!(Test-Path -LiteralPath $adbKeyPath)) {
    New-Item -ItemType Directory -Path $env:ANDROID_USER_HOME -Force | Out-Null
    & $adbPath keygen $adbKeyPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'BLOCKED: ADB key generation failed.' }
}
$env:ADB_VENDOR_KEYS = $adbKeyPath
$deviceLines = @(& $adbPath devices)
$devices = @($deviceLines | Where-Object { $_ -match '^emulator-\d+\s' })
foreach ($deviceLine in $devices) {
    $serial = ($deviceLine -split '\s+')[0]
    $name = (& $adbPath -s $serial shell getprop ro.boot.qemu.avd_name 2>$null | Out-String).Trim()
    if ($name -eq $avdName -and $deviceLine -match '\sdevice\s*$') {
        Write-Output "Dedicated test emulator already running: $serial"
        exit 0
    }
}
if ($devices.Count -gt 0) { throw 'BLOCKED: close other emulators before starting Commito_E2E on this 8 GB laptop. No process was stopped.' }
$launchArgs = @('-avd', $avdName, '-memory', '2048', '-cores', '2', '-no-snapshot-load', '-no-snapshot-save', '-no-audio', '-no-boot-anim', '-no-metrics')
if ($Headless) { $launchArgs += '-no-window' }
# Hidden launcher; the emulator itself is interactive unless Headless was set.
$started = Start-Process -FilePath $emulatorPath -ArgumentList $launchArgs -WindowStyle Hidden -PassThru
Write-Output "Started dedicated $avdName (launcher PID $($started.Id)). Allow up to two minutes for its first boot."
Write-Output 'Use adb devices -l; proceed only when the selected emulator reports device.'
