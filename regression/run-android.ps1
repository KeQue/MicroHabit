$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (@(git status --porcelain --untracked-files=no).Count -ne 0) { Write-Host 'Commit or restore tracked changes before recording the source revision.'; exit 2 }
& git ls-files --error-unmatch tests/e2e/scripts/retry-policy.mjs tests/e2e/scripts/duration.mjs regression/run-android.ps1 *> $null
if ($LASTEXITCODE -ne 0) { Write-Host 'Commit the new regression tools before recording the source revision.'; exit 2 }
$revision = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[a-f0-9]{40}$') { Write-Host 'Could not identify the source revision.'; exit 2 }
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) { Write-Host 'Android SDK adb is unavailable.'; exit 2 }
$devices = @(& $adb devices | Select-String '^emulator-\d+\s+device$' | ForEach-Object { ($_ -split '\s+')[0] })
if ($devices.Count -ne 1) { Write-Host 'Start exactly one dedicated Android test emulator first.'; exit 2 }
$avdName = (& $adb -s $devices[0] shell getprop ro.boot.qemu.avd_name | Out-String).Trim()
if ($avdName -ne 'Commito_E2E') { Write-Host 'The running emulator is not the dedicated Commito_E2E device.'; exit 2 }
$env:E2E_ANDROID_DEVICE = $devices[0]
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
exit $result
