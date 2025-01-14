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

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib
import json
import sys
import time
import re


def dump(path, **kwargs):
    """Dumps the data for a REST component into a JSON file
    Args:
        path (str): The path to the file where the export will be stored.
        **kwargs: Options to determine what should be exported.

    Keyword Args:
        service_id (str): The ID of the service to be exported.
        service_name (str): The name of the service to be exported.
        schema_id (str): The ID of the schema to be exported.
        schema_name (str): The name of the schema to be exported.
        object_id (str): The ID of the object to be exported.
        object_name (str): The name of the object to be exported.
        session (object): The database session to use.
    """
    session = kwargs.get('session', None)

    lib.core.convert_ids_to_binary(
        ['service_id', 'schema_id', 'object_id'], kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, session=session) as session:
        service_conditions = lib.core.create_identification_conditions(kwargs.get(
            'service_id', None), kwargs.get('service_name', None), 'service_id', 'url_context_root')

        schema_conditions = lib.core.create_identification_conditions(kwargs.get(
            'schema_id', None), kwargs.get('schema_name', None), 'schema_id', 'name')

        object_conditions = lib.core.create_identification_conditions(kwargs.get(
            'object_id', None), kwargs.get('object_name', None), 'object_id', 'name')

        target_object, object_id = lib.core.identify_target_object(session,
                                                                   service_conditions, schema_conditions, object_conditions)

        lib.core.select('mrs_user_schema_version').exec(session).first

        export = {'type': f"mrs{target_object.capitalize()}", 'version': lib.core.select(
            'mrs_user_schema_version').exec(session).first}
        if target_object == "service":
            export['service'] = lib.dump.get_service_dump(session, object_id)
        elif target_object == "schema":
            export['schema'] = lib.dump.get_db_schema_dump(session, object_id)
        else:
            export['object'] = lib.dump.get_db_object_dump(session, object_id)

        with open(path, 'w') as file:
            file.write(json.dumps(export, indent=4))


@plugin_function('mrs.dump.service', shell=True, cli=True, web=True)
def dump_service(path, **kwargs):
    """Dumps the data for REST Service into a JSON file.
    Args:
        path (str): The path to the file where the dump will be stored.
        **kwargs: Options to determine what should be exported.

    Keyword Args:
        service_id (str): The ID of the service to be exported.
        service_name (str): The name of the service to be exported.
        session (object): The database session to use.
    """
    dump(path, **kwargs)


@plugin_function('mrs.dump.schema', shell=True, cli=True, web=True)
def dump_schema(path, **kwargs):
    """Exports the data for REST Schema into a JSON file.
    Args:
        path (str): The path to the file where the export will be stored.
        **kwargs: Options to determine what should be exported.

    Keyword Args:
        service_id (str): The ID of the service to be exported.
        service_name (str): The name of the service to be exported.
        schema_id (str): The ID of the schema to be exported.
        schema_name (str): The name of the schema to be exported.
        session (object): The database session to use.
    """
    dump(path, **kwargs)


@plugin_function('mrs.dump.object', shell=True, cli=True, web=True)
def dump_object(path, **kwargs):
    """Exports the data for a REST Database Object into a JSON file.
    Args:
        path (str): The path to the file where the export will be stored.
        **kwargs: Options to determine what should be exported.

    Keyword Args:
        service_id (str): The ID of the service to be exported.
        service_name (str): The name of the service to be exported.
        schema_id (str): The ID of the schema to be exported.
        schema_name (str): The name of the schema to be exported.
        object_id (str): The ID of the object to be exported.
        object_name (str): The name of the object to be exported.
        session (object): The database session to use.
    """
    dump(path, **kwargs)


def load(path, **kwargs):
    """Loads data for a REST component from a JSON file into a target REST component
    Args:
        path (str): The path of the file containing the data to be imported.
        **kwargs: Options to determine the target object where the import will occur.

    Keyword Args:
        service_id (str): The ID of target service.
        service_name (str): The name of the target service.
        schema_id (str): The ID of the target schema.
        schema_name (str): The name of the target schema.
        reuse_ids (bool): Indicates whether the existing ids should be reused.
        session (object): The database session to use during the import.
    """
    session = kwargs.get('session', None)
    reuse_ids = kwargs.get('reuse_ids', True)

    lib.core.convert_ids_to_binary(['service_id', 'schema_id'], kwargs)

    with lib.core.MrsDbSession(exception_handler=lib.core.print_exception, session=session) as session:
        service_conditions = lib.core.create_identification_conditions(kwargs.get(
            'service_id', None), kwargs.get('service_name', None), 'service_id', 'url_context_root')

        schema_conditions = lib.core.create_identification_conditions(kwargs.get(
            'schema_id', None), kwargs.get('schema_name', None), 'schema_id', 'name')

        target_object, object_id = lib.core.identify_target_object(session,
                                                                   service_conditions, schema_conditions, None)

        # For now, simple use cases:
        # - A Schema Dump can be loaded into a Service
        # - An Object Dump can be loaded into a Schema
        expected_type = ""
        if target_object == "service":
            expected_type = "mrsSchema"
        elif target_object == "schema":
            expected_type = "mrsObject"
        else:
            raise RuntimeError(
                f"Unable to import data into objects of type: {target_object}.")

        content = None
        try:
            with open(path) as file:
                content = json.load(file)
        except Exception as e:
            raise RuntimeError(
                f"Unable to load from file '{path}': {str(e)}.")

        # Validates it is a valid load scenario
        if content["type"] != expected_type:
            raise RuntimeError(
                f"Unable to load a {content.type} dump into a {target_object}.")

        # Validates that the versions are compatible
        this_version = lib.core.select(
            'mrs_user_schema_version').exec(session).first
        this_version = (this_version["major"],
                        this_version["minor"],
                        this_version["patch"])
        dump_version = (content["version"]["major"],
                        content["version"]["minor"],
                        content["version"]["patch"])

        if this_version < dump_version:
            raise RuntimeError(
                "Unable to load a dump of a newer version of the MRS plugin.")
        elif this_version > dump_version:
            # TODO(rennox): Dump upgrade logic is triggered here
            pass

        grantList = []
        with lib.core.MrsDbTransaction(session):
            if target_object == "service":
                service = lib.services.get_service(
                    session, service_id=object_id)
                _, grant = lib.dump.load_schema_dump(
                    session, object_id, content["schema"], reuse_ids)
                grantList = grantList + grant
            elif target_object == "schema":
                schema = lib.schemas.get_schema(session, schema_id=object_id)
                _, grant = lib.dump.load_object_dump(
                    session, object_id, content["object"], reuse_ids)
                grantList.append(grant)

        for grants in grantList:
            for grant in grants:
                lib.core.MrsDbExec(grant).exec(session)


@plugin_function('mrs.load.schema', shell=True, cli=True, web=True)
def load_schema(path, **kwargs):
    """Loads data for a REST Schema from a JSON file into the target REST service
    Args:
        path (str): The path of the file containing a REST schema dump.
        **kwargs: Options to determine the target object where the import will occur.

    Keyword Args:
        service_id (str): The ID of target service.
        service_name (str): The name of the target service.
        reuse_ids (bool): Indicates whether the existing ids should be reused.
        session (object): The database session to use during the import.
    """
    load(path, **kwargs)


@plugin_function('mrs.load.object', shell=True, cli=True, web=True)
def load_object(path, **kwargs):
    """Loads data for a REST Database Object from a JSON file into the target REST Schema
    Args:
        path (str): The path of the file containing a REST schema dump.
        **kwargs: Options to determine the target object where the import will occur.

    Keyword Args:
        service_id (str): The ID of target service.
        service_name (str): The name of the target service.
        schema_id (str): The ID of the target schema.
        schema_name (str): The name of the target schema.
        reuse_ids (bool): Indicates whether the existing ids should be reused.
        session (object): The database session to use during the import.
    """
    load(path, **kwargs)


@plugin_function('mrs.dump.auditLog', shell=True, cli=True, web=True)
def export_audit_log(file_path, **kwargs):
    """Exports the MRS audit log to a file

    Args:
        file_path (str): The file path to write the audit log to.
        **kwargs: Additional keyword arguments.

    Keyword Args:
        audit_log_position_file (str): The file containing the audit log position. If not provided, a
            mrs_audit_log_position.json file next to the file_path will be created.
        audit_log_position (int): The audit log position to export from. Defaults to 0.
        starting_from_today (bool): Whether to start exporting from today. Defaults to true.
        when_server_is_writeable (bool): Whether to only write out the log when the MySQL server is writeable. Defaults to false.
        session (object): The database session to use.

    Returns:
        None
    """
    session = kwargs.get('session', None)

    try:
        with lib.core.MrsDbSession(session=session) as session:
            lib.dump.export_audit_log(file_path=file_path, session=session, **kwargs)

        # Print successful check/dump to stdout
        print(time.strftime("%Y-%m-%d %H:%M:%S") + " All audit log events have been dumped.\n")
    except Exception as e:
        # Print the error to stderr and re-raise it
        print(time.strftime("%Y-%m-%d %H:%M:%S") + " " + re.sub(r"/n", "\\n", str(e)) + "\n", file=sys.stderr)
        raise e
