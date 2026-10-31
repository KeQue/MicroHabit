$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'orchestrate.ps1')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) "commito-regression-test-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $androidFile = Join-Path $testRoot 'android.ps1'
    $iosFile = Join-Path $testRoot 'ios.ps1'
    $androidSource = @'
$ErrorActionPreference = 'Stop'
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'android.started'), '')
$deadline = [DateTime]::UtcNow.AddSeconds(10)
while (-not (Test-Path (Join-Path $PSScriptRoot 'ios.started')) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 50 }
if (-not (Test-Path (Join-Path $PSScriptRoot 'ios.started'))) { exit 3 }
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'android.finished'), '')
exit __EXIT_CODE__
'@
    $iosSource = @'
$ErrorActionPreference = 'Stop'
$deadline = [DateTime]::UtcNow.AddSeconds(10)
while (-not (Test-Path (Join-Path $PSScriptRoot 'android.started')) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 50 }
if (-not (Test-Path (Join-Path $PSScriptRoot 'android.started'))) { exit 3 }
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'ios.started'), '')
while (-not (Test-Path (Join-Path $PSScriptRoot 'android.finished')) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 50 }
if (-not (Test-Path (Join-Path $PSScriptRoot 'android.finished'))) { exit 4 }
exit __EXIT_CODE__
'@
    foreach ($case in @(
        @{ AndroidExit = 1; IosExit = 0 },
        @{ AndroidExit = 0; IosExit = 2 }
    )) {
        Remove-Item -LiteralPath (Join-Path $testRoot 'android.started'), (Join-Path $testRoot 'ios.started'), (Join-Path $testRoot 'android.finished') -Force -ErrorAction SilentlyContinue
        Set-Content -LiteralPath $androidFile -Value $androidSource.Replace('__EXIT_CODE__', [string]$case.AndroidExit)
        Set-Content -LiteralPath $iosFile -Value $iosSource.Replace('__EXIT_CODE__', [string]$case.IosExit)
        $result = Invoke-Regression -Root $testRoot -AndroidFile 'android.ps1' -IosFile 'ios.ps1'
        if ($result.Android -ne $case.AndroidExit -or $result.Ios -ne $case.IosExit) { throw 'Runner exit codes were not preserved.' }
        if (-not (Test-Path (Join-Path $testRoot 'ios.started'))) { throw 'iOS did not start alongside Android.' }
    }
    Write-Host 'Parallel regression orchestration and independent result checks passed.'
} finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}
