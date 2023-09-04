<#
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
#>

##THIS SCRIPT WILL PERFORM THE FOLLOWING TASKS##
# INSTALL NODE MODULES
# RUN E2E UPDATE (GET CHROME DRIVER)
# EXECUTE TESTS
#THESE TASKS WILL ENSURE THAT THE ENVIRONMENT IS OK TO RUN MYSQLSHELL UI TESTS

Set-Location $PSScriptRoot
$basePath = Join-Path ".." ".." ".." ".."
Set-Location $basePath
$basePath = Get-Location

function parseHTML($path){
    $source = Get-Content -Path $path -Raw
    $html = New-Object -Com "HTMLFile"
    $src = [System.Text.Encoding]::Unicode.GetBytes($source)
    $html.write($src)
    return $html
}

try {
    $err = 0

    $log = Join-Path $env:WORKSPACE "psFE.log"

    function writeMsg($msg, $option){

        $msg | Out-File $log -Append

        Invoke-Expression "write-host `"$msg`" $option"
        
    }
    
    if ( Test-Path -Path $log ){
        Remove-Item -Path $log -Recurse -Force	
    }

    New-Item -ItemType "file" -Path $log

    writeMsg "BRANCH: $env:BRANCH_NAME"
    writeMsg "REVISION: $env:TARGET_REVID"
    writeMsg "WORKSPACE: $env:WORKSPACE"
    writeMsg "BASE PATH: $basePath"
    writeMsg "TARGET FOR REPORT: $env:REPORT_TARGET"

    writeMsg "Setup nodejs registry..." "-NoNewLine"
    $prc = Start-Process "npm" -ArgumentList "set", "registry", "https://artifacthub-phx.oci.oraclecorp.com/api/npm/npmjs-remote/" -Wait -PassThru -RedirectStandardOutput "$env:WORKSPACE\nodeFE.log" -RedirectStandardError "$env:WORKSPACE\nodeFEErr.log"
    if ($prc.ExitCode -ne 0){
        Throw "Error setting nodejs registry"
    }
    else{
        writeMsg "DONE"
    }

    if (Test-Path -Path "$basePath\package-lock.json"){
        writeMsg "Removing package-lock.json..." "-NoNewLine"
        Remove-Item -Path "$basePath\package-lock.json" -Force
        writeMsg "DONE"
    }

    writeMsg "Installing node modules..." "-NoNewLine"
    $prc = Start-Process "npm" -ArgumentList "install" -Wait -PassThru -RedirectStandardOutput "$env:WORKSPACE\nodeFE.log" -RedirectStandardError "$env:WORKSPACE\nodeFEErr.log"
    if ($prc.ExitCode -ne 0){
        Throw "Error installing node modules"
    }
    else{
        writeMsg "DONE"
    }
    
    $env:PROXY = 'http://www-proxy.us.oracle.com:80'
    $env:HTTPS_PROXY = 'http://www-proxy.us.oracle.com:80'

    #############################EXEC TESTS#####################################################
    
    #EXECUTE TESTS
    writeMsg "Executing GUI tests..." "-NoNewLine"
    Start-Process -FilePath "npm" -ArgumentList "run", "e2e-tests-run" -Wait -RedirectStandardOutput "$env:WORKSPACE\resultsFE.log" -RedirectStandardError "$env:WORKSPACE\resultsFEErr.log"
    writeMsg "DONE"

    writeMsg "Running post actions" "-NoNewLine"
    Start-Process -FilePath "npm" -ArgumentList "run", "e2e-tests-report" -Wait -RedirectStandardOutput "$env:WORKSPACE\postActions.log" -RedirectStandardError "$env:WORKSPACE\postActionsErr.log"
    writeMsg "DONE"

    #CHECK RESULTS
    $hasFailedTests = $null -ne (Get-Content -Path "$env:WORKSPACE\resultsFEErr.log" | Select-String -Pattern "(\d+) failed" | % { $_.Matches.Groups[0].Value })
    $hasPassedTests = $null -ne (Get-Content -Path "$env:WORKSPACE\resultsFEErr.log" | Select-String -Pattern "(\d+) passed" | % { $_.Matches.Groups[0].Value })

    if ( $hasFailedTests -or (!$hasFailedTests -and !$hasPassedTests) ){
        writeMsg "There are failed tests !"
        $err = 1
    }
    else{
        writeMsg "All tests passed !"
    }

}
catch {
    writeMsg $_
	writeMsg $_.ScriptStackTrace
	$err = 1
}
finally {
    try {
        Get-Process | Where-Object {$_.Name -like "*chromedriver*" } | Stop-Process -Force
        Get-Process | Where-Object {$_.Name -like "*chrome*" } | Stop-Process -Force
    }
    catch {
        writeMsg "Selenium is not running. All fine"
    }

    if ( $err -eq 1){
        exit 1
    }
}

