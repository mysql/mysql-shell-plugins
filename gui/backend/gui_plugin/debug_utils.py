# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
import os
import sys
import threading
import signal
from importlib.abc import MetaPathFinder
import gui_plugin.core.Logger as logger
import mysqlsh

# To DEBUG either the backend code (server side) or the unit tests
# add the following 2 lines at:
# - gui.start.web_server OR
# - the test to be debugged
#
# from gui_plugin.internal import wait_debugger
# wait_debugger()
#
# If you want to see the printed instructions add the -s argument when calling
# run_tests.sh

_TEST_PROCESS = "PYTEST_CURRENT_TEST" not in os.environ


class NotificationFinder(MetaPathFinder):  # pragma: no cover
    def __init__(self):
        self.attached_event = threading.Event()
        sys.meta_path.insert(0, self)

    def find_spec(self, fullname, _path, _target=None):
        if 'pydevd' in fullname:
            self.attached_event.set()

    def wait(self):
        self.attached_event.wait()


def wait_debugger():  # pragma: no cover
    finder = NotificationFinder()

    logger.info("================================================")
    logger.info("Waiting for a debugger session to be attached")
    finder.wait()
    logger.info("Debugger attached...")
    logger.info("================================================")


if 'ATTACH_DEBUGGER' in os.environ:  # pragma: no cover
    if _TEST_PROCESS:
        from tests.tests_timeouts import response_timeout, server_timeout
        logger.info("Overriding default timeouts")
        response_timeout(600)
        server_timeout(600)

        if 'TESTS' in os.environ['ATTACH_DEBUGGER']:
            wait_debugger()
    elif 'BACKEND' in os.environ['ATTACH_DEBUGGER']:
        wait_debugger()
    elif 'LOCK' in os.environ['ATTACH_DEBUGGER']:
        import faulthandler
        f = open("stack_output_on_SIGUSER1", 'w')
        faulthandler.register(signal.SIGUSR1, all_threads=True, file=f)
