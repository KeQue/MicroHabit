param([ValidateSet('android', 'ios', 'all')][string]$Platform = 'android', [switch]$RequireSaved)
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
    . (Join-Path $PSScriptRoot 'credential-store.ps1')
    if (Test-Path -LiteralPath (Join-Path (Get-LoginStoreDirectory) 'login.dpapi.json')) {
        $saved = Read-LoginCredentials
        $emailSecret = $saved.Email
        $passwordSecret = $saved.Password
        Write-Host 'Using the saved Windows-protected test account.'
    } elseif ($RequireSaved) {
        throw 'Save the account locally before an unattended run.'
    } else {
        $emailSecret = Read-Host 'Existing test account email (hidden)' -AsSecureString
        $passwordSecret = Read-Host 'Existing test account password (hidden)' -AsSecureString
    }
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
} catch {
    Write-Host 'Local credential/test operation failed. Check the protected store and tool setup; no credential value was printed.'
    $result = 2
} finally {
    [Environment]::SetEnvironmentVariable('MAESTRO_E2E_EMAIL', $previousEmail, 'Process')
    [Environment]::SetEnvironmentVariable('MAESTRO_E2E_PASSWORD', $previousPassword, 'Process')
    if ($null -ne $emailSecret) { $emailSecret.Dispose() }
    if ($null -ne $passwordSecret) { $passwordSecret.Dispose() }
}
exit $result
