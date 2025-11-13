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


import json
import os
import shutil
import pytest
import pathlib
from migration_plugin import lib
from migration_plugin import plan_step
from migration_plugin.lib.backend import model
from migration_plugin.lib.project import Project
from migration_plugin.lib import migration, logging, errors, oci_utils
import mysqlsh  # type: ignore


def check_runnable():
    return os.environ.get('MIGRATION_TEST_SKIP_OCI_TESTS') is None and os.environ.get('MIGRATION_TEST_ROOT_COMPARTMENT_ID') is not None


pytestmark = pytest.mark.skipif(
    not check_runnable(),
    reason="Skipping because MIGRATION_TEST_SKIP_OCI_TESTS is set and/or MIGRATION_TEST_ROOT_COMPARTMENT_ID not set"
)


@pytest.fixture
def plan(temp_dir):
    context = migration.new_project(
        name="testproj", source_url="root@localhost")

    yield context.project

    shutil.rmtree(context.project.path)


class DROP:
    pass


def normeq(a, e):
    """allows comparing 2 dicts except for fields marked with ANY in the 2nd one"""
    assert isinstance(a, dict)  # a(ctual)
    assert isinstance(e, dict)  # e(xpected)

    def normalize(a, e):
        for k, v in list(e.items()):
            if v is DROP and k in a:
                a[k] = v
            else:
                if isinstance(v, dict) and isinstance(a[k], dict):
                    normalize(a[k], v)
    normalize(a, e)
    assert a == e
    return True


def j(any):
    if isinstance(any, list):
        return [j(i) for i in any]
    elif isinstance(any, dict):
        return any
    else:
        return any._json(noclass=True)


def fix_uri(session, user) -> str:
    parts = mysqlsh.globals.shell.parse_uri(session.uri)
    return f"{user}@{parts['host']}:{parts['port']}"


def set_source(uri: str, password="Sakila1!"):
    logging.info("🪵 set_source")
    info = plan_step.plan_update(
        [{"id": 1010, "values": {"sourceUri": uri, "password": password}}]
    )
    assert info[0]["status"] == "READY_TO_COMMIT"
    info = plan_step.plan_commit(1010)
    assert info["status"] == "FINISHED"


def set_type(type: model.MigrationType, connectivity: model.CloudConnectivity):
    logging.info("🪵 set_type")
    info = plan_step.plan_update(
        [{"id": 1020, "values": {"type": type, "connectivity": connectivity}}])
    assert info[0]["status"] == "READY_TO_COMMIT"
    info = plan_step.plan_commit(1020)
    assert info["status"] == "FINISHED"


def set_checks(auto_resolve: bool):
    logging.info("🪵 set_checks")
    info = plan_step.plan_update_sub_step(1030, {"values": {}})
    assert info

    issue_resolution = {}

    if auto_resolve:
        for issue in info["data"]["issues"]:
            issue_resolution[issue["checkId"]] = issue["choices"][0]

    info = plan_step.plan_update(
        [{"id": 1030, "values": {"issueResolution": issue_resolution}}])
    assert info[0]["status"] == "READY_TO_COMMIT"
    info = plan_step.plan_commit(1030)
    assert info["status"] == "FINISHED", info


def set_oci():
    logging.info("🪵 set_oci")
    info = plan_step.plan_update([{"id": 1040}])
    assert info[0]["status"] == "READY_TO_COMMIT", info
    info = plan_step.plan_commit(1040)
    assert info["status"] == "FINISHED"


def set_target(values: dict = {},
               reuse_compartment: bool = False,
               reuse_db: bool = False,
               reuse_compute: bool = False,
               vcn_id=None,
               compartment_id=None,
               public_subnet_id=None,
               private_subnet_id=None):
    logging.info("🪵 set_target")
    if not values:
        values = {}
    root_id = compartment_id or os.getenv("MIGRATION_TEST_ROOT_COMPARTMENT_ID")
    assert root_id, "MIGRATION_TEST_ROOT_COMPARTMENT_ID environment variable must be set"

    # either all 3 options are set or none
    assert (public_subnet_id is not None) == (
        private_subnet_id is not None) == (vcn_id is not None)

    # if reusing anything, then we must also reuse compartment
    assert reuse_compartment or not reuse_db
    assert reuse_compartment or not reuse_compute

    oci_config = oci_utils.get_config()

    if reuse_compartment:
        mysql_comp = oci_utils.Compartment.find_by_name(
            oci_config, parent_compartment_id=root_id, name="MySQL")[0]
    else:
        mysql_comp = None

    if reuse_compute:
        assert mysql_comp

        instances = mysql_comp.find_instance_by_name("test-jump-host")
        assert instances

        instance = instances[0]

        compute_options = {
            "computeId": instance.id,
            "computeName": ""
        }
    else:
        compute_options = {
            "computeName": "test-jump-host"
        }

    if reuse_db:
        assert mysql_comp

        instances = mysql_comp.find_db_system_by_name("test-mysql")
        assert instances

        instance = instances[0]

        db_options = {
            "dbSystemId": instance.id,
            "name": ""
        }
    else:
        db_options = {
            "name": "test-mysql"
        }

    if vcn_id:
        net_options = {
            "vcnId": vcn_id,
            "publicSubnet": {
                "id": public_subnet_id
            },
            "privateSubnet": {
                "id": private_subnet_id
            }
        }
    else:
        net_options = {
            "networkParentCompartmentId": root_id,
        }

    values = {
        "hosting": {
            "parentCompartmentId": root_id,
        } | compute_options | net_options,
        "database": {
        } | db_options
    } | values
    info = plan_step.plan_update([{"id": 1050, "values": values}])

    # if the default compute name already exists, it will be resolved to a computeId
    # and cleared
    if reuse_compute:
        assert not info[0]["values"]["hosting"]["computeName"]
        assert info[0]["values"]["hosting"]["computeId"]
    else:
        assert info[0]["values"]["hosting"]["computeName"]
        assert not info[0]["values"]["hosting"]["computeId"]

    assert info[0]["status"] == "READY_TO_COMMIT"
    info = plan_step.plan_commit(1050)
    assert info["status"] == "FINISHED"

###


def test_update_all():
    migration.new_project(name="test", source_url="root@localhost")
    steps = plan_step.plan_update([])
    for s in steps:
        if s["id"] == model.SubStepId.PREVIEW_PLAN:
            assert s["status"] == "FINISHED"
        else:
            assert s["status"] in (
                "IN_PROGRESS", "NOT_STARTED", "READY_TO_COMMIT"), s


def check_still_committed(id: int):
    steps = plan_step.plan_update([])
    for s in steps:
        if s["id"] == id:
            assert s["status"] == "FINISHED", s
            break


# TODO reload project and see if it's all still there
def reopen_project():
    pass


def test_update_oci_profile(mocker, temp_dir):
    """OCI config file exists -> pick profile"""
    my_id = 1040

    real_config_file = lib.core.default_oci_config_file()
    assert real_config_file, f"This test expects OCI config to be at {real_config_file}"

    oci_conf_path = pathlib.Path(temp_dir) / "oci"
    oci_conf_path.mkdir()
    oci_conf_path = oci_conf_path / "config"

    mocker.patch("migration_plugin.lib.core.default_oci_config_file",
                 return_value=str(oci_conf_path))

    # config file does not exist, so profile picker should be disabled
    assert not oci_conf_path.exists()
    migration.new_project(name="testproj", source_url="root@localhost")

    with open(oci_conf_path, "w") as f:
        f.close()
    # config file is empty, so profile picker should be disabled
    migration.new_project(name="testproj", source_url="root@localhost")

    # copy the real config file and add an invalid profile
    shutil.copy(real_config_file, oci_conf_path)

    with open(oci_conf_path, "a") as f:
        f.write("""
[badprofile]
user = ocid1.user.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
fingerprint = e8:78:08:cf:92:bd:d5:50:11:b3:cd:e5:eb:b8:46:21
key_file = /dev/null
tenancy = ocid1.tenancy.oc1..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
region = us-ashburn-9
""")
    with open(oci_conf_path, "r") as f:
        num_lines = len(f.readlines())

    migration.new_project(name="testproj", source_url="root@localhost")

    # invalid profile
    update = plan_step.plan_update(
        [{"id": my_id, "values": {"profile": "badprofile"}}])

    assert j(update) == [{
        "data": None,
        "errors": [
            {
                "info": {},
                "level": "ERROR",
                "message": f"Config file {oci_conf_path} "
                f"is invalid: the key_file's value '/dev/null' at line {num_lines-2} must "
                "be a valid file path. For more info about config file and how "
                "to get required information, see "
                "https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdkconfig.htm",
                "title": "",
                "type": "InvalidKeyFilePath",
            },
        ],
        "id": my_id,
        "status": "ERROR",
        "values": {
            "configFile": str(oci_conf_path),
            'profile': 'badprofile'}}
    ]

    # commit should fail if we there's no valid profile
    with pytest.raises(errors.BadRequest):
        plan_step.plan_commit(my_id)

    # DEFAULT profile is probably ok
    update = plan_step.plan_update(
        [{"id": my_id, "values": {"profile": "DEFAULT"}}])
    assert j(update) == [
        {
            'data': None,
            'errors': [],
            'id': 1040,
            'status': 'READY_TO_COMMIT',
            'values': {
                'configFile': str(oci_conf_path),
                'profile': 'DEFAULT'
            },
        },
    ]

    info = plan_step.plan_commit(my_id)
    assert j(info) == {
        "data": None, "errors": [], "id": my_id, "status": "FINISHED",
        "values": {
            "configFile": str(oci_conf_path),
            "profile": "DEFAULT"
        }
    }

    check_still_committed(my_id)


def test_update_oci_profile_no_config(mocker, temp_dir):
    """No OCI config file yet -> setup one"""
    my_id = 1040

    oci_conf_path = pathlib.Path(temp_dir) / "oci"
    oci_conf_path.mkdir(exist_ok=True)
    oci_conf_path = oci_conf_path / "config"
    oci_conf_path.unlink(missing_ok=True)

    mocker.patch("migration_plugin.lib.core.default_oci_config_file",
                 return_value=str(oci_conf_path))

    # config file does not exist, so config setup should be enabled
    migration.new_project(name="testproj", source_url="root@localhost")

    with open(oci_conf_path, "w") as f:
        f.close()
    # config file is empty, so config setup should be enabled
    migration.new_project(name="testproj", source_url="root@localhost")

    # commit should fail if we there's no valid profile
    with pytest.raises(errors.BadRequest):
        plan_step.plan_commit(my_id)


def test_update_oci_authenticate(plan, interactive):
    my_id = 1040

    # tests require interactive to sign-in to OCI in a browser
    if not interactive:
        return

    update = plan_step.plan_update(
        [{"id": my_id, "values": {"region": "eu-frankfurt-1"}}])
    assert j(update) == [{
        "data": {}, "errors": [], "id": my_id, "status": "READY_TO_COMMIT",
        "values": {"region": "eu-frankfurt-1"}
    }]
    plan_step.oci_sign_in()

    info = plan_step.plan_commit(my_id)
    assert j(info) == {
        "data": {}, "errors": [], "id": my_id, "status": "FINISHED",
        "values": {"region": "eu-frankfurt-1"}
    }

    # has profile (should re-authenticate on the same region)
    plan.reset_plan(delete_oci_profile=False)

    update = plan_step.plan_update([])
    assert update[3] == {"id": my_id, "values": {"region": "us-ashburn-1"}}

    update = plan_step.plan_update([{"id": my_id}])
    assert j(update) == [{
        "data": {}, "errors": [], "id": my_id, "status": "FINISHED",
        "values": {"region": "eu-frankfurt-1"}
    }]

    # reauth previously created session
    # TODO

###


def test_update_source(plan, sandbox_session):
    my_id = 1010
    good_uri = fix_uri(sandbox_session, "admin")
    baduser_uri = "bogus@" + (good_uri.split("@")[-1])
    bad_uri = good_uri.split(":")[0]+":1"

    update = plan_step.plan_update([{"id": my_id}])
    assert j(update) == [
        {
            "data": {"serverInfo": None},
            "errors": [],
            "id": my_id,
            "status": "IN_PROGRESS",
            "values": {"password": "", "sourceUri": "root@localhost"},
        }
    ]

    update = plan_step.plan_update([{"id": my_id, "values": {}}])
    assert j(update) == [
        {
            'data': {'serverInfo': None},
            "errors": [
                {
                    "info": {
                        "input": "sourceUri",
                    },
                    "level": "ERROR",
                    "message": "Source database URI is required",
                    "title": "",
                    "type": "BadUserInput",
                },
            ],
            "id": my_id,
            "status": "ERROR",
            "values": {"password": "", "sourceUri": "root@localhost"},
        }
    ]

    def try_uri(uri, password=""):
        update = plan_step.plan_update(
            [{"id": my_id, "values": {"sourceUri": uri, "password": password}}]
        )
        assert j(update) == [
            {
                'data': {'serverInfo': None},
                "errors": [],
                "id": my_id,
                "status": "READY_TO_COMMIT",
                "values": {"password": "", "sourceUri": uri},
            }
        ], uri
        return plan_step.plan_commit(my_id)

    info = try_uri(bad_uri)
    assert j(info) == {
        'data': {'serverInfo': None},
        "errors": [
            {
                "level": "ERROR",
                "message": f"Can't connect to MySQL server on '{bad_uri.split("@")[-1]}' (61) (2003)",
                "title": "Could not connect to source MySQL server",
                "info": None,
                "type": None
            },
        ],
        "id": my_id,
        "status": "ERROR",
        "values": {"password": "", "sourceUri": bad_uri},
    }

    def normalize_access_denied(info, user):
        assert info["errors"][0]["message"].startswith(
            "Access denied for user")
        info["errors"][0][
            "message"] = f"Access denied for user '{user}'@'localhost' (using password: NO)"

    info = try_uri(baduser_uri)
    normalize_access_denied(info, "bogus")
    assert j(info) == {
        'data': {'serverInfo': None},
        "errors": [
            {
                "info": {
                    "input": "password",
                },
                "level": "ERROR",
                "message": "Access denied for user 'bogus'@'localhost' (using password: NO)",
                "title": "Please enter the password for user 'bogus' at the source database.",
                "type": "BadUserInput",
            }
        ],
        "id": my_id,
        "status": "ERROR",
        "values": {"password": "", "sourceUri": baduser_uri},
    }

    info = try_uri(good_uri)
    normalize_access_denied(info, "admin")
    assert j(info) == {
        'data': {'serverInfo': None},
        "errors": [
            {
                "info": {
                    "input": "password",
                },
                "level": "ERROR",
                "message": "Access denied for user 'admin'@'localhost' (using password: NO)",
                "title": "Please enter the password for user 'admin' at the source database.",
                "type": "BadUserInput",
            },
        ],
        "id": my_id,
        "status": "ERROR",
        "values": {"password": "", "sourceUri": good_uri},
    }, good_uri

    info = try_uri(good_uri, "Sakila1!")
    assert set(info["data"]["serverInfo"].keys()) == set(
        ["dataSize", "hostname", "license", 'replicationStatus', 'schemaCount',
            "serverType", "serverUuid", "gtidMode", "version", "versionComment",
            "hasMRS", "numAccountsOnMysqlNativePassword", "numAccountsOnOldPassword"]
    ), info["data"]["serverInfo"]

    info["data"]["serverInfo"] = {}

    assert j(info) == {
        "data": {
            "serverInfo": {},
        },
        "errors": [],
        "id": my_id,
        "status": "FINISHED",
        "values": {"password": "", "sourceUri": good_uri},
    }

    check_still_committed(my_id)

###


def test_update_type_cold(plan, sandbox_session):
    my_id = 1020
    source_uri = fix_uri(sandbox_session, "admin")

    set_source(source_uri)

    # can't do hot
    update = plan_step.plan_update(
        [{"id": my_id, "values": {"type": model.MigrationType.HOT}}])
    assert j(update) == [
        {
            "data": {
                'allowedConnectivity': [],
                "allowedTypes": ["cold"]
            },
            "errors": [
                {
                    'info': None,
                    'type': None,
                    "level": "ERROR",
                    "message": 'Binary logging must be enabled in order to setup\ninbound replication between your source MySQL instance and the new HeatWave\ninstance.\n\nYou may:\n<li> enable Row Based Replication at the source MySQL instance and try again\n<li> switch to a Cold Migration, which will require some downtime when switching applications to the new MySQL server\n', 'title': 'Hot Migration not possible because Binary logging (<code>log_bin</code>) is disabled',
                    "title": "Hot Migration not possible because Binary logging (<code>log_bin</code>) is disabled"
                }
            ],
            "id": my_id,
            "status": "ERROR",
            "values": {
                "type": model.MigrationType.HOT.value,
                'connectivity': '',
            }
        }
    ]

    with pytest.raises(errors.BadRequest):
        plan_step.plan_commit(my_id)

    # cold is ok
    update = plan_step.plan_update([{"id": my_id, "values": {"type": "cold"}}])
    assert j(update) == [
        {
            'data': {
                'allowedTypes': ['cold'],
                'allowedConnectivity': [],
            },
            "errors": [],
            "id": my_id,
            "status": "READY_TO_COMMIT",
            "values": {"type": "cold",
                       'connectivity': ''},
        }
    ]
    info = plan_step.plan_commit(my_id)
    assert j(info) == {
        "data": {
            "allowedTypes": ["cold"],
            'allowedConnectivity': [],
        },
        "errors": [],
        "id": 1020,
        "status": "FINISHED",
        "values": {
            "type": "cold",
            'connectivity': '',
        }
    }
    check_still_committed(my_id)

    # changing it back to hot should clear the finished flag
    update = plan_step.plan_update(
        [{"id": my_id, "values": {"type": model.MigrationType.HOT}}])
    assert j(update) == [
        {
            "data": {
                "allowedTypes": ["cold"],
                'allowedConnectivity': [],
            },
            "errors": [
                {
                    "level": "ERROR",
                    "message": "Binary logging must be enabled in order to setup\ninbound replication between your source MySQL instance and the new HeatWave\ninstance.\n\nYou may:\n<li> enable Row Based Replication at the source MySQL instance and try again\n<li> switch to a Cold Migration, which will require some downtime when switching applications to the new MySQL server\n",
                    "title": "Hot Migration not possible because Binary logging (<code>log_bin</code>) is disabled",
                    'info': None,
                    'type': None
                }
            ],
            "id": my_id,
            "status": "ERROR",
            "values": {'connectivity': '', 'type': 'hot'},
        }
    ]


def test_update_type_hot(plan, sandbox_repl_session):
    my_id = 1020
    source_uri = fix_uri(sandbox_repl_session, "admin")

    set_source(source_uri)

    update = plan_step.plan_update([{"id": my_id, "values": {"type": "hot"}}])
    assert j(update) == [
        {
            "data": {'allowedConnectivity': ['', 'site-to-site', 'ssh-tunnel', 'local-ssh-tunnel'],
                     'allowedTypes': ['cold', 'hot']},
            "errors": [],
            "id": my_id,
            "status": "IN_PROGRESS",
            "values": {"type": "hot", "connectivity": ""},
        }
    ]

    update = plan_step.plan_update(
        [{"id": my_id, "values": {"type": "hot", "connectivity": "ssh-tunnel"}}])
    assert j(update) == [
        {
            "data": {'allowedConnectivity': ['', 'site-to-site', 'ssh-tunnel', 'local-ssh-tunnel'],
                     'allowedTypes': ['cold', 'hot']},
            "errors": [],
            "id": my_id,
            "status": "READY_TO_COMMIT",
            "values": {"type": "hot", "connectivity": "ssh-tunnel"},
        }
    ]

    info = plan_step.plan_commit(my_id)
    assert j(info) == {
        "data": {'allowedConnectivity': ['', 'site-to-site', 'ssh-tunnel', 'local-ssh-tunnel'],
                 'allowedTypes': ['cold', 'hot']},
        "errors": [],
        "id": my_id,
        "status": "FINISHED",
        "values": {"type": "hot", "connectivity": "ssh-tunnel"},
    }


def test_update_type_hot_checks(plan, sandbox_session):
    my_id = 1020
    source_uri = fix_uri(sandbox_session, "admin")

    set_source(source_uri)

    # server doesn't support replication
    update = plan_step.plan_update([{"id": my_id, "values": {"type": "hot"}}])
    assert j(update) == [
        {
            "data": {'allowedConnectivity': [],
                     'allowedTypes': ['cold']},
            'errors': [{'info': {'input': 'type'},
                        'level': 'ERROR',
                        'message': 'Binary logging must be enabled in order to setup\ninbound replication between your source MySQL instance and the new HeatWave\ninstance.\n\nYou may:\n<li> enable Row Based Replication at the source MySQL instance and try again\n<li> switch to a Cold Migration, which will require some downtime when switching applications to the new MySQL server\n',
                        'title': 'Hot Migration not possible because Binary logging (<code>log_bin</code>) is disabled',
                        'info': None,
                        'type': None}],
            "id": my_id,
            "status": "ERROR",
            "values": {"type": "hot", "connectivity": ""},
        }
    ]
    with pytest.raises(errors.BadRequest):
        plan_step.plan_commit(my_id)


def test_update_type_hot_checks_pwd(plan, sandbox_repl_session):
    my_id = 1020
    source_uri = fix_uri(sandbox_repl_session, "root")

    set_source(source_uri, password="")

    # server doesn't support replication
    update = plan_step.plan_update([{"id": my_id, "values": {"type": "hot"}}])
    assert j(update) == [
        {
            "data": {'allowedConnectivity': ['', 'site-to-site', 'ssh-tunnel', 'local-ssh-tunnel'],
                     'allowedTypes': ['cold', 'hot']},
            'errors': [{'info': {'input': 'type'},
                        'level': 'ERROR',
                        'message': f'Hot migration requires password for source database {source_uri} to be between 8 and 32 characters.\n'
                        'Please change the password for that account or start over using an account with a suitable password.',
                        'title': '',
                        'type': 'InvalidParameter'}],
            "id": my_id,
            "status": "ERROR",
            "values": {"type": "hot", "connectivity": ""},
        }
    ]
    with pytest.raises(errors.BadRequest):
        plan_step.plan_commit(my_id)


def test_update_type_hot_checks_localhost(plan, sandbox_repl_session):
    my_id = 1020

    source_uri = "admin@localhost:" +\
        sandbox_repl_session.uri.split(":")[-1]
    set_source(source_uri)

    # server doesn't support replication
    update = plan_step.plan_update(
        [{"id": my_id, "values": {"type": "hot", "connectivity": "site-to-site"}}])
    assert j(update) == [
        {
            "data": {'allowedConnectivity': ['', 'site-to-site', 'ssh-tunnel', 'local-ssh-tunnel'],
                     'allowedTypes': ['cold', 'hot']},
            'errors': [{'info': {'input': 'type'},
                        'level': 'ERROR',
                        'message': 'The address localhost cannot\n'
                        '                                         be used to '
                        'perform a hot migration using Site-to-Site VPN. '
                        'Please start over\n'
                        '                                        using an '
                        'address that can be reached through the VPN.',
                        'title': '',
                        'type': 'InvalidParameter'}],
            "id": my_id,
            "status": "ERROR",
            "values": {"type": "hot", "connectivity": "site-to-site"},
        }
    ]
    with pytest.raises(errors.BadRequest):
        plan_step.plan_commit(my_id)


###


@pytest.mark.skip(reason="TO BE FIXED")
def test_update_checks(plan, sandbox_session):
    # TODO needs shell with JSON check output
    my_id = 1030
    source_uri = fix_uri(sandbox_session, "admin")

    set_source(source_uri)
    set_type(model.MigrationType.COLD, model.CloudConnectivity.NOT_SET)

    # start, which will trigger checks to run
    update = plan_step.plan_update([{"id": my_id}])
    assert j(update) == [
        {
            "data": {
                "issues": [
                    {
                        "check_id": "user/no_password",
                        "choices": [
                            "lock_invalid_accounts",
                            "skip_invalid_accounts",
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "The following user accounts have no password and will be locked in the target MySQL.\n\n        The listed accounts have a blank password, which is not allowed in the\n        MySQL HeatWave Service. They will still be migrated, but they will\n        be created LOCKED and their password must be changed before they can\n        connect to MySQL.\n\n        You may also set a password before migrating or exclude the user from\n        being migrated.\n        ",
                        "level": "ERROR",
                        "objects": [
                            "user:'root'@'%'",
                            "user:'root'@'localhost'"
                        ],
                        "result": "<li>User 'root'@'%' does not have a password set (fix this with either 'lock_invalid_accounts' or 'skip_invalid_accounts' compatibility option)\n<li>User 'root'@'localhost' does not have a password set (fix this with either 'lock_invalid_accounts' or 'skip_invalid_accounts' compatibility option)",
                        "title": "User Password Requirements"
                    },
                    {
                        "check_id": "user/restricted_grants",
                        "choices": [
                            "strip_restricted_grants",
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "The following user accounts have GRANTs that are restricted and will be updated.\n\n        MySQL HeatWave Service restricts certain privileges from regular user accounts\n        so they will be removed from the grant list of accounts when created at\n        the target database. All other things will remain the same, including\n        password and remaining grants.\n        ",
                        "level": "ERROR",
                        "objects": [
                            "user:'admin'@'%'"
                        ],
                        "result": "<li>User 'admin'@'%' is granted restricted privileges: AUDIT_ABORT_EXEMPT, AUTHENTICATION_POLICY_ADMIN, BINLOG_ADMIN, BINLOG_ENCRYPTION_ADMIN, CLONE_ADMIN, CREATE TABLESPACE, ENCRYPTION_KEY_ADMIN, FILE, FIREWALL_EXEMPT, GROUP_REPLICATION_ADMIN, GROUP_REPLICATION_STREAM, INNODB_REDO_LOG_ARCHIVE, INNODB_REDO_LOG_ENABLE, PASSWORDLESS_USER_ADMIN, PERSIST_RO_VARIABLES_ADMIN, RELOAD, REPLICATION_SLAVE_ADMIN, RESOURCE_GROUP_ADMIN, RESOURCE_GROUP_USER, SENSITIVE_VARIABLES_OBSERVER, SERVICE_CONNECTION_ADMIN, SESSION_VARIABLES_ADMIN, SET_USER_ID, SHUTDOWN, SUPER, SYSTEM_USER, SYSTEM_VARIABLES_ADMIN, TABLE_ENCRYPTION_ADMIN, TELEMETRY_LOG_ADMIN (fix this with 'strip_restricted_grants' compatibility option)",
                        "title": "Restricted Grants"
                    },
                    {
                        "check_id": "invalidPrivileges",
                        "choices": [
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "If the privileges are not being used, no action is required, otherwise, ensure they stop being used before the upgrade as they will be lost.",
                        "level": "NOTICE",
                        "objects": [],
                        "result": "The user 'admin'@'%' has the following privileges that will be removed as part of the upgrade process: SET_USER_ID",
                        "title": "Checks for user privileges that will be removed"
                    },
                    {
                        "check_id": "invalidPrivileges",
                        "choices": [
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "If the privileges are not being used, no action is required, otherwise, ensure they stop being used before the upgrade as they will be lost.",
                        "level": "NOTICE",
                        "objects": [],
                        "result": "The user 'root'@'%' has the following privileges that will be removed as part of the upgrade process: SET_USER_ID",
                        "title": "Checks for user privileges that will be removed"
                    },
                    {
                        "check_id": "invalidPrivileges",
                        "choices": [
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "If the privileges are not being used, no action is required, otherwise, ensure they stop being used before the upgrade as they will be lost.",
                        "level": "NOTICE",
                        "objects": [],
                        "result": "The user 'root'@'localhost' has the following privileges that will be removed as part of the upgrade process: SET_USER_ID",
                        "title": "Checks for user privileges that will be removed"
                    }
                ]
            },
            "errors": [],
            "id": 1030,
            "status": "IN_PROGRESS",
            "values": {
                "issueResolution": {},
            }
        }
    ]

    with pytest.raises(errors.BadRequest) as e:
        plan_step.plan_commit(my_id)
    assert "not ready to be committed" in str(e)

    update = plan_step.plan_update(
        [
            {
                "id": my_id,
                "values": {
                    "issueResolution": {
                        "user/restricted_grants": model.CompatibilityFlags.strip_restricted_grants,
                        "user/no_password": model.CompatibilityFlags.lock_invalid_accounts,
                    }
                },
            }
        ]
    )
    # updating with flags may or may not re-run the checks, unsure about that
    # TODO de-duplicate upgrade check issues
    print(json.dumps(j(update)))
    assert j(update) == [
        {
            "data": {
                "issues": [
                    {
                        "check_id": "user/no_password",
                        "choices": [
                            "lock_invalid_accounts",
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "The following user accounts have no password and will be locked in the target MySQL.\n\n        The listed accounts have a blank password, which is not allowed in the\n        MySQL HeatWave Service. They will still be migrated, but they will\n        be created LOCKED and their password must be changed before they can\n        connect to MySQL.\n\n        You may also set a password before migrating or exclude the user from\n        being migrated.\n        ",
                        "level": "NOTICE",
                        "objects": [
                            "user:'root'@'%'",
                            "user:'root'@'localhost'"
                        ],
                        "result": "<li>User 'root'@'%' does not have a password set, this account has been migrated\n<li>User 'root'@'localhost' does not have a password set, this account has been migrated",
                        "title": "User Password Requirements"
                    },
                    {
                        "check_id": "user/restricted_grants",
                        "choices": [
                            "strip_restricted_grants",
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "The following user accounts have GRANTs that are restricted and will be updated.\n\n        MySQL HeatWave Service restricts certain privileges from regular user accounts\n        so they will be removed from the grant list of accounts when created at\n        the target database. All other things will remain the same, including\n        password and remaining grants.\n        ",
                        "level": "NOTICE",
                        "objects": [
                            "user:'admin'@'%'",
                            "user:'root'@'%'",
                            "user:'root'@'localhost'"
                        ],
                        "result": "<li>User 'admin'@'%' had restricted privilege SET_USER_ID replaced with SET_ANY_DEFINER\n<li>User 'admin'@'%' had restricted privileges (AUDIT_ABORT_EXEMPT, AUTHENTICATION_POLICY_ADMIN, BINLOG_ADMIN, BINLOG_ENCRYPTION_ADMIN, CLONE_ADMIN, CREATE TABLESPACE, ENCRYPTION_KEY_ADMIN, FILE, FIREWALL_EXEMPT, GROUP_REPLICATION_ADMIN, GROUP_REPLICATION_STREAM, INNODB_REDO_LOG_ARCHIVE, INNODB_REDO_LOG_ENABLE, PASSWORDLESS_USER_ADMIN, PERSIST_RO_VARIABLES_ADMIN, RELOAD, REPLICATION_SLAVE_ADMIN, RESOURCE_GROUP_ADMIN, RESOURCE_GROUP_USER, SENSITIVE_VARIABLES_OBSERVER, SERVICE_CONNECTION_ADMIN, SESSION_VARIABLES_ADMIN, SHUTDOWN, SUPER, SYSTEM_USER, SYSTEM_VARIABLES_ADMIN, TABLE_ENCRYPTION_ADMIN, TELEMETRY_LOG_ADMIN) removed\n<li>User 'root'@'%' had restricted privilege SET_USER_ID replaced with SET_ANY_DEFINER\n<li>User 'root'@'%' had restricted privileges (AUDIT_ABORT_EXEMPT, AUTHENTICATION_POLICY_ADMIN, BINLOG_ADMIN, BINLOG_ENCRYPTION_ADMIN, CLONE_ADMIN, CREATE TABLESPACE, ENCRYPTION_KEY_ADMIN, FILE, FIREWALL_EXEMPT, GROUP_REPLICATION_ADMIN, GROUP_REPLICATION_STREAM, INNODB_REDO_LOG_ARCHIVE, INNODB_REDO_LOG_ENABLE, PASSWORDLESS_USER_ADMIN, PERSIST_RO_VARIABLES_ADMIN, RELOAD, REPLICATION_SLAVE_ADMIN, RESOURCE_GROUP_ADMIN, RESOURCE_GROUP_USER, SENSITIVE_VARIABLES_OBSERVER, SERVICE_CONNECTION_ADMIN, SESSION_VARIABLES_ADMIN, SHUTDOWN, SUPER, SYSTEM_USER, SYSTEM_VARIABLES_ADMIN, TABLE_ENCRYPTION_ADMIN, TELEMETRY_LOG_ADMIN) removed\n<li>User 'root'@'localhost' had restricted privilege SET_USER_ID replaced with SET_ANY_DEFINER\n<li>User 'root'@'localhost' had restricted privileges (AUDIT_ABORT_EXEMPT, AUTHENTICATION_POLICY_ADMIN, BINLOG_ADMIN, BINLOG_ENCRYPTION_ADMIN, CLONE_ADMIN, CREATE TABLESPACE, ENCRYPTION_KEY_ADMIN, FILE, FIREWALL_EXEMPT, GROUP_REPLICATION_ADMIN, GROUP_REPLICATION_STREAM, INNODB_REDO_LOG_ARCHIVE, INNODB_REDO_LOG_ENABLE, PASSWORDLESS_USER_ADMIN, PERSIST_RO_VARIABLES_ADMIN, RELOAD, REPLICATION_SLAVE_ADMIN, RESOURCE_GROUP_ADMIN, RESOURCE_GROUP_USER, SENSITIVE_VARIABLES_OBSERVER, SERVICE_CONNECTION_ADMIN, SESSION_VARIABLES_ADMIN, SHUTDOWN, SUPER, SYSTEM_USER, SYSTEM_VARIABLES_ADMIN, TABLE_ENCRYPTION_ADMIN, TELEMETRY_LOG_ADMIN) removed",
                        "title": "Restricted Grants"
                    },
                    {
                        "check_id": "invalidPrivileges",
                        "choices": [
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "If the privileges are not being used, no action is required, otherwise, ensure they stop being used before the upgrade as they will be lost.",
                        "level": "NOTICE",
                        "objects": [],
                        "result": "The user 'admin'@'%' has the following privileges that will be removed as part of the upgrade process: SET_USER_ID",
                        "title": "Checks for user privileges that will be removed"
                    },
                    {
                        "check_id": "invalidPrivileges",
                        "choices": [
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "If the privileges are not being used, no action is required, otherwise, ensure they stop being used before the upgrade as they will be lost.",
                        "level": "NOTICE",
                        "objects": [],
                        "result": "The user 'root'@'%' has the following privileges that will be removed as part of the upgrade process: SET_USER_ID",
                        "title": "Checks for user privileges that will be removed"
                    },
                    {
                        "check_id": "invalidPrivileges",
                        "choices": [
                            "EXCLUDE_OBJECT"
                        ],
                        "description": "If the privileges are not being used, no action is required, otherwise, ensure they stop being used before the upgrade as they will be lost.",
                        "level": "NOTICE",
                        "objects": [],
                        "result": "The user 'root'@'localhost' has the following privileges that will be removed as part of the upgrade process: SET_USER_ID",
                        "title": "Checks for user privileges that will be removed"
                    }
                ]
            },
            "errors": [],
            "id": 1030,
            "status": "READY_TO_COMMIT",
            "values": {
                "issueResolution": {
                    "user/restricted_grants": model.CompatibilityFlags.strip_restricted_grants,
                    "user/no_password": model.CompatibilityFlags.lock_invalid_accounts,
                },
            }
        }
    ]
    # commit should re-run the checks
    info = plan_step.plan_commit(my_id)
    assert info["status"] == "FINISHED"


def strip_sysvars(j: dict) -> dict:
    # j["values"].pop("configuration")
    return j


def test_update_options(sandbox_session):
    my_id = 1050
    source_uri = fix_uri(sandbox_session, "admin")

    lib.migration.new_project(name="testproj", source_url=source_uri)

    set_oci()
    set_source(source_uri)
    set_type(model.MigrationType.COLD, model.CloudConnectivity.NOT_SET)

    configs = {
        'data': {'compartmentPath': 'mysqltooling (root)/AlfredoHome/MySQL',
                 'networkCompartmentPath': 'mysqltooling (root)/AlfredoHome/Networks'},
        'errors': [],
        'id': my_id,
        'status': 'READY_TO_COMMIT',
        'values': {
            'database': {
                'adminPassword': DROP,
                'adminPasswordConfirm': DROP,
                'adminUsername': DROP,
                'autoExpandMaximumSizeGB': 0,
                'autoExpandStorage': False,
                'availabilityDomain': DROP,
                'contactEmails': '',
                'dbSystemId': '',
                'description': DROP,
                'enableBackup': False,
                'enableHA': False,
                'enableRestService': False,
                'faultDomain': '',
                'hostnameLabel': '',
                'enableHeatWave': False,
                'heatWaveClusterSize': 1,
                'heatWaveShapeName': '',
                'mysqlVersion': DROP,
                'name': 'testproj',
                'shapeName': 'MySQL.2',
                'storageSizeGB': 50,
            },
            'hosting': {
                'availabilityDomain': '',
                'bucketName': DROP,
                'compartmentId': DROP,
                'compartmentName': '',
                'computeId': '',
                'computeName': 'mysql-jump-host-1',
                'cpuCount': 2,
                'internetGatewayId': '',
                'internetGatewayName': 'MySQLVCN-IGW',
                'memorySizeGB': 24,
                'networkCompartmentId': DROP,
                'networkCompartmentName': 'Networks',
                'networkParentCompartmentId': DROP,
                'parentCompartmentId': DROP,
                'privateSubnet': {
                    'cidrBlock': '10.0.2.0/24',
                    'dnsLabel': '',
                    'id': DROP,
                    'name': 'MySQLSubnet',
                },
                'publicSubnet': {
                    'cidrBlock': '10.0.1.0/24',
                    'dnsLabel': '',
                    'id': DROP,
                    'name': 'MySQLPublicSubnet',
                },
                'shapeName': 'VM.Standard.E5.Flex',
                'vcnCidrBlock': '10.0.0.0/16',
                'vcnId': DROP,
                'vcnName': 'MySQLVCN',
            },
        },
    }

    update = plan_step.plan_update([{"id": my_id}])
    assert normeq([strip_sysvars(i) for i in j(update)][0],
                  configs)

    info = plan_step.plan_commit(my_id)
    assert normeq(strip_sysvars(j(info)), configs | {"status": "FINISHED"})

    check_still_committed(my_id)

    # TODO try some invalid options

    # TODO check suggestion for different sized source DBs
