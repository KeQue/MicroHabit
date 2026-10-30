function Invoke-Regression {
    param([scriptblock]$Android, [scriptblock]$Ios)
    $androidResult = 2
    $iosResult = 2
    try { $androidResult = & $Android } catch { Write-Host 'Android task could not start.' }
    Write-Host "Android task exit code: $androidResult. Starting iOS independently."
    try { $iosResult = & $Ios } catch { Write-Host 'iOS task could not start.' }
    return @{ Android = $androidResult; Ios = $iosResult }
}
