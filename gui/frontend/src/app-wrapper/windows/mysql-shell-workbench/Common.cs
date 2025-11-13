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

using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MySQLShellWorkbench
{
  internal static class Common
  {
    public const string MYSQLSHWB_USER_CONFIG_HOME = "mysqlsh-wb";

    public static string GetUserConfigPath(List<string> pathElements = null)
    {
      var basePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MySQL", MYSQLSHWB_USER_CONFIG_HOME);
      return pathElements == null || pathElements.Count == 0 
        ? basePath 
        : Path.Combine(new[] { basePath }.Concat(pathElements).ToArray());
    }
  }
}
