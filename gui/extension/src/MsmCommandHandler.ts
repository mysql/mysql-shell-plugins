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

import {
    commands, window,
    Uri,
    workspace,
    TextDocument,
} from "vscode";
import { ExtensionHost } from "./ExtensionHost.js";
import { ui } from "../../frontend/src/app-logic/UILayer.js";
import { ConnectionsTreeDataProvider } from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeProvider.js";
import { ShellInterfaceShellSession } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceShellSession.js";
import { IMsmProjectInfo } from "../../frontend/src/communication/ProtocolMsm.js";

export class MsmCommandHandler {
    #host: ExtensionHost;
    #shellSession = new ShellInterfaceShellSession();

    public constructor(private connectionsProvider: ConnectionsTreeDataProvider) { }

    public setup = (host: ExtensionHost): void => {
        this.#host = host;
        const context = host.context;

        const validateVersionInput = (value: string) => {
            if (!/^\d+\.\d+\.\d+$/.test(value)) {
                return "The version has to be provided in the following format: major.minor.patch";
            } else {
                return undefined;
            }
        };

        context.subscriptions.push(commands.registerCommand("msg.msm.createNewProjectFolder",
            async (directory?: Uri) => {
                if (directory) {
                    if (this.#host.extensionInitialized()) {
                        const schemaName = await window.showInputBox({
                            title: "MSM - Create Project Folder - Schema Name",
                            prompt: "Please enter the name of the database schema.",
                            ignoreFocusOut: true,
                            validateInput: (value: string) => {
                                if (/^[A-Za-z0-9_]+[A-Za-z0-9_$]*$/.test(value) && !/^[0-9]+$/.test(value)) {
                                    return undefined;
                                } else {
                                    return "Only basic Latin letters, digits 0-9, dollar, underscore are allowed and " +
                                        "a schema name must not consist solely of digits.";
                                }
                            },
                        });

                        // Check if the user canceled
                        if (schemaName === undefined) {
                            return;
                        }

                        const copyrightHolder = await window.showInputBox({
                            title: "MSM - Create Project Folder - Copyright Holder",
                            prompt: "Please enter the copyright holder.",
                            ignoreFocusOut: true,
                            placeHolder: "Your personal name or the name of your company",
                        });

                        // Check if the user canceled
                        if (!copyrightHolder) {
                            return;
                        }

                        const availableLicenses = await this.#shellSession.msm.getAvailableLicenses();
                        const license = await window.showQuickPick(availableLicenses, {
                            title: "MSM - Create Project Folder - License",
                            ignoreFocusOut: true,
                        });

                        try {
                            const projectFolder = await this.#shellSession.msm.createNewProjectFolder(
                                schemaName, directory.fsPath, copyrightHolder, license);
                            const projectInfo = await this.#shellSession.msm.getProjectInformation(projectFolder);

                            // Open the schema development file
                            void workspace.openTextDocument(
                                Uri.file(projectInfo.schemaDevelopmentFilePath)).then((doc: TextDocument) => {
                                    void window.showTextDocument(doc, {
                                        preview: false,
                                        preserveFocus: false,
                                        viewColumn: 1,
                                    });
                                });
                        } catch (e) {
                            void ui.showErrorMessage(
                                `The following error occurred when creating the MSM project folder: ${e}`, {});
                        }

                        await ui.showInformationMessage(
                            `New database schema project folder created.`, {});
                    } else {
                        void ui.showErrorMessage("Please open the MySQL Shell extension prior to using this feature " +
                            "and ensure that there is at least one MySQL connection available.", {});
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.msm.getProjectInformation",
            async (directory?: Uri) => {
                if (directory) {
                    if (this.#host.extensionInitialized()) {
                        try {
                            const projectInfo = await this.#shellSession.msm.getProjectInformation(directory.fsPath);

                            // Open the schema development file
                            void workspace.openTextDocument({
                                language: "json",
                                content: JSON.stringify(projectInfo, undefined, 4),
                            }).then((doc: TextDocument) => {
                                void window.showTextDocument(doc, {
                                    preview: false,
                                    preserveFocus: false,
                                    viewColumn: 1,
                                });
                            });
                        } catch (e) {
                            void ui.showErrorMessage(
                                `The following error occurred when fetching the MSM project information: ${e}`, {});
                        }
                    } else {
                        void ui.showErrorMessage("Please open the MySQL Shell extension prior to using this feature " +
                            "and ensure that there is at least one MySQL connection available.", {});
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.msm.prepareRelease",
            async (directory?: Uri) => {
                if (directory) {
                    if (this.#host.extensionInitialized()) {
                        const projectInfo: IMsmProjectInfo = await this.#shellSession.msm.getProjectInformation(
                            directory.fsPath);

                        const version = await window.showInputBox({
                            title: "MSM - Prepare Release - Version for Release",
                            prompt: "Please enter the version to be used for the release.",
                            value: projectInfo.currentDevelopmentVersion,
                            validateInput: validateVersionInput,
                        });

                        // Check if the user canceled
                        if (version === undefined) {
                            return;
                        }

                        const nextVersionInt = version.split(".").map((n) => {
                            return parseInt(n, 10);
                        });
                        nextVersionInt[2] += 1;

                        const nextVersion = await window.showInputBox({
                            title: "MSM - Prepare Release - Next Version for Development",
                            prompt: "Please enter the next version to used for development.",
                            value: nextVersionInt.join("."),
                            ignoreFocusOut: true,
                            validateInput: validateVersionInput,
                        });

                        // Check if the user canceled
                        if (nextVersion === undefined) {
                            return;
                        }

                        const releasedVersions = await this.#shellSession.msm.getReleasedVersions(
                            directory.fsPath);
                        const releasedVersionStrings = releasedVersions.map((v) => {
                            return `${v[0]}.${v[1]}.${v[2]}`;
                        });
                        if (releasedVersionStrings.includes(nextVersion)) {
                            if (await ui.showWarningMessage(
                                `The release ${nextVersion} already exists.`, {
                                modal: true,
                                detail: "Are you sure you want to overwrite the existing files?",
                            }, "Yes", "No") !== "Yes") {
                                return;
                            }
                        }

                        try {
                            const filesForRelease = await this.#shellSession.msm.prepareRelease(
                                directory.fsPath, version, nextVersion, true, true);

                            // Open all files that have been created/modified
                            filesForRelease.forEach((filePath) => {
                                const fileToOpen: Uri = Uri.file(filePath);
                                void workspace.openTextDocument(fileToOpen).then((doc: TextDocument) => {
                                    void window.showTextDocument(doc, {
                                        preview: false,
                                        preserveFocus: false,
                                        viewColumn: 1,
                                    });
                                });
                            });
                        } catch (e) {
                            void ui.showErrorMessage(
                                `The following error occurred when preparing the release: ${e}`, {});
                        }

                        await ui.showInformationMessage(
                            `New database schema version ${version} prepared for release.`, {});
                    } else {
                        void ui.showErrorMessage("Please open the MySQL Shell extension prior to using this feature " +
                            "and ensure that there is at least one MySQL connection available.", {});
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.msm.generateDeploymentScript",
            async (directory?: Uri) => {
                if (directory) {
                    if (this.#host.extensionInitialized()) {
                        const projectInfo: IMsmProjectInfo = await this.#shellSession.msm.getProjectInformation(
                            directory.fsPath);

                        const version = await window.showInputBox({
                            title: "MSM - Generate Deployment Script - Version",
                            prompt: "Please enter the version to be used for the release.",
                            value: projectInfo.lastReleasedVersion,
                            ignoreFocusOut: true,
                            validateInput: validateVersionInput,
                        });

                        // Check if the user canceled
                        if (version === undefined) {
                            return;
                        }

                        const deployedVersions = await this.#shellSession.msm.getDeploymentScriptVersions(
                            directory.fsPath);
                        const deployedVersionStrings = deployedVersions.map((v) => {
                            return `${v[0]}.${v[1]}.${v[2]}`;
                        });
                        if (deployedVersionStrings.includes(version)) {
                            if (await ui.showWarningMessage(
                                `The deployment version ${version} already exists.`, {
                                modal: true,
                                detail: "Are you sure you want to overwrite the existing file?",
                            }, "Yes", "No") !== "Yes") {
                                return;
                            }
                        }

                        try {
                            const fileForRelease = await this.#shellSession.msm.generateDeploymentScript(
                                directory.fsPath, version, true);

                            // Open the file that have been created/modified
                            void workspace.openTextDocument(Uri.file(fileForRelease)).then((doc: TextDocument) => {
                                void window.showTextDocument(doc, {
                                    preview: false,
                                    preserveFocus: false,
                                    viewColumn: 1,
                                });
                            });
                        } catch (e) {
                            void ui.showErrorMessage(
                                `The following error occurred when generating the deployment script: ${e}`, {});
                        }

                        await ui.showInformationMessage(
                            `New database schema deployment script version ${version} generated.`, {});
                    } else {
                        void ui.showErrorMessage("Please open the MySQL Shell extension prior to using this feature " +
                            "and ensure that there is at least one MySQL connection available.", {});
                    }
                }
            }));

    };
}
