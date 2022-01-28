/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
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

import { By, until } from "selenium-webdriver";
import {
    getDB,
    getProfile,
    openProfileMenu,
    setProfilesToRemove,
} from "./helpers";
import { platform, homedir } from "os";
import { join } from "path";
import getInstances from "mysql-promise";
import RunMySqlFile from "run-my-sql-file";
import { spawn } from "child_process";
import { promises as fsPromises } from "fs";

export async function removeDB(driver, name) {
    const host = await getDB(driver, name);
    await driver.executeScript(
        "arguments[0].click();",
        await host.findElement(By.id("triggerTileAction")),
    );
    const contextMenu = await driver.wait(
        until.elementLocated(By.css(".noArrow.menu")),
        2000,
        "No context menu found",
    );
    expect(contextMenu).toBeDefined();
    await driver.executeScript(
        "arguments[0].click();",
        await contextMenu.findElement(By.id("remove")),
    );
    const dialog = await driver.findElement(By.css(".confirmDialog"));
    expect(dialog).toBeDefined();
    await driver.executeScript(
        "arguments[0].click();",
        await dialog.findElement(By.id("accept")),
    );
}

export async function deleteProfiles(driver, profiles) {
    await driver.executeScript(
        "arguments[0].click()",
        await driver.findElement(By.id("sessions")),
    );
    await (await getProfile(driver, "Default")).click();
    const menu = await openProfileMenu(driver);
    await menu.findElement(By.id("delete")).click();
    const dialog = await driver.findElement(By.css(".valueEditDialog"));
    await setProfilesToRemove(driver, profiles);
    await dialog.findElement(By.id("ok")).click();
    const confirmDialog = await driver.findElement(By.css(".confirmDialog"));
    await confirmDialog.findElement(By.id("accept")).click();
}

export async function execMySQL(connection, queryToExec) {
    const db = getInstances();
    await db.configure({
        host: connection.hostname,
        user: connection.username,
        password: connection.password,
    });

    await db.query(queryToExec);
    await db.end();
}

export async function checkMySQLRunning() {
    const db = getInstances();
    await db.configure({
        host: __DBHOSTNAME__,
        user: __DBUSERNAME__,
        password: __DBPASSWORD__,
        port: __DBPORT__,
        insecureAuth: true,
    });

    try {
        await db.getConnection();
        await db.end();

        return new Promise((resolve) => {return resolve();});
    } catch (e) {
        return new Promise((resolve, reject) => {return reject(e);});
    }
}

export async function checkEnv() {
    return new Promise(function (resolve, reject) {
        if (!__DBHOSTNAME__ || !__DBUSERNAME__ || !__DBPASSWORD__ || !__DBPORT__) {
            reject(
                "Please define all environment variables (DBHOSTNAME/DBUSERNAME/DBPASSWORD/DBPORT)",
            );
        } else {
            resolve();
        }
    });
}

export async function checkMySQLEnv() {
    const execFile = async (file) =>
    {return new Promise(function (resolve, reject) {
        RunMySqlFile.connectionOptions({
            host: __DBHOSTNAME__,
            user: __DBUSERNAME__,
            password: __DBPASSWORD__,
            port: __DBPORT__,
        });
        RunMySqlFile.runFile(join("src", "tests", "e2e", "sql", file), (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });};

    const db = getInstances();

    db.configure({
        host: __DBHOSTNAME__,
        user: __DBUSERNAME__,
        password: __DBPASSWORD__,
        port: __DBPORT__,
        insecureAuth: true,
    });

    await db.query("show databases;").spread(async (rows) => {
        let sakila;
        let world_x = false;
        for (let i = 0; i <= rows.length - 1; i++) {
            if (rows[i].Database === "sakila") {
                sakila = true;
            } else if (rows[i].Database === "world_x_cst") {
                world_x = true;
            }
        }
        if (!sakila) {
            await execFile("sakila.sql");
        }
        if (!world_x) {
            await execFile("world_x_cst.sql");
        }
    });

    await db.end();
}

export async function startServer() {
    const params = [
        "--py",
        "-e",
        `gui.start.web_server(port=8000, single_instance_token="1234test")`,
    ];

    const prc = spawn("mysqlsh", params);

    const serverToStart = async () => {return new Promise(function(resolve, reject){
        prc.stderr.on("data", function(data){
            reject(data.toString());
        });
        prc.stdout.on("data", function(data){
            if(data.toString().indexOf("Mode: Single user [token=1234test]") !== -1){
                resolve();
            }
        });
    });};

    await serverToStart();

    return prc;
}

export async function cleanDataDir(){
    let path;
    if(platform() === "win32"){
        path = join(homedir(), "AppData", "Roaming", "Mysql", "mysqlshell", "plugin_data", "gui_plugin");
    }
    else if(platform() === "darwin"){
        path = join(homedir(), ".mysqlsh", "plugin_data", "gui_plugin");
    }
    const files = await fsPromises.readdir(path);

    for(const file of files){
        if( (await fsPromises.lstat(join(path, file))).isDirectory() ){
            await fsPromises.rmdir(join(path, file), { recursive: true });
        }
        else{
            await fsPromises.unlink(join(path, file));
        }
    }
}
