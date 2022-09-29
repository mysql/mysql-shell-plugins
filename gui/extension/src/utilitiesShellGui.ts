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

import {
    ICommOpenConnectionEvent, ShellPromptResponseType, ICommErrorEvent, IShellFeedbackRequest,
    IShellResultType,
} from "../../frontend/src/communication";
import { EventType } from "../../frontend/src/supplement/Dispatch";
import { ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface";
import { stripAnsiCode } from "../../frontend/src/utilities/helpers";
import { window } from "vscode";

export const isShellPromptResult = (response?: IShellResultType): response is IShellFeedbackRequest => {
    const candidate = response as IShellFeedbackRequest;

    return candidate?.prompt !== undefined;
};


/**
 * Opens an sqlEditor connection
 *
 * @param sqlEditor A ShellInterfaceSqlEditor instance
 * @param connectionId The id of the connection to open
 * @param progress A callback that displays a progress message
 */
export const openSqlEditorConnection = (sqlEditor: ShellInterfaceSqlEditor, connectionId: number,
    progress?: (message: string) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
        sqlEditor.openConnection(connectionId).then((event: ICommOpenConnectionEvent) => {
            switch (event.eventType) {
                case EventType.DataResponse: {
                    const result = event.data.result;
                    if (isShellPromptResult(result)) {
                        if (result.type === "password") {
                            void window.showInputBox({
                                title: result.prompt,
                                password: true,
                            }).then((value) => {
                                if (event.data && event.data.requestId) {
                                    if (value) {
                                        sqlEditor.sendReply(event.data.requestId,
                                            ShellPromptResponseType.Ok, value);
                                    } else {
                                        sqlEditor.sendReply(event.data.requestId,
                                            ShellPromptResponseType.Cancel, "");
                                    }
                                }
                            });
                        } else if (result.prompt) {
                            void window.showInputBox({
                                title: stripAnsiCode(result.prompt),
                                password: false,
                                value: "N",
                            }).then((value) => {
                                if (event.data && event.data.requestId) {
                                    if (value) {
                                        sqlEditor.sendReply(event.data.requestId,
                                            ShellPromptResponseType.Ok, value);
                                    } else {
                                        sqlEditor.sendReply(event.data.requestId,
                                            ShellPromptResponseType.Cancel, "");
                                    }
                                }
                            });
                        }
                    } else if (event.message && progress) {
                        progress(event.message);
                    }

                    break;
                }

                case EventType.FinalResponse: {
                    resolve();

                    break;
                }

                default: {
                    break;
                }
            }
        }).catch((errorEvent: ICommErrorEvent) => {
            reject(`Error during open connection: ${errorEvent.message ?? "<unknown>"}`);
        });
    });
};

/**
 * Creates a new SqlEditor and opens the given connection
 *
 * @param sqlEditor A ShellInterfaceSqlEditor instance
 * @param connectionId The id of the connection to open
 * @param sessionName A unique name for this session
 *
 * @returns An SQL Editor instance with opened connection
 */
export const openSqlEditorSessionAndConnection = async (sqlEditor: ShellInterfaceSqlEditor, connectionId: number,
    sessionName: string): Promise<void> => {

    const statusbarItem = window.createStatusBarItem();
    try {
        statusbarItem.text = "$(loading~spin) Starting Database Session ...";
        statusbarItem.show();

        statusbarItem.text = "$(loading~spin) Starting Database Session ...";
        await sqlEditor.startSession(String(connectionId) + sessionName);

        statusbarItem.text = "$(loading~spin) Opening Database Connection ...";
        await openSqlEditorConnection(sqlEditor, connectionId, (message) => {
            statusbarItem.text = "$(loading~spin) " + message;
        });

        statusbarItem.hide();
    } catch (error) {
        statusbarItem.hide();

        await sqlEditor.closeSession();

        throw new Error("A error occurred when trying to open the database connection. " +
            `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
};

