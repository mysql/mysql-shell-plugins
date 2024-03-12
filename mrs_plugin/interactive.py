# Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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


def resolve_service(session, service_id=None, required=True, auto_select_single=False):
    service = None

    if service_id:
        # Check if given service_id exists or use the current service
        service = lib.services.get_service(
            service_id=service_id, session=session)

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


def resolve_schema(session, schema_id=None, service_id=None, required=True):
    schema = None
    service = None

    if schema_id:
        schema = lib.schemas.get_schema(session=session, schema_id=schema_id, service_id=service_id)

    if schema:
        return schema

    if lib.core.get_interactive_default():
        if not service_id:
            service = resolve_service(session, service_id)

        schemas = lib.schemas.get_schemas(session, service["id"])
        schema = lib.core.prompt_for_list_item(
            item_list=schemas,
            prompt_caption='Please enter the name or index of a schema: ',
            item_name_property="name",
            print_list=True)

    if not schema and required:
        raise Exception("Cancelling operation. Could not determine the schema.")

    return schema


def resolve_db_object(session, db_object_id=None, schema_id=None, service_id=None, required=True):
    db_object = None

    if db_object_id:
        db_object = lib.db_objects.get_db_object(session, db_object_id)

    if db_object:
        return db_object

    if lib.core.get_interactive_default():
        schema = resolve_schema(session, schema_id, service_id)

        db_objects = lib.db_objects.get_db_objects(session, schema["id"])

        db_object = lib.core.prompt_for_list_item(
            item_list=db_objects,
            prompt_caption='Please enter the name or index of a db_object: ',
            item_name_property="name",
            print_list=True)

    if not db_object and required:
        raise Exception("Cancelling operation. Could not determine the db_object.")

    return db_object


def resolve_content_set(session, content_set_id=None, service_id=None, required=True):
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


def resolve_content_file(session, content_file_id=None, content_set_id=None, service_id=None, required=True):
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

def resolve_auth_app(session, auth_app_id=None, service_id=None, required=True):
    if auth_app_id:
        return lib.auth_apps.get_auth_app(session, auth_app_id)

    if not service_id:
        service = resolve_service(session, service_id)

    auth_app_list = lib.auth_apps.get_auth_apps(session, service["id"])
    selection = lib.core.prompt_for_list_item(
        item_list=auth_app_list,
        prompt_caption='Please enter the name or index of an auth_app: ',
        item_name_property="name",
        print_list=True)

    if not selection and required:
        raise Exception("Cancelling operation. Could not determine the auth_app.")

    return selection

def resolve_file_path(file_path=None, required=True):
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

def resolve_overwrite_file(file_path, overwrite) -> None:
    if not os.path.exists(file_path):
        return

    if os.path.isdir(file_path):
        raise Exception("Cancelling operation. Path already exists and it's a directory.")

    if overwrite is None and lib.core.get_interactive_default():
        overwrite = lib.core.prompt(f"Overwrite {file_path}? [y/N]: ",
                           {'defaultValue': 'n'}).strip().lower() == "y"

    if overwrite is False:
        raise Exception(f"Cancelling operation. File '{file_path}' already exists.")

