# Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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
import copy
import time
from queue import Queue
from contextlib import contextmanager
from .DbSessionTasks import DbSqlTask, DBCloseTask, DBReconnectTask
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger


class DbSessionFactory:
    registry = {}

    @classmethod
    def register_session(self, name):
        def inner_wrapper(wrapped_class):
            # If session already exists, will be replaced
            self.registry[name] = wrapped_class
            return wrapped_class

        return inner_wrapper

    @classmethod
    def create(self, name, *args):
        if len(self.registry) == 0:
            import gui_plugin.core.dbms
        if name not in self.registry:
            raise Exception(
                f'There is not registered session with the name: {name}')

        db_class = self.registry[name]
        db_session = db_class(*args)
        return db_session

    @classmethod
    def getSessionTypes(self):
        if len(self.registry) == 0:
            import gui_plugin.core.dbms
        return list(self.registry.keys())


@contextmanager
def lock_usage(lock_mutext, timeout=-1):
    result = lock_mutext.acquire(blocking=True, timeout=timeout)

    if result is None:
        raise Exception("Could not acquire lock.")

    yield result

    if result:
        lock_mutext.release()


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


class DbSession(threading.Thread):
    _cancel_requests = []

    def __init__(self, id, threaded, connection_options, ping_interval=None,
                 auto_reconnect=False):
        super().__init__()
        self._id = id
        # Enable auto-reconnect logic for this session
        self._auto_reconnect = auto_reconnect

        if not isinstance(connection_options, dict):
            raise MSGException(Error.DB_INVALID_OPTIONS,
                               'No connection_options dict given.')

        self._connection_options = connection_options

        self._last_error = None
        self._last_execution_time = None
        self._last_insert_id = None
        self._rows_affected = None
        self._request_queue = Queue()
        self._mutex = threading.RLock()
        self._init_complete = threading.Event()
        self._term_complete = threading.Event()
        self.cursor = None
        self._killed = False
        self._threaded = threaded
        self.thread_error = None
        self._opened = False
        self._db_pinger = None
        if not ping_interval is None:
            self._db_pinger = DbPingHandler(self, ping_interval)

    @property
    def connection_options(self):
        return self._connection_options

    def open(self):
        self._opened = True
        logger.debug3(f"Connecting {self._id}...")
        if self._threaded:
            # Start the session thread
            self.start()

            if not self.thread_error is None:
                raise self.thread_error
        else:
            self._open_database()

    def is_killed(self):
        return self._killed

    def wait_terminated(self, timeout):
        self._term_complete.wait(timeout)

    def initialize_thread(self):
        try:
            self._open_database()
        except Exception as e:
            self.thread_error = e

        self._init_complete.set()

    def _open_database(self, notify_success=True):
        raise NotImplementedError()

    def _close_database(self, finalize):
        raise NotImplementedError()

    def _reconnect(self, auto_reconnect=False):
        raise NotImplementedError()

    def terminate_thread(self):
        if not self._db_pinger is None:
            self._db_pinger.stop()
            self._db_pinger.join()
        self._close_database(True)
        if self.thread_error != 0:
            logger.error(f"Thread {self._id} exiting with code {self.thread_error}")
        self._term_complete.set()

    def execute_thread(self, sql, params):
        start_time = time.time()
        result = self.do_execute(sql, params)
        execution_time = time.time() - start_time
        self.update_stats(execution_time)
        return result

    def do_execute(self, sql, params=None):  # pragma: no cover
        raise NotImplementedError()

    def set_last_error(self, error):
        self._last_error = error

    def _get_stats(self, resultset):
        raise NotImplementedError()

    def clear_stats(self):
        self._last_error = None
        self._rows_affected = 0
        self._last_insert_id = 0

    def update_stats(self, execution_time):
        stats = self._get_stats(self.cursor)
        self._rows_affected = stats['rows_affected']
        self._last_insert_id = stats['last_insert_id']
        self._last_execution_time = execution_time

    def get_last_row_id(self):
        return self._last_insert_id

    def next_result(self):  # pragma: no cover
        raise NotImplementedError()

    def row_generator(self):  # pragma: no cover
        raise NotImplementedError()

    def get_column_info(self, row=None):  # pragma: no cover
        raise NotImplementedError()

    def row_to_container(self, row, columns):  # pragma: no cover
        raise NotImplementedError()

    def info(self):  # pragma: no cover
        raise NotImplementedError()

    def get_default_schema(self):  # pragma: no cover
        raise NotImplementedError()

    def close(self):
        if self._threaded:
            self.add_task(DBCloseTask())
            self._term_complete.wait()
        else:
            self._close_database(True)

    def reconnect(self):
        if self._threaded:
            self.add_task(DBReconnectTask())
            self._term_complete.wait()
        else:
            self._reconnect(auto_reconnect=False)

    def add_task(self, task):
        self._request_queue.put(task)

    def execute(self, sql, params=None, result_queue=None, request_id=None,
                callback=None, options=None):
        if self._threaded:
            self._killed = False
            self.add_task(DbSqlTask(self, request_id, sql, params=params,
                                    result_queue=result_queue, result_callback=callback, options=options))
        else:
            return self.execute_thread(sql, params)

    def start_transaction(self):  # pragma: no cover
        raise NotImplementedError()

    def commit(self):
        self.execute('COMMIT;')

    def rollback(self):
        self.execute('ROLLBACK;')

    @property
    def last_status(self):  # pragma: no cover
        with lock_usage(self._mutex, 5):
            if self._last_error:
                return {"type": "ERROR", "msg": self._last_error}

            status_msg = ''

            if self._last_execution_time:
                status_msg = (
                    f"Query finished in {self._last_execution_time} seconds.")

            return {"type": "OK", "msg": status_msg}

    def get_last_status(self):
        return self.last_status

    @property
    def last_error(self):
        with lock_usage(self._mutex, 5):
            return copy.copy(self._last_error)
        return None

    @property
    def last_execution_time(self):
        with lock_usage(self._mutex, 5):
            return copy.copy(self._last_execution_time)
        return None

    @property
    def last_insert_id(self):
        with lock_usage(self._mutex, 5):
            return copy.copy(self._last_insert_id)
        return None

    @property
    def rows_affected(self):
        with lock_usage(self._mutex, 5):
            return copy.copy(self._rows_affected)
        return None

    def get_current_schema(self, request_id, callback=None, options=None):    # pragma: no cover
        raise NotImplementedError()

    def set_current_schema(self, request_id, schema_name, callback=None, options=None):  # pragma: no cover
        raise NotImplementedError()

    def kill_query(self, user_session):  # pragma: no cover
        raise NotImplementedError()

    def get_objects_types(self, request_id, callback=None):  # pragma: no cover
        raise NotImplementedError()

    def get_catalog_object_names(self, request_id, type, filter, callback=None):  # pragma: no cover
        raise NotImplementedError()

    def get_schema_object_names(self, request_id, type, schema_name, filter, routine_type=None, callback=None):  # pragma: no cover
        raise NotImplementedError()

    def get_table_object_names(self, request_id, type, schema_name, table_name, filter, callback=None):  # pragma: no cover
        raise NotImplementedError()

    def get_catalog_object(self, request_id, type, name, callback=None):  # pragma: no cover
        raise NotImplementedError()

    def get_schema_object(self, request_id, type, schema_name, name, callback=None):  # pragma: no cover
        raise NotImplementedError()

    def get_table_object(self, request_id, type, schema_name, table_name, name, callback=None):  # pragma: no cover
        raise NotImplementedError()

    def run(self):
        threading.current_thread().name = f'sql-{self._id}'

        self.initialize_thread()

        # Wait for the thread initialization to be complete
        self._init_complete.wait()

        if not self._db_pinger is None:
            self._db_pinger.start()

        while self.thread_error is None:
            task = self._request_queue.get()

            if isinstance(task, DBCloseTask):
                break

            if isinstance(task, DBReconnectTask):
                self._reconnect(auto_reconnect=False)
                self._term_complete.set()
            else:
                if task.request_id in DbSession._cancel_requests:
                    task.cancel()
                    DbSession._cancel_requests.remove(task.request_id)

                # Resets the killed flag for the next task
                self._killed = False

                with lock_usage(self._mutex, 5):
                    task.execute()

                    # These values are updated on the session to keep track of the result of the last executed task
                    self._last_error = task.last_error
                    self._last_execution_time = task.execution_time
                    self._last_insert_id = task.last_insert_id
                    self._rows_affected = task.rows_affected

        self.terminate_thread()

    def cancel_request(self, request_id):
        DbSession._cancel_requests.append(request_id)
