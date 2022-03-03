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

import time
import json
from .BaseTask import BaseTask, CommandTask
from .Protocols import Response
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger
import mysqlsh

def check_supported_type(func):
    def wrapper(self, *args, **kwargs):
        def get_supported_type(name):
            for item in self._supported_types:
                if item['name'] == name:
                    return item['type']
            return None

        object_type = get_supported_type(kwargs["type"])

        if object_type is None:
            raise MSGException(Error.DB_UNSUPPORTED_OBJECT_TYPE,
                f'Unsupported {object_type} object type ({kwargs["type"]})')

        if not object_type.split('_')[0].lower() in func.__name__:
            raise MSGException(Error.DB_UNSUPPORTED_OBJECT_TYPE,
                f'Unsupported function for type {object_type} ({func.__name__})')

        return func(self, *args, **kwargs)
    return wrapper


class DBCloseTask():
    pass

class DBReconnectTask():
    pass

class DbTask(BaseTask):
    """
    Task base class for database operations, including:
    - Tasks where a single query is executed
    - Tasks where multiple queries are executed
    """

    def __init__(self, session, request_id, result_queue=None, params=None, result_callback=None, options=None):
        super().__init__(request_id, result_queue=result_queue,
                         result_callback=result_callback, options=options)
        self.session = session
        self.params = params if params else []

        self._start_time = None
        self._execution_time = None
        self._error = None
        self._rows_affected = 0
        self._last_insert_id = None

        self.dispatch_result("PENDING", message="Execution started...")

    def dispatch_result(self, state, message=None, data=None):
        if state == "ERROR":
            self._error = message
            self.session.set_last_error(self._error)

        super().dispatch_result(state, message=message, data=data)

    @property
    def start_time(self):
        return self._start_time

    @property
    def execution_time(self):
        return self._execution_time

    @property
    def last_error(self):
        return self._error

    @property
    def last_insert_id(self):
        return self._last_insert_id

    @property
    def rows_affected(self):
        return self._rows_affected

    def do_execute(self):
        raise NotImplementedError()


class DbQueryTask(DbTask):
    """
    Task base class for database tasks that use a single query.
    - Handles errors executing the task
    - The processing of the result is specific for each child class
    """

    def __init__(self, session, request_id, sql, params=None, result_queue=None, result_callback=None, options=None):
        super().__init__(session, request_id, params=params, result_queue=result_queue,
                         result_callback=result_callback, options=options)
        if isinstance(sql, str):
            self.sql = [sql]
        else:
            self.sql = sql

        self.resultset = None
        self._row_count = 0
        self._killed = False

    def do_execute(self):
        self.session.clear_stats()
        self._execution_time = 0
        self._break = False

        for self._sql_index, sql in enumerate(self.sql):
            # Execute the requested sql
            if self._break:
                break

            while True:
                try:
                    self._start_time = time.time()
                    self.resultset = self.session.execute_thread(sql, self.params)
                    self._execution_time += time.time() - self._start_time

                    if self.session.is_killed():
                        self.resultset = "Query killed"

                    self.process_result()

                    break
                except mysqlsh.DBError as e:
                    if e.code == 2013:
                        if self.session._auto_reconnect and self.session._reconnect(True):
                            continue
                    logger.exception(e)
                    self.dispatch_result("ERROR", message=str(e),
                                        data=Response.exception(e))
                    break
                except RuntimeError as e:
                    if "Not connected." in str(e):
                        if self.session._auto_reconnect and self.session._reconnect(True):
                            continue
                    logger.exception(e)
                    self.dispatch_result("ERROR", message=str(e),
                                        data=Response.exception(e))
                    break
                except Exception as e:
                    logger.exception(e)
                    self.dispatch_result("ERROR", message=str(e),
                                        data=Response.exception(e))
                    break

    def process_result(self):
        raise NotImplementedError()


class DbExecuteTask(DbQueryTask):
    """
    Task class for operations that do not produce any resultset.
    """

    def process_result(self):
        # If this point is reached it means the operation was executed successfully,
        # so we are done
        self.dispatch_result("OK")


class DbSqlTask(DbQueryTask):
    """
    Task class for arbitrary SQL operations, they are executed as single query tasks and
    this class implements the result handling.
    """

    def dispatch_result(self, state, message=None, data=None):
        if state == "OK":
            self.session.update_stats(self._execution_time)
            self._rows_affected = self.session.rows_affected
            self._last_insert_id = self.session.last_insert_id

            # Set the total row count
            data["total_row_count"] = self._row_count
            data["execution_time"] = self._execution_time

            if self._last_insert_id:
                data["last_insert_id"] = self._last_insert_id

            if self._rows_affected and self._rows_affected > -1:
                data["rows_affected"] = self._rows_affected

        super().dispatch_result(state, message=message, data=data)

    def process_result(self):
        # Process result set
        buffer_size = self.options.get("row_packet_size", 25)

        columns = None
        values = {"rows": []}

        try:
            has_result = True

            while has_result:
                self._row_count = 0
                columns = None
                values = {"rows": []}

                # Loop over all rows
                for row in self.session.row_generator():
                    if self.session.is_killed():
                        raise MSGException(Error.DB_QUERY_KILLED, "Query killed")

                    # If this is the first response, add column names
                    if self._row_count == 0:
                        columns = self.session.get_column_info(row)

                        values["columns"] = columns

                    # Return chunks of buffer_size a time, if buffer_size is 0
                    # or -1, do not return chunks but only the full result set
                    if buffer_size > 0 and len(values["rows"]) >= buffer_size:
                        # Call the callback
                        self.dispatch_result("PENDING", data=values)
                        values = {"rows": []}

                    # Convert the current row to the proper container type
                    row_to_append = self.session.row_to_container(
                        row, columns)

                    values['rows'].append(row_to_append)
                    self._row_count += 1

                has_result = self.session.next_result()

                if not has_result:
                    values["done"] = True

                # Call the callback
                self.dispatch_result("OK", data=values)
        except Exception as e:
            logger.exception(e)
            self.dispatch_result("ERROR", message=str(e),
                                 data=Response.exception(e))
            return


class BaseObjectTask(DbQueryTask):
    def __init__(self, session, request_id, sql, params=None, result_queue=None, result_callback=None,
                 options=None, type=None, name=None):
        super().__init__(session, request_id, sql=sql, params=params, result_queue=result_queue,
                         result_callback=result_callback, options=options)
        self.type = type.lower() if type else ""
        self.name = name

    def format(self, row):
        if row:
            return {"name": row[0]}

        return {"name": ""}
