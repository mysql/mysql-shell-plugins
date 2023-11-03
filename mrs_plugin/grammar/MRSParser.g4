/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify it under the terms of the
 * GNU General Public License, version 2.0, as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including but not limited to OpenSSL)
 * that is licensed under separate terms, as designated in a particular file or component or in
 * included license documentation. The authors of MySQL hereby grant you an additional permission to
 * link the program and your derivative works with the separately licensed software that they have
 * included with MySQL. This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE. See the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program; if
 * not, write to the Free Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA
 */

// $antlr-format alignTrailingComments on, columnLimit 100, minEmptyLines 1, maxEmptyLinesToKeep 1, reflowComments off
// $antlr-format useTab off, allowShortRulesOnASingleLine off, allowShortBlocksOnASingleLine on, alignSemicolons ownLine

// MySQL REST Service (MRS) Grammar Definition (parser).
parser grammar MRSParser;

options {
    tokenVocab = MRSLexer;
}

// Used for auto merging this grammar and the standard MySQL grammar.
/* START OF MERGE PART */

mrsScript:
    (mrsStatement (SEMICOLON_SYMBOL+ mrsStatement)*)? SEMICOLON_SYMBOL? EOF
;

mrsStatement:
    configureRestMetadataStatement
    | createRestServiceStatement
    | createRestSchemaStatement
    | createRestViewStatement
    | createRestProcedureStatement
    | createRestFunctionStatement
    | createRestContentSetStatement
    | createRestAuthAppStatement
    | createRestUserStatement
    | alterRestServiceStatement
    | alterRestSchemaStatement
    | alterRestViewStatement
    | alterRestProcedureStatement
    | dropRestServiceStatement
    | dropRestSchemaStatement
    | dropRestDualityViewStatement
    | dropRestProcedureStatement
    | dropRestFunctionStatement
    | dropRestContentSetStatement
    | dropRestAuthAppStatement
    | dropRestUserStatement
    | useStatement
    | showRestMetadataStatusStatement
    | showRestServicesStatement
    | showRestSchemasStatement
    | showRestViewsStatement
    | showRestProceduresStatement
    | showRestFunctionsStatement
    | showRestContentSetsStatement
    | showRestAuthAppsStatement
    | showCreateRestServiceStatement
    | showCreateRestSchemaStatement
    | showCreateRestViewStatement
    | showCreateRestProcedureStatement
    | showCreateRestFunctionStatement
    | showCreateRestAuthAppStatement
;

// Common Definitions =======================================================

enabledDisabled:
    ENABLED_SYMBOL
    | DISABLED_SYMBOL
;

quotedTextOrDefault: (quotedText | DEFAULT_SYMBOL)
;

jsonOptions:
    OPTIONS_SYMBOL jsonValue
;

comments:
    COMMENTS_SYMBOL quotedText
;

authenticationRequired:
    AUTHENTICATION_SYMBOL NOT_SYMBOL? REQUIRED_SYMBOL
;

itemsPerPage:
    ITEMS_SYMBOL PER_SYMBOL PAGE_SYMBOL itemsPerPageNumber
;

itemsPerPageNumber:
    INT_NUMBER
;

serviceSchemaSelector:
    (SERVICE_SYMBOL serviceRequestPath)? DATABASE_SYMBOL schemaRequestPath
;

// CONFIGURE statements =====================================================

// - CONFIGURE REST METADATA ------------------------------------------------

configureRestMetadataStatement:
    CONFIGURE_SYMBOL REST_SYMBOL METADATA_SYMBOL restMetadataOptions?
;

restMetadataOptions: (
        enabledDisabled
        | jsonOptions
        | updateIfAvailable
    )+
;

updateIfAvailable:
    UPDATE_SYMBOL (IF_SYMBOL AVAILABLE_SYMBOL)?
;

// CREATE statements ========================================================

// - CREATE REST SERVICE ----------------------------------------------------

createRestServiceStatement:
    CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL SERVICE_SYMBOL serviceRequestPath
        restServiceOptions?
;

restServiceOptions: (
        enabledDisabled
        // | restProtocol -- not enabled yet
        | restAuthentication
        // | userManagementSchema -- not enabled yet
        | jsonOptions
        | comments
    )+
;

restProtocol:
    PROTOCOL_SYMBOL (
        HTTP_SYMBOL
        | HTTPS_SYMBOL
        | HTTP_SYMBOL COMMA_SYMBOL HTTPS_SYMBOL
        | HTTPS_SYMBOL COMMA_SYMBOL HTTP_SYMBOL
    )
;

restAuthentication:
    AUTHENTICATION_SYMBOL (
        authPath
        | authRedirection
        | authValidation
        | authPageContent
    )*
;

authPath:
    PATH_SYMBOL quotedTextOrDefault
;

authRedirection:
    REDIRECTION_SYMBOL quotedTextOrDefault
;

authValidation:
    VALIDATION_SYMBOL quotedTextOrDefault
;

authPageContent:
    PAGE_SYMBOL CONTENT_SYMBOL quotedTextOrDefault
;

userManagementSchema:
    USER_SYMBOL MANAGEMENT_SYMBOL DATABASE_SYMBOL (
        schemaName
        | DEFAULT_SYMBOL
    )
;

// - CREATE REST SCHEMA -----------------------------------------------------

createRestSchemaStatement:
    CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL DATABASE_SYMBOL schemaRequestPath? (
        ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )? FROM_SYMBOL schemaName restSchemaOptions?
;

restSchemaOptions: (
        enabledDisabled
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
    )+
;

// - CREATE REST VIEW -------------------------------------------------------

createRestViewStatement:
    CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL JSON_SYMBOL? RELATIONAL_SYMBOL?
        DUALITY_SYMBOL? VIEW_SYMBOL viewRequestPath (
        ON_SYMBOL serviceSchemaSelector
    )? AS_SYMBOL qualifiedIdentifier (
        CLASS_SYMBOL restObjectName
    )? graphQlCrudOptions? graphQlObj? restObjectOptions?
;

restObjectOptions: (
        enabledDisabled
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
        | restViewMediaType
        | restViewFormat
        | restViewAuthenticationProcedure
    )+
;

restViewMediaType:
    MEDIA_SYMBOL TYPE_SYMBOL (quotedText | AUTODETECT_SYMBOL)
;

restViewFormat:
    FORMAT_SYMBOL (FEED_SYMBOL | ITEM_SYMBOL | MEDIA_SYMBOL)
;

restViewAuthenticationProcedure:
    AUTHENTICATION_SYMBOL PROCEDURE_SYMBOL qualifiedIdentifier
;

// - CREATE REST PROCEDURE --------------------------------------------------

createRestProcedureStatement:
    CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL PROCEDURE_SYMBOL procedureRequestPath (
        ON_SYMBOL serviceSchemaSelector
    )? AS_SYMBOL qualifiedIdentifier (PARAMETERS_SYMBOL restObjectName? graphQlObj)?
        restProcedureResult* restObjectOptions?
;

restProcedureResult:
    RESULT_SYMBOL restResultName? graphQlObj
;

// - CREATE REST FUNCTION ---------------------------------------------------

createRestFunctionStatement:
    CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL FUNCTION_SYMBOL functionRequestPath (
        ON_SYMBOL serviceSchemaSelector
    )? AS_SYMBOL qualifiedIdentifier (PARAMETERS_SYMBOL restObjectName? graphQlObj)?
        restFunctionResult? restObjectOptions?
;

restFunctionResult:
    RESULT_SYMBOL restResultName? graphQlObj
;

// - CREATE REST CONTENT SET ------------------------------------------------

createRestContentSetStatement:
    CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL CONTENT_SYMBOL SET_SYMBOL
        contentSetRequestPath (
        ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )? (FROM_SYMBOL directoryFilePath)? restContentSetOptions?
;

directoryFilePath:
    quotedText
;

restContentSetOptions: (
        enabledDisabled
        | authenticationRequired
        | jsonOptions
        | comments
    )+
;

// - CREATE REST AUTH APP ---------------------------------------------------

createRestAuthAppStatement:
    CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL (
        AUTH_SYMBOL
        | AUTHENTICATION_SYMBOL
    ) APP_SYMBOL authAppName (
        ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )? VENDOR_SYMBOL (MRS_SYMBOL | MYSQL_SYMBOL | vendorName) restAuthAppOptions?
;

authAppName:
    quotedText
;

vendorName:
    quotedText
;

restAuthAppOptions: (
        enabledDisabled
        | comments
        | allowNewUsersToRegister
        | defaultRole
    )+
;

allowNewUsersToRegister:
    ALLOW_SYMBOL NEW_SYMBOL USERS_SYMBOL (
        TO_SYMBOL REGISTER_SYMBOL
    )?
;

defaultRole:
    DEFAULT_SYMBOL ROLE_SYMBOL quotedText
;

// - CREATE REST USER -------------------------------------------------------

createRestUserStatement:
    CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL USER_SYMBOL userName AT_SIGN_SYMBOL
        authAppName (
        ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )? IDENTIFIED_SYMBOL BY_SYMBOL userPassword
;

userName:
    quotedText
;

userPassword:
    quotedText
;

// ALTER statements =========================================================

// - ALTER REST SERVICE -----------------------------------------------------

alterRestServiceStatement:
    ALTER_SYMBOL REST_SYMBOL SERVICE_SYMBOL serviceRequestPath (
        NEW_SYMBOL REQUEST_SYMBOL PATH_SYMBOL newServiceRequestPath
    )? restServiceOptions?
;

// - ALTER REST SERVICE -----------------------------------------------------

alterRestSchemaStatement:
    ALTER_SYMBOL REST_SYMBOL DATABASE_SYMBOL schemaRequestPath? (
        ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )? (
        NEW_SYMBOL REQUEST_SYMBOL PATH_SYMBOL newSchemaRequestPath
    )? (FROM_SYMBOL schemaName)? restSchemaOptions?
;

// - ALTER REST VIEW --------------------------------------------------------

alterRestViewStatement:
    ALTER_SYMBOL REST_SYMBOL JSON_SYMBOL? RELATIONAL_SYMBOL? DUALITY_SYMBOL? VIEW_SYMBOL
        viewRequestPath (ON_SYMBOL serviceSchemaSelector)? (
        NEW_SYMBOL REQUEST_SYMBOL PATH_SYMBOL newViewRequestPath
    )? (
        CLASS_SYMBOL restObjectName graphQlCrudOptions? graphQlObj?
    )? restObjectOptions?
;

// - ALTER REST PROCEDURE ---------------------------------------------------

alterRestProcedureStatement:
    ALTER_SYMBOL REST_SYMBOL PROCEDURE_SYMBOL procedureRequestPath (
        ON_SYMBOL serviceSchemaSelector
    )? (
        NEW_SYMBOL REQUEST_SYMBOL PATH_SYMBOL newProcedureRequestPath
    )? (PARAMETERS_SYMBOL restObjectName? graphQlObj)? restProcedureResult* restObjectOptions?
;

// DROP statements ==========================================================

dropRestServiceStatement:
    DROP_SYMBOL REST_SYMBOL SERVICE_SYMBOL serviceRequestPath
;

dropRestSchemaStatement:
    DROP_SYMBOL REST_SYMBOL DATABASE_SYMBOL schemaRequestPath (
        FROM_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )?
;

dropRestDualityViewStatement:
    DROP_SYMBOL REST_SYMBOL JSON_SYMBOL? RELATIONAL_SYMBOL? DUALITY_SYMBOL? VIEW_SYMBOL
        viewRequestPath (FROM_SYMBOL serviceSchemaSelector)?
;

dropRestProcedureStatement:
    DROP_SYMBOL REST_SYMBOL PROCEDURE_SYMBOL procedureRequestPath (
        FROM_SYMBOL serviceSchemaSelector
    )?
;

dropRestFunctionStatement:
    DROP_SYMBOL REST_SYMBOL FUNCTION_SYMBOL functionRequestPath (
        FROM_SYMBOL serviceSchemaSelector
    )?
;

dropRestContentSetStatement:
    DROP_SYMBOL REST_SYMBOL CONTENT_SYMBOL SET_SYMBOL contentSetRequestPath (
        FROM_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )?
;

dropRestAuthAppStatement:
    DROP_SYMBOL REST_SYMBOL (AUTH_SYMBOL | AUTHENTICATION_SYMBOL) APP_SYMBOL authAppName (
        FROM_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )?
;

dropRestUserStatement:
    DROP_SYMBOL REST_SYMBOL USER_SYMBOL userName AT_SIGN_SYMBOL authAppName (
        ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )?
;

// USE statements ===========================================================

useStatement:
    USE_SYMBOL REST_SYMBOL serviceAndSchemaRequestPaths
;

serviceAndSchemaRequestPaths:
    SERVICE_SYMBOL serviceRequestPath
    | serviceSchemaSelector
;

// SHOW statements ==========================================================

showRestMetadataStatusStatement:
    SHOW_SYMBOL REST_SYMBOL METADATA_SYMBOL? STATUS_SYMBOL
;

showRestServicesStatement:
    SHOW_SYMBOL REST_SYMBOL SERVICES_SYMBOL
;

showRestSchemasStatement:
    SHOW_SYMBOL REST_SYMBOL DATABASES_SYMBOL (
        (IN_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

showRestViewsStatement:
    SHOW_SYMBOL REST_SYMBOL JSON_SYMBOL? RELATIONAL_SYMBOL? DUALITY_SYMBOL? VIEWS_SYMBOL (
        (IN_SYMBOL | FROM_SYMBOL) serviceSchemaSelector
    )?
;

showRestProceduresStatement:
    SHOW_SYMBOL REST_SYMBOL PROCEDURES_SYMBOL (
        (IN_SYMBOL | FROM_SYMBOL) serviceSchemaSelector
    )?
;

showRestFunctionsStatement:
    SHOW_SYMBOL REST_SYMBOL FUNCTIONS_SYMBOL (
        (IN_SYMBOL | FROM_SYMBOL) serviceSchemaSelector
    )?
;

showRestContentSetsStatement:
    SHOW_SYMBOL REST_SYMBOL CONTENT_SYMBOL SETS_SYMBOL (
        (IN_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

showRestAuthAppsStatement:
    SHOW_SYMBOL REST_SYMBOL AUTH_SYMBOL APPS_SYMBOL (
        (IN_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

showCreateRestServiceStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL SERVICE_SYMBOL serviceRequestPath?
;

showCreateRestSchemaStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL DATABASE_SYMBOL schemaRequestPath? (
        (ON_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

showCreateRestViewStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL JSON_SYMBOL? RELATIONAL_SYMBOL? DUALITY_SYMBOL?
        VIEW_SYMBOL viewRequestPath (
        (ON_SYMBOL | FROM_SYMBOL) serviceSchemaSelector
    )?
;

showCreateRestProcedureStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL PROCEDURE_SYMBOL procedureRequestPath (
        (ON_SYMBOL | FROM_SYMBOL) serviceSchemaSelector
    )?
;

showCreateRestFunctionStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL FUNCTION_SYMBOL functionRequestPath (
        (ON_SYMBOL | FROM_SYMBOL) serviceSchemaSelector
    )?
;

showCreateRestAuthAppStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL AUTH_SYMBOL APP_SYMBOL authAppName (
        (ON_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

// Named identifiers ========================================================

serviceRequestPath:
    hostAndPortIdentifier? requestPathIdentifier
;

newServiceRequestPath:
    hostAndPortIdentifier? requestPathIdentifier
;

schemaRequestPath:
    requestPathIdentifier
;

newSchemaRequestPath:
    requestPathIdentifier
;

viewRequestPath:
    requestPathIdentifier
;

newViewRequestPath:
    requestPathIdentifier
;

restObjectName:
    identifier
;

restResultName:
    identifier
;

procedureRequestPath:
    requestPathIdentifier
;

functionRequestPath:
    requestPathIdentifier
;

newProcedureRequestPath:
    requestPathIdentifier
;

contentSetRequestPath:
    requestPathIdentifier
;

//----------------- Common basic rules ---------------------------------------------------------------------------------

dottedIdentifier:
    simpleIdentifier
    | identifier dotIdentifier*
;

hostAndPortIdentifier: (
        dottedIdentifier (COLON_SYMBOL INT_NUMBER)?
    )
;

requestPathIdentifier:
    DIV_OPERATOR dottedIdentifier (DIV_OPERATOR dottedIdentifier)?
;

quotedText:
    DOUBLE_QUOTED_TEXT
    | SINGLE_QUOTED_TEXT
;

//----------------- Json -----------------------------------------------------------------------------------------------

jsonObj:
    OPEN_CURLY_SYMBOL jsonPair (COMMA_SYMBOL jsonPair)* CLOSE_CURLY_SYMBOL
    | OPEN_CURLY_SYMBOL CLOSE_CURLY_SYMBOL
;

jsonPair:
    DOUBLE_QUOTED_TEXT COLON_SYMBOL jsonValue
;

jsonArr:
    OPEN_SQUARE_SYMBOL (jsonValue (COMMA_SYMBOL jsonValue)*)? CLOSE_SQUARE_SYMBOL
;

jsonValue:
    DOUBLE_QUOTED_TEXT
    | (MINUS_OPERATOR | PLUS_OPERATOR)? FLOAT_NUMBER
    | INT_NUMBER
    | jsonObj
    | jsonArr
    | TRUE_SYMBOL
    | FALSE_SYMBOL
    | NULL_SYMBOL
;

//----------------- GraphQL --------------------------------------------------------------------------------------------

graphQlObj:
    OPEN_CURLY_SYMBOL graphQlPair (COMMA_SYMBOL graphQlPair)* CLOSE_CURLY_SYMBOL
    | OPEN_CURLY_SYMBOL CLOSE_CURLY_SYMBOL
;

graphQlCrudOptions: (
        AT_SELECT_SYMBOL
        | AT_NOSELECT_SYMBOL
        | AT_INSERT_SYMBOL
        | AT_NOINSERT_SYMBOL
        | AT_UPDATE_SYMBOL
        | AT_NOUPDATE_SYMBOL
        | AT_DELETE_SYMBOL
        | AT_NODELETE_SYMBOL
    )+
;

graphQlPair:
    graphQlPairKey COLON_SYMBOL graphQlPairValue (
        AT_IN_SYMBOL
        | AT_OUT_SYMBOL
        | AT_INOUT_SYMBOL
        | AT_NOCHECK_SYMBOL
        | AT_SORTABLE_SYMBOL
        | AT_NOFILTERING_SYMBOL
        | AT_ROWOWNERSHIP_SYMBOL
        | AT_UNNEST_SYMBOL
        | AT_DATATYPE_SYMBOL OPEN_PAR_SYMBOL graphQlDatatypeValue CLOSE_PAR_SYMBOL
        | graphQlCrudOptions
    )? graphQlObj?
;

graphQlAllowedKeyword:
    DATABASE_SYMBOL
    | DATABASES_SYMBOL
    | JSON_SYMBOL
    | VIEW_SYMBOL
    | PROCEDURE_SYMBOL
    | FUNCTION_SYMBOL
    | FILTER_SYMBOL
    | PATH_SYMBOL
    | USER_SYMBOL
    | OPTIONS_SYMBOL
    | PAGE_SYMBOL
    | HOST_SYMBOL
    | TYPE_SYMBOL
    | FORMAT_SYMBOL
    | UPDATE_SYMBOL
    | ROLE_SYMBOL
    | CONFIGURE_SYMBOL
    | REST_SYMBOL
    | METADATA_SYMBOL
    | SERVICES_SYMBOL
    | SERVICE_SYMBOL
    | RELATIONAL_SYMBOL
    | DUALITY_SYMBOL
    | VIEWS_SYMBOL
    | PROCEDURES_SYMBOL
    | PARAMETERS_SYMBOL
    | FUNCTIONS_SYMBOL
    | RESULT_SYMBOL
    | ENABLED_SYMBOL
    | DISABLED_SYMBOL
    | PROTOCOL_SYMBOL
    | HTTP_SYMBOL
    | HTTPS_SYMBOL
    | COMMENTS_SYMBOL
    | REQUEST_SYMBOL
    | REDIRECTION_SYMBOL
    | MANAGEMENT_SYMBOL
    | REQUIRED_SYMBOL
    | ITEMS_SYMBOL
    | CONTENT_SYMBOL
    | MEDIA_SYMBOL
    | FEED_SYMBOL
    | ITEM_SYMBOL
    | SETS_SYMBOL
    | AUTH_SYMBOL
    | APPS_SYMBOL
    | APP_SYMBOL
    | VENDOR_SYMBOL
    | MYSQL_SYMBOL
    | USERS_SYMBOL
    | REGISTER_SYMBOL
    | CLASS_SYMBOL
;

graphQlPairKey:
    DOUBLE_QUOTED_TEXT
    | identifier
    | graphQlAllowedKeyword
;

graphQlPairValue:
    qualifiedIdentifier
    | graphQlAllowedKeyword
;

graphQlReduceToValue:
    DOUBLE_QUOTED_TEXT
    | identifier
;

graphQlDatatypeValue:
    DOUBLE_QUOTED_TEXT
    | identifier
;

graphQlValue:
    qualifiedIdentifier
    | graphQlObj
;

/* END OF MERGE PART */

schemaName:
    identifier
;

viewName:
    identifier
;

procedureName:
    identifier
;

// Identifiers excluding keywords (except if they are quoted). IDENT_sys in sql_yacc.yy.
pureIdentifier:
    (IDENTIFIER | BACK_TICK_QUOTED_ID)
;

// Identifiers including a certain set of keywords, which are allowed also if not quoted. ident in
// sql_yacc.yy
identifier:
    pureIdentifier
;

identifierList: // ident_string_list in sql_yacc.yy.
    identifier (COMMA_SYMBOL identifier)*
;

identifierListWithParentheses:
    OPEN_PAR_SYMBOL identifierList CLOSE_PAR_SYMBOL
;

qualifiedIdentifier:
    identifier dotIdentifier?
;

simpleIdentifier: // simple_ident + simple_ident_q
    identifier (dotIdentifier dotIdentifier?)?
;

// This rule encapsulates the frequently used dot + identifier sequence, which also requires a
// special treatment in the lexer. See there in the DOT_IDENTIFIER rule.
dotIdentifier:
    DOT_SYMBOL identifier
;