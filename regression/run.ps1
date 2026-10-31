$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
Write-Host 'Regression runs Android locally and iOS on GitHub in parallel, using separate production test accounts.'
Write-Host 'Normal login updates auth metadata and the profile. The QA branch may be published.'
Write-Host 'The saved Android account and GitHub iOS account must be different; this launcher cannot verify the GitHub secret.'
Write-Host 'Before continuing, make sure no other login test is using either account.'
if ((Read-Host 'Type YES to run regression') -cne 'YES') { Write-Host 'Cancelled.'; exit 2 }
Write-Host 'Starting Android and iOS regression in parallel.'
. (Join-Path $PSScriptRoot 'orchestrate.ps1')
$results = Invoke-Regression -Root (Get-Location).Path
$androidResult = $results.Android
$iosResult = $results.Ios
Write-Host "Android exit code: $androidResult. iOS dispatch exit code: $iosResult."
if ($androidResult -ne 0 -or $iosResult -ne 0) { exit 1 }
Write-Host 'Android and iOS finished. Their private reports opened in your browser.'
