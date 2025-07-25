/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify it under the terms of the
 * GNU General Public License, version 2.0, as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including but not limited to OpenSSL)
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

/*
 // TODO:

 = errors should include an error code
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
    | createRestContentFileStatement
    | createRestAuthAppStatement
    | createRestRoleStatement
    | createRestUserStatement
    | cloneRestServiceStatement
    | alterRestServiceStatement
    | alterRestSchemaStatement
    | alterRestViewStatement
    | alterRestProcedureStatement
    | alterRestFunctionStatement
    | alterRestContentSetStatement
    | alterRestAuthAppStatement
    | alterRestUserStatement
    | dropRestServiceStatement
    | dropRestSchemaStatement
    | dropRestViewStatement
    | dropRestProcedureStatement
    | dropRestFunctionStatement
    | dropRestContentSetStatement
    | dropRestContentFileStatement
    | dropRestAuthAppStatement
    | dropRestUserStatement
    | dropRestRoleStatement
    | dumpRestServiceStatement
    | dumpRestProjectStatement
    | grantRestRoleStatement
    | grantRestPrivilegeStatement
    | revokeRestPrivilegeStatement
    | revokeRestRoleStatement
    | useStatement
    | showRestMetadataStatusStatement
    | showRestServicesStatement
    | showRestSchemasStatement
    | showRestViewsStatement
    | showRestProceduresStatement
    | showRestFunctionsStatement
    | showRestContentSetsStatement
    | showRestContentFilesStatement
    | showRestAuthAppsStatement
    | showRestRolesStatement
    | showRestGrantsStatement
    | showCreateRestServiceStatement
    | showCreateRestSchemaStatement
    | showCreateRestViewStatement
    | showCreateRestProcedureStatement
    | showCreateRestFunctionStatement
    | showCreateRestContentSetStatement
    | showCreateRestContentFileStatement
    | showCreateRestAuthAppStatement
    | showCreateRestRoleStatement
    | showCreateRestUserStatement
;

// Common Definitions =======================================================

enabledDisabled:
    ENABLED_SYMBOL
    | DISABLED_SYMBOL
;

enabledDisabledPrivate:
    ENABLED_SYMBOL
    | DISABLED_SYMBOL
    | PRIVATE_SYMBOL
;

quotedTextOrDefault: (textStringLiteral | DEFAULT_SYMBOL)
;

jsonOptions:
    MERGE_SYMBOL? OPTIONS_SYMBOL jsonValue
;

metadata:
    METADATA_SYMBOL jsonValue
;

comments:
    COMMENT_SYMBOL textStringLiteral
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

serviceSchemaSelectorWildcard:
    (SERVICE_SYMBOL serviceRequestPathWildcard)? DATABASE_SYMBOL schemaRequestPathWildcard
;

roleService:
    ON_SYMBOL (
        ANY_SYMBOL SERVICE_SYMBOL
        | SERVICE_SYMBOL? serviceRequestPath
    )
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
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL SERVICE_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL SERVICE_SYMBOL (
            IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL
        )?
    ) serviceRequestPath restServiceOptions?
;

restServiceOptions: (
        enabledDisabled
        | publishedUnpublished
        | restProtocol
        | restAuthentication
        // | userManagementSchema -- not enabled yet
        | jsonOptions
        | comments
        | metadata
        | addAuthApp
        | removeAuthApp
    )+
;

publishedUnpublished:
    PUBLISHED_SYMBOL
    | UNPUBLISHED_SYMBOL
;

restProtocol:
    PROTOCOL_SYMBOL (HTTP_SYMBOL | HTTPS_SYMBOL)
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

addAuthApp:
    ADD_SYMBOL AUTH_SYMBOL APP_SYMBOL authAppName (IF_SYMBOL EXISTS_SYMBOL)?
;

removeAuthApp:
    REMOVE_SYMBOL AUTH_SYMBOL APP_SYMBOL authAppName (IF_SYMBOL EXISTS_SYMBOL)?
;

// - CREATE REST SCHEMA -----------------------------------------------------

createRestSchemaStatement:
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL DATABASE_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL DATABASE_SYMBOL (
            IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL
        )?
    ) schemaRequestPath? (
        ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )? FROM_SYMBOL schemaName restSchemaOptions?
;

restSchemaOptions: (
        enabledDisabledPrivate
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
        | metadata
    )+
;

// - CREATE REST VIEW -------------------------------------------------------

createRestViewStatement:
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL DATA_SYMBOL? MAPPING_SYMBOL? VIEW_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL DATA_SYMBOL? MAPPING_SYMBOL? VIEW_SYMBOL (
            IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL
        )?
    ) viewRequestPath (ON_SYMBOL serviceSchemaSelector)? AS_SYMBOL qualifiedIdentifier (
        CLASS_SYMBOL restObjectName
    )? graphQlCrudOptions? graphQlObj? restObjectOptions?
;

restObjectOptions: (
        enabledDisabledPrivate
        | authenticationRequired
        | itemsPerPage
        | jsonOptions
        | comments
        | metadata
        | restViewMediaType
        | restViewFormat
        | restViewAuthenticationProcedure
    )+
;

restViewMediaType:
    MEDIA_SYMBOL TYPE_SYMBOL (
        textStringLiteral
        | AUTODETECT_SYMBOL
    )
;

restViewFormat:
    FORMAT_SYMBOL (FEED_SYMBOL | ITEM_SYMBOL | MEDIA_SYMBOL)
;

restViewAuthenticationProcedure:
    AUTHENTICATION_SYMBOL PROCEDURE_SYMBOL qualifiedIdentifier
;

// - CREATE REST PROCEDURE --------------------------------------------------

createRestProcedureStatement:
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL PROCEDURE_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL PROCEDURE_SYMBOL (
            IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL
        )?
    ) procedureRequestPath (ON_SYMBOL serviceSchemaSelector)? AS_SYMBOL qualifiedIdentifier
        FORCE_SYMBOL? (
        PARAMETERS_SYMBOL restObjectName? graphQlObj
    )? restProcedureResult* restObjectOptions?
;

restProcedureResult:
    RESULT_SYMBOL restResultName? graphQlObj
;

// - CREATE REST FUNCTION ---------------------------------------------------

createRestFunctionStatement:
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL FUNCTION_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL FUNCTION_SYMBOL (
            IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL
        )?
    ) functionRequestPath (ON_SYMBOL serviceSchemaSelector)? AS_SYMBOL qualifiedIdentifier
        FORCE_SYMBOL? (
        PARAMETERS_SYMBOL restObjectName? graphQlObj
    )? restFunctionResult? restObjectOptions?
;

restFunctionResult:
    RESULT_SYMBOL restResultName? graphQlObj
;

// - CREATE REST CONTENT SET ------------------------------------------------

createRestContentSetStatement:
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL CONTENT_SYMBOL SET_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL CONTENT_SYMBOL SET_SYMBOL (
            IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL
        )?
    ) contentSetRequestPath (
        ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )? (FROM_SYMBOL directoryFilePath)? restContentSetOptions?
;

directoryFilePath:
    textStringLiteral
;

restContentSetOptions: (
        enabledDisabledPrivate
        | authenticationRequired
        | jsonOptions
        | comments
        | fileIgnoreList
        | loadScripts
    )+
;

fileIgnoreList:
    IGNORE_SYMBOL textStringLiteral
;

loadScripts:
    LOAD_SYMBOL TYPESCRIPT_SYMBOL? SCRIPTS_SYMBOL
;

// - CREATE REST CONTENT FILE -----------------------------------------------

createRestContentFileStatement:
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL CONTENT_SYMBOL FILE_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL CONTENT_SYMBOL FILE_SYMBOL (
            IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL
        )?
    ) contentFileRequestPath ON_SYMBOL (
        SERVICE_SYMBOL? serviceRequestPath
    )? CONTENT_SYMBOL SET_SYMBOL contentSetRequestPath (
        (FROM_SYMBOL directoryFilePath)
        | (BINARY_SYMBOL? CONTENT_SYMBOL textStringLiteral)
    ) restContentFileOptions?
;

restContentFileOptions: (
        enabledDisabledPrivate
        | authenticationRequired
        | jsonOptions
    )+
;

// - CREATE REST AUTH APP ---------------------------------------------------

createRestAuthAppStatement:
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL (
            AUTH_SYMBOL
            | AUTHENTICATION_SYMBOL
        ) APP_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL (
            AUTH_SYMBOL
            | AUTHENTICATION_SYMBOL
        ) APP_SYMBOL (IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL)?
    ) authAppName VENDOR_SYMBOL (
        MRS_SYMBOL
        | MYSQL_SYMBOL
        | vendorName
    ) restAuthAppOptions?
;

authAppName:
    textOrIdentifier
;

vendorName:
    textOrIdentifier
;

restAuthAppOptions: (
        enabledDisabled
        | comments
        | allowNewUsersToRegister
        | defaultRole
        | appId
        | appSecret
        | url
    )+
;

allowNewUsersToRegister:
    (DO_SYMBOL NOT_SYMBOL)? ALLOW_SYMBOL NEW_SYMBOL USERS_SYMBOL (
        TO_SYMBOL REGISTER_SYMBOL
    )?
;

defaultRole:
    DEFAULT_SYMBOL ROLE_SYMBOL textOrIdentifier
;

appId:
    (APP_SYMBOL | CLIENT_SYMBOL) ID_SYMBOL textStringLiteral
;

appSecret:
    (APP_SYMBOL | CLIENT_SYMBOL) SECRET_SYMBOL textStringLiteral
;

url:
    URL_SYMBOL textStringLiteral
;

// - CREATE REST USER -------------------------------------------------------

createRestUserStatement:
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL USER_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL USER_SYMBOL (
            IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL
        )?
    ) userName AT_SIGN_SYMBOL authAppName (
        IDENTIFIED_SYMBOL BY_SYMBOL userPassword
    )? userOptions?
;

userName:
    textOrIdentifier
;

userPassword:
    textStringLiteral
;

userOptions: (accountLock | appOptions | jsonOptions)+
;

appOptions:
    APP_SYMBOL OPTIONS_SYMBOL jsonValue
;

accountLock:
    ACCOUNT_SYMBOL (LOCK_SYMBOL | UNLOCK_SYMBOL)
;

// - CREATE REST ROLE -------------------------------------------------------
createRestRoleStatement:
    (
        CREATE_SYMBOL OR_SYMBOL REPLACE_SYMBOL REST_SYMBOL ROLE_SYMBOL
        | CREATE_SYMBOL REST_SYMBOL ROLE_SYMBOL (
            IF_SYMBOL NOT_SYMBOL EXISTS_SYMBOL
        )?
    ) roleName (EXTENDS_SYMBOL parentRoleName)? roleService? restRoleOptions?
;

restRoleOptions: (jsonOptions | comments)+
;

parentRoleName:
    textOrIdentifier
;

roleName:
    textOrIdentifier
;

// CLONE statements =========================================================

// - CLONE REST SERVICE -----------------------------------------------------

cloneRestServiceStatement:
    CLONE_SYMBOL REST_SYMBOL SERVICE_SYMBOL serviceRequestPath NEW_SYMBOL REQUEST_SYMBOL PATH_SYMBOL
        newServiceRequestPath
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
    ALTER_SYMBOL REST_SYMBOL DATA_SYMBOL? MAPPING_SYMBOL? VIEW_SYMBOL viewRequestPath (
        ON_SYMBOL serviceSchemaSelector
    )? (NEW_SYMBOL REQUEST_SYMBOL PATH_SYMBOL newViewRequestPath)? (
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

// - ALTER REST FUNCTION ---------------------------------------------------

alterRestFunctionStatement:
    ALTER_SYMBOL REST_SYMBOL FUNCTION_SYMBOL functionRequestPath (
        ON_SYMBOL serviceSchemaSelector
    )? (
        NEW_SYMBOL REQUEST_SYMBOL PATH_SYMBOL newFunctionRequestPath
    )? (PARAMETERS_SYMBOL restObjectName? graphQlObj)? restFunctionResult* restObjectOptions?
;

// - ALTER REST CONTENT SET -------------------------------------------------

alterRestContentSetStatement:
    ALTER_SYMBOL REST_SYMBOL CONTENT_SYMBOL SET_SYMBOL contentSetRequestPath (
        ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )? (
        NEW_SYMBOL REQUEST_SYMBOL PATH_SYMBOL newContentSetRequestPath
    )? restContentSetOptions?
;

// - ALTER REST AUTH APP ----------------------------------------------------

alterRestAuthAppStatement:
    ALTER_SYMBOL REST_SYMBOL (
        AUTH_SYMBOL
        | AUTHENTICATION_SYMBOL
    ) APP_SYMBOL authAppName (
        NEW_SYMBOL NAME_SYMBOL newAuthAppName
    )? restAuthAppOptions?
;

newAuthAppName:
    textOrIdentifier
;

// - ALTER REST USER -------------------------------------------------------

alterRestUserStatement:
    ALTER_SYMBOL REST_SYMBOL USER_SYMBOL userName AT_SIGN_SYMBOL authAppName (
        IDENTIFIED_SYMBOL BY_SYMBOL userPassword
    )? userOptions?
;

// DROP statements ==========================================================

dropRestServiceStatement:
    DROP_SYMBOL REST_SYMBOL SERVICE_SYMBOL (
        IF_SYMBOL EXISTS_SYMBOL
    )? serviceRequestPath
;

dropRestSchemaStatement:
    DROP_SYMBOL REST_SYMBOL DATABASE_SYMBOL (
        IF_SYMBOL EXISTS_SYMBOL
    )? schemaRequestPath (
        FROM_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )?
;

dropRestViewStatement:
    DROP_SYMBOL REST_SYMBOL DATA_SYMBOL? MAPPING_SYMBOL? VIEW_SYMBOL (
        IF_SYMBOL EXISTS_SYMBOL
    )? viewRequestPath (FROM_SYMBOL serviceSchemaSelector)?
;

dropRestProcedureStatement:
    DROP_SYMBOL REST_SYMBOL PROCEDURE_SYMBOL (
        IF_SYMBOL EXISTS_SYMBOL
    )? procedureRequestPath (FROM_SYMBOL serviceSchemaSelector)?
;

dropRestFunctionStatement:
    DROP_SYMBOL REST_SYMBOL FUNCTION_SYMBOL (
        IF_SYMBOL EXISTS_SYMBOL
    )? functionRequestPath (FROM_SYMBOL serviceSchemaSelector)?
;

dropRestContentSetStatement:
    DROP_SYMBOL REST_SYMBOL CONTENT_SYMBOL SET_SYMBOL (
        IF_SYMBOL EXISTS_SYMBOL
    )? contentSetRequestPath (
        FROM_SYMBOL SERVICE_SYMBOL? serviceRequestPath
    )?
;

dropRestContentFileStatement:
    DROP_SYMBOL REST_SYMBOL CONTENT_SYMBOL FILE_SYMBOL (
        IF_SYMBOL EXISTS_SYMBOL
    )? contentFileRequestPath FROM_SYMBOL (
        SERVICE_SYMBOL? serviceRequestPath
    )? CONTENT_SYMBOL SET_SYMBOL contentSetRequestPath
;

dropRestAuthAppStatement:
    DROP_SYMBOL REST_SYMBOL (AUTH_SYMBOL | AUTHENTICATION_SYMBOL) APP_SYMBOL (
        IF_SYMBOL EXISTS_SYMBOL
    )? authAppName
;

dropRestUserStatement:
    DROP_SYMBOL REST_SYMBOL USER_SYMBOL (IF_SYMBOL EXISTS_SYMBOL)? userName AT_SIGN_SYMBOL
        authAppName
;

dropRestRoleStatement:
    DROP_SYMBOL REST_SYMBOL ROLE_SYMBOL (IF_SYMBOL EXISTS_SYMBOL)? roleName roleService?
;

// GRANT statements ===========================================================

grantRestPrivilegeStatement:
    GRANT_SYMBOL REST_SYMBOL privilegeList (
        (ON_SYMBOL SERVICE_SYMBOL? serviceRequestPathWildcard)
        | (
            ON_SYMBOL serviceSchemaSelectorWildcard (
                OBJECT_SYMBOL objectRequestPathWildcard
            )?
        )
    )? TO_SYMBOL roleName roleService?
;

privilegeList:
    privilegeName
    | privilegeName COMMA_SYMBOL privilegeList
;

privilegeName:
    CREATE_SYMBOL
    | READ_SYMBOL
    | UPDATE_SYMBOL
    | DELETE_SYMBOL
;

grantRestRoleStatement:
    GRANT_SYMBOL REST_SYMBOL ROLE_SYMBOL roleName roleService? TO_SYMBOL userName AT_SIGN_SYMBOL
        authAppName comments?
;

// REVOKE statements ===========================================================

revokeRestPrivilegeStatement:
    REVOKE_SYMBOL REST_SYMBOL privilegeList (
        (ON_SYMBOL SERVICE_SYMBOL? serviceRequestPathWildcard)
        | (
            ON_SYMBOL serviceSchemaSelectorWildcard (
                OBJECT_SYMBOL objectRequestPathWildcard
            )?
        )
    )? FROM_SYMBOL roleName roleService?
;

revokeRestRoleStatement:
    REVOKE_SYMBOL REST_SYMBOL ROLE_SYMBOL roleName roleService? FROM_SYMBOL userName AT_SIGN_SYMBOL
        authAppName
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
        (ON_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

showRestViewsStatement:
    SHOW_SYMBOL REST_SYMBOL DATA_SYMBOL? MAPPING_SYMBOL? VIEWS_SYMBOL (
        (ON_SYMBOL | FROM_SYMBOL) serviceSchemaSelector
    )?
;

showRestProceduresStatement:
    SHOW_SYMBOL REST_SYMBOL PROCEDURES_SYMBOL (
        (ON_SYMBOL | FROM_SYMBOL) serviceSchemaSelector
    )?
;

showRestFunctionsStatement:
    SHOW_SYMBOL REST_SYMBOL FUNCTIONS_SYMBOL (
        (ON_SYMBOL | FROM_SYMBOL) serviceSchemaSelector
    )?
;

showRestContentSetsStatement:
    SHOW_SYMBOL REST_SYMBOL CONTENT_SYMBOL SETS_SYMBOL (
        (ON_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

showRestContentFilesStatement:
    SHOW_SYMBOL REST_SYMBOL CONTENT_SYMBOL FILES_SYMBOL (
        ON_SYMBOL
        | FROM_SYMBOL
    ) (SERVICE_SYMBOL? serviceRequestPath)? CONTENT_SYMBOL SET_SYMBOL contentSetRequestPath
;

showRestAuthAppsStatement:
    SHOW_SYMBOL REST_SYMBOL AUTH_SYMBOL APPS_SYMBOL (
        (ON_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

showRestRolesStatement:
    SHOW_SYMBOL REST_SYMBOL ROLES_SYMBOL (
        (ON_SYMBOL | FROM_SYMBOL) (
            ANY_SYMBOL SERVICE_SYMBOL
            | SERVICE_SYMBOL? serviceRequestPath
        )
    )? (FOR_SYMBOL userName? AT_SIGN_SYMBOL authAppName)?
;

showRestGrantsStatement:
    SHOW_SYMBOL REST_SYMBOL GRANTS_SYMBOL FOR_SYMBOL roleName (
        (ON_SYMBOL | FROM_SYMBOL) (
            ANY_SYMBOL SERVICE_SYMBOL
            | SERVICE_SYMBOL? serviceRequestPath
        )
    )?
;

showCreateRestServiceStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL SERVICE_SYMBOL serviceRequestPath? (
        INCLUDING_SYMBOL DATABASE_SYMBOL ENDPOINTS_SYMBOL
    )?
;

showCreateRestSchemaStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL DATABASE_SYMBOL schemaRequestPath? (
        (ON_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

showCreateRestViewStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL DATA_SYMBOL? MAPPING_SYMBOL? VIEW_SYMBOL viewRequestPath (
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

showCreateRestContentSetStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL CONTENT_SYMBOL SET_SYMBOL contentSetRequestPath (
        (ON_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
    )?
;

showCreateRestContentFileStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL CONTENT_SYMBOL FILE_SYMBOL contentFileRequestPath (
        ON_SYMBOL
        | FROM_SYMBOL
    ) (SERVICE_SYMBOL? serviceRequestPath)? CONTENT_SYMBOL SET_SYMBOL contentSetRequestPath
;

showCreateRestAuthAppStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL AUTH_SYMBOL APP_SYMBOL authAppName
;

showCreateRestRoleStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL ROLE_SYMBOL roleName roleService?
;

showCreateRestUserStatement:
    SHOW_SYMBOL CREATE_SYMBOL REST_SYMBOL USER_SYMBOL userName AT_SIGN_SYMBOL authAppName
;

dumpRestServiceStatement:
    DUMP_SYMBOL REST_SYMBOL SERVICE_SYMBOL serviceRequestPath AS_SYMBOL (
        SQL_SYMBOL
    )? SCRIPT_SYMBOL INCLUDING_SYMBOL (
        (
            DATABASE_SYMBOL (
                AND_SYMBOL STATIC_SYMBOL (
                    AND_SYMBOL DYNAMIC_SYMBOL
                )?
            )?
        )
        | ALL_SYMBOL
    ) ENDPOINTS_SYMBOL TO_SYMBOL (ZIP_SYMBOL)? directoryFilePath
;

dumpRestProjectStatement:
    DUMP_SYMBOL REST_SYMBOL PROJECT_SYMBOL
    restProjectName VERSION_SYMBOL restProjectVersion
    (dumpRestProjectService)+
    (dumpRestProjectDatabaseSchema)*
    (dumpRestProjectSettings)?
    TO_SYMBOL (ZIP_SYMBOL)? directoryFilePath
;

// Named identifiers ========================================================

dumpRestProjectService:
    SERVICE_SYMBOL serviceRequestPath
        INCLUDING_SYMBOL ((DATABASE_SYMBOL (AND_SYMBOL STATIC_SYMBOL (AND_SYMBOL DYNAMIC_SYMBOL)?)?) | ALL_SYMBOL) ENDPOINTS_SYMBOL
;

dumpRestProjectDatabaseSchema:
    DATABASE_SYMBOL schemaName (FROM_SYMBOL restProjectDatabaseSchemaFilePath)?
;

dumpRestProjectSettings: (
        ICON_SYMBOL FROM_SYMBOL restProjectIconFilePath
        | DESCRIPTION_SYMBOL restProjectDescription
        | PUBLISHER_SYMBOL restProjectPublisher
    )+
;

restProjectName:
    textStringLiteral
;

restProjectDatabaseSchemaFilePath:
    textStringLiteral
;

restProjectIconFilePath:
    textStringLiteral
;

restProjectDescription:
    textStringLiteral
;

restProjectPublisher:
    textStringLiteral
;

restProjectVersion:
    textStringLiteral
;

serviceRequestPath:
    serviceDevelopersIdentifier? requestPathIdentifier
;

newServiceRequestPath:
    serviceDevelopersIdentifier? requestPathIdentifier
;

serviceRequestPathWildcard:
    requestPathIdentifierWithWildcard
;

schemaRequestPath:
    requestPathIdentifier
;

newSchemaRequestPath:
    requestPathIdentifier
;

schemaRequestPathWildcard:
    requestPathIdentifierWithWildcard
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

objectRequestPath:
    requestPathIdentifier
;

objectRequestPathWildcard:
    requestPathIdentifierWithWildcard
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

newFunctionRequestPath:
    requestPathIdentifier
;

contentSetRequestPath:
    requestPathIdentifier
;

newContentSetRequestPath:
    requestPathIdentifier
;

contentFileRequestPath:
    requestPathIdentifier
;

//----------------- Common basic rules ---------------------------------------------------------------------------------

serviceDeveloperIdentifier:
    textOrIdentifier
;

serviceDevelopersIdentifier:
    serviceDeveloperIdentifier (
        COMMA_SYMBOL serviceDeveloperIdentifier
    )* AT_SIGN_SYMBOL
;

requestPathIdentifier:
    REST_REQUEST_PATH
    | BACK_TICK_QUOTED_ID
    | {this.isSqlModeActive(SqlMode.AnsiQuotes)}? DOUBLE_QUOTED_TEXT
;

requestPathIdentifierWithWildcard:
    REST_REQUEST_PATH
    | BACK_TICK_QUOTED_ID
    | {this.isSqlModeActive(SqlMode.AnsiQuotes)}? DOUBLE_QUOTED_TEXT
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
        AT_INSERT_SYMBOL
        | AT_NOINSERT_SYMBOL
        | AT_UPDATE_SYMBOL
        | AT_NOUPDATE_SYMBOL
        | AT_DELETE_SYMBOL
        | AT_NODELETE_SYMBOL
        | AT_CHECK_SYMBOL
        | AT_NOCHECK_SYMBOL
    )+
;

graphQlPair:
    graphQlPairKey COLON_SYMBOL graphQlPairValue (
        AT_IN_SYMBOL
        | AT_OUT_SYMBOL
        | AT_INOUT_SYMBOL
    )? graphQlValueOptions? (
        AT_DATATYPE_SYMBOL OPEN_PAR_SYMBOL graphQlDatatypeValue CLOSE_PAR_SYMBOL
    )? graphQlCrudOptions? graphQlValueJsonSchema? graphQlObj?
;

graphQlValueOptions: (
        AT_NOCHECK_SYMBOL
        | AT_SORTABLE_SYMBOL
        | AT_NOFILTERING_SYMBOL
        | AT_ROWOWNERSHIP_SYMBOL
        | AT_UNNEST_SYMBOL
        | AT_KEY_SYMBOL
    )+
;

graphQlValueJsonSchema:
    JSON_SYMBOL DATABASE_SYMBOL jsonValue
;

graphQlAllowedKeyword:
    CREATE_SYMBOL
    | OR_SYMBOL
    | REPLACE_SYMBOL
    | ALTER_SYMBOL
    | SHOW_SYMBOL
    | STATUS_SYMBOL
    | NEW_SYMBOL
    | ON_SYMBOL
    | FROM_SYMBOL
    | IN_SYMBOL
    | DATABASES_SYMBOL
    | DATABASE_SYMBOL
    | JSON_SYMBOL
    | VIEW_SYMBOL
    | PROCEDURE_SYMBOL
    | FUNCTION_SYMBOL
    | DROP_SYMBOL
    | USE_SYMBOL
    | AS_SYMBOL
    | FILTER_SYMBOL
    | AUTHENTICATION_SYMBOL
    | PATH_SYMBOL
    | VALIDATION_SYMBOL
    | DEFAULT_SYMBOL
    | USER_SYMBOL
    | OPTIONS_SYMBOL
    | IF_SYMBOL
    | NOT_SYMBOL
    | EXISTS_SYMBOL
    | PAGE_SYMBOL
    | HOST_SYMBOL
    | TYPE_SYMBOL
    | FORMAT_SYMBOL
    | UPDATE_SYMBOL
    | NULL_SYMBOL
    | TRUE_SYMBOL
    | FALSE_SYMBOL
    | SET_SYMBOL
    | IDENTIFIED_SYMBOL
    | BY_SYMBOL
    | ROLE_SYMBOL
    | TO_SYMBOL
    | IGNORE_SYMBOL
    | CLONE_SYMBOL
    | FILE_SYMBOL
    | BINARY_SYMBOL
    | DATA_SYMBOL
    | LOAD_SYMBOL
    | GRANT_SYMBOL
    | READ_SYMBOL
    | DELETE_SYMBOL
    | GROUP_SYMBOL
    | REVOKE_SYMBOL
    | ACCOUNT_SYMBOL
    | LOCK_SYMBOL
    | UNLOCK_SYMBOL
    | GRANTS_SYMBOL
    | FOR_SYMBOL
    | LEVEL_SYMBOL
    | ANY_SYMBOL
    | CLIENT_SYMBOL
    | URL_SYMBOL
    | NAME_SYMBOL
    | DO_SYMBOL
    | CONFIGURE_SYMBOL
    | REST_SYMBOL
    | METADATA_SYMBOL
    | SERVICES_SYMBOL
    | SERVICE_SYMBOL
    | VIEWS_SYMBOL
    | PROCEDURES_SYMBOL
    | PARAMETERS_SYMBOL
    | FUNCTIONS_SYMBOL
    | RESULT_SYMBOL
    | ENABLED_SYMBOL
    | PUBLISHED_SYMBOL
    | DISABLED_SYMBOL
    | PRIVATE_SYMBOL
    | UNPUBLISHED_SYMBOL
    | PROTOCOL_SYMBOL
    | HTTP_SYMBOL
    | HTTPS_SYMBOL
    | COMMENT_SYMBOL
    | REQUEST_SYMBOL
    | REDIRECTION_SYMBOL
    | MANAGEMENT_SYMBOL
    | AVAILABLE_SYMBOL
    | REQUIRED_SYMBOL
    | ITEMS_SYMBOL
    | PER_SYMBOL
    | CONTENT_SYMBOL
    | MEDIA_SYMBOL
    | AUTODETECT_SYMBOL
    | FEED_SYMBOL
    | ITEM_SYMBOL
    | SETS_SYMBOL
    | FILES_SYMBOL
    | AUTH_SYMBOL
    | APPS_SYMBOL
    | APP_SYMBOL
    | ID_SYMBOL
    | SECRET_SYMBOL
    | VENDOR_SYMBOL
    | MRS_SYMBOL
    | MYSQL_SYMBOL
    | USERS_SYMBOL
    | ALLOW_SYMBOL
    | REGISTER_SYMBOL
    | CLASS_SYMBOL
    | DEVELOPMENT_SYMBOL
    | SCRIPTS_SYMBOL
    | MAPPING_SYMBOL
    | TYPESCRIPT_SYMBOL
    | ROLES_SYMBOL
    | EXTENDS_SYMBOL
    | OBJECT_SYMBOL
    | HIERARCHY_SYMBOL
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
    | {this.isSqlModeActive(SqlMode.AnsiQuotes)}? DOUBLE_QUOTED_TEXT
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

textStringLiteral:
    value = SINGLE_QUOTED_TEXT
    | {!this.isSqlModeActive(SqlMode.AnsiQuotes)}? value = DOUBLE_QUOTED_TEXT
;

textOrIdentifier:
    identifier
    | textStringLiteral
;