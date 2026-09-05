# Copyright (c) 2026, Oracle and/or its affiliates.
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

from gui_plugin.core.modules.DbModuleSession import DbModuleSession
from gui_plugin.db_connections import DbConnections


class _TestModuleSession(DbModuleSession):
    def __del__(self):
        pass


def test_cache_refresh_failure_does_not_fail_connection(monkeypatch):
    module_session = object.__new__(_TestModuleSession)
    module_session._db_connection_id = 7
    service_session = object()
    calls = []

    def fail_refresh(*args):
        calls.append(args)
        raise RuntimeError("cache unavailable")

    monkeypatch.setattr(DbConnections, "refresh_server_status_cache", fail_refresh)
    module_session._refresh_server_status_cache(service_session)

    assert calls == [(7, service_session)]
