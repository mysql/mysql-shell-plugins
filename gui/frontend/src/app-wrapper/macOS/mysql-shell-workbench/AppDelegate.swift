/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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
import Foundation;
@preconcurrency import WebKit;

@main
class AppDelegate: NSObject, AppProtocol, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate,
                   WKScriptMessageHandler {

  @IBOutlet var window: NSWindow!;
  @IBOutlet var browser: DragTargetWebView!;
  @IBOutlet var background: NSBox!;
  @IBOutlet var progressIndicator: NSProgressIndicator!;
  @IBOutlet var applicationMenu: NSMenuItem!
  @IBOutlet var preferencesMenuItem: NSMenuItem!
  @IBOutlet var aboutMenuItem: NSMenuItem!
  @IBOutlet var hideMenuItem: NSMenuItem!
  @IBOutlet var quitMenuItem: NSMenuItem!

  var shellInstance: NSRunningApplication?;
  let shellProcess = Process();
  var userContentController: WKUserContentController?;
  var isMigrationAssistant: Bool = false;
  var commandLineArguments: [String: String] = [:];
  var targetUrl: URL?;

  let endOfChain = LastResortResponder()

  //--------------------------------------------------------------------------------------------------------------------
  
  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
      return true
  }

  /// Returns the path to a bundled resource executable if found, otherwise nil.
  func findBundledBinary(named name: String, inSubdirectory subdir: String) -> String? {
    return Bundle.main.url(forResource: name, withExtension: nil, subdirectory: "\(subdir)/bin")?.path
  }


  /// Returns the path of a binary using bundled if exists, otherwise returns the binary name
  func getBinaryPath(name: String, subdir: String) -> String {
    if let bundled = findBundledBinary(named: name, inSubdirectory: subdir) {
        return bundled
    }
  
    return name;
  }

  //--------------------------------------------------------------------------------------------------------------------

  public func sendAppMessage(command: String, data: [Any]) -> Void {
    browser.evaluateJavaScript("onNativeMessage({ command: '\(command)', data: \(data) })", completionHandler: {
      (result, error) in
      if error != nil {
        Logger.write(LogEvent.error, String(error!.localizedDescription));
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
  
  @IBAction func zoomIn(sender: Any) {
    browser.magnification += 0.1
  }

  //--------------------------------------------------------------------------------------------------------------------

  @IBAction func zoomOut(sender: Any) {
      browser.magnification -= 0.1
  }

  //--------------------------------------------------------------------------------------------------------------------

  @IBAction func actualSize(sender: Any) {
      browser.magnification = 1.0
  }

  //--------------------------------------------------------------------------------------------------------------------

  func handleCommandLineArguments() {
      let args = CommandLine.arguments

      for (index, argument) in args.enumerated() {
          if index > 0 && argument.hasPrefix("--") { // Skip the executable name (args[0]) and non-option arguments
              let components = argument.components(separatedBy: "=")
              let name = String(components[0].dropFirst(2))

              if components.count > 1 {
                  commandLineArguments[name] = components.dropFirst().joined(separator: "=")
              } else if index + 1 < args.count && !args[index + 1].hasPrefix("--") {
                  commandLineArguments[name] = args[index + 1]
              } else {
                Logger.write(LogEvent.error, "Error: --\(name) argument requires a value");
                exit(-1);
              }
          }
      }
    
      self.isMigrationAssistant = self.commandLineArguments.keys.contains("migrate");
  }

  //--------------------------------------------------------------------------------------------------------------------

  func storedWindowFrame() -> NSRect? {
      guard let frameDict = UserDefaults.standard.dictionary(forKey: "windowFrame") as? [String: CGFloat],
            let x = frameDict["x"],
            let y = frameDict["y"],
            let width = frameDict["width"],
            let height = frameDict["height"] else { return nil }
      return NSRect(x: x, y: y, width: width, height: height)
  }

  //--------------------------------------------------------------------------------------------------------------------

  func defaultWindowFrame() -> NSRect {
      let defaultWidth: CGFloat = 1024
      let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: defaultWidth, height: 1200)
      let defaultHeight = min(1200, screenFrame.height)
      let x = (screenFrame.width - defaultWidth) / 2 + screenFrame.origin.x
      let y = (screenFrame.height - defaultHeight) / 2 + screenFrame.origin.y
      return NSRect(x: x, y: y, width: defaultWidth, height: defaultHeight)
  }

  //--------------------------------------------------------------------------------------------------------------------

  func adjustFrameToPreviousScreen(_ frame: NSRect) -> NSRect? {
      guard let screenID = UserDefaults.standard.object(forKey: "lastScreenID") as? NSNumber,
            let desiredScreen = NSScreen.screens.first(where: { screen in
                let sid = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber
                return sid == screenID
            }) else { return nil }

      // Check if the stored frame is within the bounds of the desired screen
      if desiredScreen.visibleFrame.contains(frame) {
          return frame
      } else {
          // Adjust the frame to be within the bounds of the desired screen
          var adjustedFrame = frame
          adjustedFrame.origin.x = max(desiredScreen.frame.minX, min(adjustedFrame.origin.x, desiredScreen.frame.maxX - adjustedFrame.width))
          adjustedFrame.origin.y = max(desiredScreen.frame.minY, min(adjustedFrame.origin.y, desiredScreen.frame.maxY - adjustedFrame.height))
          return adjustedFrame
      }
  }


  //--------------------------------------------------------------------------------------------------------------------

  func determineInitialWindowFrame() -> NSRect {
    if let storedFrame = storedWindowFrame() {
      if let adjustedFrame = adjustFrameToPreviousScreen(storedFrame) {
        return adjustedFrame
      }
    }

    // Returns the default window frame
    return defaultWindowFrame()
  }

  //--------------------------------------------------------------------------------------------------------------------

  func applicationWillFinishLaunching(_ notification: Notification) {
    // Make sure we come up with the right app colors (from the user's theme).
    if let colorValue = UserDefaults.standard.string(forKey: "themeBackground") {
      window.backgroundColor = NSColor.init(hex: colorValue);
      background.fillColor = NSColor.init(hex: colorValue);
    }

    window.setFrame(determineInitialWindowFrame(), display: true)

    // Restore the browser magnification
    if let magnification = UserDefaults.standard.object(forKey: "browserMagnification") as? CGFloat {
        browser.magnification = magnification
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
    var debug = false;

    browser.appDelegate = self;
    var uuid = UUID().uuidString;
    if NSEvent.modifierFlags.contains(NSEvent.ModifierFlags.option) {
      debug = true;
      uuid = "236d84bc-5965-11eb-b3f9-003ee1ce36e8";
    }
    
    handleCommandLineArguments()
    
    if self.isMigrationAssistant {
      self.applicationMenu.title = "MySQL Heatwave Migration Assistant";
      self.aboutMenuItem.title = "About MySQL Heatwave Migration Assistant";
      self.hideMenuItem.title = "Hide MySQL Heatwave Migration Assistant";
      self.quitMenuItem.title = "Quit MySQL Heatwave Migration Assistant";
      self.preferencesMenuItem.isHidden = true;
    }
    
    if let overrideUrl = ProcessInfo.processInfo.environment["MYSQLSHWB_OVERRIDE_URL"] {
        let link = URL(string: overrideUrl)!
        self.finishAppLaunchAndLoad(link: link, uuid: uuid)
    } else {
        launchShell(debug: debug, token: uuid) { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let port):
                var components = URLComponents(string: "https://localhost:\(port)/?token=\(uuid)")!
                if self.isMigrationAssistant {
                    components.queryItems?.append(URLQueryItem(name: "subApp", value: "migration"))
                }
                let link = components.url!
                self.finishAppLaunchAndLoad(link: link, uuid: uuid)
            case .failure(let error):
                switch error {
                case .message(let msg):
                    self.showErrorAndExit(message: msg)
                }
            }
        }
    }

    if let window = self.window {
      var responder = window
      while let next = responder.nextResponder {
        responder = next as! NSWindow
      }
      responder.nextResponder = endOfChain
    }
  }

  //--------------------------------------------------------------------------------------------------------------------

  func applicationWillTerminate(_ aNotification: Notification) {
    // Save the window's frame
    let windowFrame = window.frame
    let frameDict: [String: CGFloat] = [
        "x": windowFrame.origin.x,
        "y": windowFrame.origin.y,
        "width": windowFrame.size.width,
        "height": windowFrame.size.height
    ]
    UserDefaults.standard.set(frameDict, forKey: "windowFrame")
    
    // Save the window's screen
    if let screen = window.screen {
      let screenID = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber;
      UserDefaults.standard.set(screenID, forKey: "lastScreenID");
    }
    
    // Save the browser magnification
    UserDefaults.standard.set(browser.magnification, forKey: "browserMagnification")
        
    if (shellProcess.isRunning) {
      shellProcess.terminate();
    }
  }

  //--------------------------------------------------------------------------------------------------------------------

  internal func webView(_ webView: WKWebView,
                        didFailProvisionalNavigation navigation: WKNavigation!,
                        withError error: Error) {
    Logger.write(LogEvent.error, error.localizedDescription)
  }

  //--------------------------------------------------------------------------------------------------------------------

  /**
   * Needed only during development to accept a self signed certificate for localhost.
   */
  func webView(_ webView: WKWebView,
              didReceive challenge: URLAuthenticationChallenge,
              completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {

      Logger.write(LogEvent.debug, "Received authentication challenge: \(challenge.protectionSpace.authenticationMethod)")
      
      // NEW: Only proceed with self-signed acceptance if this challenge matches the target URL's host and port
      guard let expected = targetUrl,
            challenge.protectionSpace.host == expected.host,
            challenge.protectionSpace.port == expected.port else {  // Default to 443 if no port in expected URL
          Logger.write(LogEvent.debug, "Challenge for unexpected host/port: \(challenge.protectionSpace.host):\(challenge.protectionSpace.port). Using default handling.")
          completionHandler(.performDefaultHandling, nil)
          return
      }

      // Ensure this is a server trust challenge
      guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
            let serverTrust = challenge.protectionSpace.serverTrust else {
          Logger.write(LogEvent.debug, "Not a server trust challenge or no trust object available.")
          completionHandler(.cancelAuthenticationChallenge, nil)
          return
      }
      
      // Step 1: Evaluate the trust initially
      var evalError: CFError?  // Out-parameter for error details
      let initialTrustValid = SecTrustEvaluateWithError(serverTrust, &evalError)
      
      // Step 2: If evaluation succeeds (e.g., cert is already registered/trusted), proceed
      if initialTrustValid {
          Logger.write(LogEvent.debug, "Initial trust evaluation succeeded.")
          completionHandler(.useCredential, URLCredential(trust: serverTrust))
          return
      } else if let error = evalError {
          Logger.write(LogEvent.debug, "Initial trust evaluation failed: \(error)")
      }
      
      // Step 3: Evaluation failed (e.g., unknown CA) – create and set exceptions to ignore errors
      if let exceptions = SecTrustCopyExceptions(serverTrust) {
          SecTrustSetExceptions(serverTrust, exceptions)
          
          // Step 4: Re-evaluate with exceptions applied
          var reevalError: CFError?
          let reevalTrustValid = SecTrustEvaluateWithError(serverTrust, &reevalError)
          
          if reevalTrustValid {
              Logger.write(LogEvent.debug, "Re-evaluation with exceptions succeeded.")
              completionHandler(.useCredential, URLCredential(trust: serverTrust))
              return
          } else if let error = reevalError {
              Logger.write(LogEvent.debug, "Re-evaluation failed: \(error)")
          }
      } else {
          Logger.write(LogEvent.info, "Failed to copy trust exceptions.")
      }
      
      // If all else fails, cancel the challenge (app won't load)
      Logger.write(LogEvent.debug, "Trust challenge could not be resolved – canceling.")
      completionHandler(.cancelAuthenticationChallenge, nil)
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
    progressIndicator.isHidden = true;
    webView.isHidden = false;

    // Restore the browser magnification if not already set
    if browser.magnification == 1.0 {
        if let magnification = UserDefaults.standard.object(forKey: "browserMagnification") as? CGFloat {
            browser.magnification = magnification
        }
    }
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

  
  func showErrorAndExit(message: String) {
      let alert = NSAlert()
      alert.messageText = "Error"
      alert.informativeText = message
      alert.alertStyle = .critical
      alert.addButton(withTitle: "Quit")

      // This will block until the user dismisses the alert
      alert.runModal()

      // Exit application
      NSApplication.shared.terminate(nil)
  }

  //--------------------------------------------------------------------------------------------------------------------

  /**
   * Determines a random free port and launches the MySQL shell with that. If anything on that way goes wrong
   * a default port is returned.
   *
   * @returns The selected port or the default (3001, the debug port).
   */
  enum ShellLaunchError: Error {
      case message(String)
  }

  func isLocalPortOpen(port: UInt16, timeout: TimeInterval = 0.5) -> Bool {
    let sock = socket(AF_INET, SOCK_STREAM, 0)
    if sock < 0 { return false }
    defer { close(sock) }
    
    var addr = sockaddr_in()
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_port = port.bigEndian // network order
    addr.sin_addr.s_addr = inet_addr("127.0.0.1")
    let addrLen = socklen_t(MemoryLayout<sockaddr_in>.size)
    
    // Set socket non-blocking, then set timeout on connect
    var tv = timeval(tv_sec: Int(timeout), tv_usec: 0)
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, socklen_t(MemoryLayout<timeval>.size))
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &tv, socklen_t(MemoryLayout<timeval>.size))
    
    let result = withUnsafePointer(to: &addr) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            Darwin.connect(sock, $0, addrLen)
        }
    }
    return result == 0
}

  
  func launchShell(debug: Bool, token: String, completion: @escaping (Result<UInt16, ShellLaunchError>) -> Void) {
      DispatchQueue.global(qos: .userInitiated).async { [self] in
          var port: UInt16 = 3001
          // ... socket/port setup here ...

          if debug {
              DispatchQueue.main.async {
                  completion(.success(port))
              }
              return
          }
          
          // process config
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

      let shellPath = getBinaryPath(name: "mysqlsh", subdir: "shell");

      shellProcess.launchPath = "/bin/bash";
      shellProcess.arguments = [
        "-l",
        "-c",
        // Important: this must all be one argument to make it work.
        "\"\(shellPath)\" --py -e 'gui.start.web_server(port=\(port), secure={\"tempCerts\": True}, single_instance_token=\"\(token)\")'",
      ];

      self.shellProcess.environment = [
          "MYSQLSH_USER_CONFIG_HOME": Common.getUserConfigPath().path
      ];

      let outputPipe = Pipe();
      self.shellProcess.standardOutput = outputPipe;
      let errorPipe = Pipe();
      self.shellProcess.standardError = errorPipe;
      
          
      // Poll port & monitor errors until either event or timeout
      let maxWait: TimeInterval = 15;
      let pollDelay: useconds_t = 100_000;
      let deadline = Date().addingTimeInterval(maxWait);
      var portIsOpen = false;
      var errorStartingShell: Bool = false;

      outputPipe.fileHandleForReading.readabilityHandler = { pipe in
          let data = pipe.availableData
          guard !data.isEmpty else { return }
          if let str = String(data: data, encoding: .utf8) {
              Logger.write(.info, str)
          }
      }
      errorPipe.fileHandleForReading.readabilityHandler = { pipe in
          let data = pipe.availableData
          guard !data.isEmpty else { return }
          if let str = String(data: data, encoding: .utf8) {
              Logger.write(.error, str);
          }
          //errorStartingShell = true;
      }
      self.shellProcess.launch()
      
      repeat {
          if isLocalPortOpen(port: port) {
              portIsOpen = true
              break
          }
          if errorStartingShell {
              break
          }
          if !self.shellProcess.isRunning {
              if !errorStartingShell {
                  errorStartingShell = true;
              }
              break
          }
          usleep(pollDelay)
      } while Date() < deadline;

        outputPipe.fileHandleForReading.readabilityHandler = nil;
        errorPipe.fileHandleForReading.readabilityHandler = nil
        
        DispatchQueue.main.async {
            if portIsOpen {
                completion(.success(port))
            } else if errorStartingShell {
                completion(.failure(.message("An error occurred launching the shell backend, see log for more details: \(Logger.getLogPath())")))
            } else {
                completion(.failure(.message("Timeout waiting for shell process to start.")))
            }
        }
    }
  }


  func finishAppLaunchAndLoad(link: URL, uuid: String) {
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

      targetUrl = link;
      let request = URLRequest(url: link);
      browser.load(request);
  }

  //--------------------------------------------------------------------------------------------------------------------

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    if let text = message.body as? String {
      Logger.write(LogEvent.debug, text); // Mostly used for debugging.
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
      } else if (dict["command"] as? String == "getCommandLineArguments") {
        let jsonData = try? JSONSerialization.data(withJSONObject: commandLineArguments, options: [])
        if let jsonString = String(data: jsonData!, encoding: .utf8) {
          sendAppMessage(command: "setCommandLineArguments", data: [jsonString])
        } else {
          sendAppMessage(command: "setCommandLineArguments", data: [""])
        }
      } else if (dict["command"] as? String == "getApplicationData") {
          let logPath = Common.getUserConfigPath("mysqlsh.log").path
          let projectsPath = Common.getUserConfigPath("plugin_data", "migration_plugin").path
          
          let data: [String: String] = ["logPath": logPath, "projectsPath": projectsPath]
          do {
              let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
              if let jsonString = String(data: jsonData, encoding: .utf8) {
                  sendAppMessage(command: "setApplicationData", data: [jsonString])
              } else {
                  sendAppMessage(command: "setApplicationData", data: [""])
              }
          } catch {
              Logger.write(LogEvent.error, "Error serializing data: \(error.localizedDescription)")
              sendAppMessage(command: "setApplicationPaths", data: [""])
          }
      } else if (dict["command"] as? String == "closeInstance") {
        window.close();
      }
    } else {
      Logger.write(LogEvent.debug, "Cannot handle message from webapp");
    }
  }

  //--------------------------------------------------------------------------------------------------------------------

}

// A responder instance to be used as the last responder to swallow any unhanded keystrokes.
// This avoids the annoying beep, for example when pressing and holding the space key in a diagram.
class LastResortResponder: NSResponder {
  override func keyDown(with event: NSEvent) {
    // Ignore the event, instead of bubbling it up, which would trigger the beep.
  }
}
