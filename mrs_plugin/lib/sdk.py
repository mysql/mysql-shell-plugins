# Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

from mrs_plugin import lib
from pathlib import Path
import os
import re
from string import Template


def get_base_classes(sdk_language, prepare_for_runtime=False):
    if (sdk_language == "TypeScript"):
        fileExt = ".ts"
    else:
        raise Exception(
            f"The SDK language {sdk_language} is not supported yet.")

    path = os.path.abspath(__file__)
    code = Path(os.path.dirname(path), "..", "sdk",
                f"MrsBaseClasses{fileExt}").read_text()

    if (prepare_for_runtime):
        # Remove exports as everything will be in a single file
        code = code.replace("export ", "")
        # Remove the part that does not belong in the runtime SDK
        code = re.sub("\/\/ --- MySQL Shell for VS Code Extension Remove --- Begin.*?" +
                      "\/\/ --- MySQL Shell for VS Code Extension Remove --- End",
                      "", code, flags=re.DOTALL | re.MULTILINE)

    return code


def generate_service_sdk(service, sdk_language, session, prepare_for_runtime=False):
    if (sdk_language == "TypeScript"):
        fileExt = ".ts.template"
    else:
        raise Exception(
            f"The SDK language {sdk_language} is not supported yet.")

    path = os.path.abspath(__file__)
    # code = Path(os.path.dirname(path), "..", "sdk", f"MyService.ts").read_text()
    template = Path(os.path.dirname(path), "..", "sdk",
                    f"MrsServiceTemplate{fileExt}").read_text()

    # Process Template String
    code = substitute_service_in_template(
        service=service, template=template, sdk_language=sdk_language, session=session)

    if (prepare_for_runtime):
        # Remove imports as everything will be in a single file
        code = re.sub('import.*?;', '', code, flags=re.DOTALL | re.MULTILINE)
        # Remove exports as everything will be in a single file
        code = code.replace("export ", "")
        # Remove the part that does not belong in the runtime SDK
        code = re.sub("\/\/ --- MySQL Shell for VS Code Extension Remove --- Begin.*?" +
                      "\/\/ --- MySQL Shell for VS Code Extension Remove --- End",
                      "", code, flags=re.DOTALL | re.MULTILINE)
    else:
        # Remove the part that does not belong in the generated SDK
        code = re.sub("\/\/ --- MySQL Shell for VS Code Extension Only --- Begin.*?" +
                      "\/\/ --- MySQL Shell for VS Code Extension Only --- End",
                      "", code, flags=re.DOTALL | re.MULTILINE)

    return code


def substitute_service_in_template(service, template, sdk_language, session):
    template = substitute_schemas_in_template(
        service=service, template=template, sdk_language=sdk_language, session=session)

    service_host_ctx = service.get("host_ctx")
    # ToDo: Proper detection
    if "http" not in service_host_ctx:
        service_host_ctx = "https://localhost:8443" + service_host_ctx

    mapping = {
        "service_name": lib.core.convert_path_to_camel_case(service.get("url_context_root")),
        "service_class_name": lib.core.convert_path_to_pascal_case(service.get("url_context_root")),
        "service_host_ctx": service_host_ctx,
        "service_auth_path": service.get("auth_path")
    }
    code = Template(template).substitute(**mapping)

    return code


def substitute_schemas_in_template(service, template, sdk_language, session):
    schema_loops = re.finditer(
        "^\s*?// --- schemaLoopStart\n\s*(^[\S\s]*?)^\s*?// --- schemaLoopEnd\n", template, flags=re.DOTALL | re.MULTILINE)

    schemas = lib.schemas.query_schemas(session, service_id=service.get("id"))

    service_class_name = lib.core.convert_path_to_pascal_case(
        service.get("url_context_root"))

    for loop in schema_loops:
        schema_template = loop.group(1)

        filled_temp = ""
        for schema in schemas:
            if "// --- objectLoopStart" in schema_template:
                # Fill inner Object loops
                schema_template_with_obj_filled = substitute_objects_in_template(
                    service=service, schema=schema, template=schema_template, sdk_language=sdk_language, session=session
                )
            else:
                schema_template_with_obj_filled = schema_template

            # Todo: Handle SDK Options
            name = lib.core.convert_path_to_camel_case(schema.get("name"))
            class_name = service_class_name + \
                lib.core.convert_path_to_pascal_case(
                    schema.get("request_path"))
            mapping = {
                "schema_name": name,
                "schema_class_name": class_name,
                "schema_request_path": schema.get("request_path")
            }

            filled_temp += Template(
                schema_template_with_obj_filled).substitute(**mapping)

        template = template.replace(loop.group(), filled_temp)

    return template


def substitute_objects_in_template(service, schema, template, sdk_language, session):
    object_loops = re.finditer(
        "^\s*?// --- objectLoopStart\n\s*(^[\S\s]*?)^\s*?// --- objectLoopEnd\n", template, flags=re.DOTALL | re.MULTILINE)

    db_objs = lib.db_objects.query_db_objects(
        session, schema_id=schema.get("id"))

    service_class_name = lib.core.convert_path_to_pascal_case(
        service.get("url_context_root"))
    schema_class_name = lib.core.convert_path_to_pascal_case(
        schema.get("request_path"))

    crud_ops = ["Create", "Read", "Update", "Delete", "UpdateProcedure"]

    for loop in object_loops:
        filled_temp = ""
        for db_obj in db_objs:
            obj_template = loop.group(1)

            # Remove unsupported CRUD operations for this DB Object
            if not (db_obj.get("object_type") == "PROCEDURE"):
                db_object_crud_ops = db_obj.get("crud_operations", [])
            else:
                # For PROCEDURES, handle custom "UpdateProcedure" operation, delete all other
                db_object_crud_ops = ["UPDATEPROCEDURE"]

            # Loop over all CRUD operations
            for crud_op in crud_ops:
                # Find all // --- crud{crud_op}OnlyStart / End blocks
                crud_op_loops = re.finditer(
                    f"^\s*?// --- crud{crud_op}OnlyStart\n\s*(^[\S\s]*?)^\s*?// --- crud{crud_op}OnlyEnd\n",
                    obj_template, flags=re.DOTALL | re.MULTILINE)

                for crud_loop in crud_op_loops:
                    # If the CRUD operation is enabled for this DB Object, keep the identified code block
                    if (crud_op.upper() in db_object_crud_ops):
                        obj_template = obj_template.replace(
                            crud_loop.group(), crud_loop.group(1))
                    else:
                        # Delete the identified code block otherwise
                        obj_template = obj_template.replace(
                            crud_loop.group(), "")

            # Todo: Handle SDK Options
            name = lib.core.convert_path_to_camel_case(db_obj.get("name"))
            class_name = (service_class_name + schema_class_name +
                          lib.core.convert_path_to_pascal_case(db_obj.get("request_path")))

            getters_setters = ""
            obj_pk_list = []
            obj_quoted_pk_list = []
            obj_string_pk_list = []
            obj_string_args_where_pk_list = []

            # Get objects
            fields = []
            objects = lib.db_objects.get_objects(
                session, db_object_id=db_obj.get("id"))
            if len(objects) > 0:
                # Get fields
                fields = lib.db_objects.get_object_fields_with_references(
                    session=session, object_id=objects[0].get("id"))
                for field in fields:
                    if (field.get("lev") == 1):
                        datatype = get_interface_datatype(
                            field, sdk_language, class_name)
                        getters_setters += (
                            f'    public get {field.get("name")}(): {datatype} | undefined {{ ' +
                            f'return this.fieldsNew.{field.get("name")} ?? this.fields.{field.get("name")}; }}\n' +
                            f'    public set {field.get("name")}(v: {datatype} | undefined) {{ ' +
                            f'this.fieldsNew.{field.get("name")} = v; }}\n\n')
                        # Build Primary Key lists
                        if (field_is_pk(field)):
                            obj_pk_list.append(field.get("name"))
                            obj_quoted_pk_list.append(f'"{field.get("name")}"')
                            obj_string_pk_list.append(
                                f'String({name}.{field.get("name")})')
                            obj_string_args_where_pk_list.append(
                                f'String(args.where.{field.get("name")})')

            obj_interfaces = generate_interfaces(
                db_obj, fields, class_name, sdk_language, session)

            mapping = {
                "obj_name": name,
                "obj_class_name": class_name,
                "obj_request_path": db_obj.get("request_path"),
                "schema_class_name": service_class_name + schema_class_name,
                "schema_request_path": schema.get("request_path"),
                "obj_full_request_path":
                    service.get(
                        "url_context_root") + schema.get("request_path") + db_obj.get("request_path"),
                "obj_type": db_obj.get("object_type"),
                "obj_interfaces": obj_interfaces,
                "obj_getters_setters": getters_setters,
                "obj_pk_list": ", ".join(obj_pk_list),
                "obj_quoted_pk_list": ", ".join(obj_quoted_pk_list),
                "obj_string_pk_list": ", ".join(obj_string_pk_list),
                "obj_string_args_where_pk_list": ", ".join(obj_string_args_where_pk_list)
            }

            filled_temp += Template(obj_template).substitute(**mapping)

        template = template.replace(loop.group(), filled_temp)

    return template

def get_datatype_mapping(db_datatype, sdk_language):
    db_datatype = db_datatype.lower()
    if (sdk_language == "TypeScript"):
        if (db_datatype == "tinyint(1)"):
            datatype = "boolean"
        elif (db_datatype.startswith("tinyint") or
            db_datatype.startswith("smallint") or
            db_datatype.startswith("mediumint") or
            db_datatype.startswith("int") or
            db_datatype.startswith("bigint") or
            db_datatype.startswith("decimal") or
            db_datatype.startswith("numeric") or
            db_datatype.startswith("float") or
                db_datatype.startswith("double")):
            datatype = "number"
        elif (db_datatype == "json"):
            datatype = "object"
        else:
            datatype = "string"

        return datatype
    else:
        return "UNKNOWN"

def get_procedure_datatype_mapping(sp_datatype, sdk_language):
    if (sdk_language == "TypeScript"):
        if (sp_datatype == "BOOLEAN"):
            datatype = "boolean"
        elif (sp_datatype == "NUMBER" or
              sp_datatype == "INT"):
            datatype = "number"
        elif (sp_datatype == "JSON"):
            datatype = "object"
        else:
            datatype = "string"

        return datatype
    else:
        return "UNKNOWN"

def get_interface_datatype(field, sdk_language, class_name="", reference_class_name_postfix=""):
    db_column_info = field.get("db_column")
    if db_column_info:
        db_datatype = db_column_info.get("datatype")

        # Todo: Handle SDK Options

        return get_datatype_mapping(db_datatype, sdk_language)
    else:
        return f'I{class_name}{reference_class_name_postfix}{lib.core.convert_path_to_pascal_case(field.get("name"))}'


def field_is_pk(field):
    if (field.get("lev") == 1):
        db_column_info = field.get("db_column")
        if db_column_info and db_column_info.get("is_primary"):
            return True

    return False


def generate_interfaces(db_obj, fields, class_name, sdk_language, session):
    obj_interfaces = ""
    fields_listing = ""

    # The I{class_name} and I{class_name}Params interfaces
    if (db_obj.get("object_type") == "PROCEDURE"):
        fields = lib.db_objects.get_db_object_fields(session, db_obj.get("id"))
        for field in fields:
            mode = field.get("mode")
            if (mode == "IN" or mode == "INOUT"):
                datatype = get_procedure_datatype_mapping(field.get("datatype"), sdk_language)
                fields_listing += f'    {field.get("name")}?: {datatype},\n'

        obj_interfaces += (f"export interface I{class_name} extends IMrsFetchData {{\n"
                           "    success?: string,\n"
                           "    message?: string,\n"
                           "}\n\n")
        obj_interfaces += (
            f"export interface I{class_name}Params extends IMrsFetchData {{\n" +
            fields_listing +
            "}\n\n")
    else:
        for field in fields:
            if (field.get("lev") == 1):
                datatype = get_interface_datatype(
                    field, sdk_language, class_name)
                fields_listing += f'    {field.get("name")}?: {datatype},\n'
                if field.get("represents_reference_id"):
                    # ToDo: Add reduce-to support
                    obj_interfaces += generate_nested_interfaces(
                        reference_id=field.get("represents_reference_id"),
                        reference_class_name_postfix=lib.core.convert_path_to_pascal_case(
                            field.get("name")),
                        fields=fields, class_name=class_name, sdk_language=sdk_language)

        obj_interfaces += (
            f"export interface I{class_name} extends IMrsBaseObject {{\n" +
            fields_listing +
            "}\n\n")
        obj_interfaces += (
            f"export interface I{class_name}Params {{\n" +
            fields_listing +
            "}\n\n")

    return obj_interfaces


def generate_nested_interfaces(reference_id, reference_class_name_postfix, fields, class_name, sdk_language):
    obj_interfaces = ""
    interface_name = f'I{class_name}{reference_class_name_postfix}'

    fields_listing = ""
    for field in fields:
        if (field.get("parent_reference_id") == reference_id):
            if field.get("db_column"):
                datatype = get_interface_datatype(field, sdk_language)
                fields_listing += f'    {field.get("name")}?: {datatype},\n'
            elif field.get("represents_reference_id"):
                obj_interfaces += generate_nested_interfaces(
                    reference_id=field.get("represents_reference_id"),
                    reference_class_name_postfix=interface_name,
                    fields=fields, class_name=class_name, sdk_language=sdk_language)

    obj_interfaces += (
        f"export interface {interface_name} {{\n" +
        fields_listing +
        "}\n\n")

    return obj_interfaces
