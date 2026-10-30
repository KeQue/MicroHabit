$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
Write-Host 'Regression runs Android locally and iOS on GitHub using the production test account.'
Write-Host 'Normal login updates auth metadata and the profile. The QA branch may be published.'
if ((Read-Host 'Type YES to run regression') -cne 'YES') { Write-Host 'Cancelled.'; exit 2 }
Write-Host 'Starting Android regression.'
. (Join-Path $PSScriptRoot 'orchestrate.ps1')
$results = Invoke-Regression -Android { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File regression/android/run.ps1 | Out-Host; return $LASTEXITCODE } -Ios { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File regression/ios/run.ps1 -SuiteConfirmed | Out-Host; return $LASTEXITCODE }
$androidResult = $results.Android
$iosResult = $results.Ios
Write-Host "Android exit code: $androidResult. iOS dispatch exit code: $iosResult."
if ($androidResult -ne 0 -or $iosResult -ne 0) { exit 1 }
Write-Host 'Android finished; iOS is running on GitHub. Check its report after completion.'
