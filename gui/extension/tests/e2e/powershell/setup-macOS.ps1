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
$vsCodeVersion = "1.83.1"
$testSuites = @("db", "notebook", "oci", "shell", "rest", "open-editors", "result-grids")

if (!$env:VSIX_PATH){
    Throw "Please define the VSIX_PATH"
}
if (!$env:TEST_RESOURCES_PATH){
    Throw "Please define 'TEST_RESOURCES_PATH' env variable (location to store vscode and chromedriver)"
}

$targetWebCerts = Join-Path $home ".mysqlsh-gui" "plugin_data" "gui_plugin" "web_certs"
write-host "Creating config dirs..."
ForEach ($testSuite in $testSuites) {
    $config = Join-Path $env:TEST_RESOURCES_PATH "mysqlsh-$testSuite"
    if (!(Test-Path $config)) {
        New-Item -ItemType "directory" -Path $config
        write-host "Created $config"
        $mysqlsh = Join-Path $config "mysqlsh.log"
        New-Item -ItemType "file" -Path $mysqlsh
        write-host "Created $mysqlsh"
        $guiPlugin = Join-Path $config "plugin_data" "gui_plugin"
        New-Item -ItemType "directory" -Path $guiPlugin
        write-host "Created $guiPlugin"
        write-host "Creating symlink for web certificates for $config ..." "-NoNewLine"
        $link = Join-Path $config "plugin_data" "gui_plugin" "web_certs"
        New-Item -ItemType SymbolicLink -Path $link -Target $targetWebCerts
        write-host "DONE"
    }
}
write-host "DONE"
$testResources = Join-Path $env:TEST_RESOURCES_PATH "test-resources"
New-Item -Path $testResources -ItemType "directory" -Force

## CHECK CPU ARCH. VSCODE EXTENSION TESTER HAS A BUG. IT ONLY DOWNLOADS VSCODE FOR NON-ARM CPU ARCHS s
$arch = uname -p
if ($arch -eq "arm") {
    $destVscode = Join-Path $testResources "stable_$vsCodeVersion.zip"
    if (!(Test-Path $destVscode)) {
        Invoke-WebRequest "https://update.code.visualstudio.com/$vsCodeVersion/darwin-arm64/stable" -OutFile $destVscode
        unzip $destVscode -d $testResources 
    }
} else {
    npm run e2e-tests-get-vscode -- -s $testResources -c $vsCodeVersion
}

npm run e2e-tests-get-chromedriver -- -s $testResources -c $vsCodeVersion

# TSC
npm run e2e-tests-tsc

# RUN SQL CONFIGURATIONS FOR TESTS
$refExt = Join-Path $testResources "ext"
$extFolder = Get-ChildItem -Path $refExt -Filter "*oracle*"
$shell = Join-Path $extFolder "shell" "bin" "mysqlsh"
write-host "Running SQL configurations for tests..." "-NoNewLine"
$runConfig = "$shell -u $env:DBUSERNAME -p$env:DBPASSWORD -h localhost --file sql/setup.sql"
Invoke-Expression $runConfig
write-host "DONE"

# INSTALL VSIX
npm run e2e-tests-install-vsix -- -s $testResources -e "$testResources/ext" -f $env:VSIX_PATH
