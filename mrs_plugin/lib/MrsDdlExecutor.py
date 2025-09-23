# Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

import mrs_plugin.lib as lib
from mrs_plugin.lib.MrsDdlExecutorInterface import MrsDdlExecutorInterface
import json
import re
from mysqlsh import globals, DBError # type: ignore
from datetime import datetime
import base64
import os

class Timer(object):
    def __init__(self) -> None:
        self.start = datetime.now()

    def elapsed(self):
        return (datetime.now() - self.start).total_seconds()


class MrsDdlExecutor(MrsDdlExecutorInterface):

    service_request_path_override = None

    def __init__(
        self,
        session,
        current_service_id=None,
        current_service=None,
        current_service_host=None,
        current_in_development=None,
        current_schema_id=None,
        current_schema=None,
        state_data=None
    ):
        self.session = session
        # state_data will contain shared state data that must persist across calls
        if state_data is None:
            state_data = {}
        self.state_data = state_data
        self.service_state_data_checked = False
        self.schema_state_data_checked = False
        self.results = []
        # Updates the values of the provided parameters only if they are not None,
        # this is done to avoid overriding values that are cached in the Session
        if current_service_id is not None:
            self.current_service_id = current_service_id

        if current_service is not None:
            self.current_service = current_service

        if current_in_development is not None:
            self.current_in_development = current_in_development

        if current_service_host is not None:
            self.current_service_host = current_service_host

        if current_schema_id is not None:
            self.current_schema_id = current_schema_id

        if current_schema is not None:
            self.current_schema = current_schema

        self.current_operation = None

    @property
    def current_service_id(self):
        self.check_current_service()
        return self.state_data.get("current_service_id")

    @current_service_id.setter
    def current_service_id(self, value):
        self.state_data["current_service_id"] = value

    @property
    def current_schema_id(self):
        self.check_current_schema()
        return self.state_data.get("current_schema_id")

    @current_schema_id.setter
    def current_schema_id(self, value):
        self.state_data["current_schema_id"] = value

    @property
    def current_service(self):
        self.check_current_service()
        return self.state_data.get("current_service")

    @current_service.setter
    def current_service(self, value):
        self.state_data["current_service"] = value

    @property
    def current_service_host(self):
        self.check_current_service()
        return self.state_data.get("current_service_host")

    @current_service_host.setter
    def current_service_host(self, value):
        self.state_data["current_service_host"] = value

    @property
    def current_in_development(self):
        self.check_current_service()
        return self.state_data.get("current_in_development")

    @current_in_development.setter
    def current_in_development(self, value):
        self.state_data["current_in_development"] = value

    @property
    def current_schema(self):
        self.check_current_schema()
        return self.state_data.get("current_schema")

    @current_schema.setter
    def current_schema(self, value):
        self.state_data["current_schema"] = value

    def check_current_service(self):
        if self.service_state_data_checked:
            return
        self.service_state_data_checked = True
        id = self.state_data.get("current_service_id")
        if id and not lib.services.get_service(self.session, id):
            self.current_service_id = None
            self.current_service = None
            self.current_service_host = None
            self.current_in_development = None
            self.current_schema = None
            self.current_schema_id = None

    def check_current_schema(self):
        if self.schema_state_data_checked:
            return
        self.schema_state_data_checked = True
        id = self.state_data.get("current_schema_id")
        if id and not lib.schemas.get_schema(self.session, id):
            self.current_schema = None
            self.current_schema_id = None

    # Check if the current mrs_object includes a services request_path or if a
    # current service has been set via USE REST SERVICE
    def get_given_or_current_service_id(self, mrs_object, allow_not_set=False):
        service_id, _ = self.get_given_or_current_service_id_and_path(
            mrs_object)
        if service_id is None and not allow_not_set:
            raise Exception("No REST SERVICE specified.")
        return service_id

    # Check if the current mrs_object includes a services request_path or if a
    # current service has been set via USE REST SERVICE
    def get_given_or_current_service_id_and_path(self, mrs_object):
        # Prefer the given service if specified
        service_id = None
        service_path = None

        # Prefer the given service if specified
        url_context_root = mrs_object.get("url_context_root")
        if url_context_root is not None:
            url_host_name = mrs_object.get("url_host_name", "")
            developer_list = (
                mrs_object.get("in_development").get("developers", [])
                if mrs_object.get("in_development")
                else None
            )
            service = lib.services.get_service(
                url_context_root=url_context_root,
                url_host_name=url_host_name,
                developer_list=developer_list,
                session=self.session,
                get_default=False,
            )
            if service is None:
                raise Exception(
                    f"Could not find the REST SERVICE {self.get_service_sorted_developers(developer_list)}"
                    + f"{url_host_name}{url_context_root}."
                )

            service_id = service.get("id")
            service_path = service.get("url_context_root")

        if service_path is None and self.current_service_id is not None:
            service_id = self.current_service_id
            service_path = self.current_service
            mrs_object["url_context_root"] = self.current_service
            mrs_object["url_host_name"] = self.current_service_host
            mrs_object["in_development"] = self.current_in_development

        return service_id, service_path

    def get_given_or_current_full_service_path(self, mrs_object):
        # Prefer the given service if specified
        url_context_root = mrs_object.get("url_context_root")
        url_host_name = mrs_object.get("url_host_name", "")

        if url_context_root is None:
            if self.current_service_id is None:
                raise Exception("No REST SERVICE specified.")

            url_context_root = self.current_service
            url_host_name = self.current_service_host or ""

        return url_host_name + url_context_root

    def get_service_sorted_developers(self, developer_list: list):
        sorted_developers = ""
        if developer_list is not None and len(developer_list) > 0:

            def quote(s):
                return f"'{s}'"

            developer_list.sort()
            sorted_developers = (
                ",".join(
                    (
                        quote(re.sub(r"(['\\])", "\\\\\\1",
                              dev, 0, re.MULTILINE))
                        if not re.match(r"^\w+$", dev)
                        else dev
                    )
                    for dev in developer_list
                )
                + "@"
            )
        return sorted_developers

    # Check if the current mrs_object includes a schema request_path or if a
    # current schema has been set via USE REST SCHEMA
    def get_given_or_current_schema_id(self, mrs_object, allow_not_set=False):
        schema_id = None

        schema_request_path = mrs_object.get("schema_request_path")
        if schema_request_path is None and self.current_schema_id is not None:
            schema_id = self.current_schema_id
            mrs_object["schema_request_path"] = self.current_schema
            mrs_object["url_context_root"] = self.current_service
            mrs_object["url_host_name"] = self.current_service_host
            mrs_object["in_development"] = self.current_in_development
        elif schema_request_path is not None:
            service_id = self.get_given_or_current_service_id(mrs_object)
            schema = lib.schemas.get_schema(
                service_id=service_id,
                request_path=schema_request_path,
                session=self.session,
            )
            if schema is None:
                full_path = (
                    mrs_object.get("url_host_name", "")
                    + mrs_object.get("url_context_root", "")
                    + schema_request_path
                )
                raise Exception(f"Could not find the REST SCHEMA {full_path}.")

            schema_id = schema.get("id")

        if schema_id is None and not allow_not_set:
            raise Exception("No REST SCHEMA specified.")

        return schema_id

    def getFullServicePath(self, mrs_object, request_path=""):
        if "url_context_root" not in mrs_object:
            developers = ""
            if self.current_in_development is not None:
                developers = self.get_service_sorted_developers(
                    self.current_in_development.get("developers", "")
                )
            if self.current_service_host:
                return developers + self.current_service_host + request_path
            else:
                if self.current_service is not None:
                    return "" + self.current_service + request_path
                else:
                    return "" + request_path

        developers = ""
        if mrs_object.get("in_development") is not None:
            developers = self.get_service_sorted_developers(
                mrs_object.get("in_development").get("developers", "")
            )
        return (
            developers
            + mrs_object.get("url_host_name", "")
            + mrs_object.get("url_context_root", "")
            + request_path
        )

    def getFullSchemaPath(self, mrs_object, request_path=""):
        developers = ""
        if "in_development" in mrs_object.keys():
            developers = self.get_service_sorted_developers(
                mrs_object.get("in_development").get("developers")
            )

        return (
            developers +
            mrs_object.get("url_host_name",
                           self.current_service_host if self.current_service_host is not None else "") +
            mrs_object.get("url_context_root",
                           self.current_service if self.current_service is not None else "") +
            mrs_object.get("schema_request_path",
                           self.current_schema if self.current_schema is not None else "") +
            request_path
        )

    def createRestMetadata(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        try:
            status = lib.general.configure(
                session=self.session,
                enable_mrs=mrs_object.get("enabled"),
                options=mrs_object.get("options"),
                update_if_available=mrs_object.get("update_if_available"),
                merge_options=mrs_object.get("merge_options", False),
            )

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "message": (
                        f"REST metadata configured successfully."
                        if (status.get("schema_changed", False) is True)
                        else f"REST Metadata updated successfully."
                    ),
                    "operation": self.current_operation,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to configure the REST metadata. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def createRestService(self, mrs_object):
        timer = Timer()

        # Check if we need to override the url_context_root
        if MrsDdlExecutor.service_request_path_override:
            mrs_object["url_context_root"] = (
                MrsDdlExecutor.service_request_path_override
            )

        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace", False)
        if_not_exists = mrs_object.pop("if_not_exists", False)
        context_root = mrs_object.get("url_context_root", "")
        url_host_name = mrs_object.pop("url_host_name", "")
        line = mrs_object.pop("line", None)
        add_auth_apps = mrs_object.pop("add_auth_apps", [])
        # No need to remove auth apps during creation
        mrs_object.pop("remove_auth_apps", [])

        mrs_object.pop("merge_options", False)

        full_path = self.getFullServicePath(mrs_object=mrs_object)
        with lib.core.MrsDbTransaction(self.session):
            try:
                # If the OR REPLACE was specified, check if there is an existing service on the same host
                # with the same path and delete it.
                if do_replace or if_not_exists:
                    service = lib.services.get_service(
                        url_context_root=context_root,
                        url_host_name=url_host_name,
                        get_default=False,
                        developer_list=(
                            mrs_object.get("in_development").get(
                                "developers", [])
                            if "in_development" in mrs_object.keys()
                            else None
                        ),
                        session=self.session,
                    )
                    if service is not None:
                        if if_not_exists:
                            self.results.append(
                                {
                                    "statementIndex": len(self.results) + 1,
                                    "line": line,
                                    "type": "success",
                                    "message": f"REST SERVICE `{full_path}` created successfully.",
                                    "operation": self.current_operation,
                                    "id": lib.core.convert_id_to_string(service.get("id")),
                                    "executionTime": timer.elapsed(),
                                }
                            )
                            return
                        lib.services.delete_service(
                            service_id=service.get("id"), session=self.session
                        )

                # Add the service
                service_id = lib.services.add_service(
                    session=self.session,
                    url_host_name=url_host_name,
                    service=mrs_object,
                )

                # TODO this code doesn't belong here, it should be moved to the GUI layer
                # If this is the first service, make it the current one
                services = lib.services.get_services(session=self.session)
                if len(services) == 1:
                    # Set the stored current session
                    lib.services.set_current_service_id(
                        session=self.session, service_id=self.current_service_id
                    )

                for entry in add_auth_apps:
                    auth_app_name = entry.get("auth_app", None)
                    if_exists = entry.get("if_exists", None)
                    auth_app = lib.auth_apps.get_auth_app(
                        session=self.session, name=auth_app_name)
                    if auth_app is None and not if_exists:
                        raise ValueError(
                            f"The given REST authentication app `{auth_app_name}` was not found.")
                    if auth_app:
                        lib.auth_apps.link_auth_app(
                            session=self.session,
                            auth_app_id=auth_app["id"],
                            service_id=service_id)
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": line,
                        "type": "success",
                        "message": f"REST SERVICE `{full_path}` created successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(service_id),
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": line,
                        "type": "error",
                        "message": f"Failed to create the REST SERVICE `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def createRestSchema(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace", False)
        if_not_exists = mrs_object.pop("if_not_exists", False)

        schema_request_path = mrs_object.get("schema_request_path")

        # Check if we need to override the url_context_root
        if MrsDdlExecutor.service_request_path_override:
            mrs_object["url_context_root"] = (
                MrsDdlExecutor.service_request_path_override
            )

        full_path = self.getFullSchemaPath(mrs_object=mrs_object)

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)

                # If the OR REPLACE was specified, check if there is an existing schema on the same service
                # and delete it.
                if do_replace or if_not_exists:
                    schema = lib.schemas.get_schema(
                        service_id=service_id,
                        request_path=mrs_object.get("schema_request_path"),
                        session=self.session,
                    )
                    if schema is not None:
                        if if_not_exists:
                            self.results.append(
                                {
                                    "statementIndex": len(self.results) + 1,
                                    "line": mrs_object.get("line"),
                                    "type": "success",
                                    "message": f"REST SCHEMA `{full_path}` created successfully.",
                                    "operation": self.current_operation,
                                    "id": lib.core.convert_id_to_string(schema.get("id")),
                                    "executionTime": timer.elapsed(),
                                }
                            )
                            return
                        lib.schemas.delete_schema(
                            schema_id=schema.get("id"), session=self.session
                        )

                schema_id = lib.schemas.add_schema(
                    schema_name=mrs_object.get("schema_name"),
                    service_id=service_id,
                    request_path=schema_request_path,
                    requires_auth=mrs_object.get("requires_auth", False),
                    enabled=mrs_object.get("enabled", 1),
                    items_per_page=mrs_object.get("items_per_page"),
                    comments=mrs_object.get("comments"),
                    options=mrs_object.get("options"),
                    session=self.session,
                )

                # If this is the first schema of the REST service, make it the current one
                schemas = lib.schemas.get_schemas(
                    session=self.session, service_id=service_id
                )
                if len(schemas) == 1:
                    self.current_schema_id = schema_id
                    self.current_schema = schema_request_path

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST SCHEMA `{full_path}` created successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(schema_id),
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to create the REST SCHEMA `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def fill_object_names_if_not_given(self, mrs_object: dict, schema_id, full_path):
        assigned_names = []
        for i, obj in enumerate(mrs_object.get("objects")):
            # Auto-create unique object name if it was not specified by the user
            if obj["name"] is None:
                obj["name"] = lib.core.convert_path_to_pascal_case(full_path)
                numeric_post_fix = 2
                # If this db_object represents a procedure, add Params to the first object name and 2,3,.. if more than
                # one result set object has been defined
                if (
                    mrs_object.get("db_object_type") == "PROCEDURE"
                    or mrs_object.get("db_object_type") == "FUNCTION"
                ):
                    if obj["kind"] == "PARAMETERS":
                        obj["name"] = obj["name"] + "Params"
                    if i > 1:
                        if numeric_post_fix < i:
                            numeric_post_fix = i
                        obj["name"] = lib.core.convert_path_to_pascal_case(
                            full_path + str(numeric_post_fix)
                        )

                # If the object name is not unique for this schema, keep increasing a numeric_post_fix
                name_unique = False
                while not name_unique:
                    try:
                        if obj["name"] in assigned_names:
                            raise Exception("Object name already used.")
                        lib.core.check_mrs_object_name(
                            session=self.session,
                            db_schema_id=schema_id,
                            obj_id=obj["id"],
                            obj_name=obj["name"],
                        )

                        name_unique = True
                        assigned_names.append(obj["name"])
                    except:
                        obj["name"] = lib.core.convert_path_to_pascal_case(
                            full_path + str(numeric_post_fix)
                        )
                        numeric_post_fix += 1

    def createRestDbObject(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace", False)
        if_not_exists = mrs_object.pop("if_not_exists", False)

        # Check if we need to override the url_context_root
        if MrsDdlExecutor.service_request_path_override:
            mrs_object["url_context_root"] = (
                MrsDdlExecutor.service_request_path_override
            )

        full_path = self.getFullSchemaPath(
            mrs_object=mrs_object, request_path=mrs_object.get("request_path")
        )

        db_object_type = mrs_object.get("db_object_type")
        type_caption = (
            "VIEW"
            if db_object_type == "TABLE" or db_object_type == "VIEW"
            else db_object_type
        )

        with lib.core.MrsDbTransaction(self.session):
            try:
                schema_id = self.get_given_or_current_schema_id(mrs_object)

                self.fill_object_names_if_not_given(
                    mrs_object=mrs_object, schema_id=schema_id, full_path=full_path
                )

                # If the OR REPLACE was specified, check if there is an existing db_object on the same schema
                # and delete it.
                if do_replace or if_not_exists:
                    db_object = lib.db_objects.get_db_object(
                        schema_id=schema_id,
                        request_path=mrs_object.get("request_path"),
                        session=self.session,
                    )
                    if db_object is not None:
                        if if_not_exists:
                            self.results.append(
                                {
                                    "statementIndex": len(self.results) + 1,
                                    "line": mrs_object.get("line"),
                                    "type": "success",
                                    "message": f"REST {type_caption} `{full_path}` created successfully.",
                                    "operation": self.current_operation,
                                    "id": db_object.get("id"),
                                    "executionTime": timer.elapsed()
                                }
                            )
                            return
                        lib.db_objects.delete_db_object(
                            db_object_id=db_object.get("id"), session=self.session
                        )

                db_object_id, grants = lib.db_objects.add_db_object(
                    session=self.session,
                    schema_id=lib.core.id_to_binary(schema_id, "schema_id"),
                    db_object_name=mrs_object.get("name"),
                    request_path=mrs_object.get("request_path"),
                    db_object_type=mrs_object.get("db_object_type"),
                    enabled=mrs_object.get("enabled", True),
                    items_per_page=mrs_object.get("items_per_page"),
                    requires_auth=mrs_object.get("requires_auth", 1),
                    crud_operation_format=mrs_object.get("format", "FEED"),
                    comments=mrs_object.get("comments"),
                    media_type=mrs_object.get("media_type"),
                    auto_detect_media_type=mrs_object.get(
                        "media_type_autodetect", False
                    ),
                    auth_stored_procedure=mrs_object.get(
                        "auth_stored_procedure"),
                    options=mrs_object.get("options"),
                    db_object_id=lib.core.id_to_binary(
                        mrs_object.get("id"), "db_object_id"
                    ),
                    objects=mrs_object.get("objects"),
                    metadata=mrs_object.get("metadata", None),
                )

                warnings = []
                for grant in grants:
                    try:
                        lib.core.MrsDbExec(grant).exec(self.session)
                    except DBError as e:
                        if mrs_object.get("force_create", False):
                            warnings.append({
                                "level": "warning",
                                "message": e.msg,
                                "code": e.code})
                        else:
                            raise

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST {type_caption} `{full_path}` created successfully.",
                        "operation": self.current_operation,
                        "id": db_object_id,
                        "executionTime": timer.elapsed(),
                        "warnings": warnings
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to create the REST {type_caption} `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def createRestContentSet(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace", False)
        if_not_exists = mrs_object.pop("if_not_exists", False)

        # Check if we need to override the url_context_root
        if MrsDdlExecutor.service_request_path_override:
            mrs_object["url_context_root"] = (
                MrsDdlExecutor.service_request_path_override
            )

        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=mrs_object.get("request_path")
        )

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)

                # If the OR REPLACE was specified, check if there is an existing content set on the same service
                # and delete it.
                if do_replace or if_not_exists:
                    content_set = lib.content_sets.get_content_set(
                        service_id=service_id,
                        request_path=mrs_object.get("request_path"),
                        session=self.session,
                    )
                    if content_set is not None:
                        if if_not_exists:
                            self.results.append(
                                {
                                    "statementIndex": len(self.results) + 1,
                                    "type": "success",
                                    "message": f"REST content set `{full_path}` created successfully. 0 file(s) added.",
                                    "operation": self.current_operation,
                                    "id": content_set.get("id"),
                                    "executionTime": timer.elapsed(),
                                }
                            )
                            return
                        lib.content_sets.delete_content_set(
                            content_set_ids=[content_set.get("id")],
                            session=self.session,
                        )

                # Check if scripts should be loaded
                options = mrs_object.get("options", None)
                if mrs_object["content_type"] == "SCRIPTS":
                    if options is None:
                        options = {}
                    options["contains_mrs_scripts"] = True
                    if mrs_object.get("language", None) is not None:
                        options["mrs_scripting_language"] = mrs_object["language"]

                content_set_id, files_added = lib.content_sets.add_content_set(
                    session=self.session,
                    service_id=service_id,
                    request_path=mrs_object.get("request_path"),
                    requires_auth=mrs_object.get("requires_auth", True),
                    comments=mrs_object.get("comments"),
                    options=options,
                    enabled=mrs_object.get("enabled", 1),
                    content_dir=mrs_object.get("directory_file_path"),
                    ignore_list=mrs_object.get("file_ignore_list", None),
                )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "type": "success",
                        "message": f"REST content set `{full_path}` created successfully. {files_added} file(s) added.",
                        "operation": self.current_operation,
                        "id": content_set_id,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to create the REST CONTENT SET `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def createRestContentFile(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace", False)
        if_not_exists = mrs_object.pop("if_not_exists", False)

        full_path = mrs_object.get("request_path")

        # Check if we need to override the url_context_root
        if MrsDdlExecutor.service_request_path_override:
            mrs_object["url_context_root"] = (
                MrsDdlExecutor.service_request_path_override
            )

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)

                # Get content set
                content_set = lib.content_sets.get_content_set(
                    session=self.session,
                    service_id=service_id,
                    request_path=mrs_object.get("content_set_path"),
                )
                if content_set is None:
                    raise Exception(
                        f'CONTENT SET {mrs_object.get("content_set_path")} not found.'
                    )

                full_path = self.getFullServicePath(
                    mrs_object=mrs_object,
                    request_path=content_set.get("request_path")
                    + mrs_object.get("request_path"),
                )

                # If the OR REPLACE was specified, check if there is an existing content set on the same service
                # and delete it.
                if do_replace or if_not_exists:
                    content_file = lib.content_files.get_content_file(
                        content_set_id=content_set.get("id"),
                        request_path=mrs_object.get("request_path"),
                        include_file_content=False,
                        session=self.session,
                    )
                    if content_file is not None:
                        if if_not_exists:
                            self.results.append(
                                {
                                    "statementIndex": len(self.results) + 1,
                                    "line": mrs_object.get("line"),
                                    "type": "success",
                                    "message": f"REST CONTENT FILE `{full_path}` created successfully.",
                                    "operation": self.current_operation,
                                    "id": content_file.get("id"),
                                    "executionTime": timer.elapsed(),
                                }
                            )
                            return
                        lib.content_files.delete_content_file(
                            content_file_ids=[content_file.get("id")],
                            session=self.session,
                        )

                file_path: str | None = mrs_object.get("directory_file_path")
                if file_path is not None:
                    file_path = file_path.replace('"', "")

                    if not os.path.exists(file_path):
                        raise Exception(f"File '{file_path}' does not exist.")

                    with open(file_path, "rb") as f:
                        data = f.read()
                elif mrs_object.get("is_binary", False):
                    data = base64.b64decode(mrs_object.get("content"))
                else:
                    data = mrs_object.get("content")

                content_file_id = lib.content_files.add_content_file(
                    session=self.session,
                    content_set_id=content_set.get("id"),
                    request_path=mrs_object.get("request_path"),
                    requires_auth=mrs_object.get("requires_auth", 1),
                    options=mrs_object.get("options"),
                    data=data,
                    enabled=mrs_object.get("enabled", 1),
                )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST CONTENT FILE `{full_path}` created successfully.",
                        "operation": self.current_operation,
                        "id": content_file_id,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to create the REST CONTENT FILE `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def createRestAuthApp(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace", False)
        if_not_exists = mrs_object.pop("if_not_exists", False)

        name = mrs_object.get("name")
        full_path = name

        with lib.core.MrsDbTransaction(self.session):
            try:
                # If the OR REPLACE was specified, check if there is an existing content set on the same service
                # and delete it.
                if do_replace or if_not_exists:
                    auth_app = lib.auth_apps.get_auth_app(
                        name=name, session=self.session
                    )
                    if auth_app is not None:
                        if if_not_exists:
                            self.results.append(
                                {
                                    "statementIndex": len(self.results) + 1,
                                    "line": mrs_object.get("line"),
                                    "type": "success",
                                    "message": f"REST AUTH APP `{full_path}` created successfully.",
                                    "operation": self.current_operation,
                                    "id": lib.core.convert_id_to_string(auth_app.get("id")),
                                    "executionTime": timer.elapsed(),
                                }
                            )
                            return
                        lib.auth_apps.delete_auth_app(
                            app_id=auth_app.get("id"),
                            session=self.session,
                        )

                # TODO: Lookup default role by name
                if mrs_object.get("default_role"):
                    # Note: authapps are not specific to a service, so only only global roles can be set as a default role
                    role = lib.roles.get_role(
                        session=self.session,
                        caption=mrs_object.get("default_role"),
                        specific_to_service_id=None
                    )
                    if role is None:
                        raise Exception(
                            f'Given role "{mrs_object.get("default_role")}" not found.'
                        )
                    default_role_id = role.get("id")
                else:
                    default_role_id = lib.core.id_to_binary(
                        "0x31000000000000000000000000000000", ""
                    )

                auth_vendor = lib.auth_apps.get_auth_vendor(
                    session=self.session, name=mrs_object.get("vendor")
                )
                if auth_vendor is None:
                    raise Exception(
                        f'The vendor `{mrs_object.get("vendor")}` was not found.'
                    )
                # Check constraints for OAuth2 vender apps
                if (auth_vendor["id"] != lib.core.id_to_binary("0x30000000000000000000000000000000", "") and
                        auth_vendor["id"] != lib.core.id_to_binary("0x31000000000000000000000000000000", "")):
                    if mrs_object.get("url") is None:
                        raise Exception(
                            f'The OAuth2 vendor `{mrs_object.get("vendor")}` requires '
                            'the URL option to be specified.'
                        )
                    if mrs_object.get("app_id") is None:
                        raise Exception(
                            f'The OAuth2 vendor `{mrs_object.get("vendor")}` requires '
                            'the APP/CLIENT ID option to be specified.'
                        )
                    if mrs_object.get("app_secret") is None:
                        raise Exception(
                            f'The OAuth2 vendor `{mrs_object.get("vendor")}` requires '
                            'the APP/CLIENT SECRET option to be specified.'
                        )

                auth_app_id = lib.auth_apps.add_auth_app(
                    session=self.session,
                    service_id=None,
                    auth_vendor_id=auth_vendor["id"],
                    app_name=name,
                    description=mrs_object.get("comments"),
                    url=mrs_object.get("url"),
                    url_direct_auth=mrs_object.get("url_direct_auth"),
                    access_token=mrs_object.get("app_secret"),
                    app_id=mrs_object.get("app_id"),
                    limit_to_reg_users=mrs_object.get(
                        "limit_to_registered_users", 1),
                    default_role_id=default_role_id,
                    enabled=mrs_object.get("enabled", 1),
                )

                if auth_app_id is None:
                    raise Exception("REST auth app could not be created.")

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST AUTH APP `{full_path}` created successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(auth_app_id),
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to create the REST CONTENT SET `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def createRestUser(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace", False)
        if_not_exists = mrs_object.pop("if_not_exists", False)

        name = mrs_object.get("name")
        authAppName = mrs_object.get("authAppName")
        password = mrs_object.get("password")
        full_path = f':"{name}"@"{authAppName}"'
        app_options = mrs_object.get("app_options", None)
        options = mrs_object.get("options", None)

        email = options.pop("email", None) if options else None
        vendor_user_id = options.pop(
            "vendor_user_id", None) if options else None
        mapped_user_id = options.pop(
            "mapped_user_id", None) if options else None
        login_permitted = mrs_object.get("login_permitted", True)

        with lib.core.MrsDbTransaction(self.session):
            try:
                if password == "":
                    raise Exception("The password must not be empty.")

                auth_app = lib.auth_apps.get_auth_app(
                    name=authAppName, session=self.session
                )
                if auth_app is None:
                    raise Exception(
                        f"The given REST AUTH APP for {full_path} was not found."
                    )

                # If the OR REPLACE was specified, check if there is an existing content set on the same service
                # and delete it.
                if do_replace or if_not_exists:
                    users = lib.users.get_users(
                        auth_app_id=auth_app.get("id"),
                        user_name=name,
                        session=self.session,
                    )
                    if len(users) > 0:
                        if if_not_exists:
                            self.results.append(
                                {
                                    "statementIndex": len(self.results) + 1,
                                    "line": mrs_object.get("line"),
                                    "type": "success",
                                    "message": f"REST USER `{full_path}` created successfully.",
                                    "operation": self.current_operation,
                                    "id": lib.core.convert_id_to_string(users[0].get("id")),
                                    "executionTime": timer.elapsed(),
                                }
                            )
                            return
                        lib.users.delete_user_by_id(
                            user_id=users[0].get("id"), session=self.session
                        )

                user_id = lib.users.add_user(
                    session=self.session,
                    auth_app_id=auth_app["id"],
                    name=name,
                    email=email,
                    vendor_user_id=vendor_user_id,
                    login_permitted=int(login_permitted),
                    mapped_user_id=mapped_user_id,
                    options=options,
                    app_options=app_options,
                    auth_string=password,
                )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST USER `{full_path}` created successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(user_id),
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to create the REST USER `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def createRestRole(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace", False)
        if_not_exists = mrs_object.pop("if_not_exists", False)

        # captions are UNIQUE
        caption = mrs_object.get("name")
        comments = mrs_object.get("comments")
        json_options = mrs_object.get("options", {})

        any_service = mrs_object.get("any_service", False)
        if not any_service:
            specific_to_service_id = self.get_given_or_current_service_id(
                mrs_object, allow_not_set=False)
        else:
            specific_to_service_id = None
        with lib.core.MrsDbTransaction(self.session):
            try:
                extends = mrs_object.get("extends")
                if extends:
                    parent_role = lib.roles.get_role(
                        self.session, caption=extends, specific_to_service_id=specific_to_service_id)
                    if not parent_role:
                        raise Exception(f"Invalid parent role '{extends}'")
                    extends_role_id = parent_role.get("id")
                else:
                    extends_role_id = None

                # If the OR REPLACE was specified, check if there is an existing content set on the same service
                # and delete it.
                if do_replace or if_not_exists:
                    role = lib.roles.get_role(
                        specific_to_service_id=specific_to_service_id,
                        caption=caption,
                        session=self.session
                    )
                    if role:
                        if if_not_exists:
                            self.results.append(
                                {
                                    "statementIndex": len(self.results) + 1,
                                    "line": mrs_object.get("line"),
                                    "type": "success",
                                    "message": f"REST ROLE `{caption}` created successfully.",
                                    "operation": self.current_operation,
                                    "id": lib.core.convert_id_to_string(role.get("id")),
                                    "executionTime": timer.elapsed(),
                                }
                            )
                            return
                        lib.roles.delete_role(
                            role_id=role.get("id"), session=self.session
                        )

                role_id = lib.roles.add_role(
                    session=self.session,
                    derived_from_role_id=extends_role_id,
                    caption=caption,
                    specific_to_service_id=specific_to_service_id,
                    description=comments,
                    options=json_options,
                )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST ROLE `{caption}` created successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(role_id),
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to create the REST ROLE `{caption}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def cloneRestService(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        full_path = self.getFullServicePath(mrs_object)
        url_context_root = mrs_object.get("url_context_root")
        new_url_context_root = mrs_object.get("new_url_context_root")

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)

            service = lib.services.get_service(self.session, url_context_root=url_context_root)

            if service is None:
                raise Exception("The given REST SERVICE was not found.")

            lib.services.clone_service(self.session, service, new_url_context_root, mrs_object.get("new_developer_list", []))

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "affectedItemsCount": 1,
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(service_id),
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to clone the REST SERVICE `{full_path}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def alterRestService(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        add_auth_apps = mrs_object.pop("add_auth_apps", [])
        remove_auth_apps = mrs_object.pop("remove_auth_apps", [])
        merge_options = mrs_object.pop("merge_options", False)

        full_path = self.getFullServicePath(mrs_object)

        try:
            line = mrs_object.pop("line", None)
            service_id = self.get_given_or_current_service_id(mrs_object)

            # If a new developer_list / url_context_root / url_host_name was given,
            # overwrite the existing values in the mrs_object
            # so they are set during the update
            if "new_developer_list" in mrs_object.keys():
                if not "in_development" in mrs_object.keys():
                    mrs_object["in_development"] = {"developers": []}
                mrs_object["in_development"]["developers"] = mrs_object.pop(
                    "new_developer_list"
                )

            new_url_context_root = mrs_object.pop("new_url_context_root", None)
            new_url_host_name = mrs_object.pop("new_url_host_name", None)
            if new_url_context_root is not None:
                if new_url_host_name is None:
                    new_url_host_name = ""
                mrs_object["url_context_root"] = new_url_context_root
                mrs_object["url_host_name"] = new_url_host_name

            lib.services.update_services(
                session=self.session, service_ids=[
                    service_id], value=mrs_object,
                    merge_options=merge_options,
            )

            for entry in add_auth_apps:
                auth_app_name = entry.get("auth_app", None)
                if_exists = entry.get("if_exists", None)
                auth_app = lib.auth_apps.get_auth_app(
                    session=self.session, name=auth_app_name)
                if auth_app is None and not if_exists:
                    raise ValueError(
                        f"The given REST authentication app `{auth_app_name}` was not found.")
                if auth_app:
                    lib.auth_apps.link_auth_app(
                        session=self.session,
                        auth_app_id=auth_app["id"],
                        service_id=service_id)

            for entry in remove_auth_apps:
                auth_app_name = entry.get("auth_app", None)
                if_exists = entry.get("if_exists", None)
                auth_app = lib.auth_apps.get_auth_app(
                    session=self.session, name=auth_app_name)
                if auth_app is None and not if_exists:
                    raise ValueError(
                        f"The given REST authentication app `{auth_app_name}` was not found.")
                if auth_app:
                    lib.auth_apps.unlink_auth_app(
                        session=self.session,
                        auth_app_id=auth_app["id"],
                        service_id=service_id)

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": line,
                    "type": "success",
                    "affectedItemsCount": 1,
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(service_id),
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": line,
                    "type": "error",
                    "message": f"Failed to update the REST SERVICE `{full_path}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def alterRestSchema(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        full_path = self.getFullSchemaPath(mrs_object=mrs_object)

        merge_options = mrs_object.pop("merge_options", False)

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)

            schema = lib.schemas.get_schema(
                service_id=service_id,
                request_path=mrs_object.get("schema_request_path"),
                session=self.session,
            )

            if schema is None:
                raise Exception("The REST schema was not found.")

            lib.schemas.update_schema(
                session=self.session,
                schemas={schema["id"]: ""},
                value={
                    "service_id": mrs_object.get(
                        "new_service_id", schema["service_id"]
                    ),
                    "request_path": mrs_object.get(
                        "new_request_path", schema["request_path"]
                    ),
                    "requires_auth": int(mrs_object.get(
                        "requires_auth", schema["requires_auth"]
                    )),
                    "enabled": mrs_object.get("enabled", schema["enabled"]),
                    "items_per_page": mrs_object.get(
                        "items_per_page", schema["items_per_page"]
                    ),
                    "comments": mrs_object.get("comments", schema["comments"]),
                    "options": mrs_object.get("options", schema["options"]),
                    "metadata": mrs_object.get("metadata", schema["metadata"]),
                },
                merge_options=merge_options,
            )

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "affectedItemsCount": 1,
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(service_id),
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to update the REST SCHEMA `{full_path}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def alterRestDbObject(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        request_path = mrs_object.pop("request_path")
        rest_object_type = mrs_object.pop("type")
        db_object_id = mrs_object.pop("id")

        full_path = self.getFullSchemaPath(
            mrs_object=mrs_object, request_path=request_path
        )

        # Remove non-standard mrs_object keys so it can be directly passed to the alter function
        mrs_object.pop("url_host_name", "")
        mrs_object.pop("parent_reference_stack", "")
        mrs_object.pop("url_context_root", "")
        mrs_object.pop("schema_request_path", "")
        mrs_object.pop("in_development", "")
        line = mrs_object.pop("line", None)

        merge_options = mrs_object.pop("merge_options", False)

        try:
            db_object = lib.db_objects.get_db_object(
                session=self.session, db_object_id=db_object_id
            )
            if db_object is None:
                raise Exception(
                    f"The given REST {rest_object_type} `{full_path}` could not be found."
                )

            self.fill_object_names_if_not_given(
                mrs_object=mrs_object,
                schema_id=db_object["db_schema_id"],
                full_path=full_path,
            )

            new_request_path = mrs_object.pop("new_request_path")
            if new_request_path is not None:
                mrs_object["request_path"] = new_request_path

            new_object_name = mrs_object.pop("new_object_name")
            if new_object_name is not None:
                # TODO: Implement object handling
                pass

            mrs_object.pop("graph_ql_object_count", None)
            objects = mrs_object.pop("objects", None)

            # Alter DB Object
            if mrs_object:
                lib.db_objects.update_db_objects(
                    session=self.session,
                    db_object_ids={db_object["id"]: ""},
                    value=mrs_object,
                    merge_options=merge_options,
                )

            if objects:
                lib.db_objects.set_objects(
                    session=self.session, db_object_id=db_object["id"], objects=objects
                )

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": line,
                    "type": "success",
                    "affectedItemsCount": 1,
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(db_object["id"]),
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": line,
                    "type": "error",
                    "message": f"Failed to get the REST {rest_object_type} `{full_path}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def alterRestContentSet(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        request_path = mrs_object.pop("request_path")

        merge_options = mrs_object.pop("merge_options", False)

        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=request_path
        )

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)
                if service_id is None:
                    raise Exception("No REST SERVICE specified.")

                content_set = lib.content_sets.get_content_set(
                    session=self.session,
                    service_id=service_id,
                    request_path=request_path,
                )
                if content_set is None:
                    raise Exception(
                        f"The given REST content set `{full_path}` could not be found."
                    )

                new_request_path = mrs_object.pop("new_request_path")
                if new_request_path is not None:
                    mrs_object["request_path"] = new_request_path

                # Check if scripts should be loaded
                options = mrs_object.get("options", None)
                if mrs_object["content_type"] == "SCRIPTS":
                    if options is None:
                        options = {}
                    options["contains_mrs_scripts"] = True
                    if mrs_object.get("language", None) is not None:
                        options["mrs_scripting_language"] = mrs_object.pop(
                            "language")
                    mrs_object["options"] = options

                if "url_context_root" in mrs_object:
                    mrs_object.pop("url_context_root")

                file_ignore_list = mrs_object.pop("file_ignore_list", None)

                lib.content_sets.update_content_set(
                    session=self.session,
                    content_set_id=content_set["id"],
                    value=mrs_object,
                    file_ignore_list=file_ignore_list,
                    merge_options=merge_options,
                )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "affectedItemsCount": 1,
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(content_set["id"]),
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to update the REST content set `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def alterRestUser(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        name = mrs_object.get("name")
        authAppName = mrs_object.get("authAppName")
        password = mrs_object.get("password")
        full_path = f':"{name}"@"{authAppName}"'
        app_options = mrs_object.get("app_options", None)
        options = mrs_object.get("options", None)

        email = options.pop("email", None) if options else None
        vendor_user_id = options.pop(
            "vendor_user_id", None) if options else None
        mapped_user_id = options.pop(
            "mapped_user_id", None) if options else None
        login_permitted = mrs_object.get("login_permitted", None)

        with lib.core.MrsDbTransaction(self.session):
            try:
                if password == "":
                    raise Exception("The password must not be empty.")

                auth_app = lib.auth_apps.get_auth_app(
                    name=authAppName, session=self.session
                )
                if auth_app is None:
                    raise Exception(
                        f"The given REST AUTH APP for {full_path} was not found."
                    )

                user = lib.users.get_user(
                    self.session,
                    user_name=name,
                    auth_app_id=auth_app["id"]
                )
                if not user:
                    raise Exception(
                        f'Invalid REST user "{name}"@"{authAppName}"')
                user_id = user['id']

                changes = {}
                if login_permitted is not None:
                    changes["login_permitted"] = int(login_permitted)
                if email is not None:
                    changes["email"] = email
                if password is not None:
                    changes["auth_string"] = password
                    changes["auth_app_id"] = user["auth_app_id"]
                if app_options is not None:
                    changes["app_options"] = app_options
                if options:
                    changes["options"] = options
                if mapped_user_id is not None:
                    changes["mapped_user_id"] = mapped_user_id
                if vendor_user_id is not None:
                    changes["vendor_user_id"] = vendor_user_id

                lib.users.update_user(
                    session=self.session,
                    user_id=user_id,
                    value=changes
                )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST USER `{full_path}` updated successfully.",
                        "affectedItemsCount": 1,
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(user_id),
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to update the REST USER `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def dropRestService(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        if_exists = mrs_object.pop("if_exists")

        full_path = self.getFullServicePath(mrs_object=mrs_object)

        with lib.core.MrsDbTransaction(self.session):
            try:
                service = lib.services.get_service(
                    url_context_root=mrs_object.get("url_context_root"),
                    url_host_name=mrs_object.get("url_host_name", ""),
                    developer_list=(
                        mrs_object.get("in_development").get("developers", [])
                        if "in_development" in mrs_object.keys()
                        else None
                    ),
                    session=self.session,
                )
                if service is None and not if_exists:
                    raise Exception(
                            f"The given REST SERVICE `{full_path}` could not be found."
                        )

                if service:
                    lib.services.delete_service(
                        service_id=service["id"], session=self.session
                    )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST SERVICE `{full_path}` dropped successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(service["id"]) if service else None,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to drop the REST SERVICE `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def dropRestSchema(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        if_exists = mrs_object.pop("if_exists")

        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=mrs_object.get(
                "request_path", "")
        )

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)

                schema = lib.schemas.get_schema(
                    service_id=service_id,
                    request_path=mrs_object["request_path"],
                    session=self.session,
                )
                if schema is None and not if_exists:
                    raise Exception(
                        f"The given REST SCHEMA `{full_path}` could not be found."
                    )

                if schema:
                    lib.schemas.delete_schema(
                        schema_id=schema["id"], session=self.session)

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST SCHEMA `{full_path}` dropped successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(schema["id"]) if schema else None,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to drop the REST SCHEMA `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def dropRestDbObject(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        request_path = mrs_object.pop("request_path")
        rest_object_type = mrs_object.pop("type")
        if_exists = mrs_object.pop("if_exists")

        full_path = self.getFullSchemaPath(
            mrs_object=mrs_object, request_path=request_path
        )

        with lib.core.MrsDbTransaction(self.session):
            try:
                schema_id = self.get_given_or_current_schema_id(mrs_object)

                db_object = lib.db_objects.get_db_object(
                    session=self.session, schema_id=schema_id, request_path=request_path
                )
                if db_object is None and not if_exists:
                    raise Exception(
                        f"The given REST {rest_object_type} `{full_path}` could not be found."
                    )

                if db_object:
                    lib.db_objects.delete_db_object(
                        session=self.session, db_object_id=db_object.get("id")
                    )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST {rest_object_type} `{full_path}` dropped successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(db_object["id"]) if db_object else None,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to drop the REST {rest_object_type} `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def dropRestContentSet(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        request_path = mrs_object.get("request_path")
        if_exists = mrs_object.pop("if_exists")

        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=request_path
        )

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)

                content_set = lib.content_sets.get_content_set(
                    service_id=service_id,
                    request_path=request_path,
                    session=self.session,
                )
                if content_set is None and not if_exists:
                    raise Exception(
                        f"The given REST CONTENT SET `{full_path}` could not be found."
                    )

                if content_set:
                    lib.content_sets.delete_content_set(
                        content_set_ids=[content_set["id"]], session=self.session
                    )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST CONTENT SET `{full_path}` dropped successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(content_set["id"]) if content_set else None,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to drop the REST CONTENT SET `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def dropRestContentFile(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        full_path = mrs_object.get("request_path")
        if_exists = mrs_object.pop("if_exists")

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)

                # Get content set
                content_set = lib.content_sets.get_content_set(
                    session=self.session,
                    service_id=service_id,
                    request_path=mrs_object.get("content_set_path"),
                )
                if content_set is None and not if_exists:
                    raise Exception(
                        f'The REST content set {mrs_object.get("content_set_path")} was not found.'
                    )

                if content_set:
                    full_path = self.getFullServicePath(
                        mrs_object=mrs_object,
                        request_path=content_set.get("request_path")
                        + mrs_object.get("request_path"),
                    )

                    content_file = lib.content_files.get_content_file(
                        content_set_id=content_set.get("id"),
                        request_path=mrs_object.get("request_path"),
                        include_file_content=False,
                        session=self.session,
                    )
                    if content_file is None and not if_exists:
                        raise Exception(
                            f"The REST content file {full_path} was not found.")
                else:
                    content_file = None

                if content_file:
                    lib.content_files.delete_content_file(
                        content_file_id=content_file["id"], session=self.session
                    )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST CONTENT FILE `{full_path}` created successfully.",
                        "operation": self.current_operation,
                        "id": content_file["id"] if content_file else None,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to create the REST CONTENT FILE `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def dropRestAuthApp(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        if_exists = mrs_object.pop("if_exists")
        name = mrs_object.get("name")

        with lib.core.MrsDbTransaction(self.session):
            try:
                auth_app = lib.auth_apps.get_auth_app(
                    name=name, session=self.session
                )
                if auth_app is None and not if_exists:
                    raise Exception(
                        f"The given REST AUTH APP `{name}` could not be found."
                    )

                if auth_app:
                    lib.auth_apps.delete_auth_app(
                        app_id=auth_app.get("id"),
                        session=self.session,
                    )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST AUTH APP `{name}` dropped successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(auth_app["id"]) if auth_app else None,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to drop the REST AUTH APP `{name}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def dropRestUser(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        if_exists = mrs_object.pop("if_exists")

        name = mrs_object.get("name")
        authAppName = mrs_object.get("authAppName")
        full_path = f':"{name}"@"{authAppName}"'

        with lib.core.MrsDbTransaction(self.session):
            try:
                auth_app = lib.auth_apps.get_auth_app(
                    name=authAppName, session=self.session
                )
                if auth_app is None and not if_exists:
                    raise Exception(
                        f"The given REST AUTH APP for {full_path} was not found."
                    )

                if auth_app:
                    users = lib.users.get_users(
                        auth_app_id=auth_app.get("id"), user_name=name, session=self.session
                    )
                    if len(users) > 0:
                        lib.users.delete_user_by_id(
                            user_id=users[0].get("id"), session=self.session
                        )
                    else:
                        if not if_exists:
                            raise Exception("User was not found.")
                else:
                    users = None

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST USER `{full_path}` dropped successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(users[0].get("id")) if users else None,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to drop the REST USER `{full_path}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def dropRestRole(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        if_exists = mrs_object.pop("if_exists")


        caption = mrs_object.get("name")
        any_service = mrs_object.get("any_service", False)
        if not any_service:
            specific_to_service_id = self.get_given_or_current_service_id(
                mrs_object, allow_not_set=False)
        else:
            specific_to_service_id = None
        with lib.core.MrsDbTransaction(self.session):
            try:
                role = lib.roles.get_role(
                    caption=caption, session=self.session, specific_to_service_id=specific_to_service_id)
                if not role and not if_exists:
                    raise Exception(f"Role `{caption}` was not found.")

                if role:
                    lib.roles.delete_role(
                        role_id=role.get("id"), session=self.session)

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REST ROLE `{caption}` dropped successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(role.get("id")) if role else None,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to drop the REST ROLE `{caption}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def grantRestPrivileges(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        role_name = mrs_object.get("role")
        privileges = mrs_object.get("privileges")
        any_service = mrs_object.get("any_service", False)
        if not any_service:
            specific_to_service_id = self.get_given_or_current_service_id(
                mrs_object, allow_not_set=False)
        else:
            specific_to_service_id = None

        url_context_root = mrs_object.get("url_context_root_pattern")
        if url_context_root is None:
            url_context_root = "*"
        schema_request_path = mrs_object.get("schema_request_path")
        if schema_request_path is None:
            schema_request_path = "*"
        object_request_path = mrs_object.get("object_request_path")
        if object_request_path is None:
            object_request_path = "*"

        if url_context_root not in ("*", "") and not url_context_root.startswith("/"):
            raise ValueError('service_path must be "", "*" or start with a /')
        if schema_request_path not in ("*", "") and not schema_request_path.startswith("/"):
            raise ValueError('schema_path must be "", "*" or start with a /')
        if object_request_path not in ("*", "") and not object_request_path.startswith("/"):
            raise ValueError('object_path must be "", "*" or start with a /')

        with lib.core.MrsDbTransaction(self.session):
            try:
                role = lib.roles.get_role(
                    caption=role_name, session=self.session, specific_to_service_id=specific_to_service_id)
                if not role:
                    raise Exception(f"Role `{role_name}` was not found.")

                priv_id = lib.roles.add_role_privilege(
                    session=self.session,
                    role_id=role.get("id"),
                    privileges=privileges,
                    service_path=url_context_root,
                    schema_path=schema_request_path,
                    object_path=object_request_path
                )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"GRANT to `{role_name}` added successfully.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(priv_id),
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to grant privileges for REST role `{role_name}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def grantRestRole(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        role_name = mrs_object.get("role")
        user_name = mrs_object.get("user")
        auth_app_name = mrs_object.get("auth_app_name")
        comments = mrs_object.get("comments")
        any_service = mrs_object.get("any_service", False)
        if not any_service:
            specific_to_service_id = self.get_given_or_current_service_id(
                mrs_object, allow_not_set=False)
        else:
            specific_to_service_id = None

        target = f"`{user_name}`@`{auth_app_name}`"

        with lib.core.MrsDbTransaction(self.session):
            try:
                role = lib.roles.get_role(
                    caption=role_name,
                    session=self.session,
                    specific_to_service_id=specific_to_service_id
                )
                if not role:
                    raise Exception(f"Role `{role_name}` was not found.")

                user = lib.users.get_user(
                    self.session,
                    user_name=user_name,
                    auth_app_name=auth_app_name,
                )
                if not user:
                    raise Exception(
                        f'User "{user_name}"@"{auth_app_name}" was not found.'
                    )

                lib.users.add_user_role(
                    session=self.session,
                    role_id=role.get("id"),
                    user_id=user.get("id"),
                    comments=comments,
                )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"GRANT ROLE to {target} added successfully.",
                        "operation": self.current_operation,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to grant REST role `{role_name}` to {target}. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def revokeRestRole(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        role_name = mrs_object.get("role")
        user_name = mrs_object.get("user")
        auth_app_name = mrs_object.get("auth_app_name")
        any_service = mrs_object.get("any_service", False)
        if not any_service:
            specific_to_service_id = self.get_given_or_current_service_id(
                mrs_object, allow_not_set=False)
        else:
            specific_to_service_id = None

        target = f"`{user_name}`@`{auth_app_name}`"

        with lib.core.MrsDbTransaction(self.session):
            try:
                role = lib.roles.get_role(
                    caption=role_name, session=self.session, specific_to_service_id=specific_to_service_id)
                if not role:
                    raise Exception(f"Role `{role_name}` was not found.")

                user = lib.users.get_user(
                    self.session,
                    user_name=user_name,
                    auth_app_name=auth_app_name,
                )

                if user is None:
                    raise Exception(
                        f"The given user `{user_name}` was not found.")

                lib.users.delete_user_roles(
                    session=self.session,
                    user_id=user.get("id"),
                    role_id=role.get("id"),
                )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REVOKE ROLE from {target} executed successfully.",
                        "operation": self.current_operation,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to REVOKE REST role `{role_name}` from {target}. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def revokeRestPrivilege(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        role_name = mrs_object.get("role")
        privileges = mrs_object.get("privileges")
        any_service = mrs_object.get("any_service", False)
        if not any_service:
            specific_to_service_id = self.get_given_or_current_service_id(
                mrs_object, allow_not_set=False)
        else:
            specific_to_service_id = None

        url_context_root = mrs_object.get("url_context_root_pattern")
        if url_context_root is None:
            url_context_root = "*"
        schema_request_path = mrs_object.get("schema_request_path")
        if schema_request_path is None:
            schema_request_path = "*"
        object_request_path = mrs_object.get("object_request_path")
        if object_request_path is None:
            object_request_path = "*"

        with lib.core.MrsDbTransaction(self.session):
            try:
                role = lib.roles.get_role(
                    caption=role_name, session=self.session, specific_to_service_id=specific_to_service_id)
                if not role:
                    raise Exception(f"Role `{role_name}` was not found.")

                result = lib.roles.delete_role_privilege(
                    session=self.session,
                    role_id=role.get("id"),
                    privileges=privileges,
                    service_path=url_context_root,
                    schema_path=schema_request_path,
                    object_path=object_request_path,
                )
                if not result:
                    raise Exception(
                        f"There is no such grant for role {role_name}")

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"REVOKE from `{role_name}` executed successfully.",
                        "operation": self.current_operation,
                        "executionTime": timer.elapsed(),
                    }
                )
            except Exception as e:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "error",
                        "message": f"Failed to revoke privileges for REST role `{role_name}`. {e}",
                        "operation": self.current_operation,
                    }
                )
                raise

    def use(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            url_context_root = mrs_object.get("url_context_root")
            if url_context_root is not None:
                service = lib.services.get_service(
                    url_context_root=url_context_root,
                    url_host_name=mrs_object.get("url_host_name", ""),
                    developer_list=(
                        mrs_object.get("in_development").get("developers", [])
                        if "in_development" in mrs_object.keys()
                        else None
                    ),
                    session=self.session,
                )
                if service is not None:
                    self.current_service_id = service.get("id")
                    self.current_service = service.get("url_context_root")
                    self.current_service_host = mrs_object.get(
                        "url_host_name", "")
                    self.current_in_development = service.get("in_development")
                else:
                    raise Exception(
                        f"A REST SERVICE with the request path {url_context_root} could not be found."
                    )

            developers = (
                self.get_service_sorted_developers(
                    self.current_in_development.get("developers")
                )
                if self.current_in_development is not None
                else ""
            )

            if mrs_object.get("schema_request_path") is not None:
                if self.current_service_id is None:
                    raise Exception(f"No current REST SERVICE specified.")

                request_path = mrs_object.get("schema_request_path")
                schema = lib.schemas.get_schema(
                    service_id=self.current_service_id,
                    request_path=request_path,
                    session=self.session,
                )
                if schema is not None:
                    self.current_schema_id = schema.get("id")
                    self.current_schema = schema.get("request_path")
                else:
                    raise Exception(
                        f"A REST SCHEMA with the request path {request_path} could not be found."
                    )

                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": (
                            f"Now using REST SCHEMA `{self.current_schema}` "
                            f"on REST SERVICE `{developers}{self.current_service_host}{self.current_service}`."
                        ),
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(self.current_schema_id),
                        "executionTime": timer.elapsed(),
                    }
                )
            else:
                self.results.append(
                    {
                        "statementIndex": len(self.results) + 1,
                        "line": mrs_object.get("line"),
                        "type": "success",
                        "message": f"Now using REST SERVICE `{developers}{self.current_service_host}{self.current_service}`.",
                        "operation": self.current_operation,
                        "id": lib.core.convert_id_to_string(self.current_service_id),
                    }
                )

        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Cannot USE the specified REST object. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showRestMetadataStatus(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            result = [lib.general.get_status(session=self.session)]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Cannot SHOW the REST services. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showRestServices(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            services = lib.services.get_services(session=self.session)
            result = []
            for service in services:
                result.append(
                    {
                        "REST SERVICE Path": service.get("full_service_path"),
                        "enabled": lib.core.get_enabled_status_caption(service.get("enabled")),
                        "current": "YES" if (service.get("id") == self.current_service_id) else "NO",
                        "auth_apps": service.get("auth_apps", "")
                    }
                )

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Cannot SHOW the REST services. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showRestSchemas(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)

            schemas = lib.schemas.get_schemas(
                session=self.session, service_id=service_id
            )
            result = []
            for schema in schemas:
                result.append(
                    {
                        "REST schema path": schema.get("request_path"),
                        "enabled": lib.core.get_enabled_status_caption(schema.get("enabled")),
                    }
                )

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Cannot SHOW the REST schemas. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showRestDbObjects(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        object_types = mrs_object.pop("object_types")

        try:
            schema_id = self.get_given_or_current_schema_id(mrs_object)

            items = lib.db_objects.get_db_objects(
                session=self.session, schema_id=schema_id, object_types=object_types
            )
            result = []
            for item in items:
                result.append(
                    {
                        "REST DB Object": item.get("request_path"),
                        "enabled": lib.core.get_enabled_status_caption(item.get("enabled")),
                    }
                )

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Cannot SHOW the REST db objects. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showRestContentSets(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)

            content_sets = lib.content_sets.get_content_sets(
                session=self.session, service_id=service_id
            )
            result = []
            for content_set in content_sets:
                result.append(
                    {
                        "REST CONTENT SET path": content_set.get("request_path"),
                        "enabled": lib.core.get_enabled_status_caption(content_set.get("enabled")),
                    }
                )

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "message": f'OK, {len(content_sets)} record{"s" if len(content_sets) > 1 else ""} received.',
                    "operation": self.current_operation,
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Cannot SHOW the REST CONTENT SETs. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showRestContentFiles(self, mrs_object: dict):
        raise NotImplementedError()

    def showRestAuthApps(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            service_id = self.get_given_or_current_service_id(mrs_object, allow_not_set=True)

            auth_apps = lib.auth_apps.get_auth_apps(
                session=self.session, service_id=service_id
            )
            result = []
            for auth_app in auth_apps:
                result.append(
                    {
                        "REST AUTH APP name": auth_app.get("name"),
                        "vendor": auth_app.get("auth_vendor"),
                        "comments": auth_app.get("description"),
                        "enabled": lib.core.get_enabled_status_caption(auth_app.get("enabled")),
                    }
                )

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "message": f'OK, {len(auth_apps)} record{"s" if len(auth_apps) > 1 else ""} received.',
                    "operation": self.current_operation,
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Cannot SHOW the REST CONTENT SETs. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showRestRoles(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        user_name = mrs_object.get("user_name")
        auth_app_name = mrs_object.get("auth_app_name")
        any_service = mrs_object.get("any_service", False)

        show_users = False
        show_services = False
        try:
            service_id = self.get_given_or_current_service_id(
                mrs_object, allow_not_set=True)
            if not service_id:
                any_service = True

            if user_name is not None and auth_app_name is not None and not any_service:
                user = lib.users.get_user(
                    self.session,
                    user_name=user_name,
                    auth_app_name=auth_app_name,
                    service_id=service_id,
                )
                if not user:
                    raise Exception(f"User {lib.core.quote_user(user_name)}@{lib.core.quote_auth_app(auth_app_name)} not found")
                roles = lib.users.get_user_roles(
                    session=self.session, user_id=user.get("id")
                )
            elif user_name or auth_app_name:
                show_users = True
                show_services = True
                roles = lib.roles.get_granted_roles(
                    session=self.session,
                    specific_to_service_id=service_id if not any_service else None,
                    user_name=user_name,
                    auth_app_name=auth_app_name,
                    include_users=show_users,
                )
            else:
                show_services = True
                roles = lib.roles.get_roles(
                    session=self.session,
                    specific_to_service_id=service_id if not any_service else None,
                    include_global=True
                )

            result = []
            if user_name is not None and auth_app_name is not None:
                target = lib.core.quote_user(user_name) + "@" + lib.core.quote_auth_app(auth_app_name)

                column_names = [f"REST roles for {target}"]
                for role in roles:
                    result.append(
                        {
                            column_names[0]: role.get("caption"),
                            "comments": role.get("comments") or "",
                            "derived_from_role": role.get("derived_from_role_caption") or "",
                            "description": role.get("description") or "",
                            "options": role.get("options"),
                        }
                    )
                    if show_services:
                        result[-1]["specific_to_service"] = (
                            role.get("specific_to_service_request_path") or ""
                        )
            else:
                target = None
                if user_name:
                    column_names = [f"REST roles for {user_name}"]
                elif auth_app_name:
                    column_names = [f"REST roles for @{auth_app_name}"]
                else:
                    column_names = [f"REST role"]
                for role in roles:
                    result.append(
                        {
                            column_names[0]: role.get("caption"),
                            "derived_from_role": role.get("derived_from_role_caption")
                            or "",
                            "description": role.get("description") or "",
                            "options": role.get("options"),
                        }
                    )
                    if show_services:
                        result[-1]["specific_to_service"] = (
                            role.get("specific_to_service_request_path") or ""
                        )
                    if show_users:
                        result[-1]["users"] = role.get("users") or ""
            column_names += [
                "derived_from_role",
                "description",
                "options",
            ]
            if show_services:
                column_names.append("specific_to_service")
            if target:
                column_names.append("comments")
            if show_users:
                column_names.append("users")

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "message": f'OK, {len(roles)} record{"s" if len(roles) > 1 else ""} received.',
                    "operation": self.current_operation,
                    "result": result,
                    "columns": column_names,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Cannot SHOW REST ROLES. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showRestGrants(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        role_name = mrs_object.get("role")
        any_service = mrs_object.get("any_service", False)

        if not any_service:
            specific_to_service_id = self.get_given_or_current_service_id(
                mrs_object, allow_not_set=False)
        else:
            specific_to_service_id = None

        try:
            role = lib.roles.get_role(session=self.session, caption=role_name, specific_to_service_id=specific_to_service_id)
            if not role:
                raise Exception(f"No such role {role_name}")

            grants = lib.roles.get_role_privileges(
                session=self.session, role_id=role["id"]
            )
            result = []
            for grant in grants:
                result.append(
                    {
                        f"REST grants for {role.get('caption')}": lib.roles.format_role_grant_statement(
                            grant, role
                        )
                    }
                )

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Cannot SHOW REST GRANTs. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showRestUser(self, mrs_object: dict):
        raise NotImplementedError()

    def formatJsonSetting(self, setting_name, value: dict):
        if value is None or value == "":
            return ""

        js = json.dumps(value, indent=4)
        # Indent the json.dumps with 4 spaces
        js_indented = ""
        for ln in js.split("\n"):
            js_indented += f"    {ln}\n"
        return f"    {setting_name} {js_indented[4:-1]}\n"

    def showCreateRestService(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        include_database_endpoints = mrs_object.pop("include_database_endpoints", False)

        full_path = self.getFullServicePath(mrs_object=mrs_object)

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)

            service = lib.services.get_service(
                session=self.session, service_id=service_id
            )

            result = [{"CREATE REST SERVICE": lib.services.get_service_create_statement(self.session, service,
                    include_database_endpoints=include_database_endpoints,
                    include_static_endpoints=False,
                    include_dynamic_endpoints=False)}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(service_id),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to get the REST SERVICE `{full_path}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showCreateRestSchema(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        include_all_objects = mrs_object.pop("include_all_objects", False)

        full_path = self.getFullSchemaPath(mrs_object=mrs_object)

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)
            service = lib.services.get_service(
                session=self.session, service_id=service_id
            )
            if service is None:
                raise Exception(
                    f"The specified REST SERVICE {self.getFullServicePath(mrs_object=mrs_object)} could not be found."
                )

            schema_id = self.get_given_or_current_schema_id(mrs_object)
            schema = lib.schemas.get_schema(
                schema_id=schema_id,
                session=self.session,
            )
            if schema is None:
                raise Exception(
                    f"The given REST SCHEMA `{full_path}` could not be found."
                )

            if schema is None:
                raise Exception("The REST schema was not found.")

            result = [{"CREATE REST SCHEMA ": lib.schemas.get_schema_create_statement(self.session, schema, include_all_objects)}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(schema.get("id")),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to get the REST SCHEMA `{full_path}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showCreateRestDbObject(self, mrs_object: dict):
        timer = Timer()
        # Keep in sync with the function buildDataMappingViewSql implemented in
        # ../../frontend/src/modules/mrs/dialogs/MrsObjectFieldEditor.tsx

        self.current_operation = mrs_object.pop("current_operation")
        request_path = mrs_object.pop("request_path")
        rest_object_type = mrs_object.pop("type")

        full_path = self.getFullSchemaPath(
            mrs_object=mrs_object, request_path=request_path
        )

        try:
            schema_id = self.get_given_or_current_schema_id(mrs_object)

            db_object = lib.db_objects.get_db_object(
                session=self.session, schema_id=schema_id, request_path=request_path
            )
            if db_object is None:
                raise Exception(
                    f"The given REST {rest_object_type} `{full_path}` could not be found."
                )

            objects = lib.db_objects.get_objects(
                session=self.session, db_object_id=db_object.get("id")
            )
            if len(objects) == 0:
                raise Exception(
                    f"The given REST object `{full_path}` does not have a result definition defined."
                )

            if (
                rest_object_type == "PROCEDURE"
                and db_object.get("object_type") != "PROCEDURE"
            ):
                raise Exception(
                    f"The given REST object `{full_path}` is not a REST PROCEDURE."
                )
            if (
                rest_object_type == "FUNCTION"
                and db_object.get("object_type") != "FUNCTION"
            ):
                raise Exception(
                    f"The given REST object `{full_path}` is not a REST FUNCTION."
                )
            if (
                rest_object_type == "VIEW"
                and db_object.get("object_type") != "TABLE"
                and db_object.get("object_type") != "VIEW"
            ):
                raise Exception(
                    f"The given REST object `{full_path}` is not a REST VIEW."
                )

            result = [{f"CREATE REST {rest_object_type}": lib.db_objects.get_db_object_create_statement(self.session, db_object, objects)}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(db_object["id"]),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to get the REST {rest_object_type} `{full_path}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showCreateRestContentSet(self, mrs_object: dict):
        timer = Timer()
        try:
            result = [{"CREATE REST CONTENT SET": lib.content_sets.get_content_set_create_statement(self.session, mrs_object, False)}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(mrs_object["id"]),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f'Failed to get the REST CONTENT SET `{mrs_object.get("request_path")}`. {e}',
                    "operation": self.current_operation,
                }
            )
            raise

    def showCreateRestContentFile(self, mrs_object: dict):
        timer = Timer()
        try:
            content_file = lib.content_files.get_content_file(
                self.session,
                content_set_id=mrs_object["content_set_id"],
                request_path=mrs_object["request_path"],
                include_file_content=True,
            )

            result = [{"CREATE REST CONTENT FILE": lib.content_files.get_content_file_create_statement(self.session, content_file)}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(content_file["id"]),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "line": mrs_object.get("line"),
                "type": "error",
                "message": f'Failed to get the REST CONTENT SET `{mrs_object.get("request_path")}`. {e}',
                "operation": self.current_operation,
            })
            raise

    def showCreateRestAuthApp(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        name = mrs_object.get("name")
        include_all_objects = mrs_object.pop("include_all_objects", None)

        try:
            auth_app = lib.auth_apps.get_auth_app(
                name=name, session=self.session
            )
            if auth_app is None:
                raise Exception(
                    f"The given REST AUTH APP `{name}` could not be found."
                )

            result = [{"CREATE REST AUTH APP ": lib.auth_apps.get_auth_app_create_statement(self.session, auth_app, include_all_objects)}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(auth_app.get("id")),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )
        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to get the REST AUTH APP `{name}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showCreateRestUser(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        user_name = mrs_object.get("name")
        auth_app_name = mrs_object.get("auth_app_name")
        full_user_name = f'{lib.core.quote_user(user_name)}@{lib.core.quote_auth_app(auth_app_name)}'

        try:
            user = lib.users.get_user(
                self.session,
                user_name=user_name,
                auth_app_name=auth_app_name,
            )
            if not user:
                raise Exception(f"User `{full_user_name}` was not found.")

            result = [{"CREATE REST USER ": lib.users.get_user_create_statement(self.session, user, False)}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(user.get("id")),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )

        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to get the REST USER `{full_user_name}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def showCreateRestRole(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        role_name = mrs_object.get("name", "")
        any_service = mrs_object.get("any_service", False)
        if not any_service:
            specific_to_service_id = self.get_given_or_current_service_id(
                mrs_object, allow_not_set=False)
        else:
            specific_to_service_id = None

        try:
            with lib.core.MrsDbTransaction(self.session):
                role = lib.roles.get_role(
                    caption=role_name,
                    session=self.session,
                    specific_to_service_id=specific_to_service_id
                )
                if not role:
                    raise Exception(f"Role `{role_name}` was not found.")

            result = [{"CREATE REST ROLE ": lib.roles.get_role_create_statement(self.session, role)}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(role.get("id")),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )

        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to get the REST ROLE `{role_name}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def dumpRestService(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        include_database_endpoints = mrs_object["include_database_endpoints"]
        include_static_endpoints = mrs_object["include_static_endpoints"]
        include_dynamic_endpoints = mrs_object["include_dynamic_endpoints"]


        try:
            service = lib.services.get_service(self.session, url_context_root=mrs_object["url_context_root"])

            lib.services.store_service_create_statement(self.session, service,
                                                        mrs_object.get("directory_file_path"), mrs_object.get("zip", False),
                                                        include_database_endpoints, include_static_endpoints, include_dynamic_endpoints)

            result = [{"DUMP REST SERVICE ": f"Result stored in '{mrs_object["directory_file_path"]}'"}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(service.get("id")),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )

        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to execute DUMP REST SERVICE `{service.get("name", "unknown")}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise

    def dumpRestProject(self, mrs_object: dict):
        timer = Timer()

        self.current_operation: str = mrs_object.pop("current_operation")
        project_name: str = mrs_object.get("project_name")
        version: str = mrs_object.get("version")
        destination: str = mrs_object.get("directory_file_path")
        create_zip: bool = mrs_object.get("zip", False)

        services: list = mrs_object.get("services")
        schemas: list = mrs_object.get("schemas")

        icon_path: str | None = mrs_object.get("icon_file_path")
        description: str | None = mrs_object.get("description")
        publisher: str | None = mrs_object.get("publisher")

        try:
            project_settings = {
                "name": project_name,
                "icon_path": icon_path,
                "description": description,
                "publisher": publisher,
                "version": version
            }
            lib.core.validate_path_for_filesystem(destination)
            lib.services.store_project_validations(self.session,
                                       destination=destination,
                                       services=services,
                                       schemas=schemas,
                                       project_settings=project_settings,
                                       create_zip=create_zip)
            lib.services.store_project(self.session,
                                       destination=destination,
                                       services=services,
                                       schemas=schemas,
                                       project_settings=project_settings,
                                       create_zip=create_zip)

            result = [{"DUMP REST PROJECT ": f"Result stored in '{mrs_object["directory_file_path"]}'"}]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    "id": project_name,
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )

        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to execute DUMP REST PROJECT `{project_name}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise


    def loadRestService(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        new_request_path = mrs_object.pop("request_path")
        file_path = mrs_object["directory_file_path"]
        try:
            if new_request_path:
                MrsDdlExecutor.service_request_path_override = new_request_path

            if not os.path.isfile(file_path):
                raise Exception("The specified file was not found.")

            lib.services.load_service(self.session, file_path)

            result = [
                {
                    "LOAD REST SERVICE ": f"Service '{new_request_path}' loaded from '{file_path}'"
                }
            ]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    # "id": lib.core.convert_id_to_string(service.get("id")),
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )

        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to execute LOAD REST SERVICE from `{mrs_object["directory_file_path"]}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise
        finally:
            MrsDdlExecutor.service_request_path_override = None

    def loadRestProject(self, mrs_object: dict):
        timer = Timer()

        self.current_operation: str = mrs_object.pop("current_operation")
        path: str = mrs_object.get("directory_file_path")
        from_zip: bool = mrs_object.get("zip", False)
        from_url: bool = mrs_object.get("url", False)

        try:
            lib.services.load_project(self.session, path)

            result = [
                {
                    "LOAD REST PROJECT ": f"Project loaded from '{mrs_object["directory_file_path"]}'"
                }
            ]

            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "success",
                    "operation": self.current_operation,
                    # "id": project_name,
                    "result": result,
                    "executionTime": timer.elapsed(),
                }
            )

        except Exception as e:
            self.results.append(
                {
                    "statementIndex": len(self.results) + 1,
                    "line": mrs_object.get("line"),
                    "type": "error",
                    "message": f"Failed to execute LOAD REST PROJECT from `{mrs_object["directory_file_path"]}`. {e}",
                    "operation": self.current_operation,
                }
            )
            raise
