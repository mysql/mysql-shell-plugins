/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { appParameters, requisitions } from "./Requisitions.js";
import { IShellProfile } from "../communication/ProtocolGui.js";
import { ShellInterface } from "./ShellInterface/ShellInterface.js";
import { Cookies } from "./Storage/Cookies.js";
import { ui } from "../app-logic/UILayer.js";
import { convertErrorToString } from "../utilities/helpers.js";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../utilities/string-helpers.js";

/** Determines what conditions are used when running the app. The UI will change based on that.  */
export enum RunMode {
    /** This is the standard mode which requires a shell user login. */
    Normal,

    /** The app runs with a predefined local administrator account. This is only possible with local installations. */
    LocalUser,

    /** The app runs in a mode where it can only connect to a single MySQL server. */
    SingleServer,
}
interface IWebSessionData {
    sessionId?: string;
    userId: number;
    userName: string;
    profileId: number;
    moduleSessionId: { [key: string]: string; };
}

export interface ILoginCredentials {
    userName: string;
    password: string;
}

interface IEncryptedCredentials {
    iv: number[];
    data: number[];
}

class WebSession {
    /** Which run mode is used for this session? */
    public runMode = RunMode.Normal;

    private cookies = new Cookies();
    private shellProfile: IShellProfile = {
        description: "",
        id: -1,
        name: "",
        userId: -1,
        options: {},
    };

    private sessionData!: IWebSessionData;

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
    }

    public get userName(): string {
        return this.sessionData.userName;
    }

    public set userName(name: string) {
        this.sessionData.userName = name;
    }

    /**
     * @returns The profile data for the current session/user.
     */
    public get profile(): IShellProfile {
        return this.shellProfile;
    }

    /**
     * Stores new profile data for the current session/user. This will also
     * store the profile in the shell.
     *
     * @param newProfile The new profile data.
     */
    public set profile(newProfile: IShellProfile) {
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
     * Stores the given id as current application session ID. Will also be stored in a cookie for the BE.
     */
    public set sessionId(id: string | undefined) {
        // For a new session remove old cookies.
        this.cookies.clear();

        this.sessionData.sessionId = id;
        if (id) {
            this.cookies.set("SessionId", id);
        }
        this.cookies.set("SameSite", "None");
        this.cookies.set("Secure");
    }

    public clearSessionData(): void {
        this.sessionData = {
            sessionId: "",
            userName: "",
            profileId: -1,
            userId: -1,
            moduleSessionId: {},
        };

        this.shellProfile = {
            description: "",
            id: -1,
            name: "",
            userId: -1,
            options: {},
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
    public setModuleSessionId(moduleName: string, sessionId?: string): void {
        if (sessionId) {
            this.sessionData.moduleSessionId[moduleName] = sessionId;
        } else {
            delete this.sessionData.moduleSessionId[moduleName];
        }
    }

    /**
     * Load a profile from the shell. Calling this function won't update the shell
     * as seen in Session.currentSession.profile = profile.
     *
     * @param newProfile the profile object to be loaded
     */
    public loadProfile(newProfile: IShellProfile): void {
        this.shellProfile = newProfile;
        this.sessionData.profileId = newProfile.id;
        this.sessionData.userId = newProfile.userId;

        void requisitions.execute("profileLoaded", undefined);
    }

    /**
     * Sends the current profile data to the backend.
     */
    public saveProfile(): void {
        // Notify the shell for profile updates
        ShellInterface.users.updateProfile(this.shellProfile).then(() => {
            if (!appParameters.inExtension) {
                void ui.showInformationMessage("Profile updated successfully.", {});
            }
        }).catch((reason) => {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Profile Update Error: ${message}`, {});
        });

    }

    /**
     * Encrypts the given credentials and stores them in session storage, available only for the current session.
     *
     * @param credentials The credentials to encrypt.
     */
    public async encryptCredentials(credentials: ILoginCredentials): Promise<void> {
        const key = await this.authKey;
        if (!key) {
            return;
        }

        // Encrypt the credentials with a random init vector.
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key,
            new TextEncoder().encode(JSON.stringify(credentials)),
        );

        // Store both, the encrypted credentials and the init vector in session storage.
        const encryptedCredentials: IEncryptedCredentials = {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted)),
        };
        sessionStorage.setItem("creds", JSON.stringify(encryptedCredentials));
    }

    /**
     * Decrypts the credentials stored in session storage.
     *
     * @returns The decrypted credentials or undefined if no credentials are stored.
     */
    public async decryptCredentials(): Promise<ILoginCredentials | undefined> {
        const key = await this.authKey;
        if (!key) {
            return;
        }

        const stored = sessionStorage.getItem("creds");
        if (!stored) {
            return undefined;
        }

        try {
            const { iv, data } = JSON.parse(stored) as IEncryptedCredentials;
            const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) },
                key, new Uint8Array(data));

            return JSON.parse(new TextDecoder().decode(decrypted)) as ILoginCredentials;
        } catch (e) {
            return undefined;
        }
    }

    public clearCredentials(): void {
        sessionStorage.removeItem("creds");
    }

    private get authKey(): Promise<CryptoKey | undefined> {
        if (appParameters.inExtension) { // sessionStorage is not available in the extension.
            return Promise.resolve(undefined);
        }

        const stringKey = sessionStorage.getItem("encryptionKey");
        if (!stringKey) {
            return Promise.resolve(undefined);
        }

        const rawKey = base64ToArrayBuffer(stringKey);

        return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    }

    static {
        // Generate our auth key for encrypting credentials. But not when we are running tests or in the extension.
        // This is because JSDOM has no support for crypto.sublte and the extension does not support session storage.
        if (!appParameters.testsRunning && !appParameters.inExtension && !sessionStorage.getItem("encryptionKey")) {
            void crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
                .then((key) => {
                    void crypto.subtle.exportKey("raw", key).then((rawKey) => {
                        const base64Key = arrayBufferToBase64(rawKey);
                        sessionStorage.setItem("encryptionKey", base64Key);
                    });
                });
        }
    }
}

export const webSession = WebSession.instance;
