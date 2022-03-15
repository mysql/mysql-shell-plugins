/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

/* cspell: disable */

import { platform, homedir } from "os";
import { join } from "path";
import { spawn, ChildProcess } from "child_process";
import { promises as fsPromises } from "fs";
import { WebDriver } from "selenium-webdriver";

export const startServer = async (driver: WebDriver,
    port: number, token: string | undefined): Promise<ChildProcess> => {
    const params = ["--py", "-e"];

    if (token) {
        params.push(`gui.start.web_server(port=${port}, single_instance_token="${token}")`);
    } else {
        params.push(`gui.start.web_server(port=${port})`);
    }

    const prc = spawn("mysqlsh", params, {
        env: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            MYSQLSH_USER_CONFIG_HOME: join(homedir(), port.toString()),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            PATH: process.env.PATH,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            NODE_ENV: "test",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            PUBLIC_URL: "",
        },
    });

    let savedOutput = "";
    prc.stdout.on("data", (data) => {
        savedOutput += String(data);
    });

    await driver.wait( () => {
        return savedOutput.indexOf("Mode:") !== -1;
    }, 5000, "Server was not started in 5 seconds" );

    return prc;
};


export const createUser = async (port: number, user: string, password: string, role: string): Promise<void> => {
    const params = ["--", "gui", "users", "create-user", user, password, role];

    const prc = spawn("mysqlsh", params, {
        env: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            MYSQLSH_USER_CONFIG_HOME: join(homedir(), port.toString()),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            PATH: process.env.PATH,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            NODE_ENV: "test",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            PUBLIC_URL: "",
        },
    });

    let savedOutput = "";

    const prom = async (): Promise<string> => {
        return new Promise( (resolve, reject) => {
            prc.stdout.on("data", (data) => {
                savedOutput += String(data);
            });

            prc.stderr.on("data", (data) => {
                reject(String(data));
            });

            prc.on("close", () => {
                resolve(savedOutput);
            });
        });
    };

    const result = await prom();
    const json = JSON.parse(result);

    if (json.request_state.msg === "User created successfully.") {
        return new Promise( (resolve) => { resolve(); });
    } else {
        return new Promise( (resolve, reject) => { reject(json.request_state.msg); });
    }
};

export const cleanDataDir = async (port: number): Promise<void> => {
    const path = join(homedir(), port.toString());
    await fsPromises.rmdir(path, { recursive: true });
};

export const setupServerFolder = async (port: number): Promise<string> => {
    const toCreatePath = join(homedir(), port.toString());
    let guiPluginPath;
    let type;

    if (platform() === "win32") {
        guiPluginPath = join(homedir(), "AppData", "Roaming", "Mysql", "mysqlsh", "plugins", "gui_plugin");
        type = "junction";
    } else {
        guiPluginPath = join(homedir(), ".mysqlsh", "plugins", "gui_plugin");
        type = "file";
    }

    await fsPromises.mkdir(toCreatePath);
    const pluginsFolder = join(toCreatePath, "plugins");
    await fsPromises.mkdir(pluginsFolder);
    await fsPromises.symlink(guiPluginPath, join(pluginsFolder, "gui_plugin"), type);

    return toCreatePath;
};


