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

from typing import Literal, Optional, TypeAlias
from mrs_plugin import lib
from pathlib import Path
import os
import re
from string import Template
import json
from base64 import b64decode
import mysqlsh
import string
import random


ProgrammingLanguage: TypeAlias = Literal["typescript", "python", "swift"]


SUPPORTED_LANGUAGES = {
    "typescript": "TypeScript",
    "python": "Python",
    "swift": "Swift",
}


SDK_PYTHON_DATACLASS_TEMPLATE = '''@dataclass(init=False, repr=True)
class I{name}({mixins}MrsDocument[I{name}Data]
):

    # For data attributes, `None` means "NULL" and
    # `UndefinedField` means "not set or undefined"
{join_field_block}

    def __init__(  # type: ignore[override]
        self, schema: MrsBaseSchema, data: I{name}Data
    ) -> None:
        super().__init__(
            schema,
            data,
            fields_map={field_profile},
            obj_endpoint="{obj_endpoint}",
        )

    @classmethod
    def get_primary_key_name(cls) -> Optional[str]:
        return {primary_key_name}


'''


SDK_SWIFT_DATACLASS_TEMPLATE = """public class I{name}: {mixins} {{
    public typealias DocumentType = I{name}
    public typealias ModelType = {name}DatabaseObject

{join_field_block}
    private enum CodingKeys: String, CodingKey {{
        case {join_field_name_block}
    }}

    public required init(from decoder: any Decoder) throws {{
        let container: KeyedDecodingContainer<CodingKeys> = try decoder.container(keyedBy: CodingKeys.self)
{join_init_assignments}
        try super.init(from: decoder)
    }}

    public override func encode(to encoder: any Encoder) throws {{
        var container = encoder.container(keyedBy: CodingKeys.self)
{join_field_encode}
    }}

    public override func getPrimaryKeyName() -> String? {{
        return {primary_key_name}
    }}
}}

"""


SDK_PYTHON_NON_NATIVE_TYPES = ("Date", "DateTime", "Time", "Year", "Vector")


class LanguageNotSupportedError(Exception):
    supported_languages = list(SUPPORTED_LANGUAGES.values())

    def __init__(self, sdk_language: Optional[ProgrammingLanguage]):
        self._sdk_language = "Language" if sdk_language is None else sdk_language
        super().__init__(f"{self._sdk_language} not supported. The MRS SDK is only available for {", ".join(self.supported_languages[:-1])} and {self.supported_languages[-1]}.")


def get_base_classes(
    sdk_language: ProgrammingLanguage = "typescript", prepare_for_runtime=False
):
    if sdk_language == "typescript":
        file_name = "MrsBaseClasses.ts"
    elif sdk_language == "python":
        file_name = "mrs_base_classes.py"
    elif sdk_language == "swift":
        file_name = str(Path("Sources", "MrsSdk", "MrsBaseClasses.swift"))
    else:
        raise LanguageNotSupportedError(sdk_language)

    path = os.path.abspath(__file__)
    code = Path(os.path.dirname(path), "..", "sdk", sdk_language, file_name).read_text()

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


def generate_service_sdk(service, session, sdk_language: ProgrammingLanguage = "typescript", prepare_for_runtime=False, service_url=None):
    # If no services is given, return only the MRS runtime management TypeScript Code
    # that allows the user to manage specific MRS runtime settings
    if service is None:
        if prepare_for_runtime is True and sdk_language == "typescript":
            return remove_js_whitespace_and_comments(get_mrs_runtime_management_code(session))
        return ""

    if sdk_language == "typescript":
        file_name = "MrsServiceTemplate.ts.template"
    elif sdk_language == "python":
        file_name = "mrs_service_template.py.template"
    elif sdk_language == "swift":
        file_name = str(Path("Sources", "MrsSdk", "MrsServiceTemplate.swift.template"))
    else:
        raise LanguageNotSupportedError(sdk_language)

    path = os.path.abspath(__file__)
    template = Path(os.path.dirname(path), "..", "sdk", sdk_language, file_name).read_text()

    def binary_formatter(base64str: str):
        if base64str.startswith("type254:"):
            return b64decode(base64str.split(":")[-1])
        # booleans are encoded as BIT(1)
        if base64str.startswith("type16:"):
            return bool.from_bytes(b64decode(base64str.split(":")[-1]))
        return base64str

    try:
        sdk_data = lib.services.get_service_sdk_data(
            session, service.get("id"), binary_formatter=binary_formatter
        )
    except mysqlsh.DBError as e:
        if e.code != 1370:
            raise e
        # we should make a clear distinction for the case where we cannot retrieve
        # sdk data because the user is missing "EXECUTE" permissions (BUG#)
        sdk_data = None

    # Process Template String
    code = substitute_service_in_template(
        service=service,
        template=template,
        sdk_language=sdk_language,
        session=session,
        service_url=service_url,
        # service_data should be None if it couldn't be retrieved beforehand (BUG#)
        # otherwise, if there are no services, it should be an empty dictionary
        service_data=None if sdk_data is None else sdk_data.get("service_res", {}),
    )

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
        template += get_mrs_runtime_management_code(session)

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
        "TaskRun",
    ]

    enabled_ops = enabled_crud_ops if enabled_crud_ops else set()
    task_ops = {"FunctionTaskRun", "ProcedureTaskRun"}

    if len(enabled_ops) - len(enabled_ops.difference(task_ops)) > 0:
        enabled_ops = enabled_ops.difference(task_ops)
        enabled_ops.add("TaskRun")

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


def substitute_service_in_template(service, template, session, service_url, service_data, sdk_language: ProgrammingLanguage = "typescript"):
    # Currently, we only generate the SDK for a single service, but this might change in the future.
    existing_identifiers: list[str] = []

    code = substitute_schemas_in_template(
        service=service,
        template=template,
        sdk_language=sdk_language,
        session=session,
        service_url=service_url,
        schemas=None if service_data is None else service_data.get("db_schemas", []),
    )

    template = code.get("template")
    requires_auth = code.get("requires_auth")

    # if no db object requires auth and there are no authentication apps enabled for the service,
    # the SDK authentication command should not be generated
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

    mapping = {
        "service_name": generate_identifier(
            value=service.get("url_context_root"),
            sdk_language=sdk_language,
            existing_identifiers=existing_identifiers,
        ),
        "service_class_name": generate_identifier(
            value=service.get("url_context_root"),
            primitive="class",
            existing_identifiers=existing_identifiers,
        ),
        "service_url": service_url,
        "service_auth_path": service.get("auth_path"),
        "service_id": lib.core.convert_id_to_string(service_id),
    }

    template = Template(template).substitute(**mapping)

    return {"template": template, "enabled_crud_ops": code.get("enabled_crud_ops"), "required_datatypes": code.get("required_datatypes"), "requires_auth": requires_auth}


def substitute_schemas_in_template(
    service, template, sdk_language, session, service_url, schemas
):

    delimiter = language_comment_delimiter(sdk_language)
    schema_loops = re.finditer(
        f"^[^\\S\r\n]*?{delimiter} --- schemaLoopStart\n\\s*(^[\\S\\s]*?)^\\s*?{delimiter} --- schemaLoopEnd\n",
        template,
        flags=re.DOTALL | re.MULTILINE,
    )

    # BUG#37926204 Get database schemas if they have not been retrieved beforehand
    db_schemas = lib.schemas.query_schemas(session, service_id=service.get("id")) if schemas is None else schemas

    enabled_crud_ops = set()
    required_datatypes = set()
    requires_auth = False

    for loop in schema_loops:
        # for each schema loop, we should restart tracking the identifiers
        # we should track reserved service level keywords as existing identifiers
        existing_identifiers = get_top_level_keywords(sdk_language=sdk_language)

        schema_template = loop.group(1)

        filled_temp = ""
        for schema in db_schemas:
            # TODO: Implement support for MRS Scripts
            if schema.get("schema_type") == "SCRIPT_MODULE":
                continue

            if requires_auth is False:
                requires_auth |= schema.get("requires_auth") == 1

            delimiter = language_comment_delimiter(sdk_language)
            if f"{delimiter} --- objectLoopStart" in schema_template:
                # Fill inner Object loops
                code = substitute_objects_in_template(
                    service=service,
                    schema=schema,
                    template=schema_template,
                    sdk_language=sdk_language,
                    session=session,
                    service_url=service_url,
                    db_objs=None if schemas is None else schema.get("db_objects", [])
                )

                schema_template_with_obj_filled = code.get("template")
                enabled_crud_ops.update(code.get("enabled_crud_ops"))
                required_datatypes.update(code.get("required_datatypes"))

                if requires_auth is False:
                    requires_auth |= code.get("requires_auth")
            else:
                schema_template_with_obj_filled = schema_template

            mapping = {
                "schema_name": generate_identifier(
                    value=schema.get("request_path"),
                    sdk_language=sdk_language,
                    existing_identifiers=existing_identifiers,
                ),
                "schema_class_name": generate_identifier(
                    value=f"{service.get("url_context_root")}{schema.get("request_path")}",
                    primitive="class",
                    existing_identifiers=existing_identifiers,
                ),
                "schema_request_path": schema.get("request_path"),
                "schema_id": lib.core.convert_id_to_string(schema.get("id")),
            }

            filled_temp += Template(schema_template_with_obj_filled).substitute(
                **mapping
            )

        template = template.replace(loop.group(), filled_temp)

    return {
        "template": template,
        "enabled_crud_ops": enabled_crud_ops,
        "required_datatypes": required_datatypes,
        "requires_auth": requires_auth,
    }


def get_top_level_keywords(
    sdk_language: ProgrammingLanguage = "typescript",
    resource: Literal["service", "schema", "object"] = "service",
) -> list[str]:
    keywords = {
        "schema": {"getMetadata"},
        "object": {"getMetadata"},
        "service": {"authenticate", "deauthenticate", "getAuthApps", "getMetadata"},
    }
    if sdk_language == "python":
        return sorted([
            lib.core.convert_to_snake_case(keyword) for keyword in keywords[resource]
        ])
    return sorted(keywords[resource])


def get_mrs_object_sdk_language_options(sdk_options, sdk_language):
    if not sdk_options or not sdk_options.get("language_options"):
        return {}

    # Find the matching language_options
    for opt in sdk_options.get("language_options"):
        if opt.get("language") == sdk_language:
            return opt

    return {}


def language_comment_delimiter(sdk_language):
    if sdk_language in ("typescript", "swift"):
        return "//"
    if sdk_language == "python":
        return "#"


def generate_identifier(
    value: str,
    primitive: Literal["variable", "class"] = "variable",
    sdk_language: ProgrammingLanguage = "typescript",
    # mutable objects for default values are re-used on subsequent function calls, let's leverage that
    existing_identifiers: list[str] = [],
    allowed_special_characters: Optional[set[str]] = None
) -> str:
    if primitive == "class":
        identifier = lib.core.convert_path_to_pascal_case(value, allowed_special_characters)
    elif sdk_language == "typescript":
        # variable and property names should be lowerCamelCase
        identifier = lib.core.convert_path_to_camel_case(path=value, allowed_special_characters=allowed_special_characters, lower=True)
    elif sdk_language == "python":
        identifier = lib.core.convert_to_snake_case(lib.core.convert_path_to_camel_case(value, allowed_special_characters))
    elif sdk_language == "swift":
        identifier = lib.core.convert_path_to_camel_case(value, allowed_special_characters)
    else:
        identifier = value
    # If the stripped identifier would result in an empty one, create a random one
    if len(identifier) == 0:
        identifier = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    identifier = f"_{identifier}" if identifier[0].isdigit() else identifier
    total_duplicates = existing_identifiers.count(identifier)
    # we want to track the identifier with a potential prefix, but without the suffix
    existing_identifiers.append(identifier)
    # the total number of duplicates determines the suffix
    identifier = (
        identifier if total_duplicates == 0 else f"{identifier}{total_duplicates}"
    )
    return identifier


def substitute_objects_in_template(
    service, schema, template, sdk_language, session, service_url, db_objs
):
    delimiter = language_comment_delimiter(sdk_language)
    object_loops = re.finditer(
        f"^[^\\S\r\n]*?{delimiter} --- objectLoopStart\n\\s*(^[\\S\\s]*?)^\\s*?{delimiter} --- objectLoopEnd\n",
        template,
        flags=re.DOTALL | re.MULTILINE,
    )

    # BUG#37926204 Get database objects if they have not been retrieved beforehand
    db_objects = lib.db_objects.query_db_objects(session, schema_id=schema.get("id")) if db_objs is None else db_objs

    crud_ops = [
        "Create",
        "Read",
        "Update",
        "Delete",
        "DeleteUnique",
        "ProcedureCall",
        "ReadUnique",
        "FunctionCall",
        "FunctionTaskRun",
        "ProcedureTaskRun"
    ]

    enabled_crud_ops = set()
    required_datatypes = set()
    requires_auth = False

    schema_request_path = f"{service.get("url_context_root")}{schema.get("request_path")}"
    schema_class_name = generate_identifier(
        value=schema_request_path,
        primitive="class",
        existing_identifiers=[],
    )

    for loop in object_loops:
        # for each object loop, we need to restart tracking the identifiers
        # we should track reserved schema level keywords as existing identifiers
        existing_identifiers = get_top_level_keywords(resource="schema", sdk_language=sdk_language)

        filled_temp = ""
        for db_obj in db_objects:
            name = generate_identifier(
                value=db_obj.get("request_path"),
                sdk_language=sdk_language,
                existing_identifiers=existing_identifiers,
            )
            class_name = generate_identifier(
                value=f"{schema_request_path}{db_obj.get("request_path")}",
                primitive="class",
                existing_identifiers=existing_identifiers,
            )
            type_alias_name = class_name
            obj_interfaces = ""
            obj_meta_interface = f"I{class_name}ResultSet"
            obj_param_interface = ""
            getters_setters = ""
            obj_pk_list = []
            obj_quoted_pk_list = []
            obj_unique_list = []
            obj_meta_interfaces = []
            db_object_crud_ops = ""
            obj_bigint_field_list = []
            obj_fixed_point_field_list = []

            # BUG#37926204 Get SDK objects if they have not been retrieved beforehand
            objects = lib.db_objects.get_objects(
                session, db_object_id=db_obj.get("id")) if db_obj.get("objects") is None else db_obj.get("objects")

            # Loop over all objects and build interfaces
            for obj in objects:
                if requires_auth is False:
                    requires_auth |= db_obj.get("requires_auth") == 1

                # BUG#37926204 Get object fields if they have not been retrieved beforehand
                fields = lib.db_objects.get_object_fields_with_references(
                    session=session, object_id=obj.get("id")) if obj.get("fields") is None else obj.get("fields")

                for field in fields:
                    if field.get("lev") == 1:
                        # Build Primary Key lists (only if "UPDATE" is allowed)
                        if field_is_pk(field) and "UPDATE" in db_obj.get("crud_operations", []):
                            obj_pk_list.append(field.get("name"))
                            obj_quoted_pk_list.append(f'"{field.get("name")}"')
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
                            if db_not_null is False and sdk_language == "typescript":
                                required_datatypes.add("MaybeNull")

                            client_datatype = get_enhanced_datatype_mapping(db_datatype, sdk_language)

                            if not datatype_is_primitive(client_datatype, sdk_language):
                                required_datatypes.add(client_datatype)
                                if (
                                    sdk_language == "python"
                                    and client_datatype.startswith(
                                        SDK_PYTHON_NON_NATIVE_TYPES
                                    )
                                ):
                                    required_datatypes.add(
                                        client_datatype.replace("Field", "")
                                    )

                                if sdk_language == "typescript":
                                    if client_datatype == "BigInteger":
                                        obj_bigint_field_list.append(f'"{field.get("name")}"')
                                    elif client_datatype == "Decimal":
                                        obj_fixed_point_field_list.append(f'"{field.get("name")}"')

                # Get sdk_language specific options
                sdk_lang_options = get_mrs_object_sdk_language_options(
                    obj.get("sdk_options"), sdk_language)

                # Either take the custom interface_name or the default class_name
                type_alias_name = sdk_lang_options.get(
                    "class_name",
                    obj.get("name") if object_is_routine(db_obj) else class_name,
                )

                # For database objects other than PROCEDUREs and FUNCTIONS, if there are unique fields,
                # the corresponding SDK commands should be enabled.
                if not object_is_routine(db_obj):
                    # READ is always enabled
                    db_object_crud_ops = db_obj.get("crud_operations", "READ")
                    # If db_objects results from calling lib.db_objects.get_objects, the value of the "crud_operations"
                    # key is already a list, if it results from calling lib.services.get_service_sdk_data, the value
                    # is a comma-separated string (BUG#37926204)
                    db_object_crud_ops = db_object_crud_ops if isinstance(db_object_crud_ops, list) else db_object_crud_ops.split(",")
                    # If this DB Object has unique columns (PK or UNIQUE) allow ReadUnique
                    if len(obj_unique_list) > 0 and "READUNIQUE" not in db_object_crud_ops:
                        db_object_crud_ops.append("READUNIQUE")
                    if len(obj_unique_list) > 0 and "DELETE" in db_object_crud_ops and "DELETEUNIQUE" not in db_object_crud_ops:
                        db_object_crud_ops.append("DELETEUNIQUE")
                # If the database object is a FUNCTION a PROCEDURE or a SCRIPT, CRUD operations should not be enabled
                elif object_is_routine(db_obj, of_type={"FUNCTION", "SCRIPT"}):
                    required_datatypes.add("IMrsFunctionResponse")
                    options = db_obj.get("options")
                    if options is not None and options.get("mysqlTask") is not None:
                        db_object_crud_ops = ["FUNCTIONTASKRUN"]
                    else:
                        db_object_crud_ops = ["FUNCTIONCALL"]
                else:
                    if sdk_language == "typescript":
                        required_datatypes.add("IMrsProcedureResult")
                    elif sdk_language == "python":
                        required_datatypes.update({"MrsProcedureResultSet", "IMrsProcedureResponse"})
                    options = db_obj.get("options")
                    if options is not None and options.get("mysqlTask") is not None:
                        db_object_crud_ops = ["PROCEDURETASKRUN"]
                    else:
                        db_object_crud_ops = ["PROCEDURECALL"]

                obj_interfaces_def, required_obj_datatypes = generate_interfaces(
                    db_obj,
                    obj,
                    fields,
                    type_alias_name,
                    sdk_language,
                    db_object_crud_ops,
                    obj_endpoint=f"{service_url}{schema.get('request_path')}{db_obj.get("request_path")}",
                )

                required_datatypes.update(required_obj_datatypes)

                # Do not add obj_interfaces for FUNCTION results
                if obj.get("kind") == "PARAMETERS" or not object_is_routine(db_obj, of_type={"FUNCTION"}):
                    obj_interfaces += obj_interfaces_def

                if obj.get("kind") == "PARAMETERS" and object_is_routine(db_obj):
                    obj_param_interface = type_alias_name
                if obj.get("kind") != "PARAMETERS" and object_is_routine(db_obj):
                    obj_meta_interfaces.append(type_alias_name)

            # If the db object is a function, get the return datatype
            obj_function_result_datatype = None
            if object_is_routine(db_obj, of_type={"FUNCTION"}):
                obj_function_result_datatype = "unknown"
                if len(objects) > 1:
                    # The SDK object reference is always available, even if it does not contain any field.
                    result_obj = next(
                        (obj for obj in objects if obj.get("kind") == "RESULT"), {}
                    )
                    # BUG#37926204 Get object fields if they have not been retrieved beforehand
                    fields = (
                        lib.db_objects.get_object_fields_with_references(
                            session=session, object_id=result_obj.get("id")
                        )
                        if result_obj.get("fields") is None
                        else result_obj.get("fields")
                    )

                    if len(fields) > 0:
                        db_column_info = field.get("db_column")
                        if db_column_info:
                            obj_function_result_datatype = get_datatype_mapping(
                                db_datatype=db_column_info.get("datatype"),
                                sdk_language=sdk_language)

            # If there are no typed result sets for a Procedure, all the result sets will be generic instances of JsonObject
            obj_procedure_result_set_datatype = None
            if object_is_routine(db_obj, of_type={"PROCEDURE"}) and len(objects) == 1:
                required_datatypes.add("JsonObject")
                if sdk_language != "python":
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
                if sdk_language != "python":
                    # TypeScript tagged unions inherit from JsonObject
                    required_datatypes.add("JsonObject")
                    interface_list = [f"ITagged{name}" for name in obj_meta_interfaces]
                else:
                    interface_list = [
                        f"MrsProcedureResultSet[I{name}Type, I{name}, ITagged{name}]"
                        for name in obj_meta_interfaces
                    ]
                    obj_procedure_result_set_datatype = (
                        "{"
                        + ",".join(
                            [f'"{name}": I{name}' for name in obj_meta_interfaces]
                        )
                        + "}"
                    )
                obj_interfaces += generate_union(obj_meta_interface, interface_list, sdk_language)

            # Define the mappings
            mapping = {
                "obj_id": lib.core.convert_id_to_string(db_obj.get("id")),
                "obj_name": name,
                "obj_class_name": class_name,
                "obj_param_interface": obj_param_interface, # empty if not FUNCTION/PROCEDURE
                "obj_meta_interface": obj_meta_interface,
                "obj_request_path": db_obj.get("request_path"),
                "schema_class_name": schema_class_name,
                "schema_request_path": schema.get("request_path"),
                "obj_full_request_path": service.get("url_context_root")
                + schema.get("request_path")
                + db_obj.get("request_path"),
                "obj_type": db_obj.get("object_type"),
                "obj_interfaces": obj_interfaces,
                "obj_getters_setters": getters_setters,
                "obj_pk_list": ", ".join(obj_pk_list),
                "obj_quoted_pk_list": ", ".join(obj_quoted_pk_list),
                "obj_function_result_datatype": obj_function_result_datatype,
                "obj_procedure_result_set_datatype": obj_procedure_result_set_datatype,
                "obj_bigint_field_list": ", ".join(obj_bigint_field_list),
                "obj_fixed_point_field_list": ", ".join(obj_fixed_point_field_list),
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

            # Trait-based API implementation (for now, only used on Swift).
            obj_traits = ["MrsBaseObject"]

            if "CREATE" in enabled_crud_ops:
                obj_traits.append("Creatable")
            if "READ" in enabled_crud_ops:
                obj_traits.append("Readable")
            if "READUNIQUE" in enabled_crud_ops:
                obj_traits.append("UniquelyReadable")
            if "UPDATE" in enabled_crud_ops:
                obj_traits.append("Updatable")
            if "DELETE" in enabled_crud_ops:
                obj_traits.append("Deletable")
            if "DELETEUNIQUE" in enabled_crud_ops:
                obj_traits.append("UniquelyDeletable")

            mapping["obj_traits"] = ", ".join(obj_traits)

            # Perform the substitution
            filled_temp += Template(obj_template).substitute(**mapping)

        template = template.replace(loop.group(), filled_temp)

    return {"template": template, "enabled_crud_ops": enabled_crud_ops, "required_datatypes": required_datatypes, "requires_auth": requires_auth}


def get_datatype_mapping(db_datatype, sdk_language):
    if db_datatype is None:
        db_datatype = "text"

    db_datatype = db_datatype.lower()
    if sdk_language == "typescript":
        if db_datatype.startswith(("tinyint(1)", "bit(1)")):
            return "boolean"
        if db_datatype.startswith(("tinyint", "smallint", "mediumint", "int", "float", "double")):
            return "number"
        if db_datatype.startswith("json"):
            return "JsonValue"
        if db_datatype.startswith("geomcollection"):
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
        if db_datatype.startswith(("bigint")):
            return "BigInteger"
        if db_datatype.startswith(("decimal", "numeric")):
            return "Decimal"
        if db_datatype.startswith("vector"):
            return "Vector"
        return "string"
    if sdk_language == "python":
        if db_datatype.startswith(("tinyint(1)", "bit(1)")):
            return "bool"
        if db_datatype.startswith(("tinyint", "smallint", "mediumint", "int", "bigint")):
            return "int"
        if db_datatype.startswith(("float", "double")):
            return "float"
        if db_datatype.startswith(("decimal", "numeric")):
            return "Decimal"
        if db_datatype.startswith("json"):
            return "JsonValue"
        if db_datatype.startswith("geometry"):
            return "Geometry"
        if db_datatype.startswith("point"):
            return "Point"
        if db_datatype.startswith("linestring"):
            return "LineString"
        if db_datatype.startswith("polygon"):
            return "Polygon"
        if db_datatype.startswith("multipoint"):
            return "MultiPoint"
        if db_datatype.startswith("multilinestring"):
            return "MultiLineString"
        if db_datatype.startswith("multipolygon"):
            return "MultiPolygon"
        if db_datatype.startswith("geomcollection"):
            return "GeometryCollection"
        if db_datatype.startswith(("datetime", "timestamp")):
            return "DateTime"
        if db_datatype.startswith("date"):
            return "Date"
        if db_datatype.startswith("time"):
            return "Time"
        if db_datatype.startswith("year"):
            return "Year"
        if db_datatype.startswith("vector"):
            return "Vector"
        return "str"
    if sdk_language == "swift":
        if db_datatype.startswith(("tinyint(1)", "bit(1)")):
            return "Bool"
        if db_datatype.startswith("tinyint unsigned"):
            return "UInt8"
        if db_datatype.startswith("tinyint"):
            return "Int8"
        if db_datatype.startswith("smallint unsigned"):
            return "UInt16"
        if db_datatype.startswith("smallint"):
            return "Int16"
        if db_datatype.startswith(("mediumint unsigned", "int unsigned")):
            return "UInt32"
        if db_datatype.startswith(("mediumint", "int")):
            return "Int32"
        if db_datatype.startswith(("bigint unsigned")):
            return "UInt64"
        if db_datatype.startswith(("bigint")):
            return "Int64"
        if db_datatype.startswith("float"):
            return "Float"
        if db_datatype.startswith(("decimal", "numeric", "double")):
            return "Double"
        return "String"
    return "unknown"


def get_enhanced_datatype_mapping(db_datatype, sdk_language):
    enhanced_map = {
        "python": {
            "bool": "BoolField",
            "int": "IntField",
            "float": "FloatField",
            "str": "StringField",
            "Date": "DateField",
            "DateTime": "DateTimeField",
            "Time": "TimeField",
            "Year": "YearField",
            "Vector": "VectorField",
        }
    }
    if sdk_language in ("typescript", "swift"):
        # In TypeScript, the fields of type ${DatabaseObject} are the same as type ${DatabaseObject}Params
        return get_datatype_mapping(db_datatype, sdk_language)
    if sdk_language == "python":
        # If `py_datatype` not in the list of types to be enhanced,
        # then we assume it shouldn't be enhanced and returned it as it is.
        py_datatype = get_datatype_mapping(db_datatype, sdk_language)
        return enhanced_map[sdk_language].get(py_datatype, py_datatype)

    return "unknown"


def maybe_null(client_datatype, sdk_language):
    if sdk_language == "typescript":
        return f"MaybeNull<{client_datatype}>"
    if sdk_language == "python":
        return f"Optional[{client_datatype}]"
    if sdk_language == "swift":
        # In Swift, a "null" value happens when an optional constant or variable is assigned "nil".
        # Optionality is already specified by the client data type, so there is nothing to do.
        return client_datatype
    return "unknown"


def get_interface_datatype(
    field,
    sdk_language,
    class_name="",
    reference_class_name_suffix="",
    enhanced_fields=False,
    nullable=True,
    unwrap=False,
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

        if not nullable or db_not_null is True or unwrap is True:
            return client_datatype

        return maybe_null(client_datatype, sdk_language)
    class_name_postfix = generate_identifier(value=field.get("name"), primitive="class", existing_identifiers=[])
    return f"I{class_name}{reference_class_name_suffix}{class_name_postfix}"


def datatype_is_primitive(
    client_datatype: str, sdk_language: ProgrammingLanguage = "typescript"
):
    # for now, consider only the data types we actually are able to map into
    if client_datatype is None:
        return False

    if sdk_language == "typescript":
        if client_datatype.startswith(("boolean", "number", "string")):
            return True
        return False
    if sdk_language == "python":
        if client_datatype.startswith(
            ("bool", "float", "int", "str", "list", "tuple", "dict")
        ):
            return True
        return False
    if sdk_language == "swift":
        if client_datatype.startswith(
            (
                "Bool",
                "UInt8",
                "Int8",
                "UInt16",
                "Int16",
                "UInt32",
                "Int32",
                "UInt64",
                "Int64",
                "Float",
                "Double",
                "String",
            )
        ):
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

    if ((id_generation is not None and id_generation.startswith("auto_inc")) or
        (datatype is not None and datatype.startswith("timestamp"))):
        return True

    return False


def field_is_sortable(field):
    return field.get("allow_sorting", False)


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
                is_array = ref_mapping and ref_mapping.get("to_many", False)

                if is_array and sdk_language == "python":
                    return f"list[{datatype}]"
                if is_array:
                    return f"{datatype}[]"

                return datatype

    return None


def generate_type_declaration(
    name,
    parents=[],
    fields={},
    sdk_language: ProgrammingLanguage = "typescript",
    construct_type="struct",
    ignore_base_types=False,
    non_mandatory_fields: set[str] = set(),  # Users may or not specify them
    requires_placeholder=False,
    is_unpacked=False,
    readonly_fields: set[str] = set(),
    nesting_fields: set[str] = set(),
    nested_value_prefix: str = "",
):
    if len(fields) == 0:
        if not requires_placeholder:
            return ""
        return generate_type_declaration_placeholder(name, sdk_language, is_unpacked)
    if sdk_language == "typescript":
        field_block = [
            generate_type_declaration_field(
                name,
                f"I{nested_value_prefix}{value.lstrip("I")}" if name in nesting_fields else value,
                sdk_language,
                non_mandatory=(name in non_mandatory_fields),
                allowed_special_characters={"(", ")"},
                readonly=name in readonly_fields,
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
    if sdk_language == "python":
        field_block = [
            generate_type_declaration_field(
                name,
                f"list[I{nested_value_prefix}{value.lstrip("list[I")}" if name in nesting_fields else value,
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
        return f"class I{name}{inheritance_block}:\n" + "".join(field_block) + "\n\n"
    if sdk_language == "swift":
        field_block = [
            generate_type_declaration_field(
                name,
                value,
                sdk_language,
                non_mandatory=(name in non_mandatory_fields),
                readonly=(name in readonly_fields),
            )
            for name, value in fields.items()
        ]
        inheritance_block = f": {", ".join(parents)}" if len(parents) > 0 else ""

        return f"public {construct_type} I{name}{inheritance_block} {{\n{"".join(field_block)}}}\n\n"
    return ""


def generate_type_declaration_field(
    name, value, sdk_language, non_mandatory=False, allowed_special_characters=None, readonly=False, initialized=True
):
    name = generate_identifier(
        value=name,
        sdk_language=sdk_language,
        existing_identifiers=[],
        allowed_special_characters=allowed_special_characters,
    )
    indent = " " * 4

    if sdk_language == "typescript":
        field_name_part = f"{indent}{"readonly " if readonly else ""}{name}?" if non_mandatory else f"{indent}{"readonly " if readonly else ""}{name}"
        if isinstance(value, list):
            return f"{field_name_part}: {value[0]}[],\n"
        return f"{field_name_part}: {value},\n"

    if sdk_language == "python":
        if isinstance(value, list):
            hint = f"NotRequired[list[{value[0]}]]" if non_mandatory is True else f"list[{value[0]}]"
        else:
            hint = f"NotRequired[{value}]" if non_mandatory is True else f"{value}"
        return f'{indent}{name}: {hint}\n'
    if sdk_language == "swift":
        if isinstance(value, list):
            hint = f"[{value[0]}]"
        else:
            hint = value
        return f"{indent}public {'let' if readonly else 'var'} {name}: {hint}{'?' if non_mandatory else ''}{' = nil' if non_mandatory and initialized else ''}\n"
    return ""


def generate_data_class(
    name,
    fields,
    sdk_language,
    db_object_crud_ops: list[str],
    parents: list[str] = [],
    obj_endpoint: Optional[str] = None,
    primary_key_fields: set[str] = set(),
):
    if sdk_language == "typescript":
        if len(primary_key_fields) > 0:
            if "UPDATE" in db_object_crud_ops:
                fields.update({ "update()": f"Promise<I{name}>" })
            if "DELETE" in db_object_crud_ops:
                fields.update({ "delete()": f"Promise<void>" })
        return generate_type_declaration(
            name=name,
            fields=fields,
            sdk_language=sdk_language,
            non_mandatory_fields=set(fields).difference({"update()", "delete()"}),
            readonly_fields=primary_key_fields,
            parents=parents,
        )

    if sdk_language == "python":
        field_type_block = [
            (
                generate_type_declaration_field(name, value, sdk_language).rstrip()
                + " | UndefinedDataClassField\n"
            )
            for name, value in fields.items()
        ]

        field_profile = []
        for field_name, type_hint in [
            (
                generate_identifier(value=field, sdk_language=sdk_language, existing_identifiers=[]),
                value[0] if isinstance(value, list) else value,
            )
            for field, value in fields.items()
        ]:
            field_profile.append(f'"{field_name}": {type_hint}')
        join_field_profile = (
            "{\n" + f"{" "*16}" + f",\n{" "*16}".join(field_profile).rstrip() + f"\n{" "*12}" + "}"
        )

        mixins = []
        if len(primary_key_fields) > 0:
            if "UPDATE" in db_object_crud_ops:
                mixins.append(f'\n\t_MrsDocumentUpdateMixin["I{name}Data", "I{name}", "I{name}Details"],')
            if "DELETE" in db_object_crud_ops:
                mixins.append(f'\n\t_MrsDocumentDeleteMixin["I{name}Data", "I{name}Filterable"],')
            if mixins:
                mixins.append("\n\t")

        return SDK_PYTHON_DATACLASS_TEMPLATE.format(
            name=name,
            join_field_block="".join(field_type_block).rstrip(),
            obj_endpoint=obj_endpoint,
            field_profile=join_field_profile,
            primary_key_name=(
                None if len(primary_key_fields) == 0 else f'"{",".join([lib.core.convert_to_snake_case(pk_field) for pk_field in primary_key_fields])}"'
            ),
            mixins="".join(mixins),
        )
    if sdk_language == "swift":
        field_type_block = [
            (
                generate_type_declaration_field(
                    name,
                    value,
                    sdk_language,
                    non_mandatory=True,
                    readonly=name in primary_key_fields,
                    initialized=False,
                )
            )
            for name, value in fields.items()
        ]
        assignment_block = [
            f'{" " * 8}self.{field} = data.{field}\n'
            for field in [
                generate_identifier(value=field, sdk_language=sdk_language)
                for field in [
                    name for name in fields.keys() if name not in primary_key_fields
                ]
            ]
        ]

        mixins = parents
        if len(primary_key_fields) > 0:
            if "UPDATE" in db_object_crud_ops:
                mixins.append("SelfUpdatable")
            if "DELETE" in db_object_crud_ops:
                mixins.append("SelfDeletable")

        if len(primary_key_fields) > 0:
            primary_key_field_names = [
                generate_identifier(value=value, sdk_language=sdk_language)
                for value in primary_key_fields
            ]
            primary_key_checks = " || ".join(
                [f"self.{value} == nil" for value in primary_key_field_names]
            )
            primary_key_values = "".join(
                [f"String(self.{value}!)" for value in primary_key_field_names]
            )

        init_assignment_block = [
            f'{" " * 8}self.{field_name} = try container.decodeIfPresent({field_type}.self, forKey: .{field_name})'
            for field_name, field_type in fields.items()
        ]

        field_encode_block = [
            f'{" " * 8}try container.encode({field_name}, forKey: .{field_name})'
            for field_name in fields.keys()
        ]

        return SDK_SWIFT_DATACLASS_TEMPLATE.format(
            name=name,
            join_field_block="".join(field_type_block),
            join_field_name_block=", ".join([name for name in fields.keys()]),
            join_assignment_block="".join(assignment_block).rstrip(),
            join_init_assignments="\n".join(init_assignment_block),
            join_field_encode="\n".join(field_encode_block),
            primary_key_name=(
                "nil"
                if len(primary_key_fields) == 0
                else f'{primary_key_checks} ? nil : [{primary_key_values}].joined(separator: ",")'
            ),
            mixins=", ".join(mixins),
        )
    return ""


def generate_field_enum(name, fields=None, sdk_language: ProgrammingLanguage = "typescript"):
    if sdk_language == "python":
        if not fields or len(fields) == 0:
            # To avoid conditional logic in the template, we can generate a placeholder declaration regardless.
            return generate_type_declaration_placeholder(f"{name}Field", sdk_language)

        fields_in_case = [lib.core.convert_to_snake_case(field) for field in fields]
        return generate_enum(f"{name}Field", fields_in_case, sdk_language)
    # In TypeScript the field enum can be obtained using keyof on the original object type declaration, so there is
    # no need for an additional type declaration.
    # TODO: Check the Swift SDK API for selecting VIEW fields.
    return ""


def generate_enum(name, values, sdk_language):
    enum_def = generate_literal_type(values, sdk_language)
    if sdk_language == "typescript":
        return f"export type I{name} = {enum_def};\n\n"
    if sdk_language == "python":
        return f"I{name}: TypeAlias = {enum_def}\n\n\n"
    if sdk_language == "swift":
        items = [f'{" " * 4}case {value} = "{value}"' for value in values]
        return (f"enum I{name}: String, CaseIterable {{\n" +
            f"{'\n'.join(items)}\n" +
            "}\n\n"
        )
    return ""


def generate_type_declaration_placeholder(name, sdk_language, is_unpacked=False):
    if sdk_language == "typescript":
        return f"type I{name} = never;\n\n"
    if sdk_language == "python":
        if not is_unpacked:
            return f"I{name}: TypeAlias = None\n\n\n"
        # Using an empty TypedDict helps to avoid issues with Unpack
        return f"class I{name}(TypedDict):\n    pass\n\n\n"
    return ""


def generate_literal_type(values, sdk_language):
    if sdk_language == "typescript":
        items = [f'"{value}"' for value in values]
        return f"{' | '.join(items)}"
    if sdk_language == "python":
        items = [f'{" " * 4}"{value}"' for value in values]
        s = ',\n'.join(items)
        return (f"Literal[\n" +
            f"{s},\n" +
            "]")
    return ""


def generate_selectable(name, fields, sdk_language):
    if sdk_language == "typescript":
        return ""
    if sdk_language == "python":
        return generate_type_declaration(name=f"{name}Selectable", fields={ field: "bool" for field in fields },
                                         sdk_language=sdk_language, non_mandatory_fields=set(fields))
    if sdk_language == "swift":
        return generate_enum(name=f"{name}Selectable", values=[field_name for field_name in fields], sdk_language=sdk_language)
    return ""


def generate_sortable(
    name: str,
    fields: set[str] = set(),
    sdk_language: ProgrammingLanguage = "typescript",
):
    if sdk_language == "typescript":
        return generate_tuple(
            name=f"I{name}Sortable",
            values=fields,
            sdk_language=sdk_language,
        )
    if sdk_language == "python":
        return generate_type_declaration(
            name=f"{name}Sortable",
            fields={field: "Order" for field in fields},
            sdk_language=sdk_language,
            non_mandatory_fields=set(fields),
            requires_placeholder=True,
        )
    if sdk_language == "swift":
        return generate_enum(name=f"{name}Sortable", values=[field_name for field_name in fields], sdk_language=sdk_language)
    return ""


def generate_union(name, types, sdk_language):
    if sdk_language == "typescript":
        return f"export type {name} = {' | '.join(types)};\n\n"
    if sdk_language == "python":
        return f"{name}: TypeAlias = {' | '.join(types)}\n\n\n"
    return ""


def generate_sequence_constant(name, values, sdk_language):
    if sdk_language == "typescript":
        return f"const {name} = {json.dumps(values)} as const;\n"
    if sdk_language == "python":
        return f"{name}: Sequence = {json.dumps(values)}\n\n"
    return ""


def generate_tuple(
    name: str,
    values: set[str] = set(),
    sdk_language: ProgrammingLanguage = "typescript",
):
    if sdk_language == "typescript":
        return f"export type {name} = [{', '.join([f'"{value}"' for value in sorted(values)])}];\n\n"
    if sdk_language == "python":
        tuple_elements = (
            "()"
            if len(values) == 0
            else ", ".join([f'Literal["{value}"]' for value in sorted(values)])
        )
        return f"{name}: TypeAlias = tuple[{tuple_elements}]\n\n\n"
    return ""


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
    reduced_to_datatype_fields = {}
    param_interface_fields = {}
    out_params_interface_fields = {}
    obj_unique_fields = {}
    obj_cursor_fields = {}
    obj_sortable_fields: set[str] = set()
    has_nested_fields = False
    required_datatypes: set[str] = set()
    nested_fields: set[str] = set()
    nesting_fields: set[str] = set()
    generated_type_aliases: set[str] = set()

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
                # nested field type aliases are already top-level type aliases for other REST objects
                # we want to re-use them instead of clone them into a new ones
                nested_class_name = class_name.rstrip(lib.core.convert_path_to_pascal_case(db_obj.get("name")))
                datatype = get_interface_datatype(field, sdk_language, nested_class_name)
                has_nested_fields = True
                # Check if the field should be reduced to the value of another field
                reduced_to_datatype = get_reduced_field_interface_datatype(
                    field, fields, sdk_language, nested_class_name
                )
                if reduced_to_datatype:
                    reduced_to_datatype_fields.update({field.get("name"): reduced_to_datatype})
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
                            nested_datatype = None
                            relationship = field.get("object_reference").get("reference_mapping").get("kind")
                            if relationship == "1:n" and sdk_language == "typescript":
                                nested_datatype = f"{datatype}[]"
                            elif relationship == "1:n" and sdk_language == "python":
                                nested_datatype = f"list[{datatype}]"
                            elif relationship == "1:n" and sdk_language == "swift":
                                nested_datatype = f"[{datatype}]"

                            if nested_datatype is not None:
                                interface_fields.update({field.get("name"): nested_datatype})
                                # Add all table fields that have allow_filtering set and SP params to the
                                # param_interface_fields
                                param_interface_fields.update({field.get("name"): nested_datatype})

                    # Call recursive interface generation
                    generate_nested_interfaces(
                        obj_interfaces,
                        interface_fields | reduced_to_datatype_fields,
                        field,
                        reference_class_name_suffix=lib.core.convert_path_to_pascal_case(
                            field.get("name")
                        ),
                        fields=fields,
                        class_name=nested_class_name,
                        sdk_language=sdk_language,
                        nesting_fields=nesting_fields,
                        fully_qualified_parent_name=field.get("name"),
                        allowed_crud_ops=set(db_object_crud_ops),
                        reference_obj=obj,
                        generated_type_aliases=generated_type_aliases,
                        required_datatypes=required_datatypes,
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

                # Build list of sortable fields
                if field_is_sortable(field):
                    obj_sortable_fields.add(field.get("name"))

    if not object_is_routine(db_obj):
        # The object is a TABLE or a VIEW
        data_type_alias_name = f"{class_name}Data"
        creatable_type_alias_name = f"New{class_name}"
        updatable_type_alias_name = f"Update{class_name}"

        if sdk_language == "python":
            # These type aliases are not needed for TypeScript because it uses a Proxy to replace the interface
            # and not a wrapper class. This might change in the future.
            # In Swift, these are also not used because we cannot downcast them to types with different requirements.
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

            # Do not generate type aliases that have already been created whilst processing nested fields.
            if data_type_alias_name not in generated_type_aliases:
                obj_interfaces.append(
                    generate_type_declaration(
                        name=f"{class_name}Data",
                        fields=interface_fields,
                        sdk_language=sdk_language,
                        non_mandatory_fields=set(interface_fields),
                    )
                )

        # Do not generate type aliases that have already been created whilst processing nested fields.
        if "CREATE" in db_object_crud_ops and creatable_type_alias_name not in generated_type_aliases:
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
                    name=creatable_type_alias_name,
                    fields=interface_fields,
                    sdk_language=sdk_language,
                    non_mandatory_fields=obj_non_mandatory_fields,
                    nesting_fields=nesting_fields,
                    nested_value_prefix="New",
                    parents=["Encodable"] if sdk_language == "swift" else [],
                )
            )
            generated_type_aliases.add(creatable_type_alias_name)

        # Do not generate type aliases that have already been created whilst processing nested fields.
        # Do not generate CRUD-specific type aliases for Swift because we cannot downcast to them.
        if "UPDATE" in db_object_crud_ops and updatable_type_alias_name not in generated_type_aliases and sdk_language in ("typescript", "python"):
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
                    name=updatable_type_alias_name,
                    fields=interface_fields,
                    sdk_language=sdk_language,
                    non_mandatory_fields=set(nullable_fields),
                    nesting_fields=nesting_fields,
                    nested_value_prefix="Update",
                )
            )
            generated_type_aliases.add(updatable_type_alias_name)

        if class_name not in generated_type_aliases:
            primary_key_fields = [field.get("name") for field in fields if field_is_pk(field)]
            obj_interfaces.append(
                generate_data_class(
                    name=class_name,
                    fields=interface_fields | reduced_to_datatype_fields,
                    sdk_language=sdk_language,
                    db_object_crud_ops=db_object_crud_ops,
                    obj_endpoint=obj_endpoint,
                    primary_key_fields=set(primary_key_fields),
                    parents=["MrsDocument"] if sdk_language == "swift" else [],
                )
            )
            generated_type_aliases.add(class_name)

        obj_interfaces.append(
            generate_field_enum(
                name=class_name, fields=interface_fields | reduced_to_datatype_fields, sdk_language=sdk_language
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
        else:
            obj_interfaces.append(
                generate_field_enum(
                    name=f"{class_name}Nested",
                    fields=nested_fields,
                    sdk_language=sdk_language,
                )
            )

        obj_interfaces.append(
            generate_selectable(class_name, interface_fields | reduced_to_datatype_fields, sdk_language)
        )

        obj_interfaces.append(
            generate_sortable(class_name, obj_sortable_fields, sdk_language)
        )

        construct_parents = (
            []
            if sdk_language != "python"
            else ["Generic[Filterable]", "HighOrderOperator[Filterable]"]
        )
        obj_interfaces.append(
            generate_type_declaration(
                name=f"{class_name}Filterable",
                parents=construct_parents,
                fields=param_interface_fields,
                sdk_language=sdk_language,
                ignore_base_types=True,
                non_mandatory_fields=set() if sdk_language == "swift" else set(param_interface_fields),
            )
        )

        obj_interfaces.append(
            generate_type_declaration(
                name=f"{class_name}UniqueFilterable",
                fields=obj_unique_fields,
                sdk_language=sdk_language,
                non_mandatory_fields=set() if sdk_language == "swift" else set(obj_unique_fields),
            )
        )

        obj_interfaces.append(
            generate_type_declaration(
                name=f"{class_name}Cursors",
                fields=obj_cursor_fields,
                sdk_language=sdk_language,
                non_mandatory_fields=set() if sdk_language == "swift" else set(obj_cursor_fields),
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
            if sdk_language == "typescript":
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
                        ["JsonObject"] if sdk_language == "typescript" else []
                    ),  # TypeScript tagged unions inherit from JsonObject
                )
            )

            # The Python SDK uses a generic dataclass for the tagged union of result set types.
            # The generic dataclass needs to know the possible values of the "type" field.
            if sdk_language == "python":
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
            if sdk_language == "typescript":
                required_datatypes.add("MaybeNull")

        # Type definition for the set of IN/INOUT Parameters.
        obj_interfaces.append(
            generate_type_declaration(
                name=class_name,
                fields=param_interface_fields,
                sdk_language=sdk_language,
                non_mandatory_fields=set(param_interface_fields),
                # To avoid conditional logic in the template, we should generate a void type declaration.
                requires_placeholder=True,
                is_unpacked=True,
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
        reference_class_name_suffix,
        fields, class_name, reference_obj,
        sdk_language: ProgrammingLanguage = "typescript",
        fully_qualified_parent_name: str = "",
        nested_fields: set[str] = set(),
        nesting_fields: set[str] = set(),
        allowed_crud_ops: set[str] = set(),
        generated_type_aliases: set[str] = set(),
        required_datatypes: set[str] = set()):
    # Build interface name
    interface_name = f"{class_name}{reference_class_name_suffix}"

    # Check if the reference has unnest set, and if so, use the parent_interface_fields
    parent_obj_ref = parent_field.get("object_reference")
    interface_fields = {} if not parent_obj_ref.get(
        "unnest") else parent_interface_fields
    reduced_to_datatype_fields = {}

    for field in fields:
        if (field.get("parent_reference_id") == parent_field.get("represents_reference_id") and
                field.get("enabled")):
            # Handle references
            if field.get("represents_reference_id"):
                # Check if the field should be reduced to the value of another field
                reduced_to_datatype = get_reduced_field_interface_datatype(
                    field, fields, sdk_language, class_name)
                if reduced_to_datatype:
                    reduced_to_datatype_fields.update({ field.get("name"): reduced_to_datatype })
                else:
                    obj_ref = field.get("object_reference")
                    field_interface_name = lib.core.convert_path_to_pascal_case(
                        field.get("name"))
                    # Add field if the referred table is not unnested
                    if not obj_ref.get("unnest"):
                        datatype = f"{class_name}{reference_class_name_suffix + field.get("name")}"
                        # Should use the corresponding nested field type.
                        interface_fields.update({ field.get("name"): f"I{interface_name}" + field_interface_name })

                    # If not, do recursive call
                    generate_nested_interfaces(
                        obj_interfaces,
                        interface_fields,
                        field,
                        reference_class_name_suffix=reference_class_name_suffix
                        + field_interface_name,
                        fields=fields,
                        class_name=class_name,
                        reference_obj=reference_obj,
                        sdk_language=sdk_language,
                        nested_fields=nested_fields,
                        fully_qualified_parent_name=f"{parent_field.get("name")}.{field.get("name")}",
                        generated_type_aliases=generated_type_aliases,
                        required_datatypes=required_datatypes,
                    )
            else:
                datatype = get_interface_datatype(field, sdk_language)
                unwrapped_datatype = get_interface_datatype(field, sdk_language=sdk_language, unwrap=True)
                if not datatype_is_primitive(unwrapped_datatype, sdk_language):
                    required_datatypes.add(unwrapped_datatype)
                interface_fields.update({ field.get("name"): datatype })

    if not parent_obj_ref.get("unnest"):
        data_type_alias_name = f"{interface_name}Data"
        creatable_type_alias_name = f"New{interface_name}"
        updatable_type_alias_name = f"Update{interface_name}"
        # Do not generate type aliases that have already been created whilst processing top-level fields.
        if data_type_alias_name not in generated_type_aliases:
            obj_interfaces.append(
                generate_type_declaration(
                    name=data_type_alias_name,
                    fields=interface_fields,
                    sdk_language=sdk_language,
                    non_mandatory_fields=set(interface_fields),
                )
            )
        # Do not generate type aliases that have already been created whilst processing top-level fields.
        if "CREATE" in allowed_crud_ops and creatable_type_alias_name not in generated_type_aliases:
            non_mandatory_fields = [
                field.get("name")
                for field in fields
                # exclude fields that are out of range (e.g. on different nesting levels)
                if field.get("parent_reference_id") == parent_field.get("represents_reference_id")
                and field_is_required(field, reference_obj) is False
            ]
            obj_interfaces.append(
                generate_type_declaration(
                    name=creatable_type_alias_name,
                    fields=interface_fields,
                    sdk_language=sdk_language,
                    non_mandatory_fields=set(non_mandatory_fields),
                    nesting_fields=nesting_fields,
                    nested_value_prefix="New",
                )
            )
            generated_type_aliases.add(creatable_type_alias_name)
        # Do not generate type aliases that have already been created whilst processing top-level fields.
        # Do not generate CRUD-specific type aliases for Swift because we cannot downcast to them.
        if (
            "UPDATE" in allowed_crud_ops
            and updatable_type_alias_name not in generated_type_aliases
            and sdk_language in ("typescript", "python")
        ):
            nullable_fields = [
                field.get("name")
                for field in fields
                # exclude fields that are out of range (e.g. on different nesting levels)
                if field.get("parent_reference_id")
                == parent_field.get("represents_reference_id")
                and field_is_nullable(field)
                or field_has_row_ownership(field, reference_obj)
            ]
            obj_interfaces.append(
                generate_type_declaration(
                    name=updatable_type_alias_name,
                    fields=interface_fields,
                    sdk_language=sdk_language,
                    non_mandatory_fields=set(nullable_fields),
                    nesting_fields=nesting_fields,
                    nested_value_prefix="Update",
                )
            )
            generated_type_aliases.add(updatable_type_alias_name)
        # Do not generate type aliases that have already been created whilst processing top-level fields.
        if interface_name not in generated_type_aliases:
            readable_type_alias_fields = interface_fields | reduced_to_datatype_fields
            obj_interfaces.append(
                generate_data_class(
                    name=interface_name,
                    fields=readable_type_alias_fields,
                    sdk_language=sdk_language,
                    db_object_crud_ops=list(allowed_crud_ops),
                )
            )
            generated_type_aliases.add(interface_name)
        nesting_fields.add(fully_qualified_parent_name)
        nested_fields.update([f"{fully_qualified_parent_name}.{field}" for field in interface_fields])


def get_mrs_runtime_management_code(session):
    """Returns TypeScript code that allows the user to manage specific MRS runtime settings.

    This includes the configuration status of MRS with an info string giving context sensitive
    information how and the list of available REST services with their URL and
    and methods to set which REST services is the current one and to print the SDK runtime code.

    Args:
        session (object): The database session to use.

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
