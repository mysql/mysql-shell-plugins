# Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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
from pathlib import Path
import argparse
from contextlib import contextmanager

import signal
import sqlite3
import zipfile


def signal_handler(sig, frame):
    print(f'1) Ctrl+C! captured: {sig}')


if os.name == 'nt':
    signal.signal(signal.SIGINT, signal_handler)


@contextmanager
def pushd(new_path):
    current = os.getcwd()
    os.chdir(new_path.as_posix())
    yield
    os.chdir(current)


def create_symlink(target: Path, link_name: Path, is_dir):
    if os.name == 'nt':
        p = subprocess.run(f'mklink /J "{link_name}" "{target}"', shell=True)
        print(p.stdout)
        p.check_returncode()
    else:
        os.symlink(target, link_name)


arg_parser = argparse.ArgumentParser()

arg_parser.add_argument('-d', '--debug',
                        required=False,
                        choices=['TESTS', 'BACKEND'],
                        default=os.environ.get('ATTACH_DEBUGGER', None),
                        help='Attach debugger to TESTS and/or BACKEND')
arg_parser.add_argument('-p', '--portable',
                        required=False,
                        type=Path,
                        help='The path to the portable code')
arg_parser.add_argument('-s', '--shell',
                        required=False,
                        type=Path,
                        default=os.environ.get('MYSQLSH', shutil.which(
                            'mysqlsh.exe') if os.name == 'nt' else shutil.which('mysqlsh')),
                        help='Path to MySQL Shell binary')
arg_parser.add_argument('-v', '--verbose',
                        required=False,
                        action="store_true",
                        help='Enable verbose mode')
arg_parser.add_argument('-u', '--userhome',
                        required=False,
                        type=Path,
                        default=os.environ.get(
                            'MYSQLSH_USER_CONFIG_HOME', None),
                        help='Path to the user config home')
arg_parser.add_argument('-k', '--only',
                        required=False,
                        type=str,
                        default=None,
                        help='Run only the tests that apply to the pattern')
arg_parser.add_argument('-c', '--color',
                        required=False,
                        action="store_true",
                        help='Colors output for tests results')

arg_parser.add_argument('-l', '--logs',
                        required=False,
                        action="store_true",
                        help='Display logs at the end if there were failures')

try:
    args = arg_parser.parse_args()
except argparse.ArgumentError as e:
    print(str(e))

print(args)

# check if we're running in the backend directory
assert Path(os.path.join(os.getcwd(), 'run_tests.py')).exists(
), "Please run this script inside the backend directory."


assert args.shell is not None, "Could not find the MySQL Shell binary. Please specify it using the --shell parameter of the MYSQLSH environment variable."


class MyPaths:
    def __init__(self, debug_mode, portable_path, shell_path, userhome_path: Path):
        class MyPathsBase():
            pass

        self.source = MyPathsBase()
        self.runtime = MyPathsBase()
        self.runtime.plugins = MyPathsBase()
        self.runtime.plugin_data = MyPathsBase()

        self.shell = shell_path

        if debug_mode:
            self.runtime.root = Path(os.path.join(
                tempfile.gettempdir(), "backend_debug"))
            shutil.rmtree(self.runtime.root, ignore_errors=True)
        elif userhome_path is None:
            self.runtime.root = Path(os.path.join(
                tempfile.TemporaryDirectory().name, 'dot_mysqlsh'))
        else:
            self.runtime.root = Path(userhome_path)

        self.runtime.plugins.root = Path(
            os.path.join(self.runtime.root, 'plugins'))
        self.runtime.plugins.gui_plugin = Path(
            os.path.join(self.runtime.plugins.root, 'gui_plugin'))
        self.runtime.plugins.test_plugin = Path(
            os.path.join(self.runtime.plugins.root, 'test_plugin'))

        self.runtime.plugin_data.root = Path(
            os.path.join(self.runtime.root, 'plugin_data'))
        self.runtime.plugin_data.gui_plugin = Path(
            os.path.join(self.runtime.plugin_data.root, 'gui_plugin'))

        self.source.root = Path(os.path.abspath(
            os.path.join(Path().cwd(), '..', '..')))
        self.source.backend = Path(os.path.join(
            self.source.root, 'gui', 'backend'))
        self.source.gui_plugin = Path(
            os.path.join(self.source.backend, 'gui_plugin'))
        self.source.test_plugin = Path(
            os.path.join(self.source.root, 'gui', 'backend', 'tests', 'data', 'test_plugin'))

        self.source.pytest_config = Path(os.path.join(
            self.source.backend, "pytest-coverage.ini" if debug_mode is None else self.source.backend / "pytest.ini"))

        if portable_path is None:
            self.source.code = self.source.gui_plugin
        else:
            self.source.code = portable_path

    def verify(self):
        assert self.runtime.root.is_dir(), "root dir not found: %s" % (self.runtime.root)
        assert self.runtime.plugins.root.is_dir(
        ), "plugins root dir not found: %s" % (self.runtime.plugins.root)
        assert self.runtime.plugins.gui_plugin.is_dir(
        ), "gui plugin dir not found: %s" % (self.runtime.plugins.gui_plugin)
        assert self.source.pytest_config.is_file(
        ), "pytest config not found: %s" % (self.source.pytest_config)


if args.portable is not None and zipfile.is_zipfile(args.portable):
    # Unzip the portable zip
    unzip_path = os.path.dirname(args.portable)
    with zipfile.ZipFile(args.portable, 'r') as zip_ref:
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

# create mysqlsh/plugins
if not paths.runtime.plugins.root.is_dir():
    paths.runtime.plugins.root.mkdir(parents=True)

# remove link to .mysqlsh/plugins/gui_plugin
if paths.runtime.plugins.gui_plugin.exists():
    paths.runtime.plugins.gui_plugin.unlink()

# remove link to .mysqlsh/plugins/test_plugin
if paths.runtime.plugins.test_plugin.exists():
    paths.runtime.plugins.test_plugin.unlink()

# remove .mysqlsh/plugin_data/gui_plugin
if paths.runtime.plugin_data.gui_plugin.exists():
    shutil.rmtree(paths.runtime.plugin_data.gui_plugin, ignore_errors=True)

# Create source code symlink into the runtime plugin dir (.mysqlsh/plugins/gui_plugin)
create_symlink(paths.source.code,
               paths.runtime.plugins.gui_plugin, is_dir=True)

# Create source code symlink into the runtime plugin dir (.mysqlsh/plugins/gui_plugin)
create_symlink(paths.source.test_plugin,
               paths.runtime.plugins.test_plugin, is_dir=True)

# create a symlink of the code if it doesn't exist in the source code dir (and using portable code)
print(f"Portable at symlink: {args.portable}")
if args.portable is not None and not paths.source.gui_plugin.is_dir():
    create_symlink(paths.source.code, paths.source.gui_plugin, is_dir=True)

paths.verify()

print(f"Shell user home: {paths.runtime.root.as_posix()}")

LOGS = ""
PATTERN = ""
COLOR = "no"
# Enables verbose execution
if args.verbose or args.debug is not None:
    LOGS = "-sv"

if args.only is not None:
    PATTERN = f"-k {args.only}"

if args.color:
    COLOR = "yes"

with pushd(paths.source.backend):
    env = os.environ.copy()
    env['MYSQLSH_USER_CONFIG_HOME'] = paths.runtime.root.as_posix()
    env['MYSQLSH_TERM_COLOR_MODE'] = 'nocolor'
    env['COV_CORE_DATAFILE'] = '.coverage.eager'

    if args.debug is not None:
        env['ATTACH_DEBUGGER'] = args.debug

    command = f"{paths.shell} --pym pytest --color={COLOR} --cov={paths.source.code} --cov-append -vvv -c {paths.source.pytest_config} {LOGS} {paths.source.backend} {PATTERN}"
    print(command)
    shell = subprocess.run(command, shell=True, env=env)

if not shell.returncode == 0:
    print('----------------------------------------')
    print('MYSQLSH log')
    print('----------------------------------------')
    if args.logs:
        with open(os.path.join(paths.runtime.root / "mysqlsh.log")) as f:
            for line in f.readlines():
                print(line.strip())
    else:
        print(os.path.join(paths.runtime.root / "mysqlsh.log"))

    print('----------------------------------------')
    print('Backend database log')
    print('----------------------------------------')

    lines = []
    with sqlite3.connect(os.path.join(paths.runtime.plugin_data.gui_plugin, "mysqlsh_gui_backend_log.sqlite3")) as cur:
        for record in cur.execute("SELECT * FROM log").fetchall():
            if args.logs:
                print(str(record))
            else:
                lines.append(str(record))

    if not args.logs:
        log_file = os.path.join(paths.runtime.root / "mysqlsh_gui_backend.log")
        with open(log_file, "w") as file:
            file.writelines(lines)
            file.write("\n")
        print(log_file)

exit(shell.returncode)
