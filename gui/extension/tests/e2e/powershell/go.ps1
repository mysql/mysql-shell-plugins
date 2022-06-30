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
# DOWNLOAD LATEST MYSQLSHELL
# DOWNLOAD LATEST GUI PLUGIN
# START MYSQL SHELL FOR THE FIRST TIME, TO CREATE MYSQLSH FOLDER ON APPDATA (REQUIRED) 
# COPY FILES FROM GUI PLUGIN TO MYSQLSH FOLDER
# START WEB SERVER TO CHECK THAT IT WORKS
# STARTS SELENIUM
# EXECUTE TESTS
# STOP SELENIUM
#THESE TASKS WILL ENSURE THAT THE ENVIRONMENT IS OK TO RUN MYSQLSHELL UI TESTS
$basePath = Join-Path $env:WORKSPACE "shell-plugins" "gui" "extension"
$testsPath = Join-Path $basePath "tests" "e2e" "tests" "ui-tests.ts"

try{
    $err = 0

    $log = Join-Path $env:WORKSPACE "ps.log"

    function writeMsg($msg, $option){

        $msg | Out-File $log -Append

        Invoke-Expression "write-host `"$msg`" $option"
        
    }

    if(!$env:EXTENSION_BRANCH){
        Throw "Please define 'EXTENSION_BRANCH' env variable"
    }
    if(!$env:WORKSPACE){
        Throw "Please define 'WORKSPACE' env variable"
    }
    
    if( Test-Path -Path $log ){
        Remove-Item -Path $log -Recurse -Force	
    }

    New-Item -ItemType "file" -Path $log

    writeMsg "Setup nodejs registry..." "-NoNewLine"
    $prc = Start-Process "npm" -ArgumentList "set", "registry", "https://artifacthub-phx.oci.oraclecorp.com/api/npm/npmjs-remote/" -Wait -PassThru -RedirectStandardOutput "$env:WORKSPACE\node.log" -RedirectStandardError "$env:WORKSPACE\nodeErr.log"
    if($prc.ExitCode -ne 0){
        Throw "Error setting nodejs registry"
    }
    else{
        writeMsg "DONE"
    }

    writeMsg "Removing Plugin database..." "-NoNewLine"
    $dbLocation = Join-Path $HOME "AppData" "Roaming" "MySQL" "mysqlsh-gui" "plugin_data" "gui_plugin" "mysqlsh_gui_backend.sqlite3"
    Remove-Item -Path $dbLocation -Force
    writeMsg "DONE"
	
	writeMsg "Setup noproxy..." "-NoNewLine"
    $prc = Start-Process "npm" -ArgumentList "config", "set", "noproxy", "localhost,127.0.0.1,.oraclecorp.com,.oracle.com" -Wait -PassThru -RedirectStandardOutput "$env:WORKSPACE\node.log" -RedirectStandardError "$env:WORKSPACE\nodeErr.log"
    if($prc.ExitCode -ne 0){
        Throw "Error setting nodejs registry"
    }
    else{
        writeMsg "DONE"
    }

    $env:HTTP_PROXY = 'http://www-proxy.us.oracle.com:80'
    $env:HTTPS_PROXY = 'http://www-proxy.us.oracle.com:80'
    
    writeMsg "Installing node modules..." "-NoNewLine"
    if( !(Test-Path -Path "$basePath\node_modules") ){
        $prc = Start-Process "npm" -ArgumentList "install", "--force" -WorkingDirectory "$basePath" -Wait -PassThru -RedirectStandardOutput "$env:WORKSPACE\node.log" -RedirectStandardError "$env:WORKSPACE\nodeErr.log"
        if($prc.ExitCode -ne 0){
            Throw "Error installing node modules"
        }
        else{
            writeMsg "DONE"
        }
    }
    else{
        writeMsg "SKIPPED"
    }
    
    ##COPY OCI .PEM FILES
    $ociPath = Join-Path $env:userprofile ".oci"
    if ( !(Test-Path -Path $ociPath) ){
        writeMsg "Creating .oci folder..." "-NoNewLine"
        New-Item -Path $env:userprofile -Name ".oci" -ItemType "directory" -Force
        writeMsg "DONE"
    }

    $childs = Get-ChildItem -Path $ociPath
    if ($childs.count -eq 0){
        $itemsPath = Join-Path $basePath "tests" "e2e" "oci_files"
        Get-ChildItem -Path $itemsPath | % { 
            $origin = Join-Path $itemsPath $_
            writeMsg "Copying $_ file to .oci folder..." "-NoNewLine"
            Copy-Item -Path $origin $ociPath
            writeMsg "DONE"
        }
    }
    
    ####DOWNLOAD EXTENSION ######
    if(!$env:EXTENSION_PUSH_ID){
        $env:EXTENSION_PUSH_ID = "latest"
    }

    $bundles = (Invoke-WebRequest -NoProxy -Uri "http://pb2.mysql.oraclecorp.com/nosso/api/v2/branches/$env:EXTENSION_BRANCH/pushes/$env:EXTENSION_PUSH_ID/").content     
    $bundles = $bundles | ConvertFrom-Json
    $extension = ($bundles.builds | Where-Object { 
        $_.product -eq "mysql-shell-ui-plugin_binary_vs-code-extension_vsix--win32-x64" 
        }).artifacts | Where-Object {
            $_.name -like "mysql-shell-for-vs-code-win32-x64"
        }

    if($extension){
        $extension | ForEach-Object { 
            $extensionItem = $_.url.replace("http://pb2.mysql.oraclecorp.com/nosso/archive/","")
            writeMsg "Downloading $extensionItem ..." "-NoNewline" 
            $dest = Join-Path $env:WORKSPACE $extensionItem
            Invoke-WebRequest -NoProxy -Uri $_.url -OutFile $dest
            writeMsg "DONE"
            }
        }
    else{
        writeMsg "Could not download the MySQL Shell for VS Code extension"
        exit 1
    }

    #SETUP ENVIRONMENT
    writeMsg "Setting up the environment..." "-NoNewLine"
    $prc = Start-Process -FilePath "npm" -ArgumentList "run", "e2e-tests-setup", "$dest" -WorkingDirectory "$basePath" -Wait -PassThru -RedirectStandardOutput "$env:WORKSPACE\env.log" -RedirectStandardError "$env:WORKSPACE\envErr.log"
    if($prc.ExitCode -ne 0){
        Throw "Error setting up the environment"
    }
    else{
        writeMsg "DONE"
    }

    #RERUN ?
    if($env:RERUN -eq $true){
        $path2json = Join-Path $basePath "mochawesome-report" "test-report.json"
        $json = Get-Content $path2json | Out-String | ConvertFrom-Json
        if ( [int]$json.PSObject.Properties.Value.failures[0] -gt 0 ) {
            writeMsg "There ARE failed tests. Preparing rerun"

            writeMsg "Found an existing test report. Renaming it..." "-NoNewLine"
            Rename-Item -Path "$basePath\mochawesome-report\test-report.json" -NewName "prev-test-report.json"
            writeMsg "DONE"

            $failedSuites = $json.results.suites.suites | Where-Object { $_.failures.Length -gt 0 } | % { $_.title }
            $failedTests = $json.results.suites.suites.tests | Where-Object { $_.fail -eq "true" } | % { $_.title }
            $content = Get-Content $testsPath
            if($failedSuites -is [array]){
                forEach($failedSuite in $failedSuites){
                    $content = $content.replace("describe(`"$failedSuite`"", "describe.only(`"$failedSuite`"") 
                    write-host "Marked test suite '$failedSuite' to be re-runned"
                }
            }
            else {
                $content = $content.replace("describe(`"$failedSuites`"", "describe.only(`"$failedSuites`"") 
                writeMsg "Marked test suite '$failedSuites' to be re-runned"
            }
            if($failedTests -is [array]){
                forEach($failedTest in $failedTests){
                    $content = $content.replace("it(`"$failedTest`"", "it.only(`"$failedTest`"")
                    writeMsg "Marked test '$failedTest' to be re-runned"
                }
            }
            else {
                $content = $content.replace("it(`"$failedTests`"", "it.only(`"$failedTests`"")
                writeMsg "Marked test '$failedTests' to be re-runned"
            }

            Set-Content -Path $testsPath -Value $content
        }
        writeMsg "There are NO failed tests"
    }
    
    #EXECUTE TESTS
    writeMsg "Executing GUI tests..." "-NoNewLine"
    Start-Process -FilePath "npm" -ArgumentList "run", "e2e-tests" -WorkingDirectory "$basePath" -Wait -RedirectStandardOutput "$env:WORKSPACE\results.log" -RedirectStandardError "$env:WORKSPACE\resultsErr.log"
    writeMsg "DONE"

    #REMOVE THE RE-RUNS and MERGE
    if($env:RERUN -eq $true){
        writeMsg "Removing re-runs on file..." "-NoNewLine"
        $content = Get-Content $testsPath
        $content = $content.replace(".only", "")
        Set-Content -Path $testsPath -Value $content
        writeMsg "DONE"

        writeMsg "Merging reports..."
        $path2prevjson = Join-Path $basePath "mochawesome-report" "prev-test-report.json"
        $path2json = Join-Path $basePath "mochawesome-report" "test-report.json"
        $prevJson = Get-Content $path2prevjson | Out-String | ConvertFrom-Json
        $curJson = Get-Content $path2json | Out-String | ConvertFrom-Json

        $prevJson.results.suites.beforeHooks = $curJson.results.suites.beforeHooks #MySQL Shell for VS Code 
        $prevJson.results.suites.afterHooks = $curJson.results.suites.afterHooks #MySQL Shell for VS Code

        $prevJson.results.suites.beforeHooks | ForEach-Object {
            $_.parentUUID = $prevJson.results.suites.uuid
        }

        $prevJson.results.suites.afterHooks | ForEach-Object {
            $_.parentUUID = $prevJson.results.suites.uuid
        }

        writeMsg "Merged beforeHooks on 'MySQL Shell for VS Code suite'"
        writeMsg "Merged afterHooks on 'MySQL Shell for VS Code suite'"
        
        $curJson.results.suites.suites | ForEach-Object {
            $suite = $_
            for($i=0; $i -le ($prevJson.results.suites.suites).Length-1; $i++){
                if ($prevJson.results.suites.suites[$i].title -eq $suite.title){
                    $prevJson.results.suites.suites[$i].beforeHooks = $suite.beforeHooks
                    $prevJson.results.suites.suites[$i].afterHooks = $suite.afterHooks

                    $prevJson.results.suites.suites[$i].beforeHooks | ForEach-Object {
                        $_.parentUUID = $prevJson.results.suites.suites[$i].uuid
                    }

                    $prevJson.results.suites.suites[$i].afterHooks | ForEach-Object {
                        $_.parentUUID = $prevJson.results.suites.suites[$i].uuid
                    }

                    writeMsg "Merged beforeHooks on '"$suite.title"' suite"
                    writeMsg "Merged afterHooks on '"$suite.title"' suite"

                    $_.tests | ForEach-Object {
                        $test = $_
                        for($j=0; $j -le ($prevJson.results.suites.suites[$i].tests).Length-1; $j++){
                            if ($prevJson.results.suites.suites[$i].tests[$j].title -eq $test.title){
                                $prevTestUUid = $prevJson.results.suites.suites[$i].tests[$j].uuid
                                $prevJson.results.suites.suites[$i].tests[$j] = $test
                                $prevJson.results.suites.suites[$i].tests[$j].parentUUID = $suite.uuid
                                if ($test.pass -eq $true){
                                    $prevFails = $prevJson.results.suites.suites[$i].failures | Where-Object { $_ -ne $prevTestUUid }
                                    $prevJson.results.suites.suites[$i].failures = $prevFails ??= @()
                                    $prevJson.results.suites.suites[$i].passes += $test.uuid
                                }
                                else{
                                    $prevJson.results.suites.suites[$i].failures = $prevJson.results.suites.suites[$i].failures -replace $prevTestUUid, $test.uuid
                                }

                                writeMsg "Merged '"$test.title"' test"
                            }
                        }
                    }
                    writeMsg "------------------------------------------------"
                }
            }
        }

        $prevJson | ConvertTo-Json -Depth 10 | Out-File "$basePath\mochawesome-report\test-report.json" -Force
        Remove-Item -Path "$basePath\mochawesome-report\prev-test-report.json" -Force

        writeMsg "DONE"
        writeMsg "Generating new report..." "-NoNewLine"
        $prc = Start-Process -FilePath "npm" -ArgumentList "run", "e2e-report" -WorkingDirectory "$basePath" -Wait -RedirectStandardOutput "$env:WORKSPACE\newReport.log" -RedirectStandardError "$env:WORKSPACE\newReportErr.log"
        if($prc.ExitCode -ne 0){
            Throw "Error generating new report"
        }
        else{
            writeMsg "DONE"
        }
    }
    
    #CHECK RESULTS
    $hasFailedTests = $null -ne (Get-Content -Path "$env:WORKSPACE\resultsErr.log" | Select-String -Pattern "(\d+) failing" | % { $_.Matches.Groups[0].Value })

    if( $hasFailedTests -and ( [int]$hasFailedTests -gt 0 ) ){
        writeMsg "There are failed tests."
        $err = 1
    }
}
catch{
    writeMsg $_
	writeMsg $_.ScriptStackTrace
	$err = 1
}
finally{
    if( $err -eq 1){
        exit 1
    }
}