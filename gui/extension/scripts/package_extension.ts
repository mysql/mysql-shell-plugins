/*
 * Copyright (c) 2025 Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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

import { spawnSync } from "child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "fs";
import { platform } from "os";
import { join, resolve } from "path";

class Logger {

    public static success = (message: string): void => {
        console.log(`[OK] ${message}`);
    };

    public static info = (message: string): void => {
        process.stdout.write(`[INF] ${message}`);
    };

    public static done = (): void => {
        console.log("DONE");
    };

}

const executeTask = (cmd: string, args: string[], message: string): void => {
    Logger.info(message);
    spawnSync(cmd, args, { stdio: "inherit" });
    Logger.done();
};

const shellPluginsFolder = resolve(process.cwd(), "../..");
const shellPluginsGuiFolder = join(shellPluginsFolder, "gui");
const frontEndFolder = join(shellPluginsGuiFolder, "frontend");
const extensionFolder = join(shellPluginsGuiFolder, "extension");
const buildFolder = join(frontEndFolder, "build");
const guiPluginBackend = join(shellPluginsGuiFolder, "backend", "gui_plugin");
const mrsPluginPath = join(extensionFolder, "shell", "lib", "mysqlsh", "plugins", "mrs_plugin");
const mdsPluginPath = join(extensionFolder, "shell", "lib", "mysqlsh", "plugins", "mds_plugin");
const msmPluginPath = join(extensionFolder, "shell", "lib", "mysqlsh", "plugins", "msm_plugin");
const guiPluginPath = join(extensionFolder, "shell", "lib", "mysqlsh", "plugins", "gui_plugin");
const utilPluginPath = join(extensionFolder, "shell", "lib", "mysqlsh", "plugins", "util_plugin");
const webRootPath = join(extensionFolder, "shell", "lib", "mysqlsh", "plugins", "gui_plugin", "core", "webroot");

if (!process.env.SHELL_PLUGINS_DEPS) {
    throw new Error(`Please define the env var SHELL_PLUGINS_DEPS (Location folder of shell and router)`);
}

const shellPluginDeps = readdirSync(process.env.SHELL_PLUGINS_DEPS);

let shellLocation = shellPluginDeps.find((el: string) => {
    return el.includes("mysql-shell");
});
shellLocation = join(process.env.SHELL_PLUGINS_DEPS, shellLocation!);

let routerLocation = shellPluginDeps.find((el: string) => {
    return el.includes("mysql-router");
});
routerLocation = join(process.env.SHELL_PLUGINS_DEPS, routerLocation!);

if (!shellLocation) {
    throw new Error(`Could not find Shell`);
} else {
    Logger.success(`Using shell folder: ${shellLocation}`);
}

if (!routerLocation) {
    throw new Error(`Could not find Router`);
} else {
    Logger.success(`Using router folder: ${routerLocation}`);
}

process.chdir(frontEndFolder);
Logger.info(`Clearing the environment...`);
rmSync("build", { recursive: true, force: true });
rmSync("node_modules", { recursive: true, force: true });
rmSync("package-lock.json", { force: true });
Logger.done();

executeTask("npm", ["install"], "Installing node modules...");

if (platform() === "win32") {
    executeTask("npm", ["run", "build-win"], "Building the frontend...");
} else {
    executeTask("npm", ["run", "build"], "Building the frontend...");
}

Logger.info("Removing shell ...");
rmSync(join(extensionFolder, "shell"), { recursive: true, force: true });
Logger.done();
Logger.info("Bundling shell ...");
cpSync(shellLocation, join(extensionFolder, "shell"), { recursive: true });
Logger.done();

Logger.info("Removing router ...");
rmSync(join(extensionFolder, "router"), { recursive: true, force: true });
Logger.done();
Logger.info("Bundling router ...");
cpSync(shellLocation, join(extensionFolder, "router", "bin"), { recursive: true });
cpSync(shellLocation, join(extensionFolder, "router", "lib"), { recursive: true });
Logger.done();

Logger.info("Adding MRS plugin...");
rmSync(mrsPluginPath, { recursive: true, force: true });
cpSync(join(shellPluginsFolder, "mrs_plugin"), mrsPluginPath, { recursive: true });
Logger.done();

Logger.info("Adding MDS plugin...");
rmSync(mdsPluginPath, { recursive: true, force: true });
cpSync(join(shellPluginsFolder, "mds_plugin"), mdsPluginPath, { recursive: true });
Logger.done();

Logger.info("Adding MSM plugin...");
rmSync(msmPluginPath, { recursive: true, force: true });
cpSync(join(shellPluginsFolder, "msm_plugin"), msmPluginPath, { recursive: true });
Logger.done();

Logger.info("Adding UTIL plugin...");
rmSync(utilPluginPath, { recursive: true, force: true });
cpSync(join(shellPluginsFolder, "util_plugin"), utilPluginPath, { recursive: true });
Logger.done();

Logger.info("Adding GUI plugin (BE)...");
rmSync(guiPluginPath, { recursive: true, force: true });
cpSync(guiPluginBackend, guiPluginPath, { recursive: true });
Logger.done();

Logger.info("Adding GUI plugin (FE)...");
rmSync(webRootPath, { recursive: true, force: true });
mkdirSync(webRootPath);
cpSync(buildFolder, webRootPath, { recursive: true });
Logger.done();

process.chdir(extensionFolder);
Logger.info("Clearing the extension environment...");
rmSync("node_modules", { force: true, recursive: true });
rmSync("package-lock.json", { force: true });
Logger.done();

executeTask("npm", ["install"], "Installing the extension node modules...");
executeTask("npm", ["run", "build-dev-package"], "Building the extension...");

