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

$shellPluginsFolder = Resolve-Path(Join-Path $PSScriptRoot ".." ".." ".." ".." "..")
$shellPluginsGuiFolder = Join-Path $shellPluginsFolder "gui"
$frontEndFolder = Join-Path $shellPluginsGuiFolder "frontend"
$extensionFolder = Join-Path $shellPluginsGuiFolder "extension"

# IF THE ENV VARIABLES ARE NOT SET, IT TRIES TO FIND THE SHELL/ROUTER DIRS UNDER THE DOWNLOADS FOLDER
if (!$env:SHELL_PLUGINS_DEPS) {
    $pluginsDeps = $env:HOME -ne $null ? $(Join-Path $env:HOME "Downloads") : $(Join-Path $env:userprofile "Downloads")
} else {
    $pluginsDeps = $env:SHELL_PLUGINS_DEPS
}

$shellLocation = $((Get-ChildItem -Path $pluginsDeps -Directory -Filter "*mysql-shell-*").toString())
$routerLocation = $((Get-ChildItem -Path $pluginsDeps -Directory -Filter "*mysql-router-*").toString())

# NPM INSTALL
Set-Location $frontEndFolder
npm install

# NPM BUILD
$guiPluginBuild = Join-Path $frontEndFolder "build"
if (Test-Path $guiPluginBuild) {
    Remove-Item $guiPluginBuild -Force -Recurse
}
if ($isWindows) {
    npm run build-win
} else {
    npm run build
}

$guiPluginBackend = Join-Path $shellPluginsGuiFolder "backend" "gui_plugin"

# SET PLUGINS, SHELL AND ROUTER ON EXTENSION FOLDER
if (!(Test-Path $(Join-Path $extensionFolder "shell"))) {
    Write-host "Copying shell..." -NoNewLine
    Copy-Item -Path $shellLocation -Destination $(Join-Path $extensionFolder "shell") -Recurse
    Write-host "DONE"
}
if (!(Test-Path $(Join-Path $extensionFolder "router"))) {
    Write-host "Copying router..." -NoNewLine
    Copy-Item -Path $routerLocation -Destination $(Join-Path $extensionFolder "router") -Recurse
    Write-host "DONE"
}
$pluginsDir = Join-Path $extensionFolder "shell" "lib" "mysqlsh" "plugins"
if (Test-Path $pluginsDir) {
    Remove-Item -Path $pluginsDir -Force -Recurse
}
Write-host "Creating plugins folder..." -NoNewLine
New-Item -ItemType Directory -Path $(Join-Path $extensionFolder "shell" "lib" "mysqlsh" "plugins")
Write-host "DONE"

Write-host "Creating MRS plugin..." -NoNewLine
Copy-Item -Path $(Join-Path $shellPluginsFolder "mrs_plugin") -Destination $(Join-Path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "mrs_plugin") -Recurse
Write-host "DONE"

Write-host "Creating MDS plugin..." -NoNewLine
Copy-Item -Path $(Join-Path $shellPluginsFolder "mds_plugin") -Destination $(Join-Path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "mds_plugin") -Recurse
Write-host "DONE"

Write-host "Creating GUI plugin..." 
Copy-Item -Path $guiPluginBackend -Destination $(Join-Path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "gui_plugin") -Recurse
Write-host "GUI_PLUGIN created..."
Copy-Item -Path $guiPluginBuild -Destination $(Join-path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "gui_plugin" "core") -Recurse
Write-host "CORE created..."
Write-host "Checking WEBROOT ..." -NoNewLine
if (Test-Path -Path $(Join-path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "gui_plugin" "core" "webroot")){
    Write-host "Creating webroot ..." -NoNewLine
    Remove-Item -Path $(Join-path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "gui_plugin" "core" "webroot") -Recurse
    Write-host "DONE"
} else {
    Write-host "skipping ..."
}
Write-host "Renaming core to webroot ..." -NoNewLine
Rename-Item -Path $(Join-path $extensionFolder "shell" "lib" "mysqlsh" "plugins" "gui_plugin" "core" "build") -NewName "webroot"
Write-host "DONE"

# BUILD EXTENSION
Set-Location $extensionFolder
npm install
npm run build-dev-package