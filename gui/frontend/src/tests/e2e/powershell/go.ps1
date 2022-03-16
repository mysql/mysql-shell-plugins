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
#\mysql-client-qa\Selenium
$basePath = Join-Path $env:WORKSPACE "shell-plugins" "gui" "frontend"

function parseHTML($path){
    $source = Get-Content -Path $path -Raw
    $html = New-Object -Com "HTMLFile"
    $src = [System.Text.Encoding]::Unicode.GetBytes($source)
    $html.write($src)
    return $html
}

try{
    $err = 0

    $log = Join-Path $env:WORKSPACE "ps.log"

    function writeMsg($msg, $option){

        $msg | Out-File $log -Append

        Invoke-Expression "write-host `"$msg`" $option"
        
    }
    
    if(!$env:SHELLBRANCH){
        Throw "Please define 'SHELLBRANCH' env variable"
    }
    if(!$env:PLUGINBRANCH){
        Throw "Please define 'PLUGINBRANCH' env variable"
    }
    if(!$env:WORKSPACE){
        Throw "Please define 'WORKSPACE' env variable"
    }
    
    if( Test-Path -Path $log ){
        Remove-Item -Path $log -Recurse -Force	
    }

    New-Item -ItemType "file" -Path $log

    writeMsg "Setup nodejs registry..." "-NoNewLine"
    Start-Process "npm" -ArgumentList "set", "registry", "https://artifacthub-tip.oraclecorp.com/api/npm/npmjs-remote" -Wait -RedirectStandardOutput "$env:WORKSPACE\node.log" -RedirectStandardError "$env:WORKSPACE\nodeErr.log"
    writeMsg "DONE"

    writeMsg "Installing node modules..." "-NoNewLine"
    if( !(Test-Path -Path "$basePath\node_modules") ){
        Start-Process "npm" -ArgumentList "install", "--force" -WorkingDirectory "$basePath" -Wait -RedirectStandardOutput "$env:WORKSPACE\node.log" -RedirectStandardError "$env:WORKSPACE\nodeErr.log"
        writeMsg "DONE"
    }
    else{
        writeMsg "SKIPPED"
    }
    
    writeMsg "Running Webdriver update..." "-NoNewLine"
    $env:PROXY = 'http://www-proxy.us.oracle.com:80'
    $env:HTTPS_PROXY = 'http://www-proxy.us.oracle.com:80'
	Start-Process -FilePath "npm" -ArgumentList "run", "e2e-update" -WorkingDirectory "$basePath" -Wait -RedirectStandardOutput "$env:WORKSPACE\node.log" -RedirectStandardError "$env:WORKSPACE\nodeErr.log"
    writeMsg "DONE"

    #DOWNLOAD SHELL
    if(!$env:SHELL_PUSH_ID){
        $env:SHELL_PUSH_ID = "latest"
    }
    writeMsg "MySQL Shell is not installed."
    $bundles = (Invoke-WebRequest -NoProxy -Uri "http://pb2.mysql.oraclecorp.com/nosso/api/v2/branches/$env:SHELLBRANCH/pushes/$env:SHELL_PUSH_ID/").content     
    $bundles = $bundles | ConvertFrom-Json
    $shell = ($bundles.builds | Where-Object { 
        $_.target_os -clike "windows"
        }).artifacts | Where-Object {
            ($_.name -eq "mysql-shell-commercial" -or 
            $_.name -eq "mysql-shell") -and
            $_.url -notlike "*unittest*" -and
            $_.archive -eq "zip"
        }

    if($shell){
        $shell | ForEach-Object { 
            $shellItem = $_.url.replace("http://pb2.mysql.oraclecorp.com/nosso/archive/","")
            $dest = Join-Path $env:WORKSPACE $shellItem
            $shellItem -match "\.(.*).zip"
            $execPath = Join-Path $env:WORKSPACE $matches[1] "bin"
            if( Test-Path -Path $dest ){
                writeMsg "$shellItem already exists. Skipping download."
            }
            else{
                writeMsg "Downloading $shellItem ..." "-NoNewline" 
                Invoke-WebRequest -NoProxy -Uri $_.url -OutFile $dest
                writeMsg "DONE"
    
                writeMsg  "Extracting MySQL Shell..." "-NoNewline"
                Expand-Archive 	$dest -DestinationPath $env:WORKSPACE
                writeMsg "DONE"
            }
        }	
    }    
    else{
        writeMsg "Could not download MySQL Shell."
        exit 1
    }
    
    writeMsg "Updating PATH with '$execPath'" "-NoNewLine"
    $env:PATH += ";$execPath"
    refreshenv
    writeMsg "DONE"

    #START SHELL FOR THE FIRST TIME TO CREATE THE mysqlsh FOLDER on APPDATA
    writeMsg "Starting/Stoping MySQL Shell for the first time..." "-NoNewline"
    Start-Process "mysqlsh"

    Sleep 5

    Stop-Process -Name "mysqlsh"
    writeMsg "DONE"
    
    #CREATE plugins FOLDER
    $guipluginPath = Join-Path $HOME "AppData" "Roaming" "MySQL" "mysqlsh" "plugins"
    writeMsg "Creating plugins folder ($guipluginPath) ..." "-NoNewline"
    New-Item -ItemType "directory" -Force -Path $guipluginPath 
    writeMsg "DONE"
    
    #DOWNLOAD PORTABLE.ZIP
    if(!$env:PLUGIN_PUSH_ID){
        $env:PLUGIN_PUSH_ID = "latest"
    }

    $bundles = (Invoke-WebRequest -NoProxy -Uri "http://pb2.mysql.oraclecorp.com/nosso/api/v2/branches/$env:PLUGINBRANCH/pushes/$env:PLUGIN_PUSH_ID/").content     
    $bundles = $bundles | ConvertFrom-Json
    $plugin = ($bundles.builds | Where-Object { 
        #$_.product -eq "mysql-shell-ui-plugin_binary_commercial_portable_zip"
        ( $_.product -eq "mysql-shell-ui-plugin_binary_commercial_portable_zip" ) -or
        ( $_.product -eq "mysql-shell-ui-plugin_binary_gui-plugin_zip" )
        }).artifacts | Where-Object {
            $_.name -like "mysql-shell-gui-plugin"
        }

    if($plugin){
        $plugin | ForEach-Object { 
            $pluginItem = $_.url.replace("http://pb2.mysql.oraclecorp.com/nosso/archive/","")
            writeMsg "Downloading $pluginItem ..." "-NoNewline" 
            $dest = Join-Path $env:WORKSPACE $pluginItem
            Invoke-WebRequest -NoProxy -Uri $_.url -OutFile $dest
            writeMsg "DONE"
            }
        }
    else{
        writeMsg "Could not download GUI plugin."
        exit 1
    }    

    $pluginDestPath = Join-Path $env:WORKSPACE $pluginItem
    #EXTRACT PORTABLE.ZIP
    writeMsg "Extracting $pluginItem ..." "-NoNewline"
    Expand-Archive -Path $pluginDestPath -DestinationPath $env:WORKSPACE
    writeMsg "DONE"

    #MOVE gui_plugin TO FOLDER
    writeMsg "Moving plugins folder to destination..." "-NoNewLine"
    $item = Get-ChildItem -Path $env:WORKSPACE | where { 
        $_ -like "*mysql-shell-gui-plugin*" -and 
        $_ -notlike "*.zip*" 
    }
    $item = $item.Name      
    Rename-Item -Path "$env:WORKSPACE\$item" -NewName "gui_plugin"
    $guiPluginFolder = Join-Path $env:WORKSPACE "gui_plugin"
    Copy-Item $guiPluginFolder $guipluginPath -Recurse -Force
    writeMsg "DONE"
    
    #CHECK THAT SERVER IS WORKING
    writeMsg "Checking mysqlsh server..." "-NoNewLine"
	Start-Process "mysqlsh" -ArgumentList "--py", "-e", "`"gui.start.web_server(port=8000, single_instance_token='1234test')`"" -PassThru -RedirectStandardOutput "$env:WORKSPACE\serverLog.log" -RedirectStandardError "$env:WORKSPACE\serverError.log"
    
    function isServerReady(){
        return $null -ne (Get-Content -Path "$env:WORKSPACE\serverLog.log" | Select-String -Pattern "[token=1234test]" | % { $_.Matches.Groups[0].Value })
    }

    $counter = 0
    $isReady = $false

    while ($counter -le 10){
        $isReady = isServerReady
        if( $isReady ){
            break
        }
        else{
            Sleep 1
            $counter++
        }
    }

    if(!$isReady){ 
        Throw "Shell GUI Server was not started!" 
    }
    else{
        writeMsg "OK! Stopping it..." "-NoNewLine"
        Stop-Process -Name "mysqlsh" -Force
        writeMsg "DONE"
    }

    #############################EXEC TESTS#####################################################

    #START SELENIUM
    writeMsg "Starting Selenium..." "-NoNewLine"
    Start-Process -FilePath "npm" -ArgumentList "run", "e2e-start" -WorkingDirectory "$basePath" -RedirectStandardOutput "$env:WORKSPACE\selenium.log" -RedirectStandardError "$env:WORKSPACE\seleniumErr.log"
    
    function isSeleniumReady(){
        return $null -ne (Get-Content -Path "$env:WORKSPACE\seleniumErr.log" | Select-String -Pattern "Selenium Server is up and running on port 4444" | % { $_.Matches.Groups[0].Value }) 
    }

    $counter = 0
    $isReady = $false

    while ($counter -le 20){
        $isReady = isSeleniumReady
        if( $isReady ){
            break
        }
        else{
            Sleep 1
            $counter++
        }
    }
    
    if(!$isReady){ Throw "Selenium was not ready after 20 tries!" }

    $id = Get-Content -Path "$env:WORKSPACE\selenium.log" | Select-String -Pattern "seleniumProcess.pid: (\d+)" | % { $_.Matches.Groups[1].Value }

    if($id){
        writeMsg "OK!"
    }
    else{
        Throw "Could not get Selenium pid"
    }
    
    #START MYSQL SERVER
    writeMsg "Stopping MySQL Server..." "-NoNewLine"
    Stop-Service -Name "MySQL" -Force
    writeMsg "DONE"

    writeMsg "Adding SSL certificates to config file..." "-NoNewLine"
    $hasSSL = Select-String -Path "C:\tools\mysql\current\my.ini" -Pattern "ssl"
    
    if($null -eq $hasSSL){
        Add-Content -Path "C:\tools\mysql\current\my.ini" -Value "`r`n
        ssl-ca=$basePath\\src\\tests\\e2e\\ssl_certificates\\ca-cert.pem`r`n
        ssl-cert=$basePath\\src\\tests\\e2e\\ssl_certificates\\server-cert.pem`r`n
        ssl-key=$basePath\\src\\tests\\e2e\\ssl_certificates\\server-key.pem`r`n
        [client]`r`n
        ssl-ca=$basePath\\src\\tests\\e2e\\ssl_certificates\\ca-cert.pem`r`n
        ssl-cert=$basePath\\src\\tests\\e2e\\ssl_certificates\\client-cert.pem`r`n
        ssl-key=$basePath\\src\\tests\\e2e\\ssl_certificates\\client-key.pem"
        writeMsg "DONE"
    }
    else{
        writeMsg "SSL is already setup on the server"
    }
    
    if( !(Test-Path "C:\tools\mysql\current\init.txt") ){
        New-Item -Path "C:\tools\mysql\current\init.txt" -Value "ALTER USER 'root'@'localhost' IDENTIFIED BY '$env:DBPASSWORD';"
    }
    
    writeMsg "Starting MySQL Server..." "-NoNewLine"
    Start-Process -FilePath "C:\tools\mysql\current\bin\mysqld" -ArgumentList "--init-file=C:\tools\mysql\current\init.txt" ,"--console" -RedirectStandardError "$env:WORKSPACE\mysql.log"
    
    function isMySQLReady(){
        return $null -ne (Get-Content -Path "$env:WORKSPACE\mysql.log" | Select-String -Pattern "mysqld.exe: ready for connections" | % { $_.Matches.Groups[0].Value }) 
    }

    $counter = 0
    $isReady = $false

    while ($counter -le 20){
        $isReady = isMySQLReady
        if( $isReady ){
            break
        }
        else{
            Sleep 1
            $counter++
        }
    }
    
    if(!$isReady){ Throw "MySQL was not ready after 20 tries! Check mysql.log file" }
    writeMsg "DONE"

    ##INSTALLING SCHEMAS ON MYSQL
    $sakila = $false
    $world = $false
    writeMsg "Retrieving databases..." "-NoNewLine"
    Start-Process "C:\tools\mysql\current\bin\mysql" -ArgumentList "-u", "$env:DBUSERNAME", "-p$env:DBPASSWORD", "-e", "`"show databases;`"" -RedirectStandardOutput "$env:WORKSPACE\showDBs.log" -RedirectStandardError "$env:WORKSPACE\showDBsErr.log" 
    $result = Get-Content -Path "$env:WORKSPACE\showDBs.log" | % { 
        if($_ -eq "sakila"){
            $sakila = $true
        }
        if($_ -eq "world_x_cst"){
            $world = $true
        }
     }
    writeMsg "DONE"

    if(!$sakila){
        writeMsg "Installing sakila schema..." "-NoNewLine"
        cmd.exe /c "C:\tools\mysql\current\bin\mysql -u $env:DBUSERNAME -p$env:DBPASSWORD < $basePath\src\tests\e2e\sql\sakila.sql"
        writeMsg "DONE"
    }
    else{
        writeMsg "Found sakila schema."
    }
    if(!$world){
        writeMsg "Installing world schema..."
        cmd.exe /c "C:\tools\mysql\current\bin\mysql -u $env:DBUSERNAME -p$env:DBPASSWORD < $basePath\src\tests\e2e\sql\world_x_cst.sql"
        writeMsg "DONE"
    }
    else{
        writeMsg "Found world schema."
    }

    if($env:RERUN){
        #CHECK IF THERE IS A TEST-REPORT
        if( Test-Path -Path "$basePath\src\tests\e2e\test-report.html" ){
            writeMsg "Found an existing test report"
            Rename-Item -Path "$basePath\src\tests\e2e\test-report.html" -NewName "prev-test-report.html"

            ###GET FAILED TESTS###
            writeMsg "Getting failed tests..."
            $html = parseHTML "$basePath\src\tests\e2e\prev-test-report.html"
            $size = $html.body.document.querySelectorAll(".failed .test-title").Length

            if($size -gt 0){
                $failed = "`""
                for($i=0; $i -le $size-1; $i++){
                    $failedTest = $html.body.document.querySelectorAll(".failed .test-title").item($i).InnerText
                    writeMsg "- $failedTest"
                    $failed += $failedTest
                    if($i -ne $size-1){
                        $failed += "|"
                    }
                }
                $failed += "`""
                #RE-WRITE PACKAGE.JSON WITH TESTS TO RE-RUN
                if($failed.Length -gt 0){
                    $json = Get-Content -Path "$basePath\package.json" | Out-String | ConvertFrom-Json
                    if($json.scripts.e2e -like "*testNamePattern*"){
                        $json.scripts.e2e -match '--testNamePattern=''([^'']*)'''
                        $json.scripts.e2e = $json.scripts.e2e.replace($matches[1], $failed)
                    }
                    else{
                        $json.scripts.e2e += " --testNamePattern='$failed'"
                    }
                    
                    $json | ConvertTo-Json -Depth 3 | Set-Content "$basePath\package.json"
                }

                writeMsg "DONE"
            }
            else{
                writeMsg "No failed tests were found. DONE"
            }
        }
        else{
            writeMsg "Test report not found."
        }
    }
    

    #EXECUTE TESTS
    writeMsg "Executing GUI tests..." "-NoNewLine"
    Start-Process -FilePath "npm" -ArgumentList "run", "e2e" -WorkingDirectory "$basePath" -Wait -RedirectStandardOutput "$env:WORKSPACE\results.log" -RedirectStandardError "$env:WORKSPACE\resultsErr.log"
    writeMsg "DONE"

    #CHECK RESULTS
    $hasFailedTests = $null -ne (Get-Content -Path "$env:WORKSPACE\resultsErr.log" | Select-String -Pattern "(\d+) failed" | % { $_.Matches.Groups[0].Value })
    $hasPassedTests = $null -ne (Get-Content -Path "$env:WORKSPACE\resultsErr.log" | Select-String -Pattern "(\d+) passed" | % { $_.Matches.Groups[0].Value })

    if( $hasFailedTests -or (!$hasFailedTests -and !$hasPassedTests) ){
        $screenshots = Join-Path $basePath "src" "tests" "e2e" "screenshots" 
        if( Test-Path $screenshots ){
            $files = Get-ChildItem -Path $screenshots
            writeMsg "Adding screenshots to html-report ($($files.Length))" "-NoNewLine"
            Start-Process -FilePath "npm" -ArgumentList "run", "e2e-report" -WorkingDirectory "$basePath" -Wait -RedirectStandardOutput "$env:WORKSPACE\addScreenshots.log" -RedirectStandardError "$env:WORKSPACE\addScreenshotsErr.log"
            writeMsg "DONE"
        }
    }
    
    if($env:RERUN){
        if( Test-Path -Path "$basePath\src\tests\e2e\prev-test-report.html" ){
            #MERGE HTML REPORTS
            writeMsg "Merging HTML reports..." "-NoNewLine"
            $prevHtml = parseHTML "$basePath\src\tests\e2e\prev-test-report.html"
            $curHtml = parseHTML "$basePath\src\tests\e2e\test-report.html"
            
            $failedTests = $failed -split "\|"
    
            $htmlToSave = @()
    
            #GET THE LATEST RESULTS FROM LATEST REPORT
            $size = $curHtml.body.document.querySelectorAll(".test-result").Length
            for($i=0; $i -le $size-1; $i++){
                if( $failedTests -contains $curHtml.body.document.querySelectorAll(".test-result").item($i).querySelector(".test-title").InnerText ){
                    $htmlToSave += $curHtml.querySelectorAll(".test-result").item($i).outerHTML
                }
            }
    
            #SET LATEST RESULTS ON PREVIOUS REPORT
            $size = $prevHtml.body.document.querySelectorAll(".test-result").Length
            for($i=0; $i -le $size-1; $i++){
                $item = $prevHtml.body.document.querySelectorAll(".test-result").item($i).querySelector(".test-title").InnerText
                if( $failedTests -contains $item ){
                    $prevHtml.querySelectorAll(".test-result").item($i).outerHTML = $htmlToSave | where { $_ -like "*$item*" }
                }
            }
    
            #GET TEST-SUMMARY/SUITE-SUMMARY FROM LATEST REPORT
            $curTestsPassed = [int]($curHtml.body.document.querySelector("#test-summary .summary-passed").InnerText).replace(" passed", "")
            $prevTestsPassed = [int]($prevHtml.body.document.querySelector("#test-summary .summary-passed").InnerText).replace(" passed", "")
            $prevTestsFailed = [int]($prevHtml.body.document.querySelector("#test-summary .summary-failed").InnerText).replace(" failed", "")
    
            $curSuitePassed = [int]($curHtml.body.document.querySelector("#suite-summary .summary-passed").InnerText).replace(" passed", "")
            $prevSuitePassed = [int]($prevHtml.body.document.querySelector("#suite-summary .summary-passed").InnerText).replace(" passed", "")
            $prevSuiteFailed = [int]($prevHtml.body.document.querySelector("#suite-summary .summary-failed").InnerText).replace(" failed", "")
    
            $totalTestsPassed = $prevTestsPassed + $curTestsPassed
            $totalTestsFailed = $prevTestsFailed - $curTestsPassed
    
            $totalSuitePassed = $prevSuitePassed + $curSuitePassed
            $totalSuiteFailed = $prevSuiteFailed - $curSuitePassed
    
            $prevHtml.body.document.querySelector("#test-summary .summary-passed").innerHTML = $prevHtml.body.document.querySelector("#test-summary .summary-passed").innerHTML -replace '(\d+) passed', "$totalTestsPassed passed"
            $prevHtml.body.document.querySelector("#test-summary .summary-failed").innerHTML = $prevHtml.body.document.querySelector("#test-summary .summary-failed").innerHTML -replace '(\d+) failed', "$totalTestsFailed failed"
            
            $prevHtml.body.document.querySelector("#suite-summary .summary-passed").innerHTML = $prevHtml.body.document.querySelector("#suite-summary .summary-passed").innerHTML -replace '(\d+) passed', "$totalSuitePassed passed"
            $prevHtml.body.document.querySelector("#suite-summary .summary-failed").innerHTML = $prevHtml.body.document.querySelector("#suite-summary .summary-failed").innerHTML -replace '(\d+) failed', "$totalSuiteFailed failed"
    
            if($totalTestsPassed -gt 0){ 
                if($prevHtml.body.document.querySelector("#test-summary .summary-passed").className -like "*summary-empty*"){
                    $prevHtml.body.document.querySelector("#test-summary .summary-passed").className = $prevHtml.body.document.querySelector("#test-summary .summary-passed").className.replace(" summary-empty", "")
                }
            }
            else{
                if($prevHtml.body.document.querySelector("#test-summary .summary-passed").className -notlike "*summary-empty*"){
                    $prevHtml.body.document.querySelector("#test-summary .summary-passed").className += " summary-empty"
                }
            }
    
            if($totalTestsFailed -gt 0){ 
                if($prevHtml.body.document.querySelector("#test-summary .summary-failed").className -like "*summary-empty*"){
                    $prevHtml.body.document.querySelector("#test-summary .summary-failed").className = $prevHtml.body.document.querySelector("#test-summary .summary-failed").className.replace(" summary-empty", "")
                }
            }
            else{
                if($prevHtml.body.document.querySelector("#test-summary .summary-failed").className -notlike "*summary-empty*"){
                    $prevHtml.body.document.querySelector("#test-summary .summary-failed").className += " summary-empty"
                }
            }
    
            if($totalSuitePassed -gt 0){ 
                if($prevHtml.body.document.querySelector("#suite-summary .summary-passed").className -like "*summary-empty*"){
                    $prevHtml.body.document.querySelector("#suite-summary .summary-passed").className = $prevHtml.body.document.querySelector("#suite-summary .summary-passed").className.replace(" summary-empty", "")
                }
            }
            else{
                if($prevHtml.body.document.querySelector("#suite-summary .summary-passed").className -notlike "*summary-empty*"){
                    $prevHtml.body.document.querySelector("#suite-summary .summary-passed").className += " summary-empty"
                }
            }
    
            if($totalSuiteFailed -gt 0){ 
                if($prevHtml.body.document.querySelector("#suite-summary .summary-failed").className -like "*summary-empty*"){
                    $prevHtml.body.document.querySelector("#suite-summary .summary-failed").className = $prevHtml.body.document.querySelector("#suite-summary .summary-failed").className.replace(" summary-empty", "")
                }
            }
            else{
                if($prevHtml.body.document.querySelector("#suite-summary .summary-failed").className -notlike "*summary-empty*"){
                    $prevHtml.body.document.querySelector("#suite-summary .summary-failed").className += " summary-empty"
                }
            }
        
            Remove-Item -Path "$basePath\src\tests\e2e\test-report.html" -Force
            $prevHtml.documentElement.outerHTML | Out-File "$basePath\src\tests\e2e\test-report.html" -Force
            Remove-Item -Path "$basePath\src\tests\e2e\prev-test-report.html" -Force
            writeMsg "DONE"
        }
    }

    #CHECK RESULTS
    $hasFailedTests = $null -ne (Get-Content -Path "$env:WORKSPACE\resultsErr.log" | Select-String -Pattern "(\d+) failed" | % { $_.Matches.Groups[0].Value })
    $hasPassedTests = $null -ne (Get-Content -Path "$env:WORKSPACE\resultsErr.log" | Select-String -Pattern "(\d+) passed" | % { $_.Matches.Groups[0].Value })

    if( $hasFailedTests -or (!$hasFailedTests -and !$hasPassedTests) ){
        writeMsg "There are failed tests !"
        $err = 1
    }
    else{
        writeMsg "All tests passed !"
    }

}
catch{
    writeMsg $_
	writeMsg $_.ScriptStackTrace
	$err = 1
}
finally{
    try{
        Get-Process | Where-Object {$_.Name -like "*chromedriver*" } | Stop-Process -Force
        Get-Process | Where-Object {$_.Name -like "*chrome*" } | Stop-Process -Force
        Get-Process | Where-Object {$_.Name -like "*mysql*" } | Stop-Process -Force
        $prc = Get-Process -Id (Get-NetTCPConnection -LocalPort 4444).OwningProcess
        writeMsg "Stopping Selenium..." "-NoNewLine"
        Stop-Process -Id $prc.Id
        writeMsg "DONE"
    }
    catch{
        writeMsg "Selenium is not running. All fine"
    }

    if( $err -eq 1){
        exit 1
    }
}

