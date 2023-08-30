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
$vsCodeVersion = "1.78.2"
$testSuites = @("db", "notebook", "oci", "shell", "rest")

if (!$env:VSIX_PATH){
    Throw "Please define the VSIX_PATH"
}

$targetWebCerts = Join-Path $home ".mysqlsh-gui" "plugin_data" "gui_plugin" "web_certs"
write-host "Creating config dirs..."
ForEach ($testSuite in $testSuites) {
    $config = Join-Path $home "mysqlsh-$testSuite"
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
npm run e2e-tests-get-vscode -- -s "test-resources" -c $vscodeVersion
npm run e2e-tests-get-chromedriver -- -s "test-resources" -c $vscodeVersion

# CREATE OCI Directory
$ociPath = Join-Path $env:WORKSPACE "oci"
if (!(Test-Path -Path $ociPath)){
    write-host "Creating $ociPath folder..." "-NoNewLine"
    New-Item -Path $env:WORKSPACE -Name "oci" -ItemType "directory" -Force
    write-host "DONE"
}

# COPY OCI FILES   
$itemsPath = Join-Path $basePath "oci_files"
Get-ChildItem -Path $itemsPath | % {
    write-host "Copying $_ file to $ociPath folder..." "-NoNewLine"
    Copy-Item -Path $_ $ociPath -Force
    write-host "DONE"
}

# TSC
npm run e2e-tests-tsc

# INSTALL VSIX
npm run e2e-tests-install-vsix -- -s "test-resources" -e "test-resources/ext" -f $env:VSIX_PATH