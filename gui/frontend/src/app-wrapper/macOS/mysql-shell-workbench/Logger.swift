/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import Foundation

enum LogEvent: String {
    case info = "INFO"
    case warning = "WARNING"
    case error = "ERROR"
    case debug = "DEBUG"
}

class Logger {
    static let shared = Logger() // Singleton pattern

    private static let logQueue = DispatchQueue(label: "MySQLShellWorkbench.LoggerQueue")

    private static var logFileURL: URL {
        // Place the log file in user config path as in Common.getUserConfigPath()
        return Common.getUserConfigPath().appendingPathComponent("mysqlsh-wb.log")
    }

    private init() {}

    static func getLogPath() -> String {
        return logFileURL.path
    }

    static func write(_ level: LogEvent, _ message: String) {
        let now = Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        let timeStr = formatter.string(from: now)
        let logLine = "[\(timeStr)] => \(level.rawValue): \(message)\n"

        logQueue.async {
            let directoryURL = Common.getUserConfigPath()
            let fileManager = FileManager.default
            if !fileManager.fileExists(atPath: directoryURL.path) {
                try? fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
            }
            if let handle = try? FileHandle(forWritingTo: self.logFileURL) {
                handle.seekToEndOfFile()
                if let data = logLine.data(using: .utf8) {
                    handle.write(data)
                }
                handle.closeFile()
            } else {
                try? logLine.write(to: self.logFileURL, atomically: true, encoding: .utf8)
            }
        }
    }
}
