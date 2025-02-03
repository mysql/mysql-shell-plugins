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
 * Options to configure the behavior of the notification.
 * Copied from VS Code.
 *
 * @see {@link ui.showInformationMessage showInformationMessage}
 * @see {@link ui.showWarningMessage showWarningMessage}
 * @see {@link ui.showErrorMessage showErrorMessage}
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface MessageOptions {

    /** Indicates that this message should be modal. */
    modal?: boolean;

    /**
     * Human-readable detail message that is rendered less prominent. _Note_ that detail
     * is only shown for {@link MessageOptions.modal modal} messages.
     */
    detail?: string;
}

/**
 * Thenable is a common denominator between ES6 promises, Q, jquery.Deferred, WinJS.Promise,
 * and others. This API makes no assumption about what promise library is being used which
 * enables reusing existing code without migrating to a specific promise implementation. Still,
 * we recommend the use of native promises which are available in this editor.
 *
 * Copied from VS Code.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface Thenable<T> {
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>,
        onrejected?: (reason: unknown) => TResult | Thenable<TResult>): Thenable<TResult>;
    then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>,
        onrejected?: (reason: unknown) => void): Thenable<TResult>;
}

/**
 * The UI layer object comprises functionality that is specific to the environment it is used in.
 * This is only relevant for code which is shared between different platforms (e.g. the extension and the app).
 * The UI layer redirects requests for UI specific functionality to the appropriate implementation and must be set
 * up by the application logic layer (either the app host or the extension host).
 */
export interface IUILayer {
    /** Shows an information message in the notification center. */
    showInformationMessage<T extends string>(message: string, options: MessageOptions,
        ...items: T[]): Thenable<string | undefined>;

    /** Shows a warning message in the notification center. */
    showWarningMessage<T extends string>(message: string, options: MessageOptions,
        ...items: T[]): Thenable<string | undefined>;

    /** Shows an error message in the notification center. */
    showErrorMessage<T extends string>(message: string, options: MessageOptions,
        ...items: T[]): Thenable<string | undefined>;

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
    confirm(message: string, yes: string, no: string, extra?: string): Promise<string | undefined>;

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
    showInformationMessage: asyncDefaultHandler,
    showWarningMessage: asyncDefaultHandler,
    showErrorMessage: asyncDefaultHandler,
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
