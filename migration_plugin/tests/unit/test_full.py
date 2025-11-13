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

# full end-to-end tests where all OCI resources are created from scratch


import os
import mysqlsh  # type: ignore
import pytest
import time
from .test_plan_step import set_source, set_type, set_oci, set_checks, set_target, fix_uri
from migration_plugin import work_step
from migration_plugin.lib import migration, errors, core
from migration_plugin.lib.backend import model
from .helpers import load_sakila, resolve_vcn

# test all steps of a cold migration. requires a oci profile


def check_runnable():
    return os.environ.get('MIGRATION_TEST_SKIP_OCI_TESTS') is None and os.environ.get('MIGRATION_TEST_ROOT_COMPARTMENT_ID') is not None


pytestmark = pytest.mark.skipif(
    not check_runnable(),
    reason="Skipping because MIGRATION_TEST_SKIP_OCI_TESTS is set and/or MIGRATION_TEST_ROOT_COMPARTMENT_ID not set"
)


def _print(*args):
    print("🤖 \033[1m", *args, "\033[0m")


class Checker:
    def __init__(self, session, project):
        self.session = session
        self.project = project

        self.log_start = os.path.getsize(core.get_mysqlsh_log_path())
        self.log_text = ""

    def check_password_in_data(self):
        "Passwords shouldn't be stored in data/state files in plaintext"

        for fn in os.listdir(self.project.path):
            if fn.endswith(".json"):
                with open(os.path.join(self.project.path, fn)) as f:
                    for line in f.readlines():
                        assert "Sakila1!" not in line, fn

    def get_logs(self):
        if not self.log_text:
            with open(core.get_mysqlsh_log_path()) as f:
                self.log_text = f.read()

        return self.log_text

    def check_password_in_logs(self):
        "Passwords shouldn't be logged"
        logs = self.get_logs().split("\n")
        for line in logs:
            assert "Sakila1!" not in line, core.get_mysqlsh_log_path()

    def check(self):
        self.check_password_in_logs()
        self.check_password_in_data()


class EndTest(Exception):
    pass


def show_status(status):
    print()

    def format_seconds(s: int | None) -> str:
        if s is None:
            return "n/a"

        if s > 60:
            m = s // 60
            return f"{m} m"
        else:
            return f"{s} s"

    def format_rows(r: int | None) -> str:
        if r is None:
            return "n/a"
        return f"{r/(1024*1024):.2f}M"

    columns = [
        ("stage", 28, lambda s: model.SubStepId(s).name),
        ("status", 12, lambda s: s),
        ("current", 8, format_rows),
        ("total", 8, format_rows),
        ("eta", 8, format_seconds),
        ("errors", 8, lambda s: str(len(s))),
        ("info", 0, lambda s: str(s or "")),
    ]

    line = []
    for title, w, fmt in columns:
        line.append(title.ljust(w))
    print(" ", "".join(line))
    for stage in model.SubStepId:
        if stage == model.SubStepId.ORCHESTRATION:
            continue
        info = None
        for s in status["stages"]:
            if s["stage"] == stage.value:
                info = s
                break
        if not info:
            continue
        line = []
        for title, w, fmt in columns:
            if info["status"] == "in_progress":
                line.append("\033[94;44m"+fmt(info[title]).ljust(w)+"\033[0m")
            else:
                line.append(fmt(info[title]).ljust(w))
        emoji = "⏱️ "
        if info["status"] == "finished":
            emoji = "✅"
        elif info["status"] == "in_progress":
            emoji = "⚙️ "
        elif info["status"] == "aborted":
            emoji = "⛔️ "
        elif info["status"] == "error":
            emoji = "❌ "
        print(emoji, "".join(line))
        if info["errors"]:
            print("\terrors=", "\n".join([str(e) for e in info["errors"]]))
    print("status=", status["status"])


def do_one_migration(test_name, session, connectivity: model.CloudConnectivity,
                     reuse_compute: bool, reuse_db: bool, vcn_id: str = "",
                     reset_project: bool = False,
                     on_stage_start=None, on_stage_finished=None,
                     on_iteration=None):
    load_sakila(session)

    sentinel_gtid = f"deadbeef-cafe-0000-0000-{int(time.time()):012}"
    sentinel_row_id = None
    waiting_trxs = False

    gtid_mode = session.run_sql("select @@gtid_mode").fetch_one()[0]

    track_privileges = True

    def stage_started(stage, project: migration.ProjectContext):
        nonlocal waiting_trxs, sentinel_row_id

        def check_channel():
            nonlocal waiting_trxs, sentinel_row_id
            if stage == model.SubStepId.MONITOR_CHANNEL:
                _print("Injecting sentinel transactions at source...")
                # when replication starts, exec a few transactions at the source
                if gtid_mode != "OFF":
                    session.run_sql(f"SET gtid_next='{sentinel_gtid}:1'")
                session.run_sql(
                    "INSERT INTO sakila.city VALUES (DEFAULT, 'San Francisco', 103, DEFAULT)")
                if gtid_mode != "OFF":
                    session.run_sql(f"SET gtid_next='{sentinel_gtid}:2'")
                session.run_sql(
                    "INSERT INTO sakila.city VALUES (DEFAULT, 'Los Angeles', 103, DEFAULT)")
                sentinel_row_id = session.run_sql(
                    "select last_insert_id()").fetch_one()[0]
                waiting_trxs = True
        if type != "cold":
            check_channel()
        if on_stage_start:
            on_stage_start(stage, project)

    def stage_finished(stage, project: migration.ProjectContext):
        if on_stage_finished:
            on_stage_finished(stage, project)

    helper = None
    target_session = None

    def iterated(project: migration.ProjectContext):
        nonlocal target_session, sentinel_row_id, waiting_trxs

        def check_sentinel(project: migration.ProjectContext):
            nonlocal helper, target_session, sentinel_row_id, waiting_trxs
            if waiting_trxs:
                assert project.work_step.migrator
                if not helper:
                    # end test when our trxs arrive at target
                    if gtid_mode != "OFF":
                        gtid_executed = project.work_step.migrator._watch_channel._target_gtid_executed
                        if gtid_executed:
                            if sentinel_gtid+":1-2" in [g.strip() for g in gtid_executed.split(",")]:
                                _print(
                                    "Sentinel transactions arrived at destination...")
                                raise EndTest("Sentinel transactions arrived")
                    elif sentinel_row_id:
                        if type == "hot-direct":
                            if not target_session:
                                target_ip = project.work_step.project.resources.dbSystemIP
                                target_session = mysqlsh.globals.shell.open_session(
                                    f"admin:Sakila1!@{target_ip}")
                            last_city_id = target_session.run_sql(
                                "select max(city_id) from sakila.city").fetch_one()[0]
                            print(
                                f"max(city_id) at dest = {last_city_id} (waiting for {sentinel_row_id})")
                            if last_city_id == sentinel_row_id:
                                _print("Sentinel row arrived at destination")
                                raise EndTest("Sentinel transactions arrived")
                        else:
                            _print("Can't check for sentinel transactions")
        if type != "cold":
            check_sentinel(project)
        if on_iteration:
            on_iteration(project)

    source_uri = fix_uri(session, "admin")

    # check if an unfinished project for this test already exists
    if not reset_project:
        for proj in migration.list_projects():
            if proj["name"].startswith(test_name):
                # if so, open it
                _print(f"Found previously created project {proj["path"]}")
                project = migration.open_project(proj["id"])
                break
        else:
            reset_project = True

    if reset_project:
        # otherwise create a new one
        project = migration.new_project(name=test_name, source_url=source_uri)
        _print(f"Created new project {project.project.path}")

    checker = Checker(session, project)
    root_compartment_id = os.getenv("MIGRATION_TEST_ROOT_COMPARTMENT_ID")

    _print("Setting up migration plan")
    set_oci()
    if vcn_id:
        vcn_options = resolve_vcn(project.project.oci_config, vcn_id)
    else:
        vcn_options = {}
    set_source(source_uri)
    set_type(
        model.MigrationType.COLD if model.CloudConnectivity.NOT_SET == connectivity else model.MigrationType.HOT,
        connectivity
    )
    set_target(reuse_compartment=reuse_compute or reuse_db,
               reuse_compute=reuse_compute,
               reuse_db=reuse_db,
               compartment_id=root_compartment_id,
               **vcn_options)
    set_checks(auto_resolve=True)

    _print("Executing migration")

    started_stages = []
    finished_stages = []

    status = work_step.work_start()
    prev = None
    try:
        while True:
            status = work_step.work_status()
            if status != prev:
                prev = status
                show_status(status)
                for state in status["stages"]:
                    stage = state["stage"]
                    if state["status"] == "in_progress" and stage not in started_stages:
                        stage_started(stage, project)
                        started_stages.append(stage)
                    if state["status"] == "finished" and stage not in finished_stages:
                        stage_finished(stage, project)
                        finished_stages.append(stage)

            iterated(project)

            assert status["status"] != "error", f"migration failed with an error: {status}"
            if status["status"] in ("finished", "ready"):
                break

            time.sleep(1)
    except EndTest:
        pass
    finally:
        try:
            project.work_step.migrator.stop()  # type: ignore
        except errors.Aborted:
            pass

    _print("Migration done")

    checker.check()

    # delete the project and other data once it finishes

#


def test_hot_local_tunnel_fresh(sandbox_repl_session, reset_project):
    """
    Do a full migration test using a local tunnel and provision all resources
    from scratch.

    - If the test fails before completion, running it again will resume from
    where it left.
    - At completion, state is deleted so that running again will start from
     scratch.
    - Use --wipe-full-tests to reset state (and wipe resources)
    """

    do_one_migration("test_hot_local_tunnel_fresh",
                     sandbox_repl_session, connectivity=model.CloudConnectivity.LOCAL_SSH_TUNNEL,
                     reuse_compute=False, reuse_db=False,
                     reset_project=reset_project)


def test_hot_local_tunnel_reuse(sandbox_repl_session):
    """
    This is the same as the provision test (with same project file),
    so nothing should happen. Equivalent to a retry after restart.
    """
    do_one_migration("test_hot_local_tunnel_reuse",
                     sandbox_repl_session, connectivity=model.CloudConnectivity.LOCAL_SSH_TUNNEL,
                     reuse_compute=True, reuse_db=True)

#


def test_cold_fresh(sandbox_session, reset_project):
    """
    Cold migration provisioning all resources.
    """
    do_one_migration("test_cold_fresh",
                     sandbox_session, connectivity=model.CloudConnectivity.NOT_SET,
                     reuse_compute=False, reuse_db=False,
                     reset_project=reset_project)


def test_cold_reuse(sandbox_session):
    """
    Cold migration reusing all resources.
    Must be executed after test_hot_local_tunnel_provision()
    """
    do_one_migration("test_cold_reuse",
                     sandbox_session, connectivity=model.CloudConnectivity.NOT_SET,
                     reuse_compute=True, reuse_db=True)

#


def test_hot_tunnel_fresh(sandbox_repl_session, reset_project):
    do_one_migration("test_hot_tunnel_fresh",
                     sandbox_repl_session, connectivity=model.CloudConnectivity.SSH_TUNNEL,
                     reuse_compute=False, reuse_db=False,
                     reset_project=reset_project)


def test_hot_tunnel_reuse(sandbox_repl_session):
    do_one_migration("test_hot_tunnel_reuse",
                     sandbox_repl_session, connectivity=model.CloudConnectivity.SSH_TUNNEL,
                     reuse_compute=True, reuse_db=True)

#


def test_hot_direct_fresh(site_to_site_vcn, sandbox_repl_session, reset_project):
    """
    Direct connectivity migration test, via site-to-site vpn.
    """
    do_one_migration("test_hot_direct_fresh",
                     sandbox_repl_session, connectivity=model.CloudConnectivity.SITE_TO_SITE,
                     reuse_compute=False, reuse_db=False,
                     vcn_id=site_to_site_vcn, reset_project=reset_project)


def test_hot_direct_reuse(site_to_site_vcn, sandbox_repl_session):
    do_one_migration("test_hot_direct_reuse",
                     sandbox_repl_session, connectivity=model.CloudConnectivity.SITE_TO_SITE,
                     reuse_compute=True, reuse_db=True,
                     vcn_id=site_to_site_vcn)

#


def test_hot_direct_oci_fresh(site_to_site_vcn, reset_project):
    """
    Direct connectivity migration test, where source DB is in a compute in OCI.
    """
    uri = os.getenv("MIGRATION_TEST_OCI_MYSQLD")
    assert uri
    session = mysqlsh.globals.shell.open_session(uri)

    do_one_migration("test_hot_direct_oci_fresh",
                     session, connectivity=model.CloudConnectivity.SITE_TO_SITE,
                     reuse_compute=False, reuse_db=False,
                     reset_project=reset_project,
                     vcn_id=site_to_site_vcn)


def test_hot_direct_oci_reuse(site_to_site_vcn):
    uri = os.getenv("MIGRATION_TEST_OCI_MYSQLD")
    assert uri
    session = mysqlsh.globals.shell.open_session(uri)

    do_one_migration("test_hot_direct_oci_reuse",
                     session, connectivity=model.CloudConnectivity.SITE_TO_SITE,
                     reuse_compute=True, reuse_db=True,
                     vcn_id=site_to_site_vcn)
