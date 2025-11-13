# Copyright (c) 2025, Oracle and/or its affiliates.
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
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import os
import pytest  # type: ignore
from migration_plugin.lib import logging
import mysqlsh


def test_log_coalesce():
    path = mysqlsh.globals.shell.options["logFile"]
    print(path)

    initial_size = os.path.getsize(path)

    logging.info("line 1")

    logging.info("line 2")

    logging.info("line 3")
    logging.info("line 3")

    logging.info("line 4")
    logging.info("line 4")
    logging.info("line 4")

    logging.info("line 5")
    logging.info("line 5")
    logging.info("line 5")
    logging.info("line 5")
    logging.info("line 5")

    logging.info("exit")

    with open(path) as f:
        f.seek(initial_size)
        output = []
        for line in f.readlines():
            output.append(line.split(":")[-1].strip())
    assert output == ['line 1', 'line 2', 'line 3', 'line 3', 'line 4',
                      'line 4 (repeated 2 times)', 'line 5', 'line 5 (repeated 4 times)', 'exit']
