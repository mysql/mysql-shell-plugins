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

@pytest.mark.usefixtures("init_mrs")
def test_info():
    info_output = info()
    assert info_output is not None
    assert info_output == (f"MySQL REST Data Service (MRS) Plugin Version {VERSION} PREVIEW\n"
               "Warning! For testing purposes only!")

@pytest.mark.usefixtures("init_mrs")
def test_version():
    version_output = version()
    assert version_output is not None
    assert version_output == VERSION

@pytest.mark.usefixtures("init_mrs")
def test_configure(init_mrs):
    config = {
        "session": init_mrs,
        "interactive": True
    }
    config_output = configure(**config)
    assert config_output is None

    config = {
        "enable_mrs": False,
        "session": init_mrs,
        "interactive": True
    }
    config_output = configure(**config)
    assert config_output is None

    config = {
        "enable_mrs": True,
        "session": init_mrs,
        "interactive": True
    }
    config_output = configure(**config)
    assert config_output is None

    config = {
        "enable_mrs": False,
        "session": init_mrs,
        "interactive": False
    }
    config_output = configure(**config)
    assert config_output is not None
    assert config_output == {'schema_changed': False,
                             'mrs_enabled': False}

    config = {
        "enable_mrs": True,
        "session": init_mrs,
        "interactive": False
    }
    config_output = configure(**config)
    assert config_output is not None
    assert config_output == {'schema_changed': False,
                             'mrs_enabled': True}

@pytest.mark.usefixtures("init_mrs")
def test_ls():
    list_output = ls("localhost/test")
    assert list_output is None

    list_output = ls()
    assert list_output is None

    from ... core import set_current_objects
    set_current_objects()

    list_output = ls("localhost/test")
    assert list_output is None

    list_output = ls()
    assert list_output is None

    set_current_objects(service_id=1, schema_id=1)

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

    cd_output = cd("localhost/test/test_schema")
    assert cd_output is None

@pytest.mark.usefixtures("init_mrs")
def test_status(init_mrs):
    config = {
        "enable_mrs": False,
        "session": init_mrs
    }
    config_output = configure(**config)
    assert config_output is None

    args = {
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": False,
        "return_formatted": True
    }
    status_output = status(**args)
    assert status_output is None

    config = {
        "enable_mrs": True,
        "session": init_mrs
    }
    config_output = configure(**config)
    assert config_output is None

    args = {
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": False,
        "return_formatted": False
    }
    status_output = status(**args)
    assert status_output is not None
    assert status_output == {'service_configured': True,
                             'service_enabled': 1,
                             'service_count': 1}

    args = {
        "session": init_mrs,
        "interactive": False,
        "raise_exceptions": False,
        "return_formatted": True
    }
    status_output = status(**args)
    assert status_output is None

