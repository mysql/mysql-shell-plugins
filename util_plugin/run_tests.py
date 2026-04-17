# Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

# To use this script you need to set these environment variables:
#
# MYSQLSH=<path to mysqlsh binary>
# MYSQLSH_USER_CONFIG_HOME=<mysqlsh home>
# MYSQLSH_PLUGIN_SOURCE_DIR=<source code path to the plugins>
#
# If not configured, they will be set as follows:
# MYSQLSH to the mysqlsh in PATH
# MYSQLSH_USER_CONFIG_HOME to /tmp/dot_mysqlsh
# MYSQLSH_PLUGIN_SOURCE_DIR to ../../
import shutil
import os
import tempfile
import subprocess
import shlex
from pathlib import Path
import argparse
from contextlib import contextmanager

import signal
import sqlite3
import zipfile


def signal_handler(sig, frame):
    print(f"1) Ctrl+C! captured: {sig}")


if os.name == "nt":
    signal.signal(signal.SIGINT, signal_handler)


@contextmanager
def pushd(new_path):
    current = os.getcwd()
    os.chdir(new_path.as_posix())
    yield
    os.chdir(current)


def create_symlink(target: Path, link_name: Path, is_dir):
    if link_name.is_symlink():
        link_name.unlink()
    elif link_name.exists():
        raise FileExistsError(f"Refusing to replace existing path: {link_name}")

    if os.name == "nt":
        p = subprocess.run(f'mklink /J "{link_name}" "{target}"', shell=True)
        print(p.stdout)
        p.check_returncode()
    else:
        os.symlink(target, link_name)


arg_parser = argparse.ArgumentParser()

arg_parser.add_argument(
    "-d",
    "--debug",
    required=False,
    choices=["TESTS", "BACKEND"],
    default=os.environ.get("ATTACH_DEBUGGER", None),
    help="Attach debugger to TESTS and/or BACKEND",
)
arg_parser.add_argument(
    "-p", "--portable", required=False, type=Path, help="The path to the portable code"
)
arg_parser.add_argument(
    "-s",
    "--shell",
    required=False,
    type=Path,
    default=os.environ.get(
        "MYSQLSH",
        shutil.which("mysqlsh.exe") if os.name == "nt" else shutil.which("mysqlsh"),
    ),
    help="Path to MySQL Shell binary",
)
arg_parser.add_argument("-v", "--verbose", required=False, help="Enable verbose mode")
arg_parser.add_argument(
    "-u",
    "--userhome",
    required=False,
    type=Path,
    default=os.environ.get("MYSQLSH_USER_CONFIG_HOME", None),
    help="Path to the user config home",
)
arg_parser.add_argument(
    "-k",
    "--only",
    required=False,
    type=str,
    default=None,
    help="Pass a pytest -k expression to filter collected tests",
)
arg_parser.add_argument(
    "-P",
    "--pytest",
    required=False,
    type=str,
    default=None,
    help="Pass additional options to pytest",
)
arg_parser.add_argument(
    "-M",
    "--mysqlsh",
    required=False,
    type=str,
    default=None,
    help="Pass additional options to mysqlsh",
)

try:
    args, other_arguments = arg_parser.parse_known_args()
except argparse.ArgumentError as e:
    print(str(e))

print(args)

# check if we're running in the backend directory
assert Path(
    os.path.join(os.getcwd(), "run_tests.py")
).exists(), "Please run this script inside the backend directory."

assert (
    args.shell is not None
), "Could not find the MySQL Shell binary. Please specify it using the --shell parameter of the MYSQLSH environment variable."


class MyPaths:
    def __init__(self, debug_mode, portable_path, shell_path, userhome_path: Path):
        class MyPathsBase:
            pass

        self.source = MyPathsBase()
        self.runtime = MyPathsBase()
        self.runtime.plugins = MyPathsBase()
        self.runtime.plugin_data = MyPathsBase()

        self.shell = shell_path

        if debug_mode:
            self.runtime.root = Path(
                os.path.join(tempfile.gettempdir(), "backend_debug")
            )
            shutil.rmtree(self.runtime.root, ignore_errors=True)
        elif userhome_path is None:
            self.runtime.root = Path(
                os.path.join(tempfile.TemporaryDirectory().name, "dot_mysqlsh")
            )
        else:
            self.runtime.root = Path(userhome_path)

        self.runtime.plugins.root = Path(os.path.join(self.runtime.root, "plugins"))

        self.runtime.plugins.util_plugin = Path(
            os.path.join(self.runtime.plugins.root, "util_plugin")
        )

        self.source.root = Path(os.path.abspath(os.path.join(Path().cwd(), "..")))
        self.source.plugin = Path(os.path.join(self.source.root, "util_plugin"))

        self.source.pytest_config = Path(
            os.path.join(
                self.source.plugin,
                (
                    "pytest-coverage.ini"
                    if debug_mode is None
                    else self.source.plugin / "pytest.ini"
                ),
            )
        )

        if portable_path is None:
            self.source.code = self.source.plugin
        else:
            self.source.code = portable_path

    def verify(self):
        assert self.runtime.root.is_dir()
        assert self.runtime.plugins.root.is_dir()
        assert self.runtime.plugins.gui_plugin.is_dir()
        assert self.source.webroot.is_dir()
        assert self.source.pytest_config.is_file()


if args.portable is not None and zipfile.is_zipfile(args.portable):
    # Unzip the portable zip
    unzip_path = os.path.dirname(args.portable)
    with zipfile.ZipFile(args.portable, "r") as zip_ref:
        zip_ref.extractall(unzip_path)

    # Update the portable argument with the final path
    args.portable = os.path.join(unzip_path, "gui_plugin")

paths = MyPaths(args.debug, args.portable, args.shell, args.userhome)

# remove the shell home dir
if args.debug is not None and paths.runtime.root.exists():
    shutil.rmtree(paths.runtime.root, ignore_errors=True)

# create the shell home dir
if not paths.runtime.root.is_dir():
    paths.runtime.root.mkdir(parents=True)

# # create mysqlsh/plugins
if not paths.runtime.plugins.root.is_dir():
    paths.runtime.plugins.root.mkdir(parents=True)

create_symlink(paths.source.code, paths.runtime.plugins.util_plugin, is_dir=True)

LOGS = ""
MYSQLSH_FLAGS = args.mysqlsh or ""
EXTRA_OPTIONS = ""
# Enables verbose execution
if args.verbose is not None or args.debug is not None:
    LOGS = "-sv"
    MYSQLSH_FLAGS += " --verbose"

with pushd(paths.source.plugin):
    env = os.environ.copy()
    env["MYSQLSH_USER_CONFIG_HOME"] = paths.runtime.root.as_posix()
    env["MYSQLSH_TERM_COLOR_MODE"] = "nocolor"
    env["COV_CORE_DATAFILE"] = ".coverage.eager"
    env["PYTHONPATH"] = os.pathsep.join(
        filter(
            None,
            [paths.source.root.as_posix(), env.get("PYTHONPATH")],
        )
    )

    if args.debug is not None:
        env["ATTACH_DEBUGGER"] = args.debug

    pytest_targets = list(other_arguments)
    only_target = None
    only_pattern = args.only
    if args.only is not None and (
        args.only.endswith('.py')
        or '::' in args.only
        or os.sep in args.only
    ):
        only_target = args.only
        only_pattern = None

    if only_target is not None:
        pytest_targets.append(only_target)

    if not pytest_targets:
        pytest_targets = [paths.source.plugin.as_posix()]

    command = [
        paths.shell.as_posix(),
        *shlex.split(MYSQLSH_FLAGS),
        "--pym",
        "pytest",
        *shlex.split(args.pytest or ""),
        f"--cov={paths.source.code}",
        "--cov-append",
        "-vv",
        "-c",
        paths.source.pytest_config.as_posix(),
        *shlex.split(LOGS),
        *pytest_targets,
    ]

    if only_pattern is not None:
        command.extend(["-k", only_pattern])

    print(f"Test run command: {shlex.join(command)}")
    shell = subprocess.run(command, env=env)

if not shell.returncode == 0:
    print("----------------------------------------")
    print("MYSQLSH log")
    print("----------------------------------------")
    with open(os.path.join(paths.runtime.root / "mysqlsh.log")) as f:
        for line in f.readlines():
            print(line.strip())

exit(shell.returncode)
