# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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
from ... general import *
import mrs_plugin.lib as lib
import mysqlsh
import mrs_plugin.tests.unit.helpers as helpers

def test_info():
    info_output = info()
    assert info_output is not None
    assert info_output == (f"MySQL REST Data Service (MRS) Plugin Version {lib.general.VERSION} PREVIEW\n"
                           "Warning! For testing purposes only!")


def test_version():
    version_output = version()
    assert version_output is not None
    assert version_output == lib.general.VERSION


def test_configure(phone_book):
    config = {
        "session": phone_book["session"]
    }

    session_backup = mysqlsh.globals.session
    mysqlsh.globals.shell.set_session(None)

    helpers.create_shell_session()
    mysqlsh.globals.session.close()

    with pytest.raises(Exception, match="MySQL session not specified. Please either pass a session object when calling the function or open a database connection in the MySQL Shell first.") as exp:
        config_output = configure()
    mysqlsh.globals.shell.set_session(None)

    with pytest.raises(Exception, match="MySQL session not specified. Please either pass a session object when calling the function or open a database connection in the MySQL Shell first.") as exp:
        config_output = configure()

    mysqlsh.globals.shell.set_session(session_backup)

    config_output = configure()
    assert config_output == {
        "info_msg": config_output["info_msg"],
        "mrs_enabled": True,
        "schema_changed": False
    }

    config_output = configure(**config)
    assert config_output == {
        "info_msg": config_output["info_msg"],
        "mrs_enabled": True,
        "schema_changed": False
    }

    config = {
        "enable_mrs": False,
        "session": phone_book["session"]
    }

    config_output = configure(**config)
    assert config_output == {
        "info_msg": config_output["info_msg"],
        "mrs_enabled": False,
        "schema_changed": False
    }

    config = {
        "enable_mrs": True,
        "session": phone_book["session"]
    }
    config_output = configure(**config)
    assert config_output == {
        "info_msg": config_output["info_msg"],
        "mrs_enabled": True,
        "schema_changed": False
    }

    config = {
        "enable_mrs": False,
        "session": phone_book["session"]
    }
    config_output = configure(**config)
    assert config_output is not None
    assert config_output == {
        "info_msg": config_output["info_msg"],
        "schema_changed": False,
        "mrs_enabled": False
    }

    config = {
        "enable_mrs": True,
        "session": phone_book["session"],
    }
    config_output = configure(**config)
    assert config_output is not None
    assert config_output == {
        "info_msg": config_output["info_msg"],
        "schema_changed": False,
        "mrs_enabled": True
    }


def test_ls(phone_book):
    list_output = ls("localhost/test")
    assert list_output is None

    list_output = ls()
    assert list_output is None

    from ...lib.core import set_current_objects
    set_current_objects()

    list_output = ls("localhost/test")
    assert list_output is None

    list_output = ls()
    assert list_output is None

    set_current_objects(
        service_id=phone_book["service_id"], schema_id=phone_book["schema_id"])

    list_output = ls("localhost/test")
    assert list_output is None

    list_output = ls()
    assert list_output is None


def test_cd():
    cd_output = cd("")
    assert cd_output is None

    cd_output = cd("localhost/test")
    assert cd_output is None

    cd_output = cd("localhost/test/PhoneBook")
    assert cd_output is None


def test_status(phone_book):

    status_output = status(phone_book["session"])
    enabled = status_output["service_enabled"]

    # disable service
    config_output = configure(phone_book["session"], False)
    assert config_output == {
        "info_msg": config_output["info_msg"],
        "mrs_enabled": False,
        "schema_changed": False
    }

    status_output = status(phone_book["session"])
    assert status_output is not None
    assert isinstance(status_output, dict)
    assert status_output == {
        "service_configured": True,
        "service_count": 1,
        "service_enabled": False,
        "service_upgradeable": False,
        "current_metadata_version": lib.general.DB_VERSION_STR,
        "major_upgrade_required": False,
        "available_metadata_version": lib.general.DB_VERSION_STR,
        "service_upgrade_ignored": False,
        "required_router_version": lib.general.REQUIRED_ROUTER_VERSION_STR,
        "service_being_upgraded": False,
    }

    # enable service
    config_output = configure(phone_book["session"], True)
    assert config_output == {
        "info_msg": config_output["info_msg"],
        "mrs_enabled": True,
        "schema_changed": False
    }

    status_output = status(phone_book["session"])
    assert status_output is not None
    assert isinstance(status_output, dict)
    assert status_output == {
        "service_configured": True,
        "service_count": 1,
        "service_enabled": True,
        "service_upgradeable": False,
        "current_metadata_version": lib.general.DB_VERSION_STR,
        "major_upgrade_required": False,
        "available_metadata_version": lib.general.DB_VERSION_STR,
        "service_upgrade_ignored": False,
        "required_router_version": lib.general.REQUIRED_ROUTER_VERSION_STR,
        "service_being_upgraded": False,
    }

    config_output = configure(phone_book["session"], enabled)
    assert config_output == {
        "info_msg": config_output["info_msg"],
        "mrs_enabled": enabled,
        "schema_changed": False
    }

    status_output = status(phone_book["session"])
    assert status_output is not None
    assert isinstance(status_output, dict)
    assert status_output == {
        "service_configured": True,
        "service_count": 1,
        "service_enabled": enabled,
        "service_upgradeable": False,
        "current_metadata_version": lib.general.DB_VERSION_STR,
        "major_upgrade_required": False,
        "available_metadata_version": lib.general.DB_VERSION_STR,
        "service_upgrade_ignored": False,
        "required_router_version": lib.general.REQUIRED_ROUTER_VERSION_STR,
        "service_being_upgraded": False,
    }
