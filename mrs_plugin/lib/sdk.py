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
import json


def get_base_classes(sdk_language, prepare_for_runtime=False):
    if sdk_language == "TypeScript":
        fileExt = ".ts"
    else:
        raise Exception(
            f"The SDK language {sdk_language} is not supported yet.")

    path = os.path.abspath(__file__)
    code = Path(os.path.dirname(path), "..", "sdk",
                f"MrsBaseClasses{fileExt}").read_text()

    if prepare_for_runtime is True:
        # Remove exports as everything will be in a single file
        code = code.replace("export ", "")
        # Remove the part that does not belong in the runtime SDK
        code = re.sub("\/\/ --- MySQL Shell for VS Code Extension Remove --- Begin.*?" +
                      "\/\/ --- MySQL Shell for VS Code Extension Remove --- End",
                      "", code, flags=re.DOTALL | re.MULTILINE)
        code = remove_js_whitespace_and_comments(code)

    return code


def generate_service_sdk(service, sdk_language, session, prepare_for_runtime=False, service_url=None):
    # If no services is given, return only the MRS runtime management TypeScript Code
    # that allows the user to manage specific MRS runtime settings
    if service is None:
        if prepare_for_runtime is True and sdk_language == "TypeScript":
            return remove_js_whitespace_and_comments(get_mrs_runtime_management_code(session=session))
        else:
            return ""

    if sdk_language == "TypeScript":
        fileExt = ".ts.template"
    else:
        raise Exception(
            f"The SDK language {sdk_language} is not supported yet.")

    path = os.path.abspath(__file__)
    template = Path(os.path.dirname(path), "..", "sdk",
                    f"MrsServiceTemplate{fileExt}").read_text()

    # Process Template String
    code = substitute_service_in_template(
        service=service, template=template, sdk_language=sdk_language, session=session, service_url=service_url)

    code = substitute_imports_in_template(
        template=code.get("template"), enabled_crud_ops=code.get("enabled_crud_ops"))

    template = code.get("template")

    if prepare_for_runtime is True:
        # Remove imports as everything will be in a single file
        template = re.sub('import.*?;', '', template,
                          flags=re.DOTALL | re.MULTILINE)
        # Remove exports as everything will be in a single file
        template = template.replace("export ", "")
        # Remove the part that does not belong in the runtime SDK
        template = re.sub("\/\/ --- MySQL Shell for VS Code Extension Remove --- Begin.*?" +
                          "\/\/ --- MySQL Shell for VS Code Extension Remove --- End",
                          "", template, flags=re.DOTALL | re.MULTILINE)
        # Add MRS management code
        template += get_mrs_runtime_management_code(session=session,
                                            service_url=service_url)

        template = remove_js_whitespace_and_comments(template)
    else:
        # Remove the part that does not belong in the generated SDK
        template = re.sub("\/\/ --- MySQL Shell for VS Code Extension Only --- Begin.*?" +
                          "\/\/ --- MySQL Shell for VS Code Extension Only --- End",
                          "", template, flags=re.DOTALL | re.MULTILINE)

    return template


def substitute_imports_in_template(template, enabled_crud_ops):
    import_loops = re.finditer(
        "^\s*?// --- importLoopStart\n\s*(^[\S\s]*?)^\s*?// --- importLoopEnd\n", template, flags=re.DOTALL | re.MULTILINE)

    crud_ops = ["Create", "Read", "Update",
                "Delete", "UpdateProcedure", "ReadUnique"]

    for loop in import_loops:
        import_template = loop.group(1)

        for crud_op in crud_ops:
            # Find all // --- import{crud_op}OnlyStart / End blocks
            crud_op_loops = re.finditer(
                f"^\s*?// --- import{crud_op}OnlyStart\n\s*(^[\S\s]*?)^\s*?// --- import{crud_op}OnlyEnd\n",
                import_template, flags=re.DOTALL | re.MULTILINE)

            for crud_loop in crud_op_loops:
                # If the CRUD operation is enabled for any DB Object, keep the identified code block
                if enabled_crud_ops is not None and crud_op in enabled_crud_ops:
                    import_template = import_template.replace(
                        crud_loop.group(), crud_loop.group(1))
                else:
                    # Delete the identified code block otherwise
                    import_template = import_template.replace(
                        crud_loop.group(), "")

        template = template.replace(loop.group(), import_template)

    return {"template": template, "enabled_crud_ops": enabled_crud_ops}


def substitute_service_in_template(service, template, sdk_language, session, service_url):
    code = substitute_schemas_in_template(
        service=service, template=template, sdk_language=sdk_language, session=session)

    template = code.get("template")

    # If no explicit service_url is given, use the service's host_ctx and url_context_root
    if not service_url:
        host_ctx = service.get("host_ctx")
        url_context_root = service.get("url_context_root")
        # If no host_ctx starting with http is given, default to https://localhost:8443
        if not host_ctx.lower().startswith("http"):
            service_url = "https://localhost:8443" + url_context_root
        else:
            service_url = host_ctx

    mapping = {
        "service_name": lib.core.convert_path_to_camel_case(service.get("url_context_root")),
        "service_class_name": lib.core.convert_path_to_pascal_case(service.get("url_context_root")),
        "service_url": service_url,
        "service_auth_path": service.get("auth_path"),
        "service_id": lib.core.convert_id_to_string(service.get("id")),
    }

    template = Template(template).substitute(**mapping)

    return {"template": template, "enabled_crud_ops": code.get("enabled_crud_ops")}


def substitute_schemas_in_template(service, template, sdk_language, session):
    schema_loops = re.finditer(
        "^\s*?// --- schemaLoopStart\n\s*(^[\S\s]*?)^\s*?// --- schemaLoopEnd\n", template, flags=re.DOTALL | re.MULTILINE)

    schemas = lib.schemas.query_schemas(session, service_id=service.get("id"))

    service_class_name = lib.core.convert_path_to_pascal_case(
        service.get("url_context_root"))

    enabled_crud_ops = None

    for loop in schema_loops:
        schema_template = loop.group(1)

        filled_temp = ""
        for schema in schemas:
            if "// --- objectLoopStart" in schema_template:
                # Fill inner Object loops
                code = substitute_objects_in_template(
                    service=service, schema=schema, template=schema_template, sdk_language=sdk_language, session=session
                )

                schema_template_with_obj_filled = code.get("template")
                enabled_crud_ops = code.get("enabled_crud_ops")
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
                "schema_request_path": schema.get("request_path"),
                "schema_id": lib.core.convert_id_to_string(schema.get("id")),
            }

            filled_temp += Template(
                schema_template_with_obj_filled).substitute(**mapping)

        template = template.replace(loop.group(), filled_temp)

    return {"template": template, "enabled_crud_ops": enabled_crud_ops}


def get_mrs_object_sdk_language_options(sdk_options, sdk_language):
    if not sdk_options or not sdk_options.get("language_options"):
        return {}

    # Find the matching language_options
    for opt in sdk_options.get("language_options"):
        if opt.get("language") == sdk_language:
            return opt

    return {}


def substitute_objects_in_template(service, schema, template, sdk_language, session):
    object_loops = re.finditer(
        "^\s*?// --- objectLoopStart\n\s*(^[\S\s]*?)^\s*?// --- objectLoopEnd\n", template, flags=re.DOTALL | re.MULTILINE)

    db_objs = lib.db_objects.query_db_objects(
        session, schema_id=schema.get("id"))

    service_class_name = lib.core.convert_path_to_pascal_case(
        service.get("url_context_root"))
    schema_class_name = lib.core.convert_path_to_pascal_case(
        schema.get("request_path"))

    crud_ops = ["Create", "Read", "Update",
                "Delete", "UpdateProcedure", "ReadUnique", "ReadFunction"]

    enabled_crud_ops = []

    for loop in object_loops:
        filled_temp = ""
        for db_obj in db_objs:
            # Todo: Handle SDK Options
            name = lib.core.convert_path_to_camel_case(
                db_obj.get("request_path"))
            default_class_name = (service_class_name + schema_class_name +
                                  lib.core.convert_path_to_pascal_case(db_obj.get("request_path")))

            obj_interfaces = ""
            obj_param_interface = "I" + default_class_name + "Params"
            obj_meta_interface = "I" + default_class_name + "Meta"
            getters_setters = ""
            obj_pk_list = []
            obj_quoted_pk_list = []
            obj_string_pk_list = []
            obj_string_args_where_pk_list = []
            obj_unique_list = []
            obj_meta_interfaces = []

            # Get objects
            objects = lib.db_objects.get_objects(
                session, db_object_id=db_obj.get("id"))

            # Loop over all objects and build interfaces
            for obj in objects:
                # Get fields
                fields = lib.db_objects.get_object_fields_with_references(
                    session=session, object_id=obj.get("id"))
                for field in fields:
                    if (field.get("lev") == 1):
                        # Build Primary Key lists
                        if (field_is_pk(field)):
                            obj_pk_list.append(field.get("name"))
                            obj_quoted_pk_list.append(f'"{field.get("name")}"')
                            obj_string_pk_list.append(
                                f'String({name}.{field.get("name")})')
                            obj_string_args_where_pk_list.append(
                                f'String(args.where.{field.get("name")})')
                        # Build Unique list
                        if (field_is_unique(field)):
                            obj_unique_list.append(field.get("name"))

                # Get sdk_language specific options
                sdk_lang_options = get_mrs_object_sdk_language_options(
                    obj.get("sdk_options"), sdk_language)

                # Either take the custom interface_name or the default class_name
                class_name = sdk_lang_options.get(
                    "class_name", obj.get("name"))

                obj_interfaces_def, out_params_interface_fields = generate_interfaces(
                    db_obj, obj, fields, class_name, sdk_language, session)
                # Do not add obj_interfaces for FUNCTION results
                if obj.get("kind") == "PARAMETERS" or db_obj.get("object_type") != "FUNCTION":
                    obj_interfaces += obj_interfaces_def

                if db_obj.get("object_type") == "PROCEDURE" or db_obj.get("object_type") == "FUNCTION":
                    if obj.get("kind") == "PARAMETERS":
                        obj_param_interface = obj.get("name")
                    if obj.get("kind") != "PARAMETERS":
                        obj_meta_interfaces.append(class_name)
                    if len(out_params_interface_fields) > 0:
                        obj_meta_interfaces.append(class_name + "Out")

            # If there are no result sets defined for a Store Procedure, the return type must be IMrsProcedureResult
            if len(objects) == 1 and obj.get("kind") == "PARAMETERS":
                if len(out_params_interface_fields) == 0:
                    obj_meta_interface = "IMrsProcedureResult"
                else:
                    obj_meta_interfaces.append("MrsProcedure")

            # If the db object is a function, get the return datatype
            obj_function_result_datatype = None
            if db_obj.get("object_type") == "FUNCTION":
                obj_function_result_datatype = "unknown"
                if len(objects) > 1:
                    fields = lib.db_objects.get_object_fields_with_references(
                        session=session, object_id=objects[1].get("id"))

                    if len(fields) > 0:
                        db_column_info = field.get("db_column")
                        if db_column_info:
                            obj_function_result_datatype = get_datatype_mapping(
                                db_datatype=db_column_info.get("datatype"), db_not_null=False,
                                sdk_language=sdk_language)

            if len(obj_meta_interfaces) > 0 and db_obj.get("object_type") != "FUNCTION":
                if sdk_language == "TypeScript":
                    interface_list = [
                        "I" + x + "Result" for x in obj_meta_interfaces]
                    obj_interfaces += f'export type {obj_meta_interface} = {" | ".join(interface_list)};\n\n'

            # Define the mappings
            mapping = {
                "obj_id": lib.core.convert_id_to_string(db_obj.get("id")),
                "obj_name": name,
                "obj_class_name": class_name,
                "obj_param_interface": obj_param_interface,
                "obj_meta_interface": obj_meta_interface,
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
                "obj_string_args_where_pk_list": ", ".join(obj_string_args_where_pk_list),
                "obj_function_result_datatype": obj_function_result_datatype
            }

            # Remove unsupported CRUD operations for this DB Object
            if db_obj.get("object_type") != "PROCEDURE" and db_obj.get("object_type") != "FUNCTION":
                db_object_crud_ops = db_obj.get("crud_operations", [])
                # If this DB Object has unique columns (PK or UNIQUE) allow ReadUnique
                # cSpell:ignore READUNIQUE
                if len(obj_unique_list) > 0 and not "READUNIQUE" in db_object_crud_ops:
                    db_object_crud_ops.append("READUNIQUE")
            elif db_obj.get("object_type") == "PROCEDURE":
                # For PROCEDUREs, handle custom "UpdateProcedure" operation, delete all other
                db_object_crud_ops = ["UPDATEPROCEDURE"]
            elif db_obj.get("object_type") == "FUNCTION":
                # For FUNCTIONs, handle custom "ReadFunction" operation, delete all other
                db_object_crud_ops = ["READFUNCTION"]

            # Loop over all CRUD operations and filter the sections that are not applicable for the specific object
            obj_template = loop.group(1)
            for crud_op in crud_ops:
                # Find all // --- crud{crud_op}OnlyStart / End blocks
                crud_op_loops = re.finditer(
                    f"^\s*?// --- crud{crud_op}OnlyStart\n\s*(^[\S\s]*?)^\s*?// --- crud{crud_op}OnlyEnd\n",
                    obj_template, flags=re.DOTALL | re.MULTILINE)

                for crud_loop in crud_op_loops:
                    # If the CRUD operation is enabled for this DB Object, keep the identified code block
                    if (crud_op.upper() in db_object_crud_ops):
                        enabled_crud_ops.append(crud_op)
                        obj_template = obj_template.replace(
                            crud_loop.group(), crud_loop.group(1))
                    else:
                        # Delete the identified code block otherwise
                        obj_template = obj_template.replace(
                            crud_loop.group(), "")

            # Perform the substitution
            filled_temp += Template(obj_template).substitute(**mapping)

        template = template.replace(loop.group(), filled_temp)

    return {"template": template, "enabled_crud_ops": frozenset(enabled_crud_ops)}


def get_datatype_mapping(db_datatype, db_not_null, sdk_language):
    db_datatype = db_datatype.lower()
    if (sdk_language == "TypeScript"):
        if (db_datatype.startswith("tinyint(1)") or db_datatype.startswith("bit(1)")):
            datatype = "boolean" if db_not_null else "MaybeNull<boolean>"
        elif (db_datatype.startswith("tinyint") or
              db_datatype.startswith("smallint") or
              db_datatype.startswith("mediumint") or
              db_datatype.startswith("int") or
              db_datatype.startswith("bigint") or
              db_datatype.startswith("decimal") or
              db_datatype.startswith("numeric") or
              db_datatype.startswith("float") or
                db_datatype.startswith("double")):
            datatype = "number" if db_not_null else "MaybeNull<number>"
        elif (db_datatype.startswith("json")):
            datatype = "JsonValue" if db_not_null else "MaybeNull<JsonValue>"
        elif (db_datatype.startswith("geometrycollection")):
            datatype = "GeometryCollection" if db_not_null else "MaybeNull<GeometryCollection>"
        elif (db_datatype.startswith("geometry")):
            datatype = "Geometry" if db_not_null else "MaybeNull<Geometry>"
        elif (db_datatype.startswith("point")):
            datatype = "Point" if db_not_null else "MaybeNull<Point>"
        elif (db_datatype.startswith("multipoint")):
            datatype = "MultiPoint" if db_not_null else "MaybeNull<MultiPoint>"
        elif (db_datatype.startswith("linestring")):
            datatype = "LineString" if db_not_null else "MaybeNull<LineString>"
        elif (db_datatype.startswith("multilinestring")):
            datatype = "MultiLineString" if db_not_null else "MaybeNull<MultiLineString>"
        elif (db_datatype.startswith("polygon")):
            datatype = "Polygon" if db_not_null else "MaybeNull<Polygon>"
        elif (db_datatype.startswith("multipolygon")):
            datatype = "MultiPolygon" if db_not_null else "MaybeNull<MultiPolygon>"
        else:
            datatype = "string" if db_not_null else "MaybeNull<string>"

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
        db_not_null = db_column_info.get("not_null")

        # Todo: Handle SDK Options

        return get_datatype_mapping(db_datatype, db_not_null, sdk_language)
    else:
        return f'I{class_name}{reference_class_name_postfix}{lib.core.convert_path_to_pascal_case(field.get("name"))}'


def field_is_pk(field):
    if (field.get("lev") == 1):
        db_column_info = field.get("db_column")
        if db_column_info and db_column_info.get("is_primary"):
            return True

    return False


def field_is_unique(field):
    if (field.get("lev") == 1):
        db_column_info = field.get("db_column")
        if db_column_info and (db_column_info.get("is_primary") or db_column_info.get("is_unique")):
            return True

    return False


def get_field_by_id(fields, id):
    for field in fields:
        if field.get("id") == id:
            return field

    return None


def get_reduced_field_interface_datatype(field, fields, sdk_language, class_name):
    if field.get("represents_reference_id"):
        obj_ref = field.get("object_reference")

        # Check if the field should be reduced to the value of another field
        ref_field_id = obj_ref.get("reduce_to_value_of_field_id")
        if obj_ref and ref_field_id:
            # Convert id to binary
            ref_field_id = lib.core.id_to_binary(
                ref_field_id, "reduce_to_value_of_field_id")

            # Lookup the field to reduce to
            ref_field = get_field_by_id(fields, ref_field_id)
            if ref_field:
                datatype = get_interface_datatype(
                    ref_field, sdk_language, class_name)

                # If the reference mapping is "to_many", use an array
                ref_mapping = obj_ref.get("reference_mapping")
                is_array = "[]" if ref_mapping and ref_mapping.get(
                    "to_many") == True else ""

                return datatype + is_array

    return None


def generate_interfaces(db_obj, obj, fields, class_name, sdk_language, session):
    obj_interfaces = []
    interface_fields = []
    param_interface_fields = []
    out_params_interface_fields = []
    obj_unique_list = []

    # The I{class_name}, I{class_name}Params and I{class_name}Out interfaces
    for field in fields:
        db_column = field.get("db_column", {})
        # The field needs to be on level 1 and enabled
        if field.get("lev") == 1 and field.get("enabled"):
            datatype = get_interface_datatype(
                field, sdk_language, class_name)

            # Handle references
            if field.get("represents_reference_id"):
                # Check if the field should be reduced to the value of another field
                reduced_to_datatype = get_reduced_field_interface_datatype(
                    field, fields, sdk_language, class_name)
                if reduced_to_datatype:
                    interface_fields.append(
                        f'    {field.get("name")}?: {reduced_to_datatype},\n')
                else:
                    obj_ref = field.get("object_reference")
                    # Add field if the referred table is not unnested
                    if not obj_ref.get("unnest"):
                        # If this field represents an OUT parameter of a SP, add it to the
                        # out_params_interface_fields list
                        if obj.get("kind") == "PARAMETERS" and db_column.get("out"):
                            out_params_interface_fields.append(
                                f'    {field.get("name")}?: {datatype},\n')
                        else:
                            # Don't add SP params to result interfaces (OUT params are added to their own list)
                            if obj.get("kind") != "PARAMETERS":
                                interface_fields.append(
                                    f'    {field.get("name")}?: {datatype},\n')

                            # Add all table fields that have allow_filtering set and SP params to the
                            # param_interface_fields
                            if ((field.get("allow_filtering") and db_obj.get("object_type") != "PROCEDURE" and
                                 db_obj.get("object_type") != "FUNCTION")
                                    or obj.get("kind") == "PARAMETERS"):
                                param_interface_fields.append(
                                    f'    {field.get("name")}?: {datatype},\n')

                    # Call recursive interface generation
                    generate_nested_interfaces(
                        obj_interfaces, interface_fields, field,
                        reference_class_name_postfix=lib.core.convert_path_to_pascal_case(
                            field.get("name")),
                        fields=fields, class_name=class_name, sdk_language=sdk_language)
            else:
                # If this field represents an OUT parameter of a SP, add it to the
                # out_params_interface_fields list
                if obj.get("kind") == "PARAMETERS" and db_column.get("out"):
                    out_params_interface_fields.append(
                        f'    {field.get("name")}?: {datatype},\n')
                else:
                    if obj.get("kind") != "PARAMETERS":
                        interface_fields.append(
                            f'    {field.get("name")}?: {datatype},\n')

                    # Add all table fields that have allow_filtering set and SP params to the param_interface_fields
                    if ((field.get("allow_filtering") and db_obj.get("object_type") != "PROCEDURE" and
                         db_obj.get("object_type") != "FUNCTION")
                            or obj.get("kind") == "PARAMETERS"):
                        param_interface_fields.append(
                            f'    {field.get("name")}?: {datatype},\n')

                    # Build Unique list
                    if (field_is_unique(field)):
                        obj_unique_list.append(
                            f'    {field.get("name")}?: {datatype},\n')

    if len(interface_fields) > 0:
        extends = "extends IMrsBaseObject "
        if db_obj.get("object_type") == "PROCEDURE" or db_obj.get("object_type") == "FUNCTION":
            if obj.get("kind") != "PARAMETERS":
                obj_interfaces.append(
                    f"export interface I{class_name}Result {{\n" +
                    f'    type: "{class_name}",\n' +
                    f'    items: I{class_name}[],\n' +
                    "}\n\n")
            extends = ""

        obj_interfaces.append(
            f"export interface I{class_name} {extends}{{\n" +
            "".join(interface_fields) +
            "}\n\n")

    if len(param_interface_fields) > 0:
        params = "Params" if obj.get("kind") != "PARAMETERS" else ""
        obj_interfaces.append(
            f"export interface I{class_name}{params} extends IMrsFetchData {{\n" +
            "".join(param_interface_fields) +
            "}\n\n")
    elif obj.get("kind") == "PARAMETERS":
        params = "Params" if obj.get("kind") != "PARAMETERS" else ""
        obj_interfaces.append(
            f"export interface I{class_name}{params} extends IMrsFetchData {{\n" +
            "}\n\n")

    if len(out_params_interface_fields) > 0:
        obj_interfaces.append(
            f"export interface I{class_name}OutResult {{\n" +
            f'    type: "I{class_name}Out",\n' +
            f'    items: I{class_name}Out[],\n' +
            "}\n\n")

        obj_interfaces.append(
            f"export interface I{class_name}Out {{\n" +
            "".join(out_params_interface_fields) +
            "}\n\n")

    if len(obj_unique_list) > 0:
        obj_interfaces.append(
            f"export interface I{class_name}UniqueParams {{\n" +
            "".join(obj_unique_list) +
            "}\n\n")

    return "".join(obj_interfaces), out_params_interface_fields


def generate_nested_interfaces(
        obj_interfaces, parent_interface_fields, parent_field,
        reference_class_name_postfix,
        fields, class_name, sdk_language):
    # Build interface name
    interface_name = f'I{class_name}{reference_class_name_postfix}'

    # Check if the reference has unnest set, and if so, use the parent_interface_fields
    parent_obj_ref = parent_field.get("object_reference")
    interface_fields = [] if not parent_obj_ref.get(
        "unnest") else parent_interface_fields

    for field in fields:
        if (field.get("parent_reference_id") == parent_field.get("represents_reference_id") and
                field.get("enabled")):
            # Handle references
            if field.get("represents_reference_id"):
                # Check if the field should be reduced to the value of another field
                reduced_to_datatype = get_reduced_field_interface_datatype(
                    field, fields, sdk_language, class_name)
                if reduced_to_datatype:
                    interface_fields.append(
                        f'    {field.get("name")}?: {reduced_to_datatype},\n')
                else:
                    obj_ref = field.get("object_reference")
                    field_interface_name = lib.core.convert_path_to_pascal_case(
                        field.get("name"))
                    # Add field if the referred table is not unnested
                    if not obj_ref.get("unnest"):
                        datatype = f'I{class_name}{reference_class_name_postfix + field.get("name")}'
                        # Should use the corresponding nested field type.
                        interface_fields.append(
                            f'    {field.get("name")}?: {interface_name + field_interface_name},\n')

                    # If not, do recursive call
                    generate_nested_interfaces(
                        obj_interfaces, interface_fields, field,
                        reference_class_name_postfix=reference_class_name_postfix + field_interface_name,
                        fields=fields, class_name=class_name, sdk_language=sdk_language)
            else:
                datatype = get_interface_datatype(field, sdk_language)
                interface_fields.append(
                    f'    {field.get("name")}?: {datatype},\n')

    if not parent_obj_ref.get("unnest"):
        obj_interfaces.append(
            f"export interface {interface_name} {{\n{''.join(interface_fields)}}}\n\n")


def get_mrs_runtime_management_code(session, service_url=None):
    """Returns TypeScript code that allows the user to manage specific MRS runtime settings.

    This includes the configuration status of MRS with an info string giving context sensitive
    information how and the list of available REST services with their URL and
    and methods to set which REST services is the current one and to print the SDK runtime code.

    Args:
        session (object): The database session to use.
        service_url (str): The URL of the current REST service

    Returns:
        The TypeScript code that defines and sets the mrs object
    """
    status = lib.general.get_status(session)

    if status['service_configured'] is True:
        services = lib.services.get_services(session=session)
    else:
        services = []

    s = """
class MrsService {
    #serviceId: string;

    public constructor(serviceId: string) {
        this.#serviceId = serviceId;
    }

    public setAsCurrent = () => {
        mrsSetCurrentService(this.#serviceId);
    };

    public edit = () => {
        mrsEditService(this.#serviceId);
    };

    public exportSdk = () => {
        mrsExportServiceSdk(this.#serviceId);
    };
}

class Mrs {
"""
    serviceList = []
    for service in services:
        service_name = lib.core.convert_path_to_camel_case(
            service.get("url_context_root"))
        service_id = lib.core.convert_id_to_string(service.get("id"))
        # If no explicit service_url is given, use the service's host_ctx and url_context_root
        if not service_url or service.get("is_current") == 0:
            host_ctx = service.get("host_ctx")
            url_context_root = service.get("url_context_root")
            # If no host_ctx starting with http is given, default to https://localhost:8443
            if not host_ctx.lower().startswith("http"):
                service_url = "https://localhost:8443" + url_context_root
            else:
                service_url = url_context_root + url_context_root

        if service.get("is_current") == 1:
            s += f'    public {service_name} = {service_name};\n'
        else:
            s += f'    public {service_name}: MrsService = new MrsService("{service_id}");\n'
        serviceList.append({
            "serviceName": service_name, "url": service_url, "isCurrent": service.get("is_current") == 1})

    if status['service_configured'] is False:
        statusOutput = {
            "configured": False,
            "info": "The MySQL REST Service has not been configured on this MySQL instance yet. Switch to " +
            "SQL mode and use the CONFIGURE REST METADATA command to configure the instance.",
            "services": []}
    elif len(serviceList) == 0:
        statusOutput = {
            "configured": True,
            "info": "No REST service has been created yet. Switch to SQL Mode and use the " +
            "CREATE REST SERVICE command to create a new REST service.",
            "services": []}
    else:
        statusOutput = {
            "configured": True,
            "info": f'{len(serviceList)} REST service{"s" if len(serviceList) > 1 else ""} available.',
            "services": serviceList}

    s += f"""
    public getStatus = () => {{
        return {json.dumps(statusOutput)};
    }}

    public printSdkCode = () => {{
        mrsPrintSdkCode();
    }}
}}

const mrs = new Mrs();
"""

    return s


def replace_group_1_match_only(m):
    return "" if m.group(1) is not None else m.group(0)


def remove_js_whitespace_and_comments(code):
    # Remove comments. This regex does not match single line comments that
    # include a " character, which is ignored for simplicity.
    code = re.sub(r"/\*.*?\*/|//[^\"]*?$", "",
                  code, flags=re.DOTALL | re.MULTILINE)

    # Remove all empty linebreaks
    code = re.sub(r"^\s*\n", "", code, flags=re.DOTALL | re.MULTILINE)

    # Substitute leading spaces with tabs
    code = re.sub(r"    ", "\t", code, flags=re.DOTALL | re.MULTILINE)

    return code
