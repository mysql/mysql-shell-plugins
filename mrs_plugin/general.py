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

"""Sub-Module for shortcut functions"""

# cSpell:ignore mrs, mysqlsh

from mysqlsh.plugin_manager import plugin_function
from mrs_plugin import core, services as mrs_services
from mrs_plugin import schemas as mrs_schemas
from mrs_plugin import db_objects as mrs_db_objects
from mrs_plugin import content_sets as mrs_content_sets
from mrs_plugin import content_files as mrs_content_files
from mrs_plugin import auth_apps as mrs_auth_apps


# Define plugin version
VERSION = "0.1.29"

DB_VERSION = [0, 0, 23]
DB_VERSION_STR = '%d.%d.%d' % tuple(DB_VERSION)
DB_VERSION_NUM = DB_VERSION[0] * 100000 + DB_VERSION[1] * 1000 + DB_VERSION[2]


@plugin_function('mrs.info', shell=True, cli=True, web=True)
def info():
    """Returns basic information about this plugin.

    Returns:
        str
    """
    return (f"MySQL REST Data Service (MRS) Plugin Version {VERSION} PREVIEW\n"
             "Warning! For testing purposes only!")


@plugin_function('mrs.version', shell=True, cli=True, web=True)
def version():
    """Returns the version number of the plugin

    Returns:
        str
    """
    return VERSION


@plugin_function('mrs.ls', shell=True, cli=True, web=True)
def ls(path=None, session=None):
    """Lists the schemas that are currently offered via MRS

    Args:
        path (str): The path to use.
        session (object): The database session to use.

    Returns:
        None
    """

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        service = None
        schema = None
        content_set = None

        # If a path was given, try to get the corresponding objects
        if path is not None:
            service, schema, content_set = core.analyze_service_path(
                path=path, session=session)
        # If no path was given, check if current objects are set
        else:
            service = core.get_current_service(session=session)
            schema = core.get_current_schema(session=session)
            content_set = core.get_current_content_set(session=session)

        # If there is not current_service set, list all services
        if not service:
            print("List of MRS Services\n")
            services = mrs_services.get_services(
                session=session, interactive=False)
            if services and len(services) > 0:
                print(mrs_services.format_service_listing(services=services,
                                                          print_header=True))
            else:
                print("No services available.\n\nUse mrs.add.service() "
                      "to add a service.")
            return

        # List service content
        if service and not schema and not content_set:
            print(f"MRS Service {service.get('host_ctx')}\n")
            schemas = mrs_schemas.get_schemas(
                service_id=service.get('id'), session=session,
                interactive=False, return_formatted=False)
            content_sets = mrs_content_sets.get_content_sets(
                service_id=service.get('id'), session=session,
                interactive=False)
            auth_apps = mrs_auth_apps.get_auth_apps(
                service_id=service.get('id'), session=session,
                interactive=False)

            if len(schemas) == 0 and len(content_sets) == 0:
                print("No schemas added to this service yet.\n\n"
                      "Use mrs.add.schema() to add a schema to the service.")
            if len(schemas) > 0:
                print("List of Schemas")
                print(mrs_schemas.format_schema_listing(
                    schemas=schemas, print_header=True) + "\n")
            if len(content_sets) > 0:
                print("List of Content Sets")
                print(mrs_content_sets.format_content_set_listing(
                    content_sets=content_sets, print_header=True) + "\n")
            if len(auth_apps) > 0:
                print("List of Authentication Apps")
                print(mrs_auth_apps.format_auth_app_listing(
                    auth_apps=auth_apps, print_header=True) + "\n")

        # List schema objects
        if service and schema:
            print(f"MRS Service {service.get('host_ctx')}"
                  f"{schema.get('request_path')} - Database Objects\n")
            db_objects = mrs_db_objects.get_db_objects(
                schema_id=schema.get('id'), session=session,
                interactive=False)
            if len(db_objects) > 0:
                print(mrs_db_objects.format_db_object_listing(
                    db_objects=db_objects, print_header=True))
            else:
                print("No database objects added to this schema yet.\n\n"
                      "Use mrs.add.db_object() to add an object to the "
                      "schema.")

        # List content_set files
        if service and content_set:
            print(f"MRS Service {service.get('host_ctx')}"
                  f"{content_set.get('request_path')} - Content Files\n")
            content_files = mrs_content_files.get_content_files(
                content_set_id=content_set.get('id'), session=session,
                interactive=False)
            if len(content_files) > 0:
                print(mrs_content_files.format_content_file_listing(
                    content_files=content_files, print_header=True))
            else:
                print("No content files added to this content set yet.\n\n"
                      "Use mrs.add.content_file() to add a file to the "
                      "content set.")

    except Exception as e:
        print(f"Error: {str(e)}")


@plugin_function('mrs.cd')
def cd(path=None, session=None):
    """Change the current service and/or schema

    Args:
        path (str): The name of the service and/or schema to make current
        session (object): The database session to use

    Returns:
        none

    """

    try:
        session = core.get_current_session(session)

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session)

        # If a path was given, try to get the corresponding objects
        if path:
            service, schema, content_set = core.analyze_service_path(
                path=path, session=session)

            current_path = ""
            if service:
                current_path += service.get("host_ctx")
            if schema:
                current_path += schema.get("request_path")
            if content_set:
                current_path += content_set.get("request_path")

            core.set_current_objects(service=service, schema=schema,
                                content_set=content_set)

            print(f"Current path set to {current_path}")
            return
        # If an empty path was given, set the current path to root
        elif path == "":
            core.set_current_objects(service=None, schema=None, db_object=None)
            print(f"Current path set to root.")
        # If no path was given, let the user choose
        else:
            current_service = core.get_current_service(session=session)

            # If the current service has not been set, let the user select it
            if not current_service:
                # Check if there already is at least one service
                res = session.run_sql("""
                    SELECT COUNT(*) as service_count
                    FROM `mysql_rest_service_metadata`.service
                    """)
                row = res.fetch_one()
                service_count = row.get_field("service_count") if row else 0

                # If there is exactly one service, set id to its id
                if service_count == 0:
                    raise ValueError("No MRS service available.")

                # If there are more services, let the user select one or all
                print("MRS - Service Listing\n")
                services = mrs_services.get_services(
                    session=session, interactive=False)
                item = core.prompt_for_list_item(
                    item_list=services,
                    prompt_caption=("Please select a service index or type "
                                    "'hostname/root_context'"),
                    item_name_property="host_ctx",
                    given_value=None,
                    print_list=True)
                if not item:
                    raise ValueError("Operation cancelled.")
                else:
                    core.set_current_objects(service=item)
                    print(f"Current path set to {item.get('host_ctx')}")
                    return

            current_schema = core.get_current_schema(session=session)
            current_content_set = core.get_current_content_set(session=session)

            if not current_schema and not current_content_set:
                print(f"MRS Service {current_service.get('host_ctx')} - "
                      "Schema and Content Set Listing:\n")
                # Get the schema
                schemas = mrs_schemas.get_schemas(
                    service_id=current_service.get("id"),
                    session=session, interactive=False, return_formatted=False)
                context_sets = mrs_content_sets.get_content_sets(
                    service_id=current_service.get("id"),
                    session=session, interactive=False)

                items = schemas + context_sets

                selection = core.prompt_for_list_item(
                    item_list=items, prompt_caption=("Please select a schema "
                                                     "or content set: "),
                    item_name_property='request_path', print_list=True)

                # If there is a key called name, it is a schema
                if 'name' in selection:
                    core.set_current_objects(service=current_service,
                                        schema=selection)
                else:
                    core.set_current_objects(service=current_service,
                                        content_set=selection)

                if selection:
                    print(f"Current path set to {selection.get('host_ctx')}"
                          f"{selection.get('request_path')}")
                    return

    except Exception as e:
        print(f"Error: {str(e)}")


@plugin_function('mrs.configure', shell=True, cli=True, web=True)
def configure(**kwargs):
    """Initializes and configures the MySQL REST Data Service

    Args:
        **kwargs: Additional options

    Keyword Args:
        enable_mrs (bool): Whether MRS should be enabled or disabled
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
        True on success, None in interactive mode
    """

    enable_mrs = kwargs.get("enable_mrs")
    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())

    try:
        session = core.get_current_session(session)

        if interactive:
            print("MySQL Rest Data Service configuration.\n\n"
                  "Checking MRS metadata schema and version...")

        # Make sure the MRS metadata schema exists and has the right version
        schema_changed = core.ensure_rds_metadata_schema(
            session=session, auto_create_and_update=True,
            interactive=interactive)

        if interactive:
            if schema_changed:
                print("The MRS metadata has been configured.")
            else:
                print("The MRS metadata is well configured, no changes "
                      "performed.")

        if enable_mrs != None:
            res = session.run_sql("""
                UPDATE `mysql_rest_service_metadata`.config
                    SET service_enabled = ?
                WHERE id = 1
                """, [1 if enable_mrs else 0])

            if interactive:
                if enable_mrs:
                    print(f"The MySQL REST Data Service has been enabled.")
                else:
                    print(f"The MySQL REST Data Service has been disabled.")
        else:
            res = session.run_sql("""
                SELECT service_enabled
                FROM `mysql_rest_service_metadata`.config
                WHERE id = 1
                """)
            row = res.fetch_one()
            enable_mrs = row.get_field("service_enabled") \
                if row and row.get_field("service_enabled") else 0

        if not interactive:
            return {
                "schema_changed": schema_changed,
                "mrs_enabled": enable_mrs}
    except Exception as e:
        if interactive:
            print(f"Error: {str(e)}")
        else:
            raise


@plugin_function('mrs.status', shell=True, cli=True, web=True)
def status(**kwargs):
    """Checks the MRS service status and prints its

    Args:
        **kwargs: Additional options

    Keyword Args:
        session (object): The database session to use
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned

    Returns:
        None
    """

    session = kwargs.get("session")
    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)

    try:
        session = core.get_current_session(session)

        if interactive:
            print("Checking the current status of the MRS...\n")

        # Check if the MRS metadata schema already exists
        res = session.run_sql("""
            SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA
            WHERE SCHEMA_NAME = 'mysql_rest_service_metadata'
            """)
        row = res.fetch_one()
        if not row:
            if return_formatted:
                print("The MySQL REST Data Service is not configured yet. "
                      "Run mrs.configure() to configure the service.")
            else:
                return {
                    'service_configured': False,
                    'service_enabled': False,
                    'service_count': 0}
        else:
            result = {'service_configured': True}

        # Make sure the MRS metadata schema exists and has the right version
        core.ensure_rds_metadata_schema(session=session)

        # Check if MRS is enabled
        res = session.run_sql("""
            SELECT service_enabled FROM `mysql_rest_service_metadata`.config
            WHERE id = 1
            """)
        row = res.fetch_one()
        result['service_enabled'] = row.get_field("service_enabled")

        # Get the number of enabled services
        res = session.run_sql("""
            SELECT SUM(enabled) as service_count
            FROM `mysql_rest_service_metadata`.service
            """)
        row = res.fetch_one()
        result['service_count'] = int(row.get_field("service_count")) \
            if row and row.get_field("service_count") else 0

        if return_formatted:
            if result['service_enabled']:
                print(f"The MySQL REST Data Service is enabled.")
                print("Number of enabled MRS services: "
                      f"{result['service_count']}")
                if int(result['service_count']) == 0:
                    print("\nUse mrs.add.service() to add a new service.")
            else:
                print(f"The MySQL REST Data Service is disabled.")
        else:
            return result
    except Exception as e:
        if raise_exceptions:
            raise
        else:
            print(f"Error: {str(e)}")
