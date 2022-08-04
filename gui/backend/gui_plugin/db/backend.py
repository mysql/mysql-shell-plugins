# Copyright (c) 2022, Oracle and/or its affiliates.
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

import gui_plugin.core.Error as Error
from gui_plugin.core import DbSession


def get_db_session(session: object) -> object:
    if session is None:
        import mysqlsh
        session = getattr(mysqlsh.globals, "session", None)

    if session is None:
        raise Error.Error.MSGException(Error.CORE_INVALID_PARAMETER,
                                       "Session required for this operation.")

    if not isinstance(session, DbSession.DbSession):
        session = DbSession.DbSessionFactory.create(
            "MySQL", None, False, None, None, True, None, None,
            None, None, None, session)

    return session
