/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

import { createRef } from "preact";
import keyboardKey from "keyboard-key";

import { mount } from "enzyme";
import {
    getDbCredentials, JestReactWrapper, sendKeyPress, setupShellForTests,
} from "../../../test-helpers";
import { IMrsDbObjectEditRequest } from "../../../../../supplement/Requisitions";
import { IMrsServiceData } from "../../../../../communication/ProtocolMrs";
import { MrsHub } from "../../../../../modules/mrs/MrsHub";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { MySQLShellLauncher } from "../../../../../utilities/MySQLShellLauncher";
import { ShellInterface } from "../../../../../supplement/ShellInterface/ShellInterface";
import { webSession } from "../../../../../supplement/WebSession";
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../../communication/MySQL";
import { IConnectionDetails, DBType } from "../../../../../supplement/ShellInterface";
import { sleep } from "../../../../../utilities/helpers";

describe("MrsHub Tests", () => {
    let host: JestReactWrapper;

    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;

    let service: IMrsServiceData;

    const hubRef = createRef<MrsHub>();

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG2");

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

        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, "unit-tests") ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);

        backend = new ShellInterfaceSqlEditor();
        await backend.startSession("mrsHubTests");
        await backend.openConnection(testConnection.id);

        // Some preparation for the tests.
        await backend.execute("DROP DATABASE IF EXISTS mysql_rest_service_metadata");
        await backend.execute("DROP DATABASE IF EXISTS MRS_TEST");
        await backend.execute("CREATE DATABASE MRS_TEST");
        await backend.execute("CREATE TABLE MRS_TEST.actor (actor_id INT NOT NULL, first_name VARCHAR(45) NOT NULL, " +
            "last_name VARCHAR(45) NOT NULL, last_update TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY " +
            "(actor_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

        await backend.mrs.configure();
        service = await backend.mrs.addService("/mrs", ["HTTPS"], "", "", true, {}, "/unit-tests", "", "", "", []);
        const schemaId = await backend.mrs.addSchema(service.id, "MRS_TEST", "/mrs-test", false, null, null);
        await backend.mrs.addDbObject("actor", "TABLE", false, "/actor", true, ["READ"], "FEED",
            false, false, false, null, null, undefined, schemaId);

        host = mount<MrsHub>(<MrsHub ref={hubRef} />);
    });

    afterAll(async () => {
        await backend.execute("DROP DATABASE IF EXISTS mysql_rest_service_metadata");
        await backend.execute("DROP DATABASE IF EXISTS MRS_TEST");
        await backend.closeSession();
        await launcher.exitProcess();
        host.unmount();
    });

    it("Standard Rendering (snapshot)", () => {
        // The host itself has no properties, but implicit children (the different dialogs).
        expect(host.props().children).toEqual([]);
        expect(host).toMatchSnapshot();
    });

    it("Show MRS Service Dialog (snapshot)", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const promise = hubRef.current!.showMrsServiceDialog(backend);
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();

        setTimeout(() => {
            sendKeyPress(keyboardKey.Escape);
        }, 250);

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

    it("Show MRS Schema Dialog (snapshot)", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const promise = hubRef.current!.showMrsSchemaDialog(backend);
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();

        setTimeout(() => {
            sendKeyPress(keyboardKey.Escape);
        }, 250);

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

    it("Show MRS DB Object Dialog (snapshot)", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const title = "Enter Configuration Values for the New MySQL REST Object";
        const schemas = await backend.mrs.listSchemas();
        const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
        const dialogRequest: IMrsDbObjectEditRequest = {
            id: "mrsDbObjectDialog",
            title,
            dbObject: dbObjects[0],
            createObject: false,
        };

        const promise = hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();

        setTimeout(() => {
            sendKeyPress(keyboardKey.Escape);
        }, 250);

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

    it("Show MRS Content Set Dialog (snapshot)", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const promise = hubRef.current!.showMrsContentSetDialog(backend);
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();

        setTimeout(() => {
            sendKeyPress(keyboardKey.Escape);
        }, 250);

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

    it("Show MRS Authentication App Dialog (snapshot)", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const promise = hubRef.current!.showMrsAuthAppDialog(backend);
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();

        setTimeout(() => {
            sendKeyPress(keyboardKey.Escape);
        }, 250);

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

    it("Show MRS User Dialog (snapshot)", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const authAppData = {
            enabled: true,
            limitToRegisteredUsers: true,
            defaultRoleId: null,
            serviceId: service.id,
        };

        const promise = hubRef.current!.showMrsUserDialog(backend, authAppData);
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();

        setTimeout(() => {
            sendKeyPress(keyboardKey.Escape);
        }, 250);

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);
    });

});
