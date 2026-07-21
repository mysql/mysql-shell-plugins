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
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import argparse
import json
import os
import pathlib
import shutil
import socket
import subprocess
import sys
from typing import Any, Dict, List, Tuple


E2E_DIR = pathlib.Path(__file__).resolve().parent
CONFIG_TEMPLATE = E2E_DIR / ".env.test.json.in"
CONFIG_FILE = E2E_DIR / ".env.test.json"
EXECUTION_DIR = E2E_DIR / "execution"
SANDBOX_DIR = EXECUTION_DIR / "sandbox"
SQL_DIR = E2E_DIR / "sql"
MYSQLSH_CONFIG_DIR = EXECUTION_DIR / "mysqlsh"


def default_mysql_port() -> str:
    return (
        os.environ.get("ELECTRON_E2E_MYSQL_PORT")
        or os.environ.get("MYSQL_PORT")
        or "2208"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--execution_mode",
        choices=["setup", "teardown"],
        default="setup",
        help="Prepare or clean up the Electron e2e database fixture.",
    )
    parser.add_argument(
        "--db_root_user",
        default=os.environ.get("DB_ROOT_USER", "root"),
        help="MySQL root/admin user used for fixture setup.",
    )
    parser.add_argument(
        "--db_root_password",
        default=os.environ.get("DB_ROOT_PASSWORD", ""),
        help="MySQL root/admin password. Use '-' for an empty password.",
    )

    return parser.parse_args()


def mysqlsh_executable() -> str:
    return os.environ.get("ELECTRON_E2E_MYSQLSH") or os.environ.get("MYSQLSH") or "mysqlsh"


def mysqld_path() -> str | None:
    return os.environ.get("ELECTRON_E2E_MYSQLD_PATH") or os.environ.get("MYSQLD_PATH")


def load_json(path: pathlib.Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)  # type: ignore[no-any-return]


def save_config(config: Dict[str, Any]) -> None:
    CONFIG_FILE.write_text(json.dumps(config, indent=4) + "\n", encoding="utf-8")


def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)

        return sock.connect_ex(("localhost", port)) == 0


def connection_uri(user: str, password: str, port: str) -> str:
    return f"{user}:{password}@localhost:{port}"


def run_mysqlsh(args: List[str], env: Dict[str, str]) -> None:
    command = [mysqlsh_executable(), "--disable-builtin-plugins", *args]
    subprocess.check_call(command, env=env)


def run_mysqlsh_output(args: List[str], env: Dict[str, str]) -> str:
    command = [mysqlsh_executable(), "--disable-builtin-plugins", *args]

    return subprocess.check_output(command, env=env, text=True)


def run_sql_file(connection: str, path: pathlib.Path, env: Dict[str, str]) -> None:
    run_mysqlsh(["--sql", "--quiet-start=2", connection, "-f", str(path)], env)


def mysql_server_info(connection: str, env: Dict[str, str]) -> Tuple[str, str]:
    output = run_mysqlsh_output([
        "--py",
        "--quiet-start=2",
        connection,
        "-e",
        (
            "row = session.run_sql('SELECT @@version, @@basedir').fetch_one(); "
            "print(row[0]); print(row[1])"
        ),
    ], env)

    lines = [line.strip() for line in output.splitlines() if line.strip()]
    if len(lines) >= 2:
        return (lines[-2], lines[-1])

    raise RuntimeError("Could not determine Electron e2e sandbox MySQL server info.")


def deploy_sandbox(port: str, password: str, env: Dict[str, str]) -> None:
    server_path = mysqld_path()
    SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
    command = [
        "--",
        "dba",
        "deploy-sandbox-instance",
        port,
        f"--password={password}",
        f"--sandbox-dir={SANDBOX_DIR}",
    ]
    if server_path:
        command.append(f"--mysqld-path={server_path}")

    run_mysqlsh(command, env)


def delete_sandbox(port: str, env: Dict[str, str]) -> None:
    run_mysqlsh([
        "--",
        "dba",
        "kill-sandbox-instance",
        port,
        f"--sandbox-dir={SANDBOX_DIR}",
    ], env)
    run_mysqlsh([
        "--",
        "dba",
        "delete-sandbox-instance",
        port,
        f"--sandbox-dir={SANDBOX_DIR}",
    ], env)


def setup(args: argparse.Namespace) -> None:
    root_password = "" if args.db_root_password == "-" else args.db_root_password
    CONFIG_FILE.unlink(missing_ok=True)
    config = load_json(CONFIG_TEMPLATE)
    env = os.environ.copy()

    MYSQLSH_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    env["MYSQLSH_USER_CONFIG_HOME"] = str(MYSQLSH_CONFIG_DIR)

    db_port = default_mysql_port()
    if is_port_in_use(int(db_port)):
        raise RuntimeError(
            f"Cannot deploy Electron e2e sandbox: port {db_port} is already in use. "
            "Stop the process using that port or choose another test port."
        )

    deploy_sandbox(db_port, root_password, env)
    root_connection = connection_uri(args.db_root_user, root_password, db_port)
    version, basedir = mysql_server_info(root_connection, env)
    print(f"[OK] Electron e2e sandbox MySQL version: {version}")
    print(f"[OK] Electron e2e sandbox MySQL basedir: {basedir}")

    config["MYSQL_PORT"] = db_port
    config["MYSQL_VERSION"] = version
    config["SANDBOX_DIR"] = str(SANDBOX_DIR)
    config["MYSQLSH_USER_CONFIG_HOME"] = str(EXECUTION_DIR / "mysqlsh")
    save_config(config)

    run_sql_file(root_connection, SQL_DIR / "01_users.sql", env)
    run_sql_file(root_connection, SQL_DIR / "02_sakila.sql", env)

    print("[OK] Electron e2e database fixture is ready")


def teardown() -> None:
    config = load_json(CONFIG_FILE) if CONFIG_FILE.exists() else {}
    env = os.environ.copy()
    MYSQLSH_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    env["MYSQLSH_USER_CONFIG_HOME"] = str(MYSQLSH_CONFIG_DIR)

    if SANDBOX_DIR.exists():
        delete_sandbox(str(config.get("MYSQL_PORT") or default_mysql_port()), env)

    if EXECUTION_DIR.exists():
        shutil.rmtree(EXECUTION_DIR)

    CONFIG_FILE.unlink(missing_ok=True)

    print("[OK] Electron e2e database fixture has been cleaned up")


def main() -> None:
    args = parse_args()

    try:
        if args.execution_mode == "setup":
            setup(args)
        else:
            teardown()
    except Exception as exc:
        print(f"[ERR] {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
