# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import sqlite3

import gui_plugin.core.Error as Error
import gui_plugin.core.Logger as logger
from gui_plugin.core.dbms.DbSessionTasks import (BaseObjectTask, DbQueryTask,
                                                 DbTask)
from gui_plugin.core.Error import MSGException
from gui_plugin.core.Protocols import Response


class SqliteOneFieldListTask(DbQueryTask):
    def process_result(self):
        buffer_size = self.options.get("row_packet_size", 25)
        name_list = []
        send_empty = True
        for row in self.resultset:
            name_list.append(row[0])

            # Return chunks of buffer_size a time, if buffer_size is 0
            # or -1, do not return chunks but only the full result set
            if buffer_size > 0 and len(name_list) >= buffer_size:
                self.dispatch_result("PENDING", data=name_list)
                name_list = []
                send_empty = False

        if send_empty or len(name_list) > 0:
            self.dispatch_result("PENDING", data=name_list)


class SqliteBaseObjectTask(BaseObjectTask):
    def process_result(self):
        row = self.resultset.fetchone()
        if row is None:
            self.dispatch_result(
                "ERROR", message=f"The {self.type} '{self.name}' does not exist.")
        else:
            self.dispatch_result("PENDING", data=self.format(row))


class SqliteTableObjectTask(BaseObjectTask):
    def format(self, row):
        if row:
            return {"name": row[0]}

        return {"name": ""}

    def process_result(self):
        if self._sql_index == 0:
            row = self.resultset.fetchone()
            if row is None:
                self.dispatch_result(
                    "ERROR", message=f"The table '{self.name}' does not exist.")
            else:
                self.dispatch_result("PENDING", data=self.format(row))
        else:
            # Process result set
            buffer_size = self.options.get("row_packet_size", 25)

            values = {"columns": []}

            try:
                # Loop over all rows
                for row in self.session.row_generator():
                    if self.session.is_killed():
                        raise MSGException(
                            Error.DB_QUERY_KILLED, "Query killed")

                    # Return chunks of buffer_size a time, if buffer_size is 0
                    # or -1, do not return chunks but only the full result set
                    if buffer_size > 0 and len(values["columns"]) >= buffer_size:
                        # Call the callback
                        self.dispatch_result("PENDING", data=values)
                        values = {"columns": []}

                    values['columns'].append(row[0])
                    self._row_count += 1
            except Exception as e:
                logger.exception(e)
                self.dispatch_result("ERROR", message=str(e))
                return

            # Call the callback
            if values['columns']:
                self.dispatch_result("PENDING", data=values)


class SqliteSetCurrentSchemaTask(DbTask):
    def do_execute(self):
        schema_name = self.params[0]
        for (database_name, _) in self.session.databases.items():
            if database_name == schema_name:
                self.session.set_active_schema(schema_name)
                return

        self.dispatch_result(
            "ERROR", message=f"The schema '{self.params[0]}' is invalid")


class SqliteGetAutoCommit(DbTask):
    def do_execute(self):
        try:
            # Since Sqlite does not allow nested transactions, failing to start one,
            # means it's already in a transaction (so auto-commit is disabled).
            # If it succeeds, then auto-transaction is on
            self.session.do_execute("BEGIN TRANSACTION;")
            self.session.do_execute("ROLLBACK;")
            self.dispatch_result("PENDING", data=1)
        except sqlite3.OperationalError as e:
            logger.exception(e)
            self.dispatch_result("PENDING", data=0)
        except Exception as e:
            logger.exception(e)
            self.dispatch_result("ERROR", message=str(e),
                                 data=Response.exception(e))


class SqliteColumnObjectTask(BaseObjectTask):
    def process_result(self):
        _err_msg = f"The {self.type} '{self.name}' does not exist."
        row = self.resultset.fetch_one()

        if not row:
            self.dispatch_result("ERROR", message=_err_msg)
        else:
            self.dispatch_result("PENDING", data=self.format(row))


    def format(self, row):
        result = {
            "name": row['name'],
            "type": row['type'],
            "not_null": row['not_null'],
            "is_pk": row['is_pk'],
            "auto_increment": row['auto_increment'],
        }

        # To maintain compatibility between MySQL and Sqlite,
        # only in certain situations the `default` key is included in the result.
        # See details at DbMySQLSessionTasks.py
        if not row['not_null'] or (row['not_null'] and row['default']):
            result["default"] = row['default']

        return result


class SqliteColumnsMetadataTask(DbQueryTask):
    def process_result(self):
        buffer_size = self.options.get("row_packet_size", 25)
        columns_details = []
        send_empty = True
        for row in self.resultset:
            columns_details.append(self.format(row))

            # Return chunks of buffer_size a time, if buffer_size is 0
            # or -1, do not return chunks but only the full result set
            if buffer_size > 0 and len(columns_details) >= buffer_size:
                self.dispatch_result("PENDING", data=columns_details)
                columns_details = []
                send_empty = False

        if send_empty or len(columns_details) > 0:
            self.dispatch_result("PENDING", data=columns_details)


    def format(self, row):
        result = {
            "schema": row['schema'],
            "table": row['table'],
            "name": row['name'],
            "type": row['type'],
            "not_null": row['not_null'],
            "is_pk": row['is_pk'],
            "auto_increment": row['auto_increment'],
        }

        # To maintain compatibility between MySQL and Sqlite,
        # only in certain situations the `default` key is included in the result.
        # See details at DbMySQLSessionTasks.py
        if not row['not_null'] or (row['not_null'] and row['default']):
            result["default"] = row['default']

        return result


class SqliteColumnsListTask(SqliteColumnsMetadataTask):
    def format(self, row):
        result = {
            "name": row['name'],
            "type": row['type'],
            "not_null": row['not_null'],
            "is_pk": row['is_pk'],
            "auto_increment": row['auto_increment'],
        }

        # To maintain compatibility between MySQL and Sqlite,
        # only in certain situations the `default` key is included in the result.
        # See details at DbMySQLSessionTasks.py
        if not row['not_null'] or (row['not_null'] and row['default']):
            result["default"] = row['default']

        return result
