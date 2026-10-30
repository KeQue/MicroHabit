$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'orchestrate.ps1')
$script:called = @()
$r = Invoke-Regression -Android { $script:called += 'android'; return 1 } -Ios { $script:called += 'ios'; return 0 }
if (($script:called -join ',') -ne 'android,ios' -or $r.Android -ne 1 -or $r.Ios -ne 0) { throw 'Failure must not skip iOS.' }
$script:called = @()
$r = Invoke-Regression -Android { $script:called += 'android'; throw 'synthetic failure' } -Ios { $script:called += 'ios'; return 2 }
if (($script:called -join ',') -ne 'android,ios' -or $r.Android -ne 2 -or $r.Ios -ne 2) { throw 'Exception must not skip iOS.' }
Write-Host 'Independent regression orchestration checks passed.'
