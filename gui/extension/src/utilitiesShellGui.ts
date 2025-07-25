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

import Anser from "anser";
import { window } from "vscode";

import { ShellPromptResponseType } from "../../frontend/src/communication/Protocol.js";
import { IShellFeedbackRequest, IStatusData } from "../../frontend/src/communication/ProtocolGui.js";
import { ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor.js";

const isShellPromptResult = (response?: unknown): response is IShellFeedbackRequest => {
    const candidate = response as IShellFeedbackRequest;

    return candidate?.prompt !== undefined;
};


const isStatusCodeData = (response?: unknown): response is IStatusData => {
    return (response as IStatusData).result !== undefined && typeof ((response as IStatusData).result) === "string";
};

/**
 * Opens an sqlEditor connection
 *
 * @param sqlEditor A ShellInterfaceSqlEditor instance
 * @param connectionId The id of the connection to open
 * @param progress A callback that displays a progress message
 */
export const openSqlEditorConnection = async (sqlEditor: ShellInterfaceSqlEditor, connectionId: number,
    progress?: (message: string) => void): Promise<void> => {

    await sqlEditor.openConnection(connectionId, undefined, undefined, (data, requestId) => {
        const result = data.result;
        if (isShellPromptResult(result)) {
            if (result.type === "password") {
                void window.showInputBox({ title: result.prompt, password: true }).then((value) => {
                    if (value !== undefined) {
                        void sqlEditor.sendReply(requestId, ShellPromptResponseType.Ok, value);
                    } else {
                        void sqlEditor.sendReply(requestId, ShellPromptResponseType.Cancel, "");
                    }
                });
            } else if (result.prompt) {
                void window.showInputBox({ title: Anser.ansiToText(result.prompt), password: false, value: "N" })
                    .then((value) => {
                        if (value) {
                            void sqlEditor.sendReply(requestId, ShellPromptResponseType.Ok, value);
                        } else {
                            void sqlEditor.sendReply(requestId, ShellPromptResponseType.Cancel, "");
                        }
                    });
            }
        } else if (progress) {
            if (data.requestState !== undefined &&
                data.requestState.msg !== undefined &&
                data.requestState.msg !== "") {
                progress(data.requestState.msg);
            } else if (isStatusCodeData(data)) {
                progress(data.result);
            }
        }

        return Promise.resolve();
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
