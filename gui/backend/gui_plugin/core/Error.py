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
import json


SYSTEM_OK = 0
SYSTEM_GENERIC_ERROR = 1

# Common Modules: 1000-1999
# core: 1000-1099
CORE_ABSPATH_NOT_ALLOWED = 1000
CORE_ACCESS_OUTSIDE_USERSPACE = 1001
CORE_PATH_NOT_EXIST = 1002
CORE_NOT_FILE = 1003
CORE_NOT_DIRECTORY = 1004
CORE_PERMISSION_DENIED = 1005
CORE_PATH_NOT_SUPPLIED = 1006
CORE_PATH_ALREADY_EXISTS = 1007
CORE_INVALID_EXTENSION = 1008
CORE_RESERVED_NOT_ALLOWED = 1009

CORE_FEATURE_NOT_SUPPORTED = 1011
CORE_INVALID_PARAMETER = 1012
CORE_INVALID_DATA_FORMAT = 1013
# debugger: 1100-1199
# db_connections: 1200-1299
DB_NOT_OPEN = 1200
DB_QUERY_KILLED = 1201
DB_INVALID_OPTIONS = 1202
DB_INVALID_CONNECTION_ID = 1203
DB_UNSUPPORTED_OBJECT_TYPE = 1204
DB_INVALID_DB_TYPE = 1205
DB_ERROR = 1206
DB_UNSUPPORTED_FILE_VERSION = 1205

# users: 1300-1399
USER_INVALID_ROLE = 1300
USER_INVALID_USER = 1301
USER_DELETE_PROFILE = 1302
USER_MISSING_GROUP_OWNER = 1303
USER_CREATE = 1304
USER_INVALID_PROFILE = 1305
USER_INVALID_GROUP = 1306
USER_CANT_DELETE_GROUP = 1307
# start: 1400-1499
# shell: 1500-1599
SHELL_COMMAND_NOT_SUPPORTED = 1500
# modules: 1600-1699
MODULES_USER_HAVE_NO_PRIVILEGES = 1602
MODULES_NO_PRIVILEGES_FOUND_FOR_MODULE_DATA = 1603
MODULES_NO_PROFILE_FOUND = 1604
MODULES_NO_USER_GROUP_FOUND = 1606
MODULES_SHARING_WITH_HIGHER_PERMISSIONS = 1608
MODULES_INVALID_DATA_CATEGORY = 1609
MODULES_CANT_DELETE_MODULE_CATEGORY = 1610
MODULES_INVALID_MODULE_ID = 1611

# sqleditor: 2000-2999
# mds: 3000-3999
# modeler: 4000-4999


class MSGException(Exception):
    def __init__(self, code, message, source=''):
        Exception.__init__(self, f"Error[MSG{source}-{code}]: {message}")
        self.code = code
        self.msg = message
        self.source = f'MSG{source}'
