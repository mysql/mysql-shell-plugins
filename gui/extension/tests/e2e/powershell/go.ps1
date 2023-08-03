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

    $env:MYSQLSH_GUI_CUSTOM_CONFIG_DIR = Join-Path $env:userprofile "mysqlsh-$env:TEST_SUITE"
    writeMsg "Using config dir: $env:MYSQLSH_GUI_CUSTOM_CONFIG_DIR"

    switch ($env:TEST_SUITE) {
        "db" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 33335
            break
        }
        "oci" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 33336
            break
        }
        "shell" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 33337
            break
        }
        "notebook" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 33338
            break
        }
        "rest" {
            $env:MYSQLSH_GUI_CUSTOM_PORT = 33339
            break
        }
        default {
            Throw "Unknown test suite: $env:TEST_SUITE"
        }
    }

    $testResources = Join-Path $env:userprofile "test-resources-$env:TEST_SUITE"
    $extPath = Join-Path $testResources "ext"
    $testFile = "./tests/e2e/output/tests/ui-$env:TEST_SUITE.js"

    writeMsg "Using test-resources: $testResources"
    writeMsg "Using extension: $extPath"
    writeMsg "Using test file: $testFile"

    ## REMOVE EXISTING EXTENSION DATABASES
    $sqlite = Join-Path $env:userprofile "mysqlsh-$env:TEST_SUITE" "plugin_data" "gui_plugin" "mysqlsh_gui_backend.sqlite3"
    if (Test-Path -Path $sqlite){
        writeMsg "Removing Plugin database for mysqlsh $env:TEST_SUITE suite..." "-NoNewLine"
        Remove-Item -Path $sqlite -Force
        writeMsg "DONE"
    }

    ## TRUNCATE MYSQLSH FILE
    $msqlsh = Join-Path $env:userprofile "mysqlsh-$env:TEST_SUITE" "mysqlsh.log"
    writeMsg "Truncating $msqlsh ..." "-NoNewLine"
    if (Test-Path -Path $msqlsh){
        Clear-Content $msqlsh
        writeMsg "DONE"
    } else {
        writeMsg "SKIPPED. Not found"
    }

    # REMOVE SHELL INSTANCE HOME
    $shellInstanceHome = Join-Path $env:userprofile "mysqlsh-$env:TEST_SUITE" "plugin_data" "gui_plugin" "shell_instance_home"
    writeMsg "Removing $shellInstanceHome ..." "-NoNewLine"
    if (Test-Path -Path $shellInstanceHome){
        Remove-Item -Path $shellInstanceHome -Force -Recurse
        writeMsg "DONE"
    } else {
        writeMsg "SKIPPED. Not found"
    }

    if ($env:TEST_SUITE -eq "rest"){
        if ($isLinux) {
            $mysqlrouterConfig = Join-Path $env:HOME ".mysqlrouter"
            $mysqlrouterConfigOld = Join-Path $env:HOME ".mysqlrouter_old"
        } else {
            $mysqlrouterConfig = Join-Path $env:APPDATA "MySQL" "mysqlrouter"
            $mysqlrouterConfigOld = Join-Path $env:APPDATA "MySQL" "mysqlrouter_old"
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

    # EXECUTE TESTS
    writeMsg "Executing GUI tests for $env:TEST_SUITE suite..."
    $prcExecTests = Start-Process -FilePath "npm" -ArgumentList "run", "e2e-tests", "--", "-s $testResources", "-e $extPath", "-f", "-o vscode_settings.json", "./output/tests/ui-$env:TEST_SUITE.js" -Wait -PassThru -RedirectStandardOutput "$workspace\resultsExt-$env:TEST_SUITE.log" -RedirectStandardError "$workspace\resultsExtErr-$env:TEST_SUITE.log"
    if ($prcExecTests.ExitCode -eq 0) {
        writeMsg "DONE for $($env:TEST_SUITE.toUpper()) suite. All tests PASSED!"
    } else {
        writeMsg "DONE for $($env:TEST_SUITE.toUpper()) suite. There are FAILED tests. Check resultsExt-$env:TEST_SUITE.log"
    }

    exit $prcExecTests.ExitCode
    
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
