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

import { window, ProgressLocation, MessageOptions, commands, ProviderResult } from "vscode";
import { waitFor } from "../../frontend/src/utilities/helpers";

/**
 * Dynamically switches a vscode context on or off. Such a context is used to enable/disable vscode commands,
 * menus, views and others.
 *
 * @param key The name of the context value to switch.
 * @param enable True or false to enabled/disable.
 *
 * @returns The result returned from the command execution.
 */
export const switchVsCodeContext = (key: string, enable: boolean): ProviderResult<unknown> => {
    return commands.executeCommand("setContext", key, enable);
};

/**
 * Shows a message that auto closes after a certain timeout. Since there's no API for this functionality the
 * progress output is used instead, which auto closes at 100%.
 * This means the function cannot (and should not) be used for warnings or errors. These types of message require
 * the user to really take note.
 *
 * @param message The message to show.
 * @param timeout The time in milliseconds after which the message should close (default 3secs).
 */
export const showMessageWithTimeout = (message: string, timeout = 3000): void => {
    void window.withProgress(
        {
            location: ProgressLocation.Notification,
            title: message,
            cancellable: false,
        },

        async (progress): Promise<void> => {
            await waitFor(timeout, () => { return false; });
            progress.report({ increment: 100 });
        },
    );
};

/**
 * Shows a modal dialog to let the user do a decision.
 *
 * @param message The message to show on which the user has to decide.
 * @param okText The text to show on the OK button. If not given "OK" is used instead.
 * @param detail An optional description text.
 *
 * @returns A promise that resolves to true if the user clicked the accept button, otherwise (cancel button click or
 *          escape key press) to false.
 */
export const showModalDialog = (message: string, okText = "OK", detail?: string): Promise<boolean> => {
    return new Promise((resolve) => {
        switchVsCodeContext("showsModalDialog", true);
        const options: MessageOptions = { detail, modal: true };

        void window.showInformationMessage(message, options, okText).then((answer) => {
            switchVsCodeContext("showsModalDialog", false);
            resolve(answer === okText);
        });

    });
};
