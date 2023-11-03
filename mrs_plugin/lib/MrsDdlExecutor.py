# Copyright (c) 2023, Oracle and/or its affiliates.
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

import mrs_plugin.lib as lib
from mrs_plugin.lib.MrsDdlExecutorInterface import MrsDdlExecutorInterface
import json
from datetime import datetime


def cutLastComma(fields):
    # Cut the last , away if present
    if fields.endswith(",\n"):
        return fields[:-2]

    # Otherwise, just cut the last \n
    return fields[:-1]


def walk(fields, parent_id=None, level=1, add_data_type=False, current_object=None):
    result = ""
    filtered_fields = list(filter(lambda f: f.get(
        "reduceToValueOfFieldId", {}).get("reduce_to_value_of_field_id"), fields))
    reduce_to_field_ids = [f.get("reduceToValueOfFieldId", {}).get(
        "reduce_to_value_of_field_id", "") for f in filtered_fields]

    indent = " " * level * 4

    for field in fields:
        if field.get("parent_reference_id") != parent_id:
            continue

        if not field.get("object_reference") and (field["enabled"] or field["id"] in reduce_to_field_ids):
            attributes = []
            inout = f'@{"IN" if field["db_column"].get("in") else ""}{"OUT" if field["db_column"].get("out") else ""}'
            inout != "@" and attributes.append(inout)
            field.get("no_check") and attributes.append("@NOCHECK")
            field.get("no_update") and attributes.append("@NOUPDATE")
            field.get("allow_sorting") and attributes.append("@SORTABLE")
            not field.get("allow_filtering") and attributes.append(
                "@NOFILTERING")
            add_data_type and field["db_column"] and field["db_column"]["datatype"] and \
                attributes.append(
                    f'@DATATYPE("{field["db_column"]["datatype"]}")')

            field["db_column"].get("name") == current_object.get("row_user_ownership_column") and \
                current_object.get("row_user_ownership_enforced") and \
                attributes.append("@ROWOWNERSHIP")

            result += f"{indent}{field['name']}: {field['db_column']['name']}"
            if attributes:
                result = f"{result} {' '.join(attributes)}"
            result = f"{result},\n"
        elif field.get("object_reference") and field["object_reference"].get("unnest") or field["enabled"]:
            ref_table = f'{field["object_reference"]["reference_mapping"]["referenced_schema"]}.{field["object_reference"]["reference_mapping"]["referenced_table"]}'

            attributes = []
            "CREATE" in field["object_reference"]["crud_operations"] and attributes.append(
                "@INSERT")
            "UPDATE" in field["object_reference"]["crud_operations"] and attributes.append(
                "@UPDATE")
            "DELETE" in field["object_reference"]["crud_operations"] and attributes.append(
                "@DELETE")
            if field["object_reference"]["unnest"] or field["object_reference"].get("reduce_to_value_of_field_id"):
                attributes.append("@UNNEST")

            children = cutLastComma(walk(fields=fields, parent_id=field["represents_reference_id"],
                                         level=level + 1, add_data_type=add_data_type, current_object=current_object))

            result = f'{result}{indent}{field["name"]}: {ref_table}'

            if attributes:
                result = f'{result} {" ".join(attributes)}'

            if children:
                result = f"{result} {{\n{children}\n{indent}}}\n"

    return result


class Timer(object):
    def __init__(self) -> None:
        self.start = datetime.now()

    def elapsed(self):
        return (datetime.now() - self.start).total_seconds()


class MrsDdlExecutor(MrsDdlExecutorInterface):

    def __init__(self, session,
                 current_service_id=None, current_service=None,
                 current_service_host=None,
                 current_schema_id=None, current_schema=None,
                 state_data={}):
        self.state_data = state_data
        self.session = session
        self.results = []

        # Updates the values of the provided parameters only if they are not None,
        # this is done to avoid overriding values that are cached in the Session
        if current_service_id is not None:
            self.current_service_id = current_service_id

        if current_service is not None:
            self.current_service = current_service

        if current_service_host is not None:
            self.current_service_host = current_service_host

        if current_schema_id is not None:
            self.current_schema_id = current_schema_id

        if current_schema is not None:
            self.current_schema = current_schema

        self.current_operation = None

    def lookup_current_service(self):
        if self.state_data.get('current_service_id') is None and self.session is not None:
            service = lib.services.get_current_service(self.session)
            if service is not None:
                self.state_data['current_service_id'] = service.get("id")
                self.state_data['current_service'] = service.get("host_ctx")

    @property
    def current_service_id(self):
        self.lookup_current_service()
        return self.state_data.get('current_service_id')

    @current_service_id.setter
    def current_service_id(self, value):
        self.state_data['current_service_id'] = value

    @property
    def current_schema_id(self):
        return self.state_data.get('current_schema_id')

    @current_schema_id.setter
    def current_schema_id(self, value):
        self.state_data['current_schema_id'] = value

    @property
    def current_service(self):
        self.lookup_current_service()
        return self.state_data.get('current_service')

    @current_service.setter
    def current_service(self, value):
        self.state_data['current_service'] = value

    @property
    def current_service_host(self):
        return self.state_data.get('current_service_host')

    @current_service_host.setter
    def current_service_host(self, value):
        self.state_data['current_service_host'] = value

    @property
    def current_schema(self):
        return self.state_data.get('current_schema')

    @current_schema.setter
    def current_schema(self, value):
        self.state_data['current_schema'] = value

    # Check if the current mrs_object includes a services request_path or if a
    # current service has been set via USE REST SERVICE
    def get_given_or_current_service_id(self, mrs_object):
        service_id = None

        # Prefer the given service if specified
        url_context_root = mrs_object.get("url_context_root")

        if url_context_root is None and self.current_service_id is not None:
            service_id = self.current_service_id
            mrs_object["url_context_root"] = self.current_service
            mrs_object["url_host_name"] = self.current_service_host
        elif url_context_root is not None:
            url_host_name = mrs_object.get("url_host_name", "")
            service = lib.services.get_service(
                url_context_root=url_context_root,
                url_host_name=url_host_name,
                session=self.session,
                get_default=False)
            if service is None:
                raise Exception(
                    f"Could not find the REST SERVICE {url_host_name}{url_context_root}.")

            service_id = service.get("id")

        return service_id

    # Check if the current mrs_object includes a schema request_path or if a
    # current schema has been set via USE REST SCHEMA
    def get_given_or_current_schema_id(self, mrs_object):
        schema_id = None

        schema_request_path = mrs_object.get("schema_request_path")
        if schema_request_path is None and self.current_schema_id is not None:
            schema_id = self.current_schema_id
            mrs_object["schema_request_path"] = self.current_schema
            mrs_object["url_context_root"] = self.current_service
            mrs_object["url_host_name"] = self.current_service_host
        elif schema_request_path is not None:
            service_id = self.get_given_or_current_service_id(mrs_object)
            schema = lib.schemas.get_schema(
                service_id=service_id,
                request_path=schema_request_path,
                session=self.session)
            if schema is None:
                full_path = (
                    mrs_object.get("url_host_name", "") +
                    mrs_object.get("url_context_root", "") +
                    schema_request_path)
                raise Exception(f"Could not find the REST SCHEMA {full_path}.")

            schema_id = schema.get("id")

        return schema_id

    def getFullServicePath(self, mrs_object, request_path=""):
        return (
            mrs_object.get("url_host_name",
                           self.current_service_host if self.current_service_host is not None else "") +
            mrs_object.get("url_context_root",
                           self.current_service if self.current_service is not None else "") +
            request_path
        )

    def getFullSchemaPath(self, mrs_object, request_path=""):
        return (
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
                update_if_available=mrs_object.get("update_if_available"))

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "message": f"REST metadata updated successfully." if (
                    status.get("schema_changed", False) is True
                ) else f"REST Metadata configured successfully.",
                "operation": self.current_operation,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f"Failed to configure the REST metadata. {e}",
                "operation": self.current_operation
            })
            raise

    def createRestService(self, mrs_object):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace")
        context_root = mrs_object.get("url_context_root", "")
        url_host_name = mrs_object.pop("url_host_name", "")
        full_path = f'{url_host_name}{context_root}'

        with lib.core.MrsDbTransaction(self.session):
            try:
                # If the OR REPLACE was specified, check if there is an existing service on the same host
                # with the same path and delete it.
                if do_replace is True:
                    service = lib.services.get_service(
                        url_context_root=context_root,
                        url_host_name=url_host_name,
                        get_default=False, session=self.session)
                    if service is not None:
                        lib.services.delete_service(
                            service_id=service.get("id"), session=self.session)

                # Add the service
                service_id = lib.services.add_service(
                    session=self.session,
                    url_host_name=url_host_name,
                    service=mrs_object)

                # If this is the first service, make it the current one
                services = lib.services.get_services(session=self.session)
                if len(services) == 1:
                    self.current_service_id = service_id
                    self.current_service = context_root
                    self.current_service_host = url_host_name
                    # Also set the stored current session
                    lib.services.set_current_service_id(
                        session=self.session, service_id=self.current_service_id)

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f"REST SERVICE `{full_path}` created successfully.",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(service_id),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f"Failed to create the REST SERVICE `{full_path}`. {e}",
                    "operation": self.current_operation
                })
                raise

    def createRestSchema(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace")

        schema_request_path = mrs_object.get("schema_request_path")
        full_path = self.getFullSchemaPath(mrs_object=mrs_object)

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)
                if service_id is None:
                    raise Exception("No REST SERVICE specified.")

                # If the OR REPLACE was specified, check if there is an existing schema on the same service
                # and delete it.
                if do_replace == True:
                    schema = lib.schemas.get_schema(
                        service_id=service_id,
                        request_path=mrs_object.get("request_path"),
                        session=self.session)
                    if schema is not None:
                        lib.schemas.delete_schema(
                            schema_id=schema.get("id"), session=self.session)

                schema_id = lib.schemas.add_schema(
                    schema_name=mrs_object.get("schema_name"),
                    service_id=service_id,
                    request_path=schema_request_path,
                    requires_auth=mrs_object.get("requires_auth"),
                    enabled=mrs_object.get("enabled", 1),
                    items_per_page=mrs_object.get("items_per_page"),
                    comments=mrs_object.get("comments"),
                    options=mrs_object.get("options"),
                    session=self.session)

                # If this is the first schema of the REST service, make it the current one
                schemas = lib.schemas.get_schemas(
                    session=self.session,
                    service_id=service_id)
                if len(schemas) == 1:
                    self.current_schema_id = schema_id
                    self.current_schema = schema_request_path

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f"REST SCHEMA `{full_path}` created successfully.",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(schema_id),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f"Failed to create the REST SCHEMA `{full_path}`. {e}",
                    "operation": self.current_operation
                })
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
                if mrs_object.get("db_object_type") == "PROCEDURE" or mrs_object.get("db_object_type") == "FUNCTION":
                    if obj["kind"] == "PARAMETERS":
                        obj["name"] = obj["name"] + "Params"
                    if i > 1:
                        if numeric_post_fix < i:
                            numeric_post_fix = i
                        obj["name"] = lib.core.convert_path_to_pascal_case(
                            full_path + str(numeric_post_fix))

                # If the object name is not unique for this schema, keep increasing a numeric_post_fix
                name_unique = False
                while not name_unique:
                    try:
                        if obj["name"] in assigned_names:
                            raise Exception("Object name already used.")
                        lib.core.check_mrs_object_name(
                            session=self.session, db_schema_id=schema_id, obj_id=obj["id"], obj_name=obj["name"])

                        name_unique = True
                        assigned_names.append(obj["name"])
                    except:
                        obj["name"] = lib.core.convert_path_to_pascal_case(
                            full_path + str(numeric_post_fix))
                        numeric_post_fix += 1

    def createRestDbObject(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace")

        full_path = self.getFullSchemaPath(
            mrs_object=mrs_object, request_path=mrs_object.get("request_path"))

        db_object_type = mrs_object.get("db_object_type")
        type_caption = "DUALITY VIEW" if db_object_type == "TABLE" or db_object_type == "VIEW" else db_object_type

        with lib.core.MrsDbTransaction(self.session):
            try:
                schema_id = self.get_given_or_current_schema_id(mrs_object)
                if schema_id is None:
                    raise Exception("No REST SCHEMA specified.")

                self.fill_object_names_if_not_given(
                    mrs_object=mrs_object, schema_id=schema_id,
                    full_path=full_path)

                # If the OR REPLACE was specified, check if there is an existing db_object on the same schema
                # and delete it.
                if do_replace is True:
                    db_object = lib.db_objects.get_db_object(
                        schema_id=schema_id,
                        request_path=mrs_object.get("request_path"),
                        session=self.session)
                    if db_object is not None:
                        lib.db_objects.delete_db_object(
                            db_object_id=db_object.get("id"), session=self.session)

                db_object_id, grants = lib.db_objects.add_db_object(
                    session=self.session,
                    schema_id=lib.core.id_to_binary(schema_id, "schema_id"),
                    db_object_name=mrs_object.get("name"),
                    request_path=mrs_object.get("request_path"),
                    db_object_type=mrs_object.get("db_object_type"),
                    enabled=mrs_object.get("enabled", True),
                    items_per_page=mrs_object.get("items_per_page"),
                    requires_auth=mrs_object.get("requires_auth", 0),
                    row_user_ownership_enforced=mrs_object.get(
                        "row_user_ownership_enforced"),
                    row_user_ownership_column=mrs_object.get(
                        "row_user_ownership_column"),
                    crud_operations=mrs_object.get("crud_operations"),
                    crud_operation_format=mrs_object.get("format", "FEED"),
                    comments=mrs_object.get("comments"),
                    media_type=mrs_object.get("media_type"),
                    auto_detect_media_type=mrs_object.get(
                        "media_type_autodetect", False),
                    auth_stored_procedure=mrs_object.get(
                        "auth_stored_procedure"),
                    options=mrs_object.get("options"),
                    db_object_id=lib.core.id_to_binary(
                        mrs_object.get("id"), "db_object_id"),
                    objects=mrs_object.get("objects"))

                for grant in grants:
                    lib.core.MrsDbExec(grant).exec(self.session)

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f"REST {type_caption} `{full_path}` created successfully.",
                    "operation": self.current_operation,
                    "id": db_object_id,
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f"Failed to create the REST {type_caption} `{full_path}`. {e}",
                    "operation": self.current_operation
                })
                raise

    def createRestContentSet(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace")

        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=mrs_object.get("request_path"))

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)
                if service_id is None:
                    raise Exception("No REST SERVICE specified.")

                # If the OR REPLACE was specified, check if there is an existing content set on the same service
                # and delete it.
                if do_replace == True:
                    content_set = lib.content_sets.get_content_set(
                        service_id=service_id,
                        request_path=mrs_object.get("request_path"),
                        session=self.session)
                    if content_set is not None:
                        lib.content_sets.delete_content_set(
                            content_set_ids=[content_set.get("id")], session=self.session)

                content_set_id = lib.content_sets.add_content_set(
                    session=self.session,
                    service_id=service_id,
                    request_path=mrs_object.get("request_path"),
                    requires_auth=mrs_object.get("requires_auth", 1),
                    comments=mrs_object.get("comments"),
                    options=mrs_object.get("options"),
                    enabled=mrs_object.get("enabled", 1)
                )

                file_list = lib.content_files.add_content_dir(
                    session=self.session, content_set_id=content_set_id,
                    content_dir=mrs_object.get("directory_file_path"),
                    requires_auth=mrs_object.get("requires_auth", True))

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f"REST CONTENT SET `{full_path}` created successfully. {len(file_list)} file(s) added.",
                    "operation": self.current_operation,
                    "id": content_set_id,
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f"Failed to create the REST CONTENT SET `{full_path}`. {e}",
                    "operation": self.current_operation
                })
                raise

    def createRestAuthApp(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace")

        name = mrs_object.get("name")
        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=f":{name}")

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)
                if service_id is None:
                    raise Exception("No REST SERVICE specified.")

                # If the OR REPLACE was specified, check if there is an existing content set on the same service
                # and delete it.
                if do_replace == True:
                    auth_app = lib.auth_apps.get_auth_app(
                        service_id=service_id,
                        name=name,
                        session=self.session)
                    if auth_app is not None:
                        lib.auth_apps.delete_auth_app(
                            app_id=auth_app.get("id"), session=self.session)

                # TODO: Lookup default role by name
                if mrs_object.get("default_role"):
                    role = lib.roles.get_role(
                        session=self.session,
                        caption=mrs_object.get("default_role"),
                        service_id=service_id)
                    if role is None:
                        raise Exception(
                            f'Given role "{mrs_object.get("default_role")}" not found.')
                    default_role_id = role.get("id")
                else:
                    default_role_id = lib.core.id_to_binary(
                        "0x31000000000000000000000000000000", "")

                auth_vendor = lib.auth_apps.get_auth_vendor(
                    session=self.session,
                    name=mrs_object.get("vendor")
                )
                if auth_vendor is None:
                    raise Exception(
                        f'The vendor `{mrs_object.get("vendor")}` was not found.')

                auth_app_id = lib.auth_apps.add_auth_app(
                    session=self.session,
                    service_id=service_id,
                    auth_vendor_id=auth_vendor["id"],
                    app_name=name,
                    description=mrs_object.get("comments"),
                    url=mrs_object.get("url"),
                    url_direct_auth=mrs_object.get("url_direct_auth"),
                    access_token=mrs_object.get("access_token"),
                    app_id=mrs_object.get("app_id"),
                    limit_to_reg_users=mrs_object.get(
                        "limit_to_registered_users", 1),
                    default_role_id=default_role_id,
                    enabled=mrs_object.get("enabled", 1)
                )

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f"REST AUTH APP `{full_path}` created successfully.",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(auth_app_id),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f"Failed to create the REST CONTENT SET `{full_path}`. {e}",
                    "operation": self.current_operation
                })
                raise

    def createRestUser(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        do_replace = mrs_object.pop("do_replace")

        name = mrs_object.get("name")
        authAppName = mrs_object.get("authAppName")
        password = mrs_object.get("password")
        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=f':"{name}"@"{authAppName}"')

        with lib.core.MrsDbTransaction(self.session):
            try:
                if password == "":
                    raise Exception("The password must not be empty.")

                service_id = self.get_given_or_current_service_id(mrs_object)
                if service_id is None:
                    raise Exception("No REST SERVICE specified.")

                auth_app = lib.auth_apps.get_auth_app(
                    service_id=service_id,
                    name=authAppName,
                    session=self.session)
                if auth_app is None:
                    raise Exception(
                        f"The given REST AUTH APP for {full_path} was not found.")

                # If the OR REPLACE was specified, check if there is an existing content set on the same service
                # and delete it.
                if do_replace == True:
                    users = lib.users.get_users(
                        auth_app_id=auth_app.get("id"),
                        user_name=name,
                        session=self.session)
                    if len(users) > 0:
                        lib.users.delete_user_by_id(
                            user_id=users[0].get("id"), session=self.session)

                user_id = lib.users.add_user(
                    session=self.session,
                    auth_app_id=auth_app["id"],
                    name=name,
                    email=None,
                    vendor_user_id=None,
                    login_permitted=int(True),
                    mapped_user_id=None,
                    app_options=None,
                    auth_string=password
                )

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f"REST USER `{full_path}` created successfully.",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(user_id),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f"Failed to create the REST USER `{full_path}`. {e}",
                    "operation": self.current_operation
                })
                raise

    def alterRestService(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        full_path = self.getFullServicePath(mrs_object)

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)
            if service_id is None:
                raise Exception("No REST SERVICE specified.")

            # If a new url_context_root / url_host_name was given,
            # overwrite the existing values in the mrs_object
            # so they are set during the update
            new_url_context_root = mrs_object.pop("new_url_context_root", None)
            new_url_host_name = mrs_object.pop("new_url_host_name", None)
            if new_url_context_root is not None:
                if new_url_host_name is None:
                    new_url_host_name = ""
                mrs_object["url_context_root"] = new_url_context_root
                mrs_object["url_host_name"] = new_url_host_name

            lib.services.update_services(
                session=self.session,
                service_ids=[service_id],
                value=mrs_object)

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "affectedItemsCount": 1,
                "operation": self.current_operation,
                "id": lib.core.convert_id_to_string(service_id),
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f"Failed to update the REST SERVICE `{full_path}`. {e}",
                "operation": self.current_operation
            })
            raise

    def alterRestSchema(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        full_path = self.getFullSchemaPath(mrs_object=mrs_object)

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)
            if service_id is None:
                raise Exception("No REST SERVICE specified.")

            schema = lib.schemas.get_schema(
                service_id=service_id,
                request_path=mrs_object.get("schema_request_path"),
                session=self.session)

            if schema is None:
                raise Exception("The REST schema was not found.")

            lib.schemas.update_schema(
                session=self.session,
                schemas={schema["id"]: ""},
                value={
                    "service_id": mrs_object.get("new_service_id", schema["service_id"]),
                    "request_path": mrs_object.get("new_request_path", schema["request_path"]),
                    "requires_auth": mrs_object.get("requires_auth", schema["requires_auth"]),
                    "enabled": mrs_object.get("enabled", schema["enabled"]),
                    "items_per_page": mrs_object.get("items_per_page", schema["items_per_page"]),
                    "comments": mrs_object.get("comments", schema["comments"]),
                    "options": mrs_object.get("options", schema["options"]),
                })

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "affectedItemsCount": 1,
                "operation": self.current_operation,
                "id": lib.core.convert_id_to_string(service_id),
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f"Failed to update the REST SCHEMA `{full_path}`. {e}",
                "operation": self.current_operation
            })
            raise

    def alterRestDbObject(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        request_path = mrs_object.pop("request_path")
        rest_object_type = mrs_object.pop("type")
        db_object_id = mrs_object.pop("id")

        full_path = self.getFullSchemaPath(
            mrs_object=mrs_object, request_path=request_path)

        # Remove non-standard mrs_object keys so it can be directly passed to the alter function
        mrs_object.pop("url_host_name", "")
        mrs_object.pop("parent_reference_stack", "")
        mrs_object.pop("url_context_root", "")
        mrs_object.pop("schema_request_path", "")

        try:
            db_object = lib.db_objects.get_db_object(
                session=self.session, db_object_id=db_object_id)
            if db_object is None:
                raise Exception(
                    f'The given REST {rest_object_type} `{full_path}` could not be found.')

            self.fill_object_names_if_not_given(
                mrs_object=mrs_object, schema_id=db_object["db_schema_id"],
                full_path=full_path)

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
                    value=mrs_object)

            if objects:
                lib.db_objects.set_objects(session=self.session,
                                           db_object_id=db_object["id"], objects=objects)

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "affectedItemsCount": 1,
                "operation": self.current_operation,
                "id": lib.core.convert_id_to_string(db_object["id"]),
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f'Failed to get the REST {rest_object_type} `{full_path}`. {e}',
                "operation": self.current_operation
            })
            raise

    def dropRestService(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        full_path = self.getFullServicePath(mrs_object=mrs_object)

        with lib.core.MrsDbTransaction(self.session):
            try:
                service = lib.services.get_service(
                    url_context_root=mrs_object.get("url_context_root"),
                    url_host_name=mrs_object.get("url_host_name", ""),
                    session=self.session)
                if service is None:
                    raise Exception(
                        f'The given REST SERVICE `{full_path}` could not be found.')

                lib.services.delete_service(
                    service_id=service["id"],
                    session=self.session)

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f'REST SERVICE `{full_path}` dropped successfully.',
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(service["id"]),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f'Failed to drop the REST SERVICE `{full_path}`. {e}',
                    "operation": self.current_operation
                })
                raise

    def dropRestSchema(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=mrs_object.get("request_path", ""))

        with lib.core.MrsDbTransaction(self.session):
            try:

                service_id = self.get_given_or_current_service_id(mrs_object)
                if service_id is None:
                    raise Exception("No REST SERVICE specified.")

                schema = lib.schemas.get_schema(
                    service_id=service_id, request_path=mrs_object["request_path"],
                    session=self.session)
                if schema is None:
                    raise Exception(
                        f'The given REST SCHEMA `{full_path}` could not be found.')

                lib.schemas.delete_schema(
                    schema_id=schema["id"], session=self.session)

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f'REST SCHEMA `{full_path}` dropped successfully.',
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(schema["id"]),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f'Failed to drop the REST SCHEMA `{full_path}`. {e}',
                    "operation": self.current_operation
                })
                raise

    def dropRestDbObject(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        request_path = mrs_object.pop("request_path")
        rest_object_type = mrs_object.pop("type")

        full_path = self.getFullSchemaPath(
            mrs_object=mrs_object, request_path=request_path)

        with lib.core.MrsDbTransaction(self.session):
            try:
                schema_id = self.get_given_or_current_schema_id(mrs_object)
                if schema_id is None:
                    raise Exception("No REST SCHEMA specified.")

                db_object = lib.db_objects.get_db_object(
                    session=self.session, schema_id=schema_id,
                    request_path=request_path)
                if db_object is None:
                    raise Exception(
                        f'The given REST {rest_object_type} `{full_path}` could not be found.')

                lib.db_objects.delete_db_object(
                    session=self.session, db_object_id=db_object.get("id"))

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f'REST {rest_object_type} `{full_path}` dropped successfully.',
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(db_object["id"]),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f'Failed to drop the REST {rest_object_type} `{full_path}`. {e}',
                    "operation": self.current_operation
                })
                raise

    def dropRestContentSet(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        request_path = mrs_object.get("request_path")

        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=request_path)

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)
                if service_id is None:
                    raise Exception("No REST service specified.")

                content_set = lib.content_sets.get_content_set(
                    service_id=service_id, request_path=request_path,
                    session=self.session)
                if content_set is None:
                    raise Exception(
                        f'The given REST CONTENT SET `{full_path}` could not be found.')

                lib.content_sets.delete_content_set(
                    content_set_ids=[content_set["id"]], session=self.session)

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f'REST CONTENT SET `{full_path}` dropped successfully.',
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(content_set["id"]),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f'Failed to drop the REST CONTENT SET `{full_path}`. {e}',
                    "operation": self.current_operation
                })
                raise

    def dropRestAuthApp(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        name = mrs_object.get("name")

        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=f':{name}')

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)
                if service_id is None:
                    raise Exception("No REST service specified.")

                auth_app = lib.auth_apps.get_auth_app(
                    service_id=service_id,
                    name=name,
                    session=self.session)
                if auth_app is None:
                    raise Exception(
                        f'The given REST AUTH APP `{full_path}` could not be found.')

                lib.auth_apps.delete_auth_app(
                    app_id=auth_app.get("id"), session=self.session)

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f'REST AUTH APP `{full_path}` dropped successfully.',
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(auth_app["id"]),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f'Failed to drop the REST AUTH APP `{full_path}`. {e}',
                    "operation": self.current_operation
                })
                raise

    def dropRestUser(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        name = mrs_object.get("name")
        authAppName = mrs_object.get("authAppName")
        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=f':"{name}"@"{authAppName}"')

        with lib.core.MrsDbTransaction(self.session):
            try:
                service_id = self.get_given_or_current_service_id(mrs_object)
                if service_id is None:
                    raise Exception("No REST SERVICE specified.")

                auth_app = lib.auth_apps.get_auth_app(
                    service_id=service_id,
                    name=authAppName,
                    session=self.session)
                if auth_app is None:
                    raise Exception(
                        f"The given REST AUTH APP for {full_path} was not found.")

                users = lib.users.get_users(
                    auth_app_id=auth_app.get("id"),
                    user_name=name,
                    session=self.session)
                if len(users) > 0:
                    lib.users.delete_user_by_id(
                        user_id=users[0].get("id"), session=self.session)
                else:
                    raise Exception("User was not found.")

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f"REST USER `{full_path}` dropped successfully.",
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(users[0].get("id")),
                    "executionTime": timer.elapsed()
                })
            except Exception as e:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "error",
                    "message": f"Failed to drop the REST USER `{full_path}`. {e}",
                    "operation": self.current_operation
                })
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
                    session=self.session)
                if service is not None:
                    self.current_service_id = service.get("id")
                    self.current_service = service.get("url_context_root")
                    self.current_service_host = mrs_object.get(
                        "url_host_name", "")
                    # Also set the stored current session
                    lib.services.set_current_service_id(
                        session=self.session, service_id=self.current_service_id)
                else:
                    raise Exception(
                        f"A REST SERVICE with the request path {url_context_root} could not be found.")

            if mrs_object.get("schema_request_path") is not None:
                if self.current_service_id is None:
                    raise Exception(
                        f"No current REST SERVICE specified.")

                request_path = mrs_object.get("schema_request_path")
                schema = lib.schemas.get_schema(
                    service_id=self.current_service_id,
                    request_path=request_path,
                    session=self.session)
                if schema is not None:
                    self.current_schema_id = schema.get("id")
                    self.current_schema = schema.get("request_path")
                else:
                    raise Exception(
                        f"A REST SCHEMA with the request path {request_path} could not be found.")

                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": (f'Now using REST SCHEMA `{self.current_schema}` '
                                f'on REST SERVICE `{self.current_service_host}{self.current_service}`.'),
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(self.current_schema_id),
                    "executionTime": timer.elapsed()
                })
            else:
                self.results.append({
                    "statementIndex": len(self.results) + 1,
                    "type": "success",
                    "message": f'Now using REST SERVICE `{self.current_service_host}{self.current_service}`.',
                    "operation": self.current_operation,
                    "id": lib.core.convert_id_to_string(self.current_service_id)
                })

        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f'Cannot USE the specified REST object. {e}',
                "operation": self.current_operation
            })
            raise

    def showRestMetadataStatus(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            result = [lib.general.get_status(session=self.session)]

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "operation": self.current_operation,
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f'Cannot SHOW the REST services. {e}',
                "operation": self.current_operation
            })
            raise

    def showRestServices(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            services = lib.services.get_services(session=self.session)
            result = []
            for service in services:
                result.append({
                    "REST SERVICE Path": service.get("host_ctx"),
                    "enabled": (service.get("enabled") == 1),
                    "current": (service.get("id") == self.current_service_id)
                })

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "operation": self.current_operation,
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f'Cannot SHOW the REST services. {e}',
                "operation": self.current_operation
            })
            raise

    def showRestSchemas(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)
            if service_id is None:
                raise Exception("No REST SERVICE specified.")

            schemas = lib.schemas.get_schemas(
                session=self.session, service_id=service_id)
            result = []
            for schema in schemas:
                result.append({
                    "REST schema path": schema.get("request_path"),
                    "enabled": schema.get("enabled") == 1
                })

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "operation": self.current_operation,
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f'Cannot SHOW the REST schemas. {e}',
                "operation": self.current_operation
            })
            raise

    def showRestDbObjects(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")
        object_types = mrs_object.pop("object_types")

        try:
            schema_id = self.get_given_or_current_schema_id(mrs_object)
            if schema_id is None:
                raise Exception("No REST SCHEMA specified.")

            items = lib.db_objects.get_db_objects(
                session=self.session, schema_id=schema_id,
                object_types=object_types)
            result = []
            for item in items:
                result.append({
                    "REST DB Object": item.get("request_path"),
                    "enabled": item.get("enabled") == 1
                })

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "operation": self.current_operation,
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f'Cannot SHOW the REST db objects. {e}',
                "operation": self.current_operation
            })
            raise

    def showRestContentSets(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)
            if service_id is None:
                raise Exception("No REST SERVICE specified.")

            content_sets = lib.content_sets.get_content_sets(
                session=self.session, service_id=service_id)
            result = []
            for content_set in content_sets:
                result.append({
                    "REST CONTENT SET path": content_set.get("request_path"),
                    "enabled": content_set.get("enabled") == 1
                })

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "message": f'OK, {len(content_sets)} record{"s" if len(content_sets) > 1 else ""} received.',
                "operation": self.current_operation,
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f'Cannot SHOW the REST CONTENT SETs. {e}',
                "operation": self.current_operation
            })
            raise

    def showRestAuthApps(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)
            if service_id is None:
                raise Exception("No REST SERVICE specified.")

            auth_apps = lib.auth_apps.get_auth_apps(
                session=self.session, service_id=service_id)
            result = []
            for auth_app in auth_apps:
                result.append({
                    "REST AUTH APP name": auth_app.get("name"),
                    "vendor": auth_app.get("auth_vendor"),
                    "comments": auth_app.get("description"),
                    "enabled": auth_app.get("enabled") == 1
                })

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "message": f'OK, {len(auth_apps)} record{"s" if len(auth_apps) > 1 else ""} received.',
                "operation": self.current_operation,
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f'Cannot SHOW the REST CONTENT SETs. {e}',
                "operation": self.current_operation
            })
            raise

    def showCreateRestService(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        full_path = self.getFullServicePath(mrs_object=mrs_object)

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)
            if service_id is None:
                raise Exception("No REST SERVICE specified.")

            service = lib.services.get_service(
                session=self.session, service_id=service_id)

            stmt = f'CREATE REST SERVICE {service.get("host_ctx")}\n'
            if service.get("enabled") != 1:
                stmt += "    DISABLED\n"
            if service.get("comments") is not None:
                stmt += f'    COMMENTS "{service.get("comments")}"\n'

            auth = ""
            if service.get("auth_path") != "/authentication":
                auth += f'        PATH "{service.get("auth_path")}"\n'
            if service.get("auth_completed_url") is not None:
                auth += f'        REDIRECTION "{service.get("auth_completed_url")}"\n'
            if service.get("auth_completed_url_validation") is not None:
                auth += f'        VALIDATION "{service.get("auth_completed_url_validation")}"\n'
            if service.get("auth_completed_page_content") is not None:
                auth += f'        PAGE CONTENT "{service.get("auth_completed_page_content")}"\n'
            if auth != "":
                stmt += f'    AUTHENTICATION\n{auth}'

            options = service.get("options")
            if options is not None and options != "":
                js = json.dumps(options, indent=4)
                # Indent the json.dumps with 4 spaces
                js_indented = ""
                for ln in js.split("\n"):
                    js_indented += f'    {ln}\n'
                stmt += f'    OPTIONS {js_indented[4:-1]}\n'

            result = [{
                "CREATE REST SERVICE": stmt[:-1] + ";"
            }]

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "operation": self.current_operation,
                "id": lib.core.convert_id_to_string(service_id),
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f"Failed to get the REST SERVICE `{full_path}`. {e}",
                "operation": self.current_operation
            })
            raise

    def showCreateRestSchema(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        full_path = self.getFullSchemaPath(mrs_object=mrs_object)

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)
            if service_id is None:
                raise Exception("No REST SERVICE specified.")

            service = lib.services.get_service(
                session=self.session, service_id=service_id)

            schema = lib.schemas.get_schema(
                service_id=service_id,
                request_path=mrs_object.get("schema_request_path"),
                session=self.session)

            if schema is None:
                raise Exception("The REST schema was not found.")

            stmt = f'CREATE OR REPLACE REST SCHEMA {schema.get("request_path")} FROM \'{schema.get("name")}\'\n'
            stmt += f'    ON SERVICE {service.get("host_ctx")}\n'

            if schema.get("enabled") != 1:
                stmt += "    DISABLED\n"

            options = schema.get("options")
            if options is not None and options != "":
                js = json.dumps(options, indent=4)
                # Indent the json.dumps with 4 spaces
                js_indented = ""
                for ln in js.split("\n"):
                    js_indented += f'    {ln}\n'
                stmt += f'    OPTIONS {js_indented[4:-1]}\n'

            result = [{
                "CREATE REST SCHEMA ": stmt[:-1] + ";"
            }]

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "operation": self.current_operation,
                "id": lib.core.convert_id_to_string(schema.get("id")),
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f"Failed to get the REST SCHEMA `{full_path}`. {e}",
                "operation": self.current_operation
            })
            raise

    def showCreateRestDbObject(self, mrs_object: dict):
        timer = Timer()
        # Keep in sync with the function buildDualityViewSql implemented in
        # ../../frontend/src/modules/mrs/dialogs/MrsObjectFieldEditor.tsx

        self.current_operation = mrs_object.pop("current_operation")
        request_path = mrs_object.pop("request_path")
        rest_object_type = mrs_object.pop("type")

        full_path = self.getFullSchemaPath(
            mrs_object=mrs_object, request_path=request_path)

        try:
            schema_id = self.get_given_or_current_schema_id(mrs_object)
            if schema_id is None:
                raise Exception("No REST SCHEMA specified.")

            db_object = lib.db_objects.get_db_object(
                session=self.session, schema_id=schema_id,
                request_path=request_path)
            if db_object is None:
                raise Exception(
                    f'The given REST {rest_object_type} `{full_path}` could not be found.')

            objects = lib.db_objects.get_objects(
                session=self.session,
                db_object_id=db_object.get("id")
            )

            if rest_object_type == "PROCEDURE" and db_object.get("object_type") != "PROCEDURE":
                raise Exception(
                    f'The given REST object `{full_path}` is not a REST PROCEDURE.')
            if rest_object_type == "FUNCTION" and db_object.get("object_type") != "FUNCTION":
                raise Exception(
                    f'The given REST object `{full_path}` is not a REST FUNCTION.')
            if (rest_object_type == "DUALITY VIEW" and
                    db_object.get("object_type") != "TABLE" and db_object.get("object_type") != "VIEW"):
                raise Exception(
                    f'The given REST object `{full_path}` is not a REST DUALITY VIEW.')

            options = []

            stmt = (f'CREATE OR REPLACE REST {rest_object_type} {db_object.get("request_path")}\n' +
                    f'    ON SERVICE {mrs_object.get("url_context_root")} SCHEMA {db_object.get("schema_request_path")}\n' +
                    f'    AS {db_object.get("qualified_name")}')

            if rest_object_type != "PROCEDURE" and rest_object_type != "FUNCTION":
                stmt += f' CLASS {objects[0]["name"]}'

                crud_ops = db_object.get("crud_operations")
                if "CREATE" in crud_ops:
                    stmt += " @INSERT"
                if "UPDATE" in crud_ops:
                    stmt += " @UPDATE"
                if "DELETE" in crud_ops:
                    stmt += " @DELETE"

                fields = []
                if len(objects) > 0:
                    fields = lib.db_objects.get_object_fields_with_references(
                        session=self.session, object_id=objects[0]["id"])

                stmt += f' {{\n{cutLastComma(walk(fields=fields, level=2, current_object=db_object))}\n    }}\n'
            else:
                stmt += "\n"
                for object in objects:
                    fields = lib.db_objects.get_object_fields_with_references(
                        session=self.session, object_id=object["id"])

                    children = cutLastComma(walk(
                        fields=fields, level=2, add_data_type=object["kind"] == "RESULT", current_object=db_object))

                    stmt += f'    {object["kind"]} {object["name"]}'

                    if children:
                        stmt += f" {{\n{children}\n    }}\n"

            if db_object["enabled"] is False or db_object["enabled"] == 0:
                stmt += "    DISABLED\n"

            if db_object["requires_auth"] is True or db_object["requires_auth"] == 1:
                stmt += "    AUTHENTICATION REQUIRED\n"

            # 25 is the default value
            if db_object["items_per_page"] is not None and db_object["items_per_page"] != 25:
                stmt += f'    ITEMS PER PAGE {db_object["items_per_page"]}\n'

            if db_object["comments"]:
                stmt += f'    COMMENTS "{db_object["comments"]}"\n'

            if db_object["media_type"] is not None:
                stmt += f'    MEDIA TYPE {db_object["media_type"]}\n'

            if db_object["crud_operation_format"] != "FEED":
                stmt += f'    FORMAT {db_object["crud_operation_format"]}\n'

            if db_object["auth_stored_procedure"] is not None:
                stmt += f'    AUTHENTICATION PROCEDURE {db_object["auth_stored_procedure"]}\n'

            options = db_object.get("options")
            if options is not None and options != "":
                js = json.dumps(options, indent=4)
                # Indent the json.dumps with 4 spaces
                js_indented = ""
                for ln in js.split("\n"):
                    js_indented += f'    {ln}\n'
                stmt += f'    OPTIONS {js_indented[4:-1]}\n'

            # Build CREATE statement
            result = [{
                f"CREATE REST {rest_object_type}": stmt[:-1].rstrip() + ";"
            }]

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "operation": self.current_operation,
                "id": lib.core.convert_id_to_string(db_object["id"]),
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f'Failed to get the REST {rest_object_type} `{full_path}`. {e}',
                "operation": self.current_operation
            })
            raise

    def showCreateRestAuthApp(self, mrs_object: dict):
        timer = Timer()
        self.current_operation = mrs_object.pop("current_operation")

        name = mrs_object.get("name")
        full_path = self.getFullServicePath(
            mrs_object=mrs_object, request_path=f':{name}')

        try:
            service_id = self.get_given_or_current_service_id(mrs_object)
            if service_id is None:
                raise Exception("No REST SERVICE specified.")

            service = lib.services.get_service(
                session=self.session, service_id=service_id)

            auth_app = lib.auth_apps.get_auth_app(
                service_id=service_id,
                name=name,
                session=self.session)
            if auth_app is None:
                raise Exception(
                    f'The given REST AUTH APP `{full_path}` could not be found.')

            if auth_app["auth_vendor"].upper() == "MRS":
                vendor = "MRS"
            elif auth_app["auth_vendor"].upper() == "MYSQL INTERNAL":
                vendor = "MYSQL"
            else:
                vendor = auth_app["auth_vendor"]

            stmt = (f'CREATE OR REPLACE REST AUTH APP "{auth_app.get("name")}"\n' +
                    f'    ON SERVICE {service.get("host_ctx")}\n' +
                    f'    VENDOR {vendor}\n')

            if auth_app["enabled"] is False or auth_app["enabled"] == 0:
                stmt += "    DISABLED\n"

            if auth_app["description"]:
                stmt += f'    COMMENTS "{auth_app["description"]}"\n'

            if auth_app.get("limit_to_registered_users") == 0:
                stmt += "    ALLOW NEW USERS TO REGISTER\n"

            # Get default role
            if auth_app.get("default_role_id") is not None:
                role = lib.roles.get_role(
                    session=self.session, role_id=auth_app.get("default_role_id"))
                if role is not None:
                    stmt += f'    DEFAULT ROLE "{role.get("caption")}"\n'

            result = [{
                "CREATE REST AUTH APP ": stmt[:-1] + ";"
            }]

            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "success",
                "operation": self.current_operation,
                "id": lib.core.convert_id_to_string(auth_app.get("id")),
                "result": result,
                "executionTime": timer.elapsed()
            })
        except Exception as e:
            self.results.append({
                "statementIndex": len(self.results) + 1,
                "type": "error",
                "message": f"Failed to get the REST AUTH APP `{full_path}`. {e}",
                "operation": self.current_operation
            })
            raise
