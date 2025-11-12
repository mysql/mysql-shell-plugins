/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import * as https from "https";

export class RouterInterface {

    private port: number;

    public constructor(port: number) {
        this.port = port;
    }

    public getDebug = async (service: string) : Promise<boolean> => {
        return this.get<boolean>(`${service}/_debug`);
    };

    public setDebug = async (service: string, enabled: boolean) : Promise<void> => {
        await this.put(`${service}/_debug`, { enabled });
    };

    private createRequest = (method: string, path: string) => {
        const result = {
            hostname: "localhost",
            port: this.port,
            path,
            method,
            rejectUnauthorized: false,
            headers: {
                "Content-Type": "application/json"
            },
        };

        return result;
    };

    /**
     * Makes an HTTPS request to the router and parses JSON response.
     *
     * @param method the HTTP method to use
     * @param path the path for the router REST API
     * @param body the body payload
     * @returns Promise<any> The parsed JSON response
     */
    private httpsRequest = <T = void>(method: string, path: string, body: unknown = undefined): Promise<T> => {
        return new Promise((resolve, reject) => {
            const options = this.createRequest(method, path);

            if (body !== undefined) {
                (options.headers as Record<string, string>)["Content-Length"] =
                    Buffer.byteLength(JSON.stringify(body)).toString();
            }

            const req = https.request(options, (res) => {
                let data = "";

                res.on("data", (chunk: Buffer) => {
                    data += chunk.toString();
                });

                res.on("end", () => {
                    try {
                        if (data == "") {
                            resolve(undefined as T);

                            return;
                        }

                        // If the response is not JSON, you may need to adjust parsing logic.
                        resolve(JSON.parse(data) as T);
                    } catch (e) {
                        if (e instanceof Error) {
                            reject(e);
                        } else {
                            reject(new Error(String(e)));
                        }
                    }
                });
            });

            if (body !== undefined) {
                req.write(JSON.stringify(body));
            }

            req.on("error", (err) => {
                reject(err);
            });

            req.end();
        });
    };

    private get = async <T>(path: string): Promise<T> => {
        return await this.httpsRequest<T>("GET", path);
    };

    private put = async (path: string, data: unknown = undefined): Promise<void> => {
        await this.httpsRequest("PUT", path, data);
    };

    private post = async (path: string, data: unknown = undefined): Promise<void> => {
        await this.httpsRequest("POST", path, data);
    };
}