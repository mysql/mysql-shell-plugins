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
import os

from mrs_plugin import lib, general
from .helpers import ServiceCT, SchemaCT, QueryResults, TableContents
import mrs_plugin.tests.unit.helpers as helpers

# pass --mdupgrade to run this test
mdupgrade = pytest.mark.skipif("not config.getoption('mdupgrade')")


def save_server_state(session):
    # fetch initial list of users and schemas
    orig_users = [
        r[0]
        for r in session.run_sql(
            "select concat(user, '@', quote(host)) from mysql.user"
        ).fetch_all()
    ]
    orig_schemas = [r[0] for r in session.run_sql("show schemas").fetch_all()]

    def restore():
        users = session.run_sql(
            "select concat(user, '@', quote(host)) from mysql.user"
        ).fetch_all()
        for (user,) in users:
            if user not in orig_users:
                session.run_sql(f"drop user {user}")

        schemas = session.run_sql("show schemas").fetch_all()
        for (schema,) in schemas:
            if schema not in orig_schemas:
                session.run_sql("drop schema !", [schema])

    return restore, orig_users, orig_schemas


@pytest.fixture(scope="module")
def module_fixture(phone_book):
    conn = helpers.get_connection_data(instance=1)
    try:
        mysqlsh.globals.dba.kill_sandbox_instance(conn["port"], {
            "sandboxDir": phone_book["temp_dir"]
        })
    except:
        pass

    mysqlsh.globals.dba.deploy_sandbox_instance(
        conn["port"],
        {"password": conn["password"], "sandboxDir": phone_book["temp_dir"]},
    )
    mysqlsh.globals.shell.connect(conn)
    yield conn
    mysqlsh.globals.shell.set_session(phone_book["session"])
    mysqlsh.globals.dba.kill_sandbox_instance(conn["port"], {
        "sandboxDir": phone_book["temp_dir"]
    })


def snapshot_server(session, orig_users, orig_schemas):
    def fetch_accounts():
        def fetch_grants(user):
            # filter out grant on schema_version, which was missed during 3.x to 4.0
            # upgrade but can't be easily revoked in a backwards compatible way
            def ignore(grant):
                harmless = ["SELECT ON `mysql_rest_service_metadata`.`table_columns_with_references`",
                            "SELECT ON `mysql_rest_service_metadata`.`schema_version`"]
                for g in harmless:
                    if g in grant:
                        return True
                return False

            grants = sorted([r[0] for r in session.run_sql(f"show grants for {user}").fetch_all() if not ignore(r[0])])
            return grants

        users = session.run_sql("select concat(user, '@', quote(host)) u from mysql.user order by u").fetch_all()
        accounts = []
        for user, in users:
            if user in orig_users:
                continue
            accounts.append({
                "account" : user,
                "grants": fetch_grants(user)
            })
        return accounts

    def fetch_schemas():
        def fetch_schema(schema):
            def fetch_tables():
                table_names = [r[0] for r in session.run_sql("select table_name from information_schema.tables where table_schema = ? and TABLE_TYPE='BASE TABLE' order by table_name", [schema]).fetch_all()]
                tables = []
                for table in table_names:
                    ddl = session.run_sql("show create table !.!", [schema, table]).fetch_one()[0]
                    tables.append(ddl)
                return tables

            def fetch_views():
                table_names = [r[0] for r in session.run_sql("select table_name from information_schema.views where table_schema = ? order by table_name", [schema]).fetch_all()]
                tables = []
                for table in table_names:
                    ddl = session.run_sql("show create view !.!", [schema, table]).fetch_one()[0]
                    tables.append(ddl)
                return tables
            
            def fetch_triggers():
                trigger_names = [r[0] for r in session.run_sql("select trigger_name from information_schema.triggers where trigger_schema = ? order by trigger_name", [schema]).fetch_all()]
                triggers = []
                for trigger in trigger_names:
                    ddl = session.run_sql("show create trigger !.!", [schema, trigger]).fetch_one()[0]
                    triggers.append(ddl)
                return triggers

            def fetch_routines():
                routine_names = session.run_sql("select routine_name, routine_type from information_schema.routines where routine_schema = ? order by routine_name", [schema]).fetch_all()
                routines = []
                for rname, rtype in routine_names:
                    ddl = session.run_sql(f"show create {rtype} !.!", [schema, rname]).fetch_one()[0]
                    routines.append(ddl)
                return routines

            def fetch_events():
                event_names = [r[0] for r in session.run_sql("select event_name from information_schema.events where event_schema = ? order by event_name", [schema]).fetch_all()]
                events = []
                for event in event_names:
                    ddl = session.run_sql("show create event !.!", [schema, event]).fetch_one()[0]
                    events.append(ddl)
                return events

            return {
                "schema": schema,
                "tables": fetch_tables(),
                "triggers": fetch_triggers(),
                "views": fetch_views(),
                "routines": fetch_routines(),
                "events": fetch_events()
            }
        schema_names = session.run_sql("show schemas").fetch_all()
        schemas = []
        for (schema,) in schema_names:
            if schema in orig_schemas:
                continue
            schemas.append(fetch_schema(schema))
        return schemas

    return {
        "accounts": fetch_accounts(),
        "schemas": fetch_schemas()
    }


def install_metadata(session, version):
    general.configure(session, version=version)
    try:
        installed = session.run_sql("select concat(major, '.', minor, '.', patch) from mysql_rest_service_metadata.msm_schema_version").fetch_one()[0]
    except:
        installed = session.run_sql("select concat(major, '.', minor, '.', patch) from mysql_rest_service_metadata.schema_version").fetch_one()[0]
    assert installed == version

def upgrade_metadata(session, version):
    general.configure(session, version=version, update_if_available=True)
    try:
        installed = session.run_sql("select concat(major, '.', minor, '.', patch) from mysql_rest_service_metadata.msm_schema_version").fetch_one()[0]
    except:
        installed = session.run_sql("select concat(major, '.', minor, '.', patch) from mysql_rest_service_metadata.schema_version").fetch_one()[0]
    assert installed == version


def check_metadata_upgrade(session, from_version, to_version):
    # Test MD upgrade from a given version of the MD schema to the current,
    # then compare with direct install of the latest

    restore_state, orig_users, orig_schemas = save_server_state(session)
    install_metadata(session, to_version)
    expected_state = snapshot_server(session, orig_users, orig_schemas)
    restore_state()

    install_metadata(session, from_version)
    upgrade_metadata(session, to_version)

    actual_state = snapshot_server(session, orig_users, orig_schemas)

    assert expected_state == actual_state, f"{from_version} -> {to_version}"

    restore_state()


def get_md_versions():
    import re
    repat = re.compile("mysql_rest_service_metadata_(.*?).sql")
    path = os.path.dirname(lib.__file__)+"/../db_schema/mysql_rest_service_metadata.msm.project/releases/versions"
    versions = []
    for f in os.listdir(path):
        m = repat.findall(f)
        if m:
            versions.append(m[0])
    return sorted(versions)


@mdupgrade
def test_metadata_upgrade(module_fixture):
    session = mysqlsh.globals.session

    versions = get_md_versions()
    latest = versions[-1]
    for initial_version in reversed(versions[:-1]):
        check_metadata_upgrade(session, initial_version, latest)
