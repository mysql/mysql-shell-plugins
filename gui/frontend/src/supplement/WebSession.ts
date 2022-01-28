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

import { Cookies } from "./Storage";
import { IDispatchDefaultEvent } from "./Dispatch";
import { ICommShellProfile } from "../communication";
import { ShellInterface } from "./ShellInterface";
import { requisitions } from "./Requisitions";

// Data specific to a module. This is the base structure which will be extended for individual modules.
export interface IModuleData {
    moduleName: string;
    sessionId: string;
}

export interface IWebSession {
    sessionId?: string;
    userId: number;
    userName: string;
    profileId: number;
    moduleSessionId: { [key: string]: string };
}

export class WebSession {
    public localUserMode = false;

    private cookies = new Cookies();
    private shellProfile: ICommShellProfile = {
        active: false,
        description: "",
        id: -1,
        name: "",
        userId: -1,
    };

    private sessionData: IWebSession;

    private constructor() {
        this.clearSessionData();
    }

    public static get instance(): WebSession {
        return new WebSession();
    }

    public get userId(): number {
        return this.sessionData.userId;
    }

    public set userId(userId: number) {
        this.sessionData.userId = userId;
        this.writeSessionData();
    }

    public get userName(): string {
        return this.sessionData.userName;
    }

    public set userName(name: string) {
        this.sessionData.userName = name;
        this.writeSessionData();
    }

    /**
     * @returns The profile data for the current session/user.
     */
    public get profile(): ICommShellProfile {
        return this.shellProfile;
    }

    /**
     * Stores new profile data for the current session/user. This will also
     * store the profile in the shell.
     *
     * @param newProfile The new profile data.
     */
    public set profile(newProfile: ICommShellProfile) {
        this.loadProfile(newProfile);

        this.saveProfile();
    }

    public get currentProfileId(): number {
        return this.shellProfile.id;
    }

    /**
     * @returns The ID of the current application session.
     */
    public get sessionId(): string | undefined {
        return this.sessionData.sessionId;
    }

    /**
     * Stores the given id as current application session ID. Will also be stored in the browser's session storage.
     */
    public set sessionId(id: string | undefined) {
        // For a new session remove old cookies.
        this.cookies.clear();

        this.sessionData.sessionId = id;
        //this.cookies.set("SessionId", this.sessionData.sessionId);
    }

    public clearSessionData(): void {
        this.sessionData = {
            sessionId: "",
            userName: "",
            profileId: -1,
            userId: -1,
            moduleSessionId: {},
        };
    }

    /**
     * Returns the session ID for a specific module.
     *
     * @param moduleName The module name for which to query the session ID.
     *
     * @returns The found ID or nothing if no module session exists.
     */
    public moduleSessionId(moduleName: string): string | undefined {
        return this.sessionData.moduleSessionId[moduleName];
    }

    /**
     * Sets the session ID for a specific module.
     *
     * @param moduleName The name of the module for which to set the session ID.
     * @param sessionId The session ID for that module. Will also be stored in the browser's session storage.
     */
    public setModuleSessionId(moduleName: string, sessionId: string): void {
        this.sessionData.moduleSessionId[moduleName] = sessionId;
        this.writeSessionData();
    }

    /**
     * Load a profile from the shell. Calling this function won't update the shell
     * as seen in Session.currentSession.profile = profile.
     *
     * @param newProfile the profile object to be loaded
     */
    public loadProfile(newProfile: ICommShellProfile): void {
        this.shellProfile = newProfile;
        this.sessionData.profileId = newProfile.id;

        this.writeSessionData();

        void requisitions.execute("profileLoaded", undefined);
    }

    /**
     * Sends the current profile data to the backend.
     */
    public saveProfile(): void {
        // Notify the shell for profile updates
        ShellInterface.users.updateProfile(this.shellProfile).then(() => {
            // TODO: log success.
        }).catch((errorEvent: IDispatchDefaultEvent) => {
            void requisitions.execute("showError", ["Profile Update Error", String(errorEvent.message)]);
        });

    }

    /**
     * Gets the data for a specific module instance
     *
     * @param name The name of the module.
     * @param sessionId The ID of the actual session for a module.
     *
     * @returns The requested module data.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public dataForModule(name: string, sessionId: string): IModuleData | undefined {
        // TODO: get module data from IndexedDB.
        return undefined;
    }

    /**
     * Sets the session data for a specific module.
     *
     * @param name The name of the module data to be stored.
     * @param sessionId The ID of the actual session for a module.
     * @param data The module data to be stored.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public setDataForModule(name: string, sessionId: string, data: IModuleData): void {
        // TODO: set module data in IndexedDB.
    }

    /**
     * Remove all data stored for a specific session of a module.
     *
     * @param name The name of the module.
     * @param sessionId The ID of the actual session for a module.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public removeDataForModule(name: string, sessionId: string): void {
        delete this.sessionData.moduleSessionId[name];

        // TODO: remove module data from IndexedDB.
    }

    private writeSessionData(): void {
        if (!process.env.VSCODE_PID) {
            //sessionStorage.setItem("session", JSON.stringify(this.sessionData));
        }
    }
}

export const webSession = WebSession.instance;
