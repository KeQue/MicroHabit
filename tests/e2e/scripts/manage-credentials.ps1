param([ValidateSet('save', 'forget', 'status')][string]$Action = 'save')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'credential-store.ps1')
$emailSecret = $null
$passwordSecret = $null
try {
    if ($Action -eq 'forget') {
        Remove-LoginCredentials
        Write-Host 'Removed the saved local account. GitHub secrets were not changed.'
    } elseif ($Action -eq 'status') {
        Assert-LoginStorePath (Get-LoginStoreDirectory)
        $exists = Test-Path -LiteralPath (Join-Path (Get-LoginStoreDirectory) 'login.dpapi.json')
        Write-Host "Protected local account present: $exists. No credential value was read."
    } else {
        $null = Get-LoginStoreContext
        $emailSecret = Read-Host 'Existing test account email (hidden, saved encrypted for this Windows user)' -AsSecureString
        $passwordSecret = Read-Host 'Existing test account password (hidden, saved encrypted for this Windows user)' -AsSecureString
        Save-LoginCredentials -Email $emailSecret -Password $passwordSecret
        $verified = Read-LoginCredentials
        $verified.Email.Dispose()
        $verified.Password.Dispose()
        Write-Host 'Saved both fields using Windows DPAPI. Future local test runs can reuse this account.'
    }
} catch {
    Write-Host 'Credential operation failed. Check Windows access, backend settings and the local protected store. No value was printed.'
    exit 2
} finally {
    if ($null -ne $emailSecret) { $emailSecret.Dispose() }
    if ($null -ne $passwordSecret) { $passwordSecret.Dispose() }
}
exit 0
