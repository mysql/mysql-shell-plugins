# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
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


@pytest.mark.usefixtures("init_mrs")
def test_info():
    info_output = info()
    assert info_output is not None
    assert info_output == (f"MySQL REST Data Service (MRS) Plugin Version {lib.general.VERSION} PREVIEW\n"
               "Warning! For testing purposes only!")

@pytest.mark.usefixtures("init_mrs")
def test_version():
    version_output = version()
    assert version_output is not None
    assert version_output == lib.general.VERSION

@pytest.mark.usefixtures("init_mrs")
def test_configure(init_mrs):
    config = {
        "session": init_mrs["session"]
    }

    config_output = configure(**config)
    assert config_output == {
        'mrs_enabled': 1,
        'schema_changed': False
    }

    config = {
        "enable_mrs": False,
        "session": init_mrs["session"]
    }

    config_output = configure(**config)
    assert config_output == {'mrs_enabled': False, 'schema_changed': False}

    config = {
        "enable_mrs": True,
        "session": init_mrs["session"]
    }
    config_output = configure(**config)
    assert config_output == {'mrs_enabled': True, 'schema_changed': False}

    config = {
        "enable_mrs": False,
        "session": init_mrs["session"]
    }
    config_output = configure(**config)
    assert config_output is not None
    assert config_output == {'schema_changed': False,
                             'mrs_enabled': False}

    config = {
        "enable_mrs": True,
        "session": init_mrs["session"],
    }
    config_output = configure(**config)
    assert config_output is not None
    assert config_output == {'schema_changed': False,
                             'mrs_enabled': True}

@pytest.mark.usefixtures("init_mrs")
def test_ls(init_mrs):
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

    set_current_objects(service_id=init_mrs["service_id"], schema_id=init_mrs["schema_id"])

    list_output = ls("localhost/test")
    assert list_output is None

    list_output = ls()
    assert list_output is None


@pytest.mark.usefixtures("init_mrs")
def test_cd():
    cd_output = cd("")
    assert cd_output is None

    cd_output = cd("localhost/test")
    assert cd_output is None

    cd_output = cd("localhost/test/PhoneBook")
    assert cd_output is None

@pytest.mark.usefixtures("init_mrs")
def test_status(init_mrs):

    status_output = status(init_mrs["session"])
    enabled = status_output["service_enabled"]

    # disable service
    config_output = configure(init_mrs["session"], False)
    assert config_output == {
        'mrs_enabled': False,
        'schema_changed': False
    }

    status_output = status(init_mrs["session"])
    assert status_output is not None
    assert isinstance(status_output, dict)
    assert status_output == {
        'service_configured': True,
        'service_count': 1,
        'service_enabled': 0
    }


    # enable service
    config_output = configure(init_mrs["session"], True)
    assert config_output == {
        'mrs_enabled': True,
        'schema_changed': False
    }

    status_output = status(init_mrs["session"])
    assert status_output is not None
    assert isinstance(status_output, dict)
    assert status_output == {
        'service_configured': True,
        'service_count': 1,
        'service_enabled': 1
    }

    config_output = configure(init_mrs["session"], enabled)
    assert config_output == {
        'mrs_enabled': enabled,
        'schema_changed': False
    }


    status_output = status(init_mrs["session"])
    assert status_output is not None
    assert isinstance(status_output, dict)
    assert status_output == {
        'service_configured': True,
        'service_count': 1,
        'service_enabled': enabled
    }

