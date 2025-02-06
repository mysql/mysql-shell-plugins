# Copyright (c) 2021, 2025 Oracle and/or its affiliates.
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

import gui_plugin.core.Error as Error
from gui_plugin.core.dbms.DbSessionTasks import BaseObjectTask, DbQueryTask
from gui_plugin.core.Error import MSGException


class MySQLOneFieldTask(DbQueryTask):
    def process_result(self):
        data = None
        if self.resultset.has_data():
            row = self.resultset.fetch_one()
            data = row[0]

        self.dispatch_result("PENDING", data=data)


class MySQLBaseObjectTask(BaseObjectTask):
    def process_result(self):
        _err_msg = f"The {self.type} '{self.name}' does not exist."
        if self.resultset.has_data():
            row = self.resultset.fetch_one()

            if not row:
                self.dispatch_result("ERROR", message=_err_msg)
            else:
                self.dispatch_result("PENDING", data=self.format(row))
        else:
            self.dispatch_result("ERROR", message=_err_msg)


class MySQLTableObjectTask(BaseObjectTask):
    def format(self, row):
        if row:
            return {"name": row[0]}

        return {"name": ""}

    def process_result(self):
        if self._sql_index == 0:
            _err_msg = f"The table '{self.name}' does not exist."
            if self.resultset.has_data():
                row = self.resultset.fetch_one()

                if not row:
                    self._break = True
                    self.dispatch_result("ERROR", message=_err_msg)
                else:
                    self.dispatch_result("PENDING", data=self.format(row))
            else:
                self._break = True
                self.dispatch_result("ERROR", message=_err_msg)
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
                self.dispatch_result("ERROR", message=str(e))
                return

            # Call the callback
            if values['columns']:
                self.dispatch_result("PENDING", data=values)

class MySQLColumnObjectTask(BaseObjectTask):
    def format(self, row):
        result = {
            "name": row.get_field("name"),
            "type": row.get_field("type"),
            "not_null": row.get_field("not_null"),
            "is_pk": row.get_field("is_pk"),
            "auto_increment": row.get_field("auto_increment"),
        }

        # When a table column is created, information about the default value is stored in `information_schema.columns`
        # and if the creating SQL statement does not contain the DEFAULT keyword, the default value is assumed to be NULL,
        # even if the NOT NULL flag has been added. That leads to situation where is impossible to distinguish
        # between two scenarios:
        #   1. In create statement was used DEFAULT NULL
        #   2. Create statement wasn't contain DEFAULT at all
        # For both there is one result: default value is considered as NULL.
        # The problem is that when combined with a NOT NULL value for a column,
        # situations can arise where the combination does not make sense. Consider the following cases:
        # - NOT NULL is False and DEFAULT is NULL or not specified:
        #       this combination is fine, there is no conflict, the `default` key is part of the result
        #       and contains value from `information_schema.columns`
        # - NOT NULL is False and DEFAULT is NOT NULL:
        #       this combination is also fine, there is no conflict, the `default` key is part of the result
        #       and contains value from `information_schema.columns`
        # - NOT NULL is True and DEFAULT is NOT NULL:
        #       here too there is nothing to worry about, there is no conflict,
        #       the `default` key is part of the result and contains value from `information_schema.columns`
        # - NOT NULL is True and DEFAULT is not specified:
        #       unfortunately, this combination leads to an error,
        #       if the insertion of a value into the table was omitted for this column,
        #       we would get an SQL error because the value of the column can not be NULL,
        #       and the default value is just NULL. To avoid this situation, the `default` key
        #       is omitted from the result and is treated as if the DEFAULT value had never been defined.
        if not row.get_field("not_null") or (row.get_field("not_null") and row.get_field("default")):
            result["default"] = row.get_field("default")

        return result

    def process_result(self):
        _err_msg = f"The {self.type} '{self.name}' does not exist."
        if self.resultset.has_data():
            row = self.resultset.fetch_one()

            if not row:
                self.dispatch_result("ERROR", message=_err_msg)
            else:
                self.dispatch_result("PENDING", data=self.format(row))
        else:
            self.dispatch_result("ERROR", message=_err_msg)

class MySQLColumnsMetadataTask(DbQueryTask):
    def format(self, row):
        result = {
            "schema": row.get_field("schema"),
            "table": row.get_field("table"),
            "name": row.get_field("name"),
            "type": row.get_field("type"),
            "not_null": row.get_field("not_null"),
            "is_pk": row.get_field("is_pk"),
            "auto_increment": row.get_field("auto_increment"),
        }

        # See explanation on MySQLColumnObjectTask class
        if not row.get_field("not_null") or (row.get_field("not_null") and row.get_field("default")):
            result["default"] = row.get_field("default")

        return result

    def process_result(self):
        buffer_size = self.options.get("row_packet_size", 25)
        columns_details = []
        send_empty = True
        if self.resultset.has_data():
            row = self.resultset.fetch_one()
            while row:
                columns_details.append(self.format(row))
                row = self.resultset.fetch_one()

                # Return chunks of buffer_size a time, if buffer_size is 0
                # or -1, do not return chunks but only the full result set
                if not row or (buffer_size > 0 and len(columns_details) >= buffer_size):
                    self.dispatch_result("PENDING", data=columns_details)
                    columns_details = []
                    send_empty = False

        if send_empty or len(columns_details) > 0:
            self.dispatch_result("PENDING", data=columns_details)

class MySQLOneFieldListTask(DbQueryTask):
    def process_result(self):
        buffer_size = self.options.get("row_packet_size", 25)
        name_list = []
        send_empty = True
        if self.resultset.has_data():
            row = self.resultset.fetch_one()
            while row:
                name_list.append(row[0])
                row = self.resultset.fetch_one()

                # Return chunks of buffer_size a time, if buffer_size is 0
                # or -1, do not return chunks but only the full result set
                if not row or (buffer_size > 0 and len(name_list) >= buffer_size):
                    self.dispatch_result("PENDING", data=name_list)
                    name_list = []
                    send_empty = False

        if send_empty or len(name_list) > 0:
            self.dispatch_result("PENDING", data=name_list)


class MySQLColumnsListTask(MySQLColumnsMetadataTask):
    def format(self, row):
        result = {
            "name": row.get_field("name"),
            "type": row.get_field("type"),
            "not_null": row.get_field("not_null"),
            "is_pk": row.get_field("is_pk"),
            "auto_increment": row.get_field("auto_increment"),
        }

        # See explanation on MySQLColumnObjectTask class
        if not row.get_field("not_null") or (row.get_field("not_null") and row.get_field("default")):
            result["default"] = row.get_field("default")

        return result

class MySQLRoutinesListTask(MySQLColumnsMetadataTask):
    def format(self, row):
        result = {
            "name": row.get_field("name"),
            "type": row.get_field("type"),
            "language": row.get_field("language"),
        }

        return result