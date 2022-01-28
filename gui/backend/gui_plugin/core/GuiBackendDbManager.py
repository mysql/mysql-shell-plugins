# Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

import mysqlsh
import sqlite3
import re
from gui_plugin.core.DbSession import DbSessionFactory
from os import makedirs, getcwd, chdir
from datetime import date
from shutil import copyfile
from os import path, listdir, rename, remove
import gui_plugin.core.Logger as logger
from gui_plugin.core.lib.Version import Version


latest_db_version = Version((0, 0, 12))


class BackendDbManager():
    """
    Handles the maintenance tasks on the backend database, including:
    - Deploying
    - Upgrading
    - Log Rotation

    Subclasses of this class handle the specific implementation details
    """

    def __init__(self, log_rotation=False, web_session=None, connection_options=None):
        self._web_session = web_session
        self._connection_options = connection_options

        self.ensure_database_exists()

        # Log rotation verification should be enabled by the caller
        # only at specific locations
        db = self.open_database()
        if log_rotation and self.check_if_logs_need_rotation(db):
            self.backup_logs(db)
        db.close()

    def ensure_database_exists(self):
        if not self.current_database_exist() and not self.check_for_previous_version_and_upgrade():
            self.initialize_db()

    def check_if_logs_need_rotation(self, db):
        sql_message = "SELECT COUNT(id) FROM gui_log.message WHERE date(sent) < date('now');"
        sql_log = "SELECT COUNT(id) FROM gui_log.log WHERE date(event_time) < date('now');"
        old_rows_count = 0
        try:
            res = db.execute(sql_message).fetch_one()
            old_rows_count += int(res[0])

            res = db.execute(sql_log).fetch_one()
            old_rows_count += int(res[0])
        except Exception as e:  # pragma: no cover
            # TODO(rennox): Is this the right way to set the last error?
            db.set_last_error(e)

        return old_rows_count > 0

    def open_database(self):  # pragma: no cover
        raise NotImplementedError()

    def current_database_exist(self):  # pragma: no cover
        raise NotImplementedError()

    def check_for_previous_version_and_upgrade(self):  # pragma: no cover
        raise NotImplementedError()

    def initialize_db(self):  # pragma: no cover
        raise NotImplementedError()

    def backup_logs(self, db):  # pragma: no cover
        raise NotImplementedError()


class BackendSqliteDbManager(BackendDbManager):
    """
    Implementation details for the backend database in Sqlite
    """

    def __init__(self, log_rotation=False, web_session=None, connection_options=None):
        # use ~/.mysqlsh/plugin_data/gui_plugin/mysqlsh_gui_backend_{latest_db_version}.sqlite3
        self.db_dir = mysqlsh.plugin_manager.general.get_shell_user_dir( # pylint: disable=no-member
            'plugin_data', 'gui_plugin')

        self.current_dir = getcwd()

        super().__init__(log_rotation=log_rotation,
                         web_session=web_session,
                         connection_options=connection_options if connection_options is not None else {
                             "database_name": "main",
                             "db_file": path.join(self.db_dir, f'mysqlsh_gui_backend_{latest_db_version}.sqlite3'),
                             "attach": [
                                 {
                                     "database_name": "gui_log",
                                     "db_file": path.join(self.db_dir, f'mysqlsh_gui_backend_log_{latest_db_version}.sqlite3')
                                 }]
                         })

    def open_database(self):
        return DbSessionFactory.create(
            "Sqlite", "anonymous" if self._web_session is None else self._web_session.session_uuid,
            False,
            self._connection_options)

    def current_database_exist(self):
        return path.isfile(self._connection_options["db_file"])

    def check_for_previous_version_and_upgrade(self):
        latest_version_val = Version()
        version_to_upgrade = Version()

        makedirs(self.db_dir, exist_ok=True)

        # find the latest version of the database file available
        for f in listdir(self.db_dir):
            m = re.match(
                r'mysqlsh_gui_backend_(\d+)\.(\d+)\.(\d+)\.sqlite3', f)
            if m:
                g = Version(m.groups())
                if g > latest_version_val or latest_version_val == (0, 0, 0):
                    latest_version_val = g
                    version_to_upgrade = g

        # if no earlier version is found, return with False
        if latest_version_val == (0, 0, 0):
            return False

        # Because we don't know the full path in the script,
        # we have to change working directory so that new 'mysqlsh_gui_backend_log`
        # is created in the appropriate location.
        chdir(self.db_dir)
        try:
            # run updates until ending up at current version
            script_dir = path.join(path.dirname(__file__), 'db_schema')
            # init upgrade_file_found with True to enter while loop
            upgrade_file_found = True
            while version_to_upgrade != latest_db_version and upgrade_file_found:
                # set upgrade_file_found to False to ensure execution will not be
                # stuck in this loop forever
                upgrade_file_found = False
                for f in listdir(script_dir):
                    m = re.match(
                        r'mysqlsh_gui_backend_(\d+\.\d+\.\d+)_to_'
                        r'(\d+\.\d+\.\d+)\.sqlite.sql', f)
                    if m:
                        g = m.groups()

                        update_from_version = Version(g[0])
                        upgrade_to_version = Version(g[1])
                        if version_to_upgrade == update_from_version:
                            upgrade_file_found = True
                            # copy the existing db, rename the old to .backup
                            db_file = path.join(self.db_dir,
                                                f'mysqlsh_gui_backend_{version_to_upgrade}.sqlite3')
                            upgrade_db_file = path.join(self.db_dir,
                                                        f'mysqlsh_gui_backend_{upgrade_to_version}.sqlite3')
                            copyfile(db_file, upgrade_db_file)
                            rename(db_file, f'{db_file}.backup')
                            # In BE db newer than 0.0.7 we have to take care also mysqlsh_gui_backend_log_x database
                            if upgrade_to_version >= (0, 0, 7) and update_from_version >= (0, 0, 7):
                                upgrade_db_log_file = path.join(self.db_dir,
                                                            f'mysqlsh_gui_backend_log_{upgrade_to_version}.sqlite3')
                                db_log_file = path.join(self.db_dir,
                                                f'mysqlsh_gui_backend_log_{version_to_upgrade}.sqlite3')
                                copyfile(db_log_file, upgrade_db_log_file)
                                rename(db_log_file, f'{db_log_file}.backup')
                            try:
                                with open(path.join(script_dir, f),
                                          'r') as sql_file:
                                    sql = sql_file.read()

                                conn = sqlite3.connect(upgrade_db_file)
                                conn.execute("VACUUM")
                                cursor = conn.cursor()

                                cursor.executescript(sql)
                                conn.commit()
                                conn.close()

                                version_to_upgrade = upgrade_to_version
                            except Exception as e:
                                conn.rollback()
                                conn.close()
                                # move the files back
                                remove(f'{upgrade_db_file}-shm')
                                remove(f'{upgrade_db_file}-wal')
                                remove(upgrade_db_file)
                                rename(f'{db_file}.backup', db_file)

                                # move the log files back
                                if upgrade_to_version >= (0, 0, 7) and update_from_version >= (0, 0, 7):
                                    remove(upgrade_db_log_file)
                                    rename(f'{db_log_file}.backup', db_log_file)

                                # logger.error(f'Cannot upgrade database. {e}')
                                raise e
        finally:
            chdir(self.current_dir)

        if version_to_upgrade != latest_db_version and not upgrade_file_found:
            raise Exception(f'No upgrade file found to go from database '  # pragma: no cover
                            f'schema {version_to_upgrade} to {latest_db_version}')

        return True

    def initialize_db(self):
        sql_file_path = path.join(path.dirname(__file__), 'db_schema',
                                  f'mysqlsh_gui_backend_{latest_db_version}.sqlite.sql')

        try:
            conn = sqlite3.connect(self._connection_options["db_file"])
            cursor = conn.cursor()

            # Do a fresh initialization of the database
            with open(sql_file_path, 'r') as sql_file:
                sql = sql_file.read()

            # Because we don't know the full path in the script,
            # we have to change working directory so that new 'mysqlsh_gui_backend_log`
            # is created in the appropriate location.
            chdir(self.db_dir)
            cursor.executescript(sql)
            conn.commit()
        except Exception as e:  # pragma: no cover
            conn.rollback()
            logger.error(f'Cannot initialize database. {e}')
            raise e from None
        finally:
            conn.close()
            chdir(self.current_dir)

    def backup_logs(self, db):

        # check files, remove oldest if count > 6
        backup_files = []
        for f in listdir(self.db_dir):
            m = re.match(
                r'\d+\.\d+\.\d+_mysqlsh_gui_backend_log_(\d+)\.(\d+)\.(\d+)\.sqlite3', f)
            if m:
                g = m.groups()
                version = Version(g[0])

                if latest_db_version == version:
                    backup_files.append(f)

        while len(backup_files) > 6:
            file_to_remove = sorted(backup_files)[0]
            remove(file_to_remove)
            backup_files.remove(file_to_remove)

        try:
            # create new backup file
            # attach it to db as backup
            new_filename = path.join(self.db_dir,
                                     f"{date.today().strftime('%Y.%m.%d')}_mysqlsh_gui_backend_log_{latest_db_version}.sqlite3")
            db.execute(
                f"ATTACH DATABASE '{new_filename}' as 'backup';")

            db.start_transaction()

            # create tables and copy data
            # from log and message to backup db
            copy_sql = """CREATE TABLE `backup`.`log` AS
                            SELECT *
                            FROM `gui_log`.`log`
                            WHERE date(`event_time`) < date('now')"""
            db.execute(copy_sql)

            copy_sql = """CREATE TABLE `backup`.`message` AS
                            SELECT *
                            FROM `gui_log`.`message`
                            WHERE date(`sent`) < date('now')"""
            db.execute(copy_sql)

            # delete old logs and messages
            delete_sql = """DELETE FROM `gui_log`.`log`
                            WHERE date(`event_time`) < date('now')"""
            db.execute(delete_sql)

            delete_sql = """DELETE FROM `gui_log`.`message`
                            WHERE date(`sent`) < date('now')"""
            db.execute(delete_sql)
            db.commit()

            # detach backup db. can not detach inside a transaction.
            db.execute(f"DETACH DATABASE 'backup';")

        except Exception as e:  # pragma: no cover
            logger.error(f"Exception caught during log backup: {e}")
            # TODO(rennox): Is this the right way to set the last error?
            db.set_last_error(e)
            db.rollback()
