/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { Component } from "preact";
import {
    IMrsAuthStatus, MrsBaseService,
} from "./MrsBaseClasses";

export interface IAppState {
    authenticating: boolean;
    restarting: boolean;
    error?: Error;
}

export abstract class MrsBaseApp<Service extends MrsBaseService, State extends IAppState> extends Component<{}, State> {
    public constructor(
        protected mrsService: Service,
        protected appName: string,
        stateParams?: Partial<State>) {
        super();

        // Initialize the App Component's state variables
        stateParams ??= {};

        this.state = {
            authenticating: false,
            restarting: false,
            ...stateParams,
        } as State;

        // Ensure to force a render update to reflect URL hash changes when the user clicks the back button
        globalThis.addEventListener("hashchange", () => {
            this.forceUpdate();
        }, false);

        this.handleLogin();
    }

    /**
     * Returns the current URL with a new URL search string
     *
     * @param searchString The new search string to use
     *
     * @returns The current URL with a new searchString
     */
    public static readonly getUrlWithNewSearchString = (searchString: string = ""): string => {
        return globalThis.location.protocol + "//" + globalThis.location.host + globalThis.location.pathname +
            (searchString !== "" ? `?${searchString}` : "") + globalThis.location.hash;
    };

    /**
     * Starts the login process using the given authApp
     *
     * @param authApp The name of the MRS auth_app
     */
    public readonly startLogin = (authApp?: string): void => {
        if (authApp !== undefined) {
            // Encode current URL but replace the location.search with the authApp name
            const redirectUrl = encodeURIComponent(MrsBaseApp.getUrlWithNewSearchString(`authApp=${authApp}`));

            globalThis.location.href =
                `${this.mrsService.serviceUrl}/authentication/login?app=${authApp}&sessionType=bearer` +
                `&onCompletionRedirect=${redirectUrl}`;
        } else {
            globalThis.location.href = MrsBaseApp.getUrlWithNewSearchString();
        }
    };

    /**
     * Resets the page URL and the app state
     */
    public logout = (): void => {
        globalThis.localStorage.removeItem(`${this.appName}JwtAccessToken`);
        globalThis.localStorage.removeItem(`${this.appName}AuthApp`);
        globalThis.localStorage.removeItem(`${this.appName}BuiltInAuth`);
        globalThis.history.pushState({}, document.title, globalThis.location.pathname);
        this.setState({ authenticating: false, error: undefined }, void this.afterLogout);
    };

    /**
     * Handles the login process
     *
     * @param authApp The authApp, if already know
     * @param accessToken The accessToken, if already given
     * @param mrsBuiltInAuth Set to true when the built in MRS Auth should be used
     */
    public handleLogin = (authApp?: string, accessToken?: string, mrsBuiltInAuth = false): void => {
        // Fetch URL parameters
        const urlParams = new URLSearchParams(globalThis.location.search);

        // If the authApp and accessToken have not been passed as parameters, check if they are given as URL parameters
        if (authApp === undefined) {
            const authAppParam = urlParams.get("authApp");
            authApp = authAppParam !== null ? authAppParam : undefined;
        }
        if (accessToken === undefined) {
            const accessTokenParam = urlParams.get("accessToken");
            accessToken = accessTokenParam !== null ? accessTokenParam : undefined;
        }

        // If accessToken is not specified, check globalThis.localStorage
        if (accessToken === undefined) {
            const storedJwtAccessToken = globalThis.localStorage.getItem(`${this.appName}JwtAccessToken`);
            accessToken = storedJwtAccessToken !== null ? storedJwtAccessToken : undefined;
            // TODO: maybe we need a public API to add a token in the SDK
            this.mrsService.session.accessToken = accessToken;
        } else {
            this.mrsService.session.accessToken = accessToken;
            // If it was specified, store it in the globalThis.localStorage
            globalThis.localStorage.setItem(`${this.appName}JwtAccessToken`, accessToken);
            // Clean Browser URL without reloading the page
            globalThis.history.replaceState(undefined, "", MrsBaseApp.getUrlWithNewSearchString());
        }

        // Store/restore authApp from globalThis.localStorage as well
        if (authApp === undefined) {
            const storedMrsNotesAuthApp = globalThis.localStorage.getItem(`${this.appName}AuthApp`);
            authApp = storedMrsNotesAuthApp !== null ? storedMrsNotesAuthApp : undefined;
            const storedMrsBuiltInAuth = globalThis.localStorage.getItem(`${this.appName}BuiltInAuth`);
            mrsBuiltInAuth = storedMrsBuiltInAuth !== null ? (storedMrsBuiltInAuth === "true") : false;
        } else {
            globalThis.localStorage.setItem(`${this.appName}AuthApp`, authApp);
            globalThis.localStorage.setItem(`${this.appName}BuiltInAuth`, String(mrsBuiltInAuth));
        }

        // This triggers a "Loading..." message until afterHandleLogin() or logout() finish.
        this.setState({ authenticating: accessToken !== undefined });

        // Check if the current accessToken is still valid
        if (accessToken !== undefined) {
            void this.mrsService.session.getAuthenticationStatus().then((status) => {
                if (status?.status === "authorized") {
                    // Execute additional handling that is defined in derived app class
                    this.afterHandleLogin(status).catch(() => {
                        this.logout();
                    });
                } else {
                    // If not, go back to login page
                    this.logout();
                }
            });
        }
    };

    protected afterLogout = async (): Promise<void> => { /** */ };
    protected afterHandleLogin = async (_status: IMrsAuthStatus): Promise<void> => { /** */ };
}
