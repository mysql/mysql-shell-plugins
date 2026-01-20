# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA"""

from pathlib import Path
import re
import os
import datetime

ROOT_PATH = Path(f"{os.path.dirname(__file__)}/../../../").resolve().as_posix()

PATHS_TO_FIX = [
    os.path.join(ROOT_PATH, 'gui', 'extension', 'README.md'),
    os.path.join(ROOT_PATH, 'gui', 'backend', 'readme.md'),
    os.path.join(ROOT_PATH, 'mds_plugin', 'readme.md'),
    os.path.join(ROOT_PATH, 'mrs_plugin', 'readme.md'),
    os.path.join(ROOT_PATH, 'migration_plugin', 'readme.md'),
    os.path.join(ROOT_PATH, 'msm_plugin', 'readme.md'),
    os.path.join(ROOT_PATH, 'README.md'),
    os.path.join(ROOT_PATH, 'gui', 'frontend', 'src', 'app-logic', 'App.css'),
]


year = datetime.date.today().year


def fix_copyright(file):
    fixed = False
    with open(file, encoding="utf8", newline="") as f, open(file+".new", "w+", encoding="utf8", newline="") as out:
        match1 = re.compile(
            r".*Copyright &copy; ([1-2][0-9][0-9][0-9]), Oracle")
        match2 = re.compile(
            r".*Copyright &copy; ([1-2][0-9][0-9][0-9]), ([1-2][0-9][0-9][0-9]), Oracle and/or its affiliates. *(All rights.*)?")
        match3 = re.compile(r".*© ([1-2][0-9][0-9][0-9]), ([1-2][0-9][0-9][0-9]), Oracle and/or its affiliates.")

        for line in f:
            oline = line
            m = re.match(match1, line)
            if m:
                y = int(m.groups()[0])
                if y < year:
                    line = re.sub(
                        r"(.*Copyright &copy; )([1-2][0-9][0-9][0-9])(, Oracle and/or its affiliates.) *(All rights.*)?", r"\1\2, %s\3" % year, line)
                if "rights reserved" in line:
                    line = re.sub(
                        r"(.*Copyright.*Oracle and/or its affiliates.)*(.*All rights.*)?", r"\1", line)
            else:
                m = re.match(match2, line)
                if m:
                    y1 = int(m.groups()[0])
                    y2 = int(m.groups()[1])
                    if y2 < year:
                        line = re.sub(
                            r"(.*Copyright &copy; [0-9]{4},) ([1-2][0-9][0-9][0-9])(, Oracle and/or its affiliates.) *(All rights.*)?", r"\1 %s\3" % year, line)
                    if y1 == y2:
                        line = re.sub(
                            r"(.*Copyright &copy; [0-9]{4})(, [1-2][0-9][0-9][0-9])(, Oracle and/or its affiliates.) *(All rights.*)?", r"\1\3", line)
                    if "rights reserved" in line:
                        line = re.sub(
                            "(.*Copyright.*Oracle and/or its affiliates.)*(.*All rights.*)?", r"\1", line)
                else:
                    m = re.match(match3, line)
                    if m:
                        y1 = int(m.groups()[0])
                        y2 = int(m.groups()[1])
                        if y2 < year:
                            line = re.sub(
                                r"(.*© [0-9]{4},) ([1-2][0-9][0-9][0-9])(, Oracle and/or its affiliates.)", r"\1 %s\3" % year, line)
                        if y1 == y2:
                            line = re.sub(
                                r"(.*© [0-9]{4})(, [1-2][0-9][0-9][0-9])(, Oracle and/or its affiliates.)", r"\1\3", line)
            if oline != line:
                fixed = True
            out.write(line)

    if fixed:
        os.rename(file, file+".bak")
        os.rename(file+".new", file)
        os.remove(file+".bak")
    else:
        os.remove(file+".new")


for file in PATHS_TO_FIX:
    fix_copyright(file)
