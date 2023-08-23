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
import sys
import tempfile
import typing
import time
import shutil

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
TEXT_ONLY_OUTPUT = True

WORKING_DIR = os.path.abspath(os.path.dirname(__file__))
SAKILA_SQL_PATH = os.path.join(WORKING_DIR, "sql", "sakila.sql")
WORLD_SQL_PATH = os.path.join(WORKING_DIR, "sql", "world_x_cst.sql")
USERS_PATH = os.path.join(WORKING_DIR, "sql", "users.sql")
PROCEDURES_PATH = os.path.join(WORKING_DIR, "sql", "procedures.sql")
MAX_WORKERS = "3"
TOKEN = "1234test"

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

    def __init__(self, environment: typing.Dict[str, str], dir_name: str, servers: typing.List) -> None:
        self.environment = environment
        self.dir_name = dir_name
        self.servers = servers

    def run(self) -> None:
        """Runs the task"""

        self.environment["TOKEN"] = TOKEN
        self.environment["MAX_WORKERS"] = MAX_WORKERS
        self.environment["SHELL_UI_HOSTNAME"] = f"http://localhost"
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

        for x in self.servers:
            if x.multiuser == True:
                self.environment["SHELL_UI_MU_HOSTNAME"] = f"http://localhost:{x.port}"
            
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

class AddUserToBE(ShellTask):
    def __init__(self, environment: typing.Dict[str, str], dir_name: str, servers: typing.List) -> None:
        super().__init__(environment)
        self.dir_name = dir_name
        self.environment = environment
        self.servers = servers

    def run(self) -> None:
        env1 = self.environment.copy()
        for x in self.servers:
            if x.multiuser == True:
                env1["MYSQLSH_USER_CONFIG_HOME"]=os.path.join(WORKING_DIR, f'port_{x.port}')
                subprocess.Popen([
                    self.mysqlsh_executable,
                    "--py",
                    "-e",
                    "gui.users.create_user('client', 'client', 'Administrator')",
                    ],
                    env=env1
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
        self.gui_plugin_path = os.path.join(repo_root, "gui", "backend", "gui_plugin")
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
        create_symlink(self.gui_plugin_path, os.path.join(plugins_path, "gui_plugin"))
        create_symlink(self.mds_plugin_path, os.path.join(plugins_path, "mds_plugin"))
        create_symlink(self.mrs_plugin_path, os.path.join(plugins_path, "mrs_plugin"))

    def set_custom_config_folders(self) -> None:
        plugins_path = os.path.join(self.dir_name, "mysqlsh", "plugins")
        os.makedirs(plugins_path, exist_ok=True)

        for x in self.servers:
            path = os.path.join(WORKING_DIR, f'port_{x.port}')
            if (os.path.exists(path)):
                shutil.rmtree(path)
            
            os.makedirs(os.path.join(path,  "plugins"))
            create_symlink(self.gui_plugin_path, os.path.join(path, "plugins", "gui_plugin"))
            create_symlink(self.mds_plugin_path, os.path.join(path, "plugins", "mds_plugin"))
            create_symlink(self.mrs_plugin_path, os.path.join(path, "plugins", "mrs_plugin"))

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
    def __init__(self, environment: typing.Dict[str, str], servers: typing.List) -> None:
        self.mysqlsh_executable = get_executables("MySQL Shell")
        self.servers = servers

    def run(self) -> None:
        """Runs the task"""

        for x in self.servers:
            x.start()
        
    def clean_up(self) -> None:
        """Clean up after task finish"""

        for x in self.servers:
            x.stop()

class NPMScript:
    """Runs e2e tests"""

    def __init__(self, environment: typing.Dict[str, str], script_name: str, params: typing.List) -> None:
        self.environment = environment
        self.script_name = script_name
        self.params = params

    def run(self) -> None:
        """Runs the task"""

        args = [get_executables("npm"), "run", self.script_name]
        if argv.test_to_run.upper() != "ALL":
            args.append("-t")
            args.append(argv.test_to_run)

        if self.params is not None:
            args.append("--")
            for x in self.params:
                args.append(x)

        e2e_tests = subprocess.Popen(args=args, env=self.environment)
        e2e_tests.communicate()
        return_code = e2e_tests.wait()
        if return_code != 0:
            raise TaskFailException(f"Tests failed")

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
    def __init__(self, environment: typing.Dict[str, str], port: int, multiuser = False) -> None:
        self.mysqlsh_executable = get_executables("MySQL Shell")
        self.port = port
        self.multiuser = multiuser
        self.server = None
        self.beLogPath = "be.log"
        self.environment = environment

    def search_str(self, file_path, word):
            with open(file_path, 'r') as file:
                content = file.read()
                if word in content:
                    return True
                else:
                    return False

    def start(self) -> None:
        beLog = open(self.beLogPath, 'a')
        env1 = self.environment.copy()
        env1["MYSQLSH_USER_CONFIG_HOME"]=os.path.join(WORKING_DIR, f'port_{self.port}')
        timeout = time.time() + 30   # 30 seconds from now

        shell_args = [self.mysqlsh_executable, "--py", "-e"]

        if self.multiuser == True:
            shell_args.append(f"gui.start.web_server(port={self.port})")
        else:
            shell_args.append(f'gui.start.web_server(port={self.port}, single_instance_token="{TOKEN}")')

        self.server = subprocess.Popen(
            shell_args,
            stdout=beLog,
            env=env1,
        )

        if self.multiuser == True:
            to_search = "Mode: Multi-user"
        else:
            to_search = "Mode: Single user"

        while True:
            if time.time() > timeout:
                os.remove(self.beLogPath)
                Logger.error(f"Shell Server: {self.port} did not start after 30secs")
                raise Exception("Failed Server start")
            else:
                if (self.search_str(self.beLogPath, to_search)):
                    Logger.success(f"Shell Server {self.port} has been started")
                    break

        os.remove(self.beLogPath)

    def stop(self) -> None:
        self.server.kill()
        Logger.success(f"Shell Server: {self.port} has been stopped")



if __name__ == "__main__":
    test_failed = False
    with tempfile.TemporaryDirectory() as tmp_dirname:

        executor = TaskExecutor(tmp_dirname)

        executor.add_prerequisite(CheckVersionTask("MySQL Shell"))
        executor.add_prerequisite(CheckVersionTask("MySQL Server"))
        executor.add_prerequisite(CheckVersionTask("Chrome browser"))
        executor.add_prerequisite(CheckVersionTask("npm"))
        executor.add_prerequisite(CheckVersionTask("ChromeDriver"))

        be_servers = [
            BEServer(executor.environment, 8000), 
            BEServer(executor.environment, 8001), 
            BEServer(executor.environment, 8002), 
            BEServer(executor.environment, 8005, True),
        ]
        
        executor.add_task(SetEnvironmentVariablesTask(executor.environment, tmp_dirname, be_servers))
        executor.add_task(SetFrontendTask(executor.environment))
        executor.add_task(SetPluginsTask(executor.environment, tmp_dirname, be_servers))
        executor.add_task(SetMySQLServerTask(executor.environment, tmp_dirname))
        executor.add_task(StartBeServersTask(executor.environment, be_servers))
        executor.add_task(AddUserToBE(executor.environment, tmp_dirname, be_servers))
        executor.add_task(NPMScript(executor.environment, f"e2e-tests-run", [f"--maxWorkers={MAX_WORKERS}"]))
        executor.add_task(NPMScript(executor.environment, f"e2e-tests-report", []))

        if executor.check_prerequisites():
            try:
                executor.run_tasks()
            except TaskFailException as exc:
                Logger.error(exc)
                test_failed = True

            executor.clean_up()
            executor = TaskExecutor(tmp_dirname)
            executor.add_task(NPMScript(executor.environment, f"e2e-tests-report", []))
            executor.run_tasks()
            executor.clean_up()

    if test_failed:
        sys.exit(1)