#!/usr/bin/env python3
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

import argparse
import datetime
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

LOG_RELATIVE_PATH = Path("plugin_data") / "gui_plugin" / "mysqlsh_gui_backend_log.sqlite3"
APPLICATION_SUPPORT_PATH = Path.home() / "Library" / "Application Support"


def default_log_path() -> Path:
    user_config_home = os.environ.get("MYSQLSH_USER_CONFIG_HOME")
    if user_config_home:
        return Path(user_config_home).expanduser() / LOG_RELATIVE_PATH

    candidates = [
        APPLICATION_SUPPORT_PATH / "MySQL Workbench" / "mysqlsh" / LOG_RELATIVE_PATH,
        APPLICATION_SUPPORT_PATH / "Electron" / "mysqlsh" / LOG_RELATIVE_PATH,
        APPLICATION_SUPPORT_PATH
        / "mysql-shell-gui-electron-poc"
        / "mysqlsh"
        / LOG_RELATIVE_PATH,
        Path.home() / ".mysqlsh" / LOG_RELATIVE_PATH,
    ]
    existing = [candidate for candidate in candidates if candidate.exists()]
    if existing:
        return max(existing, key=lambda candidate: candidate.stat().st_mtime)

    return candidates[0]


def connect_read_only(log_path: Path) -> sqlite3.Connection:
    uri = f"file:{log_path}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row

    return connection


def format_json_message(message: str) -> str:
    try:
        return json.dumps(json.loads(message), indent=2, sort_keys=True)
    except json.JSONDecodeError:
        return message


def format_message(row: sqlite3.Row, pretty_json: bool) -> str:
    direction = "->" if row["is_response"] else "<-"
    message = row["message"] or ""
    if pretty_json:
        message = format_json_message(message)

    return (
        f"{row['id']} {row['sent']} {direction} "
        f"session={row['session_id']}  {message}"
    )


def fetch_initial_id(connection: sqlite3.Connection, lines: int) -> int:
    if lines <= 0:
        row = connection.execute(
            "SELECT COALESCE(MAX(id), 0) AS id FROM message"
        ).fetchone()

        return int(row["id"])

    row = connection.execute(
        """
        SELECT COALESCE(MIN(id), 0) AS id
          FROM (SELECT id FROM message ORDER BY id DESC LIMIT ?)
        """,
        (lines,),
    ).fetchone()

    return max(0, int(row["id"]) - 1)


def latest_message_status(connection: sqlite3.Connection) -> str:
    row = connection.execute(
        "SELECT COUNT(*) AS count, MAX(id) AS id, MAX(sent) AS sent FROM message"
    ).fetchone()

    return f"messages={row['count']} latest_id={row['id']} latest_sent={row['sent']}"


def print_new_messages(
    connection: sqlite3.Connection, last_id: int, pretty_json: bool
) -> int:
    rows = connection.execute(
        """
        SELECT id, session_id, request_id, is_response, message, sent
          FROM message
         WHERE id > ?
         ORDER BY id
        """,
        (last_id,),
    ).fetchall()

    for row in rows:
        print(format_message(row, pretty_json), flush=True)
        last_id = int(row["id"])

    return last_id


def wait_for_log(log_path: Path, interval: float) -> None:
    while not log_path.exists():
        print(
            f"{datetime.datetime.now().isoformat(timespec='seconds')} "
            f"waiting for {log_path}",
            file=sys.stderr,
            flush=True,
        )
        time.sleep(interval)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Tail the MySQL Workbench GUI backend protocol log."
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=default_log_path(),
        help="Path to mysqlsh_gui_backend_log.sqlite3.",
    )
    parser.add_argument(
        "-n",
        "--lines",
        type=int,
        default=20,
        help="Number of existing messages to print before following. Use 0 for new messages only.",
    )
    parser.add_argument(
        "-i",
        "--interval",
        type=float,
        default=0.5,
        help="Polling interval in seconds.",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON protocol messages.",
    )
    args = parser.parse_args()

    log_path = args.db.expanduser()
    wait_for_log(log_path, args.interval)

    connection = connect_read_only(log_path)
    print(
        f"tailing {log_path} ({latest_message_status(connection)})",
        file=sys.stderr,
        flush=True,
    )
    print(
        "protocol logging is written only when MYSQL_SHELL_GUI_DEBUG_MODE=1 "
        "is set in the mysqlsh backend process",
        file=sys.stderr,
        flush=True,
    )
    last_id = fetch_initial_id(connection, args.lines)
    pretty_json = args.pretty

    try:
        while True:
            last_id = print_new_messages(connection, last_id, pretty_json)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        return 0
    finally:
        connection.close()


if __name__ == "__main__":
    sys.exit(main())
