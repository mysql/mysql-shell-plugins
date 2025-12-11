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
using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MySQLShellWorkbench {

  //--------------------------------------------------------------------------------------------------------------------

  public enum InstallType {
    WebView2, EdgeChromiumBeta, EdgeChromiumCanary, EdgeChromiumDev, NotInstalled
  }

  //--------------------------------------------------------------------------------------------------------------------

  public class InstallInfo  {
    public InstallInfo(string version) => (Version) = (version);

    public string Version { get; }

    public InstallType InstallType => Version switch {
      var version when version.Contains("dev") => InstallType.EdgeChromiumDev,
      var version when version.Contains("beta") => InstallType.EdgeChromiumBeta,
      var version when version.Contains("canary") => InstallType.EdgeChromiumCanary,
      var version when !string.IsNullOrEmpty(version) => InstallType.WebView2, _ => InstallType.NotInstalled
    };
  }

  //--------------------------------------------------------------------------------------------------------------------

  static class Program {

    static Dictionary<string, string> ParseCommandLineArgs(string[] args)
    {
      var parsedArgs = new Dictionary<string, string>();

      var migrate = new Dictionary<string, string>();

      for (int i = 0; i < args.Length; i++)
      {
        if (args[i].StartsWith("--"))
        {
          string[] components = args[i].Split(new[] { '=' }, 2);

          string key = components[0].TrimStart('-');
          string value = "";

          if (components.Length > 1)
          {
            value = components[1];
          }
          else if (i + 1 < args.Length && !args[i + 1].StartsWith("-"))
          {
            value = args[i + 1];
            i++;
          }
          else
          {
            Console.WriteLine($"Option {key} requres a value.");
            Environment.Exit(-1);
          }

#if DEBUG
          if (key.StartsWith("migrate-"))
          {
            migrate[key.Substring(8)] = value;
          } else if (key.ToUpper().StartsWith("MIGRATION_"))
          {
            Environment.SetEnvironmentVariable(key.ToUpper(), value);
          }
          else
#endif
          {
            parsedArgs[key] = value;
          }
        }
      }

      if (0 != migrate.Count && !parsedArgs.ContainsKey("migrate")) {
        var bytes = System.Text.Encoding.UTF8.GetBytes(JsonSerializer.Serialize(migrate));
        parsedArgs["migrate"] = System.Convert.ToBase64String(bytes);
      }

      return parsedArgs;
    }

    [STAThread]
    static void Main(string[] args) {
      Logger.Write(LogEvent.Info, "Starting MSG ...");

      bool installed = CheckWebView2Installed();
      Application.EnableVisualStyles();
      Application.SetCompatibleTextRenderingDefault(false);
      Application.Run(new MySQLShellWorkbench(installed, ParseCommandLineArgs(args)));
    }

    private static string GetWebView2Version() {
      try {
        return CoreWebView2Environment.GetAvailableBrowserVersionString();
      } catch (Exception e) {
        Logger.Write(LogEvent.Info, "GetAvailableBrowserVersionString() failed: " + e.ToString());
        return "";
      }
    }

    private static bool CheckWebView2Installed() {
      Logger.Write(LogEvent.Info, @"Checking registry key: SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}");
      var readValue = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}");
      if (readValue != null) {
        Logger.Write(LogEvent.Info, string.Format(("Registry entry found: {0}"), readValue.ToString()));
        var version = GetWebView2Version();
        Logger.Write(LogEvent.Info, string.Format(("WebView2 component version: {0}"), version));
        var info = new InstallInfo(version);
        Logger.Write(LogEvent.Info, string.Format(("WebView2 install type: {0}"), info.InstallType.ToString()));
        if (info.InstallType != InstallType.NotInstalled) {
          return true;
        }
      }
      return false;
    }
  }
}
