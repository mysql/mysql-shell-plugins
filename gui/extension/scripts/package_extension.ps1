<#
 * Copyright (c) 2022, 2025 Oracle and/or its affiliates.
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
$shellPluginsFolder = Resolve-Path(Join-Path $PSScriptRoot ".." ".." "..")
$shellPluginsGuiFolder = Join-Path $shellPluginsFolder "gui"
$frontEndFolder = Join-Path $shellPluginsGuiFolder "frontend"
$extensionFolder = Join-Path $shellPluginsGuiFolder "extension"

# LOCATION FOLDER OF SHELL AND ROUTER
if (!$env:SHELL_PLUGINS_DEPS) {
    Throw "Please define the env var SHELL_PLUGINS_DEPS (Location folder of shell and router)"
}

try {
    $shellLocation = $((Get-ChildItem -Path $env:SHELL_PLUGINS_DEPS -Directory -Filter "*mysql-shell-*").toString())
    Write-Host "Found Shell: $shellLocation"
} catch {
    Throw "Could not find Shell at $env:SHELL_PLUGINS_DEPS"
}

try {
    $routerLocation = $((Get-ChildItem -Path $env:SHELL_PLUGINS_DEPS -Directory -Filter "*mysql-router-*").toString())
    Write-Host "Found Router: $routerLocation"
} catch {
    Throw "Could not find Router at $env:SHELL_PLUGINS_DEPS"
}

# NPM INSTALL
Set-Location $frontEndFolder

if (Test-Path "build") {
    Remove-Item "build" -Force -Recurse
}

if (Test-Path "node_modules") {
    Remove-Item "node_modules" -Force -Recurse
}

if (Test-Path "package-lock.json") {
    Remove-Item "package-lock.json" -Force -Recurse
}

npm install

# NPM BUILD
$guiPluginBuild = Join-Path $frontEndFolder "build"
if ($isWindows) {
    npm run build-win
} else {
    npm run build
}

$guiPluginBackend = Join-Path $shellPluginsGuiFolder "backend" "gui_plugin"

# SET PLUGINS, SHELL AND ROUTER ON EXTENSION FOLDER
if (Test-Path $(Join-Path $extensionFolder "shell")) {
    Write-Host "Removing Shell ..." -NoNewLine
    Remove-item $(Join-Path $extensionFolder "shell") -Force -Recurse
    Write-Host "DONE"
} 

Write-host "Copying shell..." -NoNewLine

if ($isWindows) {
    Copy-Item -Path $shellLocation -Destination $(Join-Path $extensionFolder "shell") -Recurse
} else {
    cp -r $shellLocation $(Join-Path $extensionFolder "shell")
}

Write-host "DONE"

if (Test-Path $(Join-Path $extensionFolder "router")) {
    Write-host "Removing router..." -NoNewLine
    Remove-Item -Path $(Join-Path $extensionFolder "router") -Force -Recurse
    Write-host "DONE"
}

Write-host "Copying router..." -NoNewLine
Copy-Item -Path $(Join-Path $routerLocation "bin") -Destination $(Join-Path $extensionFolder "router" "bin") -Recurse
Copy-Item -Path $(Join-Path $routerLocation "lib") -Destination $(Join-Path $extensionFolder "router" "lib") -Recurse
Write-host "DONE"

Write-host "Adding MRS plugin..." -NoNewLine
Copy-Item -Path $(Join-Path $shellPluginsFolder "mrs_plugin") -Destination $(Join-Path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "mrs_plugin") -Recurse
Write-host "DONE"

Write-host "Adding MDS plugin..." -NoNewLine
Copy-Item -Path $(Join-Path $shellPluginsFolder "mds_plugin") -Destination $(Join-Path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "mds_plugin") -Recurse
Write-host "DONE"

Write-host "Adding MSM plugin..." -NoNewLine
Copy-Item -Path $(Join-Path $shellPluginsFolder "msm_plugin") -Destination $(Join-Path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "msm_plugin") -Recurse
Write-host "DONE"

Write-host "Adding GUI plugin backend ..." -NoNewLine 
Copy-Item -Path $guiPluginBackend -Destination $(Join-Path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "gui_plugin") -Recurse
Write-host "DONE"

Write-host "Adding GUI plugin frontend ..." -NoNewLine 
New-Item -Path $(Join-path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "gui_plugin" "core" "webroot") -ItemType "directory" -Force
Copy-Item -Path "$guiPluginBuild/*" -Destination $(Join-path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "gui_plugin" "core" "webroot") -Recurse -Force
Write-host "DONE"

# BUILD EXTENSION
Set-Location $extensionFolder
if (Test-Path "node_modules") {
    Remove-Item "node_modules" -Force -Recurse
}

if (Test-Path "package-lock.json") {
    Remove-Item "package-lock.json" -Force -Recurse
}

npm install

npm run build-dev-package
