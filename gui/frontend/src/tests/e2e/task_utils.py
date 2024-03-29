# Copyright (c) 2023, Oracle and/or its affiliates.
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

import abc
import os
import pathlib
import platform
import shutil
import sqlite3
import subprocess
import time
import typing

VERBOSE = True
WORKING_DIR = os.path.abspath(os.path.dirname(__file__))
SAKILA_SQL_PATH = os.path.join(WORKING_DIR, "sql", "sakila.sql")
WORLD_SQL_PATH = os.path.join(WORKING_DIR, "sql", "world_x_cst.sql")
USERS_PATH = os.path.join(WORKING_DIR, "sql", "users.sql")
PROCEDURES_PATH = os.path.join(WORKING_DIR, "sql", "procedures.sql")

TOKEN = "1234test"
TEXT_ONLY_OUTPUT = True


class TaskFailException(Exception):
    """Task failure exception"""


class Runnable(typing.Protocol):
    """Interface for tasks"""

    def run(self) -> None:
        """Executes tasks"""
        raise NotImplementedError()

    def clean_up(self) -> None:
        """Clean up after task finish"""
        raise NotImplementedError()


class Checkable(typing.Protocol):
    """Interface for prerequisites tasks"""

    message_success: str
    message_fail: str

    def check(self) -> bool:
        """Executes check for prerequisite tasks

        Returns:
            bool: indicating whether check was successful
        """

        raise NotImplementedError()


def get_executables(name: str) -> str:
    """Gets executables specific for platform

    Args:
        name (str): general name of the executables

    Returns:
        str: name of the executable specific for platform
    """

    system = platform.system()
    executables = {}
    executables["MySQL Shell"] = "mysqlsh.exe" if system == "Windows" else "mysqlsh"
    executables["MySQL Server"] = "mysql.exe" if system == "Windows" else "mysql"
    executables["npm"] = "npm.cmd" if system == "Windows" else "npm"
    executables["ChromeDriver"] = (
        "chromedriver.exe" if system == "Windows" else "chromedriver"
    )

    if system == "Linux":
        executables["Chrome browser"] = "google-chrome"
    elif system == "Windows":
        executables[
            "Chrome browser"
        ] = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    else:
        executables[
            "Chrome browser"
        ] = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

    executables["VSCode"] = "code.exe" if system == "Windows" else "code"

    return executables[name]


def create_symlink(source: str, link_name: str) -> None:
    """Creates symlink for all platforms

    Args:
        source (str): path to source
        link_name (str): name of the link
    """

    if os.name == "nt":
        p = subprocess.run(f'mklink /J "{link_name}" "{target}"', shell=True)
        print(p.stdout)
        p.check_returncode()
    else:
        os.symlink(source, link_name)


def quote(text: str) -> str:
    """Adding quote to text on Windows"""

    return f'"{text}"' if platform.system() == "Windows" else text


class Logger:
    """Simple logger to prints log messages"""

    @classmethod
    def success(cls, msg: str) -> None:
        """Prints success message"""

        print(f"{'[OK]' if TEXT_ONLY_OUTPUT else '✅'} {msg}")

    @classmethod
    def error(cls, msg: str) -> None:
        """Prints error message"""

        print(f"{'[ERR]' if TEXT_ONLY_OUTPUT else '❌'} {msg}")

    @classmethod
    def warning(cls, msg: str) -> None:
        """Prints warning message"""

        if VERBOSE:
            print(f"{'[WRN]' if TEXT_ONLY_OUTPUT else '🟡'} {msg}")

    @classmethod
    def info(cls, msg: str) -> None:
        """Prints info message"""

        if VERBOSE:
            print(f"{'[INF]' if TEXT_ONLY_OUTPUT else 'ℹ️'} {msg}")


class CheckVersionTask:
    """Checks version of the given executables"""

    def __init__(self, name: str):
        self.executable = pathlib.Path(get_executables(name))
        self.name = name
        self.version = ""
        self.message_success = f"Found {self.name: <20} [{self.version}]"
        self.message_fail = (
            f"Can't find {self.name}. Make sure is installed and available in PATH"
        )

    def check(self) -> bool:
        """Checking version of the given executable

        Returns:
            bool: indicating whether version check was successful
        """

        if self.executable.name == "chrome.exe":
            output = (
                subprocess.check_output(
                    [
                        "reg",
                        "query",
                        r"HKEY_CURRENT_USER\Software\Google\Chrome\BLBeacon",
                        "/v",
                        "version",
                    ]
                )
                .decode("utf-8")
                .strip()
            )
            reg_sz = "REG_SZ    "
            if reg_sz in output:
                self.version = output[output.index(reg_sz) + len(reg_sz):]

        else:
            try:
                self.version = (
                    subprocess.check_output([self.executable, "--version"])
                    .decode("utf-8")
                    .strip()
                )
            except FileNotFoundError:
                return False

        self.message_success = f"Found {self.name: <20} [{self.version}]"
        return True


class ShellTask(abc.ABC):
    """Base class to execute shell commands"""

    def __init__(self, environment: typing.Dict[str, str]) -> None:
        self.mysqlsh_executable = get_executables("MySQL Shell")
        self.environment = environment

    def shell_command_execute(
        self,
        command: str,
        mode: str = "--py",
        conn_str: str = "",
        raise_exception: bool = True,
    ) -> str:
        return self.__shell_execute(command, mode, conn_str, False, raise_exception)

    def shell_file_execute(
        self,
        file_path: str,
        mode: str = "--py",
        conn_str: str = "",
        raise_exception: bool = True,
    ) -> str:
        return self.__shell_execute(file_path, mode, conn_str, True, raise_exception)

    def __shell_execute(
        self,
        command_or_file_path: str,
        mode: str = "--py",
        conn_str: str = "",
        file: bool = False,
        raise_exception: bool = True,
    ) -> str:
        """Executes shell command

        Args:
            command_or_file_path (str): command or file path to execute
            mode (str, optional): mode of MySQL shell. Defaults to "--py".
            conn_str (str, optional): connection string for MySQL Server. Defaults to "".
            file (bool, optional): indicating whether command is path to file. Defaults to False.
            raise_exception (bool, optional): indicating whether raise exception after failure.
                                              Defaults to True.

        Raises:
            TaskFailException: task exception

        Returns:
            str: output of MySQL Shell command
        """

        out = ""
        try:
            args = [self.mysqlsh_executable, mode]
            if conn_str:
                args.append(conn_str)
            args.append("-f" if file else "-e")
            args.append(command_or_file_path if file else quote(
                command_or_file_path))
            out = (
                subprocess.check_output(
                    args,
                    stderr=subprocess.STDOUT,
                    env=self.environment,
                )
                .decode("utf-8")
                .strip()
            )
            if out:
                if "WARNING" in out.upper():
                    Logger.warning(out)
                else:
                    Logger.info(out)
        except subprocess.CalledProcessError as exc:
            if raise_exception:
                raise TaskFailException(
                    f"Can't perform shell command: {command_or_file_path}\n\t{exc}"
                ) from exc
            else:
                Logger.warning(exc)
        return out

    def clean_up(self) -> None:
        """Clean up after task finish"""


class AddUserToBE(ShellTask):
    def __init__(self, environment: typing.Dict[str, str], dir_name: str, servers: typing.List) -> None:
        super().__init__(environment)
        self.dir_name = dir_name
        self.environment = environment
        self.servers = servers

    def run(self) -> None:
        environment = self.environment.copy()
        for server in self.servers:
            if server.multi_user:
                environment["MYSQLSH_USER_CONFIG_HOME"] = os.path.join(
                    WORKING_DIR, f'port_{server.port}')
                subprocess.Popen([
                    self.mysqlsh_executable,
                    "--py",
                    "-e",
                    "gui.users.create_user('client', 'client', 'Administrator')",
                ],
                    env=environment
                )
        Logger.success("BE user has been added")


class SetPluginsTask(ShellTask):
    """Setup MySQL Shell home directory in temp directory"""

    def __init__(self, environment: typing.Dict[str, str], dir_name: str, servers: typing.List) -> None:
        super().__init__(environment)
        self.dir_name = dir_name
        self.servers = servers
        this_file = os.path.dirname(__file__)
        repo_root = os.path.join(this_file, "..", "..", "..", "..", "..")
        repo_root = os.path.realpath(repo_root)
        self.gui_plugin_path = os.path.join(
            repo_root, "gui", "backend", "gui_plugin")
        self.mds_plugin_path = os.path.join(repo_root, "mds_plugin")
        self.mrs_plugin_path = os.path.join(repo_root, "mrs_plugin")

    def run(self) -> None:
        """Runs the task"""

        self.set_plugins_path()
        Logger.success("BE plugins have been set")

        self.set_custom_config_folders()
        Logger.success("Plugins config folders have been set")

    def set_plugins_path(self) -> None:
        """Sets paths for plugins in MySQL Shell home dir"""

        plugins_path = os.path.join(self.dir_name, "mysqlsh", "plugins")
        os.makedirs(plugins_path, exist_ok=True)
        create_symlink(self.gui_plugin_path, os.path.join(
            plugins_path, "gui_plugin"))
        create_symlink(self.mds_plugin_path, os.path.join(
            plugins_path, "mds_plugin"))
        create_symlink(self.mrs_plugin_path, os.path.join(
            plugins_path, "mrs_plugin"))

    def set_custom_config_folders(self) -> None:
        plugins_path = os.path.join(self.dir_name, "mysqlsh", "plugins")
        os.makedirs(plugins_path, exist_ok=True)

        for server in self.servers:
            path = os.path.join(WORKING_DIR, f'port_{server.port}')
            if (os.path.exists(path)):
                shutil.rmtree(path)

            os.makedirs(os.path.join(path,  "plugins"))
            create_symlink(self.gui_plugin_path, os.path.join(
                path, "plugins", "gui_plugin"))
            create_symlink(self.mds_plugin_path, os.path.join(
                path, "plugins", "mds_plugin"))
            create_symlink(self.mrs_plugin_path, os.path.join(
                path, "plugins", "mrs_plugin"))


class SetBeDbTask(ShellTask):
    """Setup MySQL Shell home directory in temp directory"""

    def __init__(self, environment: typing.Dict[str, str], dir_name: str, suffix: str = "", skip_create_plugins: bool = False) -> None:
        super().__init__(environment)
        self.dir_name = dir_name
        self.suffix = suffix
        self.mysqlsh_dir = "mysqlsh" if suffix == "" else f"mysqlsh-{suffix}"
        self.skip_create_plugins = skip_create_plugins
        self.environment["MYSQLSH_USER_CONFIG_HOME"] = os.path.join(
            dir_name, self.mysqlsh_dir)
        self.plugins_path = None

    def run(self) -> None:
        """Runs the task"""

        self.create_backend_database()
        Logger.success("BE db have been created")

        self.set_plugins_path()
        if not self.skip_create_plugins:
            Logger.success("BE plugins have been set")

        self.delete_credentials()
        Logger.success("Old credentials were deleted")

        self.shell_command_execute(
            command="gui.users.create_user('client', 'client', 'Administrator')"
        )
        Logger.success("BE user have been added")

        if self.skip_create_plugins:
            os.remove(pathlib.Path(self.plugins_path, "gui_plugin"))

    def set_plugins_path(self) -> None:
        """Sets paths for plugins in MySQL Shell home dir"""

        self.plugins_path = os.path.join(self.dir_name, self.mysqlsh_dir, "plugins")
        os.makedirs(self.plugins_path, exist_ok=True)

        gui_plugin_path = os.path.join(
            WORKING_DIR,
            "..",
            "..",
            "..",
            "..",
            "backend",
            "gui_plugin",
        )
        mds_plugin_path = os.path.join(
            WORKING_DIR, "..", "..", "..", "..", "..", "mds_plugin"
        )
        mrs_plugin_path = os.path.join(
            WORKING_DIR, "..", "..", "..", "..", "..", "mrs_plugin"
        )

        create_symlink(gui_plugin_path, os.path.join(
            self.plugins_path, "gui_plugin"))
        if not self.skip_create_plugins:
            create_symlink(mds_plugin_path, os.path.join(
                self.plugins_path, "mds_plugin"))
            create_symlink(mrs_plugin_path, os.path.join(
                self.plugins_path, "mrs_plugin"))

    def create_backend_database(self):
        """Creates backend database"""

        sqlite_be_db_path = os.path.join(
            self.dir_name, self.mysqlsh_dir, "plugin_data", "gui_plugin"
        )

        current_dir = os.getcwd()
        current_create_script = os.path.join(
            WORKING_DIR,
            "..",
            "..",
            "..",
            "..",
            "backend",
            "gui_plugin",
            "core",
            "db_schema",
            "mysqlsh_gui_backend.sqlite.sql",
        )

        os.makedirs(sqlite_be_db_path, exist_ok=True)
        os.chdir(sqlite_be_db_path)
        conn = sqlite3.connect(
            os.path.join(sqlite_be_db_path, "mysqlsh_gui_backend.sqlite3")
        )
        cur = conn.cursor()
        with open(current_create_script, "r", encoding="UTF-8") as sql_file:
            sql_create = sql_file.read()

        try:
            cur.executescript(sql_create)
        except sqlite3.Error as exc:
            raise TaskFailException("Can't init BE db") from exc
        conn.close()
        os.chdir(current_dir)

    def delete_credentials(self):
        """Deletes old credentials from lasts tests"""

        credentials_to_delete = [
            f"root@localhost:{self.environment['DBPORT']}",
            f"dbuser1@localhost:{self.environment['DBPORT']}",
            f"clientqa@localhost:{self.environment['DBPORT']}",
        ]

        for credential in credentials_to_delete:
            self.shell_command_execute(
                command=f"shell.delete_credential('{credential}')",
                raise_exception=False,
            )


class SetMySQLServerTask(ShellTask):
    """Deploys MySQL Server and install required schemas and users"""

    def __init__(self, environment: typing.Dict[str, str], dir_name: str) -> None:
        super().__init__(environment)
        self.dir_name = dir_name

    def run(self) -> None:
        """Runs the task"""

        # We will use the certs deployed with the server
        self.environment["SSL_ROOT_FOLDER"] = f"{self.dir_name}/{self.environment['DBPORT']}/sandboxdata"

        conn_string = (
            f"{self.environment['DBUSERNAME']}:{self.environment['DBPASSWORD']}@localhost:{self.environment['DBPORT']}"
        )
        Logger.info("Start deploying MySQL Server")
        self.deploy_mysql_instance()
        Logger.success(
            "MySQL instance was successfully deployed and running"
        )

        self.install_schema(name="sakila", path=SAKILA_SQL_PATH)
        Logger.success("Sakila db installed")

        self.install_schema(name="world_x_cst", path=WORLD_SQL_PATH)
        Logger.success("World db installed")

        # Adding users
        self.shell_file_execute(
            file_path=USERS_PATH, mode="--sql", conn_str=conn_string
        )
        Logger.success("Users have been added")

        # Adding procedures
        self.shell_file_execute(
            file_path=PROCEDURES_PATH, mode="--sql", conn_str=conn_string
        )
        Logger.success("Procedures has been created")

    def install_schema(self, name: str, path: str) -> None:
        """Checking if schema exists on MySQL server and install it if needed

        Args:
            name (str): name of the schema
            path (str): path to SQL script that creates schema
        """

        conn_string = (
            f"{self.environment['DBUSERNAME']}:{self.environment['DBPASSWORD']}@localhost:{self.environment['DBPORT']}"
        )
        out = ""
        try:
            self.shell_command_execute(
                command=f"use {name}", mode="--sql", conn_str=conn_string
            )
        except TaskFailException as exc:
            out = str(exc)

        if "exit status 1" in out:
            self.shell_file_execute(
                file_path=path, mode="--sql", conn_str=conn_string
            )

    def deploy_mysql_instance(self) -> None:
        """Deploying new MySQL server instance in temp dir"""

        options = {
            "password": self.environment['DBPASSWORD'],
            "sandboxDir": self.dir_name,
            "ignoreSslError": True if platform.system() == "Windows" else False,
        }
        self.shell_command_execute(
            command=f"dba.deploy_sandbox_instance({self.environment['DBPORT']}, {options})"
        )

    def clean_up(self) -> None:
        """Clean up after task finish"""

        options = f'{{"sandboxDir": "{self.dir_name}"}}'
        self.shell_command_execute(
            command=f"dba.kill_sandbox_instance({self.environment['DBPORT']}, {options})"
        )
        Logger.success("Successfully stopped MySQL instance")

        self.shell_command_execute(
            command=f"dba.delete_sandbox_instance({self.environment['DBPORT']}, {options})"
        )
        Logger.success("Successfully deleted MySQL instance")


class StartBeServersTask:
    """Runs two BE servers for e2e tests"""

    def __init__(self, servers: typing.List) -> None:
        self.mysqlsh_executable = get_executables("MySQL Shell")
        self.servers = servers

    def run(self) -> None:
        """Runs the task"""

        for server in self.servers:
            server.start()

    def clean_up(self) -> None:
        """Clean up after task finish"""

        for server in self.servers:
            server.stop()


class TaskExecutor:
    """Task executor"""

    def __init__(self, dir_name: str) -> None:
        self.tasks: typing.List[Runnable] = []
        self.prerequisites: typing.List[Checkable] = []
        self.environment = os.environ.copy()
        self.environment["MYSQLSH_USER_CONFIG_HOME"] = os.path.join(
            dir_name, "mysqlsh")
        self.environment["MYSQLSH_GUI_CUSTOM_CONFIG_DIR"] = pathlib.Path(
            dir_name, "mysqlsh")

    def add_task(self, task: Runnable) -> None:
        """Adding new task to be executed

        Args:
            task (Runnable): task to be run
        """

        self.tasks.append(task)

    def add_prerequisite(self, prerequisite: Checkable) -> None:
        """Adding new prerequisite task to be executed before all tasks

        Args:
            prerequisite (Checkable): task to be run
        """

        self.prerequisites.append(prerequisite)

    def check_prerequisites(self) -> bool:
        """Runs all prerequisite tasks

        Returns:
            bool: true if all prerequisite tasks return true
        """

        all_prerequisites_ok = True
        for prerequisite in self.prerequisites:
            if prerequisite.check():
                Logger.success(prerequisite.message_success)
            else:
                Logger.error(prerequisite.message_fail)
                all_prerequisites_ok = False

        return all_prerequisites_ok

    def run_tasks(self) -> None:
        """Runs all tasks"""

        for task in self.tasks:
            task.run()

    def clean_up(self) -> None:
        """Runs clean up for all tasks"""

        try:
            for task in self.tasks:
                task.clean_up()
        except TaskFailException as exc:
            Logger.error(str(exc))


class BEServer:
    def __init__(self, environment: typing.Dict[str, str], port: int, multi_user=False) -> None:
        self.mysqlsh_executable = get_executables("MySQL Shell")
        self.port = port
        self.multi_user = multi_user
        self.server = None
        self.be_log_path = "be.log"
        self.environment = environment

    def search_str(self, file_path, word):
         with open(file_path, 'r', encoding="UTF-8") as file:
            content = file.read()
            return word in content

    def start(self) -> None:
        is_timeout = False
        with open(self.be_log_path, 'a', encoding="UTF-8") as be_log:
            environment = self.environment.copy()
            mysqlsh_user_config_home = os.path.join(WORKING_DIR, f'port_{self.port}')
            os.makedirs(mysqlsh_user_config_home, exist_ok=True)
            environment["MYSQLSH_USER_CONFIG_HOME"] = mysqlsh_user_config_home
            timeout = time.time() + 30   # 30 seconds from now

            shell_args = [self.mysqlsh_executable, "--py", "-e"]

            if self.multi_user:
                shell_args.append(f"gui.start.web_server(port={self.port})")
            else:
                shell_args.append(
                    f'gui.start.web_server(port={self.port}, single_instance_token="{TOKEN}")')

            self.server = subprocess.Popen(
                shell_args,
                stdout=be_log,
                env=environment,
            )

            if self.multi_user:
                to_search = "Mode: Multi-user"
            else:
                to_search = "Mode: Single user"

            while True:
                if time.time() > timeout:
                    is_timeout = True
                    break

                if (self.search_str(self.be_log_path, to_search)):
                    Logger.success(
                        f"Shell Server {self.port} has been started")
                    break

        os.remove(self.be_log_path)
        if is_timeout:
            raise TaskFailException(
                f"Shell Server: {self.port} did not start after 30secs")

    def stop(self) -> None:
        self.server.kill()
        Logger.success(f"Shell Server: {self.port} has been stopped")
