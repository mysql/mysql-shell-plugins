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

import * as child_process from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import * as net from "net";

import { platform, homedir } from "os";
import { currentConnection } from "../communication";
import { appParameters, requisitions } from "../supplement/Requisitions";
import { uuid } from "./helpers";

export type ShellOutputCallback = (output: string) => void;
export type ShellErrorCallback = (error: Error) => void;
export type ShellExitCallback = (code: number) => void;

export type LogLevel = "NONE" | "ERROR" | "WARNING" | "INFO" | "DEBUG" | "DEBUG2" | "DEBUG3";

export interface IShellLaunchDetails {
    // A random port determined while preparing the shell process launch.
    port: number;

    // The token used for single user mode.
    singleUserToken: string;
}

export interface IShellLaunchConfiguration {
    // A path where to look for a shell binary. Can be empty or non-existing.
    rootPath: string;

    // Parameter to be passed to the new shell process.
    parameters: string[];

    // Text to send to the process after it was launched (usually to provide hidden input).
    processInput?: string;

    logLevel: LogLevel;

    // The callback to handle standard output.
    onStdOutData: ShellOutputCallback;

    // The callback to handle data error output. If not specified onStdOutData will be used.
    onStdErrData?: ShellOutputCallback;

    // The callback to handle other error output. If not specified onStdOutData will be used.
    onError?: ShellErrorCallback;

    // The callback to handle the shell exit.
    onExit?: ShellExitCallback;
}

// This class can be used to create new MySQL Shell processes which are managed elsewhere and can
// create one process and manage it. Only usable in a Node.js environment (vscode extension or tests).
export class MySQLShellLauncher {
    /**
     * When the extension is deployed with an embedded MySQL Shell, a custom shell user config dir is used, as
     * defined in the extensionShellUserConfigFolderBaseName constant. If this constant should be changed at some point
     * in the future, it is important to note that the corresponding constant
     * EXTENSION_SHELL_USER_CONFIG_FOLDER_BASENAME in the ShellModuleSession.py file of the gui_plugin needs to be
     * adjusted as well.
     */
    public static readonly extensionShellUserConfigFolderBaseName = "mysqlsh-gui";

    private shellProcess: child_process.ChildProcess | undefined;
    private launchDetails: IShellLaunchDetails = { port: 0, singleUserToken: "" };

    public constructor(private onOutput: ShellOutputCallback, private onError: ShellErrorCallback,
        private onExit?: ShellExitCallback) {
    }

    /**
     * Returns the MySQL Shell configuration directory that should be used for this shell session. That can either be
     * a special extension path or the standard path in the user's home dir.
     *
     * @param rootPath The file system path where to look for a shell binary.
     *
     * @returns The MySQL Shell user config dir as string.
     */
    public static getShellUserConfigDir = (rootPath: string): string => {
        const shellPath = MySQLShellLauncher.getShellPath(rootPath);
        let shellUserConfigDir: string;

        // Check if MySQL Shell is bundled with the extension. Cannot be tested in unit tests.
        // istanbul ignore next
        if (shellPath !== "mysqlsh" && existsSync(shellPath)) {
            // If so, create a dedicated shell user config dir for the shell gui
            if (platform() === "win32") {
                shellUserConfigDir = join(homedir(), "AppData", "Roaming", "MySQL",
                    MySQLShellLauncher.extensionShellUserConfigFolderBaseName);
            } else {
                shellUserConfigDir = join(homedir(), `.${MySQLShellLauncher.extensionShellUserConfigFolderBaseName}`);
            }
        } else {
            // Is there an explicit path (e.g. from unit tests)?
            shellUserConfigDir = appParameters.get("shellUserConfigDir") ?? "";
            if (shellUserConfigDir.length === 0 || !existsSync(shellUserConfigDir)) {
                // If not, use the regular shell user config dir in this case
                if (platform() === "win32") {
                    shellUserConfigDir = join(homedir(), "AppData", "Roaming", "MySQL", "mysqlsh");
                } else {
                    shellUserConfigDir = join(homedir(), ".mysqlsh");
                }
            }
        }

        return shellUserConfigDir;
    };

    /**
     * Starts an instance of the MySQL Shell using the given context. The caller has to take care to manage
     * the return process.
     *
     * @param config Contains the details to set up the shell process.
     *
     * @returns the created process.
     */
    public static runMysqlShell = (config: IShellLaunchConfiguration): child_process.ChildProcess => {

        // Use the MySQL Shell that is available in the given root path - and only if there is no shell, use the one
        // that is installed on the system.
        const shellPath = MySQLShellLauncher.getShellPath(config.rootPath);
        const shellUserConfigDir = MySQLShellLauncher.getShellUserConfigDir(config.rootPath);

        // Print which MySQL Shell is actually used.
        const embedded = shellPath.startsWith(config.rootPath) ? "embedded " : "";
        config.onStdOutData(`Starting ${embedded}MySQL Shell, using config dir '${shellUserConfigDir}' ...`);

        // Ensure the shell user config dir exists. Cannot be tested in unit tests, because the folder is always
        // created before entering here.
        // istanbul ignore next
        if (!existsSync(shellUserConfigDir)) {
            mkdirSync(shellUserConfigDir, { recursive: true });
        }

        // Spawn shell process
        const shellProcess = child_process.spawn(shellPath, config.parameters, {
            /* eslint-disable @typescript-eslint/naming-convention */
            env: {
                ...process.env,
                LOG_LEVEL: config.logLevel,
                MYSQLSH_USER_CONFIG_HOME: shellUserConfigDir,
                MYSQLSH_TERM_COLOR_MODE: "nocolor",
            },
            /* eslint-enable @typescript-eslint/naming-convention */
        });

        // istanbul ignore else
        if (shellProcess.stdin && config.processInput) {
            shellProcess.stdin.setDefaultEncoding("utf-8");
            shellProcess.stdin.write(`${config.processInput}\n`);
            shellProcess.stdin.end();
        }

        // Assign callbacks.
        const stdDataOut = (data: Buffer) => {
            config.onStdOutData(data.toString());
        };
        shellProcess.stdout?.on("data", stdDataOut);

        // istanbul ignore next
        const onError = (error: Error) => {
            // Errors arriving here are directly reflected in test failures. So we don't need to simulate any.
            config.onError?.(new Error(`Error while starting MySQL Shell: ${error.message}`));
        };

        shellProcess.on("error", onError);

        // istanbul ignore if
        if (config.onStdErrData) {
            const stdErrorDataOut = (data: Buffer) => {
                config.onStdErrData?.(data.toString());
            };

            shellProcess.stderr.on("data", stdErrorDataOut);
        } else {
            shellProcess.stderr?.on("data", stdDataOut);
        }

        // istanbul ignore else
        if (config.onExit) {
            shellProcess.on("exit", config.onExit);
        }

        return shellProcess;
    };

    /**
     * Returns the path to the MySQL Shell binary that should be used.
     *
     * The function checks if a MySQL Shell exists under the given root path. If so, the path to that binary is
     * returned. Otherwise it is returns just the name of the mysqlsh executable, assuming that the MySQL Shell is
     * installed and that it is in the PATH.
     *
     * @param rootPath The file system path where to look for a shell binary.
     *
     * @returns The path to the MySQL Shell as string.
     */
    private static getShellPath = (rootPath: string): string => {
        let shellPath = join(rootPath, "shell", "bin", "mysqlsh");

        // istanbul ignore next
        if (platform() === "win32") {
            shellPath += ".exe";
        }

        // Check if MySQL Shell is bundled with the extension.
        // istanbul ignore else
        if (!existsSync(shellPath)) {
            // If not, try to use the mysqlsh installed in the system PATH.
            shellPath = "mysqlsh";
        }

        return shellPath;
    };

    /**
     * Determines an unused TCP/IP port that can be used for a shell process.
     *
     * @returns A promise which resolves to the found port.
     */
    private static findFreePort = (): Promise<number> => {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            let errorEncountered = false;

            // Cannot simulate an error here.
            // istanbul ignore next
            server.on("error", (err) => {
                server.close();

                if (!errorEncountered) {
                    errorEncountered = true;
                    reject(err);
                }
            });

            server.listen(0, () => {
                const address = server.address();

                // istanbul ignore if
                if (!address || typeof address === "string" || address.port === 0) {
                    reject(new Error("Unable to get a port for the backend"));
                } else {
                    server.close();

                    // istanbul ignore else
                    if (!errorEncountered) {
                        errorEncountered = true;
                        resolve(address.port);
                    }
                }
            });

        });
    };

    /**
     * Ends the shell process without disposing of the launcher class. A new process can be started at any time.
     *
     * @returns a promise that resolves when the process signalled its end.
     */
    public exitProcess(): Promise<void> {
        return new Promise((resolve) => {
            // istanbul ignore else
            if (this.shellProcess?.pid) {
                this.shellProcess.on("close", resolve);

                this.shellProcess.kill();
            } else {
                this.shellProcess = undefined;
                this.launchDetails = { port: 0, singleUserToken: "" };

                resolve();
            }
        });
    }

    /**
     * Starts the MySQL Shell gui_plugin webserver in single user mode and connects to the websocket.
     *
     * @param rootPath The path of the extension
     * @param secure If true a secure connection is established (which requires proper SSL certificates).
     * @param logLevel The log level to use initially.
     * @param target If a target URL is specified, the extension connects to that remote shell instead.
     */
    public startShellAndConnect = (rootPath: string, secure: boolean, logLevel: LogLevel = "INFO",
        target?: string): void => {

        // istanbul ignore next
        if (target) {
            const url = new URL(target);
            try {
                currentConnection.connect(new URL(target)).then(() => {
                    this.launchDetails.port = Number(url.port);
                    this.launchDetails.singleUserToken = url.searchParams.get("token") ?? "";

                    void requisitions.execute("connectedToUrl", url);
                }).catch((reason) => {
                    this.onOutput(`Could not establish websocket connection: ${String(reason)}`);
                    void requisitions.execute("connectedToUrl", undefined);
                });
            } catch (e) {
                this.onOutput("Error while parsing the external URL string: " + String(e));
                void requisitions.execute("connectedToUrl", undefined);
            }
        } else {
            MySQLShellLauncher.findFreePort().then((port) => {
                this.launchDetails.singleUserToken = uuid();
                this.launchDetails.port = port;

                const secureString = secure ? "secure={}, " : "";
                const parameters = [
                    "--py",
                    "-e",
                    `gui.start.web_server(port=${this.launchDetails.port}, ${secureString}read_token_on_stdin=True)`,
                ];

                const onOutput = (output: string) => {
                    // If the MySQL Shell web server is running and indicates Single user mode, connect to it
                    if (output.includes("Mode: Single user")) {
                        const protocol = secure ? "https" : "http";
                        const url = new URL(`${protocol}://localhost:${port}/` +
                            `?token=${this.launchDetails.singleUserToken}`);

                        // Connect with a copy of the URL, because the URL will be modified in the connect() call.
                        currentConnection.connect(new URL(url.href)).then(() => {
                            void requisitions.execute("connectedToUrl", url);
                        }).catch(/* istanbul ignore next */(reason) => {
                            // Errors arriving here are directly reflected in test failures.
                            this.onError(new Error(`Could not establish websocket connection: ${String(reason)}`));
                            void requisitions.execute("connectedToUrl", undefined);
                        });
                    }
                    this.onOutput(output);
                };

                this.shellProcess = MySQLShellLauncher.runMysqlShell({
                    rootPath,
                    logLevel,
                    parameters,
                    onStdOutData: onOutput,
                    onError: this.onError,
                    onExit: this.onExit,
                    processInput: this.launchDetails.singleUserToken,
                });
            }).catch(/* istanbul ignore next */(error) => {
                // Errors arriving here are directly reflected in test failures.
                if (error instanceof Error) {
                    this.onError(error);
                } else {
                    this.onError(new Error(String(error)));
                }
            });
        }
    };
}
