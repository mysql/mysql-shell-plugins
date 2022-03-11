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

from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module
import gui_plugin.core.Logger as logger
import re
import json
import datetime
from os import path, listdir
from pathlib import Path
from .Protocols import Response
from .GuiBackendDbManager import BackendSqliteDbManager
from gui_plugin.core import Error


class BackendDatabase():
    def __init__(self, web_session=None, log_rotation=False):
        self.web_session = web_session
        self.log_rotation = log_rotation

    def __enter__(self):
        if self.web_session is None:
            self.db = GuiBackendDb(
                log_rotation=self.log_rotation, web_session=self.web_session)
        else:
            self.db = self.web_session.db

        return self.db

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type:
            logger.exception(exc_value)
        if self.web_session is None:
            self.db.close()


class BackendTransaction():
    def __init__(self, db):
        self._db = db

    def __enter__(self):
        self._db.start_transaction()

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type:
            self._db.rollback()
        else:
            self._db.commit()


class GuiBackendDb():
    """
    Interface to handle CRUD operations on the Backend Database
    """

    def __init__(self, log_rotation=False, web_session=None, check_same_thread=True):
        # Creates the database manager which will do the automatic maintenance tasks:
        # - Database Initialization
        # - Log Rotation: should be enabled only on specific instances of the backend database
        #                 such as the one created on the start.py file or when a web session
        #                 is established
        # TODO(rennox): Identify logic to determine whether this should be an SqliteDbManager
        # or a MySQLDbManager

        backend_db_manager = BackendSqliteDbManager(
            log_rotation=log_rotation,
            web_session=web_session,
            check_same_thread=check_same_thread)

        # Opens the session to the backend database
        self._db = backend_db_manager.open_database()

    def execute(self, sql, params=None):
        return self._db.execute(sql, params)

    def get_last_row_id(self):
        return self._db.get_last_row_id()

    def start_transaction(self):
        self._db.start_transaction()

    def commit(self):
        self._db.commit()

    def rollback(self):
        self._db.rollback()

    def close(self):
        self._db.close()

    def commit_and_close(self):
        self._db.commit()
        self._db.close()

    def rollback_and_close(self):
        self.rollback()
        self.close()

    def insert(self, sql, params=None, commit=None, close=None):
        last_id = None
        status = None
        try:
            self.execute(sql, params)
            last_id = self.get_last_row_id()
        except Exception as e:  # pragma: no cover
            # TODO(rennox): Is this the right way to set the last error?
            self._db.set_last_error(str(e))

        status = self._db.get_last_status()

        if commit:
            self.commit()

        if close:
            self.close()

        return Response.standard(status['type'], status['msg'], {"id": last_id})

    def select(self, sql, params=None, close=None):
        res = None
        rows = []
        try:
            resultset = None
            if params:
                resultset = self.execute(sql, params)
            else:
                resultset = self.execute(sql)
            res = resultset.fetch_all()
            for row in res:
                # check if one of the fields could be JSON, and if so, convert
                # it to a dict if possible
                row_dict = dict(row)
                for key, val in row_dict.items():
                    if isinstance(val, str):
                        if val.startswith('{') and val.endswith('}'):
                            try:
                                row_dict[key] = json.loads(val)
                            except ValueError as e:  # pragma: no cover
                                pass

                rows.append(row_dict)

        except Exception as e:  # pragma: no cover
            # TODO(rennox): Is this the right way to set the last error?
            self._db.set_last_error(e)

        status = self._db.get_last_status()

        if close:
            self.close()

        return Response.fromStatus(status, {"rows": rows})

    def get_last_status(self):
        return self._db.get_last_status()

    def get_connection_details(self, db_connection_id):
        """
        Returns a tuple with the type and options for the given connection_id
        """
        res = self.execute('''SELECT db_type, options
                                FROM db_connection
                                WHERE id = ?''',
                        (db_connection_id,)).fetch_one()
        if not res:
            raise Error.MSGException(Error.DB_INVALID_CONNECTION_ID,
                                    f'There is no db_connection with the id {db_connection_id}.')

        db_type = None
        options = None

        try:
            db_type = res['db_type']

            options = json.loads(res['options'])
        except ValueError as e:
            raise Error.MSGException(Error.DB_INVALID_OPTIONS,
                                    f'The connection options are not valid JSON. {e}.')

        return (db_type, options)

    @property
    def rows_affected(self):
        return self._db.rows_affected

    def log(self, event_type, message):
        # insert this message into the log table
        self._db.execute('''INSERT INTO `gui_log`.`log`(event_time, event_type, message) VALUES(?, ?, ?)''',
                        (datetime.datetime.now(), event_type, message))

    def message(self, session_id, is_response, message, request_id):
        self._db.execute('''INSERT INTO `gui_log`.`message`(session_id, request_id, is_response,
            message, sent) VALUES(?, ?, ?, ?, ?)''',
                        (session_id, request_id, is_response, message, datetime.datetime.now()))


def convert_workbench_sql_to_sqlite(sql):
    sql = re.sub(r'(;\n;)', ';', sql)
    sql = re.sub(r'(\n\s*ENGINE\s+=\s+InnoDB\s*)', '', sql)
    sql = re.sub(r'(\sVISIBLE)', '', sql)
    sql = re.sub(r'(\sINT\s)', ' INTEGER ', sql)
    sql = re.sub(r'(START\s)', 'BEGIN ', sql)
    sql = re.sub(r'(\sAFTER\s`\w*`)', '', sql)
    sql = re.sub(r'(`default_schema`\.)', '', sql)
    sql = re.sub(r'(DEFAULT\s+CHARACTER\s+SET\s*=\s*utf8)', '', sql)
    sql = re.sub(r'(\s+DEFAULT\s+NULL)', '', sql)
    sql = re.sub(r'(^SET\s\@OLD_FOREIGN_KEY_CHECKS.*\=0;$)',
                 'PRAGMA foreign_keys = OFF;', sql, flags=re.MULTILINE)
    sql = re.sub(r'(^SET\sFOREIGN_KEY_CHECKS.*$)',
                 'PRAGMA foreign_keys = ON;', sql, flags=re.MULTILINE)
    sql = re.sub(r'(^SET.*$)', '', sql, flags=re.MULTILINE)
    sql = re.sub(r'(-- ATTACH DATABASE )', 'ATTACH DATABASE ', sql)

    return sql


@plugin_function('gui.core.convertWorkbenchSqlFileToSqlite')
def convert_workbench_sql_file_to_sqlite(mysql_sql_file_path):
    """Converts a MySQL SQL file to Sqlite syntax.

    Args:
        mysql_sql_file_path (str): The MySQL SQL file

    Returns:
        Nothing
    """
    try:
        with open(mysql_sql_file_path, 'r') as mysql_sql_file:
            sql = mysql_sql_file.read()

        sql = convert_workbench_sql_to_sqlite(sql)

        # Break apart multi ADD statements for ALTER TABLE
        # NOTE: one must never remove something from a table, only add
        prev_version_sql = ''
        alter_tables = re.findall(
            r'(ALTER\s+TABLE\s*(`[\w\d]*`)\s+((.|\n)*?);)', sql,
            flags=re.MULTILINE)
        for g in alter_tables:
            old_alter_table_stmt = g[0]
            new_alter_table_stmt = g[0]
            alter_table_stmt = ''
            table_name = g[1]
            # Add a , so the last action can be matched till , as well
            actions = f'{g[2]},'

            # Deal with ADD COLUMN actions
            actions_m = re.findall(
                r'(ADD\s+COLUMN\s+([`\w_\d\s\(\)]*)),',
                # r'(ADD\s+COLUMN\s+(([`\w_\d]+)[`\w_\d\s\(\)]*)),',
                actions, flags=re.MULTILINE)
            if actions_m:
                for g in actions_m:
                    alter_table_stmt = f'{alter_table_stmt}' \
                        f'ALTER TABLE {table_name}\n' \
                        f'  ADD COLUMN {g[1]};\n\n'

                    new_alter_table_stmt = re.sub(
                        re.escape(g[0]) + r'[,]*', '',
                        new_alter_table_stmt, flags=re.MULTILINE)

            # Deal with ADD INDEX actions
            actions_m = re.findall(
                r'(ADD\s+INDEX\s+([`\w_\d]*)\s*([\(\)`\w_\d\s]+)+\s*),',
                actions, flags=re.MULTILINE)
            if actions_m:
                for g in actions_m:
                    alter_table_stmt = f'{alter_table_stmt}' \
                        f'CREATE INDEX {g[1]} ON {table_name} {g[2]};\n\n'

                    new_alter_table_stmt = re.sub(
                        re.escape(g[0]) + r'[,]*', '',
                        new_alter_table_stmt, flags=re.MULTILINE)

            # If there are ADD CONSTRAINT actions, keep the cleaned up
            # ALTER TABLE for them
            add_constraints = re.findall(
                r'(ADD\s+(CONSTRAINT\s+(.|\n)*?),)',
                actions, flags=re.MULTILINE)
            if add_constraints:
                # As soon as there is a single ADD CONSTRAINT that Sqlite cannot
                # handle, the existing table has to be replaced by the new one

                # Get the original CREATE TABLE statement
                if prev_version_sql == '':
                    # If the previous SQL has not been fetched already, fetch
                    # it now
                    # file_dir = path.dirname(mysql_sql_file_path)
                    file_name = path.basename(mysql_sql_file_path)
                    filename_match = re.match(
                        r'(.*?)(\d+\.\d+\.\d+)_to_(\d+\.\d+\.\d+)((.|\.)*)',
                        file_name)
                    if not filename_match:
                        # cspell:ignore myschema
                        raise Exception(f'The file contains an ALTER TABLE '
                                        f'statement but the filename {file_name} does '
                                        f'not include the previous and the next version '
                                        f'number, e.g. myschema_1.0.3_to_1.0.4.mysql.sql')

                    g = filename_match.groups()
                    previous_version_file_path = path.join(
                        path.dirname(mysql_sql_file_path),
                        g[0] + g[1] + g[3])
                    if not Path(previous_version_file_path).is_file():
                        raise Exception(f'The file contains an ALTER TABLE '
                                        f'statement but the sql file for the previous '
                                        f'version {previous_version_file_path} cannot '
                                        f'be found.')

                    with open(previous_version_file_path, 'r') as prev_sql_file:
                        prev_version_sql = prev_sql_file.read()

                original_create_table_m = re.findall(
                    r'(CREATE\s+TABLE.*' + re.escape(table_name) +
                    r'\s*\((.|\n)*?;)',
                    prev_version_sql, flags=re.MULTILINE)
                if not original_create_table_m:
                    raise Exception(f'CREATE TABLE {table_name} statement not '
                                    f'found in previous sql file '
                                    f'{previous_version_file_path}.')

                original_create_table = convert_workbench_sql_to_sqlite(
                    original_create_table_m[0][0])

                tn = table_name[1:-1]

                # rename table to {tablename}_tmp
                tmp_create_table = re.sub(re.escape(f'`{tn}`'),
                                          f'`{tn}__tmp__`', original_create_table,
                                          flags=re.MULTILINE)

                # Get all column names of previous table
                columns = re.findall(r'^\s*(`[\w_\d]*`)',
                                     original_create_table, flags=re.MULTILINE)
                column_list = ', '.join(columns)

                # add script for table upgrade, like outlined here:
                # https://www.sqlite.org/lang_altertable.html
                replacement_script = f'-- Add constraints to table {tn}\n' \
                    f'{tmp_create_table};\n' \
                    f'INSERT INTO `{tn}__tmp__`({column_list})' \
                    f' SELECT {column_list} FROM `{tn}`;\n' \
                    f'DROP TABLE `{tn}`;\n' \
                    f'ALTER TABLE `{tn}__tmp__` RENAME TO `{tn}`' \
                    f';\n\n'

                sql = re.sub(re.escape(old_alter_table_stmt),
                             replacement_script, sql, flags=re.MULTILINE)

            if alter_table_stmt != '':
                sql = re.sub(re.escape(old_alter_table_stmt), alter_table_stmt,
                             sql, flags=re.MULTILINE)

        # Break out CREATE INDEX statement from CREATE TABLE
        # CREATE TABLE IF NOT EXISTS `user_group_has_user` (
        #   ...
        #   INDEX `fk_user_group_has_user_user1` (`user_id` ASC),
        #   ...
        create_tables = re.findall(
            r'(CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s*(`\w*`'
            r')\s*\(\s*((.|\n)*?);)',
            sql, flags=re.MULTILINE)
        for g in create_tables:
            old_create_table_stmt = g[0]
            new_create_table_stmt = g[0]
            alter_index_stmt = ''
            table_name = g[1]
            actions = g[2]

            # Deal with ADD INDEX actions
            # INDEX `fk_user_group_has_user_user1` (`user_id` ASC),
            actions_m = re.findall(
                r'((UNIQUE\s+)*INDEX\s+([`\w_\d]*)\s+\s*(\('
                r'[`\w_\d\s,]+\))\s*,\s*)',
                actions, flags=re.MULTILINE)
            if actions_m:
                for g in actions_m:
                    index_line = g[0]

                    # If the table ends with __tmp__, remove that ending
                    # since it was only added for the ALTER TABLE workaround
                    if table_name.endswith('__tmp__'):
                        table_name = table_name[0:-7]

                    alter_index_stmt = f'{alter_index_stmt}' \
                        f'CREATE {g[1]}INDEX {g[2]} ON {table_name} {g[3]};\n\n'

                    # remove
                    new_create_table_stmt = re.sub(re.escape(index_line), '',
                                                   new_create_table_stmt, flags=re.MULTILINE)

            if alter_index_stmt != '':
                sql = re.sub(re.escape(old_create_table_stmt),
                             f'{new_create_table_stmt}\n\n{alter_index_stmt}\n',
                             sql, flags=re.MULTILINE)

        sqlite_sql_file_path = re.sub(r'(\.mysql\.)', '.sqlite.',
                                      mysql_sql_file_path)

        with open(sqlite_sql_file_path, 'w') as sqlite_sql_file:
            sqlite_sql_file.write(sql)

    except Exception as e:  # pragma: no cover
        logger.error(f'Cannot convert file. {e}')


@plugin_function('gui.core.convertAllWorkbenchSqlFilesToSqlite')
def convert_all_workbench_sql_files_to_sqlite(directory=None):
    """Converts all MySQL SQL file of the gui module to Sqlite.

    Args:
        directory (str): The directory path

    Returns:
        Nothing
    """
    if not directory:
        directory = path.join(path.dirname(
            path.abspath(__file__)), 'db_schema')

    # loop over all *.mysql.sql files in ./db_schema
    for f_name in listdir(directory):
        if path.isfile(path.join(directory, f_name)) and \
                f_name.endswith('.mysql.sql'):
            logger.debug(f'Converting {f_name}...')
            convert_workbench_sql_file_to_sqlite(path.join(directory, f_name))
