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

import type { IOpenConnectionData, IStatusData } from "../../../communication/ProtocolGui.js";
import type {
    IMrsAuthAppData, IMrsContentFileData, IMrsContentSetData, IMrsRouterData, IMrsRouterService, IMrsSchemaData,
    IMrsServiceData, IMrsStatusData, IMrsUserData,
} from "../../../communication/ProtocolMrs.js";
import type { IWebviewProvider } from "../../../supplement/RequisitionTypes.js";
import { DBConnectionEditorType, DBType, type IConnectionDetails } from "../../../supplement/ShellInterface/index.js";

export const cdmMockState = {
    mockConnectedLoaded: false,
    haveMockConnectionResponse: false,
};

export const connectionDetailsMock1: IConnectionDetails[] = [{
    id: 1,
    dbType: DBType.MySQL,
    caption: "Test connection",
    description: "Test connection description",
    options: {
        schema: "mysqlx",
        host: "localhost",
        port: 3306,
        user: "root",
    },
    useSSH: false,
    useMHS: false,
    version: 90001,
    sqlMode: "ANSI_MODE",
    heatWaveAvailable: true,
    settings: {
        defaultEditor: DBConnectionEditorType.DbNotebook,
    },
}, {
    id: 2,
    dbType: DBType.Sqlite,
    caption: "Test connection 2",
    description: "Test connection description 2",
    options: {
        file: "test.db",
    },
    useSSH: false,
    useMHS: false,
    version: 0,
    settings: {
        defaultEditor: DBConnectionEditorType.DbScript,
    },
}];

export const extraConnectionDetails: IConnectionDetails = {
    id: 3,
    dbType: DBType.MySQL,
    caption: "Test connection 3",
    description: "Test connection description 3",
    options: {
        schema: "public",
        host: "localhost",
        port: 5432,
        user: "postgres",
    },
    useSSH: false,
    useMHS: false,
    version: 130000,
    sqlMode: "ANSI_MODE",
    heatWaveAvailable: false,
    settings: {
        defaultEditor: DBConnectionEditorType.DbScript,
    },
};

export const openConnectionDataMock1: IOpenConnectionData = {
    currentSchema: "sakila",
    info: {
        sqlMode: "ANSI_MODE",
        version: "9.1.0",
        heatWaveAvailable: false,
        mleAvailable: false,
    },
};

export const mrsStatusMock: IMrsStatusData = {
    serviceConfigured: true,
    serviceCount: 1,
    serviceEnabled: true,
    serviceUpgradeable: true,
    majorUpgradeRequired: false,
    minimumVersionRequired: 0,
    serviceUpgradeIgnored: false,
    serviceBeingUpgraded: false,
};

export const authAppsData: IMrsAuthAppData[] = [{
    id: "1",
    authVendorId: "1",
    authVendor: "Test vendor",
    authVendorName: "Test vendor name",
    serviceId: "1",
    name: "Test app",
    appId: "app1",
    enabled: true,
    limitToRegisteredUsers: false,
    defaultRoleId: null,
}];

export const mrsServicesData: IMrsServiceData[] = [{
    enabled: 1,
    published: 0,
    hostCtx: "localhost",
    name: "mrsService1",
    id: "1",
    isCurrent: 1,
    urlContextRoot: "/mrsService1",
    urlHostName: "localhost",
    urlProtocol: "http",
    comments: "Test service",
    options: {},
    authPath: "/auth",
    authCompletedUrl: "http://localhost/authCompleted",
    authCompletedUrlValidation: "http://localhost/authCompleted",
    authCompletedPageContent: "Test content",
    authApps: authAppsData,
}];

export const mrsSchemaData: IMrsSchemaData[] = [{
    comments: "Test schema",
    enabled: 1,
    hostCtx: "localhost",
    id: "1",
    itemsPerPage: 10,
    name: "mrsSchema1",
    requestPath: "/mrsSchema1",
    requiresAuth: 1,
    serviceId: "1",
    schemaType: "test",
}];

export const mrsRouterData: IMrsRouterData[] = [{
    id: 1,
    routerName: "router1",
    address: "localhost",
    productName: "Test product",
    version: "1.0",
    lastCheckIn: "2021-01-01 00:00:00",
    attributes: {},
    options: {},
    active: true,
}];

export const mrsServiceData: IMrsServiceData = {
    enabled: 1,
    published: 0,
    hostCtx: "localhost",
    name: "mrsService1",
    id: "1",
    isCurrent: 1,
    urlContextRoot: "/mrsService1",
    urlHostName: "localhost",
    urlProtocol: "http",
    comments: "Test service",
    options: {},
    authPath: "/auth",
    authCompletedUrl: "http://localhost/authCompleted",
    authCompletedUrlValidation: "http://localhost/authCompleted",
    authCompletedPageContent: "Test content",
    authApps: [],
};

export const mrsContentSetData: IMrsContentSetData[] = [{
    contentType: "test",
    comments: "Test content set",
    enabled: 1,
    hostCtx: "localhost",
    id: "contentSet1",
    requestPath: "/contentSet1",
    requiresAuth: 1,
    serviceId: "1",
    options: {},
}];

export const mrsUserData: IMrsUserData[] = [{
    id: "user1",
    authAppId: "app1",
    name: "Test user",
}];

export const routerServiceData: IMrsRouterService[] = [{
    routerId: 1,
    routerName: "router1",
    address: "localhost",
    routerDeveloper: null,
    serviceId: "1",
    serviceUrlHostName: "localhost",
    serviceUrlContextRoot: "/mrsService1",
    serviceHostCtx: "localhost",
    published: 0,
    inDevelopment: null,
    sortedDevelopers: null,
}];

export const mrsContentFileData: IMrsContentFileData[] = [{
    id: "1",
    contentSetId: "contentSet1",
    requestPath: "/contentSet1",
    requiresAuth: true,
    enabled: 1,
    size: 100,
    contentSetRequestPath: "/contentSet1",
    hostCtx: "localhost",
    changedAt: "2021-01-01 00:00:00",
}];

export type OpenConnectionResponse = { result?: IOpenConnectionData | IStatusData; };

export const webviewProviderMock1: IWebviewProvider = {
    caption: "Webview Provider 1",

    close: jest.fn(),
    runCommand: jest.fn().mockReturnValue(Promise.resolve(true)),
};

export const webviewProviderMock2: IWebviewProvider = {
    caption: "Webview Provider 2",

    close: jest.fn(),
    runCommand: jest.fn().mockReturnValue(Promise.resolve(false)),
};
