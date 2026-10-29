param([ValidateSet('android', 'ios', 'all')][string]$Platform = 'android')
$ErrorActionPreference = 'Stop'
$runner = Join-Path $PSScriptRoot 'run.mjs'
# Check tools without collecting credentials or contacting the backend.
& node $runner doctor
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$previousEmail = [Environment]::GetEnvironmentVariable('MAESTRO_E2E_EMAIL', 'Process')
$previousPassword = [Environment]::GetEnvironmentVariable('MAESTRO_E2E_PASSWORD', 'Process')
$emailSecret = $null
$passwordSecret = $null
$result = 2
try {
    $emailSecret = Read-Host 'Existing test account email (hidden)' -AsSecureString
    $passwordSecret = Read-Host 'Existing test account password (hidden)' -AsSecureString
    foreach ($entry in @(
        @{ Name = 'MAESTRO_E2E_EMAIL'; Secret = $emailSecret },
        @{ Name = 'MAESTRO_E2E_PASSWORD'; Secret = $passwordSecret }
    )) {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($entry.Secret)
        try {
            [Environment]::SetEnvironmentVariable($entry.Name,
                [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer), 'Process')
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        }
    }
    & node $runner $Platform
    $result = $LASTEXITCODE
} finally {
    [Environment]::SetEnvironmentVariable('MAESTRO_E2E_EMAIL', $previousEmail, 'Process')
    [Environment]::SetEnvironmentVariable('MAESTRO_E2E_PASSWORD', $previousPassword, 'Process')
    if ($null -ne $emailSecret) { $emailSecret.Dispose() }
    if ($null -ne $passwordSecret) { $passwordSecret.Dispose() }
}
exit $result
