/* eslint-disable @typescript-eslint/restrict-template-expressions */
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

import { MessageScheduler } from "../../../../communication/MessageScheduler";
import { ShellInterfaceMrs } from "../../../../supplement/ShellInterface";
import { WebSocketServer } from "ws";
import { createServer, Server } from "http";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher";
import { ShellAPIMrs } from "../../../../communication";

describe("ShellInterfaceMrs Tests", (): void => {
    let webServer: Server;
    let webServerPort: number;

    const startServer = async (port: number): Promise<Server> => {
        const server = createServer();

        const wss = new WebSocketServer({ server });

        wss.on("connection", (ws) => {
            ws.on("message", (msgData) => {
                const data = JSON.parse(String(msgData));
                let jsonStr: string | undefined;

                if (data.command === ShellAPIMrs.MrsStatus) {
                    jsonStr = `{
                        "request_state": {"type": "OK", "msg": ""},
                        "request_id": "${data.request_id}",
                        "result": {"service_configured": true, "service_count": 2, "service_enabled": true}}`;
                } else if (data.command === ShellAPIMrs.MrsListServices) {
                    jsonStr = `{
                        "request_state": {"type": "OK", "msg": ""},
                        "request_id": "${data.request_id}",
                        "result": [
                            {"auth_completed_page_content": "", "auth_completed_url": "",
                            "auth_completed_url_validation": "",
                            "auth_path": "/authentication", "comments": "", "enabled": 1, "host_ctx": "/mrs", "id": 3,
                            "is_default": 1, "options": ` +
                        `"{\\"header\\": {\\"Access-Control-Allow-Origin\\": \\"*\\", ` +
                        `\\"Access-Control-Allow-Methods\\": \\"GET, POST, PUT, DELETE, OPTIONS\\"}}", ` +
                        `"url_context_root": "/mrs", "url_host_name": "", "url_protocol": ["HTTP", "HTTPS"]}]}`;
                } else if (data.command === ShellAPIMrs.MrsConfigure ||
                    data.command === ShellAPIMrs.MrsAddService ||
                    data.command === ShellAPIMrs.MrsUpdateService ||
                    data.command === ShellAPIMrs.MrsDeleteService ||
                    data.command === ShellAPIMrs.MrsAddSchema ||
                    data.command === ShellAPIMrs.MrsUpdateSchema ||
                    data.command === ShellAPIMrs.MrsDeleteSchema) {
                    jsonStr = `{
                        "request_state": {"type": "OK", "msg": ""},
                        "request_id": "${data.request_id}",
                        "result": {}}`;
                } else if (data.command === ShellAPIMrs.MrsListSchemas) {
                    jsonStr = `{
                        "request_state": {"type": "OK", "msg": ""},
                        "request_id": "${data.request_id}",
                        "result": [
                            {"comments": "", "enabled": 1, "host_ctx": "/mrs", "id": 3, "items_per_page": 25,
                            "name": "sakila", "options": null, "request_path": "/sakila", "requires_auth": 0,
                            "service_id": 2}]}`;
                }

                if (jsonStr !== undefined) {
                    ws.send(jsonStr);
                }
            });
        });

        return new Promise((resolve) => {
            server.listen(port, () => { resolve(server); });
        });

    };

    beforeAll(async () => {
        // Find free port
        webServerPort = await MySQLShellLauncher.findFreePort();

        // Start server
        webServer = await startServer(webServerPort);
    });

    afterAll(() => {
        webServer.close();
    });

    it("Test MRS Service functions", async () => {

        const mrs = new ShellInterfaceMrs();

        try {
            await MessageScheduler.get.connect(new URL(`http://localhost:${webServerPort}`), "");

            await mrs.configure();

            const status = await mrs.status();
            expect(status).toEqual({
                serviceConfigured: true,
                serviceCount: 2,
                serviceEnabled: true,
            });

            const services = await mrs.listServices();
            expect(services).toEqual([{
                authCompletedPageContent: "",
                authCompletedUrl: "",
                authCompletedUrlValidation: "",
                authPath: "/authentication",
                comments: "",
                enabled: 1,
                hostCtx: "/mrs",
                id: 3,
                isDefault: 1,
                options: "{\"header\": {\"Access-Control-Allow-Origin\": \"*\", \"Access-Control-Allow-Methods\": " +
                    "\"GET, POST, PUT, DELETE, OPTIONS\"}}",
                urlContextRoot: "/mrs",
                urlHostName: "",
                urlProtocol: [
                    "HTTP",
                    "HTTPS",
                ],
            }]);

            const service = await mrs.addService("/mrs2", ["HTTPS"], "", "", false,
                {}, "", "", "", "", []);

            await mrs.updateService(service.id, "/mrs2", "", {
                urlProtocol: ["HTTPS"],
                enabled: false,
                comments: "",
                options: {},
                authPath: "",
                authCompletedUrl: "",
                authCompletedUrlValidation: "",
                authCompletedPageContent: "",
                parameters: [],
            });

            await mrs.deleteService(service.id);

            MessageScheduler.get.disconnect();
        } catch (error) {
            console.log(`MessageScheduler Error: ${String(error)}`);
            throw error;
        }
    });

    it("Test MRS Schema functions", async () => {

        const mrs = new ShellInterfaceMrs();

        try {
            await MessageScheduler.get.connect(new URL(`http://localhost:${webServerPort}`), "");

            const services = await mrs.listSchemas("0x02");
            expect(services).toEqual([{
                comments: "",
                enabled: 1,
                hostCtx: "/mrs",
                id: 3,
                itemsPerPage: 25,
                name: "sakila",
                options: null,
                requestPath: "/sakila",
                requiresAuth: 0,
                serviceId: 2,
            }]);

            await mrs.addSchema("0x01", "sakila", "/sakila", true, {}, 25, "");
            await mrs.updateSchema("0x01", "sakila", "/sakila", true, true, 25, "", {});
            await mrs.deleteSchema("0x01", "0x01");

            MessageScheduler.get.disconnect();
        } catch (error) {
            console.log(`MessageScheduler Error: ${String(error)}`);
            throw error;
        }
    });
});
