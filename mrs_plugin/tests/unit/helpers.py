# Copyright (c) 2022, Oracle and/or its affiliates.
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
from ... schemas import add_schema, delete_schema
from ... services import add_service, delete_service, get_service
from ... db_objects import add_db_object, delete_db_object
class SchemaCT(object):
    def __init__(self, service_id, schema_name, request_path, **kwargs):
        self._schema_id = add_schema(service_id=service_id, schema_name=schema_name, request_path=request_path,
            requires_auth=False, items_per_page=25, **kwargs)

    def __enter__(self):
        return self._schema_id

    def __exit__(self, type, value, traceback):
        delete_schema(schema_id=self._schema_id)


class ServiceCT(object):
    def __init__(self, url_context_root, url_host_name, **kwargs):
        self._args = kwargs
        self._args["url_context_root"] = url_context_root
        self._args["url_host_name"] = url_host_name
        self._args["url_protocol"] = ["HTTP"]
        self._args["is_default"] = kwargs.get("is_default", False)
        self._args["comments"] = kwargs.get("comments", "")
        if "auth_apps" in kwargs:
            self._args["auth_apps"] = kwargs.get("auth_apps")

        result = add_service(**self._args)
        assert result is not None
        assert isinstance(result, dict)

        self._service_id = result["id"]

    def __enter__(self):
        return self._service_id

    def __exit__(self, type, value, traceback):
        assert delete_service(service_id=self._service_id) == True

