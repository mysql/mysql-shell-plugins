# Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import copy
import enum
import threading
import time
from contextlib import contextmanager
from queue import Queue

import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger
from gui_plugin.core.Context import get_context
from gui_plugin.core.dbms.DbSessionTasks import DBCloseTask, DbSqlTask
from gui_plugin.core.Error import MSGException


class ReconnectionMode(enum.Enum):
    NONE = 0
    STANDARD = 1
    EXTENDED = 2


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
def lock_usage(lock_mutex, timeout=-1):
    result = lock_mutex.acquire(blocking=True, timeout=timeout)

    if result is None:
        raise Exception("Could not acquire lock.")

    yield result

    if result:
        lock_mutex.release()


class DbSession(threading.Thread):
    _cancel_requests = []

    def __init__(self, id, threaded, connection_options, data={}, auto_reconnect=ReconnectionMode.NONE, task_state_cb=None):
        super().__init__()
        self._id = id
        # Enable auto-reconnect logic for this session
        self._auto_reconnect = auto_reconnect

        if not isinstance(connection_options, dict):
            raise MSGException(Error.DB_INVALID_OPTIONS,
                               'No connection_options dict given.')

        # Creates a local copy of the connection options
        self._connection_options = connection_options.copy()

        self._last_error = None
        self._last_execution_time = None
        self._last_insert_id = None
        self._rows_affected = None
        self._task_mutex = threading.Lock()
        self._request_queue = Queue()
        self._mutex = threading.RLock()
        self._init_complete = threading.Event()
        self._term_complete = threading.Event()
        self.cursor = None
        self._killed = False
        self._threaded = threaded
        self.thread_error = None
        self._opened = False
        self._data = {} if data is None else data
        self._task_state_cb = task_state_cb
        self._current_task_id = None

        # Callbacks to keep track of task execution states
        # syntax: callback(task, state)
        self._task_execution_callbacks = []

        self._setup_tasks = None

    def add_task_execution_callback(self, cb):
        self._task_execution_callbacks.append(cb)

    def notify_task_execution_state(self, task, state):
        for cb in self._task_execution_callbacks:
            cb(task, state)

    def lock(self):
        self._mutex.acquire(True)

    def release(self):
        self._mutex.release()

    def run_sql(self, sql, args=None):
        raise NotImplementedError()

    def _initialize_setup_tasks(self):
        return []

    def has_data(self, option):
        return option in self._data

    def set_data(self, option, value):
        self._data[option] = value

    @property
    def database_type(self):
        raise NotImplementedError()

    @property
    def data(self):
        return self._data

    @property
    def threaded(self):
        return self._threaded

    @property
    def task_state_cb(self):
        return self._task_state_cb

    @property
    def connection_options(self):
        return self._connection_options

    def open(self):
        self._opened = True
        logger.debug3(f"Connecting {self._id}...")
        if self.threaded:
            # Start the session thread
            self.start()

            if self.thread_error is not None:
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

    def _reset_setup_tasks(self):
        if self._setup_tasks is None:
            self._setup_tasks = self._initialize_setup_tasks()
        else:
            for setup_task in self._setup_tasks:
                setup_task.reset(include_data=False)

    def _on_connect(self):
        # Initialize/Reset the setup tasks
        self._reset_setup_tasks()

        # Now execute
        for setup_task in self._setup_tasks:
            setup_task.on_connect()

    def _on_connected(self, notify_success):
        for setup_task in self._setup_tasks:
            setup_task.on_connected()

    def _on_failed_connection(self):
        for setup_task in self._setup_tasks:
            setup_task.on_failed_connection()

    def _open_database(self, notify_success=True):
        # Opens the database
        if self._do_open_database(notify_success=notify_success):
            self._on_connected(notify_success=notify_success)

    def _do_open_database(self, notify_success=True):
        raise NotImplementedError()

    def _close_database(self, finalize):
        for setup_task in self._setup_tasks:
            setup_task.on_close()

        self._do_close_database(finalize)

    def _do_close_database(self, finalize):
        raise NotImplementedError()

    def _reconnect(self, is_auto_reconnect):
        raise NotImplementedError()

    def terminate_thread(self):
        self._close_database(True)
        if self.thread_error is not None:
            logger.error(
                f"Thread {self._id} exiting with code {self.thread_error}")
            self._message_callback('ERROR', self.thread_error)
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

    def update_stats(self, execution_time, final_update=False):
        stats = self._get_stats(self.cursor)
        if not (final_update and stats['rows_affected'] <= 0 and self._rows_affected > 0):
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

    def close(self, after_fail=False):
        if self.threaded:
            # If connection failed to open
            # we don't need to close it as it's
            # not open
            if not after_fail:
                self.add_task(DBCloseTask())
                self._term_complete.wait()
        else:
            self._close_database(True)

    def reconnect(self, new_connection_options=None):
        # Locks the task execution mutex for the reconnection to happen before next task is executed
        self._task_mutex.acquire(True)

        # Updates the connection options for the reconnect operation if provided
        if new_connection_options is not None:
            self._connection_options = new_connection_options.copy()

        try:
            self._reconnect(False)
        finally:
            self._task_mutex.release()

    def add_task(self, task):
        self._request_queue.put(task)

    def execute(self, sql, params=None, result_queue=None, request_id=None,
                callback=None, options=None):

        if self.threaded:
            context = get_context()
            if request_id is None:
                request_id = context.request_id if context else None
            self._killed = False
            self.add_task(DbSqlTask(self, task_id=request_id, sql=sql, params=params,
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

    def get_current_schema(self, callback=None, options=None):    # pragma: no cover
        raise NotImplementedError()

    def set_current_schema(self, schema_name, callback=None, options=None):  # pragma: no cover
        raise NotImplementedError()

    def kill_query(self, user_session):  # pragma: no cover
        raise NotImplementedError()

    def get_objects_types(self):  # pragma: no cover
        raise NotImplementedError()

    def get_catalog_object_names(self, type, filter):  # pragma: no cover
        raise NotImplementedError()

    def get_schema_object_names(self, type, schema_name, filter, routine_type=None):  # pragma: no cover
        raise NotImplementedError()

    def get_table_object_names(self, type, schema_name, table_name, filter):  # pragma: no cover
        raise NotImplementedError()

    def get_catalog_object(self, type, name):  # pragma: no cover
        raise NotImplementedError()

    def get_schema_object(self, type, schema_name, name):  # pragma: no cover
        raise NotImplementedError()

    def get_table_object(self, type, schema_name, table_name, name):  # pragma: no cover
        raise NotImplementedError()

    def get_table_objects(self, type, schema_name, table_name):  # pragma: no cover
        raise NotImplementedError()

    def get_columns_metadata(self, names):
        raise NotImplementedError()

    def get_routines_metadata(self, schema_name):  # pragma: no cover
        raise NotImplementedError()

    def run(self):
        threading.current_thread().name = f'sql-{self._id}'

        self.initialize_thread()

        # Wait for the thread initialization to be complete
        self._init_complete.wait()

        while self.thread_error is None:
            task = self._request_queue.get()
            self._task_mutex.acquire(True)
            self._current_task_id = task.task_id

            if isinstance(task, DBCloseTask):
                break

            if task.task_id in DbSession._cancel_requests:
                task.cancel()
                DbSession._cancel_requests.remove(task.task_id)

            # Resets the killed flag for the next task
            self._killed = False

            with lock_usage(self._mutex, 5):
                self.notify_task_execution_state(task, "started")
                task.execute()
                self.notify_task_execution_state(task, "finished")

                # These values are updated on the session to keep track of the result of the last executed task
                self._last_error = task.last_error
                self._last_execution_time = task.execution_time
                self._last_insert_id = task.last_insert_id
                self._rows_affected = task.rows_affected

            self._current_task_id = None
            self._task_mutex.release()

        self.terminate_thread()

    def cancel_request(self, request_id):
        DbSession._cancel_requests.append(request_id)
