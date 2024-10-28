/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { mount } from "enzyme";

import { screen, waitFor } from "@testing-library/preact";
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import {
    IMrsAuthAppData, IMrsContentSetData, IMrsDbObjectData, IMrsSchemaData, IMrsServiceData, IMrsUserData,
} from "../../../../communication/ProtocolMrs.js";
import { DBEditorModuleId } from "../../../../modules/ModuleInfo.js";
import { DBEditorModule } from "../../../../modules/db-editor/DBEditorModule.js";
import { MrsDbObjectType } from "../../../../modules/mrs/types.js";
import {
    IMrsAuthAppEditRequest, IMrsContentSetEditRequest, IMrsDbObjectEditRequest,
    IMrsSchemaEditRequest, IMrsSdkExportRequest, IMrsUserEditRequest,
} from "../../../../supplement/RequisitionTypes.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { KeyboardKeys } from "../../../../utilities/helpers.js";
import { DialogHelper, getDbCredentials, nextProcessTick, sendKeyPress } from "../../test-helpers.js";

export const testReqShowMrsDbObjectDialog = async (
    dialogHelper: DialogHelper,
    serviceID: string,
    connID: number,
): Promise<void> => {
    const component = mount<DBEditorModule>(<DBEditorModule />);

    const dbObject: IMrsDbObjectData = {
        comments: "Test db object",
        crudOperations: ["select", "insert", "update", "delete"],
        crudOperationFormat: "FEED",
        dbSchemaId: "1",
        enabled: 1,
        id: serviceID,
        name: "test",
        objectType: MrsDbObjectType.Table,
        requestPath: "/test",
        requiresAuth: 1,
        rowUserOwnershipEnforced: 1,
        serviceId: serviceID,
        autoDetectMediaType: 1,
        schemaName: "MRS_TEST",
    };

    const request: IMrsDbObjectEditRequest = {
        dbObject,
        createObject: true,
    };

    await requisitions.execute("refreshConnection", undefined);
    await requisitions.execute("showPage", {
        module: DBEditorModuleId,
        page: String(connID),
    });

    await nextProcessTick();

    const promise = requisitions.execute("showMrsDbObjectDialog", request);

    await waitFor(() => {
        expect(screen.getByText("MySQL REST Object")).toBeDefined();
    });

    setTimeout(() => {
        sendKeyPress(KeyboardKeys.Escape);
    }, 250);

    await expect(promise).resolves.toBe(true);
    expect(dialogHelper.getErrors()).toHaveLength(0);

    component.unmount();
};

export const testReqShowMrsServiceDialog = async (
    dialogHelper: DialogHelper,
    serviceID: string,
    connID: number,
): Promise<void> => {
    const component = mount<DBEditorModule>(<DBEditorModule />);

    const request: IMrsServiceData = {
        enabled: 1,
        published: 1,
        hostCtx: "test_ctx",
        fullServicePath: "test_ctx",
        name: "test_name",
        id: serviceID,
        isCurrent: 1,
        urlContextRoot: "root",
        urlHostName: "test_host",
        urlProtocol: "protocol",
        comments: "This is test service",
        options: {
            schemaName: "MRS_TEST",
        },
        authPath: "auth",
        authCompletedUrl: "test_auth_completed_url",
        authCompletedUrlValidation: "test_auth_completed_url_validation",
        authCompletedPageContent: "test_auth_completed_page_content",
    };

    await requisitions.execute("refreshConnection", undefined);
    await requisitions.execute("showPage", {
        module: DBEditorModuleId,
        page: String(connID),
    });

    await nextProcessTick();

    const promise = requisitions.execute("showMrsServiceDialog", request);

    await waitFor(() => {
        expect(screen.getByText("MySQL REST Service")).toBeDefined();
    });

    setTimeout(() => {
        sendKeyPress(KeyboardKeys.Escape);
    }, 250);

    await expect(promise).resolves.toBe(true);
    expect(dialogHelper.getErrors()).toHaveLength(0);

    component.unmount();
};

export const testReqShowMrsSchemaDialog = async (
    dialogHelper: DialogHelper,
    serviceID: string,
    connID: number,
): Promise<void> => {
    const component = mount<DBEditorModule>(<DBEditorModule />);

    const schemaData: IMrsSchemaData = {
        comments: "This is test schema",
        enabled: 1,
        hostCtx: "test_ctx",
        id: serviceID,
        itemsPerPage: 1,
        name: "test",
        requestPath: "test",
        requiresAuth: 1,
        serviceId: serviceID,
        schemaType: "DATABASE_SCHEMA",
        options: {
            schemaName: "MRS_TEST",
        },
    };

    const request: IMrsSchemaEditRequest = {
        schemaName: "MRS_TEST",
        schema: schemaData,
    };

    await requisitions.execute("refreshConnection", undefined);
    await requisitions.execute("showPage", {
        module: DBEditorModuleId,
        page: String(connID),
    });

    await nextProcessTick();

    const promise = requisitions.execute("showMrsSchemaDialog", request);

    await waitFor(() => {
        expect(screen.getByText("MySQL REST Schema")).toBeDefined();
    });

    setTimeout(() => {
        sendKeyPress(KeyboardKeys.Escape);
    }, 250);

    await expect(promise).resolves.toBe(true);
    expect(dialogHelper.getErrors()).toHaveLength(0);

    component.unmount();
};

export const testReqShowMrsContentSetDialog = async (
    dialogHelper: DialogHelper,
    serviceID: string,
    connID: number,
): Promise<void> => {
    const component = mount<DBEditorModule>(<DBEditorModule />);

    const content: IMrsContentSetData = {
        comments: "This is test content set",
        enabled: 1,
        hostCtx: "test_ctx",
        id: serviceID,
        requestPath: "test",
        requiresAuth: 1,
        serviceId: serviceID,
        options: {
            schemaName: "MRS_TEST",
        },
        contentType: "STATIC",
    };

    const request: IMrsContentSetEditRequest = {
        directory: "test",
        contentSet: content,
    };

    await requisitions.execute("refreshConnection", undefined);
    await requisitions.execute("showPage", {
        module: DBEditorModuleId,
        page: String(connID),
    });

    await nextProcessTick();

    const promise = requisitions.execute("showMrsContentSetDialog", request);

    await waitFor(() => {
        expect(screen.getByText("MRS Content Set")).toBeDefined();
    });

    setTimeout(() => {
        sendKeyPress(KeyboardKeys.Escape);
    }, 250);

    await expect(promise).resolves.toBe(true);
    expect(dialogHelper.getErrors()).toHaveLength(0);

    component.unmount();
};

export const testReqShowMrsAuthAppDialog = async (
    dialogHelper: DialogHelper,
    authApp: IMrsAuthAppData,
    serviceID: string,
    connID: number,
): Promise<void> => {
    const component = mount<DBEditorModule>(<DBEditorModule />);

    const service: IMrsServiceData = {
        enabled: 1,
        published: 1,
        hostCtx: "test",
        fullServicePath: "test_ctx",
        name: "test_name",
        id: serviceID,
        isCurrent: 1,
        urlContextRoot: "root",
        urlHostName: "test_host",
        urlProtocol: "protocol",
        comments: "This is test service",
        options: {
            schemaName: "MRS_TEST",
        },
        authPath: "auth",
        authCompletedUrl: "test_completed_url",
        authCompletedUrlValidation: "test_completed_url_validation",
        authCompletedPageContent: "test_completed_page_content",
    };

    const request: IMrsAuthAppEditRequest = {
        authApp,
        service,
    };

    await requisitions.execute("refreshConnection", undefined);
    await requisitions.execute("showPage", {
        module: DBEditorModuleId,
        page: String(connID),
    });

    await nextProcessTick();

    const promise = requisitions.execute("showMrsAuthAppDialog", request);

    await waitFor(() => {
        expect(screen.getByText("MySQL REST Authentication App")).toBeDefined();
    });

    setTimeout(() => {
        sendKeyPress(KeyboardKeys.Escape);
    }, 250);

    await expect(promise).resolves.toBe(true);
    expect(dialogHelper.getErrors()).toHaveLength(0);

    component.unmount();
};

export const testReqShowMrsUserDialog = async (
    dialogHelper: DialogHelper,
    authApp: IMrsAuthAppData,
    connID: number,
): Promise<void> => {
    const component = mount<DBEditorModule>(<DBEditorModule />);

    const user: IMrsUserData = {
        authAppId: authApp.appId,
        name: "test_user",
        email: "test_user@oracle.com",
        loginPermitted: true,
    };

    const request: IMrsUserEditRequest = {
        authApp,
        user,
    };

    await requisitions.execute("refreshConnection", undefined);
    await requisitions.execute("showPage", {
        module: DBEditorModuleId,
        page: String(connID),
    });

    await nextProcessTick();

    const promise = requisitions.execute("showMrsUserDialog", request);

    await waitFor(() => {
        expect(screen.getByText("MySQL REST User")).toBeDefined();
    });

    setTimeout(() => {
        sendKeyPress(KeyboardKeys.Escape);
    }, 250);

    await expect(promise).resolves.toBe(true);
    expect(dialogHelper.getErrors()).toHaveLength(0);

    component.unmount();
};

export const testReqShowMrsSdkExportDialog = async (
    dialogHelper: DialogHelper,
    serviceID: string,
    connID: number,
): Promise<void> => {
    const component = mount<DBEditorModule>(<DBEditorModule />);

    const credentials = getDbCredentials();

    const options: IMySQLConnectionOptions = {
        scheme: MySQLConnectionScheme.MySQL,
        user: credentials.userName,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port,
    };

    const testConnection: IConnectionDetails = {
        id: -1,
        dbType: DBType.MySQL,
        caption: "ShellInterfaceDb Test Connection 1",
        description: "ShellInterfaceDb Test Connection",
        options,
    };

    const request: IMrsSdkExportRequest = {
        serviceId: serviceID,
        connectionId: 1,
        connectionDetails: testConnection,
        directory: "test",
    };

    await requisitions.execute("refreshConnection", undefined);
    await requisitions.execute("showPage", {
        module: DBEditorModuleId,
        page: String(connID),
    });

    await nextProcessTick();

    const promise = requisitions.execute("showMrsSdkExportDialog", request);

    await waitFor(() => {
        expect(screen.getByText("Export MRS SDK for /myService")).toBeDefined();
    });

    setTimeout(() => {
        sendKeyPress(KeyboardKeys.Escape);
    }, 250);

    await expect(promise).resolves.toBe(true);
    expect(dialogHelper.getErrors()).toHaveLength(0);

    component.unmount();
};
