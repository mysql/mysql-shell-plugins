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

"""Backend-owned metadata for saved database connections.

Values written here must originate from backend-controlled observations. Never
populate ``db_connection.internal_data`` from frontend or other client input.
"""

import json
from datetime import datetime, timezone
from typing import Any, Optional

from gui_plugin.core.Db import BackendDatabase, BackendTransaction


SERVER_STATUS_CACHE_KEY = "serverStatusCache"
SERVER_STATUS_SYSVARS = (
    "hostname",
    "bind_address",
    "admin_address",
    "admin_port",
    "socket",
    "port",
    "server_id",
    "server_uuid",
    "version_compile_os",
    "version_comment",
    "version",
    "basedir",
    "datadir",
    "tmpdir",
    "plugin_dir",
    "log_output",
    "general_log",
    "general_log_file",
    "log_error",
    "log_error_services",
    "slow_query_log",
    "slow_query_log_file",
)
SSH_OPTION_NAMES = (
    "ssh",
    "ssh-config-file",
    "ssh-identity-file",
    "ssh-public-identity-file",
)
CONNECTION_ENDPOINT_OPTION_NAMES = (
    "host",
    "port",
    "socket",
    "scheme",
    *SSH_OPTION_NAMES,
)
LOCAL_HOSTS = ("", "localhost", "127.0.0.1", "::1", "[::1]")


def _get_internal_data(db: Any, connection_id: int) -> dict[str, Any]:
    result = db.select(
        "SELECT internal_data FROM db_connection WHERE id = ?", (connection_id,)
    )
    if not result:
        return {}

    internal_data = result[0].get("internal_data")
    return internal_data if isinstance(internal_data, dict) else {}


def _is_local_session(db_session: Any) -> bool:
    options = db_session.connection_options or {}
    if any(options.get(name) for name in SSH_OPTION_NAMES):
        return False

    host = str(options.get("host", "")).strip().lower()
    return bool(options.get("socket")) or host in LOCAL_HOSTS


def _connection_endpoint(options: dict[str, Any]) -> dict[str, Any]:
    return {
        name: options[name]
        for name in CONNECTION_ENDPOINT_OPTION_NAMES
        if name in options
    }


def _read_server_status_sysvars(db_session: Any) -> list[dict[str, str]]:
    quoted_names = ", ".join(f"'{name}'" for name in SERVER_STATUS_SYSVARS)
    result = db_session.run_sql(
        f"SHOW GLOBAL VARIABLES WHERE Variable_name IN ({quoted_names})"
    )
    sysvars = []
    row = result.fetch_one()
    while row:
        name = str(row[0])
        if name.lower() in SERVER_STATUS_SYSVARS:
            value = "" if row[1] is None else str(row[1])
            sysvars.append({"name": name, "value": value})
        row = result.fetch_one()

    return sysvars


def refresh_server_status_cache(
    connection_id: int, db_session: Any, be_session: Any = None
) -> None:
    """Refreshes trusted server status data observed through a service session."""
    if db_session.database_type != "MySQL":
        return

    db_session.lock()
    try:
        sysvars = _read_server_status_sysvars(db_session)
    finally:
        db_session.release()

    cache = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "isLocal": _is_local_session(db_session),
        "sysvars": sysvars,
    }
    with BackendDatabase(be_session) as db:
        row = db.execute(
            "SELECT options FROM db_connection WHERE id = ?", (connection_id,),
        ).fetch_one()
        if not row:
            return

        saved_options = row[0]
        if (_connection_endpoint(json.loads(saved_options))
                != _connection_endpoint(db_session.connection_options or {})):
            return

        # Publish only if the saved connection is unchanged; merge into current metadata.
        db.execute(
            """UPDATE db_connection
            SET internal_data = json_set(
                CASE WHEN json_type(internal_data) = 'object' THEN internal_data ELSE '{}' END,
                '$.serverStatusCache', json(?)
            )
            WHERE id = ? AND options = ?""",
            (json.dumps(cache), connection_id, saved_options),
        )


def get_server_status_cache(
    connection_id: int, _user_id: Optional[int] = None,
    be_session: Any = None,
) -> Optional[dict[str, Any]]:
    """Returns normalized trusted server status data for a saved connection."""
    with BackendDatabase(be_session) as db:
        if _user_id is not None:
            rows = db.select(
                """SELECT 1
                FROM profile_has_db_connection pdc
                    JOIN profile p ON pdc.profile_id = p.id
                WHERE pdc.db_connection_id=? AND p.user_id=?""",
                (connection_id, _user_id),
            )
            if not rows:
                return None
        cache = _get_internal_data(db, connection_id).get(SERVER_STATUS_CACHE_KEY)

    if not isinstance(cache, dict):
        return None
    if not isinstance(cache.get("updatedAt"), str):
        return None
    if not isinstance(cache.get("isLocal"), bool):
        return None

    sysvars = cache.get("sysvars")
    if not isinstance(sysvars, list):
        return None

    normalized_sysvars = []
    for sysvar in sysvars:
        if (
            not isinstance(sysvar, dict)
            or not isinstance(sysvar.get("name"), str)
            or not isinstance(sysvar.get("value"), str)
        ):
            return None
        normalized_sysvars.append({"name": sysvar["name"], "value": sysvar["value"]})

    return {
        "updatedAt": cache["updatedAt"],
        "isLocal": cache["isLocal"],
        "sysvars": normalized_sysvars,
    }


def invalidate_server_status_cache(connection_id: int, be_session: Any = None) -> None:
    """Removes cached server observations after connection identity changes."""
    def invalidate(db: Any) -> None:
        internal_data = _get_internal_data(db, connection_id)
        if internal_data.pop(SERVER_STATUS_CACHE_KEY, None) is None:
            return
        db.execute(
            "UPDATE db_connection SET internal_data=? WHERE id=?",
            (json.dumps(internal_data), connection_id),
        )

    with BackendDatabase(be_session) as db:
        if be_session is not None:
            invalidate(db)
        else:
            with BackendTransaction(db):
                invalidate(db)
