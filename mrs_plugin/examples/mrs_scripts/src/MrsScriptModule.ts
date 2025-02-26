/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

/// <reference types="../mrs/mrs.d.ts" />

// Required to enable support for decorators
(Symbol.metadata as any) ??= Symbol("Symbol.metadata");

import { Mrs, SqlError } from "../mrs/mrs.js";
import { renderTestPage } from "./pages/preactTestPage.js";

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
    outputFilePath: "build/MrsScriptModule.js"
})
class MrsScriptModule {

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
        grants: { privileges: "SELECT", schema: "mysql_rest_service_metadata", object: "mrs_user" },
    })
    public static async helloUser(): Promise<IMrsTimedGreeting> {
        const now = new Date();

        const userId: string | undefined = (await getCurrentMrsUserId());

        if (userId != undefined) {
            const userName: string = (await getSession().runSql(
                "SELECT name FROM mysql_rest_service_metadata.mrs_user WHERE id = UNHEX(?)", [userId])
            ).fetchOneObject()?.["name"] as string;

            if (userName === undefined) {
                throw new SqlError("Unable to find the given user.")
            }
            return {
                greeting: `Hello ${userName}!`,
                timeStamp: now.toISOString().replace("T", " ").substring(0, 19),
            };
        }


        return {
            greeting: `Hello anonymous user!`,
            timeStamp: now.toISOString().replace("T", " ").substring(0, 19),
        };
    }

    @Mrs.script({
        requestPath: "/getMrsVersions",
        comments: "Returns the current version of both, the MRS metadata schema and the MRS user schema.",
        grants: [
            { privileges: "SELECT", schema: "mysql_rest_service_metadata", object: "msm_schema_version" },
            { privileges: "SELECT", schema: "mysql_rest_service_metadata", object: "mrs_user_schema_version" },
        ],
    })
    public static async getMrsVersions(): Promise<IMrsSchemaVersions> {
        let versions: IMrsVersion[] = [];

        for (const view of ["schema_version", "mrs_user_schema_version"]) {
            const row = (await getSession().runSql(
                `SELECT major, minor, patch FROM mysql_rest_service_metadata.${view}`)).fetchOneObject();
            if (row !== null) {
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

    @Mrs.script({
        requestPath: "/testPage.html",
        format: "MEDIA",
        mediaType: "text/html",
        requiresAuth: false,
    })
    public static async renderTestPage(): Promise<string> {
        let app = "";
        for (let i = 1; i < 12; i++) {
            app +=
                `<div class="appTile">\n` +
                `    <div class="appIcon"><span>${i}</span></div>\n` +
                `    <div class="appTitle">App ${i}</div>\n` +
                `</div>\n`;
        }

        return '<!DOCTYPE html><html lang="en">\n<head><meta charset="utf-8"><title>Test Page</title>' +
            `<link rel="stylesheet" href="${getContentSetPath('MrsScriptModule')}/static/testPage.css"></head>\n` +
            `<body><div class="appListing">\n${app}</div></body></html>`;
    }

    @Mrs.script({
        requestPath: "/preactTestPage.html",
        format: "MEDIA",
        mediaType: "text/html",
        requiresAuth: false,
    })
    public static async renderPreactTestPage(): Promise<string> {
        const app = renderTestPage("MRS Script User");

        return '<!DOCTYPE html><html lang="en">\n<head><meta charset="utf-8"><title>Test Page</title>' +
            `<link rel="stylesheet" href="${getContentSetPath('MrsScriptModule')}/static/testPage.css"></head>\n` +
            `<body><div id="root">\n${app}</div></body></html>`;
    }
}
