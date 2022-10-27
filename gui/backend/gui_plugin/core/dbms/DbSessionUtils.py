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
import time

import gui_plugin.core.Logger as logger


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
        self.pause_condition = threading.Condition()
        self._paused = False

    @property
    def paused(self):
        return self._paused

    @paused.setter
    def paused(self, value):
        self._paused = value

    def unpause(self):
        self.paused = False
        with self.pause_condition:
            self.pause_condition.notify()

    def on_execute_state(self, task, state):
        # Statements coming from this thread should not pause/unpause the pinger
        if task is None or task.thread_id != self.native_id:
            with self.condition:
                if state == "started":
                    self.paused = True
                    self.condition.notify()
                else:
                    self.unpause()

    def stop(self):
        """
        Stops the ping scheduling.
        """
        # If stops while paused, release the pause and waits to release the
        # main condition to guarantee the next condition notification ends
        #  the main loop
        if self.paused:
            self.on_execute_state(None, "finished")
            time.sleep(0.5)

        # Ends the main loop
        with self.condition:
            self.condition.notify()

    def dispatch_result(self, state, message=None, id=None, data=None):
        logger.debug3(
            f"{self.native_id}  DBPingHandler State: {state}")

    def run(self):
        done = False
        self.session.add_task_execution_callback(self.on_execute_state)
        while not done:
            with self.condition:
                # Wait until the condition is met which could be in the
                # following cases:
                # - a) When the timer expires (done is False on this case)
                # - b) When a Task starts being executed using the target session
                # - c) When the Session is closed (the timer stops processing)
                done = self.condition.wait(self.interval)

            # Handles case b, the pinger is paused on this case
            if done and self.paused:
                with self.pause_condition:
                    self.pause_condition.wait()
                    done = False
                    continue

            # Handles case a, we ping the target server
            if not done:
                self.session.execute(
                    "SELECT 1", callback=self.dispatch_result)
