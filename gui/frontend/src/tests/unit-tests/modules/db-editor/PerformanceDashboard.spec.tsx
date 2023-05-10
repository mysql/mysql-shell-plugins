/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import { mount } from "enzyme";

import { MySQLConnectionScheme } from "../../../../communication/MySQL";

import { ISavedGraphData } from "../../../../modules/db-editor";
import { PerformanceDashboard } from "../../../../modules/db-editor/PerformanceDashboard";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { webSession } from "../../../../supplement/WebSession";
import { sleep } from "../../../../utilities/helpers";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher";
import { getDbCredentials, ITestDbCredentials, setupShellForTests } from "../../test-helpers";

describe("PerformanceDashboard Tests", (): void => {
    let launcher: MySQLShellLauncher;
    let credentials: ITestDbCredentials;
    let testConnection: IConnectionDetails;
    let backend: ShellInterfaceSqlEditor;

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG2");

        // Create a connection for our tests.
        credentials = getDbCredentials();
        testConnection = {
            id: -1,

            dbType: DBType.MySQL,
            caption: "PerformanceDashboard Test Connection 1",
            description: "PerformanceDashboard Test Connection",
            options: {
                scheme: MySQLConnectionScheme.MySQL,
                user: credentials.userName,
                password: credentials.password,
                host: credentials.host,
                port: credentials.port,
            },
            useSSH: false,
            useMDS: false,

        };

        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, "") ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);

        backend = new ShellInterfaceSqlEditor();
    }, 20000);

    afterAll(async () => {
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, testConnection.id);
        await launcher.exitProcess();
    });

    it("Test PerformanceDashboard instantiation", async () => {
        try {
            await backend.startSession("dashboard1");

            const graphData: ISavedGraphData = {
                timestamp: new Date().getTime(),
                activeColorScheme: "grays",
                displayInterval: 300,
                currentValues: new Map(),
                computedValues: {},
                series: new Map(),
            };

            const component = mount<PerformanceDashboard>(
                <PerformanceDashboard
                    backend={backend}
                    graphData={graphData}
                    toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
                />,
            );

            await sleep(4000);

            // Note: we cannot do snapshot testing here, because graph data contains always changing timestamps.

            const props = component.props();
            expect(props.graphData.displayInterval).toBe(300);
            expect(props.graphData.series.size).toBe(6);
            expect(Object.values(props.graphData.computedValues).length).toBeGreaterThan(35);

            component.unmount();
        } finally {
            await backend.closeSession();
        }
    });
});
