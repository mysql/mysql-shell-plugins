# Copyright (c) 2022 Oracle and/or its affiliates.
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
import json

def resolve_service(session, service_id=None, required=True):
    service = None

    if service_id:
        # Check if given service_id exists or use the current service
        service = lib.services.get_service(
            service_id=service_id, session=session)

    if not service:
        service = lib.services.get_current_service(session)

    if not service and lib.core.get_interactive_default():
        print("MRS - Service Listing\n")
        services = lib.services.get_services(session)
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

def resolve_schema(session, schema_id=None, required=True):
    schema = None

    if schema_id:
        schema = lib.schemas.get_schema(session=session, schema_id=schema_id)

    if not schema and lib.core.get_interactive_default():
        schemas = lib.schemas.get_schemas(session=session)
        schema = lib.core.prompt_for_list_item(
            item_list=schemas,
            prompt_caption='Please enter the name or index of a schema: ',
            item_name_property="name",
            print_list=True)

    if not schema and required:
        raise Exception("Cancelling operation. Could not determine the schema.")

    return schema


def resolve_options(options, default = None):
    if options:
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
