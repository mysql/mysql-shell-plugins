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

from gui_plugin.core.dbms import DbSessionData as DbSessionData
from gui_plugin.core.dbms.DbSessionUtils import DbPingHandler


class DbSessionSetupTask:
    """
    This class provides a structured mechanism to implement MySQL session related
    tasks to be executed right before or after the MySQL session is established.
    """

    def __init__(self, session, progress_cb=None) -> None:
        self._session = session
        self._progress_cb = progress_cb
        self._input_options = {}
        self._output_options = {}
        self._input_data = {}
        self._output_data = {}

    def execute(self, sql, params=None):
        return self._session.execute_thread(sql, params)

    @property
    def session(self):
        return self._session

    @property
    def connection_options(self):
        return self._session.connection_options

    @property
    def input_options(self):
        return self._input_options

    @property
    def output_options(self):
        return self._output_options

    def has_option(self, option):
        """
        Verifies if the given option exists on the session connection options.
        """
        return option in self.connection_options

    def has_data(self, option):
        """
        Verifies if the given option exists on the session connection options.
        """
        return self.session.has_data(option)

    def get_data(self, option):
        """
        Gets the given data from the session.
        """
        return self.session.data[option]

    def extract_option(self, option, default_value=None):
        """
        Extracts an option from the connection options and registers it on the
        input options.
        """
        value = default_value
        if self.has_option(option):
            value = self.connection_options.pop(option)
            self._input_options[option] = value

        return value

    def define_option(self, option, value):
        """
        Defines an option on the connection options and the output options.
        """
        # Will cause the option to be backed up if existed
        self.extract_option(option)

        # Defines the new value for the option
        self.connection_options[option] = value
        self._output_options[option] = value

    def define_data(self, option, value):
        """
        Defines an entry on the connection data and the output data.
        """

        # If the data already exists and was not added by the task,
        # backs up the current value
        if option in self.session.data and option not in self._output_data:
            self._input_data[option] = self.session.data[option]

        # Defines the new value for the data
        self.session.data[option] = value
        self._output_data[option] = value

    def report_progress(self, msg):
        """
        Progress callback to be used if the task is of long duration to keep the
        clients up to date on what's going on.
        """
        if self._progress_cb is not None:
            self._progress_cb(msg)

    def reset(self, include_data=True):
        """
        Resets any change done by this task on the session connection options.
        """
        # Removes any option added from this task
        for option in self._output_options.keys():
            if option in self.connection_options:
                self.connection_options.pop(option)

        # Adds any option removed by this task
        for option, value in self._input_options.items():
            self.connection_options[option] = value

        if include_data:
            # Removes any data added from this task
            for option in self._output_data.keys():
                if option in self.session.data:
                    self.session.data.pop(option)

            # Adds any data removed by this task
            for option, value in self._input_data.items():
                self.session.data[option] = value

            self._input_data.clear()
            self._output_data.clear()

        self._input_options.clear()
        self._output_options.clear()

    def on_connect(self):
        """
        Override this function to implement task to be executed right before
        executing the MySQL Session.

        IMPORTANT: Any non official connection option should be removed here to
        avoid connection errors from the Shell.
        """
        pass

    def on_connected(self):
        """
        Override this function to implement task to be executed right after the
        MySQL Session has been established
        """
        pass

    def on_failed_connection(self):
        """
        Override this function to implement task to be executed right after the
        MySQL Session failed getting established
        """
        pass

    def on_close(self):
        """
        Override this function to implement what the task should do if te session is
        closed
        """
        pass


class DbPingHandlerTask(DbSessionSetupTask):
    def __init__(self, session, progress_cb=None) -> None:
        super().__init__(session, progress_cb)

        # The check is enabled if the value is not known
        self._db_pinger = None

    def reset(self, include_data=True):
        super().reset(include_data)

        self.on_close()

    def on_connected(self):
        if self.session.has_data(DbSessionData.PING_INTERVAL):
            interval = self.session.data[DbSessionData.PING_INTERVAL]
            if interval is not None and interval > 0:
                self._db_pinger = DbPingHandler(self.session, interval)
                self._db_pinger.start()

    def on_close(self):
        if self._db_pinger is not None:
            self._db_pinger.stop()
            self._db_pinger.join()
