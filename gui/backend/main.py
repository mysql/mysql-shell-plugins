#! /usr/bin/env python3
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
import gui_plugin as gui
import os
import argparse

import mysqlsh

parser = argparse.ArgumentParser(description='Shell GUI Server')
parser.add_argument('-p', '--port', type=int, default=8000,
                    help='Launches the server on a specified port.')
parser.add_argument('--nossl', action='store_true', default=False,
                    help='Don''t use SSL for conections. This can be set even for development runs.')
parser.add_argument('--token', type=str, default=None,
                    help='Specify a uuid token to switch to single user mode')

args = parser.parse_args()

# Get the plugins from the mysqlsh.globals
gui = mysqlsh.get_plugin('gui')
port = args.port
secure = not args.nossl
webdir = 'webroot'

webroot = os.path.join(os.path.dirname(__file__), 'gui_plugin', 'core', webdir)

# on the terminal use
# mysqlsh -py -e "gui.core.start_web_server()"

# Start the web server
# --------------------
gui.start.web_server(port=port, secure={} if secure else None,
                     webrootpath=webroot, single_instance_token=args.token)

# Convert all MySQL SQL script files in the db_schema folder to Sqlite
# --------------------------------------------------------------------
# Db.convert_all_workbench_sql_files_to_sqlite()

# Test module functions
# ---------------------
# print(gui.users.create_user('alfredo', '4321'))
# print(gui.users.grant_role('alfredo', 'Administrator'))
# print(gui.users.list_users())
