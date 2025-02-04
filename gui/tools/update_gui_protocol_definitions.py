#!/bin/sh
# Copyright (c) 2023, 2025, Oracle and/or its affiliates.

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
import os
import sys
from pathlib import Path
import subprocess
import tempfile
import shutil
import glob

def create_symlink(target: Path, link_name: Path, is_dir: bool):
    if os.name == 'nt':
        if is_dir:
            p = subprocess.run(f'mklink /J "{link_name}" "{target}"', shell=True)
        else:
            p = subprocess.run(f'mklink /H "{link_name}" "{target}"', shell=True)
        p.check_returncode()
    else:
        os.symlink(target, link_name)
dot_mysqlsh = tempfile.TemporaryDirectory(dir=os.path.dirname(__file__))
plugins_dir = os.path.join(dot_mysqlsh.name, 'plugins')
startup_dir = os.path.join(dot_mysqlsh.name, 'init.d')
gui_plugin = os.path.join(plugins_dir, 'gui_plugin')
mrs_plugin = os.path.join(plugins_dir, 'mrs_plugin')
mds_plugin = os.path.join(plugins_dir, 'mds_plugin')
msm_plugin = os.path.join(plugins_dir, 'msm_plugin')


src_root = os.path.abspath(f'{os.path.dirname(__file__)}/../..')
src_gui_plugin = os.path.join(src_root, 'gui', 'backend', 'gui_plugin')
src_mrs_plugin = os.path.join(src_root, 'mrs_plugin')
src_mds_plugin = os.path.join(src_root, 'mds_plugin')
src_msm_plugin = os.path.join(src_root, 'msm_plugin')
src_protocols_root = os.path.join(src_root, 'gui', 'tools', 'src', 'protocol')

Path(plugins_dir).mkdir()

create_symlink(src_gui_plugin, gui_plugin, True)
create_symlink(src_mrs_plugin, mrs_plugin, True)
create_symlink(src_mds_plugin, mds_plugin, True)
create_symlink(src_msm_plugin, msm_plugin, True)
create_symlink(src_protocols_root, startup_dir, True)

env = os.environ.copy()
env['MYSQLSH_USER_CONFIG_HOME'] = dot_mysqlsh.name
mysqlsh=shutil.which('mysqlsh.exe') if os.name == 'nt' else shutil.which('mysqlsh')

command = f"{mysqlsh} --py -e \"print('Protocol files have been updated')\""

print(command)

shell = subprocess.run(command, shell=True, env=env)
