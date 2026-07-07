# Copyright (c) 2012, 2026, Oracle and/or its affiliates.
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
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from __future__ import annotations

import mysqlsh
from typing import Any

import gui_plugin.core.Logger as logger


class BackupContent:
    def __init__(self, context: Any, from_backup: bool = False) -> None:
        self._context: Any = context
        self._from_backup: bool = from_backup;

        self._schema_data: dict[str, dict[str, Any]] = {}
        self._sorted_schemas: list[str] = []

        self._db_data_loaded: bool = False

    def load_db_data(self) -> None:
        if not self._db_data_loaded:
            self.load_db_schema_list()
            self.load_db_table_list()
            self._db_data_loaded = True

    def load_db_schema_list(self) -> None:

        ignored_schemas = ['INFORMATION_SCHEMA']

        if self._context.has_connection:
            try:
                result = self._context.session.run_sql("SHOW DATABASES;")

                if result is not None:
                    for row in iter(result.fetch_one, None):
                        schema_name = str(row[0])
                        if schema_name.upper() not in ignored_schemas:
                            self._schema_data[schema_name] = {"include":False, "tables" : {}, "sorted_tables" : [], "on_db" : True}
                            self._sorted_schemas.append(schema_name)

                    self._sorted_schemas.sort()

            except mysqlsh.DBError as err:
                logger.error("Error retrieving schema list: %s\n" % str(err))
                raise


    # This method will load the table information associated to each of the already loaded schemas
    def load_db_table_list(self) -> None:
        if self._context.has_connection:
            for schema in list(self._schema_data.keys()):
                try:
                    result = self._context.session.run_sql(
                        "SHOW TABLE STATUS FROM ! WHERE Engine IS NOT NULL;",
                        [schema],
                    )

                    if result is not None:
                        for row in iter(result.fetch_one, None):
                            table_name = str(row[0])
                            self._schema_data[schema]["tables"][table_name] = {"include" : False, "engine" : str(row[1]), "length" : int(row[6]), "on_db" : True}
                            self._schema_data[schema]["sorted_tables"].append(table_name)

                        # If the schema has tables they are sorted, if not, the schema is removed
                        if len(self._schema_data[schema]["sorted_tables"]):
                            self._schema_data[schema]["sorted_tables"].sort()
                        else:
                            del self._schema_data[schema]
                            self._sorted_schemas.remove(schema)


                except mysqlsh.DBError as err:
                        #TODO : log proper error here...
                        raise

            # Updates the tablespace information on the InnoDB tables
            try:
                if self._context.target.version_parts >= (8, 0, 0):
                    result = self._context.session.run_sql("SELECT name, space FROM information_schema.innodb_tables;")
                else:
                    result = self._context.session.run_sql("SELECT name, space FROM information_schema.innodb_sys_tables;")
                if result is not None:
                    for row in iter(result.fetch_one, None):
                        full_table = str(row[0]);
                        table_space = int(row[1])

                        tokens = full_table.split("/")

                        # Verifies that the retrieved table is valid on the schema, then sets the new information
                        if len(tokens) == 2 and \
                           tokens[0] in self._schema_data and \
                           tokens[1] in self._schema_data[tokens[0]]["tables"]:
                              self._schema_data[tokens[0]]["tables"][tokens[1]]["table_space"] = table_space;
                              self._schema_data[tokens[0]]["tables"][tokens[1]]["include"] = (False if self._from_backup else (table_space == 0));
            except mysqlsh.DBError as err:
                # If the global variable innodb_file_per_table has never been set
                # the table does not exist, in such case it is ok to continue
                if getattr(err, "code", None) != 1109:
                    raise

    def include_schema(self, schema: str, include: bool) -> None:
        if schema in self._schema_data:
            self._schema_data[schema]["include"] = include
        else:
            self._schema_data[schema] = {"include":False, "tables" : {}, "sorted_tables" : [], "on_db" : False}
            self._sorted_schemas.append(schema)
            self._sorted_schemas.sort()

    def include_table(self, schema: str, table: str, include: bool, engine: str = "Unknown") -> bool:
        ret_val = True

        # If the schema is not present, it is added as non existing on the db
        if schema not in self._schema_data:
            self.include_schema(schema, False)

        # If the table is not present, it is added as non existing on the db
        if table not in self._schema_data[schema]["tables"]:
            self._schema_data[schema]["tables"][table] = {"include" : include, "engine" : engine, "table_space" : -1, "length" : 0, "on_db" : False}
            self._schema_data[schema]["sorted_tables"].append(table)
            self._schema_data[schema]["sorted_tables"].sort()
        else:
            if  not include and \
                self._schema_data[schema]["tables"][table]["engine"] == "InnoDB" and \
                self._schema_data[schema]["tables"][table]["table_space"] == 0:
                    ret_val = False
            else:
                self._schema_data[schema]["tables"][table]["include"]=include

        return ret_val
