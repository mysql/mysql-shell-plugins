/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

// ATTENTION: keep the namespace imports or vite will report weird errors!

import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import * as os from "os";

import { requisitions } from "../supplement/Requisitions.js";
import { appParameters } from "../supplement/AppParameters.js";
import { uuid } from "./helpers.js";
import { MessageScheduler } from "../communication/MessageScheduler.js";
import { findExecutable } from "./file-utilities.js";

type ShellOutputCallback = (output: string) => void;
type ShellErrorCallback = (error: Error) => void;
type ShellExitCallback = (code: number) => void;

export type LogLevel = "NONE" | "ERROR" | "WARNING" | "INFO" | "DEBUG" | "DEBUG2" | "DEBUG3";

interface IShellLaunchDetails {
    /** A random port determined while preparing the shell process launch. */
    port: number;

    /** The token used for single user mode. */
    singleUserToken: string;
}

export interface IShellLaunchConfiguration {
    /** A path where to look for a shell binary. Can be empty or non-existing. */
    rootPath: string;

    inDevelopment: boolean;

    /** Parameter to be passed to the new shell process. */
    parameters: string[];

    /** Text to send to the process after it was launched (usually to provide hidden input). */
    processInput?: string;

    logLevel: LogLevel;

    /** The callback to handle standard output. */
    onStdOutData: ShellOutputCallback;

    /** The callback to handle data error output. If not specified onStdOutData will be used. */
    onStdErrData?: ShellOutputCallback;

    /** The callback to handle other error output. If not specified onStdOutData will be used. */
    onError?: ShellErrorCallback;

    /** The callback to handle the shell exit. */
    onExit?: ShellExitCallback;
}

/**
 * This class can be used to create new MySQL Shell processes which are managed elsewhere and can
 * create one process and manage it. Only usable in a Node.js environment (VS Code extension or tests).
 */
export class MySQLShellLauncher {
    /**
     * When the extension is deployed with an embedded MySQL Shell, a custom shell user config dir is used, as
     * defined in the extensionShellUserConfigFolderBaseName constant. If this constant should be changed at some point
     * in the future, it is important to note that the corresponding constant
     * EXTENSION_SHELL_USER_CONFIG_FOLDER_BASENAME in the ShellModuleSession.py file of the gui_plugin needs to be
     * adjusted as well.
     */
    public static readonly extensionShellUserConfigFolderBaseName = "mysqlsh-gui";

    private shellProcess: cp.ChildProcess | undefined;
    private launchDetails: IShellLaunchDetails = { port: 0, singleUserToken: "" };

    public constructor(private onOutput: ShellOutputCallback, private onError: ShellErrorCallback,
        private onExit?: ShellExitCallback) {
    }

    /**
     * Returns the MySQL Shell configuration directory that should be used for this shell session. That can either be
     * a special extension path or the standard path in the user's home dir.
     *
     * @param inDevelopment True if we are running in development mode.
     *
     * @returns The MySQL Shell user config dir as string.
     */
    public static getShellUserConfigDir = (inDevelopment: boolean): string => {
        let shellUserConfigDir: string;

        // If the environment var MYSQLSH_GUI_CUSTOM_CONFIG_DIR is set, use that directory.
        shellUserConfigDir = process.env.MYSQLSH_GUI_CUSTOM_CONFIG_DIR ?? "";
        if (shellUserConfigDir.length === 0) {
            shellUserConfigDir = appParameters.get("shellUserConfigDir") ?? "";
        }

        if (shellUserConfigDir.length === 0 || !fs.existsSync(shellUserConfigDir)) {
            // No custom config dir set, use the regular shell user config dir in this case.
            // istanbul ignore next
            if (inDevelopment) {
                if (os.platform() === "win32") {
                    shellUserConfigDir = path.join(os.homedir(), "AppData", "Roaming", "MySQL", "mysqlsh");
                } else {
                    shellUserConfigDir = path.join(os.homedir(), ".mysqlsh");
                }
            } else {
                if (os.platform() === "win32") {
                    shellUserConfigDir = path.join(os.homedir(), "AppData", "Roaming", "MySQL",
                        MySQLShellLauncher.extensionShellUserConfigFolderBaseName);
                } else {
                    shellUserConfigDir = path.join(os.homedir(),
                        `.${MySQLShellLauncher.extensionShellUserConfigFolderBaseName}`);
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
    public static runMysqlShell = (config: IShellLaunchConfiguration): cp.ChildProcess => {
        // Use the MySQL Shell that is available in the given root path - and only if there is no shell, use the one
        // that is installed on the system.
        const shellPath = MySQLShellLauncher.getShellPath(config.rootPath);
        const shellUserConfigDir = MySQLShellLauncher.getShellUserConfigDir(config.inDevelopment);

        // Print which MySQL Shell is actually used.
        const embedded = shellPath.startsWith(config.rootPath) ? "embedded " : "";
        config.onStdOutData(`Starting ${embedded}MySQL Shell, using config dir '${shellUserConfigDir}' ...`);

        // Ensure the shell user config dir exists. Cannot be tested in unit tests, because the folder is always
        // created before entering here.
        // istanbul ignore next
        if (!fs.existsSync(shellUserConfigDir)) {
            fs.mkdirSync(shellUserConfigDir, { recursive: true });
        }

        // Spawn shell process
        const shellProcess = cp.spawn(shellPath, config.parameters, {
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
     * Determines an unused TCP/IP port that can be used for a shell process.
     *
     * @returns A promise which resolves to the found port.
     */
    public static findFreePort = (): Promise<number> => {
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
     * Returns the path to the MySQL Shell binary that should be used.
     *
     * The function checks if a MySQL Shell exists under the given root path. If so, the path to that binary is
     * returned. Otherwise it returns just the name of the mysqlsh executable, assuming that the MySQL Shell is
     * installed and that it is in the PATH.
     *
     * @param rootPath The file system path where to look for a shell binary.
     *
     * @returns The path to the MySQL Shell as string.
     */
    private static getShellPath = (rootPath: string): string => {
        let shellPath = path.join(rootPath, "shell", "bin", "mysqlsh");

        // istanbul ignore next
        if (os.platform() === "win32") {
            shellPath += ".exe";
        }

        // Check if MySQL Shell is bundled with the extension.
        // istanbul ignore else
        if (!fs.existsSync(shellPath)) {
            // If not, try to use the mysqlsh installed in the system PATH. Mostly used for debugging.
            if (os.platform() === "win32") {
                shellPath = findExecutable("mysqlsh");
            } else {
                shellPath = "mysqlsh";
            }
        }

        return shellPath;
    };

    /**
     * Checks the given port to see if that is currently in use by opening a socket to it.
     *
     * @param port The port to test.
     *
     * @returns True if the given port is already in use, otherwise false.
     */
    private static checkPort = (port: number): Promise<boolean> => {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();

            socket.on("timeout", () => {
                socket.destroy();
                resolve(false);
            });

            socket.on("connect", () => {
                socket.destroy();
                resolve(true);
            });

            socket.on("error", (error: Error & { code: string; }) => {
                if (error.code !== "ECONNREFUSED") {
                    reject(error);
                } else {
                    resolve(false);
                }
            });

            socket.connect(port, "0.0.0.0");
        });
    };

    /**
     * Ends the shell process without disposing of the launcher class. A new process can be started at any time.
     *
     * @returns a promise that resolves when the process signalled its end.
     */
    public exitProcess(): Promise<void> {
        return new Promise((resolve) => {
            const done = () => {
                this.shellProcess = undefined;
                this.launchDetails = { port: 0, singleUserToken: "" };

                resolve();
            };

            // istanbul ignore else
            if (this.shellProcess?.pid) {
                this.shellProcess.on("close", done);

                this.shellProcess.kill();
            } else {
                done();
            }
        });
    }

    /**
     * Starts the MySQL Shell gui_plugin webserver in single user mode and connects to the websocket.
     *
     * @param rootPath The path of the extension
     * @param inDevelopment True if we are running in development mode.
     * @param secure If true a secure connection is established (which requires proper SSL certificates).
     * @param logLevel The log level to use initially.
     * @param target If a target URL is specified, the extension connects to that remote shell instead.
     * @param forwardPort A callback function that forwards the connection through the ssh tunnel
     */
    public startShellAndConnect = (rootPath: string, inDevelopment: boolean, secure: boolean,
        logLevel: LogLevel = "INFO", target?: string, forwardPort?: (dynamicUrl: URL) => Promise<URL>): void => {

        // istanbul ignore next
        if (target) {
            const url = new URL(target);
            try {
                // For external targets we don't pass on a shell config dir, as we probably cannot access it
                // anyway (unless the target is on localhost).
                MessageScheduler.get.connect({ url: new URL(target) }).then(() => {
                    this.launchDetails.port = Number(url.port ?? 8000);
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
            const launchShellUsingPort = (port: number): void => {
                this.launchDetails.singleUserToken = uuid();
                this.launchDetails.port = port;

                const secureString = secure ? "secure={}, " : "";
                const parameters = [
                    "--no-defaults",
                    "--py",
                    "-e",
                    `gui.start.web_server(port=${this.launchDetails.port}, ${secureString}read_token_on_stdin=True)`,
                ];

                const onOutput = (output: string) => {
                    // If the MySQL Shell web server is running and indicates Single user mode, connect to it
                    if (output.includes("Mode: Single user")) {
                        const protocol = secure ? "https" : "http";
                        let host = "localhost";
                        if (appParameters.testsRunning && !appParameters.inExtension) {
                            host = "127.0.0.1";
                        }
                        const url = new URL(`${protocol}://${host}:${port}/` +
                            `?token=${this.launchDetails.singleUserToken}`);

                        const options = {
                            url,
                            shellConfigDir: MySQLShellLauncher.getShellUserConfigDir(inDevelopment),
                        };

                        if (forwardPort) {
                            this.onOutput("Establishing the port forwarding session to remote ssh server...");
                            forwardPort(url).then((redirectUrl) => {
                                MessageScheduler.get.connect(options).then(() => {
                                    void requisitions.execute("connectedToUrl", redirectUrl);
                                }).catch(/* istanbul ignore next */(reason) => {
                                    // Errors arriving here are directly reflected in test failures.
                                    this.onError(
                                        new Error(`Could not establish websocket connection: ${String(reason)}`));
                                    void requisitions.execute("connectedToUrl", undefined);
                                });
                            }).catch((reason) => {
                                this.onError(
                                    new Error(`Could not establish the port forwarding: ${String(reason)}`));
                            });
                        } else {
                            MessageScheduler.get.connect(options).then(() => {
                                void requisitions.execute("connectedToUrl", url);
                            }).catch(/* istanbul ignore next */(reason) => {
                                // Errors arriving here are directly reflected in test failures.
                                this.onError(
                                    new Error(`Could not establish websocket connection: ${String(reason)}`));
                                void requisitions.execute("connectedToUrl", undefined);

                                setTimeout(() => { void this.exitProcess(); }, 0);
                            });
                        }

                    }
                    this.onOutput(output);
                };

                this.shellProcess = MySQLShellLauncher.runMysqlShell({
                    rootPath,
                    inDevelopment,
                    logLevel,
                    parameters,
                    onStdOutData: onOutput,
                    onError: this.onError,
                    onExit: this.onExit,
                    processInput: this.launchDetails.singleUserToken,
                });
            };

            if (appParameters.testsRunning) {
                launchShellUsingPort(Math.floor(Math.random() * 20000) + 20000);
            } else {
                let port = 33336;
                if (process.env.MYSQLSH_GUI_CUSTOM_PORT !== undefined) {
                    const customPort = parseInt(process.env.MYSQLSH_GUI_CUSTOM_PORT, 10);
                    if (!isNaN(customPort)) {
                        port = customPort;
                    } else {
                        console.error(`MYSQLSH_GUI_CUSTOM_PORT is not a number, using 33336.`);
                    }
                }

                // Check if default port is already in use.
                void MySQLShellLauncher.checkPort(port).then((inUse) => {
                    if (!inUse) {
                        launchShellUsingPort(port);
                    } else {
                        this.onOutput("Finding free port...");
                        MySQLShellLauncher.findFreePort().then((port) => {
                            launchShellUsingPort(port);
                        }).catch(/* istanbul ignore next */(error) => {
                            // Errors arriving here are directly reflected in test failures.
                            if (error instanceof Error) {
                                this.onError(error);
                            } else {
                                this.onError(new Error(String(error)));
                            }
                        });

                    }
                });
            }
        }
    };
}
