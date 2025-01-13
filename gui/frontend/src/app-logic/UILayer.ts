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

import type { IStatusBarItem, StatusBarAlignment } from "../components/ui/Statusbar/StatusBarItem.js";
import type { IServicePasswordRequest } from "./general-types.js";

/**
 * The UI layer object comprises functionality that is specific to the environment it is used in.
 * This is only relevant for code which is shared between different platforms (e.g. the extension and the app).
 * The UI layer redirects requests for UI specific functionality to the appropriate implementation and must be set
 * up by the application logic layer (either the app host or the extension host).
 */
export interface IUILayer {
    /**
     * Shows an information notification. The message is automatically hidden after the given timeout
     * (in milliseconds, default is 5000).
     */
    showInformationNotification(message: string, timeout?: number): Promise<string | undefined>;

    /** Shows a warning notification. */
    showWarningNotification(message: string): Promise<string | undefined>;

    /** Shows a error notification. */
    showErrorNotification(message: string): Promise<string | undefined>;

    /**
     * Creates a status bar {@link StatusBarItem item}.
     *
     * @param alignment The alignment of the item.
     * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
     * @returns A new status bar item.
     */
    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): IStatusBarItem;

    /**
     * Creates a status bar {@link StatusBarItem item}.
     *
     * @param id The unique identifier of the item.
     * @param alignment The alignment of the item.
     * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
     * @returns A new status bar item.
     */
    createStatusBarItem(id: string, alignment?: StatusBarAlignment, priority?: number): IStatusBarItem;

    /**
     * Shows a message in the status bar.
     *
     * @param message The message to show.
     * @param timeout The time in milliseconds after which the message is automatically hidden. If not set, the message
     *               is shown until the next message is set.
     */
    setStatusBarMessage(message: string, timeout?: number): void;

    /**
     * Asks the user for a yes/no decision. Returns the yes/no string, depending on what the user clicked or
     * undefined if the user clicked outside/cancelled the dialog (e.g. pressed <escape>).
     */
    confirm(message: string, yes: string, no: string): Promise<string | undefined>;

    /**
     * Triggers a password request.
     *
     * @param request The request with details about the password prompt.
     *
     * @returns The entered password or undefined if the password dialog was cancelled.
     */
    requestPassword(request: IServicePasswordRequest): Promise<string | undefined>;
}

const defaultHandler = (): number => {
    console.error("Internal error: the UI layer has not been set up.");

    return -1;
};

const asyncDefaultHandler = (): Promise<string | undefined> => {
    console.error("Internal error: the UI layer has not been set up.");

    return Promise.resolve(undefined);
};

export let ui: IUILayer = {
    showInformationNotification: asyncDefaultHandler,
    showWarningNotification: asyncDefaultHandler,
    showErrorNotification: asyncDefaultHandler,
    createStatusBarItem: (): IStatusBarItem => {
        console.error("Internal error: the UI layer has not been set up.");

        return {} as IStatusBarItem;
    },
    setStatusBarMessage: defaultHandler,
    confirm: asyncDefaultHandler,
    requestPassword: asyncDefaultHandler,
};

export const registerUiLayer = (newLayer: IUILayer): void => {
    ui = newLayer;
};
