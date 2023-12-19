<#
 * Copyright (c) 2022, 2023 Oracle and/or its affiliates.
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

Set-Location $PSScriptRoot
$basePath = Join-Path $PSScriptRoot ".."
Set-Location $basePath
$basePath = Get-Location
$workspace = Resolve-Path(Join-Path $basePath ".." ".." ".." "..")

try {
    $err = 0

    $log = Join-Path $workspace "psExt_$env:TEST_SUITE.log"

    function writeMsg($msg, $option){
        $msg | Out-File $log -Append
        Invoke-Expression "write-host `"$msg`" $option"
    }

    function extensionWasNotLoaded(){
        $path = Join-Path $workspace "resultsExt-$env:TEST_SUITE.log"
        if (Test-Path $path) {
            return $null -ne (Get-Content -Path $path | Select-String -Pattern "Extension was not loaded successfully" | % { $_.Matches.Groups[0].Value })
        } else {
            return $false
        }
    }

    function runTests($testResources){
        writeMsg "Executing GUI tests for $env:TEST_SUITE suite..."
        $env:NODE_ENV = "test"
        $prc = Start-Process -FilePath "npm" -ArgumentList "run", "e2e-tests", "--", "-s $testResources", "-e $extPath", "-f", "-o settings.json", "./output/tests/ui-$env:TEST_SUITE.js" -Wait -PassThru -RedirectStandardOutput "$workspace\resultsExt-$env:TEST_SUITE.log" -RedirectStandardError "$workspace\resultsExtErr-$env:TEST_SUITE.log"
        if (!(Test-Path -Path "$workspace\resultsExt-$env:TEST_SUITE.log")){
            writeMsg "$workspace\resultsExt-$env:TEST_SUITE.log was not found."
            return 1
        } else {
            $hasFailedTests = $null -ne (Get-Content -Path "$workspace\resultsExt-$env:TEST_SUITE.log" | Select-String -Pattern "(\d+) failing" | % { $_.Matches.Groups[0].Value })
            if($hasFailedTests -and ([int]$hasFailedTests -gt 0)){
                writeMsg "RESULT for $($env:TEST_SUITE.toUpper()) suite: FAILED"
                return 1
            } else {
                writeMsg "RESULT for $($env:TEST_SUITE.toUpper()) suite: PASSED"
                return 0
            }
        }
    }

    if (Test-Path -Path $log){
        Remove-Item -Path $log -Recurse -Force	
    }

    New-Item -ItemType "file" -Path $log

    if (!$env:TEST_SUITE){
        Throw "Please define the TEST_SUITE to run"
    }

    if ($isLinux) {
        $env:userprofile = $env:HOME
    }

    writeMsg "TEST_SUITE: $env:TEST_SUITE"
    $env:MOCHAWESOME_REPORTDIR = $workspace
    writeMsg "REPORT DIR: $env:MOCHAWESOME_REPORTDIR"
    $env:MOCHAWESOME_REPORTFILENAME = "test-report-$env:TEST_SUITE.json"
    writeMsg "REPORT FILENAME: $env:MOCHAWESOME_REPORTFILENAME"

    $resourcesDir = Join-Path $env:userprofile "clientqa"

    $env:MYSQLSH_GUI_CUSTOM_CONFIG_DIR = Join-Path $resourcesDir "mysqlsh-$env:TEST_SUITE"
    writeMsg "Using config dir: $env:MYSQLSH_GUI_CUSTOM_CONFIG_DIR"

    switch ($env:TEST_SUITE) {
        "db" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 3335
            break
        }
        "oci" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 3336
            break
        }
        "shell" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 3337
            break
        }
        "notebook" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 3338
            break
        }
        "rest" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 3339
            break
        }
        "open-editors" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 3340
            break
        }
        default {
            Throw "Unknown test suite: $env:TEST_SUITE"
        }
    }

    $testResources = Join-Path $resourcesDir "test-resources-$env:TEST_SUITE"
    $extPath = Join-Path $workspace "ext-$env:TEST_SUITE"
    $testFile = "./tests/e2e/output/tests/ui-$env:TEST_SUITE.js"

    writeMsg "Using test-resources: $testResources"
    writeMsg "Using extension: $extPath"
    writeMsg "Using test file: $testFile"

    ## TRUNCATE MYSQLSH FILE
    $msqlsh = Join-Path $resourcesDir "mysqlsh-$env:TEST_SUITE" "mysqlsh.log"
    writeMsg "Truncating $msqlsh ..." "-NoNewLine"
    if (Test-Path -Path $msqlsh){
        Clear-Content $msqlsh
        writeMsg "DONE"
    } else {
        writeMsg "SKIPPED. Not found"
    }

    # REMOVE SHELL INSTANCE HOME
    $shellInstanceHome = Join-Path $resourcesDir "mysqlsh-$env:TEST_SUITE" "plugin_data" "gui_plugin" "shell_instance_home"
    writeMsg "Removing $shellInstanceHome ..." "-NoNewLine"
    if (Test-Path -Path $shellInstanceHome){
        Remove-Item -Path $shellInstanceHome -Force -Recurse
        writeMsg "DONE"
    } else {
        writeMsg "SKIPPED. Not found"
    }

    if ($env:TEST_SUITE -eq "rest"){
        if ($isLinux) {
            $mysqlrouterConfig = Join-Path $resourcesDir "mysqlsh-$env:TEST_SUITE" "plugin_data" "mrs_plugin" "router_configs"
        } else {
            $mysqlrouterConfig = Join-Path $resourcesDir "mysqlsh-$env:TEST_SUITE" "plugin_data" "mrs_plugin" "router_configs"
        }

        if (Test-Path -Path $mysqlrouterConfig) {
            writeMsg "Removing router config folder..."
            Remove-Item -Path $mysqlrouterConfig -Force -Recurse
            writeMsg "DONE"
        }
        if (Test-Path -Path $mysqlrouterConfig) {
            writeMsg "Removing router old config folder..."
            Remove-Item -Path $mysqlrouterConfigOld -Force -Recurse
            writeMsg "DONE"
        }
    }

    # DEFINE OCI ENV VARS
    if ($env:TEST_SUITE -eq "oci"){
        if (!$env:MYSQLSH_OCI_CONFIG_FILE) {
            Throw "Please set the MYSQLSH_OCI_CONFIG_FILE environment variable"
        }
        if (!$env:OCI_OBJECTS_PATH) {
            Throw "Please set the OCI_OBJECTS_PATH environment variable. Ex QA/MySQLShellTesting"
        }
        $env:MYSQLSH_OCI_RC_FILE = Join-Path $workspace "oci" "e2e_cli_rc"
    } 
    else {
        $env:MYSQLSH_OCI_CONFIG_FILE = Join-Path $workspace "oci_dummy" "config"
        $env:MYSQLSH_OCI_RC_FILE = Join-Path $workspace "oci_dummy" "e2e_cli_rc"
    }

    New-Item -Path $env:MYSQLSH_OCI_RC_FILE -Force -ItemType "file"

    # DEFINE THE RESOURCES DIRECTORY
    $env:RESOURCES_DIR = $resourcesDir

    # EXECUTE TESTS
    $result = runTests $testResources
    if ($result -ne 0) {
        if (extensionWasNotLoaded) {
            writeMsg "Extension was not loaded. Trying again..."
            $result = runTests $testResources
        }
    } 
    exit $result   
}
catch {
    writeMsg $_
    writeMsg $_.ScriptStackTrace
    $err = 1
}
finally {
    if ($err -eq 1){
        exit 1
    }
}
