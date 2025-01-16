/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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
 * separately licensed software that they have either included with
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
 */

import { WebviewPanel, workspace } from "vscode";

/**
 * This is the core function for preparing the webview panel for the MSG application.
 * It expects a running MySQL Shell server to be available at the given URL.
 *
 * @param panel The webview panel to prepare.
 * @param url The URL of the running MySQL Shell server.
 */
export const prepareWebviewContent = (panel: WebviewPanel, url: URL): void => {
    // Insert an iframe to load the external URL from the running mysql shell server.
    url.searchParams.set("app", "vscode");

    // Get the VS Code font size
    const vsCodeFontSize = workspace.getConfiguration(`editor`).get<number>("fontSize", 14);
    url.searchParams.set("editorFontSize", vsCodeFontSize.toString());

    // Define the URL for the test image used to check if the mysql shell server can be reached.
    const testImgUrl = new URL(url.toString());
    testImgUrl.pathname = "/images/no-image.svg";

    // Get the user setting for showing the Unsecure Connection warning panel
    const showUnsecuredConnectionWarning = workspace.getConfiguration(`msg.shell`)
        .get<boolean>("showUnsecuredConnectionWarning", true);

    panel.webview.html = `
<!doctype html><html lang="en">
<head>
<meta http-equiv="Content-Security-Policy" content="default-src *; img-src http: https:;
    script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline' http: https: data: *;">
<style>
    .warning {
        width: 210px;
        height: 50px;
        color: black;
        background: red;
        -webkit-border-radius: 5px;
        -moz-border-radius: 5px;
        position:absolute;
        bottom: 10px;
        right: 10px;
        opacity: 0.5;
        text-align: center;
    }
    .clickThrough {
        pointer-events: none;
    }
    .warning h1 {
        line-height: 20px;
        font-size: 12px;
        font-weight: 500;
        margin: 0px;
    }
    .warning p {
        line-height: 8px;
        font-size: 8px;
        font-weight: 300;
        margin: 0px;
    }
    .warning p a {
        color: white;
    }
    #waitForContent {
        display: none;
        justify-content: center;
        align-items: center;
        text-align: center;
        min-height: 100vh;
    }
    .pingEffect {
        display: inline-block;
        position: relative;
        width: 80px;
        height: 80px;
    }
    .pingEffect div {
        position: absolute;
        border: 4px solid var(--vscode-foreground);
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
  </style>
  <script>
    // Keep track of whether the waitForContentDiv should still be shown
    let showWaitForContentDiv = true;

    // Hides the waitForContentDiv in case the content was loaded or there was and error
    function hideWaitForContentDiv() {
        showWaitForContentDiv = false;
        document.getElementById("waitForContent").style.display = "none";
    }

    // Displays a floating div panel at the bottom right
    function showFloatingLabel(title, info, clickThrough) {
        var div = document.createElement("div");
        div.classList.add("warning");
        if (clickThrough) {
            div.classList.add("clickThrough");
        }
        var h1 = document.createElement("h1");
        h1.innerHTML = title;
        div.appendChild(h1);
        var p = document.createElement("p");
        p.innerHTML = info;
        div.appendChild(p);
        document.body.appendChild(div);
    }

    // Called when an error occurred while loading the content
    function showLoadingError() {
        hideWaitForContentDiv();

        if ("${url.protocol}" === "https:") {
            showFloatingLabel("Failed to Connect",
                "Please check if you have the<br>" +
                "MySQL Shell rootCA.crt certificate<br>" +
                "<a href='https://dev.mysql.com/doc/mysql-shell-for-vs-code/en/certificate-handling.html'>" +
                "installed</a> on your local system.", false);
        } else {
            showFloatingLabel("Failed to Connect",
                "Unable to connect to MySQL Shell.<br>" +
                "Please check if the MySQL Shell<br>" +
                "process is running.", false);
        }
    }

    // Only display the waitForContentDiv after 1 second to avoid flickering
    setTimeout(() => {
        // If the waitForContentDiv should still be show (content has not loaded yet, or there was an error)
        if (showWaitForContentDiv) {
            document.getElementById("waitForContent").style.display = "flex";
        }
    }, 1000);
  </script>
</head>
<body style="margin:0px;padding:0px;overflow:hidden;">
<iframe id="frame-msg" onload="hideWaitForContentDiv()" allow="clipboard-read; clipboard-write;"
    src="${url.toString()}"
    frameborder="0" style="overflow: hidden; overflow-x: hidden; overflow-y: hidden; height:100%;
    width: 100%; position: absolute; top: 0px; left: 0px; right: 0px; bottom: 0px; user-select: none;">
</iframe>
<div id="waitForContent"><div class="pingEffect"><div></div><div></div></div></div>
<img src="${testImgUrl.toString()}" onerror="showLoadingError()"
    width="0" height="0">
<script>
    let frame;
    let vscode;

    // Forward paste clipboard events to the iframe.
    document.addEventListener("paste", (event) => {
        const data = event.clipboardData.getData("text/plain");
        frame.contentWindow.postMessage({
            source: "host",
            command: "paste",
            data: { "text/plain" : data },
        }, "*");
    });

    document.addEventListener("cut", (event) => {
        frame.contentWindow.postMessage({
            source: "host",
            command: "cut",
        }, "*");
    });

    document.addEventListener("copy", (event) => {
        frame.contentWindow.postMessage({
            source: "host",
            command: "copy",
        }, "*");
    });

    window.addEventListener('message', (event) => {
        if (!frame) {
            vscode = acquireVsCodeApi();
            frame = document.getElementById("frame-msg");

            // Listen to style changes on the outer iframe.
            const sendThemeMessage = () => {
                frame.contentWindow.postMessage({
                    source: "host",
                    command: "hostThemeChange",
                    data: {
                        css: document.documentElement.style.cssText,
                        themeClass: document.body.getAttribute("data-vscode-theme-kind"),
                        themeName: document.body.getAttribute("data-vscode-theme-name"),
                        themeId: document.body.getAttribute("data-vscode-theme-id")
                    }
                }, "*");
            };

            const observer = new MutationObserver(sendThemeMessage);
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });

            // Send initial theme change message.
            sendThemeMessage();

            // An additional call after a timeout is necessary to ensure listeners
            // have sufficient time to initialize during the first execution.
            // However, relying solely on the delayed call without the immediate
            // initial call can result in a light-to-dark flicker
            // when the OS prefers a light theme, but VS Code uses a dark one.
            setTimeout(sendThemeMessage, 100);
        }

        if (event.data.source === "host") {
            // Forward message from the extension to the iframe.
            frame.contentWindow.postMessage(event.data, "*");
        } else if (event.data.source === "app") {
            // Forward app events either directly or after a conversion to vscode.
            switch (event.data.command) {
                case "keydown": {
                    window.dispatchEvent(new KeyboardEvent("keydown", event.data));
                    break;
                }
                case "keyup": {
                    window.dispatchEvent(new KeyboardEvent("keyup", event.data));
                    break;
                }
                case "writeClipboard": {
                    // This is a special message and can be handled here.
                    window.navigator.clipboard.writeText(event.data.text);
                    break;
                }
                default: {
                    vscode.postMessage(event.data);
                    break;
                }
            }
        }
    });

    if ("${url.protocol}" !== "https:" && ${String(showUnsecuredConnectionWarning)} === true) {
        showFloatingLabel("Warning: Unsecured Connection",
            "MySQL Shell is currently using HTTP.<br>" +
            "Open the VS Code Settings and enable <br>" +
            "Msg &gt; Shell: Enforce Https.",
            true);
    }
</script>

</body></html>`;
};
