# Copyright (c) 2023, Oracle and/or its affiliates.
from antlr4 import *
if "." in __name__:
    from .MRSParser import MRSParser
else:
    from MRSParser import MRSParser

# This class defines a complete listener for a parse tree produced by MRSParser.
class MRSListener(ParseTreeListener):

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


    # Enter a parse tree produced by MRSParser#restDualityViewOptions.
    def enterRestDualityViewOptions(self, ctx:MRSParser.RestDualityViewOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restDualityViewOptions.
    def exitRestDualityViewOptions(self, ctx:MRSParser.RestDualityViewOptionsContext):
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


    # Enter a parse tree produced by MRSParser#restProcedureOptions.
    def enterRestProcedureOptions(self, ctx:MRSParser.RestProcedureOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#restProcedureOptions.
    def exitRestProcedureOptions(self, ctx:MRSParser.RestProcedureOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#restProcedureResult.
    def enterRestProcedureResult(self, ctx:MRSParser.RestProcedureResultContext):
        pass

    # Exit a parse tree produced by MRSParser#restProcedureResult.
    def exitRestProcedureResult(self, ctx:MRSParser.RestProcedureResultContext):
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


    # Enter a parse tree produced by MRSParser#dropRestDualityViewStatement.
    def enterDropRestDualityViewStatement(self, ctx:MRSParser.DropRestDualityViewStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestDualityViewStatement.
    def exitDropRestDualityViewStatement(self, ctx:MRSParser.DropRestDualityViewStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestProcedureStatement.
    def enterDropRestProcedureStatement(self, ctx:MRSParser.DropRestProcedureStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestProcedureStatement.
    def exitDropRestProcedureStatement(self, ctx:MRSParser.DropRestProcedureStatementContext):
        pass


    # Enter a parse tree produced by MRSParser#dropRestContentSetStatement.
    def enterDropRestContentSetStatement(self, ctx:MRSParser.DropRestContentSetStatementContext):
        pass

    # Exit a parse tree produced by MRSParser#dropRestContentSetStatement.
    def exitDropRestContentSetStatement(self, ctx:MRSParser.DropRestContentSetStatementContext):
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


    # Enter a parse tree produced by MRSParser#schemaName.
    def enterSchemaName(self, ctx:MRSParser.SchemaNameContext):
        pass

    # Exit a parse tree produced by MRSParser#schemaName.
    def exitSchemaName(self, ctx:MRSParser.SchemaNameContext):
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


    # Enter a parse tree produced by MRSParser#viewName.
    def enterViewName(self, ctx:MRSParser.ViewNameContext):
        pass

    # Exit a parse tree produced by MRSParser#viewName.
    def exitViewName(self, ctx:MRSParser.ViewNameContext):
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


    # Enter a parse tree produced by MRSParser#procedureName.
    def enterProcedureName(self, ctx:MRSParser.ProcedureNameContext):
        pass

    # Exit a parse tree produced by MRSParser#procedureName.
    def exitProcedureName(self, ctx:MRSParser.ProcedureNameContext):
        pass


    # Enter a parse tree produced by MRSParser#procedureRequestPath.
    def enterProcedureRequestPath(self, ctx:MRSParser.ProcedureRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#procedureRequestPath.
    def exitProcedureRequestPath(self, ctx:MRSParser.ProcedureRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#newProcedureRequestPath.
    def enterNewProcedureRequestPath(self, ctx:MRSParser.NewProcedureRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#newProcedureRequestPath.
    def exitNewProcedureRequestPath(self, ctx:MRSParser.NewProcedureRequestPathContext):
        pass


    # Enter a parse tree produced by MRSParser#contentSetRequestPath.
    def enterContentSetRequestPath(self, ctx:MRSParser.ContentSetRequestPathContext):
        pass

    # Exit a parse tree produced by MRSParser#contentSetRequestPath.
    def exitContentSetRequestPath(self, ctx:MRSParser.ContentSetRequestPathContext):
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


    # Enter a parse tree produced by MRSParser#graphGlObj.
    def enterGraphGlObj(self, ctx:MRSParser.GraphGlObjContext):
        pass

    # Exit a parse tree produced by MRSParser#graphGlObj.
    def exitGraphGlObj(self, ctx:MRSParser.GraphGlObjContext):
        pass


    # Enter a parse tree produced by MRSParser#graphGlCrudOptions.
    def enterGraphGlCrudOptions(self, ctx:MRSParser.GraphGlCrudOptionsContext):
        pass

    # Exit a parse tree produced by MRSParser#graphGlCrudOptions.
    def exitGraphGlCrudOptions(self, ctx:MRSParser.GraphGlCrudOptionsContext):
        pass


    # Enter a parse tree produced by MRSParser#graphGlPair.
    def enterGraphGlPair(self, ctx:MRSParser.GraphGlPairContext):
        pass

    # Exit a parse tree produced by MRSParser#graphGlPair.
    def exitGraphGlPair(self, ctx:MRSParser.GraphGlPairContext):
        pass


    # Enter a parse tree produced by MRSParser#graphKeyValue.
    def enterGraphKeyValue(self, ctx:MRSParser.GraphKeyValueContext):
        pass

    # Exit a parse tree produced by MRSParser#graphKeyValue.
    def exitGraphKeyValue(self, ctx:MRSParser.GraphKeyValueContext):
        pass


    # Enter a parse tree produced by MRSParser#graphGlReduceToValue.
    def enterGraphGlReduceToValue(self, ctx:MRSParser.GraphGlReduceToValueContext):
        pass

    # Exit a parse tree produced by MRSParser#graphGlReduceToValue.
    def exitGraphGlReduceToValue(self, ctx:MRSParser.GraphGlReduceToValueContext):
        pass


    # Enter a parse tree produced by MRSParser#graphGlDatatypeValue.
    def enterGraphGlDatatypeValue(self, ctx:MRSParser.GraphGlDatatypeValueContext):
        pass

    # Exit a parse tree produced by MRSParser#graphGlDatatypeValue.
    def exitGraphGlDatatypeValue(self, ctx:MRSParser.GraphGlDatatypeValueContext):
        pass


    # Enter a parse tree produced by MRSParser#graphGlValue.
    def enterGraphGlValue(self, ctx:MRSParser.GraphGlValueContext):
        pass

    # Exit a parse tree produced by MRSParser#graphGlValue.
    def exitGraphGlValue(self, ctx:MRSParser.GraphGlValueContext):
        pass



del MRSParser