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

"""Connection import helpers."""

import json
from typing import Optional, Tuple


def connection_fingerprint(connection: dict) -> str:
    """Return the exact connection transport definition."""
    options = connection.get("options")
    if isinstance(options, str):
        options = json.loads(options)

    return json.dumps(
        {
            "dbType": connection.get("db_type"),
            "options": options if isinstance(options, dict) else {},
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def _profile_user_id(db, profile_id: int) -> int:
    rows = db.select("SELECT user_id FROM profile WHERE id=?", (profile_id,))
    if not rows:
        raise ValueError(f"No profile found for id {profile_id}")

    return int(rows[0]["user_id"])


def validate_profile_for_session(db, profile_id: int) -> int:
    """Validate profile ownership when a backend session identity is present."""
    user_id = _profile_user_id(db, profile_id)
    session_uuid = getattr(db, "_session_uuid", None)
    if session_uuid is None:
        return user_id

    session_rows = db.select(
        "SELECT user_id FROM session WHERE uuid=?",
        (session_uuid,),
    )
    if not session_rows or session_rows[0]["user_id"] != user_id:
        raise ValueError(
            "The target profile does not belong to the authenticated session user"
        )

    return user_id


def _mapped_connection(db, user_id: int, mapping: dict) -> Optional[int]:
    target_connection_id = mapping.get("targetConnectionId")
    target_fingerprint = mapping.get("targetFingerprint")
    if not isinstance(target_connection_id, int) or not isinstance(
        target_fingerprint, str
    ):
        return None
    rows = db.select(
        """SELECT dc.*
        FROM db_connection dc
        JOIN profile_has_db_connection phdc
            ON phdc.db_connection_id=dc.id
        JOIN profile p ON p.id=phdc.profile_id
        WHERE dc.id=? AND p.user_id=?
        LIMIT 1""",
        (target_connection_id, user_id),
    )
    if not rows or connection_fingerprint(rows[0]) != target_fingerprint:
        return None

    return target_connection_id


def _profile_connection_index(db, profile_id: int) -> dict[str, int]:
    rows = db.select(
        """SELECT dc.*
        FROM db_connection dc
        JOIN profile_has_db_connection phdc
            ON phdc.db_connection_id=dc.id
        WHERE phdc.profile_id=?""",
        (profile_id,),
    )

    return {connection_fingerprint(row): int(row["id"]) for row in rows}


def _folder_for_caption(
    db,
    profile_id: int,
    caption: str,
) -> Tuple[int, str]:
    from gui_plugin.db_connections.DbConnections import ensure_folder_path

    base_folder = ensure_folder_path(
        db,
        profile_id,
        "Imported from MySQL Workbench",
        parent_folder_id=1,
    )
    caption_parts = caption.split("/", 1)
    if len(caption_parts) == 1:
        return base_folder["id"], caption_parts[0].strip()

    group_caption = caption_parts[0].strip()
    connection_caption = caption_parts[1].strip()
    if not group_caption:
        return base_folder["id"], connection_caption
    group_folder = ensure_folder_path(
        db,
        profile_id,
        group_caption,
        parent_folder_id=base_folder["id"],
    )

    return group_folder["id"], connection_caption


def _mapping_record(
    target_connection_id: int,
    target_fingerprint: str,
) -> dict:
    return {
        "targetConnectionId": target_connection_id,
        "targetFingerprint": target_fingerprint,
    }


def merge_connections(
    db,
    profile_id: int,
    source: str,
    connections: list[dict],
    source_mappings: Optional[dict] = None,
) -> dict:
    """Import connections and reuse mappings from the same legacy source."""
    from gui_plugin.db_connections.DbConnections import insert_db_connection

    user_id = validate_profile_for_session(db, profile_id)
    mappings = source_mappings if source_mappings is not None else {}
    manual_targets = (
        _profile_connection_index(db, profile_id)
        if source_mappings is None
        else {}
    )
    report = {
        "phase": "workbenchConnections",
        "imported": 0,
        "merged": 0,
        "skipped": 0,
        "warnings": [],
        "failed": [],
    }
    for index, connection in enumerate(connections):
        mapping_key = f"{source}:{index}"
        mapping = mappings.get(mapping_key)
        fingerprint = connection_fingerprint(connection)
        if source_mappings is None:
            target_connection_id = manual_targets.get(fingerprint)
        else:
            target_connection_id = (
                _mapped_connection(db, user_id, mapping)
                if isinstance(mapping, dict)
                else None
            )
        if target_connection_id is not None:
            report["merged"] += 1
        else:
            folder_id, caption = _folder_for_caption(
                db,
                profile_id,
                connection["caption"],
            )
            connection_for_storage = {
                key: value
                for key, value in connection.items()
                if not key.startswith("_")
            }
            connection_for_storage["caption"] = caption
            target_connection_id, _folder_id, _index = insert_db_connection(
                db,
                profile_id,
                connection_for_storage,
                folder_id,
            )
            manual_targets[fingerprint] = target_connection_id
            report["imported"] += 1

        mappings[mapping_key] = _mapping_record(
            target_connection_id,
            fingerprint,
        )

    return report
