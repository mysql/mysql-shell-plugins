/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

export class Cookies {
    public set(name: string, value?: string): void {
        let cookie = "";
        cookie = `${name}=${value ?? ""}`;

        // istanbul ignore else
        if (typeof document !== "undefined") {
            document.cookie = cookie;
        }
    }

    public get(name: string): string | null {
        // istanbul ignore if
        if (typeof document === "undefined" || !document.cookie) {
            return null;
        }

        const cookie = document.cookie.split(";").find((item) => {
            return item.split("=")[0].trim() === name;
        });

        if (cookie) {
            const parts = cookie.split("=");
            if (parts.length === 1) {
                return parts[0];
            }

            return parts[1].trim();
        }

        return null;
    }

    public remove(name: string): void {
        // istanbul ignore else
        if (typeof document !== "undefined") {
            document.cookie = name + "=; Max-Age=0;";
        }
    }

    public clear(): void {
        // istanbul ignore else
        if (typeof document !== "undefined") {
            for (const cookie of document.cookie.split(";")) {
                this.remove(cookie.split("=")[0].trim());
            }
        }
    }
}
