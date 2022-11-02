<#
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

    writeMsg "Setup nodejs registry..." "-NoNewLine"
    Start-Process "npm" -ArgumentList "set", "registry", "https://artifacthub-tip.oraclecorp.com/api/npm/npmjs-remote" -Wait -RedirectStandardOutput "$env:WORKSPACE\nodeFE.log" -RedirectStandardError "$env:WORKSPACE\nodeFEErr.log"
    writeMsg "DONE"

    writeMsg "Installing node modules..." "-NoNewLine"
    if ( !(Test-Path -Path "$basePath\node_modules") ){
        Start-Process "npm" -ArgumentList "install", "--force" -Wait -RedirectStandardOutput "$env:WORKSPACE\nodeFE.log" -RedirectStandardError "$env:WORKSPACE\nodeFEErr.log"
        writeMsg "DONE"
    }
    else{
        writeMsg "SKIPPED"
    }
    
    $env:PROXY = 'http://www-proxy.us.oracle.com:80'
    $env:HTTPS_PROXY = 'http://www-proxy.us.oracle.com:80'

    #############################EXEC TESTS#####################################################
    
    #MANAGE THE RE-RUN
    $jsonReporter = Get-Content -Path "$basePath\jesthtmlreporter.config.json" | Out-String | ConvertFrom-Json
    if ( !(Test-Path -Path "$basePath\src\tests\e2e\test-report.html") ){
        $jsonReporter.append = $false
    }
    else {
        $jsonReporter.append = $true
        $jsonReporter.pageTitle += " RE-RUN FAILED TESTS" 
    }

    $jsonReporter | ConvertTo-Json -Depth 1 | Set-Content "$basePath\jesthtmlreporter.config.json"
    
    if ($env:RERUN -eq $true){
        #CHECK IF THERE IS A TEST-REPORT
        if ( Test-Path -Path "$basePath\src\tests\e2e\test-report.html" ){
            writeMsg "Found an existing test report"

            ###GET FAILED TESTS###
            writeMsg "Getting failed tests from last run..."
            $html = parseHTML "$basePath\src\tests\e2e\test-report.html"
            $lastRun = $html.body.document.querySelectorAll("#jesthtml-content")
            $lastRunSize = $lastRun.Length
            $size = $lastRun[$lastRunSize -1].querySelectorAll(".failed .test-title").Length

            if ($size -gt 0){
                $failed = "`""
                for($i=0; $i -le $size-1; $i++){
                    $failedTest = $lastRun.querySelectorAll(".failed .test-title").item($i).InnerText
                    writeMsg "- $failedTest"
                    $failed += $failedTest
                    if ($i -ne $size-1){
                        $failed += "|"
                    }
                }
                $failed += "`""
                #RE-WRITE PACKAGE.JSON WITH TESTS TO RE-RUN
                if ($failed.Length -gt 0){
                    $json = Get-Content -Path "$basePath\package.json" | Out-String | ConvertFrom-Json
                    if ($json.scripts.'e2e-tests-run' -like "*testNamePattern*"){
                        $json.scripts.'e2e-tests-run' -match '--testNamePattern=''([^'']*)'''
                        $json.scripts.'e2e-tests-run' = $json.scripts.'e2e-tests-run'.replace($matches[1], $failed)
                    }
                    else{
                        $aux = $json.scripts.'e2e-tests-run'
                        $json.scripts.'e2e-tests-run' = "$aux --testNamePattern='$failed'"
                    }
                    
                    $json | ConvertTo-Json -Depth 3 | Set-Content "$basePath\package.json"
                }

                writeMsg "DONE"
            }
            else{
                writeMsg "No failed tests were found. DONE"
            }
        }
        else{
            writeMsg "Test report not found."
        }
    }
    
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

