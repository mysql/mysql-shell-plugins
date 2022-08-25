# Copyright (c) 2022, Oracle and/or its affiliates.
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
import threading
import enum


class DbSessionData(enum.Enum):
    PING_INTERVAL = 0


class DbPingHandler(threading.Thread):
    """
    Schedules a dummy query on the given session with a defined interval.

    This is required to prevent bastion sessions to disconnect after few
    minutes of inactivity.
    """

    def __init__(self, session, interval):
        super().__init__()
        self.session = session
        self.interval = interval
        self.condition = threading.Condition()

    def stop(self):
        """
        Stops the ping scheduling.
        """
        with self.condition:
            self.condition.notify()

    def run(self):
        done = False
        while not done:
            with self.condition:
                # If the wait ends because it timed out then done will be
                # False, in such case the dummy query is executed.
                # If the wait ends because of notify call (stop got called)
                # then done will be True, which means the session has been
                # terminated
                done = self.condition.wait(self.interval)
                if not done:
                    self.session.execute("SELECT 1")
