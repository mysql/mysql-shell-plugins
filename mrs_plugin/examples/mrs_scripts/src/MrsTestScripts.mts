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

// Required to enable support for decorators
(Symbol.metadata as any) ??= Symbol("Symbol.metadata");

import { Mrs, runSql, SqlError } from "../mrs/mrs.mjs";

export interface IMrsGreeting {
    greeting: string;
}

export interface IMrsTimedGreeting extends IMrsGreeting {
    timeStamp: string;
}

export interface IMrsTestPerson {
    name: string;
    salutation: string;
    birthYear: number;
    info?: string;
    version?: IMrsVersion;
}

export interface IMrsVersion {
    major: number;
    minor: number;
    patch: number;
}

export interface IMrsSchemaVersions {
    metadata: IMrsVersion,
    userSchema: IMrsVersion,
    supportedVersions: IMrsVersion[],
}

export @Mrs.module({
    comments: "This REST module contains several test scripts.",
    requestPath: "/testScripts",
})
class mrsTestScripts {

    @Mrs.script({
        requestPath: "/helloWorld",
        requiresAuth: false,
    })
    public static async helloWorld(): Promise<string> {
        return "Hello world!";
    }

    @Mrs.script({
        requestPath: "/getTestData",
        requiresAuth: false,
    })
    public static async getTestData(name: string, salutation = "Mr.", age?: number,
        info?: string[]): Promise<IMrsTestPerson[]> {
        const now = new Date();

        if (!age) {
            age = Math.floor(Math.random() * (90 - 18 + 1) + 18);
        }

        return [{
            name,
            salutation,
            birthYear: now.getFullYear() - age,
            info: info?.join("\n"),
        },
        {
            name: `${name}\`s friend`,
            salutation: "Mrs.",
            birthYear: 1975,
        }];
    }

    @Mrs.script({
        requestPath: "/helloUser",
        comments: "A simple test script that returns a personalized greeting and a timestamp.",
        rowOwnershipParameter: "userId",
    })
    public static async helloUser(userId: string): Promise<IMrsTimedGreeting> {
        const now = new Date();

        const userName: string = (await runSql(
            "SELECT name FROM mysql_rest_service_metadata.mrs_user WHERE id = ?", [userId])
        ).at(0)?.["name"] as string;
        if (userName === undefined) {
            throw new SqlError("Unable to find the given user.")
        }

        return {
            greeting: `Hello ${userName}!`,
            timeStamp: now.toISOString().replace("T", " ").substring(0, 19),
        };
    }

    @Mrs.script({
        requestPath: "/getMrsVersions",
        comments: "Returns the current version of both, the MRS metadata schema and the MRS user schema.",
    })
    public static async getMrsVersions(): Promise<IMrsSchemaVersions> {
        let versions: IMrsVersion[] = [];

        for (const view of ["schema_version", "mrs_user_schema_version"]) {
            const res = await runSql(`SELECT major, minor, patch FROM mysql_rest_service_metadata.${view}`);
            if (res?.length > 0) {
                const row = res[0];

                versions.push({
                    major: row["major"] as number,
                    minor: row["minor"] as number,
                    patch: row["patch"] as number,
                });
            } else {
                throw new SqlError(`Unable to get the MRS version from ${view}.`)
            }
        }

        return {
            metadata: versions[0],
            userSchema: versions[1],
            supportedVersions: [versions[0]],
        }
    };
}