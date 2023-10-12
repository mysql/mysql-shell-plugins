<#
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
$testSuites = @("db", "notebook", "oci", "shell", "rest")

try {
    $err = 0
    $log = Join-Path $env:WORKSPACE "psSetupExt.log"

    function writeMsg($msg, $option){
        $msg | Out-File $log -Append
        Invoke-Expression "write-host `"$msg`" $option"
    }

    if (!$env:VSIX_PATH) {
        if (!$env:PB2_LINK){
            Throw "Please define 'PB2_LINK' env variable"
        }
    }

    if (!$env:VSCODE_VERSION){
        Throw "Please define 'VSCODE_VERSION' env variable"
    }

    $aux_proxy = $env:HTTP_PROXY
    $aux_http_proxy = $env:HTTPS_PROXY
    $env:HTTP_PROXY = ""
    $env:HTTPS_PROXY = ""

    function installChromedriver($location, $vscodeVersion) {
        Start-Job -Name "get-chromedriver-$testSuite" -ScriptBlock { 
            npm run e2e-tests-get-chromedriver -- -s $using:location -c $using:vscodeVersion
        }
    }

    function installVsCode($location, $vscodeVersion){
        Start-Job -Name "get-vscode-$testSuite" -ScriptBlock { 
            npm run e2e-tests-get-vscode -- -s $using:location -c $using:vscodeVersion
        }
    }

    function getVSCodeVersion ($path) {
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $target = (Get-ChildItem -Path $path -Filter "*VSCode*").toString()
        if($isWindows) {
            $pinfo.FileName = "$target\bin\code.cmd"
        } else {
            $pinfo.FileName = "$target/bin/code"
        }
        
        $pinfo.RedirectStandardError = $true
        $pinfo.RedirectStandardOutput = $true
        $pinfo.UseShellExecute = $false
        $pinfo.Arguments = "--version"
        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $pinfo
        $p.Start() | Out-Null
        $p.WaitForExit()
        $stdout = $p.StandardOutput.ReadToEnd()
        $stderr = $p.StandardError.ReadToEnd()
        $info = $stdout -split "\n"
        return $info[0]
    }

    if ($isLinux) {
        $env:userprofile = $env:HOME
        $webCerts = Join-Path $env:userprofile ".mysqlsh-gui" "plugin_data" "gui_plugin" "web_certs"
        if (!(Test-Path -Path $webCerts)) {
            Throw "web_certs were not found. Please install VSCode and generate the web certificates manually"
        }
    } elseif($isWindows) {
        $webCerts = Join-Path $env:APPDATA "MySQL" "mysqlsh-gui" "plugin_data" "gui_plugin" "web_certs"
        if (!(Test-Path -Path $webCerts)) {
            Throw "web_certs were not found. Please install VSCode and generate the web certificates manually"
        }
    } else {
        Throw "MacOS is not supported"
    }

    if (Test-Path -Path $log){
        Remove-Item -Path $log -Recurse -Force	
    }

    New-Item -ItemType "file" -Path $log

    writeMsg "BRANCH: $env:EXTENSION_BRANCH"
    writeMsg "PUSH_ID: $env:EXTENSION_PUSH_ID"
    writeMsg "REVISION: $env:TARGET_REVID"
    writeMsg "WORKSPACE: $env:WORKSPACE"
    writeMsg "VSCODE_VERSION: $env:VSCODE_VERSION"
    writeMsg "VSIX_PATH: $env:VSIX_PATH"
    writeMsg "USER PROFILE: $env:USERPROFILE"
    writeMsg "BASE PATH: $basePath"

    # REMOVE INSTALLED EXTENSION
    ForEach ($testSuite in $testSuites) {
        $testResources = Join-Path $env:userprofile "test-resources-$($testSuite)"
        $extPath = Join-Path $env:WORKSPACE "ext-$($testSuite)"
        if(Test-Path -Path $extPath) {
            writeMsg "Removing VSCode extension from $testSuite ..." "-NoNewLine"
            if ($isLinux) {
                mkdir $testResources/empty_dir && rsync -a --delete $testResources/empty_dir $testResources/ext && rm -rf $testResources/empty_dir && rm -rf $testResources/ext
            } else {
                Remove-Item -Path $extPath -Force -Recurse
            }
            writeMsg "DONE"
        }
    }

    if ($env:USE_PROXY) {
        writeMsg "Using PROXY $env:USE_PROXY"
        $env:HTTP_PROXY=$env:USE_PROXY
        $env:HTTPS_PROXY=$env:USE_PROXY
    }

    # CHECK IF VSCODE EXISTS
    ForEach ($testSuite in $testSuites) {
        $path = Join-Path $env:userprofile "test-resources-$($testSuite)"
        if (!(Test-Path -Path $path)) {
            writeMsg "Creating folder $path ..." "-NoNewLine"
            New-Item -ItemType "directory" -Path $path
            writeMsg "DONE"
        }

        writeMsg "Checking if VSCode exists at $path ..." "-NoNewLine"
        $item = Get-ChildItem -Path $path -Filter "*VSCode*"
        if ($item.length -gt 0) {
            writeMsg "it does."
        } else {
            writeMsg "not found. Installing it on version $env:VSCODE_VERSION..." "-NoNewLine"
            installVsCode $path $env:VSCODE_VERSION
        }
    }
    # Wait for it all to complete
    Get-Job | Wait-Job
    writeMsg "DONE"

    # CHECK VSCODE VERSION
    writeMsg "Checking VSCode version..." "-NoNewLine"
    ForEach ($testSuite in $testSuites) {
        $path = Join-Path $env:userprofile "test-resources-$($testSuite)"
        $version = getVSCodeVersion $path
        if ($version -ne $env:VSCODE_VERSION) {
            writeMsg "'$version', requested version is '$env:VSCODE_VERSION'. Updating on $path" "-NoNewLine"
            installVsCode $path $env:VSCODE_VERSION
        } else {
            writeMsg "$version. OK"
        } 
    }
    # Wait for it all to complete
    Get-Job | Wait-Job
    writeMsg "DONE"

    # CHECK CHROMEDRIVER
    ForEach ($testSuite in $testSuites) {
        $path = Join-Path $env:userprofile "test-resources-$($testSuite)"
        $chromedriver = Join-Path $path "chromedriver*"
        writeMsg "Checking if Chromedriver exists at $path ..." "-NoNewLine"
        if (!(Test-Path -Path $chromedriver)) {
            writeMsg "Not found. Start installing Chromedriver at $path..." "-NoNewLine"
            installChromedriver $path $env:VSCODE_VERSION
        } else {
            writeMsg "It does! Skipping installation."
        }
    }
    # Wait for it all to complete
    Get-Job | Wait-Job
    writeMsg "DONE"

    # DOWNLOAD EXTENSION 
    if (!$env:VSIX_PATH) {
        writeMsg "Trying to download from PB2..."
        $bundles = (Invoke-WebRequest -NoProxy -Uri $env:PB2_LINK).content
        $bundles = $bundles | ConvertFrom-Json

        if ($isWindows) {
            $product = "mysql-shell-ui-plugin_binary_vs-code-extension_vsix--win32-x64"
            $artifact = "mysql-shell-for-vs-code-win32-x64"
        } elseif ($isLinux) {
            uname -m | Tee-Object -Variable cpuArch
            if ($cpuArch -eq "x86_64") {
                $product = "mysql-shell-ui-plugin_binary_vs-code-extension_vsix--linux-x64"
                $artifact = "mysql-shell-for-vs-code-linux-x64"
            } else {
                $product = "mysql-shell-ui-plugin_binary_vs-code-extension_vsix--linux-arm64"
                $artifact = "mysql-shell-for-vs-code-linux-arm64"
            }
        } else {
            Throw "Not supported platform"
        }
        
        $extension = ($bundles.builds | Where-Object {
            $_.product -eq $product
            }).artifacts | Where-Object {
                $_.name -like $artifact
            }

        if ($extension){
            $extension | ForEach-Object { 
                writeMsg "Downloading the extension ..." "-NoNewline" 
                $dest = Join-Path $env:WORKSPACE "$env:EXTENSION_BRANCH-$env:EXTENSION_PUSH_ID.vsix"
                Invoke-WebRequest -NoProxy -Uri $_.url -OutFile $dest
                writeMsg "DONE"
                }
            }
        else{
            writeMsg "Could not download the MySQL Shell for VS Code extension. You can download it manually and then set the VSIX_PATH env variable"
            exit 1
        }
    } else {
        $dest = $env:VSIX_PATH
    }

    # CREATE .OCI Directory
    $ociPath = Join-Path $env:WORKSPACE "oci"
    if (!(Test-Path -Path $ociPath)){
        writeMsg "Creating $ociPath folder..." "-NoNewLine"
        New-Item -Path $env:WORKSPACE -Name "oci" -ItemType "directory" -Force
        writeMsg "DONE"
    }

    # COPY OCI FILES   
    $itemsPath = Join-Path $basePath "oci_files"
    Get-ChildItem -Path $itemsPath | % {
        writeMsg "Copying $_ file to $ociPath folder..." "-NoNewLine"
        Copy-Item -Path $_ $ociPath -Force
        writeMsg "DONE"
    }

    # INSTALL VSIX
    writeMsg "Start installing the extension into vscode instances..." "-NoNewLine"
    ForEach ($testSuite in $testSuites) {
        $testResources = Join-Path $env:userprofile "test-resources-$($testSuite)"
        $extLocation = Join-Path $env:WORKSPACE "ext-$testSuite"
        Start-Job -Name "install-vsix" -ScriptBlock { 
            npm run e2e-tests-install-vsix -- -s $using:testResources -e $using:extLocation -f $using:dest
        }
    }

    Get-Job | Wait-Job
    writeMsg "DONE installing the extension!"


    # CHECK WEB CERTIFICATES
    if ($isLinux) {
        $refExt = Join-Path $env:WORKSPACE "ext-$($testSuites[0])"
        $extFolder = Get-ChildItem -Path $refExt -Filter "*oracle*"
        $shell = Join-Path $extFolder "shell" "bin" "mysqlsh"

        # RE INSTALL WEB CERTIFICATES
        writeMsg "Re-installing web certificates..." "-NoNewLine"
        $removeWebCerts = "$shell --js -e `"gui.core.removeShellWebCertificate()`""
        Invoke-Expression $removeWebCerts
        $installWebCerts = "$shell --js -e `"gui.core.installShellWebCertificate()`""
        Invoke-Expression $installWebCerts
        writeMsg "DONE"
    }

    # CHECK CONFIG FOLDERS AND WEB CERTIFICATES 
    writeMsg "Checking config folders..." "-NoNewLine"
    if($isWindows){
        $targetWebCerts = Join-Path $env:APPDATA "MySQL" "mysqlsh-gui" "plugin_data" "gui_plugin" "web_certs"
    } elseif($isLinux){
        $targetWebCerts = Join-Path $env:userprofile ".mysqlsh" "plugin_data" "gui_plugin" "web_certs"
    }

    ForEach ($testSuite in $testSuites) {
        $config = Join-Path $env:userprofile "mysqlsh-$testSuite"
        if (!(Test-Path $config)) {
            New-Item -ItemType "directory" -Path $config
            writeMsg "Created $config"
            $mysqlsh = Join-Path $config "mysqlsh.log"  
            New-Item -ItemType "file" -Path $mysqlsh
            writeMsg "Created $mysqlsh"
            $guiPlugin = Join-Path $config "plugin_data" "gui_plugin"
            New-Item -ItemType "directory" -Path $guiPlugin
            writeMsg "Created $guiPlugin"
            writeMsg "Creating symlink for web certificates for $config ..." "-NoNewLine"
            $link = Join-Path $config "plugin_data" "gui_plugin" "web_certs"
            if ($isWindows){
                New-Item -ItemType Junction -Path $link -Target $targetWebCerts
            } else {
                New-Item -ItemType SymbolicLink -Path $link -Target $targetWebCerts
            }
            writeMsg "DONE"
        } else {
            if ($isLinux) {
                $link = Join-Path $config "plugin_data" "gui_plugin" "web_certs"
                writeMsg "Re-creating the symbolic link for $link ..." "-NoNewLine"
                Remove-Item -Path $link -Force
                New-Item -ItemType SymbolicLink -Path $link -Target $targetWebCerts
                writeMsg "DONE"
            }
        }
    } 
    writeMsg "DONE"

    # TSC TO TEST FILES
    writeMsg "TSC..." "-NoNewLine"
    Start-Process -FilePath "npm" -ArgumentList "run", "e2e-tests-tsc" -Wait -PassThru -RedirectStandardOutput "$env:WORKSPACE\env.log" -RedirectStandardError "$env:WORKSPACE\envErr.log"
    writeMsg "DONE"

}
catch {
    writeMsg $_
    writeMsg $_.ScriptStackTrace
    $err = 1
}
finally {
    if ( $err -eq 1){
        exit 1
    }
}
