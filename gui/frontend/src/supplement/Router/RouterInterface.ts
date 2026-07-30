/*
 * Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

    private httpsRequest = <T = void>(_method: "GET" | "PUT", _path: string,
        _body: unknown = undefined): Promise<T> => {
        return Promise.reject(new Error("MySQL Router controls are unavailable while MRS support is deferred."));
    };

    private get = async <T>(path: string): Promise<T> => {
        return await this.httpsRequest<T>("GET", path);
    };

    private put = async (path: string, data: unknown = undefined): Promise<void> => {
        await this.httpsRequest("PUT", path, data);
    };

}
