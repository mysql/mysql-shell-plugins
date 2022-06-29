/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { ProtocolGui, ShellAPIGui, ShellPromptResponseType, IShellRequest } from "../../../communication";
import { uuidPattern } from "../test-helpers";

const moduleSessionId = "Lorem Ipsum Dolor Sit Amet";

describe("ProtocolGui file tests", (): void => {
    const testStandardFields = (result: IShellRequest, command: unknown, args: unknown): void => {
        expect(result.request_id).toMatch(uuidPattern);
        expect(result.request).toEqual("execute");
        expect(result.args).toEqual(args);
        expect(result.command).toEqual(command);
    };

    const testStandardFieldsWithSession = (result: IShellRequest, command: unknown, args: object): void => {
        testStandardFields(result, command, { ...args, module_session_id: moduleSessionId });
    };

    const testStandardFieldsWithKwArgs = (result: IShellRequest, command: unknown, kwargs: unknown): void => {
        expect(result.request_id).toMatch(uuidPattern);
        expect(result.request).toEqual("execute");
        expect(result.args).toEqual({});
        expect(result.kwargs).toEqual(kwargs);
        expect(result.command).toEqual(command);
    };

    it("Test Base Requests", () => {
        let result = ProtocolGui.getStandardRequest("request.something");
        expect(result.request).toEqual("request.something");
        expect(result.name).toBeUndefined();

        result = ProtocolGui.getStandardRequest("request.something", { name: "LoremIpsum" });
        expect(result.request).toEqual("request.something");
        expect(result.command).toBeUndefined();
        expect(result.name).toEqual("LoremIpsum");

        result = ProtocolGui.getRequestPromptReply("12345", ShellPromptResponseType.Ok, "reply.to.it", moduleSessionId);
        expect(result.request_id).toEqual("12345");
        expect(result.request).toEqual("prompt_reply");
        expect(result.command).toBeUndefined();
        expect(result.type).toEqual("OK");
        expect(result.reply).toEqual("reply.to.it");
        expect(result.module_session_id).toEqual(moduleSessionId);

        result = ProtocolGui.getRequestUsersAuthenticate("mike", "myPassword");
        expect(result.request).toEqual("authenticate");
        expect(result.username).toEqual("mike");
        expect(result.password).toEqual("myPassword");

        result = ProtocolGui.getRequestCommandExecute("execute.it", { test: "blah", args: { params: ["a", 1] } });
        testStandardFields(result, "execute.it", { params: ["a", 1] });
        expect(result.test).toEqual("blah");
    });

    it("Test cluster requests", () => {
        let result = ProtocolGui.getRequestClusterIsGuiModuleBackend();
        testStandardFields(result, ShellAPIGui.GuiClusterIsGuiModuleBackend, {});

        result = ProtocolGui.getRequestClusterGetGuiModuleDisplayInfo();
        testStandardFields(result, ShellAPIGui.GuiClusterGetGuiModuleDisplayInfo, {});
    });

    it("Test file requests", () => {
        let result = ProtocolGui.getRequestCoreListFiles("my.path");
        testStandardFields(result, ShellAPIGui.GuiCoreListFiles, { path: "my.path" });

        result = ProtocolGui.getRequestCoreListFiles();
        testStandardFields(result, ShellAPIGui.GuiCoreListFiles, { path: "" });

        result = ProtocolGui.getRequestCoreCreateFile("my.path");
        testStandardFields(result, ShellAPIGui.GuiCoreCreateFile, { path: "my.path" });

        result = ProtocolGui.getRequestCoreValidatePath("my.path");
        testStandardFields(result, ShellAPIGui.GuiCoreValidatePath, { path: "my.path" });
    });

    it("Test misc requests", () => {
        let result = ProtocolGui.getRequestCoreGetBackendInformation();
        testStandardFields(result, ShellAPIGui.GuiCoreGetBackendInformation, {});

        result = ProtocolGui.getRequestUsersGetGuiModuleList(123);
        testStandardFields(result, ShellAPIGui.GuiUsersGetGuiModuleList, { user_id: 123 });

        result = ProtocolGui.getRequestCoreIsShellWebCertificateInstalled();
        testStandardFieldsWithKwArgs(result, ShellAPIGui.GuiCoreIsShellWebCertificateInstalled, undefined);

        result = ProtocolGui.getRequestCoreIsShellWebCertificateInstalled({});
        testStandardFieldsWithKwArgs(result, ShellAPIGui.GuiCoreIsShellWebCertificateInstalled, {});

        result = ProtocolGui.getRequestCoreIsShellWebCertificateInstalled({ checkKeychain: false });
        testStandardFieldsWithKwArgs(result, ShellAPIGui.GuiCoreIsShellWebCertificateInstalled,
            { check_keychain: false });

        result = ProtocolGui.getRequestCoreInstallShellWebCertificate();
        testStandardFieldsWithKwArgs(result, ShellAPIGui.GuiCoreInstallShellWebCertificate, undefined);

        result = ProtocolGui.getRequestCoreInstallShellWebCertificate({ keychain: true, replaceExisting: false });
        testStandardFieldsWithKwArgs(result, ShellAPIGui.GuiCoreInstallShellWebCertificate,
            { keychain: true, replace_existing: false });

    });

    it("Test connection requests", () => {
        const connectionParam = {
            dbType: "mysql",
            caption: "my.connection",
            description: "Lorem Ipsum",
            options: { option1: "my.option" },
        };

        const connection = {
            db_type: "mysql",
            caption: "my.connection",
            description: "Lorem Ipsum",
            options: { option1: "my.option" },
        };

        let result = ProtocolGui.getRequestDbconnectionsAddDbConnection(123, connectionParam, "my.path");
        testStandardFields(result, ShellAPIGui.GuiDbconnectionsAddDbConnection, {
            profile_id: 123,
            connection,
            folder_path: "my.path",
        });

        result = ProtocolGui.getRequestDbconnectionsAddDbConnection(123, connectionParam);
        testStandardFields(result, ShellAPIGui.GuiDbconnectionsAddDbConnection, {
            profile_id: 123,
            connection,
            folder_path: "",
        });

        connectionParam.description = "Dolor sit amet";
        connection.description = "Dolor sit amet";
        result = ProtocolGui.getRequestDbconnectionsUpdateDbConnection(456, 1, connectionParam, "my.path");
        testStandardFields(result, ShellAPIGui.GuiDbconnectionsUpdateDbConnection, {
            profile_id: 456,
            connection_id: 1,
            connection,
            folder_path: "my.path",
        });

        result = ProtocolGui.getRequestDbconnectionsUpdateDbConnection(456, 1, connectionParam);
        testStandardFields(result, ShellAPIGui.GuiDbconnectionsUpdateDbConnection, {
            profile_id: 456,
            connection_id: 1,
            connection,
            folder_path: "",
        });

        result = ProtocolGui.getRequestDbconnectionsRemoveDbConnection(123, 888);
        testStandardFields(result, ShellAPIGui.GuiDbconnectionsRemoveDbConnection, {
            profile_id: 123,
            connection_id: 888,
        });

        result = ProtocolGui.getRequestDbconnectionsListDbConnections(123, "your.path");
        testStandardFields(result, ShellAPIGui.GuiDbconnectionsListDbConnections, {
            profile_id: 123,
            folder_path: "your.path",
        });

        result = ProtocolGui.getRequestDbconnectionsListDbConnections(123);
        testStandardFields(result, ShellAPIGui.GuiDbconnectionsListDbConnections, {
            profile_id: 123,
            folder_path: "",
        });

        result = ProtocolGui.getRequestDbconnectionsGetDbConnection(123);
        testStandardFields(result, ShellAPIGui.GuiDbconnectionsGetDbConnection, { db_connection_id: 123 });

        result = ProtocolGui.getRequestDbconnectionsGetDbTypes();
        testStandardFields(result, ShellAPIGui.GuiDbconnectionsGetDbTypes, {});
    });

    it("Test MDS requests", () => {
        let result = ProtocolGui.getRequestMdsIsGuiModuleBackend();
        testStandardFields(result, ShellAPIGui.GuiMdsIsGuiModuleBackend, {});

        result = ProtocolGui.getRequestMdsGetGuiModuleDisplayInfo();
        testStandardFields(result, ShellAPIGui.GuiMdsGetGuiModuleDisplayInfo, {});
    });

    it("Test modeler requests", () => {
        let result = ProtocolGui.getRequestModelerIsGuiModuleBackend();
        testStandardFields(result, ShellAPIGui.GuiModelerIsGuiModuleBackend, {});

        result = ProtocolGui.getRequestModelerGetGuiModuleDisplayInfo();
        testStandardFields(result, ShellAPIGui.GuiModelerGetGuiModuleDisplayInfo, {});
    });

    it("Test shell requests", () => {
        let result = ProtocolGui.getRequestShellIsGuiModuleBackend();
        testStandardFields(result, ShellAPIGui.GuiShellIsGuiModuleBackend, {});

        result = ProtocolGui.getRequestShellGetGuiModuleDisplayInfo();
        testStandardFields(result, ShellAPIGui.GuiShellGetGuiModuleDisplayInfo, {});

        result = ProtocolGui.getRequestShellStartSession();
        testStandardFields(result, ShellAPIGui.GuiShellStartSession, {});

        result = ProtocolGui.getRequestShellCloseSession(moduleSessionId);
        testStandardFieldsWithSession(result, ShellAPIGui.GuiShellCloseSession, {});

        result = ProtocolGui.getRequestShellExecute("my.command", moduleSessionId);
        testStandardFieldsWithSession(result, ShellAPIGui.GuiShellExecute, { command: "my.command" });
    });

    it("Test SQL editor requests", () => {
        let result = ProtocolGui.getRequestSqleditorIsGuiModuleBackend();
        testStandardFields(result, ShellAPIGui.GuiSqleditorIsGuiModuleBackend, {});

        result = ProtocolGui.getRequestSqleditorGetGuiModuleDisplayInfo();
        testStandardFields(result, ShellAPIGui.GuiSqleditorGetGuiModuleDisplayInfo, {});

        result = ProtocolGui.getRequestSqleditorStartSession();
        testStandardFields(result, ShellAPIGui.GuiSqleditorStartSession, {});

        result = ProtocolGui.getRequestSqleditorCloseSession(moduleSessionId);
        testStandardFieldsWithSession(result, ShellAPIGui.GuiSqleditorCloseSession, {});

        result = ProtocolGui.getRequestSqleditorOpenConnection(123, moduleSessionId, "my.password");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiSqleditorOpenConnection, {
            db_connection_id: 123,
            password: "my.password",
        });

        result = ProtocolGui.getRequestSqleditorExecute(moduleSessionId, "select 1 from dual", ["arg1"], {
            rowPacketSize: 1000,
        });
        testStandardFieldsWithSession(result, ShellAPIGui.GuiSqleditorExecute, {
            sql: "select 1 from dual",
            params: ["arg1"],
            options: { row_packet_size: 1000 },
        });

        result = ProtocolGui.getRequestSqleditorExecute(moduleSessionId, "select 1 from dual");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiSqleditorExecute, { sql: "select 1 from dual" });

        result = ProtocolGui.getRequestDbGetCatalogObjectNames(moduleSessionId, "Schema");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetCatalogObjectNames, { type: "Schema", filter: "%" });

        result = ProtocolGui.getRequestDbGetSchemaObjectNames(moduleSessionId, "Table", "sakila");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetSchemaObjectNames, {
            schema_name: "sakila",
            filter: "%",
            type: "Table",
        });

        result = ProtocolGui.getRequestDbGetSchemaObject(moduleSessionId, "Table", "sakila", "actor");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetSchemaObject, {
            schema_name: "sakila",
            name: "actor",
            type: "Table",
        });

        result = ProtocolGui.getRequestSqleditorKillQuery(moduleSessionId);
        testStandardFieldsWithSession(result, ShellAPIGui.GuiSqleditorKillQuery, {});

        result = ProtocolGui.getRequestSqleditorGetCurrentSchema(moduleSessionId);
        testStandardFieldsWithSession(result, ShellAPIGui.GuiSqleditorGetCurrentSchema, {});

        result = ProtocolGui.getRequestSqleditorSetCurrentSchema(moduleSessionId, "sakila");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiSqleditorSetCurrentSchema, { schema_name: "sakila" });

        result = ProtocolGui.getRequestSqleditorGetAutoCommit(moduleSessionId);
        testStandardFieldsWithSession(result, ShellAPIGui.GuiSqleditorGetAutoCommit, {});

        result = ProtocolGui.getRequestSqleditorSetAutoCommit(moduleSessionId, true);
        testStandardFieldsWithSession(result, ShellAPIGui.GuiSqleditorSetAutoCommit, { state: true });
    });

    it("Test user requests", () => {
        let result = ProtocolGui.getRequestUsersCreateUser("mike", "my.password", "chief", "me, myself and I");
        testStandardFields(result, ShellAPIGui.GuiUsersCreateUser, {
            username: "mike",
            password: "my.password",
            role: "chief",
            allowed_hosts: "me, myself and I",
        });

        result = ProtocolGui.getRequestUsersSetAllowedHosts(1, "nothing");
        testStandardFields(result, ShellAPIGui.GuiUsersSetAllowedHosts, { user_id: 1, allowed_hosts: "nothing" });

        result = ProtocolGui.getRequestUsersDeleteUser("mike");
        testStandardFields(result, ShellAPIGui.GuiUsersDeleteUser, { username: "mike" });

        result = ProtocolGui.getRequestUsersGrantRole("mike", "chief");
        testStandardFields(result, ShellAPIGui.GuiUsersGrantRole, { username: "mike", role: "chief" });

        result = ProtocolGui.getRequestUsersGetUserId("mike");
        testStandardFields(result, ShellAPIGui.GuiUsersGetUserId, { username: "mike" });

        result = ProtocolGui.getRequestUsersListUsers();
        testStandardFields(result, ShellAPIGui.GuiUsersListUsers, {});

        result = ProtocolGui.getRequestUsersListUserRoles("mike");
        testStandardFields(result, ShellAPIGui.GuiUsersListUserRoles, { username: "mike" });

        result = ProtocolGui.getRequestUsersListRoles();
        testStandardFields(result, ShellAPIGui.GuiUsersListRoles, {});

        result = ProtocolGui.getRequestUsersListRolePrivileges("chief");
        testStandardFields(result, ShellAPIGui.GuiUsersListRolePrivileges, { role: "chief" });

        result = ProtocolGui.getRequestUsersListUserPrivileges("mike");
        testStandardFields(result, ShellAPIGui.GuiUsersListUserPrivileges, { username: "mike" });

        result = ProtocolGui.getRequestUsersListUserGroups();
        testStandardFields(result, ShellAPIGui.GuiUsersListUserGroups, {});
    });

    it("Test profile requests", () => {
        let result = ProtocolGui.getRequestUsersListProfiles(1);
        testStandardFields(result, ShellAPIGui.GuiUsersListProfiles, { user_id: 1 });

        result = ProtocolGui.getRequestUsersGetProfile(2);
        testStandardFields(result, ShellAPIGui.GuiUsersGetProfile, { profile_id: 2 });

        result = ProtocolGui.getRequestUsersUpdateProfile({ id: 1, name: "test", description: "blah", options: {} });
        testStandardFields(result, ShellAPIGui.GuiUsersUpdateProfile,
            { profile: { id: 1, name: "test", description: "blah", options: {} } });

        result = ProtocolGui.getRequestUsersAddProfile(1, { name: "test", description: "blah", options: {} });
        testStandardFields(result, ShellAPIGui.GuiUsersAddProfile,
            { user_id: 1, profile: { name: "test", description: "blah", options: {} } });

        result = ProtocolGui.getRequestUsersDeleteProfile(1, 2);
        testStandardFields(result, ShellAPIGui.GuiUsersDeleteProfile, { user_id: 1, profile_id: 2 });

        result = ProtocolGui.getRequestUsersGetDefaultProfile(1);
        testStandardFields(result, ShellAPIGui.GuiUsersGetDefaultProfile, { user_id: 1 });

        result = ProtocolGui.getRequestUsersSetDefaultProfile(1, 2);
        testStandardFields(result, ShellAPIGui.GuiUsersSetDefaultProfile, { user_id: 1, profile_id: 2 });

        result = ProtocolGui.getRequestUsersSetCurrentProfile(2);
        testStandardFields(result, ShellAPIGui.GuiUsersSetCurrentProfile, { profile_id: 2 });
    });

    it("Test debugger requests", () => {
        let result = ProtocolGui.getRequestDebuggerIsGuiModuleBackend();
        testStandardFields(result, ShellAPIGui.GuiDebuggerIsGuiModuleBackend, {});

        result = ProtocolGui.getRequestDebuggerGetGuiModuleDisplayInfo();
        testStandardFields(result, ShellAPIGui.GuiDebuggerGetGuiModuleDisplayInfo, {});

        result = ProtocolGui.getRequestDebuggerGetScripts();
        testStandardFields(result, ShellAPIGui.GuiDebuggerGetScripts, {});

        result = ProtocolGui.getRequestDebuggerGetScriptContent("my.path");
        testStandardFields(result, ShellAPIGui.GuiDebuggerGetScriptContent, { path: "my.path" });
    });

    it("Test DB object requests", () => {
        let result = ProtocolGui.getRequestDbGetObjectsTypes(moduleSessionId);
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetObjectsTypes, {});

        result = ProtocolGui.getRequestDbGetCatalogObjectNames(moduleSessionId, "dog", "abc");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetCatalogObjectNames, { type: "dog", filter: "abc" });

        result = ProtocolGui.getRequestDbGetCatalogObjectNames(moduleSessionId, "dog");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetCatalogObjectNames, { type: "dog", filter: "%" });

        result = ProtocolGui.getRequestDbGetSchemaObjectNames(moduleSessionId, "cat", "sakila", "abc");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetSchemaObjectNames, {
            type: "cat",
            schema_name: "sakila",
            filter: "abc",
        });

        result = ProtocolGui.getRequestDbGetSchemaObjectNames(moduleSessionId, "cat", "sakila");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetSchemaObjectNames, {
            type: "cat",
            schema_name: "sakila",
            filter: "%",
        });

        result = ProtocolGui.getRequestDbGetCatalogObject(moduleSessionId, "bird", "my.bird");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetCatalogObject, { type: "bird", name: "my.bird" });

        result = ProtocolGui.getRequestDbGetSchemaObject(moduleSessionId, "camel", "sakila", "my.camel");
        testStandardFieldsWithSession(result, ShellAPIGui.GuiDbGetSchemaObject, {
            type: "camel",
            schema_name: "sakila",
            name: "my.camel",
        });
    });

    it("Test logger requests", () => {
        let result = ProtocolGui.getRequestCoreSetLogLevel();
        testStandardFields(result, ShellAPIGui.GuiCoreSetLogLevel, { log_level: "INFO" });

        result = ProtocolGui.getRequestCoreGetLogLevel();
        testStandardFields(result, ShellAPIGui.GuiCoreGetLogLevel, {});

        result = ProtocolGui.getRequestCoreSetLogLevel("NONE");
        testStandardFields(result, ShellAPIGui.GuiCoreSetLogLevel, { log_level: "NONE" });

        result = ProtocolGui.getRequestCoreSetLogLevel("ERROR");
        testStandardFields(result, ShellAPIGui.GuiCoreSetLogLevel, { log_level: "ERROR" });

    });

});
