rem!/bin/bash

rem Copyright (c) 2022, 2023, Oracle and/or its affiliates.

rem This program is free software; you can redistribute it and/or modify
rem it under the terms of the GNU General Public License, version 2.0,
rem as published by the Free Software Foundation.
rem
rem This program is also distributed with certain software (including
rem but not limited to OpenSSL) that is licensed under separate terms, as
rem designated in a particular file or component or in included license
rem documentation.  The authors of MySQL hereby grant you an additional
rem permission to link the program and your derivative works with the
rem separately licensed software that they have included with MySQL.
rem This program is distributed in the hope that it will be useful,  but
rem WITHOUT ANY WARRANTY; without even the implied warranty of
rem MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
rem the GNU General Public License, version 2.0, for more details.
rem
rem You should have received a copy of the GNU General Public License
rem along with this program; if not, write to the Free Software Foundation, Inc.,
rem 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

set LOG_LEVEL=DEBUG2
mysqlsh --py -e "gui.start.web_server(port=8000, single_instance_token='1234')"
