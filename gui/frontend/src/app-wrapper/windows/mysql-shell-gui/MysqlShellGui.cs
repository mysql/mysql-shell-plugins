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
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Windows.Forms;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.IO;

namespace MysqlShellGui {
  public partial class MysqlShellGui : Form {

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

    #endregion

    //--------------------------------------------------------------------------------------------------------------------

    public MysqlShellGui(bool installed) {
      browserMode = !installed;
#if !DEBUG
      Guid g = Guid.NewGuid();
      Token = g.ToString();
#endif
      Logger.Write(LogEvent.Info, "Starting shell ...");
      launchShell();
      Logger.Write(LogEvent.Info, "Initializing components ...");
      if (!browserMode) {
        InitializeComponent();
        InitializeWebView2Async();
      }
    }

    //--------------------------------------------------------------------------------------------------------------------

    private async void InitializeWebView2Async()
    {
      // Define a unique user data folder for the WebView2 instance.
      // This is important to prevent conflicts, especially if you have multiple WebView2 controls
      // or are debugging multiple instances.
#if DEBUG
      string userDataFolder = Path.Combine(Path.GetTempPath(), "MySQLShellWorkbench");

      // Create the WebView2 environment with the remote debugging port argument
      var env = await CoreWebView2Environment.CreateAsync(
          browserExecutableFolder: null, // Use default Edge/Chromium installation
          userDataFolder: userDataFolder,
          options: new CoreWebView2EnvironmentOptions
          {
            // This is the key argument to enable remote debugging.
            // You can choose any available port, 9222 is a common default.
            AdditionalBrowserArguments = "--remote-debugging-port=9222"
          });

      // Ensure the WebView2 control is initialized with the configured environment
      await this.webView.EnsureCoreWebView2Async(env);
#endif

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

    private void launchShell() {
      Url = "";
      if (!browserMode) {
        int port = START_PORT;
#if !DEBUG
        port = nextFreePort(port);
        Logger.Write(LogEvent.Info, string.Format("Using port number: {0}", port));
        mysqlshell = new Process();
        mysqlshell.StartInfo.FileName = "mysqlsh";
        mysqlshell.StartInfo.RedirectStandardOutput = true;
        mysqlshell.StartInfo.RedirectStandardError = true;
        mysqlshell.StartInfo.UseShellExecute = false;
        mysqlshell.StartInfo.CreateNoWindow = true;
        mysqlshell.StartInfo.Arguments = string.Format("--py -e \"gui.start.web_server(port = {0}, single_instance_token = '{1}')\"", port, Token);
        mysqlshell.ErrorDataReceived += new DataReceivedEventHandler((sender, e) => {
          Logger.Write(LogEvent.Error, e.Data);
        });
        mysqlshell.OutputDataReceived += new DataReceivedEventHandler((sender, e) => {
          Logger.Write(LogEvent.Error, e.Data);
        });
        try {
          bool started = mysqlshell.Start();
          if(started)
          {
            Logger.Write(LogEvent.Info, "Shell started");
          }
        } catch (Exception e) {
          Logger.Write(LogEvent.Error, e.Message);
        }
#endif
        // TODO (rennox): This should be fixed to use secured connection, which requires
        // logic for certificate installation.
        Url = string.Format("http://localhost:{0}?token={1}", port, Token);
      } else {
        mysqlshell = new Process();
        mysqlshell.StartInfo.FileName = "mysqlsh";
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
    }

    //--------------------------------------------------------------------------------------------------------------------

    private void WebView2Control_CoreWebView2InitializationCompleted(object sender, CoreWebView2InitializationCompletedEventArgs e) {
      Logger.Write(LogEvent.Info, $"CoreWebView2InitializationCompleted initialization started");
      if (!e.IsSuccess) {
        Logger.Write(LogEvent.Error, $"WebView2 creation failed with exception = {e.InitializationException}");
        Logger.Write(LogEvent.Error, "CoreWebView2InitializationCompleted failed");
        return;
      }

      this.webView.CoreWebView2.Settings.IsScriptEnabled = true;
      this.webView.CoreWebView2.Settings.IsWebMessageEnabled = true;
      this.webView.Refresh();
      this.webView.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.Image);
      this.webView.Source = new System.Uri(Url, System.UriKind.Absolute);
      Logger.Write(LogEvent.Error, "CoreWebView2InitializationCompleted succeeded");
    }

    //--------------------------------------------------------------------------------------------------------------------

    #endregion
  }
}
