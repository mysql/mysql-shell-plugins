<#
 * Copyright (c) 2023, Oracle and/or its affiliates.
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
$env:WORKSPACE = Resolve-Path(Join-Path $basePath ".." ".." ".." "..")

if (!$env:TEST_SUITE){
    Throw "Please define the TEST_SUITE (db, notebook, oci, shell, rest)"
}

$env:MYSQLSH_GUI_CUSTOM_CONFIG_DIR = Join-Path $home "mysqlsh-$env:TEST_SUITE"

# REMOVE EXISTING EXTENSION DATABASES
$sqlite = Join-Path $home "mysqlsh-$env:TEST_SUITE" "plugin_data" "gui_plugin" "mysqlsh_gui_backend.sqlite3"
if (Test-Path -Path $sqlite){
    write-host "Removing Plugin database for mysqlsh $env:TEST_SUITE suite..." "-NoNewLine"
    Remove-Item -Path $sqlite -Force
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
    $mysqlrouterConfig = Join-Path $home ".mysqlrouter"
    $mysqlrouterConfigOld = Join-Path $home ".mysqlrouter_old"
    if (Test-Path -Path $mysqlrouterConfig) {
        write-host "Removing router config folder..."
        Remove-Item -Path $mysqlrouterConfig -Force -Recurse
        write-host "DONE"
    }
    if (Test-Path -Path $mysqlrouterConfigOld) {
        write-host "Removing router old config folder..."
        Remove-Item -Path $mysqlrouterConfigOld -Force -Recurse
        write-host "DONE"
    }
}

# EXECUTE TESTS
npm run e2e-tests -- -s "test-resources" -e "test-resources/ext" -f -o "vscode_settings.json" "./output/tests/ui-$env:TEST_SUITE.js"