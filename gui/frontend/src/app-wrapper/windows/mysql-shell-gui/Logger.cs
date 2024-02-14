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

using System;
using System.IO;
using System.Linq;

namespace MysqlShellGui {
  enum LogEvent {
    Info = 0,
    Success = 1,
    Warning = 2,
    Error = 3
  }

  internal static class Logger {
    private static readonly string TimeStamp = DateTime.Now.ToLocalTime().ToString("ddMMyyyy");
    private static readonly string LogPath = AppDomain.CurrentDomain.BaseDirectory + "logs";

    internal static void Write(LogEvent Level, string Message) {
      string Event = string.Empty;

      switch (Level) {
        case LogEvent.Info:
          Event = "INFO";
          break;
        case LogEvent.Success:
          Event = "SUCCESS";
          break;
        case LogEvent.Warning:
          Event = "WARNING";
          break;
        case LogEvent.Error:
          Event = "ERROR";
          break;
      }

      if (!Directory.Exists(LogPath))
        Directory.CreateDirectory(LogPath);
      File.AppendAllText(LogPath + @"\msglog_" + TimeStamp + ".log", string.Format("[{0}] => {1}: {2}\n", DateTime.Now.ToString("HH:mm:ss"), Event, Message));
    }
  }
}
