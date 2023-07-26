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
import argparse
import os
import pathlib
import platform
import sqlite3
import subprocess
import tempfile
import typing

arg_parser = argparse.ArgumentParser()

arg_parser.add_argument(
    "-t",
    "--test_to_run",
    required=False,
    type=str,
    default=os.environ["TEST_TO_RUN"] if "TEST_TO_RUN" in os.environ else "ALL",
    help="Specify test name to run",
)

arg_parser.add_argument(
    "--headless",
    required=False,
    type=str,
    default=os.environ["HEADLESS"] if "HEADLESS" in os.environ else "1",
    help="Run in headless mode",
)

arg_parser.add_argument(
    "--db_port",
    required=False,
    type=str,
    default=os.environ["DB_PORT"] if "DB_PORT" in os.environ else "3308",
    help="Specify db port",
)

arg_parser.add_argument(
    "--db_root_user",
    required=False,
    type=str,
    default=os.environ["DB_ROOT_USER"] if "DB_ROOT_USER" in os.environ else "root",
    help="Specify db root user name",
)

arg_parser.add_argument(
    "--db_root_password",
    required=False,
    type=str,
    default=os.environ["DB_ROOT_PASSWORD"] if "DB_ROOT_PASSWORD" in os.environ else "",
    help="Specify db root user password",
)

try:
    argv = arg_parser.parse_args()
except argparse.ArgumentError as e:
    print(str(e))

VERBOSE = True

DB_ROOT_PASSWORD = "" if argv.db_root_password == "-" else argv.db_root_password
BE_SERVER_PORT1 = 8000
BE_SERVER_PORT2 = 8001
TOKEN = "1234test"

WORKING_DIR = os.path.abspath(os.path.dirname(__file__))
SAKILA_SQL_PATH = os.path.join(WORKING_DIR, "sql", "sakila.sql")
WORLD_SQL_PATH = os.path.join(WORKING_DIR, "sql", "world_x_cst.sql")
USERS_PATH = os.path.join(WORKING_DIR, "sql", "users.sql")
PROCEDURES_PATH = os.path.join(WORKING_DIR, "sql", "procedures.sql")


def quote(text: str) -> str:
    """Adding quote to text on Windows"""

    return f'"{text}"' if platform.system() == "Windows" else text


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

    return executables[name]


def create_symlink(target: str, link_name: str) -> None:
    """Creates symlink for all platforms

    Args:
        target (str): path to target
        link_name (str): name of the link
    """

    if os.name == "nt":
        p = subprocess.run(f'mklink /J "{link_name}" "{target}"', shell=True)
        print(p.stdout)
        p.check_returncode()
    else:
        os.symlink(target, link_name)


class Logger:
    """Simple logger to prints log messages"""

    @classmethod
    def success(cls, msg: str) -> None:
        """Prints success message"""

        print(f"✅ {msg}")

    @classmethod
    def error(cls, msg: str) -> None:
        """Prints error message"""

        print(f"❌ {msg}")

    @classmethod
    def warning(cls, msg: str) -> None:
        """Prints warning message"""

        if VERBOSE:
            print(f"🟡 {msg}")

    @classmethod
    def info(cls, msg: str) -> None:
        """Prints info message"""

        if VERBOSE:
            print(f"ℹ️ {msg}")


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
                        "HKEY_CURRENT_USER\Software\Google\Chrome\BLBeacon",
                        "/v",
                        "version",
                    ]
                )
                .decode("utf-8")
                .strip()
            )
            reg_sz = "REG_SZ    "
            if reg_sz in output:
                self.version = output[output.index(reg_sz) + len(reg_sz) :]

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


class SetEnvironmentVariablesTask:
    """Task for setting environment variables"""

    def __init__(self, environment: typing.Dict[str, str], dir_name: str) -> None:
        self.environment = environment
        self.dir_name = dir_name

    def run(self) -> None:
        """Runs the task"""

        self.environment[
            "SHELL_UI_HOSTNAME"
        ] = f"http://localhost:{BE_SERVER_PORT1}/?token={TOKEN}"
        self.environment["SHELL_UI_MU_HOSTNAME"] = f"http://localhost:{BE_SERVER_PORT2}"
        self.environment["DBHOSTNAME"] = "localhost"
        self.environment["DBUSERNAME"] = argv.db_root_user
        self.environment["DBPASSWORD"] = DB_ROOT_PASSWORD
        self.environment["DBPORT"] = argv.db_port
        self.environment["DBPORTX"] = argv.db_port + "0"
        self.environment["DBUSERNAMESHELL"] = "clientqa"
        self.environment["DBPASSWORDSHELL"] = "clientqa"
        self.environment["DBUSERNAME1"] = "dbuser1"
        self.environment["DBUSERNAME2"] = "dbuser2"
        self.environment["DBUSERNAME3"] = "dbuser3"
        self.environment["MU_USERNAME"] = "client"
        self.environment["MU_PASSWORD"] = "client"

        self.environment["SQLITE_PATH_FILE"] = os.path.join(
            self.dir_name,
            "mysqlsh",
            "plugin_data",
            "gui_plugin",
            "mysqlsh_gui_backend.sqlite3",
        )

        self.environment["HEADLESS"] = argv.headless

        Logger.success("Environment variables have been set")

    def clean_up(self) -> None:
        """Clean up after task finish"""


class ShellTask(abc.ABC):
    """Base class to execute shell commands"""

    def __init__(self, environment: typing.Dict[str, str]) -> None:
        self.mysqlsh_executable = get_executables("MySQL Shell")
        self.environment = environment

    def shell_execute(
        self,
        command: str,
        mode: str = "--py",
        conn_str: str = "",
        file: bool = False,
        raise_exception: bool = True,
    ) -> str:
        """Executes shell command

        Args:
            command (str): command to execute
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
            args.append(command if file else quote(command))
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
                    f"Can't perform shell command: {' '.join(command)}\n\t{exc}"
                ) from exc
            else:
                Logger.warning(exc)
        return out

    def clean_up(self) -> None:
        """Clean up after task finish"""


class SetBeDbTask(ShellTask):
    """Setup MySQL Shell home directory in temp directory"""

    def __init__(self, environment: typing.Dict[str, str], dir_name: str) -> None:
        super().__init__(environment)
        self.dir_name = dir_name

    def run(self) -> None:
        """Runs the task"""

        self.create_backend_database()
        Logger.success("BE db have been created")

        self.set_plugins_path()
        Logger.success("BE plugins have been set")

        self.delete_credentials()
        Logger.success("Old credentials were deleted")

        self.shell_execute(
            command="gui.users.create_user('client', 'client', 'Administrator')"
        )
        Logger.success("BE user have been added")

    def set_plugins_path(self) -> None:
        """Sets paths for plugins in MySQL Shell home dir"""

        plugins_path = os.path.join(self.dir_name, "mysqlsh", "plugins")
        os.makedirs(plugins_path, exist_ok=True)

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
        create_symlink(gui_plugin_path, os.path.join(plugins_path, "gui_plugin"))
        create_symlink(mds_plugin_path, os.path.join(plugins_path, "mds_plugin"))
        create_symlink(mrs_plugin_path, os.path.join(plugins_path, "mrs_plugin"))

    def create_backend_database(self):
        """Creates backend database"""

        sqlite_be_db_path = os.path.join(
            self.dir_name, "mysqlsh", "plugin_data", "gui_plugin"
        )

        current_dir = os.getcwd()
        current_create_script = os.path.join(
            current_dir,
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
            f"root@localhost:{argv.db_port}",
            f"dbuser1@localhost:{argv.db_port}",
            f"clientqa@localhost:{argv.db_port}",
        ]

        for credential in credentials_to_delete:
            self.shell_execute(
                command=f"shell.delete_credential('{credential}')",
                raise_exception=False,
            )


class SetMySQLServerTask(ShellTask):
    """Deploys MySQL Server and install required schemas and users"""

    def __init__(self, environment: typing.Dict[str, str], dir_name: str) -> None:
        super().__init__(environment)
        self.dir_name = dir_name

        # We will use the certs deployed with the server
        self.environment["SSL_ROOT_FOLDER"] = f"{self.dir_name}/{argv.db_port}/sandboxdata"

        self.conn_string = (
            f"{argv.db_root_user}:{DB_ROOT_PASSWORD}@localhost:{argv.db_port}"
        )

    def run(self) -> None:
        """Runs the task"""

        Logger.info("Start deploying MySQL Server")
        self.deploy_mysql_instance()
        Logger.success("MySQL instance was successfully deployed and running")

        self.install_schema(name="sakila", path=SAKILA_SQL_PATH)
        Logger.success("Sakila db installed")

        self.install_schema(name="world_x_cst", path=WORLD_SQL_PATH)
        Logger.success("World db installed")

        # Adding users
        self.shell_execute(
            command=USERS_PATH, mode="--sql", conn_str=self.conn_string, file=True
        )
        Logger.success("Users have been added")

        # Adding procedures
        self.shell_execute(
            command=PROCEDURES_PATH, mode="--sql", conn_str=self.conn_string, file=True
        )
        Logger.success("Procedures has been created")

    def install_schema(self, name: str, path: str) -> None:
        """Checking if schema exists on MySQL server and install it if needed

        Args:
            name (str): name of the schema
            path (str): path to SQL script that creates schema
        """

        out = ""
        try:
            self.shell_execute(
                command=f"use {name}", mode="--sql", conn_str=self.conn_string
            )
        except TaskFailException as exc:
            out = str(exc)

        if "exit status 1" in out:
            self.shell_execute(
                command=path, mode="--sql", conn_str=self.conn_string, file=True
            )

    def deploy_mysql_instance(self) -> None:
        """Deploying new MySQL server instance in temp dir"""

        options = {
            "password": DB_ROOT_PASSWORD,
            "sandboxDir": self.dir_name,
            "ignoreSslError": True if platform.system() == "Windows" else False,
        }
        self.shell_execute(
            command=f"dba.deploy_sandbox_instance({argv.db_port}, {options})"
        )

    def clean_up(self) -> None:
        """Clean up after task finish"""

        options = f'{{"sandboxDir": "{self.dir_name}"}}'
        self.shell_execute(
            command=f"dba.kill_sandbox_instance({argv.db_port}, {options})"
        )
        Logger.success("Successfully stopped MySQL instance")

        self.shell_execute(
            command=f"dba.delete_sandbox_instance({argv.db_port}, {options})"
        )
        Logger.success("Successfully deleted MySQL instance")


class StartBeServersTask:
    """Runs two BE servers for e2e tests"""

    def __init__(self, environment: typing.Dict[str, str]) -> None:
        self.mysqlsh_executable = get_executables("MySQL Shell")
        self.environment = environment
        self.server1 = None
        self.server2 = None

    def run(self) -> None:
        """Runs the task"""

        self.server1 = subprocess.Popen(
            [
                self.mysqlsh_executable,
                "--py",
                "-e",
                f'gui.start.web_server(port={BE_SERVER_PORT1}, single_instance_token="{TOKEN}")',
            ],
            env=self.environment,
        )
        Logger.success("Server 1 have been started")

        self.server2 = subprocess.Popen(
            [
                self.mysqlsh_executable,
                "--py",
                "-e",
                f"gui.start.web_server(port={BE_SERVER_PORT2})",
            ],
            env=self.environment,
        )
        Logger.success("Server 2 have been started")

    def clean_up(self) -> None:
        """Clean up after task finish"""

        if self.server1 is not None:
            self.server1.kill()
            Logger.success("Server 1 have been stopped")

        if self.server2 is not None:
            self.server2.kill()
            Logger.success("Server 2 have been stopped")


class NPMScript:
    """Runs e2e tests"""

    def __init__(self, environment: typing.Dict[str, str], script_name: str) -> None:
        self.environment = environment
        self.script_name = script_name

    def run(self) -> None:
        """Runs the task"""

        args = [get_executables("npm"), "run", self.script_name]
        if argv.test_to_run.upper() != "ALL":
            args.append("-t")
            args.append(argv.test_to_run)

        e2e_tests = subprocess.Popen(args=args, env=self.environment)

        e2e_tests.communicate()
        e2e_tests.wait()

    def clean_up(self) -> None:
        """Clean up after task finish"""


class SetFrontendTask:
    """Runs two BE servers for e2e tests"""

    def __init__(self, environment: typing.Dict[str, str]) -> None:
        self.environment = environment

    def run(self) -> None:
        """Runs the task"""

        node_modules_path = pathlib.Path(WORKING_DIR, "..", "..", "..", "node_modules")
        build_path = pathlib.Path(WORKING_DIR, "..", "..", "..", "build")
        webroot_path = pathlib.Path(
            WORKING_DIR,
            "..",
            "..",
            "..",
            "..",
            "backend",
            "gui_plugin",
            "core",
            "webroot",
        )

        if not node_modules_path.is_dir():
            self.install_npm_modules()
            Logger.success("Npm modules installed successfully")

        if not build_path.is_dir():
            self.build_frontend()
            Logger.success("Frontend built successfully")

        if not webroot_path.is_symlink():
            create_symlink(build_path.resolve(), webroot_path.resolve())
            Logger.success("Webroot path created successfully")

    def install_npm_modules(self) -> None:
        """Installs the npm modules"""

        args = [get_executables("npm"), "install"]
        npm_modules = subprocess.Popen(args=args, env=self.environment)

        npm_modules.communicate()
        npm_modules.wait()

    def build_frontend(self) -> None:
        """Builds the frontend"""

        args = [get_executables("npm"), "run", "build"]
        npm_modules = subprocess.Popen(args=args, env=self.environment)

        npm_modules.communicate()
        npm_modules.wait()

    def clean_up(self) -> None:
        """Clean up after task finish"""


class TaskExecutor:
    """Task executor"""

    def __init__(self, dir_name: str) -> None:
        self.tasks: typing.List[Runnable] = []
        self.prerequisites: typing.List[Checkable] = []
        self.environment = os.environ.copy()
        self.environment["MYSQLSH_USER_CONFIG_HOME"] = os.path.join(dir_name, "mysqlsh")

    def add_task(self, task: Runnable) -> None:
        """Adding new task to be executed

        Args:
            task (IRunnable): task to be run
        """

        self.tasks.append(task)

    def add_prerequisite(self, prerequisite: Checkable) -> None:
        """Adding new prerequisite task to be executed before all tasks

        Args:
            prerequisite (ICheckable): task to be run
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

        try:
            for task in self.tasks:
                task.run()
        except TaskFailException as exc:
            Logger.error(str(exc))

    def clean_up(self) -> None:
        """Runs clean up for all tasks"""

        try:
            for task in self.tasks:
                task.clean_up()
        except TaskFailException as exc:
            Logger.error(str(exc))


if __name__ == "__main__":
    import sys

    print(f"Args: {sys.argv[1:]}")
    with tempfile.TemporaryDirectory() as tmp_dirname:
        executor = TaskExecutor(tmp_dirname)

        executor.add_prerequisite(CheckVersionTask("MySQL Shell"))
        executor.add_prerequisite(CheckVersionTask("MySQL Server"))
        executor.add_prerequisite(CheckVersionTask("Chrome browser"))
        executor.add_prerequisite(CheckVersionTask("npm"))
        executor.add_prerequisite(CheckVersionTask("ChromeDriver"))

        executor.add_task(
            SetEnvironmentVariablesTask(executor.environment, tmp_dirname)
        )
        executor.add_task(SetFrontendTask(executor.environment))
        executor.add_task(SetBeDbTask(executor.environment, tmp_dirname))
        executor.add_task(SetMySQLServerTask(executor.environment, tmp_dirname))
        executor.add_task(StartBeServersTask(executor.environment))
        executor.add_task(NPMScript(executor.environment, "e2e-tests-run"))

        if executor.check_prerequisites():
            executor.run_tasks()
            executor.clean_up()
