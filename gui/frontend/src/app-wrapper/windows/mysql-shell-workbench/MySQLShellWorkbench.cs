/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Windows.Forms;

namespace MySQLShellWorkbench {
  public partial class MySQLShellWorkbench : Form {

    #region members

    protected string Url { get; set; }

#if DEBUG
    public const int START_PORT = 3001;
    private string Token = "1234";
#else
    public const int START_PORT = 0;
    private string Token = "236d84bc-5965-11eb-b3f9-003ee1ce36e8";
#endif
    private Process mysqlshell = null;

    private bool browserMode = false;
    private Dictionary<string, string> commandLineArgs;
    private bool isMigrationAssistant = false;

    #endregion

    //--------------------------------------------------------------------------------------------------------------------

    public MySQLShellWorkbench(bool installed, Dictionary<string, string> commandLineArgs) {
      browserMode = !installed;
#if !DEBUG
      Guid g = Guid.NewGuid();
      Token = g.ToString();
#endif
      this.commandLineArgs = commandLineArgs;
      this.isMigrationAssistant = this.commandLineArgs.ContainsKey("migrate");
      Logger.Write(LogEvent.Info, "Starting shell ...");
      Logger.Write(LogEvent.Info, "Initializing components ...");
      if (!browserMode) {
        InitializeComponent();
      }
    }

    //--------------------------------------------------------------------------------------------------------------------

    private async void InitializeWebView2Async()
    {
      // Define a unique user data folder for the WebView2 instance.
      // This is important to prevent conflicts, especially if you have multiple WebView2 controls
      // or are debugging multiple instances.
      string userDataFolder = Path.Combine(Path.GetTempPath(), "MySQLShellWorkbench");

      var env = await CoreWebView2Environment.CreateAsync(
          browserExecutableFolder: null, // Use default Edge/Chromium installation
          userDataFolder: userDataFolder
#if DEBUG
          , options: new CoreWebView2EnvironmentOptions
          {
            // Create the WebView2 environment with the remote debugging port argument.
            // This is the key argument to enable remote debugging.
            // You can choose any available port, 9222 is a common default.
            AdditionalBrowserArguments = "--remote-debugging-port=9222"
          }
#endif
       );

      // Ensure the WebView2 control is initialized with the configured environment
      await this.webView.EnsureCoreWebView2Async(env);

      // Navigate to your desired URL (e.g., your web content)
      this.webView.Source = new System.Uri(Url, System.UriKind.Absolute);

      // Optional: You can open the DevTools window programmatically for initial inspection
      // this.webView.CoreWebView2.OpenDevToolsWindow();
    }

    //--------------------------------------------------------------------------------------------------------------------

    public void sendAppMessage(string command, object data) {
      var callData = new JSCallStruct { Command = command, Data = data };
      var json = JsonSerializer.Serialize(callData);
      this.webView.ExecuteScriptAsync($"window.onNativeMessage({json})");
    }

    //--------------------------------------------------------------------------------------------------------------------

    private int nextFreePort(int port = START_PORT) {
      port = (port > 0) ? port : new Random().Next(START_PORT + 1, 65535);
      IPGlobalProperties properties = IPGlobalProperties.GetIPGlobalProperties();
      IPEndPoint[] listeners = properties.GetActiveTcpListeners();
      int[] openPorts = listeners.Select(item => item.Port).ToArray<int>();
      bool free = openPorts.All(openPort => openPort != port);
      while (!free) {
        port += 1;
        free = openPorts.All(openPort => openPort != port);
      }
      return port;
    }

    //--------------------------------------------------------------------------------------------------------------------

    protected override void Dispose(bool disposing) {
      if (mysqlshell != null) {
        try {
          mysqlshell.Refresh();
          if (!mysqlshell.HasExited) {
            mysqlshell.Kill();
          }
        } catch (Exception e) {
          Logger.Write(LogEvent.Error, e.Message);
        }
      }
      if (disposing && (components != null)) {
        components.Dispose();
      }
      base.Dispose(disposing);
    }

    //--------------------------------------------------------------------------------------------------------------------

    private string findBundledBinary(string name, string inSubdirectory)
    {
      string baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
      string filePath = Path.Combine(baseDirectory, inSubdirectory, "bin", name);
      return File.Exists(filePath) ? filePath : name;
    }

    //--------------------------------------------------------------------------------------------------------------------

    private void launchShell() {
      Url = "";

      Environment.SetEnvironmentVariable("MYSQLSH_USER_CONFIG_HOME", Common.GetUserConfigPath());

      if (!browserMode) {
        int port = START_PORT;

#if DEBUG
        string autoWebServer;

        if (!this.commandLineArgs.TryGetValue("auto-web-server", out autoWebServer)) {
          autoWebServer = "yes";
        }

        if ("yes" == autoWebServer)
#endif
        {
          if (Environment.GetEnvironmentVariable("PYTHONPATH") != null)
          {
            Environment.SetEnvironmentVariable("PYTHONPATH", null);
          }
          if (Environment.GetEnvironmentVariable("PYTHONHOME") != null)
          {
            Environment.SetEnvironmentVariable("PYTHONHOME", null);
          }

          bool errorLaunchingShell = false;

          port = nextFreePort(port);
          Logger.Write(LogEvent.Info, string.Format("Using port number: {0}", port));
          mysqlshell = new Process();
          mysqlshell.StartInfo.FileName = findBundledBinary("mysqlsh.exe", "shell");
          mysqlshell.StartInfo.RedirectStandardOutput = true;
          mysqlshell.StartInfo.RedirectStandardError = true;
          mysqlshell.StartInfo.UseShellExecute = false;
          mysqlshell.StartInfo.CreateNoWindow = true;
          mysqlshell.StartInfo.Arguments = string.Format("--log-level=debug --py -e \"gui.start.web_server(port = {0}, secure = {{'tempCerts': True}}, single_instance_token = '{1}')\"", port, Token);
          mysqlshell.ErrorDataReceived += new DataReceivedEventHandler((sender, e) => {
            if (e.Data != null)
            {
              Logger.Write(LogEvent.Error, e.Data);
              errorLaunchingShell = true;
            }
          });
          mysqlshell.OutputDataReceived += new DataReceivedEventHandler((sender, e) => {
            if (e.Data != null)
            {
              Logger.Write(LogEvent.Error, e.Data);
            }
          });

          try {
              bool started = mysqlshell.Start();
              if (started && !errorLaunchingShell) {
                  Logger.Write(LogEvent.Info, "Shell started, waiting for readiness...");
                  mysqlshell.BeginOutputReadLine();  // Start async reading
                  mysqlshell.BeginErrorReadLine();

                  // Poll for port to be open (server ready)
                  DateTime startTime = DateTime.Now;
                  while (!IsPortOpen("localhost", port) && (DateTime.Now - startTime).TotalSeconds < 30 && !errorLaunchingShell) {
                      Thread.Sleep(500);  // Check every 500ms
                  }

                  if (errorLaunchingShell || !IsPortOpen("localhost", port)) {
                      Logger.Write(LogEvent.Error, "Server did not start within timeout.");
                      errorLaunchingShell = true;
                  } else {
                      Logger.Write(LogEvent.Info, "Server is ready.");
                  }
                }
          } catch (Exception e) {
              Logger.Write(LogEvent.Error, e.Message);
              errorLaunchingShell = true;
          }

          if (errorLaunchingShell)
          {
            MessageBox.Show(string.Format("An error occurred launching the shell backend, see log for more details: {0}",
              Logger.GetLogPath()),
              "Error",
              MessageBoxButtons.OK,
              MessageBoxIcon.Error);
            Environment.Exit(1);
          }
        }

        // NOTE: The / before the query part is used because that's how the RequestUri 
        // is reported by the webview events, so we can validate the target URI is the
        // same as the URI for the migration assistant and enable self signed certs
        Url = string.Format("https://localhost:{0}/?token={1}", port, Token);
        if (this.isMigrationAssistant) {
          Url += "&subApp=migration";
        }
      } else {
        mysqlshell = new Process();
        mysqlshell.StartInfo.FileName = findBundledBinary("mysqlsh.exe", "shell"); ;
        mysqlshell.StartInfo.RedirectStandardOutput = true;
        mysqlshell.StartInfo.RedirectStandardError = true;
        mysqlshell.StartInfo.UseShellExecute = false;
        mysqlshell.StartInfo.CreateNoWindow = true;
        mysqlshell.StartInfo.Arguments = "--js -e \"gui.start.nativeUi()\"";
        mysqlshell.ErrorDataReceived += new DataReceivedEventHandler((sender, e) => {
          Logger.Write(LogEvent.Error, e.Data);
        });
        mysqlshell.OutputDataReceived += new DataReceivedEventHandler((sender, e) => {
          Logger.Write(LogEvent.Error, e.Data);
        });
        try
        {
          bool started = mysqlshell.Start();
          if (started) {
            Logger.Write(LogEvent.Info, "Shell started in special edge mode...");
          }
          mysqlshell.BeginErrorReadLine();
          string output = mysqlshell.StandardOutput.ReadToEnd();
          Logger.Write(LogEvent.Info, output);
          mysqlshell.WaitForExit();
          System.Environment.Exit(0);
        }
        catch (Exception e)
        {
          Logger.Write(LogEvent.Error, e.Message);
        }

      }
    }

// Helper method to check if port is open
    private bool IsPortOpen(string host, int port) {
        try {
            using (var client = new TcpClient()) {
                var result = client.BeginConnect(host, port, null, null);
                var success = result.AsyncWaitHandle.WaitOne(1000);  // 1-second timeout for connect attempt
                client.EndConnect(result);
                return success;
            }
        } catch {
            return false;
        }
    }    

    #region Event Handlers

    //--------------------------------------------------------------------------------------------------------------------

    private void preferencesToolStripMenuItem_Click(object sender, EventArgs e) {
      sendAppMessage("showPreferences", "");
    }

    //--------------------------------------------------------------------------------------------------------------------

    private void aboutToolStripMenuItem_Click(object sender, EventArgs e) {
      sendAppMessage("showAbout", "");
    }

    //--------------------------------------------------------------------------------------------------------------------

    private void WebView2Control_NavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e) {
      Logger.Write(LogEvent.Info, "NavigationStarting");
    }

    //--------------------------------------------------------------------------------------------------------------------

    private void WebView2Control_NavigationCompleted(object sender, EventArgs e) {
      Logger.Write(LogEvent.Info, "NavigationCompleted");
    }

    //--------------------------------------------------------------------------------------------------------------------

    private void WebView_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
      var json = e.WebMessageAsJson;  // always a JSON string
      if (string.IsNullOrEmpty(json))
        return;

      // parse json and process massagess goes here
      // ....
      try
      {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.TryGetProperty("command", out var property))
        {
          if (property.ValueKind == JsonValueKind.String) {
            var command = property.GetString();

            switch (command)
            {
              case "getCommandLineArguments":
                var jsonDoc = JsonSerializer.Serialize(commandLineArgs, new JsonSerializerOptions { WriteIndented = false });
                sendAppMessage("setCommandLineArguments", jsonDoc);
                break;
              case "getApplicationData":
                Dictionary<string, string> paths = new Dictionary<string, string>();
                paths.Add("logPath", Common.GetUserConfigPath(new List<string> { "mysqlsh.log" }));
                paths.Add("projectsPath", Common.GetUserConfigPath(new List<string> { "plugin_data", "migration_plugin" }));
                var jsonPaths = JsonSerializer.Serialize(paths, new JsonSerializerOptions { WriteIndented = false });
                sendAppMessage("setApplicationData", jsonPaths);
                break;

              case "closeInstance":
                Application.Exit();
                break;
            }            
          }
        }
        else
        {
          Console.WriteLine("'specificProperty' not found");
        }
      }
      catch (JsonException ex)
      {
        Console.WriteLine($"Error parsing JSON: {ex.Message}");
      }
    }

    //--------------------------------------------------------------------------------------------------------------------

    private void WebView2Control_CoreWebView2InitializationCompleted(object sender, CoreWebView2InitializationCompletedEventArgs e) {
      Logger.Write(LogEvent.Info, $"CoreWebView2InitializationCompleted initialization started");
      if (!e.IsSuccess) {
        Logger.Write(LogEvent.Error, $"WebView2 creation failed with exception = {e.InitializationException}");
        Logger.Write(LogEvent.Error, "CoreWebView2InitializationCompleted failed");
        return;
      }

      // Subscribe to the ServerCertificateErrorDetected event
      this.webView.CoreWebView2.ServerCertificateErrorDetected += (sender, args) =>
      {
        // Handle certificate validation here
        if (args.ErrorStatus == CoreWebView2WebErrorStatus.CertificateIsInvalid && args.RequestUri == Url)
        {
          args.Action = CoreWebView2ServerCertificateErrorAction.AlwaysAllow;
        } else
        {
          args.Action = CoreWebView2ServerCertificateErrorAction.Default;
        }
      };

      this.webView.CoreWebView2.Settings.IsScriptEnabled = true;
      this.webView.CoreWebView2.Settings.IsWebMessageEnabled = true;
      this.webView.Refresh();
      this.webView.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.Image);
      this.webView.Source = new System.Uri(Url, System.UriKind.Absolute);
      Logger.Write(LogEvent.Success, "CoreWebView2InitializationCompleted succeeded");
    }

    //--------------------------------------------------------------------------------------------------------------------

    #endregion

    private void MySQLShellWorkbench_Load(object sender, EventArgs e)
    {
      if (Properties.Settings.Default.WindowWidth > 0 && Properties.Settings.Default.WindowHeight > 0)
      {
        Rectangle screenBounds = Screen.GetWorkingArea(this);
        if (Properties.Settings.Default.WindowLeft + Properties.Settings.Default.WindowWidth > screenBounds.Left &&
            Properties.Settings.Default.WindowLeft < screenBounds.Right &&
            Properties.Settings.Default.WindowTop + Properties.Settings.Default.WindowHeight > screenBounds.Top &&
            Properties.Settings.Default.WindowTop < screenBounds.Bottom)
        {
          this.Left = Properties.Settings.Default.WindowLeft;
          this.Top = Properties.Settings.Default.WindowTop;
          this.Width = Properties.Settings.Default.WindowWidth;
          this.Height = Properties.Settings.Default.WindowHeight;
        }
        else
        {
          // If the saved position is not within the bounds of the current screen, use the default size and center the window
          this.Width = 1024;
          this.Height = Math.Min(1200, screenBounds.Height);
          this.Left = (screenBounds.Width - this.Width) / 2 + screenBounds.Left;
          this.Top = (screenBounds.Height - this.Height) / 2 + screenBounds.Top;
        }
      }
      else
      {
        // Default size and position if no saved settings are found
        Rectangle screenBounds = Screen.GetWorkingArea(this);
        this.Width = 1024;
        this.Height = Math.Min(1200, screenBounds.Height);
        this.Left = (screenBounds.Width - this.Width) / 2 + screenBounds.Left;
        this.Top = (screenBounds.Height - this.Height) / 2 + screenBounds.Top;
      }
    }
    private void MySQLShellWorkbench_FormClosing(object sender, FormClosingEventArgs e)
    {
      Properties.Settings.Default.WindowLeft = this.Left;
      Properties.Settings.Default.WindowTop = this.Top;
      Properties.Settings.Default.WindowWidth = this.Width;
      Properties.Settings.Default.WindowHeight = this.Height;
      Properties.Settings.Default.Save();
    }

    private void MySQLShellWorkbench_Shown(object sender, EventArgs e)
    {
      if (this.isMigrationAssistant) {
        this.Name = "MySQLHeatWaveMigrationAssistant";
        this.Text = "MySQL HeatWave Migration Assistant";
        this.preferencesToolStripMenuItem.Visible = false;
      }

      launchShell();
      if (!browserMode)
      {
        InitializeWebView2Async();
      }
    }
  }
}
