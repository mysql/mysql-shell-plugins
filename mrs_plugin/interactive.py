# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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
import json
import os
from pathlib import Path

def service_query_selection(**kwargs):
    service = kwargs.get("service")
    service_id = kwargs.get("service_id")
    url_host_name = kwargs.get("url_host_name")
    url_context_root  = kwargs.get("url_context_root")

    if service_id is not None:
        return service_id

    if service is not None:
        return service

    if url_context_root is not None:
        return f"{url_context_root}"

    return None

def schema_query_selection(**kwargs):
    schema = kwargs.get("schema")
    schema_id = kwargs.get("schema_id")

    if schema_id is not None:
        return schema_id

    if schema is not None:
        return schema

    return None

def auth_app_query_selection(**kwargs):
    auth_app = kwargs.get("auth_app")
    auth_app_id = kwargs.get("auth_app_id")

    if auth_app_id is not None:
        return auth_app_id

    if auth_app is not None:
        return auth_app

    return None

def resolve_service(session, service_query:str | bytes=None, required:bool=True, auto_select_single:bool=False):
    service = None
    if service_query:
        if isinstance(service_query, bytes):
            # Check if given service exists by searching its id
            service = lib.services.get_service(
                service_id=service_query, session=session)
        else:
            # Check if the service exists by host and context root
            url_host_name, url_context_root = service_query.split("/", 1)
            url_context_root = f"/{url_context_root}"
            service = lib.services.get_service(
                url_host_name=url_host_name, url_context_root=url_context_root, session=session)

    if not service:
        service = lib.services.get_current_service(session)

    services = lib.services.get_services(session)
    if len(services) == 1 and auto_select_single:
        # If there only is one service and auto_select_single is True, take the single service
        service = services[0]

    if not service and lib.core.get_interactive_default():
        print("MRS - Service Listing\n")

        service = lib.core.prompt_for_list_item(
            item_list=services,
            prompt_caption=("Please select a service index or type "
                            "'hostname/root_context'"),
            item_name_property="host_ctx",
            given_value=None,
            print_list=True)

    if not service and required:
        raise Exception("Operation cancelled. Unable to identify target service.")

    return service


def resolve_schema(session, schema_query:str | bytes=None, service_query:str | bytes=None, required:bool=True):
    schema = None
    service = None

    if schema_query is not None:
        if isinstance(schema_query, bytes):
            schema = lib.schemas.get_schema(session=session, schema_id=schema_query)
        elif isinstance(schema_query, str):
            url_host_name, url_context_root, request_path = schema_query.split("/")
            service = lib.services.get_service(session, url_host_name=url_host_name, url_context_root=f"/{url_context_root}")
            if service is not None:
                schema = lib.schemas.get_schema(session, service_id=service["id"], request_path=f"/{request_path}")

    if schema:
        return schema

    if lib.core.get_interactive_default():
        service = resolve_service(session, service_query)

        schemas = lib.schemas.get_schemas(session, service["id"])
        schema = lib.core.prompt_for_list_item(
            item_list=schemas,
            prompt_caption='Please enter the name or index of a schema: ',
            item_name_property="name",
            print_list=True)

    if not schema and required:
        raise Exception("Cancelling operation. Could not determine the schema.")

    return schema


def resolve_db_object(session, db_object_id:bytes=None, schema_id:bytes=None, service_id:bytes=None, required:bool=True):
    db_object = None

    if db_object_id:
        db_object = lib.db_objects.get_db_object(session, db_object_id)

    if db_object:
        return db_object

    if lib.core.get_interactive_default():
        schema = resolve_schema(session, schema_query=schema_id, service_query=service_id)

        db_objects = lib.db_objects.get_db_objects(session, schema["id"])

        db_object = lib.core.prompt_for_list_item(
            item_list=db_objects,
            prompt_caption='Please enter the name or index of a db_object: ',
            item_name_property="name",
            print_list=True)

    if not db_object and required:
        raise Exception("Cancelling operation. Could not determine the db_object.")

    return db_object


def resolve_content_set(session, content_set_id:bytes=None, service_id:bytes=None, required:bool=True):
    content_set = None

    if content_set_id:
        content_set = lib.content_sets.get_content_set(session, content_set_id=content_set_id)

    if content_set:
        return content_set

    if lib.core.get_interactive_default():
        if not service_id:
            service = resolve_service(session, service_id)

        content_sets = lib.content_sets.get_content_sets(session, service["id"])
        content_set = lib.core.prompt_for_list_item(
            item_list=content_sets,
            prompt_caption='Please enter the name or index of a content set: ',
            item_name_property="request_path",
            print_list=True)

    if not content_set and required:
        raise Exception("Cancelling operation. Could not determine the content set.")

    return content_set


def resolve_content_file(session, content_file_id:bytes=None, content_set_id:bytes=None, service_id:bytes=None, required:bool=True):
    content_file = None

    if content_file_id:
        content_file = lib.content_files.get_content_file(session, content_file_id)

    if content_file:
        return content_file

    if lib.core.get_interactive_default():
        content_set = resolve_content_set(session, content_set_id, service_id)

        content_files = lib.content_files.get_content_files(session,
                                                          service_id=content_set["id"])
        content_file = lib.core.prompt_for_list_item(
            item_list=content_files,
            prompt_caption='Please enter the name or index of a content file: ',
            item_name_property="request_path",
            print_list=True)

    if not content_file and required:
        raise Exception("Cancelling operation. Could not determine the content file.")

    return content_file

def user_query_selection(**kwargs):
    user_id = kwargs.get("user_id")
    user = kwargs.get("user")

    if user_id is not None:
        return user_id

    if user is not None:
        return user

    return None


def resolve_user(session, user_query:str | bytes):
    if isinstance(user_query, bytes):
        return lib.users.get_user(session, user_id=user_query)

    if isinstance(user_query, str):
        url_host_name, url_context_root, auth_app_name, user_name = user_query.split("/")
        service = lib.services.get_service(session, url_host_name=url_host_name, url_context_root=f"/{url_context_root}")

        if not service:
            raise Exception("service not found")

        auth_app = lib.auth_apps.get_auth_app(session, name=auth_app_name)

        if not auth_app:
            raise Exception("auth_app not found")

        user = lib.users.get_user(session, service_id=service["id"], auth_app_id=auth_app["id"], user_name=user_name)

        if not user:
            raise Exception("user not found")

        return user

    return None


def role_query_selection(**kwargs):
    role_id = kwargs.get("role_id")
    role_name = kwargs.get("role_id")
    role_query = kwargs.get("role")

    if role_id is not None:
        return role_id

    if isinstance(role_query, bytes) or isinstance(role_query, str):
        return role_query

    if role_name is not None:
        return role_name

    return None



def resolve_role(session, role_query:str | bytes):
    if isinstance(role_query, bytes):
        return lib.roles.get_role(session, role_id=role_query)

    role_query_list = role_query.split("/")

    service_id = None
    role_name = None

    if len(role_query_list) == 3:
        url_host_name = role_query_list[0]
        url_context_root = role_query_list[1]
        role_name = role_query_list[2]

        service = lib.services.get_service(session, url_host_name=url_host_name, url_context_root=url_context_root)
        service_id = service["id"]
    elif len(role_query_list) == 1:
        role_name = role_query_list[0]

    roles = lib.roles.get_roles(session, service_id)

    for role in roles:
        if role["caption"] == role_name:
            return role

    return None


def resolve_options(options, default = None):
    # it should be possible to override the default value with an empty dict
    if options is not None:
        return options

    if lib.core.get_interactive_default():
        entries = [
            "Default Service Options for Development",
            "No options",
            "Custom options"
        ]

        selection = lib.core.prompt_for_list_item(
            item_list=entries,
            prompt_caption=("Please select how to initialize the options [Default Service Options for Development]"),
            prompt_default_value=entries[0],
            given_value=None,
            print_list=True)

        if selection == "Default Service Options for Development":
            return default
        elif selection == "No options":
            return None
        elif selection == "Custom options":
            return json.loads(lib.core.prompt("Options (in JSON format): "))

    return None

def resolve_auth_app(session, auth_app_query:str | bytes=None, service_query:str | bytes=None, required:bool=True):
    if isinstance(auth_app_query, bytes):
        return lib.auth_apps.get_auth_app(session, auth_app_query)

    service = resolve_service(session, service_query=service_query)

    auth_app_list = lib.auth_apps.get_auth_apps(session, service["id"])

    if len(auth_app_list) == 0:
        raise Exception("No Authentication Apps found for this service.")

    if len(auth_app_list) == 1:
        return auth_app_list[0]

    selection = lib.core.prompt_for_list_item(
        item_list=auth_app_list,
        prompt_caption='Please enter the name or index of an auth_app: ',
        item_name_property="name",
        print_list=True)

    if not selection and required:
        raise Exception("Cancelling operation. Could not determine the auth_app.")

    return selection

def resolve_file_path(file_path:str=None, required:bool=True):
    if file_path is None and lib.core.get_interactive_default():
        file_path = lib.core.prompt("Please set the file path", {
            "defaultValue": None,
        })

    if not file_path and required:
        raise Exception("Cancelling operation. Could not determine the file path.")

    if file_path.startswith("~"):
        file_path = os.path.expanduser(file_path)

    if not os.path.isabs(file_path):
        return Path(Path.home() / file_path).as_posix()

    return Path(file_path).as_posix()

def resolve_overwrite_file(file_path:str, overwrite:bool) -> None:
    if not os.path.exists(file_path):
        return

    if os.path.isdir(file_path):
        raise Exception("Cancelling operation. Path already exists and it's a directory.")

    if overwrite is None and lib.core.get_interactive_default():
        overwrite = lib.core.prompt(f"Overwrite {file_path}? [y/N]: ",
                           {'defaultValue': 'n'}).strip().lower() == "y"

    if overwrite is False:
        raise Exception(f"Cancelling operation. File '{file_path}' already exists.")

