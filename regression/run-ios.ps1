$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
Write-Host 'This starts one GitHub Mac run and signs the saved test account in to production.'
Write-Host 'It may publish the committed QA branch to GitHub. Normal login updates auth metadata and the profile.'
if ((Read-Host 'Type YES to continue') -cne 'YES') { Write-Host 'Cancelled.'; exit 2 }
& node regression/run-ios.mjs
exit $LASTEXITCODE
