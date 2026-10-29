# Windows-only local storage. Both fields use current-user DPAPI, never a saved
# AES key or plaintext. This file defines helpers; it performs no login.
$ErrorActionPreference = 'Stop'

function Get-LoginStoreDirectory {
    return [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.tools/credentials'))
}

function Assert-LoginStorePath([string]$Directory) {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw 'Saved local credentials require Windows DPAPI. Use CI secrets on other hosts.'
    }
    $toolsDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.tools'))
    $resolved = [IO.Path]::GetFullPath($Directory)
    if (!$resolved.StartsWith($toolsDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Credential storage must stay inside the ignored local tools directory.'
    }
    foreach ($entry in @($toolsDirectory, $resolved, (Join-Path $resolved 'login.dpapi.json'))) {
        if ((Test-Path -LiteralPath $entry) -and ((Get-Item -LiteralPath $entry -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Credential storage cannot use a link or junction.'
        }
    }
}

function Get-LoginStoreContext {
    $backend = $env:E2E_BACKEND_ENV
    $backendHost = $env:E2E_BACKEND_HOST
    if ($backend -notin @('production', 'staging') -or $backendHost -notmatch '^[a-z0-9][a-z0-9.-]{1,250}\.[a-z]{2,20}$') {
        throw 'Set the backend environment and hostname before using saved credentials.'
    }
    if ($backendHost -eq 'nzpnfrutomyuvrprkrwi.supabase.co' -and $backend -ne 'production') {
        throw 'The known production backend must be labelled production.'
    }
    return @{ backendEnvironment = $backend; backendHost = $backendHost }
}

function Save-LoginCredentials([Security.SecureString]$Email, [Security.SecureString]$Password, [string]$Directory = (Get-LoginStoreDirectory)) {
    Assert-LoginStorePath $Directory
    $context = Get-LoginStoreContext
    if (!$Email.Length -or !$Password.Length) { throw 'Both credential fields are required.' }
    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    # Restrict the folder before creating a file. These rules also protect new
    # children; DPAPI independently binds decryption to the Windows user.
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [IO.Directory]::GetAccessControl($Directory, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($existingRule in $acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier])) {
        $acl.PurgeAccessRules($existingRule.IdentityReference)
    }
    foreach ($identity in @($sid, (New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))) {
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    [IO.Directory]::SetAccessControl($Directory, $acl)
    $path = Join-Path $Directory 'login.dpapi.json'
    # No -Key: Windows supplies current-user DPAPI protection.
    $record = @{
        format = 'Commito-E2E-DPAPI-v1'
        backendEnvironment = $context.backendEnvironment
        backendHost = $context.backendHost
        email = ConvertFrom-SecureString -SecureString $Email
        password = ConvertFrom-SecureString -SecureString $Password
    }
    try {
        [IO.File]::WriteAllText($path, ($record | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
        # Remove any explicit file rules left by a previous file and inherit the
        # restricted folder rules, including when replacing an existing record.
        $fileAcl = [IO.File]::GetAccessControl($path, [Security.AccessControl.AccessControlSections]::Access)
        foreach ($existingRule in $fileAcl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier])) {
            $fileAcl.PurgeAccessRules($existingRule.IdentityReference)
        }
        $fileAcl.SetAccessRuleProtection($false, $false)
        [IO.File]::SetAccessControl($path, $fileAcl)
    } catch { throw 'Could not save protected local credentials. No credential value was printed.' }
}

function Read-LoginCredentials([string]$Directory = (Get-LoginStoreDirectory)) {
    Assert-LoginStorePath $Directory
    $context = Get-LoginStoreContext
    $email = $null
    $password = $null
    try {
        $record = Get-Content -LiteralPath (Join-Path $Directory 'login.dpapi.json') -Raw | ConvertFrom-Json
        if ($record.format -ne 'Commito-E2E-DPAPI-v1' -or $record.backendEnvironment -cne $context.backendEnvironment -or $record.backendHost -cne $context.backendHost) {
            throw 'Mismatched credential context'
        }
        $email = ConvertTo-SecureString -String $record.email -ErrorAction Stop
        $password = ConvertTo-SecureString -String $record.password -ErrorAction Stop
        if (!$email.Length -or !$password.Length) { throw 'Empty credentials' }
        return @{ Email = $email; Password = $password }
    } catch {
        if ($null -ne $email) { $email.Dispose() }
        if ($null -ne $password) { $password.Dispose() }
        throw 'Saved credentials could not be opened for this Windows user/backend. Save the account again locally; no value was printed.'
    }
}

function Remove-LoginCredentials([string]$Directory = (Get-LoginStoreDirectory)) {
    Assert-LoginStorePath $Directory
    $path = Join-Path $Directory 'login.dpapi.json'
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
}
