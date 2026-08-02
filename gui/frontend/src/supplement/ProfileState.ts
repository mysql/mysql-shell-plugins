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
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { IDictionary, type ValueType } from "../app-logic/general-types.js";
import type { IShellDictionary } from "../communication/Protocol.js";
import { requisitions } from "./Requisitions.js";
import { webSession } from "./WebSession.js";

/** Manages profile-scoped UI state, such as dismissed notices and explainers already shown. */
export class ProfileState {
    private static dirty = false;
    private static values: IDictionary = {};

    private constructor() {
        // Cannot be instantiated.
    }

    public static get<T>(key: string, defaultValue: T): ValueType<T>;
    public static get(key: string): unknown;
    public static get<T>(key: string, defaultValue?: T): T | undefined {
        const { target, subKey } = this.objectForKey(this.values, key, false);

        return target[subKey] as T ?? defaultValue;
    }

    public static set(key: string, value: unknown): void {
        const { target, subKey } = this.objectForKey(this.values, key, true);
        target[subKey] = value;
        this.dirty = true;

        void requisitions.execute("settingsChanged", { key, value });
    }

    public static saveState(force = false): void {
        if (!this.dirty && !force) {
            return;
        }

        this.dirty = false;
        webSession.profile.state = this.values as IShellDictionary;

        webSession.saveProfile();
    }

    /** Clears UI state that was remembered for the active profile. */
    public static reset(): void {
        this.values = {};
        this.dirty = true;
        this.saveState();

        void requisitions.execute("profileStateChanged", undefined);
    }

    private static objectForKey(
        values: IDictionary, key: string, canCreate: boolean,
    ): { target: IDictionary; subKey: string; } {
        let target = values;
        const parts = key.split(".");
        const subKey = parts.pop()!;

        for (const part of parts) {
            if (!target[part]) {
                if (!canCreate) {
                    return { target: {}, subKey };
                }
                target[part] = {};
            }
            target = target[part] as IDictionary;
        }

        return { target, subKey };
    }

    private static profileLoaded = (): Promise<boolean> => {
        this.values = { ...(webSession.profile.state as IDictionary) };
        this.dirty = false;

        return Promise.resolve(true);
    };

    private static applicationWillFinish = (): Promise<boolean> => {
        requisitions.unregister(undefined, this.profileLoaded);
        requisitions.unregister(undefined, this.applicationWillFinish);

        this.saveState();

        return Promise.resolve(true);
    };

    private static userLoggedOut = (): Promise<boolean> => {
        this.values = {};
        this.dirty = false;

        return Promise.resolve(true);
    };

    static {
        setTimeout(() => {
            requisitions.register("profileLoaded", ProfileState.profileLoaded);
            requisitions.register("applicationWillFinish", ProfileState.applicationWillFinish);
            requisitions.register("userLoggedOut", ProfileState.userLoggedOut);
        }, 0);
    }
}
