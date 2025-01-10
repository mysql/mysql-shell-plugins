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

import contextlib
import os
import pathlib
import re
import sqlite3
import stat
from datetime import date
from os import chdir, getcwd, listdir, makedirs, path, remove, rename

import mysqlsh

import gui_plugin.core.Logger as logger
from gui_plugin.core import Error
from gui_plugin.core.dbms import DbSessionFactory
from gui_plugin.core.lib.Version import Version

# Refers to the schema version supported by this version of the code
CURRENT_DB_VERSION = Version((0, 0, 19))
# Do not change it, it was dropped in 0.0.16 and that is valid value
DROPPED_VERSION_IN_NAME_DB_VERSION = Version((0, 0, 16))
OLDEST_SUPPORTED_DB_VERSION = Version((0, 0, 11))
DEFAULT_CONFIG = {
    "log_rotation_period": 7
}


class BackendDbManager():
    """
    Handles the maintenance tasks on the backend database, including:
    - Deploying
    - Upgrading
    - Log Rotation

    Subclasses of this class handle the specific implementation details
    """

    def __init__(self, log_rotation=False, session_uuid=None, connection_options=None):
        self._session_uuid = session_uuid
        self._connection_options = connection_options

        self._config = DEFAULT_CONFIG

        self.ensure_database_exists()

        # Log rotation verification should be enabled by the caller
        # only at specific locations
        db = self.open_database()
        if log_rotation and self.check_if_logs_need_rotation(db):
            self.backup_logs(db)
        db.close()

    def ensure_database_exists(self):
        if not self.current_database_exist():
            self.initialize_db()
        else:
            self.check_for_previous_version_and_upgrade()

    def check_if_logs_need_rotation(self, db):
        sql_message = "SELECT COUNT(sent) FROM `gui_log`.`message` WHERE date(sent) < date('now');"
        sql_log = "SELECT COUNT(event_time) FROM `gui_log`.`log` WHERE date(event_time) < date('now');"
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

    def __init__(self, log_rotation=False, session_uuid=None, connection_options=None):
        if connection_options and "db_dir" in connection_options:
            self.db_dir = connection_options["db_dir"]
        else:
            # use ~/.mysqlsh/plugin_data/gui_plugin/mysqlsh_gui_backend_{CURRENT_DB_VERSION}.sqlite3
            self.db_dir = mysqlsh.plugin_manager.general.get_shell_user_dir(  # pylint: disable=no-member
                'plugin_data', 'gui_plugin')

        self.current_dir = getcwd()
        db_log_file = path.join(self.db_dir, 'mysqlsh_gui_backend_log.sqlite3')

        super().__init__(log_rotation=log_rotation,
                         session_uuid=session_uuid,
                         connection_options=connection_options if connection_options is not None else {
                             "database_name": "main",
                             "db_file": path.join(self.db_dir, 'mysqlsh_gui_backend.sqlite3'),
                             "attach": [
                                 {
                                     "database_name": "gui_log",
                                     "db_file": db_log_file
                                 }]
                         })

    def open_database(self):
        session_id = "BackendDB-" + \
            "anonymous" if self._session_uuid is None else self._session_uuid
        return DbSessionFactory.create("Sqlite", session_id, False, self._connection_options,
                                       None, True, None, None, None, None, None)

    def current_database_exist(self):
        return path.isfile(self._connection_options["db_file"])

    def check_for_previous_version_and_upgrade(self):
        logger.debug2(
            f"Checking for previous version and upgrade\n\tdb_dir: {self.db_dir}")
        makedirs(self.db_dir, exist_ok=True)
        final_db_file = "mysqlsh_gui_backend.sqlite3"
        final_db_log_file = "mysqlsh_gui_backend_log.sqlite3"
        installed_db_log_file = None
        installed_db_file = self.find_installed_db_file(self.db_dir)
        logger.debug2(f"Found installed database file: {installed_db_file}")
        installed_version = Version()
        if installed_db_file is not None:
            installed_version = self.get_db_version(
                path.join(self.db_dir, installed_db_file))
            logger.debug2(f"Installed database version: {installed_version}")

        # if no earlier version is found, return with False
        if installed_version == (0, 0, 0):
            return False

        if installed_version == CURRENT_DB_VERSION:
            return True

        if installed_version > CURRENT_DB_VERSION:
            raise Exception(f'Cannot downgrade database from '
                            f'schema {installed_version} to {CURRENT_DB_VERSION}')

        script_dir = path.join(path.dirname(__file__), 'db_schema')
        upgrade_steps = self.get_upgrade_steps(script_dir)
        previous_version = Version()
        for version in upgrade_steps:
            if version[1] == installed_version:
                previous_version = version[0]
                break

        upgrade_scripts = self.find_upgrade_scripts(
            script_dir, installed_version, CURRENT_DB_VERSION)

        try:
            # Because we don't know the full path in the script,
            # we have to change working directory so that new 'mysqlsh_gui_backend_log`
            # is created in the appropriate location.
            chdir(self.db_dir)

            logger.info(
                f"Renaming {installed_db_file} to {installed_db_file}.backup")
            if path.exists(f'{installed_db_file}.backup'):
                self.rename_db_file(
                    f'{installed_db_file}.backup', f'{installed_db_file}.backup.old')
            self.backup_db(installed_db_file, f'{installed_db_file}.backup')

            if final_db_file != installed_db_file:
                logger.info(
                    f"Copying {installed_db_file}.backup to {final_db_file}")
                self.rename_db_file(f'{installed_db_file}', final_db_file)

            if installed_version < DROPPED_VERSION_IN_NAME_DB_VERSION:
                installed_db_log_file = f'mysqlsh_gui_backend_log_{installed_version}.sqlite3'
            else:
                installed_db_log_file = final_db_log_file
            logger.info(
                f"Found installed log database file: {installed_db_log_file}")
            logger.info(
                f"Renaming {installed_db_log_file} to {installed_db_log_file}.backup")
            if path.exists(f'{installed_db_log_file}.backup'):
                self.rename_db_file(
                    f'{installed_db_log_file}.backup', f'{installed_db_log_file}.backup.old')
            self.backup_db(installed_db_log_file,
                           f'{installed_db_log_file}.backup')

            if final_db_log_file != installed_db_log_file:
                logger.info(
                    f"Copying {installed_db_log_file}.backup to {final_db_log_file}")
                self.rename_db_file(f'{installed_db_log_file}', final_db_log_file)

            try:
                logger.debug2("Start upgrading database")
                conn = sqlite3.connect(final_db_file)
                conn.execute("VACUUM")
                cursor = conn.cursor()
                for script in upgrade_scripts:
                    with open(path.join(script_dir, script), 'r', encoding='utf-8') as sql_file:
                        sql = sql_file.read()
                    logger.info(f"Executing upgrade script: {script}")
                    logger.debug3(f"SQL: {sql}")
                    cursor.executescript(sql)
                conn.commit()
                conn.close()
                logger.info("Database successfully upgraded")
            except Exception as e:
                logger.error(
                    "Error occurred during database upgrade, rolling back database")
                logger.exception(e)
                conn.rollback()
                conn.close()
                # move the files back
                self.remove_db_file(final_db_file)
                logger.info(
                    f"Renaming file: {installed_db_file}.backup to {installed_db_file}")
                rename(f'{installed_db_file}.backup', installed_db_file)
                if path.exists(f'{installed_db_log_file}.backup.old'):
                    self.rename_db_file(
                        f'{installed_db_log_file}.backup.old', f'{installed_db_log_file}.backup')

                # move the log files back
                self.remove_db_file(final_db_log_file)
                logger.info(
                    f"Renaming file: {installed_db_log_file}.backup to {installed_db_log_file}")
                rename(f'{installed_db_log_file}.backup',
                       installed_db_log_file)
                if path.exists(f'{installed_db_log_file}.backup.old'):
                    self.rename_db_file(
                        f'{installed_db_log_file}.backup.old', f'{installed_db_log_file}.backup')

                raise e

            if installed_version < DROPPED_VERSION_IN_NAME_DB_VERSION:
                self.remove_db_file(installed_db_log_file)
                self.remove_db_file(installed_db_file)

            # Removing previous backup and old log files
            if previous_version < DROPPED_VERSION_IN_NAME_DB_VERSION:
                self.cleanup(previous_version)
            with contextlib.suppress(FileNotFoundError):
                remove(f'{installed_db_log_file}.backup.old')
            with contextlib.suppress(FileNotFoundError):
                remove(f'{installed_db_file}.backup.old')
        finally:
            chdir(self.current_dir)

        return True

    def initialize_db(self):
        sql_file_path = path.join(path.dirname(__file__), 'db_schema',
                                  'mysqlsh_gui_backend.sqlite.sql')
        logger.debug2(
            f"Starting initializing database:\n\tdatabase file:{self._connection_options['db_file']}\n\tsql_file:{sql_file_path}")

        try:
            makedirs(self.db_dir, exist_ok=True)
            db_file = self._connection_options["db_file"]
            conn = sqlite3.connect(db_file)
            os.chmod(db_file, stat.S_IRUSR | stat.S_IWUSR)
            cursor = conn.cursor()

            # Do a fresh initialization of the database
            with open(sql_file_path, 'r', encoding='UTF-8') as sql_file:
                sql = sql_file.read()

            # Because we don't know the full path in the script,
            # we have to change working directory so that new 'mysqlsh_gui_backend_log`
            # is created in the appropriate location.
            chdir(self.db_dir)
            cursor.executescript(sql)
            conn.commit()
            version = self.get_db_version(self._connection_options['db_file'])
            logger.debug2(
                f"Database successfully initialized\n\tDatabase version: {version}")
        except Exception as e:  # pragma: no cover
            conn.rollback()
            logger.error(f'Cannot initialize database. {e}')
            raise e from None
        finally:
            conn.close()
            chdir(self.current_dir)

    def backup_logs(self, db):
        # create new backup file
        # attach it to db as backup
        new_filename = pathlib.Path(self.db_dir,
                                    f"mysqlsh_gui_backend_log_{date.today().strftime('%Y.%m.%d')}.sqlite3")

        # The backup was done for today already
        if new_filename.exists():
            return

        # check files, remove oldest if count > 6
        backup_files = []
        for f in listdir(self.db_dir):
            m = re.match(
                r'mysqlsh_gui_backend_log_\d+\.\d+\.\d+\.sqlite3', f)
            if m:
                backup_files.append(f)

        while len(backup_files) > self._config['log_rotation_period']:
            file_to_remove = sorted(backup_files)[0]
            remove(path.join(self.db_dir, file_to_remove))
            backup_files.remove(file_to_remove)

        try:
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

    def remove_db_file(self, path):
        self.remove_wal_and_shm_files(path)
        with contextlib.suppress(FileNotFoundError):
            remove(path)

    def rename_db_file(self, src, dst):
        rename(src, dst)
        self.remove_wal_and_shm_files(src)

    def cleanup(self, file_version):
        with contextlib.suppress(FileNotFoundError):
            remove(path.join(self.db_dir,
                   f'mysqlsh_gui_backend_{file_version}.sqlite3.backup'))
        with contextlib.suppress(FileNotFoundError):
            remove(path.join(
                self.db_dir, f'mysqlsh_gui_backend_log_{file_version}.sqlite3.backup'))

        files_to_remove = []
        for f in listdir(self.db_dir):
            m = re.match(
                r'\d+\.\d+\.\d+_mysqlsh_gui_backend_log_(\d+)\.(\d+)\.(\d+)\.sqlite3', f)
            if m:
                g = m.groups()
                version = Version(g[0])

                if file_version == version:
                    files_to_remove.append(f)

        for file in files_to_remove:
            remove(file)

    def get_db_version(self, db_path):
        version = Version()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            try:
                row = cursor.execute(
                    "SELECT major, minor, patch FROM schema_version;").fetchone()
                version = Version(row)
            except Exception as e:
                logger.exception(e)
        return version

    def find_installed_db_file(self, db_dir):
        installed_version = Version()

        # find the latest version of the database file available
        db_file = "mysqlsh_gui_backend.sqlite3"
        found = False
        if not path.exists(path.join(db_dir, db_file)):
            db_file = None
            for f in listdir(db_dir):
                m = re.match(
                    r'mysqlsh_gui_backend_(\d+)\.(\d+)\.(\d+)\.sqlite3', f)
                if m:
                    g = Version(m.groups())
                    if g > installed_version or installed_version == (0, 0, 0):
                        found = True
                        installed_version = g

            if found:
                if installed_version < OLDEST_SUPPORTED_DB_VERSION:
                    raise Error.MSGException(
                        Error.DB_UNSUPPORTED_FILE_VERSION, "Database file to upgrade have to be at least in 0.0.11 version.")
                db_file = f"mysqlsh_gui_backend_{installed_version}.sqlite3"

        return db_file

    def find_upgrade_scripts(self, script_dir, from_version, to_version):
        upgrade_scripts = []
        version_to_upgrade = from_version
        all_scripts = self.get_upgrade_steps(script_dir)
        for version in all_scripts:
            if version[0] == version_to_upgrade:
                upgrade_scripts.append(
                    f"mysqlsh_gui_backend_{version[0]}_to_{version[1]}.sqlite.sql")
                if version[1] == to_version:
                    upgrade_file_found = True
                    break
                else:
                    version_to_upgrade = version[1]

        if version_to_upgrade != to_version and not upgrade_file_found:
            raise Exception(f'No upgrade file found to go from database '
                            f'schema {version_to_upgrade} to {to_version}')

        return upgrade_scripts

    def backup_db(self, src, dst):
        with sqlite3.connect(src) as source, sqlite3.connect(dst) as dest:
            os.chmod(dst, stat.S_IRUSR | stat.S_IWUSR)
            source.backup(dest)

    def remove_wal_and_shm_files(self, file):
        with contextlib.suppress(FileNotFoundError):
            remove(f'{file}-shm')
        with contextlib.suppress(FileNotFoundError):
            remove(f'{file}-wal')

    def get_upgrade_steps(self, script_dir):
        upgrade_scripts = []

        for f in listdir(script_dir):
            m = re.match(
                r'mysqlsh_gui_backend_(\d+\.\d+\.\d+)_to_(\d+\.\d+\.\d+)\.sqlite.sql', f)
            if not m:
                continue
            g = m.groups()

            update_from_version = Version(g[0])
            upgrade_to_version = Version(g[1])

            upgrade_scripts.append((update_from_version, upgrade_to_version))

        return sorted(upgrade_scripts)
