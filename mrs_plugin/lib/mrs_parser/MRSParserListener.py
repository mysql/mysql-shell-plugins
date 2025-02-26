# Copyright (c) 2023, 2025, Oracle and/or its affiliates.
from antlr4 import *
if "." in __name__:
    from .MRSParser import MRSParser
else:
    from MRSParser import MRSParser

# This class defines a complete listener for a parse tree produced by MRSParser.
class MRSParserListener(ParseTreeListener):

    # Enter a parse tree produced by MRSParser#mrsScript.
    def enterMrsScript(self, ctx:MRSParser.MrsScriptContext):
        pass

    # Exit a parse tree produced by MRSParser#mrsScript.
    def exitMrsScript(self, ctx:MRSParser.MrsScriptContext):
        pass


    # Enter a parse tree produced by MRSParser#mrsStatement.
    def enterMrsStatement(self, ctx:MRSParser.MrsStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#mrsStatement.
    def exitMrsStatement(self, ctx:MRSParser.MrsStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#enabledDisabled.
    def enterEnabledDisabled(self, ctx:MRSParser.EnabledDisabledContext):
        pass

    # Exit a parse tree produced by MRSParser#enabledDisabled.
    def exitEnabledDisabled(self, ctx:MRSParser.EnabledDisabledContext):
        pass


    # Enter a parse tree produced by MRSParser#enabledDisabledPrivate.
    def enterEnabledDisabledPrivate(self, ctx:MRSParser.EnabledDisabledPrivateContext):
        pass

    # Exit a parse tree produced by MRSParser#enabledDisabledPrivate.
    def exitEnabledDisabledPrivate(self, ctx:MRSParser.EnabledDisabledPrivateContext):
        pass


    # Enter a parse tree produced by MRSParser#quotedTextOrDefault.
    def enterQuotedTextOrDefault(self, ctx:MRSParser.QuotedTextOrDefaultContext):
        pass

    # Exit a parse tree produced by MRSParser#quotedTextOrDefault.
    def exitQuotedTextOrDefault(self, ctx:MRSParser.QuotedTextOrDefaultContext):
        pass


    # Enter a parse tree produced by MRSParser#jsonOptions.
    def enterJsonOptions(self, ctx:MRSParser.JsonOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#jsonOptions.
    def exitJsonOptions(self, ctx:MRSParser.JsonOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#metadata.
    def enterMetadata(self, ctx:MRSParser.MetadataContext):
        pass

    # Exit a parse tree produced by MRSParser#metadata.
    def exitMetadata(self, ctx:MRSParser.MetadataContext):
        pass


    # Enter a parse tree produced by MRSParser#comments.
    def enterComments(self, ctx:MRSParser.CommentsContext):
        pass

    # Exit a parse tree produced by MRSParser#comments.
    def exitComments(self, ctx:MRSParser.CommentsContext):
        pass


    # Enter a parse tree produced by MRSParser#authenticationRequired.
    def enterAuthenticationRequired(self, ctx:MRSParser.AuthenticationRequiredContext):
        pass

    # Exit a parse tree produced by MRSParser#authenticationRequired.
    def exitAuthenticationRequired(self, ctx:MRSParser.AuthenticationRequiredContext):
        pass


    # Enter a parse tree produced by MRSParser#itemsPerPage.
    def enterItemsPerPage(self, ctx:MRSParser.ItemsPerPageContext):
        pass

    # Exit a parse tree produced by MRSParser#itemsPerPage.
    def exitItemsPerPage(self, ctx:MRSParser.ItemsPerPageContext):
        pass


    # Enter a parse tree produced by MRSParser#itemsPerPageNumber.
    def enterItemsPerPageNumber(self, ctx:MRSParser.ItemsPerPageNumberContext):
        pass

    # Exit a parse tree produced by MRSParser#itemsPerPageNumber.
    def exitItemsPerPageNumber(self, ctx:MRSParser.ItemsPerPageNumberContext):
        pass


    # Enter a parse tree produced by MRSParser#serviceSchemaSelector.
    def enterServiceSchemaSelector(self, ctx:MRSParser.ServiceSchemaSelectorContext):
        pass

    # Exit a parse tree produced by MRSParser#serviceSchemaSelector.
    def exitServiceSchemaSelector(self, ctx:MRSParser.ServiceSchemaSelectorContext):
        pass


    # Enter a parse tree produced by MRSParser#configureRestMetadataStatement.
    def enterConfigureRestMetadataStatement(self, ctx:MRSParser.ConfigureRestMetadataStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#configureRestMetadataStatement.
    def exitConfigureRestMetadataStatement(self, ctx:MRSParser.ConfigureRestMetadataStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#restMetadataOptions.
    def enterRestMetadataOptions(self, ctx:MRSParser.RestMetadataOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restMetadataOptions.
    def exitRestMetadataOptions(self, ctx:MRSParser.RestMetadataOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#updateIfAvailable.
    def enterUpdateIfAvailable(self, ctx:MRSParser.UpdateIfAvailableContext):
        pass

    # Exit a parse tree produced by MRSParser#updateIfAvailable.
    def exitUpdateIfAvailable(self, ctx:MRSParser.UpdateIfAvailableContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestServiceStatement.
    def enterCreateRestServiceStatement(self, ctx:MRSParser.CreateRestServiceStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestServiceStatement.
    def exitCreateRestServiceStatement(self, ctx:MRSParser.CreateRestServiceStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#restServiceOptions.
    def enterRestServiceOptions(self, ctx:MRSParser.RestServiceOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restServiceOptions.
    def exitRestServiceOptions(self, ctx:MRSParser.RestServiceOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#publishedUnpublished.
    def enterPublishedUnpublished(self, ctx:MRSParser.PublishedUnpublishedContext):
        pass

    # Exit a parse tree produced by MRSParser#publishedUnpublished.
    def exitPublishedUnpublished(self, ctx:MRSParser.PublishedUnpublishedContext):
        pass


    # Enter a parse tree produced by MRSParser#restProtocol.
    def enterRestProtocol(self, ctx:MRSParser.RestProtocolContext):
        pass

    # Exit a parse tree produced by MRSParser#restProtocol.
    def exitRestProtocol(self, ctx:MRSParser.RestProtocolContext):
        pass


    # Enter a parse tree produced by MRSParser#restAuthentication.
    def enterRestAuthentication(self, ctx:MRSParser.RestAuthenticationContext):
        pass

    # Exit a parse tree produced by MRSParser#restAuthentication.
    def exitRestAuthentication(self, ctx:MRSParser.RestAuthenticationContext):
        pass


    # Enter a parse tree produced by MRSParser#authPath.
    def enterAuthPath(self, ctx:MRSParser.AuthPathContext):
        pass

    # Exit a parse tree produced by MRSParser#authPath.
    def exitAuthPath(self, ctx:MRSParser.AuthPathContext):
        pass


    # Enter a parse tree produced by MRSParser#authRedirection.
    def enterAuthRedirection(self, ctx:MRSParser.AuthRedirectionContext):
        pass

    # Exit a parse tree produced by MRSParser#authRedirection.
    def exitAuthRedirection(self, ctx:MRSParser.AuthRedirectionContext):
        pass


    # Enter a parse tree produced by MRSParser#authValidation.
    def enterAuthValidation(self, ctx:MRSParser.AuthValidationContext):
        pass

    # Exit a parse tree produced by MRSParser#authValidation.
    def exitAuthValidation(self, ctx:MRSParser.AuthValidationContext):
        pass


    # Enter a parse tree produced by MRSParser#authPageContent.
    def enterAuthPageContent(self, ctx:MRSParser.AuthPageContentContext):
        pass

    # Exit a parse tree produced by MRSParser#authPageContent.
    def exitAuthPageContent(self, ctx:MRSParser.AuthPageContentContext):
        pass


    # Enter a parse tree produced by MRSParser#userManagementSchema.
    def enterUserManagementSchema(self, ctx:MRSParser.UserManagementSchemaContext):
        pass

    # Exit a parse tree produced by MRSParser#userManagementSchema.
    def exitUserManagementSchema(self, ctx:MRSParser.UserManagementSchemaContext):
        pass


    # Enter a parse tree produced by MRSParser#addAuthApp.
    def enterAddAuthApp(self, ctx:MRSParser.AddAuthAppContext):
        pass

    # Exit a parse tree produced by MRSParser#addAuthApp.
    def exitAddAuthApp(self, ctx:MRSParser.AddAuthAppContext):
        pass


    # Enter a parse tree produced by MRSParser#removeAuthApp.
    def enterRemoveAuthApp(self, ctx:MRSParser.RemoveAuthAppContext):
        pass

    # Exit a parse tree produced by MRSParser#removeAuthApp.
    def exitRemoveAuthApp(self, ctx:MRSParser.RemoveAuthAppContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestSchemaStatement.
    def enterCreateRestSchemaStatement(self, ctx:MRSParser.CreateRestSchemaStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestSchemaStatement.
    def exitCreateRestSchemaStatement(self, ctx:MRSParser.CreateRestSchemaStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#restSchemaOptions.
    def enterRestSchemaOptions(self, ctx:MRSParser.RestSchemaOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restSchemaOptions.
    def exitRestSchemaOptions(self, ctx:MRSParser.RestSchemaOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestViewStatement.
    def enterCreateRestViewStatement(self, ctx:MRSParser.CreateRestViewStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestViewStatement.
    def exitCreateRestViewStatement(self, ctx:MRSParser.CreateRestViewStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#restObjectOptions.
    def enterRestObjectOptions(self, ctx:MRSParser.RestObjectOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restObjectOptions.
    def exitRestObjectOptions(self, ctx:MRSParser.RestObjectOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#restViewMediaType.
    def enterRestViewMediaType(self, ctx:MRSParser.RestViewMediaTypeContext):
        pass

    # Exit a parse tree produced by MRSParser#restViewMediaType.
    def exitRestViewMediaType(self, ctx:MRSParser.RestViewMediaTypeContext):
        pass


    # Enter a parse tree produced by MRSParser#restViewFormat.
    def enterRestViewFormat(self, ctx:MRSParser.RestViewFormatContext):
        pass

    # Exit a parse tree produced by MRSParser#restViewFormat.
    def exitRestViewFormat(self, ctx:MRSParser.RestViewFormatContext):
        pass


    # Enter a parse tree produced by MRSParser#restViewAuthenticationProcedure.
    def enterRestViewAuthenticationProcedure(self, ctx:MRSParser.RestViewAuthenticationProcedureContext):
        pass

    # Exit a parse tree produced by MRSParser#restViewAuthenticationProcedure.
    def exitRestViewAuthenticationProcedure(self, ctx:MRSParser.RestViewAuthenticationProcedureContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestProcedureStatement.
    def enterCreateRestProcedureStatement(self, ctx:MRSParser.CreateRestProcedureStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestProcedureStatement.
    def exitCreateRestProcedureStatement(self, ctx:MRSParser.CreateRestProcedureStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#restProcedureResult.
    def enterRestProcedureResult(self, ctx:MRSParser.RestProcedureResultContext):
        pass

    # Exit a parse tree produced by MRSParser#restProcedureResult.
    def exitRestProcedureResult(self, ctx:MRSParser.RestProcedureResultContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestFunctionStatement.
    def enterCreateRestFunctionStatement(self, ctx:MRSParser.CreateRestFunctionStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestFunctionStatement.
    def exitCreateRestFunctionStatement(self, ctx:MRSParser.CreateRestFunctionStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#restFunctionResult.
    def enterRestFunctionResult(self, ctx:MRSParser.RestFunctionResultContext):
        pass

    # Exit a parse tree produced by MRSParser#restFunctionResult.
    def exitRestFunctionResult(self, ctx:MRSParser.RestFunctionResultContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestContentSetStatement.
    def enterCreateRestContentSetStatement(self, ctx:MRSParser.CreateRestContentSetStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestContentSetStatement.
    def exitCreateRestContentSetStatement(self, ctx:MRSParser.CreateRestContentSetStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#directoryFilePath.
    def enterDirectoryFilePath(self, ctx:MRSParser.DirectoryFilePathContext):
        pass

    # Exit a parse tree produced by MRSParser#directoryFilePath.
    def exitDirectoryFilePath(self, ctx:MRSParser.DirectoryFilePathContext):
        pass


    # Enter a parse tree produced by MRSParser#restContentSetOptions.
    def enterRestContentSetOptions(self, ctx:MRSParser.RestContentSetOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restContentSetOptions.
    def exitRestContentSetOptions(self, ctx:MRSParser.RestContentSetOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#fileIgnoreList.
    def enterFileIgnoreList(self, ctx:MRSParser.FileIgnoreListContext):
        pass

    # Exit a parse tree produced by MRSParser#fileIgnoreList.
    def exitFileIgnoreList(self, ctx:MRSParser.FileIgnoreListContext):
        pass


    # Enter a parse tree produced by MRSParser#loadScripts.
    def enterLoadScripts(self, ctx:MRSParser.LoadScriptsContext):
        pass

    # Exit a parse tree produced by MRSParser#loadScripts.
    def exitLoadScripts(self, ctx:MRSParser.LoadScriptsContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestContentFileStatement.
    def enterCreateRestContentFileStatement(self, ctx:MRSParser.CreateRestContentFileStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestContentFileStatement.
    def exitCreateRestContentFileStatement(self, ctx:MRSParser.CreateRestContentFileStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#restContentFileOptions.
    def enterRestContentFileOptions(self, ctx:MRSParser.RestContentFileOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restContentFileOptions.
    def exitRestContentFileOptions(self, ctx:MRSParser.RestContentFileOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestAuthAppStatement.
    def enterCreateRestAuthAppStatement(self, ctx:MRSParser.CreateRestAuthAppStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestAuthAppStatement.
    def exitCreateRestAuthAppStatement(self, ctx:MRSParser.CreateRestAuthAppStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#authAppName.
    def enterAuthAppName(self, ctx:MRSParser.AuthAppNameContext):
        pass

    # Exit a parse tree produced by MRSParser#authAppName.
    def exitAuthAppName(self, ctx:MRSParser.AuthAppNameContext):
        pass


    # Enter a parse tree produced by MRSParser#vendorName.
    def enterVendorName(self, ctx:MRSParser.VendorNameContext):
        pass

    # Exit a parse tree produced by MRSParser#vendorName.
    def exitVendorName(self, ctx:MRSParser.VendorNameContext):
        pass


    # Enter a parse tree produced by MRSParser#restAuthAppOptions.
    def enterRestAuthAppOptions(self, ctx:MRSParser.RestAuthAppOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restAuthAppOptions.
    def exitRestAuthAppOptions(self, ctx:MRSParser.RestAuthAppOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#allowNewUsersToRegister.
    def enterAllowNewUsersToRegister(self, ctx:MRSParser.AllowNewUsersToRegisterContext):
        pass

    # Exit a parse tree produced by MRSParser#allowNewUsersToRegister.
    def exitAllowNewUsersToRegister(self, ctx:MRSParser.AllowNewUsersToRegisterContext):
        pass


    # Enter a parse tree produced by MRSParser#defaultRole.
    def enterDefaultRole(self, ctx:MRSParser.DefaultRoleContext):
        pass

    # Exit a parse tree produced by MRSParser#defaultRole.
    def exitDefaultRole(self, ctx:MRSParser.DefaultRoleContext):
        pass


    # Enter a parse tree produced by MRSParser#appId.
    def enterAppId(self, ctx:MRSParser.AppIdContext):
        pass

    # Exit a parse tree produced by MRSParser#appId.
    def exitAppId(self, ctx:MRSParser.AppIdContext):
        pass


    # Enter a parse tree produced by MRSParser#appSecret.
    def enterAppSecret(self, ctx:MRSParser.AppSecretContext):
        pass

    # Exit a parse tree produced by MRSParser#appSecret.
    def exitAppSecret(self, ctx:MRSParser.AppSecretContext):
        pass


    # Enter a parse tree produced by MRSParser#url.
    def enterUrl(self, ctx:MRSParser.UrlContext):
        pass

    # Exit a parse tree produced by MRSParser#url.
    def exitUrl(self, ctx:MRSParser.UrlContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestUserStatement.
    def enterCreateRestUserStatement(self, ctx:MRSParser.CreateRestUserStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestUserStatement.
    def exitCreateRestUserStatement(self, ctx:MRSParser.CreateRestUserStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#userName.
    def enterUserName(self, ctx:MRSParser.UserNameContext):
        pass

    # Exit a parse tree produced by MRSParser#userName.
    def exitUserName(self, ctx:MRSParser.UserNameContext):
        pass


    # Enter a parse tree produced by MRSParser#userPassword.
    def enterUserPassword(self, ctx:MRSParser.UserPasswordContext):
        pass

    # Exit a parse tree produced by MRSParser#userPassword.
    def exitUserPassword(self, ctx:MRSParser.UserPasswordContext):
        pass


    # Enter a parse tree produced by MRSParser#userOptions.
    def enterUserOptions(self, ctx:MRSParser.UserOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#userOptions.
    def exitUserOptions(self, ctx:MRSParser.UserOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#appOptions.
    def enterAppOptions(self, ctx:MRSParser.AppOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#appOptions.
    def exitAppOptions(self, ctx:MRSParser.AppOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#accountLock.
    def enterAccountLock(self, ctx:MRSParser.AccountLockContext):
        pass

    # Exit a parse tree produced by MRSParser#accountLock.
    def exitAccountLock(self, ctx:MRSParser.AccountLockContext):
        pass


    # Enter a parse tree produced by MRSParser#createRestRoleStatement.
    def enterCreateRestRoleStatement(self, ctx:MRSParser.CreateRestRoleStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#createRestRoleStatement.
    def exitCreateRestRoleStatement(self, ctx:MRSParser.CreateRestRoleStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#restRoleOptions.
    def enterRestRoleOptions(self, ctx:MRSParser.RestRoleOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restRoleOptions.
    def exitRestRoleOptions(self, ctx:MRSParser.RestRoleOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#parentRoleName.
    def enterParentRoleName(self, ctx:MRSParser.ParentRoleNameContext):
        pass

    # Exit a parse tree produced by MRSParser#parentRoleName.
    def exitParentRoleName(self, ctx:MRSParser.ParentRoleNameContext):
        pass


    # Enter a parse tree produced by MRSParser#roleName.
    def enterRoleName(self, ctx:MRSParser.RoleNameContext):
        pass

    # Exit a parse tree produced by MRSParser#roleName.
    def exitRoleName(self, ctx:MRSParser.RoleNameContext):
        pass


    # Enter a parse tree produced by MRSParser#cloneRestServiceStatement.
    def enterCloneRestServiceStatement(self, ctx:MRSParser.CloneRestServiceStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#cloneRestServiceStatement.
    def exitCloneRestServiceStatement(self, ctx:MRSParser.CloneRestServiceStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#alterRestServiceStatement.
    def enterAlterRestServiceStatement(self, ctx:MRSParser.AlterRestServiceStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#alterRestServiceStatement.
    def exitAlterRestServiceStatement(self, ctx:MRSParser.AlterRestServiceStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#alterRestSchemaStatement.
    def enterAlterRestSchemaStatement(self, ctx:MRSParser.AlterRestSchemaStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#alterRestSchemaStatement.
    def exitAlterRestSchemaStatement(self, ctx:MRSParser.AlterRestSchemaStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#alterRestViewStatement.
    def enterAlterRestViewStatement(self, ctx:MRSParser.AlterRestViewStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#alterRestViewStatement.
    def exitAlterRestViewStatement(self, ctx:MRSParser.AlterRestViewStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#alterRestProcedureStatement.
    def enterAlterRestProcedureStatement(self, ctx:MRSParser.AlterRestProcedureStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#alterRestProcedureStatement.
    def exitAlterRestProcedureStatement(self, ctx:MRSParser.AlterRestProcedureStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#alterRestFunctionStatement.
    def enterAlterRestFunctionStatement(self, ctx:MRSParser.AlterRestFunctionStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#alterRestFunctionStatement.
    def exitAlterRestFunctionStatement(self, ctx:MRSParser.AlterRestFunctionStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#alterRestContentSetStatement.
    def enterAlterRestContentSetStatement(self, ctx:MRSParser.AlterRestContentSetStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#alterRestContentSetStatement.
    def exitAlterRestContentSetStatement(self, ctx:MRSParser.AlterRestContentSetStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#alterRestAuthAppStatement.
    def enterAlterRestAuthAppStatement(self, ctx:MRSParser.AlterRestAuthAppStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#alterRestAuthAppStatement.
    def exitAlterRestAuthAppStatement(self, ctx:MRSParser.AlterRestAuthAppStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#newAuthAppName.
    def enterNewAuthAppName(self, ctx:MRSParser.NewAuthAppNameContext):
        pass

    # Exit a parse tree produced by MRSParser#newAuthAppName.
    def exitNewAuthAppName(self, ctx:MRSParser.NewAuthAppNameContext):
        pass


    # Enter a parse tree produced by MRSParser#alterRestUserStatement.
    def enterAlterRestUserStatement(self, ctx:MRSParser.AlterRestUserStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#alterRestUserStatement.
    def exitAlterRestUserStatement(self, ctx:MRSParser.AlterRestUserStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestServiceStatement.
    def enterDropRestServiceStatement(self, ctx:MRSParser.DropRestServiceStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestServiceStatement.
    def exitDropRestServiceStatement(self, ctx:MRSParser.DropRestServiceStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestSchemaStatement.
    def enterDropRestSchemaStatement(self, ctx:MRSParser.DropRestSchemaStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestSchemaStatement.
    def exitDropRestSchemaStatement(self, ctx:MRSParser.DropRestSchemaStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestViewStatement.
    def enterDropRestViewStatement(self, ctx:MRSParser.DropRestViewStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestViewStatement.
    def exitDropRestViewStatement(self, ctx:MRSParser.DropRestViewStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestProcedureStatement.
    def enterDropRestProcedureStatement(self, ctx:MRSParser.DropRestProcedureStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestProcedureStatement.
    def exitDropRestProcedureStatement(self, ctx:MRSParser.DropRestProcedureStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestFunctionStatement.
    def enterDropRestFunctionStatement(self, ctx:MRSParser.DropRestFunctionStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestFunctionStatement.
    def exitDropRestFunctionStatement(self, ctx:MRSParser.DropRestFunctionStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestContentSetStatement.
    def enterDropRestContentSetStatement(self, ctx:MRSParser.DropRestContentSetStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestContentSetStatement.
    def exitDropRestContentSetStatement(self, ctx:MRSParser.DropRestContentSetStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestContentFileStatement.
    def enterDropRestContentFileStatement(self, ctx:MRSParser.DropRestContentFileStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestContentFileStatement.
    def exitDropRestContentFileStatement(self, ctx:MRSParser.DropRestContentFileStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestAuthAppStatement.
    def enterDropRestAuthAppStatement(self, ctx:MRSParser.DropRestAuthAppStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestAuthAppStatement.
    def exitDropRestAuthAppStatement(self, ctx:MRSParser.DropRestAuthAppStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestUserStatement.
    def enterDropRestUserStatement(self, ctx:MRSParser.DropRestUserStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestUserStatement.
    def exitDropRestUserStatement(self, ctx:MRSParser.DropRestUserStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestRoleStatement.
    def enterDropRestRoleStatement(self, ctx:MRSParser.DropRestRoleStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestRoleStatement.
    def exitDropRestRoleStatement(self, ctx:MRSParser.DropRestRoleStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#grantRestPrivilegeStatement.
    def enterGrantRestPrivilegeStatement(self, ctx:MRSParser.GrantRestPrivilegeStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#grantRestPrivilegeStatement.
    def exitGrantRestPrivilegeStatement(self, ctx:MRSParser.GrantRestPrivilegeStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#privilegeList.
    def enterPrivilegeList(self, ctx:MRSParser.PrivilegeListContext):
        pass

    # Exit a parse tree produced by MRSParser#privilegeList.
    def exitPrivilegeList(self, ctx:MRSParser.PrivilegeListContext):
        pass


    # Enter a parse tree produced by MRSParser#privilegeName.
    def enterPrivilegeName(self, ctx:MRSParser.PrivilegeNameContext):
        pass

    # Exit a parse tree produced by MRSParser#privilegeName.
    def exitPrivilegeName(self, ctx:MRSParser.PrivilegeNameContext):
        pass


    # Enter a parse tree produced by MRSParser#grantRestRoleStatement.
    def enterGrantRestRoleStatement(self, ctx:MRSParser.GrantRestRoleStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#grantRestRoleStatement.
    def exitGrantRestRoleStatement(self, ctx:MRSParser.GrantRestRoleStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#revokeRestPrivilegeStatement.
    def enterRevokeRestPrivilegeStatement(self, ctx:MRSParser.RevokeRestPrivilegeStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#revokeRestPrivilegeStatement.
    def exitRevokeRestPrivilegeStatement(self, ctx:MRSParser.RevokeRestPrivilegeStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#revokeRestRoleStatement.
    def enterRevokeRestRoleStatement(self, ctx:MRSParser.RevokeRestRoleStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#revokeRestRoleStatement.
    def exitRevokeRestRoleStatement(self, ctx:MRSParser.RevokeRestRoleStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#useStatement.
    def enterUseStatement(self, ctx:MRSParser.UseStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#useStatement.
    def exitUseStatement(self, ctx:MRSParser.UseStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#serviceAndSchemaRequestPaths.
    def enterServiceAndSchemaRequestPaths(self, ctx:MRSParser.ServiceAndSchemaRequestPathsContext):
        pass

    # Exit a parse tree produced by MRSParser#serviceAndSchemaRequestPaths.
    def exitServiceAndSchemaRequestPaths(self, ctx:MRSParser.ServiceAndSchemaRequestPathsContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestMetadataStatusStatement.
    def enterShowRestMetadataStatusStatement(self, ctx:MRSParser.ShowRestMetadataStatusStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestMetadataStatusStatement.
    def exitShowRestMetadataStatusStatement(self, ctx:MRSParser.ShowRestMetadataStatusStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestServicesStatement.
    def enterShowRestServicesStatement(self, ctx:MRSParser.ShowRestServicesStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestServicesStatement.
    def exitShowRestServicesStatement(self, ctx:MRSParser.ShowRestServicesStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestSchemasStatement.
    def enterShowRestSchemasStatement(self, ctx:MRSParser.ShowRestSchemasStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestSchemasStatement.
    def exitShowRestSchemasStatement(self, ctx:MRSParser.ShowRestSchemasStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestViewsStatement.
    def enterShowRestViewsStatement(self, ctx:MRSParser.ShowRestViewsStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestViewsStatement.
    def exitShowRestViewsStatement(self, ctx:MRSParser.ShowRestViewsStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestProceduresStatement.
    def enterShowRestProceduresStatement(self, ctx:MRSParser.ShowRestProceduresStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestProceduresStatement.
    def exitShowRestProceduresStatement(self, ctx:MRSParser.ShowRestProceduresStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestFunctionsStatement.
    def enterShowRestFunctionsStatement(self, ctx:MRSParser.ShowRestFunctionsStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestFunctionsStatement.
    def exitShowRestFunctionsStatement(self, ctx:MRSParser.ShowRestFunctionsStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestContentSetsStatement.
    def enterShowRestContentSetsStatement(self, ctx:MRSParser.ShowRestContentSetsStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestContentSetsStatement.
    def exitShowRestContentSetsStatement(self, ctx:MRSParser.ShowRestContentSetsStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestContentFilesStatement.
    def enterShowRestContentFilesStatement(self, ctx:MRSParser.ShowRestContentFilesStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestContentFilesStatement.
    def exitShowRestContentFilesStatement(self, ctx:MRSParser.ShowRestContentFilesStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestAuthAppsStatement.
    def enterShowRestAuthAppsStatement(self, ctx:MRSParser.ShowRestAuthAppsStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestAuthAppsStatement.
    def exitShowRestAuthAppsStatement(self, ctx:MRSParser.ShowRestAuthAppsStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestRolesStatement.
    def enterShowRestRolesStatement(self, ctx:MRSParser.ShowRestRolesStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestRolesStatement.
    def exitShowRestRolesStatement(self, ctx:MRSParser.ShowRestRolesStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showRestGrantsStatement.
    def enterShowRestGrantsStatement(self, ctx:MRSParser.ShowRestGrantsStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showRestGrantsStatement.
    def exitShowRestGrantsStatement(self, ctx:MRSParser.ShowRestGrantsStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showCreateRestServiceStatement.
    def enterShowCreateRestServiceStatement(self, ctx:MRSParser.ShowCreateRestServiceStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showCreateRestServiceStatement.
    def exitShowCreateRestServiceStatement(self, ctx:MRSParser.ShowCreateRestServiceStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showCreateRestSchemaStatement.
    def enterShowCreateRestSchemaStatement(self, ctx:MRSParser.ShowCreateRestSchemaStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showCreateRestSchemaStatement.
    def exitShowCreateRestSchemaStatement(self, ctx:MRSParser.ShowCreateRestSchemaStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showCreateRestViewStatement.
    def enterShowCreateRestViewStatement(self, ctx:MRSParser.ShowCreateRestViewStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showCreateRestViewStatement.
    def exitShowCreateRestViewStatement(self, ctx:MRSParser.ShowCreateRestViewStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showCreateRestProcedureStatement.
    def enterShowCreateRestProcedureStatement(self, ctx:MRSParser.ShowCreateRestProcedureStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showCreateRestProcedureStatement.
    def exitShowCreateRestProcedureStatement(self, ctx:MRSParser.ShowCreateRestProcedureStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showCreateRestFunctionStatement.
    def enterShowCreateRestFunctionStatement(self, ctx:MRSParser.ShowCreateRestFunctionStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showCreateRestFunctionStatement.
    def exitShowCreateRestFunctionStatement(self, ctx:MRSParser.ShowCreateRestFunctionStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showCreateRestContentSetStatement.
    def enterShowCreateRestContentSetStatement(self, ctx:MRSParser.ShowCreateRestContentSetStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showCreateRestContentSetStatement.
    def exitShowCreateRestContentSetStatement(self, ctx:MRSParser.ShowCreateRestContentSetStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showCreateRestContentFileStatement.
    def enterShowCreateRestContentFileStatement(self, ctx:MRSParser.ShowCreateRestContentFileStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showCreateRestContentFileStatement.
    def exitShowCreateRestContentFileStatement(self, ctx:MRSParser.ShowCreateRestContentFileStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#showCreateRestAuthAppStatement.
    def enterShowCreateRestAuthAppStatement(self, ctx:MRSParser.ShowCreateRestAuthAppStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#showCreateRestAuthAppStatement.
    def exitShowCreateRestAuthAppStatement(self, ctx:MRSParser.ShowCreateRestAuthAppStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#serviceRequestPath.
    def enterServiceRequestPath(self, ctx:MRSParser.ServiceRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#serviceRequestPath.
    def exitServiceRequestPath(self, ctx:MRSParser.ServiceRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#newServiceRequestPath.
    def enterNewServiceRequestPath(self, ctx:MRSParser.NewServiceRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#newServiceRequestPath.
    def exitNewServiceRequestPath(self, ctx:MRSParser.NewServiceRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#schemaRequestPath.
    def enterSchemaRequestPath(self, ctx:MRSParser.SchemaRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#schemaRequestPath.
    def exitSchemaRequestPath(self, ctx:MRSParser.SchemaRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#newSchemaRequestPath.
    def enterNewSchemaRequestPath(self, ctx:MRSParser.NewSchemaRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#newSchemaRequestPath.
    def exitNewSchemaRequestPath(self, ctx:MRSParser.NewSchemaRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#viewRequestPath.
    def enterViewRequestPath(self, ctx:MRSParser.ViewRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#viewRequestPath.
    def exitViewRequestPath(self, ctx:MRSParser.ViewRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#newViewRequestPath.
    def enterNewViewRequestPath(self, ctx:MRSParser.NewViewRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#newViewRequestPath.
    def exitNewViewRequestPath(self, ctx:MRSParser.NewViewRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#restObjectName.
    def enterRestObjectName(self, ctx:MRSParser.RestObjectNameContext):
        pass

    # Exit a parse tree produced by MRSParser#restObjectName.
    def exitRestObjectName(self, ctx:MRSParser.RestObjectNameContext):
        pass


    # Enter a parse tree produced by MRSParser#restResultName.
    def enterRestResultName(self, ctx:MRSParser.RestResultNameContext):
        pass

    # Exit a parse tree produced by MRSParser#restResultName.
    def exitRestResultName(self, ctx:MRSParser.RestResultNameContext):
        pass


    # Enter a parse tree produced by MRSParser#objectRequestPath.
    def enterObjectRequestPath(self, ctx:MRSParser.ObjectRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#objectRequestPath.
    def exitObjectRequestPath(self, ctx:MRSParser.ObjectRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#procedureRequestPath.
    def enterProcedureRequestPath(self, ctx:MRSParser.ProcedureRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#procedureRequestPath.
    def exitProcedureRequestPath(self, ctx:MRSParser.ProcedureRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#functionRequestPath.
    def enterFunctionRequestPath(self, ctx:MRSParser.FunctionRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#functionRequestPath.
    def exitFunctionRequestPath(self, ctx:MRSParser.FunctionRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#newProcedureRequestPath.
    def enterNewProcedureRequestPath(self, ctx:MRSParser.NewProcedureRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#newProcedureRequestPath.
    def exitNewProcedureRequestPath(self, ctx:MRSParser.NewProcedureRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#newFunctionRequestPath.
    def enterNewFunctionRequestPath(self, ctx:MRSParser.NewFunctionRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#newFunctionRequestPath.
    def exitNewFunctionRequestPath(self, ctx:MRSParser.NewFunctionRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#contentSetRequestPath.
    def enterContentSetRequestPath(self, ctx:MRSParser.ContentSetRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#contentSetRequestPath.
    def exitContentSetRequestPath(self, ctx:MRSParser.ContentSetRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#newContentSetRequestPath.
    def enterNewContentSetRequestPath(self, ctx:MRSParser.NewContentSetRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#newContentSetRequestPath.
    def exitNewContentSetRequestPath(self, ctx:MRSParser.NewContentSetRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#contentFileRequestPath.
    def enterContentFileRequestPath(self, ctx:MRSParser.ContentFileRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#contentFileRequestPath.
    def exitContentFileRequestPath(self, ctx:MRSParser.ContentFileRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#serviceDeveloperIdentifier.
    def enterServiceDeveloperIdentifier(self, ctx:MRSParser.ServiceDeveloperIdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#serviceDeveloperIdentifier.
    def exitServiceDeveloperIdentifier(self, ctx:MRSParser.ServiceDeveloperIdentifierContext):
        pass


    # Enter a parse tree produced by MRSParser#serviceDevelopersIdentifier.
    def enterServiceDevelopersIdentifier(self, ctx:MRSParser.ServiceDevelopersIdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#serviceDevelopersIdentifier.
    def exitServiceDevelopersIdentifier(self, ctx:MRSParser.ServiceDevelopersIdentifierContext):
        pass


    # Enter a parse tree produced by MRSParser#dottedIdentifier.
    def enterDottedIdentifier(self, ctx:MRSParser.DottedIdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#dottedIdentifier.
    def exitDottedIdentifier(self, ctx:MRSParser.DottedIdentifierContext):
        pass


    # Enter a parse tree produced by MRSParser#hostAndPortIdentifier.
    def enterHostAndPortIdentifier(self, ctx:MRSParser.HostAndPortIdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#hostAndPortIdentifier.
    def exitHostAndPortIdentifier(self, ctx:MRSParser.HostAndPortIdentifierContext):
        pass


    # Enter a parse tree produced by MRSParser#requestPathIdentifier.
    def enterRequestPathIdentifier(self, ctx:MRSParser.RequestPathIdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#requestPathIdentifier.
    def exitRequestPathIdentifier(self, ctx:MRSParser.RequestPathIdentifierContext):
        pass


    # Enter a parse tree produced by MRSParser#quotedText.
    def enterQuotedText(self, ctx:MRSParser.QuotedTextContext):
        pass

    # Exit a parse tree produced by MRSParser#quotedText.
    def exitQuotedText(self, ctx:MRSParser.QuotedTextContext):
        pass


    # Enter a parse tree produced by MRSParser#jsonObj.
    def enterJsonObj(self, ctx:MRSParser.JsonObjContext):
        pass

    # Exit a parse tree produced by MRSParser#jsonObj.
    def exitJsonObj(self, ctx:MRSParser.JsonObjContext):
        pass


    # Enter a parse tree produced by MRSParser#jsonPair.
    def enterJsonPair(self, ctx:MRSParser.JsonPairContext):
        pass

    # Exit a parse tree produced by MRSParser#jsonPair.
    def exitJsonPair(self, ctx:MRSParser.JsonPairContext):
        pass


    # Enter a parse tree produced by MRSParser#jsonArr.
    def enterJsonArr(self, ctx:MRSParser.JsonArrContext):
        pass

    # Exit a parse tree produced by MRSParser#jsonArr.
    def exitJsonArr(self, ctx:MRSParser.JsonArrContext):
        pass


    # Enter a parse tree produced by MRSParser#jsonValue.
    def enterJsonValue(self, ctx:MRSParser.JsonValueContext):
        pass

    # Exit a parse tree produced by MRSParser#jsonValue.
    def exitJsonValue(self, ctx:MRSParser.JsonValueContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlObj.
    def enterGraphQlObj(self, ctx:MRSParser.GraphQlObjContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlObj.
    def exitGraphQlObj(self, ctx:MRSParser.GraphQlObjContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlCrudOptions.
    def enterGraphQlCrudOptions(self, ctx:MRSParser.GraphQlCrudOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlCrudOptions.
    def exitGraphQlCrudOptions(self, ctx:MRSParser.GraphQlCrudOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlPair.
    def enterGraphQlPair(self, ctx:MRSParser.GraphQlPairContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlPair.
    def exitGraphQlPair(self, ctx:MRSParser.GraphQlPairContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlValueOptions.
    def enterGraphQlValueOptions(self, ctx:MRSParser.GraphQlValueOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlValueOptions.
    def exitGraphQlValueOptions(self, ctx:MRSParser.GraphQlValueOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlValueJsonSchema.
    def enterGraphQlValueJsonSchema(self, ctx:MRSParser.GraphQlValueJsonSchemaContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlValueJsonSchema.
    def exitGraphQlValueJsonSchema(self, ctx:MRSParser.GraphQlValueJsonSchemaContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlAllowedKeyword.
    def enterGraphQlAllowedKeyword(self, ctx:MRSParser.GraphQlAllowedKeywordContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlAllowedKeyword.
    def exitGraphQlAllowedKeyword(self, ctx:MRSParser.GraphQlAllowedKeywordContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlPairKey.
    def enterGraphQlPairKey(self, ctx:MRSParser.GraphQlPairKeyContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlPairKey.
    def exitGraphQlPairKey(self, ctx:MRSParser.GraphQlPairKeyContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlPairValue.
    def enterGraphQlPairValue(self, ctx:MRSParser.GraphQlPairValueContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlPairValue.
    def exitGraphQlPairValue(self, ctx:MRSParser.GraphQlPairValueContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlReduceToValue.
    def enterGraphQlReduceToValue(self, ctx:MRSParser.GraphQlReduceToValueContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlReduceToValue.
    def exitGraphQlReduceToValue(self, ctx:MRSParser.GraphQlReduceToValueContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlDatatypeValue.
    def enterGraphQlDatatypeValue(self, ctx:MRSParser.GraphQlDatatypeValueContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlDatatypeValue.
    def exitGraphQlDatatypeValue(self, ctx:MRSParser.GraphQlDatatypeValueContext):
        pass


    # Enter a parse tree produced by MRSParser#graphQlValue.
    def enterGraphQlValue(self, ctx:MRSParser.GraphQlValueContext):
        pass

    # Exit a parse tree produced by MRSParser#graphQlValue.
    def exitGraphQlValue(self, ctx:MRSParser.GraphQlValueContext):
        pass


    # Enter a parse tree produced by MRSParser#schemaName.
    def enterSchemaName(self, ctx:MRSParser.SchemaNameContext):
        pass

    # Exit a parse tree produced by MRSParser#schemaName.
    def exitSchemaName(self, ctx:MRSParser.SchemaNameContext):
        pass


    # Enter a parse tree produced by MRSParser#viewName.
    def enterViewName(self, ctx:MRSParser.ViewNameContext):
        pass

    # Exit a parse tree produced by MRSParser#viewName.
    def exitViewName(self, ctx:MRSParser.ViewNameContext):
        pass


    # Enter a parse tree produced by MRSParser#procedureName.
    def enterProcedureName(self, ctx:MRSParser.ProcedureNameContext):
        pass

    # Exit a parse tree produced by MRSParser#procedureName.
    def exitProcedureName(self, ctx:MRSParser.ProcedureNameContext):
        pass


    # Enter a parse tree produced by MRSParser#pureIdentifier.
    def enterPureIdentifier(self, ctx:MRSParser.PureIdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#pureIdentifier.
    def exitPureIdentifier(self, ctx:MRSParser.PureIdentifierContext):
        pass


    # Enter a parse tree produced by MRSParser#identifier.
    def enterIdentifier(self, ctx:MRSParser.IdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#identifier.
    def exitIdentifier(self, ctx:MRSParser.IdentifierContext):
        pass


    # Enter a parse tree produced by MRSParser#identifierList.
    def enterIdentifierList(self, ctx:MRSParser.IdentifierListContext):
        pass

    # Exit a parse tree produced by MRSParser#identifierList.
    def exitIdentifierList(self, ctx:MRSParser.IdentifierListContext):
        pass


    # Enter a parse tree produced by MRSParser#identifierListWithParentheses.
    def enterIdentifierListWithParentheses(self, ctx:MRSParser.IdentifierListWithParenthesesContext):
        pass

    # Exit a parse tree produced by MRSParser#identifierListWithParentheses.
    def exitIdentifierListWithParentheses(self, ctx:MRSParser.IdentifierListWithParenthesesContext):
        pass


    # Enter a parse tree produced by MRSParser#qualifiedIdentifier.
    def enterQualifiedIdentifier(self, ctx:MRSParser.QualifiedIdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#qualifiedIdentifier.
    def exitQualifiedIdentifier(self, ctx:MRSParser.QualifiedIdentifierContext):
        pass


    # Enter a parse tree produced by MRSParser#simpleIdentifier.
    def enterSimpleIdentifier(self, ctx:MRSParser.SimpleIdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#simpleIdentifier.
    def exitSimpleIdentifier(self, ctx:MRSParser.SimpleIdentifierContext):
        pass


    # Enter a parse tree produced by MRSParser#dotIdentifier.
    def enterDotIdentifier(self, ctx:MRSParser.DotIdentifierContext):
        pass

    # Exit a parse tree produced by MRSParser#dotIdentifier.
    def exitDotIdentifier(self, ctx:MRSParser.DotIdentifierContext):
        pass



del MRSParser