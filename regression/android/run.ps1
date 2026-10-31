$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../..')
$totalTimer = [Diagnostics.Stopwatch]::StartNew()
$previousLauncherTimings = $env:E2E_ANDROID_LAUNCHER_TIMINGS
if (@(git status --porcelain --untracked-files=no).Count -ne 0) { Write-Host 'Commit or restore tracked changes before recording the source revision.'; exit 2 }
& git ls-files --error-unmatch tests/e2e/scripts/retry-policy.mjs tests/e2e/scripts/duration.mjs regression/android/run.ps1 *> $null
if ($LASTEXITCODE -ne 0) { Write-Host 'Commit the new regression tools before recording the source revision.'; exit 2 }
$revision = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[a-f0-9]{40}$') { Write-Host 'Could not identify the source revision.'; exit 2 }
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) { Write-Host 'Android SDK adb is unavailable.'; exit 2 }
$runningDevices = @(& $adb devices | Select-String '^emulator-\d+\s+' | ForEach-Object { ($_ -split '\s+')[0] })
foreach ($serial in $runningDevices) {
    $name = (& $adb -s $serial shell getprop ro.boot.qemu.avd_name 2>$null | Out-String).Trim()
    if ($name -ne 'Commito_E2E') { Write-Host 'Close other or offline emulators before preparing the Android build.'; exit 2 }
    Write-Host 'Closing the dedicated emulator before the build to free memory.'
    & $adb -s $serial emu kill | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host 'Could not close the dedicated emulator.'; exit 2 }
}
$buildTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host 'Preparing the Android APK.'
& node regression/android/build-apk.mjs
$buildTimer.Stop()
Write-Host "Android APK preparation: $([math]::Round($buildTimer.Elapsed.TotalSeconds, 1)) seconds."
if ($LASTEXITCODE -ne 0) { Write-Host 'Android build verification failed; no Android login was attempted.'; exit 2 }
$testDevice = $null
$result = 2
try {
$bootTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host 'Starting the dedicated Android emulator in the background, if needed.'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/e2e/scripts/start-android.ps1
if ($LASTEXITCODE -ne 0) { Write-Host 'Could not start the dedicated Android emulator.'; exit 2 }
$deadline = [DateTime]::UtcNow.AddMinutes(3)
while ([DateTime]::UtcNow -lt $deadline) {
    $devices = @(& $adb devices | Select-String '^emulator-\d+\s+device$' | ForEach-Object { ($_ -split '\s+')[0] })
    if ($devices.Count -gt 1) { Write-Host 'More than one emulator is connected; stopping safely.'; exit 2 }
    if ($devices.Count -eq 1) {
        $avdName = (& $adb -s $devices[0] shell getprop ro.boot.qemu.avd_name | Out-String).Trim()
        if ($avdName -eq 'Commito_E2E') {
            $testDevice = $devices[0]
            $booted = (& $adb -s $testDevice shell getprop sys.boot_completed | Out-String).Trim()
            if ($booted -eq '1') { break }
        } elseif ($avdName) { Write-Host 'The connected emulator is not Commito_E2E.'; exit 2 }
    }
    Start-Sleep -Seconds 3
}
if (-not $testDevice -or $booted -ne '1') { Write-Host 'The dedicated Android emulator did not finish booting within three minutes.'; exit 2 }
$bootTimer.Stop()
Write-Host "Android emulator startup: $([math]::Round($bootTimer.Elapsed.TotalSeconds, 1)) seconds."
$recoveryTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host 'Checking for an Android system dialog before waiting for UI stabilization.'
& node tests/e2e/scripts/run.mjs android-readiness $testDevice
if ($LASTEXITCODE -ne 0) { Write-Host 'Android System UI is not ready; login skipped.'; exit 2 }
$recoveryTimer.Stop()
$stabilizationTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host 'Confirming Android System UI stability.'
$stable = 0
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    $windows = (& $adb -s $testDevice shell dumpsys window windows 2>$null | Out-String)
    $hasError = $windows -match '(?m)^\s*Window #\d+ Window\{[^\r\n]*Application (?:Not Responding|Error):'

    if ($hasError) {
        Write-Host 'An Android application error appeared during stabilization; checking the safe System UI recovery.'
        $recoveryTimer.Start()
        & node tests/e2e/scripts/run.mjs android-readiness $testDevice
        $recoveryTimer.Stop()
        if ($LASTEXITCODE -ne 0) { Write-Host 'Android error window could not be safely recovered; login skipped.'; exit 2 }
        $stable = 0
        continue
    }

    if ($LASTEXITCODE -eq 0 -and $windows -match 'WINDOW MANAGER WINDOWS' -and -not $hasError) {
        $stable++
        if ($stable -ge 3) { break }
    } else {
        $stable = 0
    }
}
if ($stable -lt 3) {
    $errorWindows = @($windows -split "`n" | Where-Object { $_ -match '^\s*Window #\d+ Window\{[^\r\n]*Application (?:Not Responding|Error):' })
    Write-Host 'Android System UI did not stabilize; login skipped.'
    exit 2
}
$stabilizationTimer.Stop()
Write-Host "Android System UI stabilization: $([math]::Round($stabilizationTimer.Elapsed.TotalSeconds, 1)) seconds."
$installTimer = [Diagnostics.Stopwatch]::StartNew()
$apk = 'android/app/build/outputs/apk/release/app-release.apk'
$expectedHash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
function Get-InstalledApkHash {
    $paths = @(& $adb -s $testDevice shell pm path com.sadik.microhabit 2>$null | Where-Object { $_ -match '^package:' })
    if ($paths.Count -ne 1 -or $paths[0] -notmatch '^package:/data/app/[-A-Za-z0-9._~=/]+/base\.apk\s*$') { return $null }
    $path = ($paths[0] -replace '^package:', '').Trim()
    $output = (& $adb -s $testDevice shell sha256sum $path 2>$null | Out-String).Trim()
    if ($output -match '^([a-fA-F0-9]{64})\s') { return $Matches[1].ToLowerInvariant() }
    return $null
}
if ((Get-InstalledApkHash) -ne $expectedHash) {
    Write-Host 'Installing the current Android APK on the dedicated emulator.'
    & $adb -s $testDevice install -r $apk
    if ($LASTEXITCODE -ne 0) { Write-Host 'Android APK installation failed.'; exit 2 }
}
if ((Get-InstalledApkHash) -ne $expectedHash) { Write-Host 'Could not verify the installed Android APK; no login was attempted.'; exit 2 }
$installTimer.Stop()
Write-Host "Android APK installation and verification: $([math]::Round($installTimer.Elapsed.TotalSeconds, 1)) seconds."
Write-Host 'Verified the installed Android APK matches the current build.'
$env:E2E_ANDROID_DEVICE = $testDevice
$env:E2E_ANDROID_APP_ID = 'com.sadik.microhabit'
$env:E2E_BACKEND_ENV = 'production'
$env:E2E_BACKEND_HOST = 'nzpnfrutomyuvrprkrwi.supabase.co'
$env:E2E_BUILD_BACKEND_CONFIRMED = 'yes'
$env:E2E_ALLOW_PRODUCTION_LOGIN = 'yes'
$env:E2E_ANDROID_LAUNCHER_TIMINGS = [ordered]@{
    apkPreparationSeconds = [math]::Round($buildTimer.Elapsed.TotalSeconds, 1)
    emulatorStartupSeconds = [math]::Round($bootTimer.Elapsed.TotalSeconds, 1)
    androidDialogRecoverySeconds = [math]::Round($recoveryTimer.Elapsed.TotalSeconds, 1)
    systemUiStabilizationSeconds = [math]::Round($stabilizationTimer.Elapsed.TotalSeconds, 1)
    apkInstallationSeconds = [math]::Round($installTimer.Elapsed.TotalSeconds, 1)
} | ConvertTo-Json -Compress
Write-Host 'Running login against production on the dedicated test emulator.'
$testTimer = [Diagnostics.Stopwatch]::StartNew()
$reportPath = 'tests/e2e/results/TC-001-latest.html'
$previousWriteNs = if (Test-Path -LiteralPath $reportPath) { ((Get-Item -LiteralPath $reportPath).LastWriteTimeUtc.Ticks - 621355968000000000) * 100 } else { -1 }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/e2e/scripts/prompt-credentials.ps1 -Platform android -RequireSaved
$result = $LASTEXITCODE
Write-Host "Android credential and E2E runner step: $([math]::Round($testTimer.Elapsed.TotalSeconds, 1)) seconds."
& node tests/e2e/scripts/view-report.mjs android --newer-than-ns $previousWriteNs
if ($result -eq 0) { Write-Host "Android passed with evidence for source revision: $revision" }
} finally {
    if ($testDevice) {
        $currentName = (& $adb -s $testDevice shell getprop ro.boot.qemu.avd_name 2>$null | Out-String).Trim()
        if ($currentName -eq 'Commito_E2E') {
            Write-Host 'Closing the dedicated Android emulator.'
            & $adb -s $testDevice emu kill | Out-Null
        } else { Write-Host 'Could not confirm the dedicated emulator for shutdown; no device was stopped.' }
    }
    $env:E2E_ANDROID_LAUNCHER_TIMINGS = $previousLauncherTimings
    $totalTimer.Stop()
    Write-Host "Android launcher total, including APK/emulator setup and report opening: $([math]::Round($totalTimer.Elapsed.TotalSeconds, 1)) seconds."
}
exit $result
