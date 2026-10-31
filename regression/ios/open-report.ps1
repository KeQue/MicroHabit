param([Parameter(Mandatory=$true)][ValidatePattern('^\d{8,15}$')][string]$RunId)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../..')
& node regression/ios/download-report.mjs $RunId
if ($LASTEXITCODE -ne 0) { Write-Host 'Could not download the encrypted iOS report.'; exit 2 }
$directory = Join-Path 'tests/e2e/results/downloads' "ios-$RunId"
$zipPath = Join-Path $directory 'report.zip'
$encryptedPath = Join-Path $directory 'TC-002-report.encrypted.json'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $zipPath).Path)
try {
    $entries = @($zip.Entries)
    if ($entries.Count -ne 1 -or $entries[0].FullName -ne 'TC-002-report.encrypted.json' -or $entries[0].Length -gt 20MB) { throw 'Unexpected report archive contents.' }
    $inputStream = $entries[0].Open()
    try {
        $outputStream = [IO.File]::Open($encryptedPath, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose() }
    } finally { $inputStream.Dispose() }
} finally { $zip.Dispose() }
& node tests/e2e/scripts/report.mjs decrypt $encryptedPath
if ($LASTEXITCODE -ne 0) { Write-Host 'Could not decrypt the iOS report with this laptop key.'; exit 2 }
& node tests/e2e/scripts/view-report.mjs downloaded-ios
exit $LASTEXITCODE
