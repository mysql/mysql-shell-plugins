/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

import { webSession } from "../WebSession";
import { ValueType } from "..";
import { requisitions } from "../Requisitions";
import { categoryFromPath, registerSettings } from "./SettingsRegistry";
import { IDictionary } from "../../app-logic/Types";

interface IUserSettings extends IDictionary {
    theming: {
        themes: Array<{ name: string; definition: string }>;
        currentTheme: string;
    };
}

// A class to manage application/user preferences.
// These are loaded from the user's profile data and possibly other sources.
export class Settings {

    private dirty = false;
    private values: IUserSettings = {
        theming: {
            themes: [],
            currentTheme: "auto",
        },
    };

    private saveTimer: ReturnType<typeof setTimeout> | null;

    private constructor() {
        requisitions.register("profileLoaded", this.mergeProfileValues);
        requisitions.register("applicationWillFinish", this.applicationWillFinish);
    }

    public static get instance(): Settings {
        registerSettings();

        return new Settings();
    }

    /**
     * Stores the settings in the user's profile.
     *
     * @param force If true then save even if the current set has not changed since last load/save.
     */
    public saveSettings(force = false): void {
        if (!this.dirty && !force) {
            return;
        }

        this.dirty = false;

        const profile = webSession.profile;
        profile.options = this.values;

        webSession.saveProfile();
        this.restartAutoSaveTimer();
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
    public get<T>(key: string, defaultValue: T): ValueType<T>;
    public get(key: string): unknown;
    public get<T>(key: string, defaultValue?: T): T | undefined {
        const { target, subKey } = this.objectForKey(key, false);
        if (!target || !subKey) {
            return defaultValue;
        }

        return target[subKey] as T ?? defaultValue;
    }

    public set(key: string, value: unknown): void {
        this.dirty = true;

        const { target, subKey } = this.objectForKey(key, true);
        if (target && subKey) {
            target[subKey] = value;
        }

        if (key === "settings.autoSaveInterval") {
            this.restartAutoSaveTimer();
        }

        void requisitions.execute("settingsChanged", { key, value });
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
    private objectForKey(key: string, canCreate: boolean): { target?: IDictionary; subKey?: string } {
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
    private validatePath(path: string): void {
        const [key, category] = categoryFromPath(path);
        if (!category.values.find((value) => {
            return value.key === key;
        })) {
            throw new Error(`The settings path ${path} addresses an unregistered setting.`);
        }
    }

    private mergeProfileValues = (): Promise<boolean> => {
        this.values = Object.assign(this.values, webSession.profile.options);

        this.restartAutoSaveTimer();

        return requisitions.execute("settingsChanged", undefined);
    };

    private applicationWillFinish = (): Promise<boolean> => {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        requisitions.unregister(undefined, this.mergeProfileValues);
        requisitions.unregister(undefined, this.applicationWillFinish);

        this.saveSettings();

        return Promise.resolve(true);
    };

    private restartAutoSaveTimer(): void {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = null;
        }

        const interval = this.get("settings.autoSaveInterval", 300);
        if (interval > 0) {
            this.saveTimer = setInterval(() => {
                return this.saveSettings();
            }, interval * 1000);
        }
    }
}

export const settings = Settings.instance;
