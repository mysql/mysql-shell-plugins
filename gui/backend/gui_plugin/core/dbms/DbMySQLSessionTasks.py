# Copyright (c) 2021, 2022 Oracle and/or its affiliates.
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

from gui_plugin.core.DbSessionTasks import DbQueryTask
from gui_plugin.core.DbSessionTasks import  BaseObjectTask, DbSqlTask
from gui_plugin.core.Error import MSGException
import gui_plugin.core.Error as Error

class MySQLOneFieldTask(DbQueryTask):
    def process_result(self):
        if self.resultset.has_data():
            row = self.resultset.fetch_one()
            self.dispatch_result("OK", data=row[0])
        else:
            # TODO(rennox): Is this the case for an empty set?
            # If so, should the default value be provided by the caller?
            self.dispatch_result("OK", data="")

class MySQLBaseObjectTask(BaseObjectTask):
    def process_result(self):
        if self.resultset.has_data():
            row = self.resultset.fetch_one()

            if not row:
                self.dispatch_result("ERROR", message=f"The {self.type} '{self.name}' does not exist.")
            else:
                self.dispatch_result("OK", data=self.format(row))
        else:
            self.dispatch_result("ERROR", message=f"The {self.type} '{self.name}' does not exist.")


class MySQLTableObjectTask(BaseObjectTask):
    def format(self, row):
        if row:
            return {"name": row[0]}

        return {"name": ""}

    def process_result(self):
        if self._sql_index == 0:
            if self.resultset.has_data():
                row = self.resultset.fetch_one()

                if not row:
                    self._break = True
                    self.dispatch_result("ERROR", message=f"The table '{self.name}' does not exist.")
                else:
                    self.dispatch_result("PENDING", data=self.format(row))
            else:
                self._break = True
                self.dispatch_result("ERROR", message=f"The table '{self.name}' does not exist.")
        else:
            # Process result set
            buffer_size = self.options.get("row_packet_size", 25)

            values = {"columns": []}

            try:
                # Loop over all rows
                for row in self.session.row_generator():
                    if self.session.is_killed():
                        raise MSGException(Error.DB_QUERY_KILLED, "Query killed")


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
            self.dispatch_result("OK", data=values)

class MySQLOneFieldListTask(DbQueryTask):
    def process_result(self):
        buffer_size = self.options.get("row_packet_size", 25)
        name_list = []
        if self.resultset.has_data():
            row = self.resultset.fetch_one()
            while row:
                name_list.append(row[0])
                row = self.resultset.fetch_one()

                # Return chunks of buffer_size a time, if buffer_size is 0
                # or -1, do not return chunks but only the full result set
                if buffer_size > 0 and len(name_list) >= buffer_size:
                    if row:
                        self.dispatch_result("PENDING", data=name_list)
                        name_list = []
                    else:
                        self.dispatch_result("OK", data=name_list)
                        return

        self.dispatch_result("OK", data=name_list)