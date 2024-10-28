/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import { webSession } from "../WebSession.js";
import { ValueType } from "../index.js";
import { requisitions } from "../Requisitions.js";
import { categoryFromPath, registerSettings } from "./SettingsRegistry.js";
import { IDictionary } from "../../app-logic/general-types.js";

interface IUserSettings extends IDictionary {
    theming: {
        themes: Array<{ name: string; definition: string; }>;
        currentTheme: string;
    };
}

/**
 * A static class to manage application/user preferences.
 * These are loaded from the user's profile data and possibly other sources.
 */
export class Settings {
    private static dirty = false;
    private static values: IUserSettings = {
        theming: {
            themes: [],
            currentTheme: "Auto",
        },
    };

    private static saveTimer: ReturnType<typeof setTimeout> | null;

    private constructor() {
        // Cannot be instantiated.
    }

    /**
     * Stores the settings in the user's profile.
     *
     * @param force If true then save even if the current set has not changed since last load/save.
     */
    public static saveSettings(force = false): void {
        if (!this.dirty && !force) {
            return;
        }

        this.dirty = false;

        const profile = webSession.profile;
        profile.options = this.values;

        webSession.saveProfile();
        this.restartAutoSaveTimeout();
    }

    /**
     * Returns the value stored at the given key, which can have the form `qualifier.subKey`.
     *
     * @param key The key to look up.
     * @param defaultValue An optional value to be returned if the there's no value at the given key or the key doesn't
     *                     exist at all.
     *
     * @returns If a default value is given the return type is the same as that of the default value. Otherwise it's
     *          either undefined or the same as the type found at the given key.
     */
    public static get<T>(key: string, defaultValue: T): ValueType<T>;
    public static get(key: string): unknown;
    public static get<T>(key: string, defaultValue?: T): T | undefined {
        const { target, subKey } = this.objectForKey(key, false);
        if (!target || !subKey) {
            return defaultValue;
        }

        return target[subKey] as T ?? defaultValue;
    }

    public static set(key: string, value: unknown): void {
        this.dirty = true;

        const { target, subKey } = this.objectForKey(key, true);
        if (target && subKey) {
            target[subKey] = value;
        }

        void requisitions.execute("settingsChanged", { key, value });
        void requisitions.executeRemote("settingsChanged", { key, value });
    }

    /**
     * Splits the given key at dots and uses the parts (sans the last one) to navigate the settings to a specific
     * target object, which is then returned.
     *
     * @param key The access key.
     * @param canCreate Indicates if missing sub objects can be created if not found.
     *
     * @returns An object with the object at the given path (not counting the last part, which is returned as subKey).
     */
    private static objectForKey(key: string, canCreate: boolean): { target?: IDictionary; subKey?: string; } {
        let run: IDictionary = this.values;
        const parts = key.split(".");

        this.validatePath(key);

        while (parts.length > 1) {
            if (run[parts[0]]) {
                run = run[parts[0]] as IDictionary;
            } else if (canCreate) {
                run[parts[0]] = {};
                run = run[parts[0]] as IDictionary;
            } else {
                return { target: undefined };
            }

            parts.splice(0, 1);
        }

        return { target: run, subKey: parts[0] };
    }

    /**
     * Takes the list of path values and checks if there's an entry in the settings registry for each of them.
     * If one could not be found an error is thrown.
     *
     * @param path The path to check.
     */
    private static validatePath(path: string): void {
        const [key, category] = categoryFromPath(path);
        if (!category.values.find((value) => {
            return value.key === key;
        })) {
            throw new Error(`The settings path ${path} addresses an unregistered setting.`);
        }
    }

    /**
     * Triggered when a profile is loaded. Merges the profile's settings with the current ones.
     *
     * @returns A promise that resolves to the result of the settingsChanged requisition.
     */
    private static mergeProfileValues = (): Promise<boolean> => {
        this.values = Object.assign(this.values, webSession.profile.options);

        return requisitions.execute("settingsChanged", undefined);
    };

    private static applicationWillFinish = (): Promise<boolean> => {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        requisitions.unregister(undefined, this.mergeProfileValues);
        requisitions.unregister(undefined, this.applicationWillFinish);

        this.saveSettings();

        return Promise.resolve(true);
    };

    private static restartAutoSaveTimeout(): void {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = null;
        }

        this.saveTimer = setTimeout(() => {
            return this.saveSettings();
        }, 3000);
    }

    static {
        registerSettings();

        setTimeout(() => {
            requisitions.register("profileLoaded", Settings.mergeProfileValues);
            requisitions.register("applicationWillFinish", Settings.applicationWillFinish);
        }, 0);
    }
}
