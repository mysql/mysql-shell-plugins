/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import type { IEmbeddedMessage } from "../communication/index.js";

export interface IElectronNativeMenuItem {
    id: string;
    label?: string;
    accelerator?: string;
    enabled?: boolean;
    checked?: boolean;
    submenu?: IElectronNativeMenuItem[];
    type?: "normal" | "separator";
}

export interface IElectronNativeMenuRequest {
    id: string;
    x?: number;
    y?: number;
    items: IElectronNativeMenuItem[];
    positioningItem?: number;
}

export type IElectronNativeMenuEvent =
    | {
        type: "select";
        requestId: string;
        itemId: string;
    }
    | {
        type: "close";
        requestId: string;
        cancelled: boolean;
    };

export interface IElectronHostBridge {
    electronVersion: string;
    postMessage: (message: IEmbeddedMessage) => void;
    setMessageHandler?: (handler: (message: IEmbeddedMessage) => void) => void;
    showNativeMenu?: (request: IElectronNativeMenuRequest) => Promise<void>;
    closeNativeMenu?: (requestId: string) => Promise<void>;
    setNativeMenuHandler?: (handler: (event: IElectronNativeMenuEvent) => void) => void;
    canStartMigrationAssistant?: () => Promise<{ allowed: boolean; message?: string; }>;
}

export interface IElectronDesktopBackend {
    connect: () => Promise<string[]>;
    disconnect: () => Promise<void>;
    send: (payload: string) => void;
    onMessage: (listener: (payload: string) => void) => () => void;
    onClose: (listener: () => void) => () => void;
    onError: (listener: (message: string) => void) => () => void;
}

declare global {
    interface Window {
        electronHost?: IElectronHostBridge;
        electronDesktopBackend?: IElectronDesktopBackend;
    }
}

export const hasElectronHostBridge = (): boolean => {
    return typeof window !== "undefined" && window.electronHost !== undefined;
};

export const hasElectronDesktopBackend = (): boolean => {
    return typeof window !== "undefined" && window.electronDesktopBackend !== undefined;
};

export const hasElectronNativeMenuBridge = (): boolean => {
    const host = typeof window === "undefined" ? undefined : window.electronHost;

    return typeof host?.showNativeMenu === "function"
        && typeof host.setNativeMenuHandler === "function";
};
