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

const { contextBridge, ipcRenderer } = require("electron");

let hostMessageHandler;
let nativeMenuHandler;

const subscribe = (channel, listener) => {
    const wrapped = (_event, value) => {
        listener(value);
    };

    ipcRenderer.on(channel, wrapped);

    return () => {
        ipcRenderer.removeListener(channel, wrapped);
    };
};

contextBridge.exposeInMainWorld("electronHost", {
    electronVersion: process.versions.electron,
    postMessage: (message) => {
        ipcRenderer.send("electron-host-post-message", message);
    },
    setMessageHandler: (handler) => {
        hostMessageHandler = handler;
    },
    showNativeMenu: (request) => {
        return ipcRenderer.invoke("electron-host-show-native-menu", request);
    },
    closeNativeMenu: (requestId) => {
        return ipcRenderer.invoke("electron-host-close-native-menu", requestId);
    },
    setNativeMenuHandler: (handler) => {
        nativeMenuHandler = handler;
    },
    canStartMigrationAssistant: () => {
        return ipcRenderer.invoke("electron-host-can-start-migration-assistant");
    },
});

ipcRenderer.on("electron-host-message", (_event, message) => {
    hostMessageHandler?.(message);
});

ipcRenderer.on("electron-host-native-menu-event", (_event, event) => {
    nativeMenuHandler?.(event);
});

contextBridge.exposeInMainWorld("electronDesktopBackend", {
    connect: () => {
        return ipcRenderer.invoke("electron-backend-connect");
    },
    disconnect: () => {
        return ipcRenderer.invoke("electron-backend-disconnect");
    },
    send: (payload) => {
        ipcRenderer.send("electron-backend-send", payload);
    },
    onMessage: (listener) => {
        return subscribe("electron-backend-message", listener);
    },
    onClose: (listener) => {
        return subscribe("electron-backend-close", listener);
    },
    onError: (listener) => {
        return subscribe("electron-backend-error", listener);
    },
});
