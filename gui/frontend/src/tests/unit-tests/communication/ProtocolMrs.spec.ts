/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

/* eslint-disable @typescript-eslint/naming-convention */

import { IShellRequest, ProtocolMrs, ShellAPIMrs } from "../../../communication";

const testStandardFields = (result: IShellRequest, command: unknown, args: unknown): void => {
    expect(result.request_id).toEqual("98888888-9888-4888-0888-988888888888");
    expect(result.request).toEqual("execute");
    expect(result.args).toEqual(args);
    expect(result.command).toEqual(command);
};

const testStandardFieldsWithKwArgs = (result: IShellRequest, command: unknown, kwargs: unknown): void => {
    expect(result.request_id).toEqual("98888888-9888-4888-0888-988888888888");
    expect(result.request).toEqual("execute");
    expect(result.args).toEqual({});
    expect(result.kwargs).toEqual(kwargs);
    expect(result.command).toEqual(command);
};

describe("ProtocolMds tests", (): void => {

    it("Test functions with undefined input", () => {
        let result = ProtocolMrs.getRequestAddService();
        testStandardFields(result, ShellAPIMrs.MrsAddService, {
            enabled: true,
            url_context_root: undefined, url_host_name: undefined,
        });
        result = ProtocolMrs.getRequestGetService();
        testStandardFields(result, ShellAPIMrs.MrsGetService, {
            service_id: undefined, url_context_root: undefined, url_host_name: undefined,
        });
        result = ProtocolMrs.getRequestListServices();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsListServices, undefined);
        result = ProtocolMrs.getRequestEnableService();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsEnableService, undefined);
        result = ProtocolMrs.getRequestDisableService();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDisableService, undefined);
        result = ProtocolMrs.getRequestDeleteService();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDeleteService, undefined);
        result = ProtocolMrs.getRequestSetServiceDefault();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetServiceDefault, undefined);
        result = ProtocolMrs.getRequestSetServiceContextPath();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetServiceContextPath, undefined);
        result = ProtocolMrs.getRequestSetServiceProtocol();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetServiceProtocol, undefined);
        result = ProtocolMrs.getRequestSetServiceComments();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetServiceComments, undefined);
        result = ProtocolMrs.getRequestUpdateService();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsUpdateService, undefined);
        result = ProtocolMrs.getRequestAddSchema();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsAddSchema, undefined);
        result = ProtocolMrs.getRequestGetSchema();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsGetSchema, undefined);
        result = ProtocolMrs.getRequestListSchemas();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsListSchemas, undefined);
        result = ProtocolMrs.getRequestEnableSchema();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsEnableSchema, undefined);
        result = ProtocolMrs.getRequestDisableSchema();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDisableSchema, undefined);
        result = ProtocolMrs.getRequestDeleteSchema();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDeleteSchema, undefined);
        result = ProtocolMrs.getRequestSetSchemaName();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaName, undefined);
        result = ProtocolMrs.getRequestSetSchemaRequestPath();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaRequestPath, undefined);
        result = ProtocolMrs.getRequestSetSchemaRequiresAuth();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaRequiresAuth, undefined);
        result = ProtocolMrs.getRequestSetSchemaItemsPerPage();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaItemsPerPage, undefined);
        result = ProtocolMrs.getRequestSetSchemaComments();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaComments, undefined);
        result = ProtocolMrs.getRequestUpdateSchema();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsUpdateSchema, undefined);
        result = ProtocolMrs.getRequestAddContentSet();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsAddContentSet, undefined);
        result = ProtocolMrs.getRequestListContentSets();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsListContentSets, undefined);
        result = ProtocolMrs.getRequestGetContentSet();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsGetContentSet, undefined);
        result = ProtocolMrs.getRequestEnableContentSet();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsEnableContentSet, undefined);
        result = ProtocolMrs.getRequestDisableContentSet();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDisableContentSet, undefined);
        result = ProtocolMrs.getRequestDeleteContentSet();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDeleteContentSet, undefined);
        result = ProtocolMrs.getRequestAddDbObject();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsAddDbObject, undefined);
        result = ProtocolMrs.getRequestGetDbObject();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsGetDbObject, undefined);
        result = ProtocolMrs.getRequestListDbObjects(1);
        testStandardFields(result, ShellAPIMrs.MrsListDbObjects, { schema_id: 1 });
        result = ProtocolMrs.getRequestSetDbObjectRequestPath();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetDbObjectRequestPath, undefined);
        result = ProtocolMrs.getRequestSetDbObjectCrudOperations();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetDbObjectCrudOperations, undefined);
        result = ProtocolMrs.getRequestEnableDbObject();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsEnableDbObject, undefined);
        result = ProtocolMrs.getRequestDisableDbObject();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDisableDbObject, undefined);
        result = ProtocolMrs.getRequestDeleteDbObject();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDeleteDbObject, undefined);
        result = ProtocolMrs.getRequestListContentFiles();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsListContentFiles, undefined);
        result = ProtocolMrs.getRequestAddAuthenticationApp();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsAddAuthenticationApp, undefined);
        result = ProtocolMrs.getRequestListAuthenticationApps();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsListAuthenticationApps, undefined);
        result = ProtocolMrs.getRequestInfo();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsInfo, undefined);
        result = ProtocolMrs.getRequestVersion();
        testStandardFields(result, ShellAPIMrs.MrsVersion, {});
        result = ProtocolMrs.getRequestLs();
        testStandardFields(result, ShellAPIMrs.MrsLs, {});
        result = ProtocolMrs.getRequestConfigure();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsConfigure, undefined);
        result = ProtocolMrs.getRequestStatus();
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsStatus, undefined);
    });

    it("Test service requests", () => {
        let result = ProtocolMrs.getRequestAddService("rootContext", "localhost", true, {
            urlProtocol: "xProt",
            isDefault: true, comments: "lorem", moduleSessionId: "session1", interactive: true,
            raiseExceptions: true,
        });
        testStandardFields(result, ShellAPIMrs.MrsAddService, {
            url_context_root: "rootContext",
            enabled: true, url_host_name: "localhost",
        });

        result = ProtocolMrs.getRequestGetService("rootContext", "localhost", 1, {
            getDefault: true,
            autoSelectSingle: false, moduleSessionId: "sessionId1", interactive: false, raiseExceptions: false,
            returnFormatted: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsGetService, {
            url_context_root: "rootContext",
            service_id: 1, url_host_name: "localhost",
        });

        result = ProtocolMrs.getRequestListServices({
            moduleSessionId: "session1",
            interactive: false, raiseExceptions: false, returnFormatted: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsListServices, {
            module_session_id: "session1",
            interactive: false, raise_exceptions: false, return_formatted: false,
        });

        result = ProtocolMrs.getRequestEnableService({
            urlContextRoot: "rootContext",
            urlHostName: "localhost", serviceId: 1, moduleSessionId: "session1",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsEnableService, {
            url_context_root: "rootContext",
            url_host_name: "localhost", service_id: 1, module_session_id: "session1",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestDisableService({
            urlContextRoot: "rootContext",
            urlHostName: "localhost", serviceId: 1, moduleSessionId: "session1",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDisableService, {
            url_context_root: "rootContext",
            url_host_name: "localhost", service_id: 1, module_session_id: "session1",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestDeleteService({
            urlContextRoot: "rootContext",
            urlHostName: "localhost", serviceId: 1, moduleSessionId: "session1",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDeleteService, {
            url_context_root: "rootContext",
            url_host_name: "localhost", service_id: 1, module_session_id: "session1",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestSetServiceDefault({
            urlContextRoot: "rootContext",
            urlHostName: "localhost", serviceId: 1, moduleSessionId: "session1",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetServiceDefault, {
            url_context_root: "rootContext",
            url_host_name: "localhost", service_id: 1, module_session_id: "session1",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestSetServiceContextPath({
            urlContextRoot: "rootContext",
            urlHostName: "localhost", value: "test val", serviceId: 1, moduleSessionId: "session1",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetServiceContextPath, {
            url_context_root: "rootContext",
            url_host_name: "localhost", value: "test val", service_id: 1, module_session_id: "session1",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestSetServiceProtocol({
            urlContextRoot: "rootContext",
            urlHostName: "localhost", value: "test val", serviceId: 1, moduleSessionId: "session1",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetServiceProtocol, {
            url_context_root: "rootContext",
            url_host_name: "localhost", value: "test val", service_id: 1, module_session_id: "session1",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestSetServiceComments({
            urlContextRoot: "rootContext",
            urlHostName: "localhost", value: "test val", serviceId: 1, moduleSessionId: "session1",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetServiceComments, {
            url_context_root: "rootContext",
            url_host_name: "localhost", value: "test val", service_id: 1, module_session_id: "session1",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestUpdateService({
            urlContextRoot: "rootContext",
            urlHostName: "localhost", value: "test val", serviceId: 1, moduleSessionId: "session1",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsUpdateService, {
            url_context_root: "rootContext",
            url_host_name: "localhost", value: "test val", service_id: 1, module_session_id: "session1",
            interactive: false, raise_exceptions: false,
        });
    });

    it("Test schema requests", () => {
        let result = ProtocolMrs.getRequestAddSchema({
            schemaName: "testDb", serviceId: 1,
            requestPath: "/home/user1", requiresAuth: true, enabled: true, itemsPerPage: 10, comments: "comments",
            moduleSessionId: "session1", interactive: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsAddSchema, {
            schema_name: "testDb", service_id: 1,
            request_path: "/home/user1", requires_auth: true, enabled: true, items_per_page: 10, comments: "comments",
            module_session_id: "session1", interactive: false,
        });

        result = ProtocolMrs.getRequestGetSchema({
            requestPath: "/home/user1", schemaName: "testDb",
            schemaId: 1, serviceId: 1, autoSelectSingle: false, moduleSessionId: "session1", interactive: false,
            raiseExceptions: false, returnFormatted: false, returnPythonObject: true,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsGetSchema, {
            request_path: "/home/user1",
            schema_name: "testDb", schema_id: 1, service_id: 1, auto_select_single: false,
            module_session_id: "session1", interactive: false, raise_exceptions: false, return_formatted: false,
            return_python_object: true,
        });

        result = ProtocolMrs.getRequestListSchemas({
            serviceId: 1, includeEnableState: true,
            moduleSessionId: "session1", interactive: false, raiseExceptions: false, returnFormatted: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsListSchemas, {
            service_id: 1, include_enable_state: true,
            module_session_id: "session1", interactive: false, raise_exceptions: false, return_formatted: false,
        });

        result = ProtocolMrs.getRequestEnableSchema({
            schemaName: "testDb", serviceId: 1,
            moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsEnableSchema, {
            schema_name: "testDb", service_id: 1,
            module_session_id: "session1", interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestDisableSchema({
            schemaName: "testDb", serviceId: 1,
            schemaId: 1, moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDisableSchema, {
            schema_name: "testDb", service_id: 1,
            schema_id: 1, module_session_id: "session1", interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestDeleteSchema({
            schemaName: "testDb", serviceId: 1,
            schemaId: 1, moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDeleteSchema, {
            schema_name: "testDb", service_id: 1,
            schema_id: 1, module_session_id: "session1", interactive: false, raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestSetSchemaName({
            schemaName: "testDb", serviceId: 1,
            schemaId: 1, value: "newVal", moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaName, {
            schema_name: "testDb", service_id: 1,
            schema_id: 1, value: "newVal", module_session_id: "session1", interactive: false,
            raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestSetSchemaRequestPath({
            schemaName: "testDb", serviceId: 1,
            schemaId: 1, value: "newVal", moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaRequestPath, {
            schema_name: "testDb",
            service_id: 1, schema_id: 1, value: "newVal", module_session_id: "session1", interactive: false,
            raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestSetSchemaRequiresAuth({
            schemaName: "testDb", serviceId: 1,
            schemaId: 1, value: true, moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaRequiresAuth, {
            schema_name: "testDb",
            service_id: 1, schema_id: 1, value: true, module_session_id: "session1", interactive: false,
            raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestSetSchemaItemsPerPage({
            schemaName: "testDb", serviceId: 1,
            schemaId: 1, value: 1, moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaItemsPerPage, {
            schema_name: "testDb",
            service_id: 1, schema_id: 1, value: 1, module_session_id: "session1", interactive: false,
            raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestSetSchemaComments({
            schemaName: "testDb", serviceId: 1,
            schemaId: 1, value: "newVal", moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsSetSchemaComments, {
            schema_name: "testDb",
            service_id: 1, schema_id: 1, value: "newVal", module_session_id: "session1", interactive: false,
            raise_exceptions: false,
        });

        result = ProtocolMrs.getRequestUpdateSchema({
            schemaName: "testDb", serviceId: 1,
            schemaId: 1, value: "newVal", moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsUpdateSchema, {
            schema_name: "testDb",
            service_id: 1, schema_id: 1, value: "newVal", module_session_id: "session1", interactive: false,
            raise_exceptions: false,
        });
    });

    it("Test content requests", () => {
        let result = ProtocolMrs.getRequestAddContentSet("content", 1, {
            requestPath: "path", requiresAuth: true,
            moduleSessionId: "session1", interactive: false, raiseExceptions: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsAddContentSet, { content_dir: "content", service_id: 1 });

        result = ProtocolMrs.getRequestListContentSets(1, {
            includeEnableState: true, moduleSessionId: "sessionId1",
            interactive: false, raiseExceptions: false, returnFormatted: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsListContentSets, { service_id: 1 });

        result = ProtocolMrs.getRequestGetContentSet("/home", {
            contentSetId: 1, serviceId: 1, autoSelectSingle: false,
            moduleSessionId: "sessionId1", interactive: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsGetContentSet, { request_path: "/home" });

        result = ProtocolMrs.getRequestEnableContentSet({
            serviceId: 1, contentSetId: 2,
            moduleSessionId: "sessionId1", interactive: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsEnableContentSet, {
            service_id: 1, content_set_id: 2,
            module_session_id: "sessionId1", interactive: false,
        });

        result = ProtocolMrs.getRequestDisableContentSet({
            serviceId: 1, contentSetId: 2,
            moduleSessionId: "sessionId1", interactive: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDisableContentSet, {
            service_id: 1, content_set_id: 2,
            module_session_id: "sessionId1", interactive: false,
        });

        result = ProtocolMrs.getRequestDeleteContentSet({
            serviceId: 1, contentSetId: 2,
            moduleSessionId: "sessionId1", interactive: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsDeleteContentSet, {
            service_id: 1, content_set_id: 2,
            module_session_id: "sessionId1", interactive: false,
        });
    });

    it("Test content requests", () => {
        let result = ProtocolMrs.getRequestAddDbObject({
            dbObjectName: "object1", dbObjectType: "table",
            schemaId: 1, schemaName: "myDb", autoAddSchema: true, requestPath: "/home", crudOperations: [],
            crudOperationFormat: "format1", requiresAuth: true, itemsPerPage: 10, rowUserOwnershipColumn: "user1",
            rowUserOwnershipEnforced: true, comments: "some comment", moduleSessionId: "session1",
            interactive: false, raiseExceptions: false, returnFormatted: false, returnPythonObject: true,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsAddDbObject, {
            db_object_name: "object1",
            db_object_type: "table", schema_id: 1, schema_name: "myDb", auto_add_schema: true, request_path: "/home",
            crud_operations: [], crud_operation_format: "format1", requires_auth: true, items_per_page: 10,
            row_user_ownership_column: "user1", row_user_ownership_enforced: true, comments: "some comment",
            module_session_id: "session1", interactive: false, raise_exceptions: false,
            return_formatted: false, return_python_object: true,
        });

        result = ProtocolMrs.getRequestGetDbObject("/home", "myDb", {
            dbObjectId: 1, schemaId: 1,
            moduleSessionId: "session1", interactive: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsGetDbObject, { request_path: "/home", db_object_name: "myDb" });

        result = ProtocolMrs.getRequestListDbObjects(1, {
            includeEnableState: true,
            moduleSessionId: "session1", interactive: false, raiseExceptions: false, returnFormatted: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsListDbObjects, { schema_id: 1 });

        result = ProtocolMrs.getRequestSetDbObjectRequestPath(1, "/home", {
            moduleSessionId: "session1",
            interactive: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsSetDbObjectRequestPath, { db_object_id: 1, request_path: "/home" });

        result = ProtocolMrs.getRequestSetDbObjectCrudOperations(1, [], "add", {
            moduleSessionId: "session1",
            interactive: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsSetDbObjectCrudOperations, {
            db_object_id: 1,
            crud_operations: [], crud_operation_format: "add",
        });

        result = ProtocolMrs.getRequestEnableDbObject("myDb", 1, {
            dbObjectId: 11,
            moduleSessionId: "session1", interactive: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsEnableDbObject, { db_object_name: "myDb", schema_id: 1 });

        result = ProtocolMrs.getRequestDisableDbObject("myDb", 1, {
            dbObjectId: 11,
            moduleSessionId: "session1", interactive: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsDisableDbObject, { db_object_name: "myDb", schema_id: 1 });

        result = ProtocolMrs.getRequestDeleteDbObject("myDb", 1, {
            dbObjectId: 11,
            moduleSessionId: "session1", interactive: false,
        });
        testStandardFields(result, ShellAPIMrs.MrsDeleteDbObject, { db_object_name: "myDb", schema_id: 1 });
    });

    it("Test other requests", () => {
        let result = ProtocolMrs.getRequestListContentFiles({
            contentSetId: 1, includeEnableState: true,
            moduleSessionId: "session1", interactive: false, raiseExceptions: false, returnFormatted: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsListContentFiles, {
            content_set_id: 1,
            include_enable_state: true, module_session_id: "session1", interactive: false,
            raise_exceptions: false, return_formatted: false,
        });

        result = ProtocolMrs.getRequestAddAuthenticationApp("myApp", 1, {});
        testStandardFields(result, ShellAPIMrs.MrsAddAuthenticationApp, { app_name: "myApp", service_id: 1 });

        result = ProtocolMrs.getRequestListAuthenticationApps(1, {});
        testStandardFields(result, ShellAPIMrs.MrsListAuthenticationApps, { service_id: 1 });

        result = ProtocolMrs.getRequestLs("/home", "sessionId1");
        testStandardFields(result, ShellAPIMrs.MrsLs, { path: "/home", module_session_id: "sessionId1" });

        result = ProtocolMrs.getRequestConfigure({
            enableMrs: true, moduleSessionId: "sessionId1",
            interactive: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsConfigure, {
            enable_mrs: true,
            module_session_id: "sessionId1", interactive: false,
        });

        result = ProtocolMrs.getRequestStatus({
            moduleSessionId: "session1",
            interactive: false, raiseExceptions: false, returnFormatted: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMrs.MrsStatus, {
            module_session_id: "session1",
            interactive: false, raise_exceptions: false, return_formatted: false,
        });
    });

});
