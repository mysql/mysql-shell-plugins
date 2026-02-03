# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

import os
import subprocess
import pathlib
from typing import Optional
import mysqlsh  # type: ignore
from migration_plugin.lib import oci_utils


def get_connection_data(instance=0):
    return {
        "user": os.environ.get("MYSQL_USER", "root"),
        "host": os.environ.get("MYSQL_HOST", "localhost"),
        "port": os.environ.get("MYSQL_PORT", str(3388 + instance)),
        "password": os.environ.get("MYSQL_PASSWORD", ""),
    }


def create_shell_session(connection_data={}) -> mysqlsh.globals.session:
    if not connection_data:
        connection_data = get_connection_data()
    shell = mysqlsh.globals.shell
    url = f"{connection_data['user']}:{connection_data['password']}@{connection_data['host']}:{connection_data['port']}"
    return shell.connect(url)


class preprocess_script:
    def __init__(self, path, defines=[]):
        self.path = path
        self.defines = defines
        self.tmp_path = None

    def handle_ifdef(self, line: str, lines: list[str], index: int) -> tuple[Optional[bool], int]:
        stripped = line.strip()
        if not stripped.startswith("--#"):
            return None, index

        parts = stripped[3:].strip().split()
        directive = parts[0]
        if directive == "ifdef":
            define = parts[1]
            return define in self.defines, index + 1
        elif directive == "ifndef":
            define = parts[1]
            return define not in self.defines, index + 1
        elif directive == "else":
            return None, index + 1
        elif directive == "endif":
            return None, index + 1
        else:
            return None, index

    def handle_ifdefs(self, lines: list[str]) -> str:
        out_lines = []
        skip_stack = []
        index = 0
        while index < len(lines):
            line = lines[index]
            result, new_index = self.handle_ifdef(line, lines, index)
            if result is not None:
                if result:
                    skip_stack.append(False)
                else:
                    skip_stack.append(True)
                index = new_index
                continue
            elif line.strip().startswith("--#else"):
                if skip_stack:
                    skip_stack[-1] = not skip_stack[-1]
                index = new_index
                continue
            elif line.strip().startswith("--#endif"):
                if skip_stack:
                    skip_stack.pop()
                index = new_index
                continue

            if not any(skip_stack):
                out_lines.append(line)
            index += 1

        return "\n".join(out_lines)

    def __enter__(self):
        with open(self.path, "r") as f:
            lines = f.readlines()

        content = self.handle_ifdefs(lines)

        tmp_path = pathlib.Path(self.path).parent / \
            f".tmp_{pathlib.Path(self.path).name}"
        with open(tmp_path, "w") as f:
            f.write(content)
        self.tmp_path = str(tmp_path)
        return self.tmp_path

    def __exit__(self, exc_type, exc_value, traceback):
        if self.tmp_path and os.path.exists(self.tmp_path):
            os.remove(self.tmp_path)


def execute_script(session, path, defines=None):
    connection_data = mysqlsh.globals.shell.parse_uri(session.uri)
    if "password" not in connection_data:
        connection_data["password"] = ""

    if not defines:
        defines = []
    version = session.run_sql("SELECT @@VERSION").fetch_one()[0]
    old_mysql = int(version.split(".")[0]) < 8
    if old_mysql:
        defines.append("OLD_MYSQL")

    uri = f"{connection_data['user']}:{connection_data['password']}@{connection_data['host']}:{connection_data['port']}"

    with preprocess_script(path, defines) as tmp_path:
        subprocess.check_call(
            ["mysqlsh", uri, "--quiet-start=2", "-f", tmp_path])


def load_sakila(session):
    if session.run_sql("show schemas like 'sakila'").fetch_one():
        return

    prefix = pathlib.Path(os.path.realpath(__file__)).parent.parent.parent.parent / \
        "gui/frontend/src/tests/unit-tests/data/sakila-db"

    for fname in ["sakila-schema.sql", "sakila-data.sql"]:
        execute_script(session, prefix / fname)


def server_version(session) -> tuple[int, ...]:
    return tuple(int(ver) for ver in session.run_sql("SELECT @@VERSION").fetch_one()[0].split("-")[0].split("."))


def resolve_vcn(oci_config, ocid: str):
    """
    Resolve networking params for migration from the OCID of a VCN.
    Returns:
    - network compartment id
    - private subnet id
    - public subnet id
    """
    vcn = oci_utils.VCN(oci_config, ocid_or_vcn=ocid)

    public = None
    private = None
    other = None
    subnets = vcn.get_all_subnets()
    for subnet in subnets:
        if subnet.display_name and "public" in subnet.display_name.lower():
            public = subnet
        elif subnet.display_name and "private" in subnet.display_name.lower():
            private = subnet
        else:
            other = subnet
    if not public and other and len(subnets) == 2:
        public = other
    elif not private and other and len(subnets) == 2:
        private = other

    print(f"VCN {ocid} is {vcn.display_name}, public={public.display_name if public else ''} private={private.display_name if private else ''}")

    if not public or not private:
        raise Exception(
            f"Could not detect public and/or private subnets for VCN {vcn.display_name}")

    return {
        "vcn_id": vcn.id,
        "private_subnet_id": private.id,
        "public_subnet_id": public.id,
    }


def shell_version() -> str:
    return mysqlsh.globals.shell.version.split()[1]
