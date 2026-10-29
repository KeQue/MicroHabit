# Synthetic infrastructure checks only. Never touches the founder's saved store,
# contacts a backend, launches an emulator, or prints credential/ciphertext data.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'credential-store.ps1')
$toolsDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.tools'))
$fixture = Join-Path $toolsDirectory ('credential-check-' + [Guid]::NewGuid().ToString('N'))
$priorBackend = $env:E2E_BACKEND_ENV
$priorHost = $env:E2E_BACKEND_HOST
$email = $null
$password = $null
$loaded = $null
$checks = 0
function Assert-Check([bool]$Condition) {
    if (!$Condition) { throw 'Synthetic protected-store check failed; values withheld.' }
    $script:checks++
}
function Matches-Synthetic([Security.SecureString]$Value, [string]$Expected) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) -ceq $Expected }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
try {
    $env:E2E_BACKEND_ENV = 'staging'
    $env:E2E_BACKEND_HOST = 'synthetic.example.test'
    $email = ConvertTo-SecureString 'fixture-private@example.test' -AsPlainText -Force
    $password = ConvertTo-SecureString 'SYNTHETIC_DPAPI_PASSWORD' -AsPlainText -Force
    Save-LoginCredentials -Email $email -Password $password -Directory $fixture
    $path = Join-Path $fixture 'login.dpapi.json'
    $serialized = Get-Content -LiteralPath $path -Raw
    Assert-Check (!$serialized.Contains('fixture-private@example.test') -and !$serialized.Contains('SYNTHETIC_DPAPI_PASSWORD'))
    $loaded = Read-LoginCredentials -Directory $fixture
    Assert-Check (Matches-Synthetic $loaded.Email 'fixture-private@example.test')
    Assert-Check (Matches-Synthetic $loaded.Password 'SYNTHETIC_DPAPI_PASSWORD')
    $loaded.Email.Dispose(); $loaded.Password.Dispose(); $loaded = $null

    # Only the current SID and Windows SYSTEM may read the stored ciphertext.
    $allowed = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18')
    foreach ($protectedPath in @($fixture, $path)) {
        $rules = (Get-Acl -LiteralPath $protectedPath).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
        Assert-Check (@($rules | Where-Object { $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Value -notin $allowed }).Count -eq 0)
        Assert-Check (@($rules | Where-Object { $_.IdentityReference.Value -eq $allowed[0] -and $_.AccessControlType -eq 'Allow' }).Count -gt 0)
    }

    $env:E2E_BACKEND_HOST = 'different.example.test'
    $rejected = $false
    try { $loaded = Read-LoginCredentials -Directory $fixture } catch { $rejected = $true }
    Assert-Check $rejected
    $env:E2E_BACKEND_HOST = 'synthetic.example.test'

    $record = $serialized | ConvertFrom-Json
    $record.password = 'invalid-protected-value'
    [IO.File]::WriteAllText($path, ($record | ConvertTo-Json))
    $rejected = $false
    try { $loaded = Read-LoginCredentials -Directory $fixture } catch { $rejected = $true }
    Assert-Check $rejected

    Save-LoginCredentials -Email $email -Password $password -Directory $fixture
    $loaded = Read-LoginCredentials -Directory $fixture
    Assert-Check (Matches-Synthetic $loaded.Password 'SYNTHETIC_DPAPI_PASSWORD')
    $loaded.Email.Dispose(); $loaded.Password.Dispose(); $loaded = $null
    Remove-LoginCredentials -Directory $fixture
    Assert-Check (!(Test-Path -LiteralPath $path))
    $rejected = $false
    try { $loaded = Read-LoginCredentials -Directory $fixture } catch { $rejected = $true }
    Assert-Check $rejected
    $rejected = $false
    try { Assert-LoginStorePath ([IO.Path]::GetFullPath((Join-Path $toolsDirectory '../../results'))) } catch { $rejected = $true }
    Assert-Check $rejected
    Write-Host "Protected local-store checks passed: $checks. Synthetic data only; no login."
} finally {
    if ($null -ne $email) { $email.Dispose() }
    if ($null -ne $password) { $password.Dispose() }
    if ($null -ne $loaded) { $loaded.Email.Dispose(); $loaded.Password.Dispose() }
    [Environment]::SetEnvironmentVariable('E2E_BACKEND_ENV', $priorBackend, 'Process')
    [Environment]::SetEnvironmentVariable('E2E_BACKEND_HOST', $priorHost, 'Process')
    $resolved = [IO.Path]::GetFullPath($fixture)
    if (!$resolved.StartsWith($toolsDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Unsafe synthetic cleanup path.'
    }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
