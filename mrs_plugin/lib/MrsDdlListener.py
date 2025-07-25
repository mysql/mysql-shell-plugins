# Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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
import antlr4
from mrs_plugin.lib.mrs_parser import MRSListener
from mrs_plugin.lib.mrs_parser import MRSParser
from mrs_plugin.lib.MrsDdlExecutorInterface import MrsDdlExecutorInterface
import re
import json
import os


def get_text_without_quotes(txt):
    if txt is None:
        return None

    if len(txt) < 2:
        return txt

    if txt[0] == "`" and txt[len(txt) - 1] == "`":
        return txt[1:-1].replace("\\`", "`").replace("\\\\", "\\")

    if txt[0] == "'" and txt[len(txt) - 1] == "'":
        return txt[1:-1].replace("\\'", "'").replace("\\\\", "\\")

    if txt[0] == '"' and txt[len(txt) - 1] == '"':
        return txt[1:-1].replace('\\"', '"').replace("\\\\", "\\")

    return txt


def unquoted_node_text_or_none(node):
    if node:
        return get_text_without_quotes(node.getText())
    return None


def validate_rest_request_path(text, allow_wildcards=False):
    if not text or text[0] == "/" or (allow_wildcards and text[0] in "*?"):
        return
    raise Exception("Invalid REST request path or wildcard")


class MrsDdlListener(MRSListener):

    def __init__(self, mrs_ddl_executor: MrsDdlExecutorInterface, session):
        self.mrs_ddl_executor = mrs_ddl_executor
        self.session = session
        self.mrs_object = {}

    def get_uuid(self):
        return lib.core.convert_id_to_string(lib.core.get_sequence_id(self.session))

    def create_prefix(self, ctx):
        if ctx.REPLACE_SYMBOL():
            return "CREATE OR REPLACE"
        if ctx.EXISTS_SYMBOL():
            return "CREATE IF NOT EXISTS"
        return "CREATE"

    # ------------------------------------------------------------------------------------------------------------------
    # Common handlers

    def enterJsonOptions(self, ctx):
        try:
            if ctx.MERGE_SYMBOL() is not None:
                self.mrs_object["merge_options"] = True
            self.mrs_object["options"] = json.loads(ctx.jsonValue().getText())
        except:
            pass

    def enterAppOptions(self, ctx):
        try:
            self.mrs_object["app_options"] = json.loads(ctx.jsonValue().getText())
        except:
            pass

    def enterMetadata(self, ctx):
        try:
            self.mrs_object["metadata"] = json.loads(ctx.jsonValue().getText())
        except:
            pass

    def enterComments(self, ctx):
        self.mrs_object["comments"] = get_text_without_quotes(
            ctx.textStringLiteral().getText()
        )

    def enterEnabledDisabled(self, ctx):
        if ctx.ENABLED_SYMBOL() is not None:
            self.mrs_object["enabled"] = True
        if ctx.DISABLED_SYMBOL() is not None:
            self.mrs_object["enabled"] = False

    def enterPublishedUnpublished(self, ctx):
        if ctx.PUBLISHED_SYMBOL() is not None:
            self.mrs_object["published"] = True
        if ctx.UNPUBLISHED_SYMBOL() is not None:
            self.mrs_object["published"] = False

    def enterEnabledDisabledPrivate(self, ctx):
        if ctx.ENABLED_SYMBOL() is not None:
            self.mrs_object["enabled"] = True
        elif ctx.DISABLED_SYMBOL() is not None:
            self.mrs_object["enabled"] = False
        elif ctx.PRIVATE_SYMBOL() is not None:
            self.mrs_object["enabled"] = 2

    def enterAuthenticationRequired(self, ctx):
        # If the NOT keyword is present in (AUTHENTICATION NOT? REQUIRED)?
        # authentication is not required
        if ctx.NOT_SYMBOL() is not None:
            self.mrs_object["requires_auth"] = False
        else:
            self.mrs_object["requires_auth"] = True

    def enterItemsPerPage(self, ctx):
        self.mrs_object["items_per_page"] = int(ctx.itemsPerPageNumber().getText())

    def enterServiceDeveloperIdentifier(self, ctx):
        # If the new_developer_list list has been initialized, all following developers are part of the
        # new developer list to be set by the ALTER REST SERVICE statement
        if "new_developer_list" in self.mrs_object.keys():
            self.mrs_object["new_developer_list"].append(
                get_text_without_quotes(ctx.getText())
            )
        else:
            if not "in_development" in self.mrs_object.keys():
                self.mrs_object["in_development"] = {"developers": []}

            self.mrs_object["in_development"]["developers"].append(
                get_text_without_quotes(ctx.getText())
            )

    def exitRequestPathIdentifier(self, ctx):
        text = ctx.getText()
        if text and text[0] in '`"':
            text = get_text_without_quotes(text)
            validate_rest_request_path(text, False)
        return text

    def exitRequestPathIdentifierWithWildcard(self, ctx):
        text = ctx.getText()
        if text and text[0] in '`"':
            text = get_text_without_quotes(text)
            validate_rest_request_path(text, True)
        return text

    def enterServiceRequestPath(self, ctx):
        self.mrs_object["url_context_root"] = get_text_without_quotes(
            ctx.requestPathIdentifier().getText()
        )

    def enterRoleService(self, ctx):
        self.mrs_object["any_service"] = ctx.ANY_SYMBOL() is not None
        if ctx.serviceRequestPath():
            self.mrs_object["url_context_root"] = get_text_without_quotes(
                ctx.serviceRequestPath().getText()
            )

    def enterServiceRequestPathWildcard(self, ctx):
        self.mrs_object["url_context_root_pattern"] = get_text_without_quotes(
            ctx.requestPathIdentifierWithWildcard().getText()
        )

    def enterServiceSchemaSelector(self, ctx):
        self.mrs_object["schema_request_path"] = get_text_without_quotes(
            ctx.schemaRequestPath().getText()
        )

    def enterServiceSchemaSelectorWildcard(self, ctx):
        self.mrs_object["schema_request_path"] = get_text_without_quotes(
            ctx.schemaRequestPathWildcard().getText()
        )

    def enterFileIgnoreList(self, ctx):
        self.mrs_object["file_ignore_list"] = get_text_without_quotes(
            ctx.textStringLiteral().getText()
        )

    def enterAllowNewUsersToRegister(self, ctx):
        self.mrs_object["limit_to_registered_users"] = ctx.NOT_SYMBOL() is not None

    def enterDefaultRole(self, ctx):
        self.mrs_object["default_role"] = get_text_without_quotes(
            ctx.textOrIdentifier().getText()
        )

    def enterAppId(self, ctx):
        self.mrs_object["app_id"] = get_text_without_quotes(
            ctx.textStringLiteral().getText()
        )

    def enterAppSecret(self, ctx):
        self.mrs_object["app_secret"] = get_text_without_quotes(
            ctx.textStringLiteral().getText()
        )

    def enterUrl(self, ctx):
        self.mrs_object["url"] = get_text_without_quotes(
            ctx.textStringLiteral().getText()
        )

    def enterAddAuthApp(self, ctx):
        add_auth_apps = self.mrs_object.get("add_auth_apps", [])
        add_auth_apps.append(
            {
                "auth_app": get_text_without_quotes(ctx.authAppName().getText()),
                "if_exists": ctx.EXISTS_SYMBOL(),
            }
        )
        self.mrs_object["add_auth_apps"] = add_auth_apps

    def enterRemoveAuthApp(self, ctx):
        add_auth_apps = self.mrs_object.get("remove_auth_apps", [])
        add_auth_apps.append(
            {
                "auth_app": get_text_without_quotes(ctx.authAppName().getText()),
                "if_exists": ctx.EXISTS_SYMBOL(),
            }
        )
        self.mrs_object["remove_auth_apps"] = add_auth_apps

    # ==================================================================================================================
    # CREATE REST statements

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST METADATA

    def enterConfigureRestMetadataStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "CONFIGURE REST METADATA",
            "update_if_available": (
                True
                if (
                    ctx.restMetadataOptions() is not None
                    and ctx.restMetadataOptions().updateIfAvailable() is not None
                )
                else False
            ),
        }

    def exitConfigureRestMetadataStatement(self, ctx):
        self.mrs_ddl_executor.createRestMetadata(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST SERVICE

    def enterCreateRestServiceStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " REST SERVICE",
        }

    def enterRestProtocol(self, ctx):
        if ctx.HTTP_SYMBOL() is not None and ctx.HTTPS_SYMBOL() is not None:
            self.mrs_object["url_protocol"] = "HTTP,HTTPS"
        elif ctx.HTTP_SYMBOL() is not None:
            self.mrs_object["url_protocol"] = "HTTP"
        elif ctx.HTTPS_SYMBOL() is not None:
            self.mrs_object["url_protocol"] = "HTTPS"

    def enterAuthPath(self, ctx):
        val = ctx.quotedTextOrDefault().getText()
        if val != "DEFAULT":
            self.mrs_object["auth_path"] = get_text_without_quotes(val)

    def enterAuthRedirection(self, ctx):
        val = ctx.quotedTextOrDefault().getText()
        if val != "DEFAULT":
            self.mrs_object["auth_completed_url"] = get_text_without_quotes(val)

    def enterAuthValidation(self, ctx):
        val = ctx.quotedTextOrDefault().getText()
        if val != "DEFAULT":
            self.mrs_object["auth_completed_url_validation"] = get_text_without_quotes(
                val
            )

    def enterAuthPageContent(self, ctx):
        val = ctx.quotedTextOrDefault().getText()
        if val != "DEFAULT":
            self.mrs_object["auth_completed_page_content"] = get_text_without_quotes(
                val
            )

    def enterUserManagementSchema(self, ctx):
        val = ctx.schemaName()
        if val is not None:
            self.mrs_object["custom_metadata_schema"] = val.strip("`")

    def exitCreateRestServiceStatement(self, ctx):
        self.mrs_ddl_executor.createRestService(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST SCHEMA

    def enterCreateRestSchemaStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " REST SCHEMA",
            "schema_name": get_text_without_quotes(ctx.schemaName().getText()),
            "schema_request_path": (
                get_text_without_quotes(ctx.schemaRequestPath().getText())
                if ctx.schemaRequestPath() is not None
                else f"/{lib.core.unquote(ctx.schemaName().getText())}"
            ),
        }

    def exitCreateRestSchemaStatement(self, ctx):
        self.mrs_ddl_executor.createRestSchema(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST VIEW

    def get_db_object_fields(
        self, object_id, db_schema_name, db_object_name, auto_enable_fields=False
    ):
        # Get the actual columns with references
        columns = lib.db_objects.get_table_columns_with_references(
            session=self.session,
            schema_name=db_schema_name,
            db_object_name=db_object_name,
        )

        parent_reference_stack = self.mrs_object.get("parent_reference_stack")
        if len(parent_reference_stack) > 0:
            parent_reference_id = (
                parent_reference_stack[-1].get("object_reference").get("id")
            )
        else:
            parent_reference_id = None

        # Convert to object_fields and disable all to begin with
        fields = []
        for column in columns:
            db_column = column.get("db_column")
            ref_mapping = column.get("reference_mapping")
            fields.append(
                {
                    "id": self.get_uuid(),
                    "object_id": object_id,
                    "parent_reference_id": parent_reference_id,
                    "name": lib.core.convert_snake_to_camel_case(column.get("name")),
                    "position": column.get("position"),
                    "db_column": column.get("db_column"),
                    "enabled": (auto_enable_fields and ref_mapping is None),
                    "allow_filtering": True,
                    # Only allow sorting for top level fields
                    "allow_sorting": (
                        len(parent_reference_stack) == 0
                        and db_column is not None
                        and (
                            db_column.get("isPrimary") is not None
                            or db_column.get("isUnique") is not None
                        )
                    ),
                    "no_check": False,
                    "no_update": False,
                    "sdk_options": None,
                    "comments": None,
                    "reference_mapping": ref_mapping,
                }
            )

        return fields

    def get_service_sorted_developers(self, developer_list: list):
        sorted_developers = ""
        if developer_list is not None and len(developer_list) > 0:

            def quote(s):
                return f"'{s}'"

            developer_list.sort()
            sorted_developers = (
                ",".join(
                    (
                        quote(re.sub(r"(['\\])", "\\\\\\1", dev, 0, re.MULTILINE))
                        if not re.match(r"^\w+$", dev)
                        else dev
                    )
                    for dev in developer_list
                )
                + "@"
            )
        return sorted_developers

    def get_db_object(self, ctx):
        developer_list = None
        if ctx.serviceSchemaSelector() is not None:
            schema_request_path = get_text_without_quotes(
                ctx.serviceSchemaSelector().schemaRequestPath().getText()
            )
            url_context_root = None
            url_host_name = ""

            serviceRequestPath = ctx.serviceSchemaSelector().serviceRequestPath()
            if serviceRequestPath is not None:
                url_context_root = get_text_without_quotes(
                    ctx.serviceSchemaSelector()
                    .serviceRequestPath()
                    .requestPathIdentifier()
                    .getText()
                )

                if serviceRequestPath.serviceDevelopersIdentifier() is not None:
                    developer_list = []
                    developersIdentifier = (
                        serviceRequestPath.serviceDevelopersIdentifier()
                    )
                    for item in list(developersIdentifier.getChildren()):
                        if isinstance(
                            item, MRSParser.ServiceDeveloperIdentifierContext
                        ):
                            if item.textOrIdentifier() is not None:
                                developer_list.append(
                                    get_text_without_quotes(item.getText())
                                )
                            else:
                                developer_list.append(item.getText())
                    if len(developer_list) == 0:
                        developer_list = None
        else:
            schema_request_path = self.mrs_object.get("schema_request_path")
            url_context_root = self.mrs_object.get("url_context_root")
            url_host_name = self.mrs_object.get("url_host_name")
            if (
                "in_development" in self.mrs_object.keys()
                and "developers" in self.mrs_object.get("in_development")
            ):
                developer_list = self.mrs_object["in_development"]["developers"]

        if schema_request_path is None:
            schema_id = self.mrs_ddl_executor.current_schema_id
            if schema_id is None:
                raise Exception("No REST schema given.")
        else:
            if url_context_root is None:
                raise Exception("No REST service given.")

            service = lib.services.get_service(
                session=self.session,
                url_context_root=url_context_root,
                url_host_name=url_host_name,
                developer_list=developer_list,
            )
            if service is None:
                raise Exception(
                    f"The REST service `{
                        self.get_service_sorted_developers(developer_list)}"
                    + f"{url_host_name}{url_context_root}` was not found."
                )

            schema = lib.schemas.get_schema(
                session=self.session,
                service_id=service["id"],
                request_path=schema_request_path,
            )

            if schema is None:
                raise Exception(
                    f"""The REST schema `{
                        url_host_name if url_host_name is not None else ''}{
                            url_context_root if url_context_root is not None else ''}{
                                schema_request_path if schema_request_path is not None else ''
                    }` was not found."""
                )
            schema_id = schema["id"]

        db_object = lib.db_objects.get_db_object(
            session=self.session,
            schema_id=schema_id,
            request_path=self.mrs_object.get("request_path"),
        )
        if db_object is None:
            raise Exception(
                f"""REST object `{url_host_name}{url_context_root}{
                    schema_request_path}{
                        self.mrs_object.get("request_path")}` was not found."""
            )

        return db_object

    def set_schema_name_and_name(self, ctx):
        # If no schema name nor name was given, look it up from existing db_object
        if ctx.qualifiedIdentifier() is None:
            db_object = self.get_db_object(ctx=ctx)

            self.mrs_object["name"] = db_object.get("name")
            self.mrs_object["schema_name"] = db_object.get("schema_name")
        # If no db schema name was given, get the schema name from the current REST schema
        elif ctx.qualifiedIdentifier().dotIdentifier() is None:
            self.mrs_object["name"] = ctx.qualifiedIdentifier().getText()

            if self.mrs_ddl_executor.current_schema_id is None:
                raise Exception(
                    f'The database schema for `{
                        self.mrs_object["name"]}` was not given.'
                )

            schema = lib.schemas.get_schema(
                session=self.session, schema_id=self.mrs_ddl_executor.current_schema_id
            )
            if schema is not None:
                self.mrs_object["schema_name"] = schema.get("name")
            else:
                raise Exception(
                    f'The database schema was not found for `{
                        self.mrs_object["name"]}`'
                )
        else:
            self.mrs_object["name"] = (
                ctx.qualifiedIdentifier()
                .dotIdentifier()
                .identifier()
                .getText()
                .strip("`")
            )
            self.mrs_object["schema_name"] = (
                ctx.qualifiedIdentifier().identifier().getText().strip("`")
            )

    def enterCreateRestViewStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " REST VIEW",
            "id": self.get_uuid(),
            "request_path": get_text_without_quotes(
                ctx.viewRequestPath().requestPathIdentifier().getText()
            ),
            "parent_reference_stack": [],
        }

        self.set_schema_name_and_name(ctx=ctx)

        self.mrs_object["db_object_type"] = (
            "TABLE"
            if (
                lib.db_objects.db_schema_object_is_table(
                    session=self.session,
                    db_schema_name=self.mrs_object["schema_name"],
                    db_object_name=self.mrs_object["name"],
                )
            )
            else "VIEW"
        )

        object_id = self.get_uuid()
        options = self.build_options_list(ctx.graphQlCrudOptions())
        self.mrs_object["objects"] = [
            {
                "id": object_id,
                "db_object_id": self.mrs_object.get("id"),
                "name": get_text_without_quotes(
                    ctx.restObjectName().getText()
                    if ctx.restObjectName() is not None
                    else None
                ),
                "kind": "RESULT",
                "position": 0,
                "options": {
                    "dataMappingViewInsert": "INSERT" in options,
                    "dataMappingViewUpdate": "UPDATE" in options,
                    "dataMappingViewDelete": "DELETE" in options,
                    "dataMappingViewNoCheck": "NOCHECK" in options,
                },
                # Get top level fields
                "fields": self.get_db_object_fields(
                    object_id=object_id,
                    db_schema_name=self.mrs_object["schema_name"],
                    db_object_name=self.mrs_object["name"],
                    # If no graphQlObj is given, simply enabled all fields
                    auto_enable_fields=(ctx.graphQlObj() is None),
                ),
            }
        ]

    def enterRestViewMediaType(self, ctx):
        if ctx.textStringLiteral() is not None:
            self.mrs_object["media_type"] = get_text_without_quotes(
                ctx.textStringLiteral().getText()
            )
        elif ctx.AUTODETECT_SYMBOL() is not None:
            self.mrs_object["media_type_autodetect"] = True

    def enterRestViewFormat(self, ctx):
        if ctx.FEED_SYMBOL() is not None:
            self.mrs_object["format"] = "FEED"
        elif ctx.ITEM_SYMBOL() is not None:
            self.mrs_object["format"] = "ITEM"
        elif ctx.MEDIA_SYMBOL() is not None:
            self.mrs_object["format"] = "MEDIA"

    def enterRestViewAuthenticationProcedure(self, ctx):
        self.mrs_object["auth_stored_procedure"] = ctx.qualifiedIdentifier().getText()

    def build_options_list(self, ctx: MRSParser.GraphQlCrudOptionsContext):
        options_list = []

        if ctx is None:
            return options_list

        # cSpell:ignore NOSELECT NOINSERT NOUPDATE NODELETE
        if (ctx.AT_INSERT_SYMBOL(0) is not None) and "INSERT" not in options_list:
            options_list.append("INSERT")
        if (ctx.AT_NOINSERT_SYMBOL(0) is not None) and "INSERT" in options_list:
            options_list.remove("INSERT")
        if (ctx.AT_UPDATE_SYMBOL(0) is not None) and "UPDATE" not in options_list:
            options_list.append("UPDATE")
        if (ctx.AT_NOUPDATE_SYMBOL(0) is not None) and "UPDATE" in options_list:
            options_list.remove("UPDATE")
        if (ctx.AT_DELETE_SYMBOL(0) is not None) and "DELETE" not in options_list:
            options_list.append("DELETE")
        if (ctx.AT_NODELETE_SYMBOL(0) is not None) and "DELETE" in options_list:
            options_list.remove("DELETE")
        if (ctx.AT_NOCHECK_SYMBOL(0) is not None) and "NOCHECK" not in options_list:
            options_list.append("NOCHECK")
        if (ctx.AT_CHECK_SYMBOL(0) is not None) and "NOCHECK" in options_list:
            options_list.remove("NOCHECK")

        return options_list

    def enterRestProcedureResult(self, ctx):
        # A REST PROCEDURE can have multiple results
        graph_ql_object_count = self.mrs_object.get("graph_ql_object_count", 0) + 1
        self.mrs_object["graph_ql_object_count"] = graph_ql_object_count

        # Add a new mrs object for each RESULT
        self.mrs_object["objects"].append(
            {
                "id": self.get_uuid(),
                "db_object_id": self.mrs_object.get("id"),
                "name": (
                    ctx.restResultName().getText()
                    if ctx.restResultName() is not None
                    else None
                ),
                "kind": "RESULT",
                "position": graph_ql_object_count,
                "fields": [],
            }
        )

    def enterRestFunctionResult(self, ctx):
        # A REST FUNCTION can have parameters and one result defined
        graph_ql_object_count = self.mrs_object.get("graph_ql_object_count", 0) + 1
        self.mrs_object["graph_ql_object_count"] = graph_ql_object_count

        self.mrs_object["objects"][1]["name"] = (
            ctx.restResultName().getText() if ctx.restResultName() is not None else None
        )

    def enterGraphQlPair(self, ctx):
        objects = self.mrs_object["objects"]
        current_object = (
            objects[-1]
            if (self.mrs_object.get("db_object_type", "") != "FUNCTION")
            else objects[self.mrs_object.get("graph_ql_object_count", 0)]
        )
        fields = current_object["fields"]
        field_name = lib.core.unquote(ctx.graphQlPairKey().getText())
        force_create = self.mrs_object.get("force_create", False)

        # Check if this GraphQlPair is inside a reference, and if so, adjust the ref_fields_offset so that
        # the handling only applies to the referenced fields
        ref_stack = self.mrs_object.get("parent_reference_stack")
        if ref_stack is not None and len(ref_stack) > 0:
            parent_ref = ref_stack[-1]
            ref_fields_offset = parent_ref.get("referenced_fields_offset")
        else:
            parent_ref = None
            ref_fields_offset = 0

        # If there is no graphQlObj for this field, it's a column
        if ctx.graphQlObj() is None:
            db_column_name = ctx.graphQlPairValue().getText().strip("`")

            # Check if this is a REST PROCEDURE RESULT
            graph_ql_object_count = self.mrs_object.get("graph_ql_object_count", 0)
            if graph_ql_object_count == 0:
                # A REST VIEW RESULT or REST PROCEDURE/FUNCTION PARAMETERS
                for i, field in enumerate(fields):
                    # Ignore all higher level fields and only consider referenced fields
                    if i < ref_fields_offset:
                        continue

                    db_column = field.get("db_column")
                    if (
                        db_column is not None
                        and db_column.get("name") == db_column_name
                    ):
                        field["name"] = field_name
                        field["enabled"] = True

                        options_ctx: MRSParser.GraphQlValueOptionsContext = (
                            ctx.graphQlValueOptions()
                        )
                        if options_ctx is not None:
                            # cSpell:ignore NOCHECK NOFILTERING ROWOWNERSHIP
                            if options_ctx.AT_NOCHECK_SYMBOL(0) is not None:
                                field["no_check"] = True
                            if options_ctx.AT_SORTABLE_SYMBOL(0) is not None:
                                field["allow_sorting"] = True
                            if options_ctx.AT_NOFILTERING_SYMBOL(0) is not None:
                                field["allow_filtering"] = False
                            if options_ctx.AT_ROWOWNERSHIP_SYMBOL(0) is not None:
                                current_object["row_ownership_field_id"] = field.get(
                                    "id", None
                                )
                            if options_ctx.AT_KEY_SYMBOL(0) is not None:
                                db_column["is_primary"] = True

                        if (
                            ctx.graphQlCrudOptions() is not None
                            and ctx.graphQlCrudOptions().AT_NOUPDATE_SYMBOL()
                            is not None
                        ):
                            field["no_update"] = True

                        if ctx.AT_DATATYPE_SYMBOL() is not None:
                            db_column["datatype"] = lib.core.unquote(
                                ctx.graphQlDatatypeValue().getText().lower()
                            )
                        if ctx.graphQlValueJsonSchema() is not None:
                            try:
                                field["json_schema"] = json.loads(
                                    ctx.graphQlValueJsonSchema().jsonValue().getText()
                                )
                            except:
                                pass
                        break
                else:
                    if not force_create:
                        raise Exception(
                            f"The column `{db_column_name}` does not exist on "
                            f'`{self.mrs_object.get("schema_name")}`.`{
                                self.mrs_object.get("name")}`.'
                        )
                    else:
                        # Add parameters in case FORCE has been used
                        fields.append(
                            {
                                "id": self.get_uuid(),
                                "object_id": self.mrs_object.get("objects")[0].get(
                                    "id"
                                ),
                                "name": field_name,
                                "position": len(fields),
                                "db_column": {
                                    "name": db_column_name,
                                    "datatype": (
                                        lib.core.unquote(
                                            ctx.graphQlDatatypeValue().getText().lower()
                                        )
                                        if ctx.AT_DATATYPE_SYMBOL()
                                        else "varchar(255)"
                                    ),
                                    "in": ctx.AT_IN_SYMBOL() is not None
                                    or ctx.AT_INOUT_SYMBOL() is not None,
                                    "out": ctx.AT_OUT_SYMBOL() is not None
                                    or ctx.AT_INOUT_SYMBOL() is not None,
                                },
                                "enabled": True,
                                "allow_filtering": True,
                                "allow_sorting": False,
                                "no_check": False,
                                "no_update": False,
                            }
                        )
            else:
                # A REST PROCEDURE RESULT
                if self.mrs_object.get("db_object_type", "") != "FUNCTION":
                    fields.append(
                        {
                            "id": self.get_uuid(),
                            "object_id": self.mrs_object.get("objects")[
                                graph_ql_object_count
                            ].get("id"),
                            "name": field_name,
                            "position": len(fields),
                            "db_column": {
                                "name": db_column_name,
                                "datatype": (
                                    lib.core.unquote(
                                        ctx.graphQlDatatypeValue().getText().lower()
                                    )
                                    if ctx.AT_DATATYPE_SYMBOL()
                                    else "varchar(255)"
                                ),
                            },
                            "enabled": True,
                            "allow_filtering": True,
                            "allow_sorting": False,
                            "no_check": False,
                            "no_update": False,
                        }
                    )

                current_object["fields"] = fields

        else:
            if (
                ctx.graphQlPairValue().qualifiedIdentifier() is None
                or ctx.graphQlPairValue().qualifiedIdentifier().dotIdentifier() is None
            ):
                db_schema_name = self.mrs_object["schema_name"]
                db_object_name = ctx.graphQlPairValue().getText().strip("`")
            else:
                db_schema_name = (
                    ctx.graphQlPairValue()
                    .qualifiedIdentifier()
                    .identifier()
                    .getText()
                    .strip("`")
                )
                db_object_name = (
                    ctx.graphQlPairValue()
                    .qualifiedIdentifier()
                    .dotIdentifier()
                    .identifier()
                    .getText()
                    .strip("`")
                )

            ref_mapping = None
            for field in fields:
                ref_mapping = field.get("reference_mapping")
                if (
                    ref_mapping is not None
                    and ref_mapping.get("referenced_schema") == db_schema_name
                    and ref_mapping.get("referenced_table") == db_object_name
                    and field["enabled"] == False
                ):
                    field["name"] = field_name
                    field["enabled"] = True

                    # Build object_reference
                    obj_reference_id = self.get_uuid()
                    options = self.build_options_list(ctx.graphQlCrudOptions())
                    obj_reference = {
                        "id": obj_reference_id,
                        "reference_mapping": ref_mapping,
                        "options": {
                            "dataMappingViewInsert": "INSERT" in options,
                            "dataMappingViewUpdate": "UPDATE" in options,
                            "dataMappingViewDelete": "DELETE" in options,
                            "dataMappingViewNoCheck": "NOCHECK" in options,
                        },
                        "unnest": self.isUnnestSet(ctx.graphQlValueOptions()),
                    }

                    field["object_reference"] = obj_reference
                    field["represents_reference_id"] = obj_reference_id

                    self.mrs_object.get("parent_reference_stack").append(
                        {
                            "object_reference": obj_reference,
                            "referenced_fields_offset": len(fields),
                        }
                    )

                    # Get referenced fields as well
                    ref_fields = self.get_db_object_fields(
                        object_id=current_object.get("id"),
                        db_schema_name=db_schema_name,
                        db_object_name=db_object_name,
                    )

                    # Append them to the fields list
                    current_object["fields"] = fields + ref_fields

                    break
            else:
                raise Exception(
                    f"The table `{db_schema_name}`.`{db_object_name}` has no reference to "
                    f'`{self.mrs_object.get("schema_name")}`.`{self.mrs_object.get("name")}`.'
                )

    def isUnnestSet(self, options_ctx: MRSParser.GraphQlValueOptionsContext):
        unnest = False
        if options_ctx is not None:
            unnest = options_ctx.AT_UNNEST_SYMBOL(0) is not None

        return unnest

    def exitGraphQlPair(self, ctx):
        if (
            ctx.graphQlPairValue().qualifiedIdentifier() is not None
            and ctx.graphQlPairValue().qualifiedIdentifier().dotIdentifier() is not None
        ):
            # Remove last reference_id
            ref_stack = self.mrs_object.get("parent_reference_stack")
            if len(ref_stack) > 0:
                parent_ref = ref_stack.pop()
            else:
                parent_ref = None

            if (
                parent_ref is not None
                and self.isUnnestSet(ctx.graphQlValueOptions())
                and parent_ref.get("object_reference") is not None
                and parent_ref["object_reference"].get("reference_mapping") is not None
                and parent_ref["object_reference"]["reference_mapping"].get("kind")
                == "1:n"
            ):
                # This is an unnest of a 1:n reference, so check if there is exactly one sub-field enabled
                # and set its id as the "reduce_to_value_of_field_id" of the reference
                objects = self.mrs_object["objects"]
                current_object = objects[-1]
                fields = current_object.get("fields")
                ref_fields_offset = parent_ref.get("referenced_fields_offset")
                obj_reference = parent_ref.get("object_reference")

                reduce_to_field_name = ""

                for i, reduce_to_field in enumerate(fields):
                    # Ignore all higher level fields and only consider referenced fields
                    if i < ref_fields_offset:
                        continue

                    if (
                        reduce_to_field.get("enabled")
                        and reduce_to_field.get("represents_reference_id") is None
                    ):
                        if obj_reference.get("reduce_to_value_of_field_id") is None:
                            obj_reference["reduce_to_value_of_field_id"] = (
                                reduce_to_field.get("id")
                            )
                            reduce_to_field_name = reduce_to_field.get("name")
                        else:
                            raise Exception(
                                f"Only one column `{reduce_to_field_name}` must be defined for a N:1 unnest operation. "
                                f'The column `{reduce_to_field.get("name")}` needs to be removed.'
                            )

                if obj_reference.get("reduce_to_value_of_field_id") is None:
                    raise Exception(
                        f"At least one column must be defined for a N:1 unnest operation."
                    )

    def exitCreateRestViewStatement(self, ctx):
        self.mrs_ddl_executor.createRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST PROCEDURE

    def add_rest_procedure_params(self, ctx, db_schema_name, db_object_name):
        object_id = self.get_uuid()

        params = lib.db_objects.get_db_object_parameters(
            session=self.session,
            db_schema_name=db_schema_name,
            db_object_name=db_object_name,
        )

        param_fields = []
        for param in params:
            param_name = lib.core.convert_snake_to_camel_case(param.get("name"))
            field = {
                "id": self.get_uuid(),
                "object_id": object_id,
                "name": param_name,
                "position": param.get("position"),
                "db_column": {
                    "name": param.get("name"),
                    "in": "IN" in param.get("mode"),
                    "out": "OUT" in param.get("mode"),
                    "datatype": param.get("datatype"),
                    # PROCEDURE IN/INOUT/OUT parameters are nullable by nature
                    "not_null": False,
                    "is_generated": False,
                    "is_primary": False,
                    "is_unique": False,
                    "charset": param.get("charset"),
                    "collation": param.get("collation"),
                },
                # If explicit PARAMETERS are given, add the fields not enabled and enable only the given fields
                "enabled": ctx.PARAMETERS_SYMBOL() is None,
                "allow_filtering": True,
                "allow_sorting": False,
                "no_check": False,
                "no_update": False,
            }
            param_fields.append(field)

        self.mrs_object["objects"] = [
            {
                "id": object_id,
                "db_object_id": self.mrs_object["id"],
                "name": get_text_without_quotes(
                    ctx.restObjectName().getText()
                    if ctx.restObjectName() is not None
                    else None
                ),
                "kind": "PARAMETERS",
                "position": 0,
                "fields": param_fields,
            }
        ]

    def enterCreateRestProcedureStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " REST PROCEDURE",
            "id": self.get_uuid(),
            "request_path": get_text_without_quotes(
                ctx.procedureRequestPath().getText()
            ),
            "db_object_type": "PROCEDURE",
            "crud_operations": ["UPDATE"],
            "force_create": ctx.FORCE_SYMBOL() is not None,
        }

        self.set_schema_name_and_name(ctx=ctx)

        self.add_rest_procedure_params(
            ctx=ctx,
            db_schema_name=self.mrs_object["schema_name"],
            db_object_name=self.mrs_object["name"],
        )

    def exitCreateRestProcedureStatement(self, ctx):
        self.mrs_ddl_executor.createRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST FUNCTION

    def add_rest_functions_params_and_result(self, ctx, db_schema_name, db_object_name):
        object_id = self.get_uuid()

        params = lib.db_objects.get_db_object_parameters(
            session=self.session,
            db_schema_name=db_schema_name,
            db_object_name=db_object_name,
            db_type="FUNCTION",
        )

        param_fields = []
        for param in params:
            param_name = lib.core.convert_snake_to_camel_case(param.get("name"))
            field = {
                "id": self.get_uuid(),
                "object_id": object_id,
                "name": param_name,
                "position": param.get("position"),
                "db_column": {
                    "name": param.get("name"),
                    "in": "IN" in param.get("mode"),
                    "out": "OUT" in param.get("mode"),
                    "datatype": param.get("datatype"),
                    # FUNCTION parameters are nullable by nature
                    "not_null": False,
                    "is_generated": False,
                    "is_primary": False,
                    "is_unique": False,
                    "charset": param.get("charset"),
                    "collation": param.get("collation"),
                },
                # If explicit PARAMETERS are given, add the fields not enabled and enable only the given fields
                "enabled": ctx.PARAMETERS_SYMBOL() is None,
                "allow_filtering": True,
                "allow_sorting": False,
                "no_check": False,
                "no_update": False,
            }
            param_fields.append(field)

        self.mrs_object["objects"] = [
            {
                "id": object_id,
                "db_object_id": self.mrs_object["id"],
                "name": get_text_without_quotes(
                    ctx.restObjectName().getText()
                    if ctx.restObjectName() is not None
                    else None
                ),
                "kind": "PARAMETERS",
                "position": 0,
                "fields": param_fields,
            }
        ]

        # Get result datatype and add a result object for it
        returnDataType = lib.db_objects.get_db_function_return_type(
            session=self.session,
            db_schema_name=db_schema_name,
            db_object_name=db_object_name,
        )
        object_id = self.get_uuid()
        result_fields = [
            {
                "id": self.get_uuid(),
                "object_id": object_id,
                "name": "result",
                "position": 0,
                "db_column": {
                    "name": "result",
                    "datatype": returnDataType,
                    "not_null": False,
                    "is_generated": False,
                    "is_primary": False,
                    "is_unique": False,
                },
                "enabled": True,
                "allow_filtering": True,
                "allow_sorting": False,
                "no_check": False,
                "no_update": False,
            }
        ]
        self.mrs_object["objects"].append(
            {
                "id": object_id,
                "db_object_id": self.mrs_object["id"],
                "name": (
                    ctx.restFunctionResult().restResultName().getText()
                    if (
                        ctx.restFunctionResult() is not None
                        and ctx.restObjectName() is not None
                    )
                    else None
                ),
                "kind": "RESULT",
                "position": 1,
                "fields": result_fields,
            }
        )

    def enterCreateRestFunctionStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " REST FUNCTION",
            "id": self.get_uuid(),
            "request_path": get_text_without_quotes(
                ctx.functionRequestPath().getText()
            ),
            "db_object_type": "FUNCTION",
            "crud_operations": ["READ"],
            "force_create": ctx.FORCE_SYMBOL() is not None,
        }

        self.set_schema_name_and_name(ctx=ctx)

        self.add_rest_functions_params_and_result(
            ctx=ctx,
            db_schema_name=self.mrs_object["schema_name"],
            db_object_name=self.mrs_object["name"],
        )

    def exitCreateRestFunctionStatement(self, ctx):
        self.mrs_ddl_executor.createRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST CONTENT SET

    def enterCreateRestContentSetStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " CONTENT SET",
            "request_path": get_text_without_quotes(
                ctx.contentSetRequestPath().getText()
            ),
            "directory_file_path": (
                get_text_without_quotes(ctx.directoryFilePath().getText())
                if ctx.directoryFilePath() is not None
                else None
            ),
            "content_type": "STATIC",
        }

    def enterFileIgnoreList(self, ctx):
        self.mrs_object["ignore_file_list"] = ctx.textStringLiteral().getText()

    def enterLoadScripts(self, ctx):
        self.mrs_object["content_type"] = "SCRIPTS"
        if ctx.TYPESCRIPT_SYMBOL() is not None:
            self.mrs_object["language"] = "TypeScript"

    def exitCreateRestContentSetStatement(self, ctx):
        self.mrs_ddl_executor.createRestContentSet(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST CONTENT FILE

    def enterCreateRestContentFileStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " CONTENT FILE",
            "request_path": get_text_without_quotes(
                ctx.contentFileRequestPath().getText()
            ),
            "content_set_path": get_text_without_quotes(
                ctx.contentSetRequestPath().getText()
            ),
            "directory_file_path": (
                ctx.directoryFilePath().getText()
                if ctx.directoryFilePath() is not None
                else None
            ),
            "content": (
                get_text_without_quotes(ctx.textStringLiteral().getText())
                if ctx.textStringLiteral() is not None
                else None
            ),
            "is_binary": ctx.BINARY_SYMBOL() is not None,
        }

    def exitCreateRestContentFileStatement(self, ctx):
        self.mrs_ddl_executor.createRestContentFile(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST AUTH APP

    def enterCreateRestAuthAppStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " AUTH APP",
            "name": get_text_without_quotes(ctx.authAppName().getText()),
            "vendor": (
                get_text_without_quotes(ctx.vendorName().getText())
                if ctx.vendorName() is not None
                else ("MySQL Internal" if ctx.MYSQL_SYMBOL() is not None else "MRS")
            ),
            "limit_to_registered_users": True,
        }

    def exitCreateRestAuthAppStatement(self, ctx):
        self.mrs_ddl_executor.createRestAuthApp(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST USER

    def enterCreateRestUserStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " USER",
            "name": get_text_without_quotes(ctx.userName().getText()),
            "authAppName": get_text_without_quotes(ctx.authAppName().getText()),
            "password": unquoted_node_text_or_none(ctx.userPassword()),
        }

    def exitCreateRestUserStatement(self, ctx):
        self.mrs_ddl_executor.createRestUser(self.mrs_object)

    def enterAccountLock(self, ctx):
        self.mrs_object["login_permitted"] = ctx.LOCK_SYMBOL() is None

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST ROLE

    def enterCreateRestRoleStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "do_replace": ctx.REPLACE_SYMBOL() is not None,
            "if_not_exists": ctx.EXISTS_SYMBOL() is not None,
            "current_operation": self.create_prefix(ctx) + " ROLE",
            "name": get_text_without_quotes(ctx.roleName().getText()),
            "extends": unquoted_node_text_or_none(ctx.parentRoleName()),
        }

    def exitCreateRestRoleStatement(self, ctx):
        self.mrs_ddl_executor.createRestRole(self.mrs_object)

    # ==================================================================================================================
    # GRANT REST Statements

    # ------------------------------------------------------------------------------------------------------------------
    # GRANT REST privileges

    def enterGrantRestPrivilegeStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "GRANT PRIVILEGE",
            "privileges": set(),
            "role": unquoted_node_text_or_none(ctx.roleName()),
            "object_request_path": unquoted_node_text_or_none(
                ctx.objectRequestPathWildcard()
            ),
        }

    def exitGrantRestPrivilegeStatement(self, ctx):
        self.mrs_ddl_executor.grantRestPrivileges(self.mrs_object)

    def enterPrivilegeList(self, ctx):
        self.mrs_object["privileges"].add(ctx.privilegeName().getText())

    def exitPrivilegeList(self, ctx):
        pass

    # ------------------------------------------------------------------------------------------------------------------
    # GRANT REST ROLE

    def enterGrantRestRoleStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "GRANT ROLE",
            "role": get_text_without_quotes(ctx.roleName().getText()),
            "user": unquoted_node_text_or_none(ctx.userName()),
            "auth_app_name": unquoted_node_text_or_none(ctx.authAppName()),
            "comments": unquoted_node_text_or_none(ctx.comments()),
        }

    def exitGrantRestRoleStatement(self, ctx):
        self.mrs_ddl_executor.grantRestRole(self.mrs_object)

    # ==================================================================================================================
    # REVOKE REST Statements

    # ------------------------------------------------------------------------------------------------------------------
    # REVOKE REST ROLE

    def enterRevokeRestRoleStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "REVOKE ROLE",
            "role": get_text_without_quotes(ctx.roleName().getText()),
            "user": unquoted_node_text_or_none(ctx.userName()),
            "auth_app_name": unquoted_node_text_or_none(ctx.authAppName()),
        }

    def exitRevokeRestRoleStatement(self, ctx):
        self.mrs_ddl_executor.revokeRestRole(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # REVOKE REST privileges

    def enterRevokeRestPrivilegeStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "REVOKE PRIVILEGE",
            "privileges": set(),
            "role": unquoted_node_text_or_none(ctx.roleName()),
            "object_request_path": unquoted_node_text_or_none(
                ctx.objectRequestPathWildcard()
            ),
        }

    def exitRevokeRestPrivilegeStatement(self, ctx):
        self.mrs_ddl_executor.revokeRestPrivilege(self.mrs_object)

    # ==================================================================================================================
    # CLONE REST Statements

    # ------------------------------------------------------------------------------------------------------------------
    # CLONE REST SERVICE

    def enterCloneRestServiceStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "CLONE REST SERVICE",
        }

    def exitCloneRestServiceStatement(self, ctx):
        self.mrs_ddl_executor.cloneRestService(self.mrs_object)

    # ==================================================================================================================
    # ALTER REST Statements

    # ------------------------------------------------------------------------------------------------------------------
    # ALTER REST SERVICE

    def enterAlterRestServiceStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "ALTER REST SERVICE",
        }

    def enterNewServiceRequestPath(self, ctx):
        if self.mrs_object.get("new_developer_list") is None:
            self.mrs_object["new_developer_list"] = []

        self.mrs_object["new_url_context_root"] = get_text_without_quotes(
            ctx.requestPathIdentifier().getText()
        )

        if "@" in self.mrs_object["new_url_context_root"]:
            self.mrs_object["new_developer_list"], self.mrs_object["new_url_context_root"] = self.mrs_object["new_url_context_root"].split("@")

    def exitAlterRestServiceStatement(self, ctx):
        self.mrs_ddl_executor.alterRestService(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # ALTER REST SCHEMA

    def enterAlterRestSchemaStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "ALTER REST SCHEMA",
            "schema_request_path": (
                get_text_without_quotes(ctx.schemaRequestPath().getText())
                if ctx.schemaRequestPath() is not None
                else None
            ),
        }

    def enterNewSchemaRequestPath(self, ctx):
        self.mrs_object["new_request_path"] = get_text_without_quotes(
            ctx.requestPathIdentifier().getText()
        )

    def exitAlterRestSchemaStatement(self, ctx):
        self.mrs_ddl_executor.alterRestSchema(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # ALTER REST VIEW

    def enterAlterRestViewStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "ALTER REST VIEW",
            "request_path": get_text_without_quotes(
                ctx.viewRequestPath().requestPathIdentifier().getText()
            ),
            "new_request_path": get_text_without_quotes(
                (
                    ctx.newViewRequestPath().requestPathIdentifier().getText()
                    if ctx.newViewRequestPath() is not None
                    else None
                )
            ),
            "new_object_name": get_text_without_quotes(
                ctx.restObjectName().getText()
                if ctx.restObjectName() is not None
                else None
            ),
            "type": "VIEW",
            "parent_reference_stack": [],
        }

        # if ctx.graphQlCrudOptions() is not None:
        #     self.mrs_object["crud_operations"] = self.build_options_list(
        #         ctx=ctx.graphQlCrudOptions())

        db_object = self.get_db_object(ctx=ctx)

        # Set mrs_object["id"] since the field listener need that
        self.mrs_object["id"] = db_object["id"]

        object_id = self.get_uuid()
        options = self.build_options_list(ctx.graphQlCrudOptions())
        self.mrs_object["objects"] = [
            {
                "id": object_id,
                "db_object_id": db_object["id"],
                "name": get_text_without_quotes(
                    ctx.restObjectName().getText()
                    if ctx.restObjectName() is not None
                    else None
                ),
                "kind": "RESULT",
                "position": 0,
                "options": {
                    "dataMappingViewInsert": "INSERT" in options,
                    "dataMappingViewUpdate": "UPDATE" in options,
                    "dataMappingViewDelete": "DELETE" in options,
                    "dataMappingViewNoCheck": "NOCHECK" in options,
                },
                # Get top level fields
                "fields": self.get_db_object_fields(
                    object_id=object_id,
                    db_schema_name=db_object["schema_name"],
                    db_object_name=db_object["name"],
                ),
            }
        ]

    def exitAlterRestViewStatement(self, ctx):
        self.mrs_ddl_executor.alterRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # ALTER REST PROCEDURE

    def enterAlterRestProcedureStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "ALTER REST PROCEDURE",
            "request_path": get_text_without_quotes(
                ctx.procedureRequestPath().getText()
            ),
            "new_request_path": get_text_without_quotes(
                (
                    ctx.newProcedureRequestPath().requestPathIdentifier().getText()
                    if ctx.newProcedureRequestPath() is not None
                    else None
                )
            ),
            "new_object_name": get_text_without_quotes(
                ctx.restObjectName().getText()
                if ctx.restObjectName() is not None
                else None
            ),
            "type": "PROCEDURE",
        }

        db_object = self.get_db_object(ctx=ctx)

        # Set mrs_object["id"] since the field listener need that
        self.mrs_object["id"] = db_object["id"]

        self.add_rest_procedure_params(
            ctx=ctx,
            db_schema_name=db_object["schema_name"],
            db_object_name=db_object["name"],
        )

    def exitAlterRestProcedureStatement(self, ctx):
        self.mrs_ddl_executor.alterRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # ALTER REST FUNCTION

    def enterAlterRestFunctionStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "ALTER REST FUNCTION",
            "request_path": get_text_without_quotes(
                ctx.functionRequestPath().getText()
            ),
            "new_request_path": get_text_without_quotes(
                (
                    ctx.newFunctionRequestPath().requestPathIdentifier().getText()
                    if ctx.newFunctionRequestPath() is not None
                    else None
                )
            ),
            "new_object_name": get_text_without_quotes(
                ctx.restObjectName().getText()
                if ctx.restObjectName() is not None
                else None
            ),
            "type": "FUNCTION",
        }

        db_object = self.get_db_object(ctx=ctx)

        # Set mrs_object["id"] since the field listener need that
        self.mrs_object["id"] = db_object["id"]

        self.add_rest_functions_params_and_result(
            ctx=ctx,
            db_schema_name=db_object["schema_name"],
            db_object_name=db_object["name"],
        )

    def exitAlterRestFunctionStatement(self, ctx):
        self.mrs_ddl_executor.alterRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # CREATE REST CONTENT SET

    def enterAlterRestContentSetStatement(self, ctx):
        self.mrs_object = {
            "current_operation": "ALTER CONTENT SET",
            "request_path": get_text_without_quotes(
                ctx.contentSetRequestPath().getText()
            ),
            "new_request_path": get_text_without_quotes(
                (
                    ctx.newContentSetRequestPath().requestPathIdentifier().getText()
                    if ctx.newContentSetRequestPath() is not None
                    else None
                )
            ),
            "content_type": "STATIC",
        }

    def exitAlterRestContentSetStatement(self, ctx):
        self.mrs_ddl_executor.alterRestContentSet(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # ALTER REST AUTH APP

    def enterAlterRestAuthAppStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "ALTER AUTH APP",
            "auth_app_name": get_text_without_quotes(ctx.authAppName().getText()),
        }

        if ctx.newAuthAppName() is not None:
            self.mrs_object["new_auth_app_name"] = get_text_without_quotes(
                ctx.newAuthAppName().getText()
            )

    def exitAlterRestAuthAppStatement(self, ctx):
        self.mrs_ddl_executor.alterRestAuthApp(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # ALTER REST USER

    def enterAlterRestUserStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "ALTER USER",
            "name": unquoted_node_text_or_none(ctx.userName()),
            "authAppName": unquoted_node_text_or_none(ctx.authAppName()),
            "password": unquoted_node_text_or_none(ctx.userPassword()),
        }

    def exitAlterRestUserStatement(self, ctx):
        self.mrs_ddl_executor.alterRestUser(self.mrs_object)

    # ==================================================================================================================
    # DROP REST Statements

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST SERVICE

    def enterDropRestServiceStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST SERVICE",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
        }

    def exitDropRestServiceStatement(self, ctx):
        self.mrs_ddl_executor.dropRestService(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST SCHEMA

    def enterDropRestSchemaStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST SCHEMA",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
            "request_path": get_text_without_quotes(ctx.schemaRequestPath().getText()),
        }

    def exitDropRestSchemaStatement(self, ctx):
        self.mrs_ddl_executor.dropRestSchema(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST VIEW

    def enterDropRestViewStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST VIEW",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
            "request_path": get_text_without_quotes(ctx.viewRequestPath().getText()),
            "type": "VIEW",
        }

    def exitDropRestViewStatement(self, ctx):
        self.mrs_ddl_executor.dropRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST PROCEDURE

    def enterDropRestProcedureStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST PROCEDURE",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
            "request_path": get_text_without_quotes(
                ctx.procedureRequestPath().getText()
            ),
            "type": "PROCEDURE",
        }

    def exitDropRestProcedureStatement(self, ctx):
        self.mrs_ddl_executor.dropRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST FUNCTION

    def enterDropRestFunctionStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST FUNCTION",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
            "request_path": get_text_without_quotes(
                ctx.functionRequestPath().getText()
            ),
            "type": "FUNCTION",
        }

    def exitDropRestFunctionStatement(self, ctx):
        self.mrs_ddl_executor.dropRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST CONTENT SET

    def enterDropRestContentSetStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST CONTENT SET",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
            "request_path": get_text_without_quotes(
                ctx.contentSetRequestPath().getText()
            ),
        }

    def exitDropRestContentSetStatement(self, ctx):
        self.mrs_ddl_executor.dropRestContentSet(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST CONTENT FILE

    def enterDropRestContentFileStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST CONTENT FILE",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
            "request_path": get_text_without_quotes(
                ctx.contentFileRequestPath().getText()
            ),
            "content_set_path": get_text_without_quotes(
                ctx.contentSetRequestPath().getText()
            ),
        }

    def exitDropRestContentFileStatement(self, ctx):
        self.mrs_ddl_executor.dropRestContentFile(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST AUTH APP

    def enterDropRestAuthAppStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST AUTH APP",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
            "name": get_text_without_quotes(ctx.authAppName().getText()),
        }

    def exitDropRestAuthAppStatement(self, ctx):
        self.mrs_ddl_executor.dropRestAuthApp(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST USER

    def enterDropRestUserStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST USER",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
            "name": get_text_without_quotes(ctx.userName().getText()),
            "authAppName": get_text_without_quotes(ctx.authAppName().getText()),
        }

    def exitDropRestUserStatement(self, ctx):
        self.mrs_ddl_executor.dropRestUser(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DROP REST ROLE

    def enterDropRestRoleStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DROP REST ROLE",
            "if_exists": ctx.EXISTS_SYMBOL() is not None,
            "name": get_text_without_quotes(ctx.roleName().getText()),
        }

    def exitDropRestRoleStatement(self, ctx):
        self.mrs_ddl_executor.dropRestRole(self.mrs_object)

    # ==================================================================================================================
    # USE REST Statement

    def enterUseStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": (
                "USE REST " + "SERVICE"
                if (ctx.serviceAndSchemaRequestPaths().serviceSchemaSelector() is None)
                else "SCHEMA"
            ),
            "schema_request_path": get_text_without_quotes(
                ctx.serviceAndSchemaRequestPaths()
                .serviceSchemaSelector()
                .schemaRequestPath()
                .getText()
                if (
                    ctx.serviceAndSchemaRequestPaths().serviceSchemaSelector()
                    is not None
                )
                else None
            ),
        }

    def exitUseStatement(self, ctx):
        self.mrs_ddl_executor.use(self.mrs_object)

    # ==================================================================================================================
    # SHOW REST Statements

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST METADATA STATUS

    def enterShowRestMetadataStatusStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST METADATA STATUS",
        }

    def exitShowRestMetadataStatusStatement(self, ctx):
        self.mrs_ddl_executor.showRestMetadataStatus(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST SERVICES

    def enterShowRestServicesStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST SERVICES",
        }

    def exitShowRestServicesStatement(self, ctx):
        self.mrs_ddl_executor.showRestServices(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST SCHEMAS

    def enterShowRestSchemasStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST SCHEMAS",
        }

    def exitShowRestSchemasStatement(self, ctx):
        self.mrs_ddl_executor.showRestSchemas(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST VIEWS

    def enterShowRestViewsStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST VIEWS",
            "object_types": ["TABLE", "VIEW"],
        }

    def exitShowRestViewsStatement(self, ctx):
        self.mrs_ddl_executor.showRestDbObjects(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST PROCEDURES

    def enterShowRestProceduresStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST PROCEDURES",
            "object_types": ["PROCEDURE"],
        }

    def exitShowRestProceduresStatement(self, ctx):
        self.mrs_ddl_executor.showRestDbObjects(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST FUNCTIONS

    def enterShowRestFunctionsStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST FUNCTIONS",
            "object_types": ["FUNCTION"],
        }

    def exitShowRestFunctionsStatement(self, ctx):
        self.mrs_ddl_executor.showRestDbObjects(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST CONTENT SETS

    def enterShowRestContentSetsStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST CONTENT SETS",
        }

    def exitShowRestContentSetsStatement(self, ctx):
        self.mrs_ddl_executor.showRestContentSets(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST AUTH APPS

    def enterShowRestAuthAppsStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST AUTH APPS",
            "url_context_root": ctx.serviceRequestPath().getText() if ctx.serviceRequestPath() else None
        }

    def exitShowRestAuthAppsStatement(self, ctx):
        self.mrs_ddl_executor.showRestAuthApps(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST ROLES

    def enterShowRestRolesStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST ROLES",
            "user_name": unquoted_node_text_or_none(ctx.userName()),
            "auth_app_name": unquoted_node_text_or_none(ctx.authAppName()),
            "any_service": ctx.ANY_SYMBOL(),
        }

    def exitShowRestRolesStatement(self, ctx):
        self.mrs_ddl_executor.showRestRoles(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW REST GRANTS

    def enterShowRestGrantsStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW REST GRANTS",
            "role": get_text_without_quotes(ctx.roleName().getText()),
            "any_service": ctx.ANY_SYMBOL(),
        }

    def exitShowRestGrantsStatement(self, ctx):
        self.mrs_ddl_executor.showRestGrants(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW CREATE REST SERVICE

    def enterShowCreateRestServiceStatement(self, ctx):
        include_database_endpoints = False

        if ctx.DATABASE_SYMBOL() is not None:
            include_database_endpoints = True

        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW CREATE REST SERVICE",
            "include_database_endpoints": include_database_endpoints,
        }

    def exitShowCreateRestServiceStatement(self, ctx):
        self.mrs_ddl_executor.showCreateRestService(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW CREATE REST SCHEMA

    def enterShowCreateRestSchemaStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW CREATE REST SCHEMA",
            "schema_request_path": (
                get_text_without_quotes(ctx.schemaRequestPath().getText())
                if ctx.schemaRequestPath() is not None
                else None
            ),
        }

    def exitShowCreateRestSchemaStatement(self, ctx):
        self.mrs_ddl_executor.showCreateRestSchema(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW CREATE REST VIEW

    def enterShowCreateRestViewStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW CREATE REST VIEW",
            "request_path": get_text_without_quotes(ctx.viewRequestPath().getText()),
            "type": "VIEW",
        }

    def exitShowCreateRestViewStatement(self, ctx):
        self.mrs_ddl_executor.showCreateRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW CREATE REST PROCEDURE

    def enterShowCreateRestProcedureStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW CREATE REST PROCEDURE",
            "request_path": get_text_without_quotes(
                ctx.procedureRequestPath().getText()
            ),
            "type": "PROCEDURE",
        }

    def exitShowCreateRestProcedureStatement(self, ctx):
        self.mrs_ddl_executor.showCreateRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW CREATE REST FUNCTION

    def enterShowCreateRestFunctionStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW CREATE REST FUNCTION",
            "request_path": get_text_without_quotes(
                ctx.functionRequestPath().getText()
            ),
            "type": "FUNCTION",
        }

    def exitShowCreateRestFunctionStatement(self, ctx):
        self.mrs_ddl_executor.showCreateRestDbObject(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW CREATE REST AUTH APP

    def enterShowCreateRestAuthAppStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW CREATE REST AUTH APP",
            "name": get_text_without_quotes(ctx.authAppName().getText()),
        }

    def exitShowCreateRestAuthAppStatement(self, ctx):
        self.mrs_ddl_executor.showCreateRestAuthApp(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW CREATE REST ROLE

    def enterShowCreateRestRoleStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW CREATE REST ROLE",
            "name": get_text_without_quotes(ctx.roleName().getText()),
        }

    def exitShowCreateRestRoleStatement(self, ctx):
        self.mrs_ddl_executor.showCreateRestRole(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # SHOW CREATE REST USER

    def enterShowCreateRestUserStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "SHOW CREATE REST USER",
            "name": get_text_without_quotes(ctx.userName().getText()),
            "auth_app_name": get_text_without_quotes(ctx.authAppName().getText()),
        }

    def exitShowCreateRestUserStatement(self, ctx):
        self.mrs_ddl_executor.showCreateRestUser(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DUMP REST SERVICE
    def enterDumpRestServiceStatement(self, ctx):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DUMP REST SERVICE",
            "directory_file_path": os.path.expanduser(
                get_text_without_quotes(ctx.directoryFilePath().getText())),
            "include_database_endpoints": ctx.DATABASE_SYMBOL() is not None
                or ctx.ALL_SYMBOL() is not None,
            "include_static_endpoints": ctx.STATIC_SYMBOL() is not None
                or ctx.ALL_SYMBOL() is not None,
            "include_dynamic_endpoints": ctx.DYNAMIC_SYMBOL() is not None
                or ctx.ALL_SYMBOL() is not None,
            "zip": ctx.ZIP_SYMBOL() is not None,
        }

    def exitDumpRestServiceStatement(self, ctx):
        self.mrs_ddl_executor.dumpRestService(self.mrs_object)

    # ------------------------------------------------------------------------------------------------------------------
    # DUMP REST PROJECT
    def enterDumpRestProjectStatement(self, ctx:MRSParser.DumpRestProjectStatementContext):
        self.mrs_object = {
            "line": ctx.start.line,
            "current_operation": "DUMP REST PROJECT",
            "services": [],
            "schemas": [],
            "directory_file_path": os.path.expanduser(
                get_text_without_quotes(ctx.directoryFilePath().getText())),
            "zip": ctx.ZIP_SYMBOL() is not None,
        }

    def enterDumpRestProjectService(self, ctx):
        all = ctx.ALL_SYMBOL() is not None
        name = lib.core.make_string_valid_for_filesystem(ctx.serviceRequestPath().getText(), "<>:\"|?*")

        self.mrs_object["services"].append({
            "name": name,
            "include_database_endpoints": ctx.DATABASE_SYMBOL() is not None or all,
            "include_static_endpoints": ctx.STATIC_SYMBOL() is not None or all,
            "include_dynamic_endpoints": ctx.DYNAMIC_SYMBOL() is not None or all,
        })


    def enterDumpRestProjectDatabaseSchema(self, ctx):
        file_path = get_text_without_quotes(ctx.restProjectDatabaseSchemaFilePath().getText()) \
            if ctx.restProjectDatabaseSchemaFilePath() else None
        name = get_text_without_quotes(ctx.schemaName().getText())
        name = lib.core.make_string_valid_for_filesystem(name)

        lib.core.validate_path_for_filesystem(file_path)

        self.mrs_object["schemas"].append({
            "name": name,
            "file_path": os.path.expanduser(file_path) if file_path else None,
        })

    def enterRestProjectIconFilePath(self, ctx):
        icon_file_path = get_text_without_quotes(ctx.textStringLiteral().getText())
        lib.core.validate_path_for_filesystem(icon_file_path)
        self.mrs_object["icon_file_path"] = os.path.expanduser(icon_file_path)

    def enterRestProjectDescription(self, ctx):
        self.mrs_object["description"] = get_text_without_quotes(ctx.textStringLiteral().getText())

    def enterRestProjectPublisher(self, ctx):
        self.mrs_object["publisher"] = get_text_without_quotes(ctx.textStringLiteral().getText())

    def enterRestProjectName(self, ctx):
        self.mrs_object["project_name"] = get_text_without_quotes(ctx.textStringLiteral().getText())

    def enterRestProjectVersionIdentifier(self, ctx):
        self.mrs_object["version"] = get_text_without_quotes(ctx.textStringLiteral().getText())

    def exitDumpRestProjectStatement(self, ctx:MRSParser.DumpRestProjectStatementContext):
        self.mrs_ddl_executor.dumpRestProject(self.mrs_object)


class MrsDdlErrorListener(antlr4.error.ErrorListener.ErrorListener):
    def __init__(self, errors):
        self.errors = errors

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        self.errors.append(
            {
                "line": line,
                "column": column,
                "message": msg.capitalize(),
                "fullMessage": f"Syntax Error: {msg.capitalize()} [Ln {line}: Col {column}]",
            }
        )
