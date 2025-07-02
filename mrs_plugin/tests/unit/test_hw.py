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

import pytest
import mysqlsh

from mrs_plugin import general
import mrs_plugin.tests.unit.helpers as helpers
import msm_plugin.lib.management as schema_management
from mrs_plugin import lib

import os

# NOTE: This test requires the following script, which must be copied or
# symlinked here.
k_mysql_tasks_install = "mysql_tasks_deployment_3.0.0.sql"

if not os.path.exists(k_mysql_tasks_install):
    pytest.skip(
        f"skipping tests depending on mysql_tasks because {os.path.join(os.getcwd(),k_mysql_tasks_install)} was not found",
        allow_module_level=True,
    )


def install_mysql_tasks(session):
    print(f"Executing {k_mysql_tasks_install}")
    with open(k_mysql_tasks_install) as f:
        commands = mysqlsh.mysql.split_script(f.read())

    for sql in commands:
        session.run_sql(sql)
    print(f"Done executing {k_mysql_tasks_install}")


@pytest.fixture(scope="module")
def module_fixture(phone_book):
    conn = helpers.get_connection_data(instance=1)
    try:
        mysqlsh.globals.dba.kill_sandbox_instance(
            conn["port"], {"sandboxDir": phone_book["temp_dir"]}
        )
    except:
        pass

    mysqlsh.globals.dba.deploy_sandbox_instance(
        conn["port"],
        {"password": conn["password"], "sandboxDir": phone_book["temp_dir"]},
    )
    mysqlsh.globals.shell.connect(conn)
    install_mysql_tasks(mysqlsh.globals.session)
    yield conn
    mysqlsh.globals.shell.set_session(phone_book["session"])
    mysqlsh.globals.dba.kill_sandbox_instance(
        conn["port"], {"sandboxDir": phone_book["temp_dir"]}
    )


def test_metadata_install(module_fixture):
    session = mysqlsh.globals.session
    general.configure(edition="heatwave")

    # check if the metadata schema is there
    session.run_sql(
        "select * from mysql_rest_service_metadata.msm_schema_version"
    ).fetch_one()

    # check if default endpoints are there
    res = session.run_sql("show rest procedures on service /HeatWave/v1 schema /ml")
    procedures = set([row[0] for row in res.fetch_all()])

    assert procedures.issuperset(
        {
            "/chat",
            "/explainModel",
            "/nlSql",
            "/rag",
            "/score",
            "/train",
        }
    )

    session.run_sql("drop schema mysql_rest_service_metadata")


def test_metadata_upgrade(module_fixture):
    session = mysqlsh.globals.session
    general.configure()
    # install old version of the endpoints
    schema_management.execute_msm_sql_script(
        session=session,
        script_name="HeatWave Default Endpoints",
        sql_file_path=lib.core.script_path(
            "scripts", "default_heatwave_endpoints", f"heatwave_rest_service_1.0.0.sql"
        ),
    )

    res = session.run_sql("show rest procedures on service /HeatWave/v1 schema /ml")
    procedures = set([row[0] for row in res.fetch_all()])
    assert procedures.issuperset(
        {
            "/chat",
            "/explainModel",
            "/rag",
            "/score",
            "/train",
        }
    )

    # create random stuff that reference the service and endpoints and should
    # be untouched in upgrades
    orig_service = session.run_sql("show create rest service /HeatWave/v1").fetch_one()[0]
    assert "ADD AUTH APP `myapp`" not in orig_service
    assert "ADD AUTH APP `MySQL`" in orig_service

    session.run_sql("create rest role myrole on service /HeatWave/v1")
    session.run_sql("create rest auth app myapp vendor MySQL")

    session.run_sql("alter rest service /HeatWave/v1 add auth app `myapp`")

    new_service = session.run_sql("show create rest service /HeatWave/v1").fetch_one()[0]
    assert "ADD AUTH APP `myapp`" in new_service
    assert "ADD AUTH APP `MySQL`" in new_service

    new_roles = [row[0] for row in session.run_sql("show rest roles on service /HeatWave/v1").fetch_all()]
    assert {"myrole", "Full Access"} == set(new_roles)

    # upgrade to latest endpoints script
    general.configure(edition="heatwave")

    # check if new endpoints are there
    res = session.run_sql("show rest procedures on service /HeatWave/v1 schema /ml")
    procedures = set([row[0] for row in res.fetch_all()])
    assert "/nlSql" in procedures

    # check if various things that reference the service are still there
    upgraded_service = session.run_sql("show create rest service /HeatWave/v1").fetch_one()[0]
    assert "ADD AUTH APP `myapp`" in upgraded_service
    assert "ADD AUTH APP `MySQL`" in upgraded_service

    upgraded_roles = [row[0] for row in session.run_sql("show rest roles on service /HeatWave/v1").fetch_all()]
    assert {"myrole", "Full Access"} == set(upgraded_roles)

    session.run_sql("drop schema mysql_rest_service_metadata")
