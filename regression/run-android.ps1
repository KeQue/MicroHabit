$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (@(git status --porcelain --untracked-files=no).Count -ne 0) { Write-Host 'Commit or restore tracked changes before recording the source revision.'; exit 2 }
& git ls-files --error-unmatch tests/e2e/scripts/retry-policy.mjs tests/e2e/scripts/duration.mjs regression/run-android.ps1 *> $null
if ($LASTEXITCODE -ne 0) { Write-Host 'Commit the new regression tools before recording the source revision.'; exit 2 }
$revision = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[a-f0-9]{40}$') { Write-Host 'Could not identify the source revision.'; exit 2 }
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) { Write-Host 'Android SDK adb is unavailable.'; exit 2 }
$testDevice = $null
$result = 2
try {
Write-Host 'Starting the dedicated Android emulator in the background, if needed.'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/e2e/scripts/start-android.ps1 -Headless
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
$env:E2E_ANDROID_DEVICE = $testDevice
$env:E2E_ANDROID_APP_ID = 'com.sadik.microhabit'
$env:E2E_BACKEND_ENV = 'production'
$env:E2E_BACKEND_HOST = 'nzpnfrutomyuvrprkrwi.supabase.co'
$env:E2E_BUILD_BACKEND_CONFIRMED = 'yes'
$env:E2E_ALLOW_PRODUCTION_LOGIN = 'yes'
Write-Host 'Running login against production on the dedicated test emulator.'
$reportPath = 'tests/e2e/results/TC-001-latest.html'
$previousWrite = if (Test-Path -LiteralPath $reportPath) { (Get-Item -LiteralPath $reportPath).LastWriteTimeUtc } else { [DateTime]::MinValue }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/e2e/scripts/prompt-credentials.ps1 -Platform android -RequireSaved
$result = $LASTEXITCODE
if ((Test-Path -LiteralPath $reportPath) -and (Get-Item -LiteralPath $reportPath).LastWriteTimeUtc -gt $previousWrite) {
    & node tests/e2e/scripts/view-report.mjs android
}
if ($result -eq 0) {
    Write-Host "Android passed with evidence. For iOS use this source revision: $revision"
    Write-Host 'To start iOS without copying the revision, run the VS Code task Commito: Run iOS login.'
    Start-Process 'https://github.com/KeQue/MicroHabit/actions/workflows/e2e-ios-login.yml'
}
} finally {
    if ($testDevice) {
        $currentName = (& $adb -s $testDevice shell getprop ro.boot.qemu.avd_name 2>$null | Out-String).Trim()
        if ($currentName -eq 'Commito_E2E') {
            Write-Host 'Closing the dedicated Android emulator.'
            & $adb -s $testDevice emu kill | Out-Null
        } else { Write-Host 'Could not confirm the dedicated emulator for shutdown; no device was stopped.' }
    }
}
exit $result
