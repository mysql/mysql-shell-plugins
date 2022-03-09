/*
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
 */


import { ExtensionContext, Uri, commands, window, ViewColumn } from "vscode";
import { join } from "path";
import { printChannelOutput, runMysqlShell } from "../extension";
import { platform} from "os";

/**
 * Build content for the initial setup webview
 *
 * @param rootPath The root path for images and other resources
 *
 * @returns The content of the initial setup webview
 */
export const getWelcomeWebviewContent = (rootPath: Uri): string => {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to MySQL Shell</title>
        <style>
            body {
                background-color: var(--vscode-editor-background);
            }
            #welcome {
                z-index: 2;
                display: flex;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                color: var(--vscode-editor-foreground);
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            #sakilaLogo {
                margin: 8px 0px 8px 0px;
                width: 160px;
                height: 160px;
                min-height: 160px;
                min-width: 160px;
                background-color: hsl(200, 65%, 40%);
                mask-image: url(${rootPath.toString()}/images/welcome/mysqlsh.svg);
                -webkit-mask-image: url(${rootPath.toString()}/images/welcome/mysqlsh.svg);
            }
            #pages .page {
                display: flex;
                height: 250px;
                width: 100%;
                max-width: 600px;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .inactivePage {
                display: none !important;
            }
            h2 {
                margin-top: 15px;
                text-align: center;
                font-size: 25pt;
                font-weight: 100;
            }
            h3 {
                margin-top: 11px;
                text-align: center;
                font-size: 14pt;
                font-weight: 400;
            }
            p {
                text-align: center;
                font-size: 11pt;
                font-weight: 100;
                line-height: 13pt;
                margin-left: 30px;
                margin-right: 30px;
            }
            .pWithImg {
                text-align: left;
                font-size: 11pt;
                font-weight: 100;
                line-height: 13pt;
                margin-left: 30px;
                margin-right: 30px;
            }
            .pError {
                color: red;
                font-weight: 400;
            }
            .links {
                display: flex;
                flex-direction: row;
                justify-content: center;
                font-size: 11pt;
                font-weight: 100;
                padding-top: 10px;
                padding-bottom: 60px;
                white-space: nowrap;
            }
            .links a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
                font-weight: 500;
                padding-left: 30px;
                padding-right: 30px;
            }
            .welcomeControls {
                display: flex;
                width: 100%;
                max-width: 600px;
                flex-direction: row;
                align-items: center;
                justify-content: center;
            }
            input[type=button] {
                margin: 8px 0px 0px 10px;
                width: 200px;
                height: 32px;
                color: var(--vscode-button-foreground);
                background-color: var(--vscode-button-background);
                border-style: none;
            }
            #cancelBtn {
                display: none;
            }
            .disabledBtn {
                color: var(--vscode-tab-inactiveForeground) !important;
                background-color: var(--vscode-tab-inactiveBackground) !important;
            }
            .CopyrightText {
                margin-top: 80px;
                font-size: 10px;
                font-weight: 100;
                color: var(--vscode-tab-unfocusedInactiveForeground);
            }
            #waitForConfirmation {
                width: 80px;
            }
            .pingEffect {
                display: inline-block;
                position: relative;
                width: 80px;
                height: 80px;
            }
            .pingEffect div {
                position: absolute;
                border: 4px solid #fff;
                opacity: 1;
                border-radius: 50%;
                animation: pingEffect 1s cubic-bezier(0, 0.2, 0.8, 1) infinite;
            }
            .pingEffect div:nth-child(2) {
            animation-delay: -0.5s;
            }
            @keyframes pingEffect {
                0% {
                    top: 36px;
                    left: 36px;
                    width: 0;
                    height: 0;
                    opacity: 1;
                }
                100% {
                    top: 0px;
                    left: 0px;
                    width: 72px;
                    height: 72px;
                    opacity: 0;
                }
            }
            .securityDialogInfo {
                display: ${((platform() === "darwin" || platform() === "win32") ? "block" : "none")};
            }
            .manualCertInstallInfo {
                display: ${((platform() === "darwin" || platform() === "win32") ? "none" : "block")};
            }
            code {
                font-size: 10pt;
                font-weight: 400;
                line-height: 12pt;
            }
        </style>
    </head>
    <body>
        <div id="welcome">
            <div id="sakilaLogo"></div>
            <h2>MySQL Shell for VSCode</h2>
            <div id="pages">
                <div id="page1" class="page">
                    <h3>Welcome to MySQL Shell for VSCode.</h3>
                    <p>This extension provides the powerful tool set of MySQL Shell 
                        to users of Visual Studio Code.</p>
                    <div class="links">
                        <a href="#">Learn More &gt;</a>
                        <a href="#">Browse Tutorial &gt;</a>
                        <a href="#">Read Docs &gt;</a>
                    </div>
                    <p>Please press [Next >] to complete the installation of the 
                        MySQL Shell for VSCode extension.</p>
                </div>
                <div id="page2" class="page inactivePage">
                    <h3>Installation of Certificate.</h3>
                    <p>This extension needs a certificate to be installed on your local
                        user account in order to securely access the MySQL Shell.</p>
                    <p class="pWithImg securityDialogInfo">
                        <img src="${rootPath.toString()}/images/welcome/trustSettingDlg-${platform()}.png" 
                            width="171px" height="87px" alt="Trust Dialog" align="left" hspace="15px"/>
                        In the next step a security dialog will be show, asking if 
                        the certificate should be installed.<br>
                        <br>
                        Please press [Next >] to start the installation of the 
                        MySQL Shell certificate.</p>
                </div>
                <div id="page3" class="page inactivePage">
                    <h3>Installation of Certificate.</h3>
                    <p class="securityDialogInfo">Please confirm the installation of the certificate in order 
                        to complete the installation of the extension.</p>
                    <p class="manualCertInstallInfo">The certificate is being generated.</p>
                    <div id="waitForConfirmation"><div class="pingEffect"><div></div><div></div></div></div>
                    <p id="certError" class="pError"></p>
                </div>
                <div id="page4" class="page inactivePage">
                    <h3>Installation Completed</h3>
                    <p>Thank you for installing the MySQL Shell for VSCode extension!</p>
                    <p>A reload of the VSCode window is needed to be able to use the MySQL Shell.</p>
                    <h3>Please click the [Reload VSCode Window] button.</h3>
                </div>
                <div id="page5" class="page inactivePage">
                    <h3>Please Complete the Installation</h3>
                    <p>The certificate has been created at the following location.<br>
                    <code>~/mysqlsh/plugin_data/gui_plugin/web_certs/rootCA.crt</code></p>
                    <p>Please perform the following step <b>manually</b>. For more details see 
                    <a href="https://chromium.googlesource.com/chromium/src/+/lkgr/docs/linux/cert_management.md">
                    here</a>.<br>
                    <code>cd ~/.mysqlsh/plugin_data/gui_plugin/web_certs<br>
                    sudo trust anchor rootCA.crt</code></p>
                    <p>Afterwards, click the [Reload VSCode Window] button.</p>
                </div>
            </div>
            <form name="welcomeControls" class="welcomeControls">
            <input id="cancelBtn" alt="Cancel" type="button" value="Cancel"></input>
                <input id="nextBtn" alt="Next" type="button" value="Next >"></input>
            </form>
            <div class="CopyrightText">&copy; 2022, Oracle Corporation and/or its affiliates.</div>
        </div>
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                const pageInstallCert = 3, pageLast = 4;
                const nextBtn = document.getElementById('nextBtn');
                const cancelBtn = document.getElementById('cancelBtn');
                const platformMacOrWin = ${((platform() === "darwin" || platform() === "win32") ? "true" : "false")};
                var currentPage = 1;
                var restartWizard = false;

                function showPage(pageIndex) {
                    const pagesElement = document.getElementById("pages");

                    for (let i = 0; i < pagesElement.children.length; i++) {
                        pagesElement.children[i].classList.add("inactivePage");
                    }

                    if (pageIndex-1 < pagesElement.children.length) {
                        pagesElement.children[pageIndex-1].classList.remove("inactivePage");
                    }
                }

                // Register Next button click event
                nextBtn.addEventListener('click', () => {
                    // On button click, move to next page
                    currentPage += 1;

                    // Process handling for the new page or restart the wizard if requested
                    if (restartWizard) {
                        // Go to page 1 and reset the buttons
                        restartWizard = false;
                        document.getElementById("certError").innerHTML = "";
                        nextBtn.value = "Next >";
                        cancelBtn.style.display = "none";
                        currentPage = 1;
                    } else if (currentPage == pageInstallCert) {
                        // Try to install the cert
                        nextBtn.disabled = true;
                        nextBtn.classList.add("disabledBtn");

                        vscode.postMessage({ command: 'installCert' });
                    } else if (currentPage >= pageLast) {
                        // Close the webview panel
                        vscode.postMessage({ command: 'restartVsCode' });
                        // Ensure no other page is shown
                        currentPage = 6;
                    }

                    showPage(currentPage);
                });

                // Register Cancel button click event
                cancelBtn.addEventListener('click', () => {
                    // Close the webview panel
                    vscode.postMessage({ command: 'done' });
                });

                // Handle the message inside the webview
                window.addEventListener('message', event => {

                    const message = event.data; // The JSON data our extension sent

                    switch (message.command) {
                        case 'installCertResult':
                            document.getElementById("waitForConfirmation").style.display = "none";

                            nextBtn.disabled = false;
                            nextBtn.classList.remove("disabledBtn");

                            if (message.output.includes("true")) {
                                // Depending on platform, either show complete message or manual instructions
                                if (platformMacOrWin) {
                                    showPage(4);
                                } else {
                                    showPage(5);
                                }
                                
                                nextBtn.value = "Reload VS Code Window";
                            } else if (message.output.includes("ERROR")) {
                                document.getElementById("certError").innerHTML = message.output;
                            } else {
                                nextBtn.value = "Restart Setup Wizard";
                                cancelBtn.style.display = "block";
                                restartWizard = true;
                            }

                            break;
                    }
                });
            }())
        </script>
    </body>
    </html>`;
};

export const setupInitialWelcomeWebview = (context: ExtensionContext): void => {
    context.subscriptions.push(commands.registerCommand("msg.runWelcomeWizard", () => {
        const panel = window.createWebviewPanel(
            "mysqlShellInitialSetup",
            "Welcome to MySQL Shell",
            ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [Uri.file(join(context.extensionPath, "images"))],
            },
        );

        panel.webview.html = getWelcomeWebviewContent(
            panel.webview.asWebviewUri(Uri.file(context.extensionPath)));

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case "installCert":
                        // Run the shell command to install the cert
                        const parameters = [
                            "--", "gui", "core", "install-shell-web-certificate",
                            "--replace_existing=true",
                        ];
                        runMysqlShell(context.extensionPath, parameters,
                            // onStdOutData
                            (data) => {
                                // Pass the result to the webview
                                const output = String(data);
                                printChannelOutput(output);
                                void panel.webview.postMessage({ command: "installCertResult", output});
                            });

                        return;

                    case "restartVsCode":
                        // Close the webview and start the shell
                        panel.dispose();

                        void commands.executeCommand("workbench.action.reloadWindow");

                        return;

                    case "done":
                        // Close the webview
                        panel.dispose();

                        return;
                    default:
                        return;
                }
            },
            undefined,
            context.subscriptions,
        );

        /*panel.onDidDispose(
            () => {
                startShellAndConnect(context.extensionPath);
            },
            undefined,
            context.subscriptions);*/
    }));
};
