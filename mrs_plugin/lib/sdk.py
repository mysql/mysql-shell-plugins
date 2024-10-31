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

from typing import Optional, Set
from mrs_plugin import lib
from pathlib import Path
import os
import re
from string import Template
import json


# TODO: this skeleton should be extracted into a template file.
# |--------------- CREATE'S EXECUTION PATH ---------------|
# Primary key may or not be `None`, therefore, `rest_document_id`
# may or not be defined. If `rest_document_id` is defined, then the
# update's execution path will be added where defined values are handled.
SDK_PYTHON_DATACLASS_TEMPLATE_UPSERT_CREATE = '''
        if rest_document_id is UndefinedField:
            request = MrsBaseObjectCreate[
                INew{name}, I{name}Details
            ](
                schema=self._schema,
                request_path=self._request_path,
                data=cast(INew{name}, asdict(self)),
            )
            return self.__load_fields(
                cast(I{name}Data, await request.submit())
            )
'''

# TODO: this skeleton should be extracted into a template file.
# |--------------- UPDATE'S EXECUTION PATH ---------------|
# Primary key name isn't `None`, otherwise this
# execution path wouldn't have been added to `upsert()`.
# Therefore, `rest_document_id` is defined.
SDK_PYTHON_DATACLASS_TEMPLATE_UPSERT_UPDATE = '''
        await MrsBaseObjectUpdate[I{name}, I{name}Details](
            schema=self._schema,
            request_path=f"{{self._request_path}}/{{rest_document_id}}",
            data=self,
        ).submit()
'''

# TODO: this skeleton should be extracted into a template file.
SDK_PYTHON_DATACLASS_TEMPLATE_UPSERT = '''

    async def upsert(self) -> None:
        """Create or update a new resource represented by the data class instance.

        If the specified primary key already exists an `update`
        will happen, otherwise a `create`.
        """
        prk_name = self.get_primary_key_name()
        rest_document_id = UndefinedField

        if prk_name is not None and hasattr(self, prk_name):
            rest_document_id = getattr(self, prk_name){create_snippet}{update_snippet}
'''

# TODO: this skeleton should be extracted into a template file.
# |--------------- DELETE'S EXECUTION PATH ---------------|
# If primary key name is `None`, this execution path shouldn't be added.
# NOTE: We should add `type: ignore[misc]` (see below) because `prk_name`
# is expected to be a literal string but it should be determined on-the-fly
# if we want to rely on `get_primary_key_name()` to get it.
SDK_PYTHON_DATACLASS_TEMPLATE_DELETE = '''

    async def delete(self, read_own_writes: bool = False) -> None:
        """Deletes the resource represented by the data class instance."""
        prk_name = cast(str, self.get_primary_key_name())
        rest_document_id = getattr(self, prk_name)
        options = {{
            "where": {{prk_name: f"{{rest_document_id}}"}},
            "read_own_writes": read_own_writes
        }}

        _ = await MrsBaseObjectDelete[I{name}Filterable](
            schema=self._schema,
            request_path=f"{{self._request_path}}",
            options=cast(DeleteOptions, options),
        ).submit()
'''

# TODO: this skeleton should be extracted into a template file.
SDK_PYTHON_DATACLASS_TEMPLATE = '''@dataclass(init=False, repr=True)
class I{name}(MrsDocument):

    # For data attributes, `None` means "NULL" and
    # `UndefinedField` means "not set or undefined"
{join_field_block}

    def __init__(self, schema: MrsBaseSchema, data: I{name}Data) -> None:
        """Actor data class."""
        self._schema: MrsBaseSchema = schema
        self._request_path: str = "{obj_endpoint}"
        self.__load_fields(data)

    def __load_fields(self, data: I{name}Data) -> None:
        """Refresh data fields based on the input data."""
{join_assignment_block}

        for key in MrsDocument._reserved_keys:
            self.__dict__.update({{key: data.get(key)}})

    @classmethod
    def get_primary_key_name(cls) -> Optional[str]:
        """Get primary key name.

        Returns:
            `str` when there is a primary key, `None` otherwise.
        """
        return {primary_key_name}{upsert_method}{delete_method}
'''


class LanguageNotSupportedError(Exception):
    def __init__(self, sdk_language):
        self.message = f"The SDK language {sdk_language} is not supported yet."


def get_base_classes(sdk_language, prepare_for_runtime=False):
    if sdk_language == "TypeScript":
        file_name = "MrsBaseClasses.ts"
    elif sdk_language == "Python":
        file_name = "mrs_base_classes.py"
    else:
        raise LanguageNotSupportedError(sdk_language)

    path = os.path.abspath(__file__)
    code = Path(os.path.dirname(path), "..", "sdk", sdk_language.lower(),
                file_name).read_text()

    if prepare_for_runtime is True:
        # Remove exports as everything will be in a single file
        code = code.replace("export ", "")
        # Remove the part that does not belong in the runtime SDK
        delimiter = language_comment_delimiter(sdk_language)
        code = re.sub(f"^\\s*?{delimiter} --- MySQL Shell for VS Code Extension Remove --- Begin.*?" +
                      f"^\\s*?{delimiter} --- MySQL Shell for VS Code Extension Remove --- End\n",
                      "", code, flags=re.DOTALL | re.MULTILINE)
        code = remove_js_whitespace_and_comments(code)

    return code


def generate_service_sdk(service, sdk_language, session, prepare_for_runtime=False, service_url=None):
    # If no services is given, return only the MRS runtime management TypeScript Code
    # that allows the user to manage specific MRS runtime settings
    if service is None:
        if prepare_for_runtime is True and sdk_language == "TypeScript":
            return remove_js_whitespace_and_comments(get_mrs_runtime_management_code(session=session))
        return ""

    if sdk_language == "TypeScript":
        file_name = "MrsServiceTemplate.ts.template"
    elif sdk_language == "Python":
        file_name = "mrs_service_template.py.template"
    else:
        raise LanguageNotSupportedError(sdk_language)

    path = os.path.abspath(__file__)
    template = Path(os.path.dirname(path), "..", "sdk", sdk_language.lower(),
                    file_name).read_text()

    # Process Template String
    code = substitute_service_in_template(
        service=service, template=template, sdk_language=sdk_language, session=session, service_url=service_url)

    code = substitute_imports_in_template(
        template=code.get("template"), enabled_crud_ops=code.get("enabled_crud_ops"),
        required_datatypes=code.get("required_datatypes"), sdk_language=sdk_language,
        requires_auth=code.get("requires_auth", False)
        )

    template = code.get("template")
    delimiter = language_comment_delimiter(sdk_language)

    if prepare_for_runtime is True:
        # Remove imports as everything will be in a single file
        template = re.sub('import.*?;', '', template,
                          flags=re.DOTALL | re.MULTILINE)
        # Remove exports as everything will be in a single file
        template = template.replace("export ", "")
        # Remove the part that does not belong in the runtime SDK
        template = re.sub(f"^[^\\S\r\n]*?{delimiter} --- MySQL Shell for VS Code Extension Remove --- Begin.*?" +
                          f"^\\s*?{delimiter} --- MySQL Shell for VS Code Extension Remove --- End\n",
                          "", template, flags=re.DOTALL | re.MULTILINE)
        # Add MRS management code
        template += get_mrs_runtime_management_code(session=session,
                                            service_url=service_url)

        template = remove_js_whitespace_and_comments(template)
    else:
        # Remove the part that does not belong in the generated SDK
        template = re.sub(f"^[^\\S\r\n]*?{delimiter} --- MySQL Shell for VS Code Extension Only --- Begin.*?" +
                          f"^\\s*?{delimiter} --- MySQL Shell for VS Code Extension Only --- End\n",
                          "", template, flags=re.DOTALL | re.MULTILINE)

    return template


def substitute_imports_in_template(
    template,
    sdk_language,
    enabled_crud_ops: set[str] = set(),
    required_datatypes: set[str] = set(),
    requires_auth: bool = False,
):
    delimiter = language_comment_delimiter(sdk_language)
    import_loops = re.finditer(
        f"^[^\\S\r\n]*?{delimiter} --- importLoopStart\n\\s*(^[\\S\\s]*?)^\\s*?{delimiter} --- importLoopEnd\n",
        template,
        flags=re.DOTALL | re.MULTILINE,
    )

    ops = [
        "Create",
        "Read",
        "Update",
        "Delete",
        "ProcedureCall",
        "ReadUnique",
        "FunctionCall",
        "Authenticate",
    ]

    enabled_ops = enabled_crud_ops if enabled_crud_ops else set()

    if requires_auth:
        enabled_ops.add("Authenticate")

    for loop in import_loops:
        import_template = loop.group(1)

        # if there are no required datatypes, we should remove the template tags
        datatypes_block = ""
        # otherwise we should replace them with the corresponding import block
        if len(required_datatypes) > 0:
            # tab size to be converted to spaces
            indent = " " * 4
            # each datatype should be comma separated and belongs in a new line
            separator = f",\n{indent}"
            # The first and last datatypes should also follow the same rules and they should be sorted alphabetically,
            # mostly for testing purposes, but it is always good to be deterministic.
            datatypes_block = f"{indent}{separator.join(sorted(required_datatypes))},\n"

        import_template = re.sub(
            f"^[^\\S\r\n]*?{delimiter} --- importRequiredDatatypesOnlyStart.*?"
            + f"^\\s*?{delimiter} --- importRequiredDatatypesOnlyEnd\n",
            datatypes_block,
            import_template,
            flags=re.DOTALL | re.MULTILINE,
        )

        for op in ops:
            # Find all "import{crud_op}OnlyStart / End" blocks
            op_loops = re.finditer(
                f"^[^\\S\r\n]*?{delimiter} --- import{op}OnlyStart\n\\s*(^[\\S\\s]*?)^\\s*?{delimiter} --- import{op}OnlyEnd\n",
                import_template,
                flags=re.DOTALL | re.MULTILINE,
            )

            for op_loop in op_loops:
                # If the `CRUD + Auth` operation is enabled for any DB Object, keep the identified code block
                if op in enabled_ops:
                    import_template = import_template.replace(
                        op_loop.group(), op_loop.group(1)
                    )
                else:
                    # Delete the identified code block otherwise
                    # This cannot happen, because the block is gone for the next db object
                    import_template = import_template.replace(op_loop.group(), "")

        template = template.replace(loop.group(), import_template)

    return {
        "template": template,
        "enabled_crud_ops": enabled_crud_ops,
        "required_datatypes": required_datatypes,
    }


def substitute_service_in_template(service, template, sdk_language, session, service_url):
    service_level_constants = ""
    service_level_type_definitions = ""

    code = substitute_schemas_in_template(
        service=service,
        template=template,
        sdk_language=sdk_language,
        session=session,
        service_url=service_url)

    template = code.get("template")
    requires_auth = code.get("requires_auth")

    # if no db object requires auth, the authentication command should not be generated for this service
    delimiter = language_comment_delimiter(sdk_language)
    auth_loops = re.finditer(
        pattern=(
            "^[^\\S\r\n]*?"
            f"{delimiter} --- serviceAuthenticateStart"
            "\n\\s*(^[\\S\\s]*?)^\\s*?"
            f"{delimiter} --- serviceAuthenticateEnd\n"
        ),
        string=template,
        flags=re.DOTALL | re.MULTILINE
    )
    for auth_loop in auth_loops:
        if requires_auth:
            template = template.replace(auth_loop.group(), auth_loop.group(1))
        else:
            template = template.replace(auth_loop.group(), "")

    service_id = service.get("id")
    # Auth App infrastructure should only be generated if the service contains a
    # db object that requires authentication
    if requires_auth:
        service_auth_apps = [
            {
                "name": auth_app.get("name"),
                "vendor_id": auth_app.get("auth_vendor_id").hex(),
            }
            for auth_app in lib.auth_apps.get_auth_apps(
                session=session, service_id=service_id, include_enable_state=True
            )
            # Todo: include apps from all vendors
            # for now, only include MRS vendor (0x30000000000000000000000000000000) auth apps
            if auth_app.get("auth_vendor_id").hex() == "30000000000000000000000000000000"
        ]

        service_class_name = lib.core.convert_path_to_pascal_case(service.get("url_context_root"))
        if sdk_language != "TypeScript":
            # Until the authentication workflow is updated on TypeScript, we should not generate the constant.
            service_level_constants += generate_sequence_constant(name="AUTH_APPS", values=service_auth_apps,
                                                                sdk_language=sdk_language)

        if len(service_auth_apps) > 0:
            service_level_type_definitions += generate_enum(
                name=f"{service_class_name}AuthApp",
                values=[auth_app.get("name") for auth_app in service_auth_apps],
                sdk_language=sdk_language,
            )
        else:
            service_level_type_definitions += generate_type_declaration_placeholder(
                name=f"{service_class_name}AuthApp", sdk_language=sdk_language
            )

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
        "service_level_constants": service_level_constants,
        "service_level_type_definitions": service_level_type_definitions,
        "service_name": lib.core.convert_path_to_camel_case(service.get("url_context_root")),
        "service_class_name": lib.core.convert_path_to_pascal_case(service.get("url_context_root")),
        "service_url": service_url,
        "service_auth_path": service.get("auth_path"),
        "service_id": lib.core.convert_id_to_string(service_id),
    }

    template = Template(template).substitute(**mapping)

    return {"template": template, "enabled_crud_ops": code.get("enabled_crud_ops"), "required_datatypes": code.get("required_datatypes"), "requires_auth": requires_auth}


def substitute_schemas_in_template(service, template, sdk_language, session, service_url):
    delimiter = language_comment_delimiter(sdk_language)
    schema_loops = re.finditer(
        f"^[^\\S\r\n]*?{delimiter} --- schemaLoopStart\n\\s*(^[\\S\\s]*?)^\\s*?{delimiter} --- schemaLoopEnd\n", template, flags=re.DOTALL | re.MULTILINE)

    schemas = lib.schemas.query_schemas(session, service_id=service.get("id"))

    service_class_name = lib.core.convert_path_to_pascal_case(
        service.get("url_context_root"))

    enabled_crud_ops = set()
    required_datatypes = set()
    requires_auth = False

    for loop in schema_loops:
        schema_template = loop.group(1)

        filled_temp = ""
        for schema in schemas:
            # TODO: Implement support for MRS Scripts
            if schema.get("schema_type") == "SCRIPT_MODULE":
                continue

            if requires_auth is False:
                requires_auth |= schema.get("requires_auth") == 1

            delimiter = language_comment_delimiter(sdk_language)
            if f"{delimiter} --- objectLoopStart" in schema_template:
                # Fill inner Object loops
                code = substitute_objects_in_template(
                    service=service, schema=schema, template=schema_template, sdk_language=sdk_language, session=session, service_url=service_url
                )

                schema_template_with_obj_filled = code.get("template")
                enabled_crud_ops.update(code.get("enabled_crud_ops"))
                required_datatypes.update(code.get("required_datatypes"))

                if requires_auth is False:
                    requires_auth |= code.get("requires_auth")
            else:
                schema_template_with_obj_filled = schema_template

            # Todo: Handle SDK Options
            name = lib.core.convert_path_to_camel_case(schema.get("name"))
            if sdk_language == "Python":
                name = lib.core.convert_to_snake_case(name)

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

    return {"template": template, "enabled_crud_ops": enabled_crud_ops, "required_datatypes": required_datatypes, "requires_auth": requires_auth}


def get_mrs_object_sdk_language_options(sdk_options, sdk_language):
    if not sdk_options or not sdk_options.get("language_options"):
        return {}

    # Find the matching language_options
    for opt in sdk_options.get("language_options"):
        if opt.get("language") == sdk_language:
            return opt

    return {}


def language_comment_delimiter(sdk_language):
    if sdk_language == "TypeScript":
        return "//"
    if sdk_language == "Python":
        return "#"


def substitute_objects_in_template(service, schema, template, sdk_language, session, service_url):
    delimiter = language_comment_delimiter(sdk_language)
    object_loops = re.finditer(
        f"^[^\\S\r\n]*?{delimiter} --- objectLoopStart\n\\s*(^[\\S\\s]*?)^\\s*?{delimiter} --- objectLoopEnd\n",
        template, flags=re.DOTALL | re.MULTILINE)

    db_objs = lib.db_objects.query_db_objects(
        session, schema_id=schema.get("id"))

    service_class_name = lib.core.convert_path_to_pascal_case(
        service.get("url_context_root"))
    schema_class_name = lib.core.convert_path_to_pascal_case(
        schema.get("request_path"))

    crud_ops = ["Create", "Read", "Update",
                "Delete", "DeleteUnique", "ProcedureCall", "ReadUnique", "FunctionCall"]

    enabled_crud_ops = set()
    required_datatypes = set()
    requires_auth = False

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
            obj_meta_interface = "I" + default_class_name + "ResultSet"
            getters_setters = ""
            obj_pk_list = []
            obj_quoted_pk_list = []
            obj_string_pk_list = []
            obj_string_args_where_pk_list = []
            obj_unique_list = []
            obj_meta_interfaces = []
            class_name = db_obj.get("name")
            db_object_crud_ops = ""

            # Get objects
            objects = lib.db_objects.get_objects(
                session, db_object_id=db_obj.get("id"))

            # Loop over all objects and build interfaces
            for obj in objects:
                if requires_auth is False:
                    object_data = lib.db_objects.get_db_object(session=session, db_object_id=obj.get("db_object_id"))
                    requires_auth |= object_data.get("requires_auth") == 1

                # Get fields
                fields = lib.db_objects.get_object_fields_with_references(
                    session=session, object_id=obj.get("id"))

                for field in fields:
                    if field.get("lev") == 1:
                        # Build Primary Key lists
                        if field_is_pk(field):
                            obj_pk_list.append(field.get("name"))
                            obj_quoted_pk_list.append(f'"{field.get("name")}"')
                            obj_string_pk_list.append(
                                f'String({name}.{field.get("name")})')
                            obj_string_args_where_pk_list.append(
                                f'String(args.where.{field.get("name")})')
                        # Build Unique list
                        if field_is_unique(field):
                            obj_unique_list.append(field.get("name"))
                        # Build list containing the required types to import from MrsBaseClasses.ts
                        db_column_info = field.get("db_column")
                        if db_column_info:
                            db_datatype = db_column_info.get("datatype")
                            db_not_null = db_column_info.get("not_null")

                            # In TypeScript, there is no native type declaration for SomeType | null, so we add
                            # our own.
                            # In Python, we have Optional[SomeType] that does the trick, so there there is no
                            # need to add one.
                            if db_not_null is False and sdk_language == "TypeScript":
                                required_datatypes.add("MaybeNull")

                            client_datatype = get_enhanced_datatype_mapping(db_datatype, sdk_language)

                            if not datatype_is_primitive(client_datatype, sdk_language):
                                required_datatypes.add(client_datatype)

                # Get sdk_language specific options
                sdk_lang_options = get_mrs_object_sdk_language_options(
                    obj.get("sdk_options"), sdk_language)

                # Either take the custom interface_name or the default class_name
                class_name = sdk_lang_options.get(
                    "class_name", obj.get("name"))

                # For database objects other than PROCEDUREs and FUNCTIONS, if there are unique fields,
                # the corresponding SDK commands should be enabled.
                if not object_is_routine(db_obj):
                    db_object_crud_ops = db_obj.get("crud_operations", [])
                    # If this DB Object has unique columns (PK or UNIQUE) allow ReadUnique
                    if len(obj_unique_list) > 0 and "READUNIQUE" not in db_object_crud_ops:
                        db_object_crud_ops.append("READUNIQUE")
                    if len(obj_unique_list) > 0 and "DELETE" in db_object_crud_ops and "DELETEUNIQUE" not in db_object_crud_ops:
                        db_object_crud_ops.append("DELETEUNIQUE")
                # If the database object is a FUNCTION a PROCEDURE or a SCRIPT, CRUD operations should not be enabled
                elif object_is_routine(db_obj, of_type={"FUNCTION", "SCRIPT"}):
                    # For FUNCTIONs, handle custom "FunctionCall" operation, delete all other
                    db_object_crud_ops = ["FUNCTIONCALL"]
                else:
                    # For PROCEDUREs, handle custom "ProcedureCall" operation, delete all other
                    db_object_crud_ops = ["PROCEDURECALL"]

                obj_interfaces_def, required_obj_datatypes = generate_interfaces(
                    db_obj,
                    obj,
                    fields,
                    class_name,
                    sdk_language,
                    db_object_crud_ops,
                    obj_endpoint=f"{service_url}{schema.get('request_path')}/{name}"
                    )

                required_datatypes.update(required_obj_datatypes)

                # Do not add obj_interfaces for FUNCTION results
                if obj.get("kind") == "PARAMETERS" or not object_is_routine(db_obj, of_type={"FUNCTION"}):
                    obj_interfaces += obj_interfaces_def

                if obj.get("kind") == "PARAMETERS" and object_is_routine(db_obj):
                    obj_param_interface = obj.get("name")
                elif obj.get("kind") != "PARAMETERS" and object_is_routine(db_obj):
                    obj_meta_interfaces.append(class_name)

            # If the db object is a function, get the return datatype
            obj_function_result_datatype = None
            if object_is_routine(db_obj, of_type={"FUNCTION"}):
                obj_function_result_datatype = "unknown"
                if len(objects) > 1:
                    fields = lib.db_objects.get_object_fields_with_references(
                        session=session, object_id=objects[1].get("id"))

                    if len(fields) > 0:
                        db_column_info = field.get("db_column")
                        if db_column_info:
                            obj_function_result_datatype = get_datatype_mapping(
                                db_datatype=db_column_info.get("datatype"),
                                sdk_language=sdk_language)

            # If there are no typed result sets for a Procedure, all the result sets will be generic instances of JsonObject
            if object_is_routine(db_obj, of_type={"PROCEDURE"}) and len(objects) == 1:
                required_datatypes.add("JsonObject")
                if sdk_language != "Python":
                    obj_interfaces += generate_union(
                        obj_meta_interface, ["JsonObject"], sdk_language
                    )
                else:
                    obj_interfaces += generate_union(
                        obj_meta_interface,
                        ["MrsProcedureResultSet[str, JsonObject, JsonObject]"],
                        sdk_language,
                    )
            elif object_is_routine(db_obj, of_type={"PROCEDURE"}):
                if sdk_language != "Python":
                    # TypeScript tagged unions inherit from JsonObject
                    required_datatypes.add("JsonObject")
                    interface_list = [f"ITagged{name}" for name in obj_meta_interfaces]
                else:
                    interface_list = [f"MrsProcedureResultSet[I{name}Type, I{name}, ITagged{name}]" for name in obj_meta_interfaces]
                obj_interfaces += generate_union(obj_meta_interface, interface_list, sdk_language)

            # Names by default are formatted in `camelCase`. A different
            # convention may apply for other SDK languages.
            if sdk_language == "Python":
                # It's OK if strings or dictionary keys are in `camelCase`,
                # but class attributes and variables should be in `snake_case`.
                name = lib.core.convert_to_snake_case(name)

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

            # Loop over all CRUD operations and filter the sections that are not applicable for the specific object
            obj_template = loop.group(1)
            for crud_op in crud_ops:
                # Find all crud{crud_op}OnlyStart / End control blocks
                delimiter = language_comment_delimiter(sdk_language)
                crud_op_loops = re.finditer(
                    f"^[^\\S\r\n]*?{delimiter} --- crud{crud_op}OnlyStart\n\\s*(^[\\S\\s]*?)^\\s*?{delimiter} --- crud{crud_op}OnlyEnd\n",
                    obj_template, flags=re.DOTALL | re.MULTILINE)

                for crud_loop in crud_op_loops:
                    # If the CRUD operation is enabled for this DB Object, keep the identified code block
                    # if crud_op is "Update" and there is no primary key, update commands should not be available
                    if crud_op.upper() in db_object_crud_ops and (crud_op != "Update" or len(obj_pk_list) > 0):
                        enabled_crud_ops.add(crud_op)
                        obj_template = obj_template.replace(
                            crud_loop.group(), crud_loop.group(1))
                    else:
                        # Delete the identified code block otherwise
                        obj_template = obj_template.replace(
                            crud_loop.group(), "")

            # Perform the substitution
            filled_temp += Template(obj_template).substitute(**mapping)

        template = template.replace(loop.group(), filled_temp)

    return {"template": template, "enabled_crud_ops": enabled_crud_ops, "required_datatypes": required_datatypes, "requires_auth": requires_auth}


def get_datatype_mapping(db_datatype, sdk_language):
    db_datatype = db_datatype.lower()
    if sdk_language == "TypeScript":
        if db_datatype.startswith(("tinyint(1)", "bit(1)")):
            return "boolean"
        if db_datatype.startswith(("tinyint", "smallint", "mediumint", "int", "bigint", "decimal", "numeric",
                                     "float", "double")):
            return "number"
        if db_datatype.startswith("json"):
            return "JsonValue"
        if db_datatype.startswith("geometrycollection"):
            return "GeometryCollection"
        if db_datatype.startswith("geometry"):
            return "Geometry"
        if db_datatype.startswith("point"):
            return "Point"
        if db_datatype.startswith("multipoint"):
            return "MultiPoint"
        if db_datatype.startswith("linestring"):
            return "LineString"
        if db_datatype.startswith("multilinestring"):
            return "MultiLineString"
        if db_datatype.startswith("polygon"):
            return "Polygon"
        if db_datatype.startswith("multipolygon"):
            return "MultiPolygon"
        return "string"
    if sdk_language == "Python":
        if db_datatype.startswith(("tinyint(1)", "bit(1)")):
            return "bool"
        if db_datatype.startswith(("tinyint", "smallint", "mediumint", "int", "bigint")):
            return "int"
        if db_datatype.startswith(("decimal", "numeric", "float", "double")):
            return "float"
        if db_datatype.startswith("json"):
            return "JsonValue"
        return "str"

    return "unknown"


def get_enhanced_datatype_mapping(db_datatype, sdk_language):
    enhanced_map = {
        "Python": {
            "bool": "BoolField",
            "int": "IntField",
            "float": "FloatField",
            "str": "StringField",
        }
    }
    if sdk_language == "TypeScript":
        # In TypeScript, the fields of type ${DatabaseObject} are the same as type ${DatabaseObject}Params
        return get_datatype_mapping(db_datatype, sdk_language)
    if sdk_language == "Python":
        # If `py_datatype` not in the list of types to be enhanced,
        # then we assume it shouldn't be enhanced and returned it as it is.
        py_datatype = get_datatype_mapping(db_datatype, sdk_language)
        return enhanced_map[sdk_language].get(py_datatype, py_datatype)

    return "unknown"


def maybe_null(client_datatype, sdk_language):
    if sdk_language == "TypeScript":
        return f"MaybeNull<{client_datatype}>"
    if sdk_language == "Python":
        return f"Optional[{client_datatype}]"

    return "unknown"


def get_procedure_datatype_mapping(sp_datatype, sdk_language):
    if sdk_language == "TypeScript":
        if sp_datatype == "BOOLEAN":
            return "boolean"
        if sp_datatype in ("NUMBER", "INT"):
            return "number"
        if sp_datatype == "JSON":
            return "object"
        return "string"

    return "unknown"


def get_interface_datatype(
    field,
    sdk_language,
    class_name="",
    reference_class_name_postfix="",
    enhanced_fields=False,
    nullable=True,
):
    db_column_info = field.get("db_column")
    if db_column_info:
        db_datatype = db_column_info.get("datatype")
        db_not_null = db_column_info.get("not_null")

        # Todo: Handle SDK Options
        if not enhanced_fields:
            client_datatype = get_datatype_mapping(db_datatype, sdk_language)
        else:
            client_datatype = get_enhanced_datatype_mapping(db_datatype, sdk_language)

        if not nullable or db_not_null is True:
            return client_datatype

        return maybe_null(client_datatype, sdk_language)
    return f'I{class_name}{reference_class_name_postfix}{lib.core.convert_path_to_pascal_case(field.get("name"))}'


def datatype_is_primitive(client_datatype, sdk_language):
    # for now, consider only the data types we actually are able to map into
    if client_datatype is None:
        return False

    if sdk_language == "TypeScript":
        if client_datatype.startswith(("boolean", "number", "string")):
            return True
        return False
    if sdk_language == "Python":
        if client_datatype.startswith(("bool", "float", "int", "str")):
            return True
        return False

    return False


def field_is_pk(field):
    if field.get("lev") == 1:
        db_column_info = field.get("db_column")
        if db_column_info and db_column_info.get("is_primary"):
            return True

    return False


def field_is_unique(field):
    if field.get("lev") == 1:
        db_column_info = field.get("db_column")
        if db_column_info and (db_column_info.get("is_primary") or db_column_info.get("is_unique")):
            return True

    return False


def field_is_nullable(field):
    if field.get("lev") != 1:
        return False

    db_column_info = field.get("db_column")

    if db_column_info is None:
        return False

    if db_column_info.get("not_null"):
        return False

    return True


def field_has_row_ownership(field, obj):
    field_id = field.get("id")
    row_ownership_field_id = obj.get("row_ownership_field_id")

    return row_ownership_field_id is not None and field_id == row_ownership_field_id


def field_is_required(field, obj):
    if field.get("lev") != 1:
        return False

    db_column_info = field.get("db_column")

    if db_column_info is None:
        return False

    # if a field can be NULL it is, by definition, optional
    not_null = db_column_info.get("not_null")
    # if a field is a primary key with AUTO_INCREMENt, it is optional
    id_generation = db_column_info.get("id_generation")
    # if a field has a default column value, it is optional
    column_default = db_column_info.get("column_default")
    # if a field is maps to row ownership column, it should also be optional
    has_row_ownership = field_has_row_ownership(field, obj)

    if not_null and id_generation is None and column_default is None and not has_row_ownership:
        return True

    return False


def get_primary_key(fields: dict) -> Optional[str]:
    for field in fields:
        db_column_info = field.get("db_column")
        if db_column_info and field_is_pk(field):
            return db_column_info.get("name")
    return None


def field_can_be_cursor(field):
    if field.get("lev") != 1:
        return False

    db_column_info = field.get("db_column")

    if db_column_info is None:
        return False

    # the column can be used as a cursor if it is a unique and sequential
    # e.g. if it is a timestamp or has an AUTO_INCREMENT constraint
    id_generation = db_column_info.get("id_generation")
    datatype = db_column_info.get("datatype")

    if id_generation is not None and id_generation.startswith("auto_inc") or datatype.startswith("timestamp"):
        return True

    return False


def get_field_by_id(fields, identifier):
    for field in fields:
        if field.get("id") == identifier:
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


def generate_type_declaration(
    name,
    parents=[],
    fields={},
    sdk_language="TypeScript",
    ignore_base_types=False,
    non_mandatory_fields: Set[str] = set(),  # Users may or not specify them
    requires_placeholder=False,
):
    if len(fields) == 0:
        if not requires_placeholder:
            return ""
        return generate_type_declaration_placeholder(name, sdk_language)
    if sdk_language == "TypeScript":
        field_block = [
            generate_type_declaration_field(
                name,
                value,
                sdk_language,
                non_mandatory=(name in non_mandatory_fields),
            )
            for name, value in fields.items()
        ]
        if len(parents) > 0:
            # To avoid issues with optional fields, we always use type intersection to represent inheritance.
            intersection_block = f" & {' & '.join(parents)}"
            return (
                f"export type I{name} = {{\n"
                + "".join(field_block)
                + f"}}{intersection_block};\n\n"
            )
        # To follow the internal convention, we use interfaces for every other case.
        return f"export interface I{name} {{\n" + "".join(field_block) + "}\n\n"
    if sdk_language == "Python":
        field_block = [
            generate_type_declaration_field(
                name,
                value,
                sdk_language,
                non_mandatory=(
                    name in non_mandatory_fields
                    and len(non_mandatory_fields) != len(fields)
                ),
            )
            for name, value in fields.items()
        ]
        ordered_parents = (
            [*parents] if ignore_base_types is True else ["TypedDict", *parents]
        )
        if len(non_mandatory_fields) == len(fields):
            inheritance_block = f"({', '.join(ordered_parents)}, total=False)"
        else:
            inheritance_block = f"({', '.join(ordered_parents)})"
        param_block = "".join(field_block) if len(field_block) > 0 else "    pass\n"
        return f"class I{name}{inheritance_block}:\n" + param_block + "\n\n"


def generate_type_declaration_field(
    name, value, sdk_language, non_mandatory=False
):
    indent = " " * 4

    if sdk_language == "TypeScript":
        field_name_part = f"{indent}{name}?" if non_mandatory else f"{indent}{name}"
        if isinstance(value, list):
            return f"{field_name_part}: {value[0]}[],\n"
        return f"{field_name_part}: {value},\n"

    if sdk_language == "Python":
        name_in_convention = lib.core.convert_to_snake_case(name)
        if isinstance(value, list):
            hint = f"NotRequired[list[{value[0]}]]" if non_mandatory is True else f"list[{value[0]}]"
        else:
            hint = f"NotRequired[{value}]" if non_mandatory is True else f"{value}"
        return f'{indent}{name_in_convention}: {hint}\n'


def generate_data_class(
    name,
    fields,
    sdk_language,
    db_object_crud_ops: list[str],
    obj_endpoint: Optional[str] = None,
    obj_primary_key: Optional[str] = None
):
    if sdk_language == "TypeScript":
        return generate_type_declaration(
            name=name, fields=fields, sdk_language=sdk_language, non_mandatory_fields=set(fields)
        )
    if sdk_language == "Python":
        field_type_block = [
            (
                generate_type_declaration_field(name, value, sdk_language).rstrip()
                + " | UndefinedDataClassField\n"
            )
            for name, value in fields.items()
        ]
        assignment_block = [
            f'{" " * 8}self.{lib.core.convert_to_snake_case(field)} = data.get("{lib.core.convert_to_snake_case(field)}", UndefinedField)\n'
            for field in fields
        ]

        create_snippet = ""
        update_snippet = ""
        upsert_method = ""
        delete_method = ""

        if "UPDATE" in db_object_crud_ops:
            update_snippet = SDK_PYTHON_DATACLASS_TEMPLATE_UPSERT_UPDATE.format(
                name=name
            )
        if "CREATE" in db_object_crud_ops:
            create_snippet = SDK_PYTHON_DATACLASS_TEMPLATE_UPSERT_CREATE.format(
                name=name
            )
        if update_snippet or create_snippet:
            upsert_method = SDK_PYTHON_DATACLASS_TEMPLATE_UPSERT.format(
                create_snippet=create_snippet,
                update_snippet=update_snippet,
            )
        if "DELETE" in db_object_crud_ops and obj_primary_key is not None:
            delete_method = SDK_PYTHON_DATACLASS_TEMPLATE_DELETE.format(
                name=name
            )
            if upsert_method:
                delete_method = " "*4 + delete_method.lstrip()

        return SDK_PYTHON_DATACLASS_TEMPLATE.format(
            name=name,
            join_field_block="".join(field_type_block).rstrip(),
            obj_endpoint=obj_endpoint,
            join_assignment_block="".join(assignment_block).rstrip(),
            primary_key_name=(None if obj_primary_key is None else f'"{obj_primary_key}"'),
            upsert_method=upsert_method,
            delete_method=delete_method,
        ) + ("" if upsert_method or delete_method else "\n\n")


def generate_field_enum(name, fields=None, sdk_language="TypeScript"):
    if sdk_language == "TypeScript":
        return ""
    if sdk_language == "Python":
        if not fields or len(fields) == 0:
            return generate_type_declaration_placeholder(f"{name}Field", sdk_language)

        fields_in_case = [lib.core.convert_to_snake_case(field) for field in fields]
        return generate_enum(f"{name}Field", fields_in_case, sdk_language)


def generate_enum(name, values, sdk_language):
    enum_def = generate_literal_type(values, sdk_language)
    if sdk_language == "TypeScript":
        return f"export type I{name} = {enum_def};\n\n"
    if sdk_language == "Python":
        return f"I{name}: TypeAlias = {enum_def}\n\n\n"


def generate_type_declaration_placeholder(name, sdk_language):
    if sdk_language == "TypeScript":
        return f"type I{name} = never;\n\n"
    if sdk_language == "Python":
        return f"I{name}: TypeAlias = None\n\n\n"


def generate_literal_type(values, sdk_language):
    if sdk_language == "TypeScript":
        items = [f'"{value}"' for value in values]
        return f"{' | '.join(items)}"
    if sdk_language == "Python":
        items = [f'{" " * 4}"{value}"' for value in values]
        s = ',\n'.join(items)
        return (f"Literal[\n" +
            f"{s},\n" +
            "]")


def generate_selectable(name, fields, sdk_language):
    if sdk_language == "TypeScript":
        return ""
    if sdk_language == "Python":
        return generate_type_declaration(name=f"{name}Selectable", fields={ field: "bool" for field in fields },
                                         sdk_language=sdk_language, non_mandatory_fields=set(fields))


def generate_sortable(name, fields, sdk_language):
    if sdk_language == "TypeScript":
        return ""
    if sdk_language == "Python":
        return generate_type_declaration(name=f"{name}Sortable", fields={ field: "Order" for field in fields },
                                         sdk_language=sdk_language, non_mandatory_fields=set(fields))


def generate_union(name, types, sdk_language):
    if sdk_language == "TypeScript":
        return f"export type {name} = {' | '.join(types)};\n\n"
    if sdk_language == "Python":
        return f"{name}: TypeAlias = {' | '.join(types)}\n\n\n"


def generate_sequence_constant(name, values, sdk_language):
    if sdk_language == "TypeScript":
        return f"const {name} = {json.dumps(values)} as const;\n"
    elif sdk_language == "Python":
        return f"{name}: Sequence = {json.dumps(values)}\n\n"


def object_is_routine(db_obj, of_type: set[str] = {"PROCEDURE", "FUNCTION", "SCRIPT"}):
    return db_obj.get("object_type") in of_type


def generate_interfaces(
    db_obj,
    obj,
    fields,
    class_name,
    sdk_language,
    db_object_crud_ops: list[str],
    obj_endpoint: Optional[str] = None,
):
    obj_interfaces: list[str] = []
    interface_fields = {}
    param_interface_fields = {}
    out_params_interface_fields = {}
    obj_unique_fields = {}
    obj_cursor_fields = {}
    has_nested_fields = False
    obj_primary_key = get_primary_key(fields)
    required_datatypes: set[str] = set()

    # The I{class_name}, I{class_name}Params and I{class_name}Out interfaces
    for field in fields:
        db_column = field.get("db_column", {})
        # The field needs to be on level 1 and enabled
        if field.get("lev") == 1 and field.get("enabled"):
            datatype = get_interface_datatype(field, sdk_language, class_name)
            enhanced_fields = False if object_is_routine(db_obj) else True
            enhanced_datatype = get_interface_datatype(
                field=field,
                sdk_language=sdk_language,
                class_name=class_name,
                enhanced_fields=enhanced_fields,
            )
            # Handle references
            if field.get("represents_reference_id"):
                has_nested_fields = True
                # Check if the field should be reduced to the value of another field
                reduced_to_datatype = get_reduced_field_interface_datatype(
                    field, fields, sdk_language, class_name
                )
                if reduced_to_datatype:
                    interface_fields.update({field.get("name"): reduced_to_datatype})
                else:
                    obj_ref = field.get("object_reference")
                    # Add field if the referred table is not unnested
                    if not obj_ref.get("unnest"):
                        # If this field represents an OUT parameter of a SP, add it to the
                        # out_params_interface_fields list
                        if obj.get("kind") == "PARAMETERS" and object_is_routine(
                            db_obj
                        ):
                            if db_column.get("in"):
                                param_interface_fields.update(
                                    {field.get("name"): datatype}
                                )
                            if db_column.get("out"):
                                out_params_interface_fields.update(
                                    {field.get("name"): datatype}
                                )
                        elif obj.get("kind") == "PARAMETERS" and not object_is_routine(
                            db_obj
                        ):
                            param_interface_fields.update(
                                {field.get("name"): enhanced_datatype}
                            )
                        elif field.get("allow_filtering") and not object_is_routine(
                            db_obj
                        ):
                            # RESULT
                            interface_fields.update({field.get("name"): datatype})
                            # Add all table fields that have allow_filtering set and SP params to the
                            # param_interface_fields
                            param_interface_fields.update(
                                {field.get("name"): enhanced_datatype}
                            )

                    # Call recursive interface generation
                    generate_nested_interfaces(
                        obj_interfaces,
                        interface_fields,
                        field,
                        reference_class_name_postfix=lib.core.convert_path_to_pascal_case(
                            field.get("name")
                        ),
                        fields=fields,
                        class_name=class_name,
                        sdk_language=sdk_language,
                    )
            elif obj.get("kind") == "PARAMETERS":
                # If this field represents an OUT parameter of a SP, add it to the
                # out_params_interface_fields list
                if db_column.get("in"):
                    param_interface_fields.update({field.get("name"): datatype})
                if db_column.get("out"):
                    out_params_interface_fields.update({field.get("name"): datatype})
            else:
                interface_fields.update({field.get("name"): datatype})
                # Add all table fields that have allow_filtering set and SP params to the param_interface_fields
                if field.get("allow_filtering") and not object_is_routine(db_obj):
                    param_interface_fields.update(
                        {field.get("name"): enhanced_datatype}
                    )

            if not object_is_routine(db_obj):
                enhanced_datatype = get_interface_datatype(
                    field=field,
                    sdk_language=sdk_language,
                    class_name=class_name,
                    enhanced_fields=True,
                    nullable=False,
                )
                # Build Unique list
                if field_is_unique(field):
                    obj_unique_fields.update({field.get("name"): enhanced_datatype})

                # Build list of columns which can potentially be used for cursor-based pagination.
                if field_can_be_cursor(field):
                    obj_cursor_fields.update({field.get("name"): enhanced_datatype})

    if not object_is_routine(db_obj):
        # The object is a TABLE or a VIEW
        if sdk_language != "TypeScript":
            # These type declarations are not needed for TypeScript because it uses a Proxy to replace the interface
            # and not a wrapper class. This might change in the future.
            mrs_resource_type = "IMrsResourceDetails"
            required_datatypes.add(mrs_resource_type)

            obj_interfaces.append(
                generate_type_declaration(
                    name=f"{class_name}Details",
                    parents=[mrs_resource_type],
                    fields=interface_fields,
                    sdk_language=sdk_language,
                    ignore_base_types=True,
                    non_mandatory_fields=set(interface_fields),
                )
            )

            obj_interfaces.append(
                generate_type_declaration(
                    name=f"{class_name}Data",
                    fields=interface_fields,
                    sdk_language=sdk_language,
                    non_mandatory_fields=set(interface_fields),
                )
            )

        if "CREATE" in db_object_crud_ops:
            obj_non_mandatory_fields = set(
                [
                    field.get("name")
                    for field in fields
                    # exclude fields that are out of range (e.g. on different nesting levels)
                    if field.get("name") in interface_fields.keys()
                    and field_is_required(field, obj) is False
                ]
            )

            obj_interfaces.append(
                generate_type_declaration(
                    name=f"New{class_name}",
                    fields=interface_fields,
                    sdk_language=sdk_language,
                    non_mandatory_fields=obj_non_mandatory_fields,
                )
            )

        if "UPDATE" in db_object_crud_ops:
            # TODO: No partial update is supported yet. Once it is, the
            # `non-mandatory_fields` argument should not change.
            # This way, users can know what fields are required and which ones aren't.
            # However, even when replacing an entire resource, it should be possible to
            # unset nullable fields.
            nullable_fields = [
                field.get("name")
                for field in fields
                if field_is_nullable(field) or field_has_row_ownership(field, obj)
            ]
            obj_interfaces.append(
                generate_type_declaration(
                    name=f"Update{class_name}",
                    fields=interface_fields,
                    sdk_language=sdk_language,
                    non_mandatory_fields=set(nullable_fields),
                )
            )

        obj_interfaces.append(
            generate_data_class(
                name=class_name,
                fields=interface_fields,
                sdk_language=sdk_language,
                db_object_crud_ops=db_object_crud_ops,
                obj_endpoint=obj_endpoint,
                obj_primary_key=obj_primary_key,
            )
        )

        obj_interfaces.append(
            generate_field_enum(
                name=class_name, fields=interface_fields, sdk_language=sdk_language
            )
        )

        if not has_nested_fields:
            # This creates a type alias for something like None, which ensures there is always a default
            # value for *{class_name}NestedField and saves us from using conditionals in the template.
            obj_interfaces.append(
                generate_field_enum(
                    name=f"{class_name}Nested", sdk_language=sdk_language
                )
            )

        obj_interfaces.append(
            generate_selectable(class_name, interface_fields, sdk_language)
        )
        obj_interfaces.append(
            generate_sortable(class_name, interface_fields, sdk_language)
        )

        construct_parents = (
            []
            if sdk_language != "Python"
            else ["Generic[Filterable]", "HighOrderOperator[Filterable]"]
        )
        obj_interfaces.append(
            generate_type_declaration(
                name=f"{class_name}Filterable",
                parents=construct_parents,
                fields=param_interface_fields,
                sdk_language=sdk_language,
                ignore_base_types=True,
                non_mandatory_fields=set(param_interface_fields),
            )
        )

        obj_interfaces.append(
            generate_type_declaration(
                name=f"{class_name}UniqueFilterable",
                fields=obj_unique_fields,
                sdk_language=sdk_language,
                non_mandatory_fields=set(obj_unique_fields),
            )
        )

        obj_interfaces.append(
            generate_type_declaration(
                name=f"{class_name}Cursors",
                fields=obj_cursor_fields,
                sdk_language=sdk_language,
                non_mandatory_fields=set(obj_cursor_fields),
                # To avoid conditional logic in the template, we should generate a void type declaration.
                requires_placeholder=True,
            )
        )

    # FUNCTIONs, PROCEDUREs and SCRIPTs
    elif obj.get("kind") == "RESULT":
        obj_interfaces.append(
            generate_type_declaration(
                name=class_name,
                fields=interface_fields,
                sdk_language=sdk_language,
                non_mandatory_fields=set(interface_fields),
            )
        )

        if len(interface_fields) > 0:
            # Result sets are non-deterministic and there is no way to know if a column value can be NULL.
            # Thus, we must assume that is always the case.
            if sdk_language == "TypeScript":
                required_datatypes.add("MaybeNull")

            result_fields = {
                "type": generate_literal_type([class_name], sdk_language),
                "items": [f"I{class_name}"],
            }
            obj_interfaces.append(
                generate_type_declaration(
                    name=f"Tagged{class_name}",
                    fields=result_fields,
                    sdk_language=sdk_language,
                    parents=(
                        ["JsonObject"] if sdk_language == "TypeScript" else []
                    ),  # TypeScript tagged unions inherit from JsonObject
                )
            )

            # The Python SDK uses a generic dataclass for the tagged union of result set types.
            # The generic dataclass needs to know the possible values of the "type" field.
            if sdk_language == "Python":
                obj_interfaces.append(
                    generate_enum(
                        name=f"{class_name}Type",
                        values=[class_name],
                        sdk_language=sdk_language,
                    )
                )

    else: # kind = "PARAMETERS"
        if len(param_interface_fields) > 0:
            # Parameters are "optional" in a way that they can be NULL at the SQL level.
            if sdk_language == "TypeScript":
                required_datatypes.add("MaybeNull")

        # Type definition for the set of IN/INOUT Parameters.
        obj_interfaces.append(
            generate_type_declaration(
                name=f"{class_name}",
                fields=param_interface_fields,
                sdk_language=sdk_language,
                non_mandatory_fields=set(param_interface_fields),
                # To avoid conditional logic in the template, we should generate a void type declaration.
                requires_placeholder=True,
            )
        )

        # Type definition for the set of OUT/INOUT Parameters.
        obj_interfaces.append(
            generate_type_declaration(
                name=f"{class_name}Out",
                fields=out_params_interface_fields,
                sdk_language=sdk_language,
                non_mandatory_fields=set(out_params_interface_fields),
                # To avoid conditional logic in the template, we should generate a void type declaration.
                # In this case, the placeholder is only needed for Procedures, because the type declaration
                # is not used otherwise.
                requires_placeholder=object_is_routine(db_obj, of_type={"PROCEDURE"}),
            )
        )

    return "".join(obj_interfaces), required_datatypes


# For now, this function is not used for ${DatabaseObject}Params type declarations
def generate_nested_interfaces(
        obj_interfaces, parent_interface_fields, parent_field,
        reference_class_name_postfix,
        fields, class_name, sdk_language):
    # Build interface name
    interface_name = f"{class_name}{reference_class_name_postfix}"

    # Check if the reference has unnest set, and if so, use the parent_interface_fields
    parent_obj_ref = parent_field.get("object_reference")
    interface_fields = {} if not parent_obj_ref.get(
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
                    interface_fields.update({ field.get("name"): reduced_to_datatype })
                else:
                    obj_ref = field.get("object_reference")
                    field_interface_name = lib.core.convert_path_to_pascal_case(
                        field.get("name"))
                    # Add field if the referred table is not unnested
                    if not obj_ref.get("unnest"):
                        datatype = f"{class_name}{reference_class_name_postfix + field.get("name")}"
                        # Should use the corresponding nested field type.
                        interface_fields.update({ field.get("name"): interface_name + field_interface_name })

                    # If not, do recursive call
                    generate_nested_interfaces(
                        obj_interfaces, interface_fields, field,
                        reference_class_name_postfix=reference_class_name_postfix + field_interface_name,
                        fields=fields, class_name=class_name, sdk_language=sdk_language)
            else:
                datatype = get_interface_datatype(field, sdk_language)
                interface_fields.update({ field.get("name"): datatype })

    if not parent_obj_ref.get("unnest"):
        obj_interfaces.append(generate_type_declaration(name=interface_name, fields=interface_fields,
                                                        sdk_language=sdk_language))
        obj_interfaces.append(generate_field_enum(name=f"{class_name}Nested", fields=interface_fields,
                                                  sdk_language=sdk_language))


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
    service_list = []
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
        service_list.append({
            "serviceName": service_name, "url": service_url, "isCurrent": service.get("is_current") == 1})

    if status['service_configured'] is False:
        status_output = {
            "configured": False,
            "info": "The MySQL REST Service has not been configured on this MySQL instance yet. Switch to " +
            "SQL mode and use the CONFIGURE REST METADATA command to configure the instance.",
            "services": []}
    elif len(service_list) == 0:
        status_output = {
            "configured": True,
            "info": "No REST service has been created yet. Switch to SQL Mode and use the " +
            "CREATE REST SERVICE command to create a new REST service.",
            "services": []}
    else:
        status_output = {
            "configured": True,
            "info": f'{len(service_list)} REST service{"s" if len(service_list) > 1 else ""} available.',
            "services": service_list}

    s += f"""
    public getStatus = () => {{
        return {json.dumps(status_output)};
    }}

    public addService = () => {{
        mrsEditService();
    }}

    public printSdkCode = () => {{
        mrsPrintSdkCode();
    }}

    public refreshSdkCode = () => {{
        mrsRefreshSdkCode();
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
