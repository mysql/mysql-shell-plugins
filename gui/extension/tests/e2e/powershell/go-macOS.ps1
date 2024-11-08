<#
 * Copyright (c) 2023, 2024 Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
#>

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$basePath = Join-Path $PSScriptRoot ".."
Set-Location $basePath
$basePath = Get-Location
$env:WORKSPACE = Resolve-Path(Join-Path $basePath ".." ".." ".." "..")

if (!$env:TEST_SUITE){
    Throw "Please define the TEST_SUITE (db, notebook, oci, shell, rest, open-editors)"
}
if (!$env:TEST_RESOURCES_PATH){
    Throw "Please define 'TEST_RESOURCES_PATH' env variable (location to store vscode and chromedriver)"
}

$env:MYSQLSH_GUI_CUSTOM_CONFIG_DIR = Join-Path $env:TEST_RESOURCES_PATH "mysqlsh-$env:TEST_SUITE"

## REMOVE EXISTING EXTENSION DATABASES
$guiPluginFolder = Join-Path $home "mysqlsh-$env:TEST_SUITE" "plugin_data" "gui_plugin"
$files = Get-ChildItem -Path $guiPluginFolder -Filter "*mysqlsh_gui*"
foreach ($file in $files) {
    write-host "Removing file $file" -NoNewLine
    Remove-Item $file -Force
    write-host "DONE"
}

# TRUNCATE MYSQLSH FILE
$msqlsh = Join-Path $home ".mysqlsh-gui" "mysqlsh.log"
write-host "Truncating $msqlsh ..." "-NoNewLine"
if (Test-Path -Path $msqlsh){
    Clear-Content $msqlsh
    write-host "DONE"
} else {
    write-host "SKIPPED. Not found"
}

# REMOVE ROUTER LEFTOVERS
if ($env:TEST_SUITE -eq "rest"){
    $mysqlrouterConfig = Join-Path $env:TEST_RESOURCES_PATH "mysqlsh-$env:TEST_SUITE" "plugin_data" "mrs_plugin" "router_configs"
    if (Test-Path -Path $mysqlrouterConfig) {
        write-host "Removing router config folder..."
        Remove-Item -Path $mysqlrouterConfig -Force -Recurse
        write-host "DONE"
    }
}

# REMOVE SHELL INSTANCE HOME
$shellInstanceHome = Join-Path $env:TEST_RESOURCES_PATH "mysqlsh-$env:TEST_SUITE" "plugin_data" "gui_plugin" "shell_instance_home"
write-host "Removing $shellInstanceHome ..." -NoNewLine
if (Test-Path -Path $shellInstanceHome){
    Remove-Item -Path $shellInstanceHome -Force -Recurse
    write-host "DONE"
} else {
    write-host "SKIPPED. Not found"
}

# DEFINE OCI ENV VARS
if (!$env:MYSQLSH_OCI_CONFIG_FILE) {
    Throw "Please set the MYSQLSH_OCI_CONFIG_FILE environment variable"
}
if (!$env:OCI_OBJECTS_PATH) {
    Throw "Please set the OCI_OBJECTS_PATH environment variable. Ex QA/MySQLShellTesting"
}
$env:MYSQLSH_OCI_RC_FILE = Join-Path $env:WORKSPACE "oci" "e2e_cli_rc"

New-Item -Path $env:MYSQLSH_OCI_RC_FILE -Force -ItemType "file"

$testResources = Join-Path $env:TEST_RESOURCES_PATH "test-resources"

# RUN SQL CONFIGURATIONS FOR TESTS
$refExt = Join-Path $testResources "ext"
$extFolder = Get-ChildItem -Path $refExt -Filter "*oracle*"
$shell = Join-Path $extFolder "shell" "bin" "mysqlsh"
write-host "Running SQL configurations for tests..." "-NoNewLine"
$runConfig = "$shell -u $env:DBUSERNAME -p$env:DBPASSWORD -h localhost --file sql/setup.sql"
Invoke-Expression $runConfig
write-host "DONE"

# EXECUTE TESTS
$env:NODE_ENV = "test"

npm run e2e-tests -- -s $testResources -e "$testResources/ext" -f -o "settings.json" "./output/tests/ui-$env:TEST_SUITE.js"

# RUN TEARDOWN SQL FOR TESTS
$runConfig = "$shell -u $env:DBUSERNAME -p$env:DBPASSWORD -h localhost --file sql/teardown.sql"
Invoke-Expression $runConfig
write-host "[OK] Teardown SQL scripts were executed successfully"
