function Invoke-Regression {
    param(
        [string]$Root = (Get-Location).Path,
        [string]$AndroidFile = 'regression/android/run.ps1',
        [string]$IosFile = 'regression/ios/run.ps1'
    )
    # Jobs retain output in memory rather than creating credential-bearing logs.
    $worker = {
        param($Directory, $File, $Platform)
        Set-Location -LiteralPath $Directory
        $ErrorActionPreference = 'Continue'
        if ($Platform -eq 'ios') {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $File '-SuiteConfirmed' 2>&1
        } else {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $File 2>&1
        }
        [pscustomobject]@{ CommitoJobResult = $Platform; ExitCode = $LASTEXITCODE }
    }
    $androidJob = $null
    $iosJob = $null
    $readJob = {
        param($Job, $Platform)
        foreach ($item in @(Receive-Job -Job $Job -ErrorAction Continue)) {
            if ($item.PSObject.Properties['CommitoJobResult'] -and $item.CommitoJobResult -ceq $Platform -and $item.ExitCode -is [int]) {
                if ($Platform -eq 'android') { $script:commitoAndroidResult = $item.ExitCode }
                else { $script:commitoIosResult = $item.ExitCode }
            } else { Write-Host $item }
        }
    }
    $script:commitoAndroidResult = 2
    $script:commitoIosResult = 2
    try {
        try { $androidJob = Start-Job -ScriptBlock $worker -ArgumentList $Root, $AndroidFile, 'android' }
        catch { Write-Host 'Android task could not start.' }
        try { $iosJob = Start-Job -ScriptBlock $worker -ArgumentList $Root, $IosFile, 'ios' }
        catch { Write-Host 'iOS task could not start.' }
        Write-Host 'Android and iOS regression tasks are running in parallel.'
        while (($androidJob -and $androidJob.State -in @('NotStarted', 'Running')) -or ($iosJob -and $iosJob.State -in @('NotStarted', 'Running'))) {
            if ($androidJob) { & $readJob $androidJob 'android' }
            if ($iosJob) { & $readJob $iosJob 'ios' }
            Start-Sleep -Milliseconds 250
        }
        if ($androidJob) { & $readJob $androidJob 'android' }
        if ($iosJob) { & $readJob $iosJob 'ios' }
        return @{ Android = $script:commitoAndroidResult; Ios = $script:commitoIosResult }
    } finally {
        foreach ($job in @($androidJob, $iosJob)) { if ($job) { Remove-Job -Job $job -Force -ErrorAction SilentlyContinue } }
        Remove-Variable commitoAndroidResult, commitoIosResult -Scope Script -ErrorAction SilentlyContinue
    }
}
