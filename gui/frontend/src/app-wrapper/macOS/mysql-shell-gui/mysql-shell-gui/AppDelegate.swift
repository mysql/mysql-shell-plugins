/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import Cocoa;
@preconcurrency import WebKit;

@main
class AppDelegate: NSObject, AppProtocol, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate,
                   WKScriptMessageHandler {

  @IBOutlet var window: NSWindow!;
  @IBOutlet var browser: DragTargetWebView!;
  @IBOutlet var background: NSBox!;
  @IBOutlet var progressIndicator: NSProgressIndicator!;

  var shellInstance: NSRunningApplication?;
  let shellProcess = Process();
  var userContentController: WKUserContentController?;

  //--------------------------------------------------------------------------------------------------------------------

  public func sendAppMessage(command: String, data: [Any]) -> Void {
    browser.evaluateJavaScript("onNativeMessage({ command: '\(command)', data: \(data) })", completionHandler: {
      (result, error) in
      if error != nil {
        print(error!); // TODO: write to log file.
      }
    })
  }

  //--------------------------------------------------------------------------------------------------------------------

  @IBAction func showAboutBox(sender: Any) -> Void {
    self.sendAppMessage(command: "showAbout", data: []);
  }

  //--------------------------------------------------------------------------------------------------------------------

  @IBAction func showPreferences(sender: Any) -> Void {
    self.sendAppMessage(command: "showPreferences", data: []);
  }

  //--------------------------------------------------------------------------------------------------------------------

  func applicationWillFinishLaunching(_ notification: Notification) {
    // Make sure we come up with the right app colors (from the user's theme).
    if let colorValue = UserDefaults.standard.string(forKey: "themeBackground") {
      window.backgroundColor = NSColor.init(hex: colorValue);
      background.fillColor = NSColor.init(hex: colorValue);
    }

    if let type = UserDefaults.standard.string(forKey: "themeType") {
      if (type == "dark") {
        progressIndicator.appearance = NSAppearance(named: .vibrantLight);
      } else {
        progressIndicator.appearance = NSAppearance(named: .vibrantDark);
      }
    }
    progressIndicator.startAnimation(self);

    browser.setValue(false, forKey: "drawsBackground")
  }

  //--------------------------------------------------------------------------------------------------------------------

  func applicationDidFinishLaunching(_ aNotification: Notification) {
    browser.appDelegate = self;

    var debug = false;
    var uuid = UUID().uuidString;
    if NSEvent.modifierFlags.contains(NSEvent.ModifierFlags.option) {
      debug = true;
      uuid = "236d84bc-5965-11eb-b3f9-003ee1ce36e8";
    }

    let port = launchShell(debug: debug, token: uuid);

    // Start by removing old cached data.
    let websiteDataTypes = NSSet(array: [
      WKWebsiteDataTypeFetchCache,
      WKWebsiteDataTypeDiskCache,
      WKWebsiteDataTypeMemoryCache,
      WKWebsiteDataTypeOfflineWebApplicationCache,
      WKWebsiteDataTypeCookies,
      WKWebsiteDataTypeSessionStorage,
      WKWebsiteDataTypeLocalStorage,
      WKWebsiteDataTypeWebSQLDatabases,
      WKWebsiteDataTypeIndexedDBDatabases,
      WKWebsiteDataTypeServiceWorkerRegistrations,
    ])

    let date = Date(timeIntervalSince1970: 0)
    WKWebsiteDataStore.default()
      .removeData(ofTypes: websiteDataTypes as! Set<String>, modifiedSince: date, completionHandler: { });

    browser.allowsBackForwardNavigationGestures = false;
    browser.navigationDelegate = self;
    browser.uiDelegate = self;
    userContentController = browser.configuration.userContentController;

    userContentController?.add(self, name: "hostChannel");

    let link = URL(string:"https://localhost:\(port)/?token=\(uuid)")!;
    let request = URLRequest(url: link);
    browser.load(request);
  }

  //--------------------------------------------------------------------------------------------------------------------

  func applicationWillTerminate(_ aNotification: Notification) {
    if (shellProcess.isRunning) {
      shellProcess.terminate();
    }
  }

  //--------------------------------------------------------------------------------------------------------------------

  internal func webView(_ webView: WKWebView,
                        didFailProvisionalNavigation navigation: WKNavigation!,
                        withError error: Error) {
    print(error.localizedDescription)
  }

  //--------------------------------------------------------------------------------------------------------------------

  /**
   * Needed only during development to accept a self signed certificate for localhost.
   */
  func webView(_ webView: WKWebView,
               didReceive challenge: URLAuthenticationChallenge,
               completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    let trust = challenge.protectionSpace.serverTrust!
    let exceptions = SecTrustCopyExceptions(trust)
    SecTrustSetExceptions(trust, exceptions)
    completionHandler(.useCredential, URLCredential(trust: trust))
  }

  //--------------------------------------------------------------------------------------------------------------------

  func webView(_ webView: WKWebView,
               decidePolicyFor navigationResponse: WKNavigationResponse,
               decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {

    guard let statusCode = (navigationResponse.response as? HTTPURLResponse)?.statusCode else {
      // If there's no http status code to act on, exit and allow navigation.
      decisionHandler(.allow)
      return
    }

    if statusCode >= 400 {
      // error has occurred
    }

    decisionHandler(.allow);
  }

  //--------------------------------------------------------------------------------------------------------------------

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    progressIndicator.stopAnimation(self);
    webView.isHidden = false;
  }

  //--------------------------------------------------------------------------------------------------------------------

  /**
   * Called when the web app requests a local file name.
   */
  func webView(_ webView: WKWebView,
               runOpenPanelWith parameters: WKOpenPanelParameters,
               initiatedByFrame frame: WKFrameInfo,
               completionHandler: @escaping ([URL]?) -> Void) {
    let panel: NSOpenPanel = NSOpenPanel.init();
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection;
    panel.canChooseDirectories = parameters.allowsDirectories;
    panel.canChooseFiles = true;
    panel.resolvesAliases = true;

    // For security reasons a browser does not tell a web page the full file name of a selected file.
    // So we have to tell the app indirectly.
    panel.begin { (result) in
      if result == .OK {
        var list: [String] = [];
        for url in panel.urls {
          if (url.isFileURL) {
            list.append(url.absoluteString);
          }
        }
        self.sendAppMessage(command: "selectFile", data: list);
      }

      completionHandler(nil)
    }

  }

  //--------------------------------------------------------------------------------------------------------------------

  /**
   * Determines a random free port and launches the MySQL shell with that. If anything on that way goes wrong
   * a default port is returned.
   *
   * @returns The selected port or the default (3001, the debug port).
   */
  func launchShell(debug: Bool, token: String) -> UInt16 {
    var port: UInt16 = 3001;

    // In debug mode a server must already be running.
    if !debug {
      let socketFD = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
      if socketFD == -1 {
        print("Error creating socket: \(errno)")
      } else {
        var hints = addrinfo(
          ai_flags: AI_PASSIVE,
          ai_family: AF_INET,
          ai_socktype: SOCK_STREAM,
          ai_protocol: 0,
          ai_addrlen: 0,
          ai_canonname: nil,
          ai_addr: nil,
          ai_next: nil
        );

        var addressInfo: UnsafeMutablePointer<addrinfo>? = nil;
        var result = getaddrinfo(nil, "0", &hints, &addressInfo);
        if result == 0 {
          result = Darwin.bind(socketFD, addressInfo!.pointee.ai_addr, socklen_t(addressInfo!.pointee.ai_addrlen));
          if result == 0 {
            result = Darwin.listen(socketFD, 1);
            if result == 0 {
              var addr_in = sockaddr_in();
              addr_in.sin_len = UInt8(MemoryLayout.size(ofValue: addr_in));
              addr_in.sin_family = sa_family_t(AF_INET);

              var len = socklen_t(addr_in.sin_len);
              result = withUnsafeMutablePointer(to: &addr_in, {
                $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                  return Darwin.getsockname(socketFD, $0, &len);
                }
              });

              if result == 0 {
                port = addr_in.sin_port;
              }
            }
          }
        }

        Darwin.shutdown(socketFD, SHUT_RDWR);
        close(socketFD);
      }

      shellProcess.launchPath = "/bin/bash";
      shellProcess.arguments = [
        "-l",
        "-c",
        // Important: this must all be one argument to make it work.
        "mysqlsh --py -e 'gui.start.web_server(port=\(port), secure={}, single_instance_token=\"\(token)\")'",
      ];

      // Replace the standard output pipe with an own one, which allows us to wait for the first output of the
      // backend before we continue connecting to it.
      let outputPipe = Pipe();
      shellProcess.standardOutput = outputPipe;

      shellProcess.launch();

      // Get the first output synchronously and print it to stdout.
      let data = outputPipe.fileHandleForReading.readData(ofLength: 24);
      print(String(decoding: data, as: UTF8.self), separator: "", terminator: "");

      // Further output is captured asynchronously and also printed.
      outputPipe.fileHandleForReading.readabilityHandler = {
        pipe in
        print(String(decoding: pipe.availableData, as: UTF8.self), separator: "", terminator: "");
      }
    }

    return port;
  }

  //--------------------------------------------------------------------------------------------------------------------

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    if let text = message.body as? String {
      print(text); // Mostly used for debugging.
    } else if let dict = message.body as? [String: AnyObject] {
      if (dict["type"] as? String == "themeChanged") {
        let changeData = dict["values"] as! [String: AnyObject];
        let themeData = changeData["values"] as! [String: AnyObject];
        let colors = themeData["colors"] as! [String: AnyObject];

        if let type = changeData["type"] as? String {
          UserDefaults.standard.set(type, forKey: "themeType");
        }

        if let background = colors["editorGroupHeader.tabsBackground"] as? String {
          UserDefaults.standard.set(background, forKey: "themeBackground");
          window.backgroundColor = NSColor.init(hex: background);
        }

        if let foreground = colors["foreground"] as? String {
          UserDefaults.standard.set(foreground, forKey: "themeForeground");
        }
      }
    } else {
      print("Cannot handle message from webapp");
    }
  }

  //--------------------------------------------------------------------------------------------------------------------

}
