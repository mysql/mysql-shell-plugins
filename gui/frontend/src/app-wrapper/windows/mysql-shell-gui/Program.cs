/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MysqlShellGui {

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

    [STAThread]
    static void Main() {
      Logger.Write(LogEvent.Info, "Starting MSG ...");
      bool installed = CheckWebView2Installed();
      Application.EnableVisualStyles();
      Application.SetCompatibleTextRenderingDefault(false);
      Application.Run(new MysqlShellGui(installed));
    }

    private static string GetWebView2Version() {
      try {
        return CoreWebView2Environment.GetAvailableBrowserVersionString();
      } catch (Exception) { return ""; }
    }

    private static bool CheckWebView2Installed() {
      Logger.Write(LogEvent.Info, @"Checking registry key: SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}");
      var readValue = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}");
      if (readValue != null) {
        Logger.Write(LogEvent.Info, string.Format(("Registry entry foud: {0}"), readValue.ToString()));
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
