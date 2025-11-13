# Copyright (c) 2025, Oracle and/or its affiliates.
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


def execute_script(session, path):
    connection_data = mysqlsh.globals.shell.parse_uri(session.uri)
    if "password" not in connection_data:
        connection_data["password"] = ""

    uri = f"{connection_data['user']}:{connection_data['password']}@{connection_data['host']}:{connection_data['port']}"

    subprocess.check_call(["mysqlsh", uri, "--quiet-start=2", "-f", path])


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
