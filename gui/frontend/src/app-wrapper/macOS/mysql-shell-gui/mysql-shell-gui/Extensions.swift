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

import Foundation
import Cocoa;

public protocol AppProtocol {
  func sendAppMessage(command: String, data: [Any]) -> Void;
}

extension NSColor {
  convenience init(hex: String) {

    let colorString = hex.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines);
    let scanner = Scanner(string: colorString);

    if colorString.hasPrefix("#") {
      let _ = scanner.scanCharacter();
    }

    var colorCode: UInt64 = 0
    scanner.scanHexInt64(&colorCode);

    let mask: UInt64 = 0x000000FF;
    let red = CGFloat((colorCode >> 16) & mask);
    let green = CGFloat((colorCode >> 16) & mask);
    let blue = CGFloat((colorCode >> 16) & mask);

    self.init(
      deviceRed: red / 255.0,
      green: green / 255.0,
      blue: blue / 255.0,
      alpha: 1
    );
  }
}
