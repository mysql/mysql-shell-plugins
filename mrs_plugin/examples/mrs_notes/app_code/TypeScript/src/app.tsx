/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { Component, ComponentChild } from "preact";

import WelcomePage from "./pages/WelcomePage/WelcomePage";
import UserPage from "./pages/UserPage/UserPage";
import ModalError from "./components/ModalError";
import Header from "./components/Header";
import Notes from "./pages/NotesPage/NotesPage";

// Defines the MySQL REST Service URL of the MRS Notes service
// Temporary pointing to "https://mrs.zinner.org/mrs". Will be removed once ready for push.
export const serviceUrl = "https://mrs.zinner.org/mrs"; // "https://localhost:8080/mrsnotes";

export interface IUser {
    name: string;
    nickname: string;
    email: string;
}

interface IAuthStatus {
    status: string;
    user?: IUser;
}

interface IAppState {
    authApp?: string;
    accessToken?: string;
    authenticating: boolean;
    restarting: boolean;
    user?: IUser;
    error?: Error,
}

export interface IFetchInput {
    errorMsg?: string;
    method?: string;
    body?: object;
    input: string;
}

export class App extends Component<{}, IAppState> {
    public constructor() {
        super();

        // Fetch URL parameters
        const urlParams = new URLSearchParams(window.location.search);

        let accessToken = urlParams.get("accessToken");
        let authApp = urlParams.get("authApp");

        // If accessToken is not specified, check window.localStorage
        if (accessToken === null) {
            accessToken = window.localStorage.getItem("jwtAccessToken");
        } else {
            // If it was specified, store it in the window.localStorage
            window.localStorage.setItem("jwtAccessToken", accessToken);

            // Clean Browser URL without reloading the page
            window.history.replaceState(undefined, "", this.getUrlWithNewSearchString());
        }

        // Store/restore authApp from window.localStorage as well
        if (authApp === null) {
            authApp = window.localStorage.getItem("mrsNotesAuthApp");
        } else {
            window.localStorage.setItem("mrsNotesAuthApp", authApp);
        }

        // Ensure to force a render update to reflect URL hash changes when the user clicks the back button
        window.addEventListener("hashchange", () => {
            this.forceUpdate();
        }, false);

        // Initialize the App Component"s state variables
        this.state = {
            authApp: authApp ?? undefined,
            accessToken: accessToken ?? undefined,
            authenticating: accessToken !== null,
            restarting: false,
        };

        // Check if the current accessToken is still valid
        if (accessToken !== null) {
            void this.getAuthenticationStatus().then((status) => {
                if (status?.status === "authorized") {
                    // Make sure the user table has an entry for this user
                    this.ensureUserAccount(status?.user as IUser).then(() => {
                        // Update the URL
                        this.showPage("notes", false);

                        // End the authenticating status and set the user info
                        this.setState({ authenticating: false, user: status.user });
                    }).catch((e) => {
                        this.setState({ error: e });
                    });
                } else {
                    // If not, go back to login page
                    this.logout();
                }
            });
        }
    }

    /**
     * Returns the current URL with a new URL search string
     *
     * @param searchString The new search string to use
     *
     * @returns The current URL with a new searchString
     */
    private readonly getUrlWithNewSearchString = (searchString: string = ""): string => {
        return window.location.protocol + "//" + window.location.host + window.location.pathname +
            `?${searchString}` + window.location.hash;
    };

    /**
     * A small wrapper around fetch() that uses the active JWT accessToken to the MRS and throws
     * an exception if the response was not OK
     *
     * @param input The RequestInfo, either a URL string or a JSON object with named parameters
     * @param errorMsg The error message to include in the exception if the fetch is not successful
     * @param method The HTTP method to use with GET being the default
     * @param body The request body as object
     *
     * @returns The response object
     */
    public doFetch = async (input: string | IFetchInput, errorMsg?: string,
        method?: string, body?: object): Promise<Response> => {
        const { accessToken, authApp } = this.state;

        // Check if parameters are passed as named parameters and if so, assign them
        if (typeof input === "object" && input !== null) {
            errorMsg = input?.errorMsg ?? "Failed to fetch data.";
            method = input?.method ?? "GET";
            body = input?.body;
            input = input?.input;
        } else {
            errorMsg = errorMsg ?? "Failed to fetch data.";
            method = method ?? "GET";
        }

        let response;

        try {
            response = await fetch(`${serviceUrl}${input}`, {
                method,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: (accessToken !== undefined) ? { Authorization: "Bearer " + accessToken } : undefined,
                body: (body !== undefined) ? JSON.stringify(body) : undefined,
            });
        } catch (e) {
            throw new Error(`${errorMsg}\n\nPlease check if a MRS DB Object with the ` +
                `path ${serviceUrl}${input} does exist.`);
        }

        if (!response.ok) {
            // Check if the current session has expired
            if (response.status === 401) {
                this.setState({ restarting: true });
                window.alert("Your current session expired. You will be logged in again.");

                void this.startLogin((authApp !== undefined) ? authApp : "MySQL");
            } else {
                let errorInfo = null;
                try {
                    errorInfo = await response.json();
                } catch (e) {
                    // Ignore the exception
                }
                throw new Error(`${response.status}. ${errorMsg} (${response.statusText})` +
                    `${(errorInfo !== undefined) ? ("\n\n" + JSON.stringify(errorInfo, null, 4) + "\n") : ""}`);
            }
        }

        return response;
    };

    /**
     * Starts the login process using the given authApp
     *
     * @param authApp The name of the MRS auth_app
     */
    public startLogin = (authApp: string): void => {
        // Encode current URL but replace the location.search with the authApp name
        const redirectUrl = encodeURIComponent(this.getUrlWithNewSearchString(`authApp=${authApp}`));

        const loginPath = `${serviceUrl}/authentication/login?app=${authApp}&sessionType=bearer` +
            `&onCompletionRedirect=${redirectUrl}`;

        window.location.href = loginPath;
    };

    /**
     * Resets the page URL and the app state
     */
    public logout = (): void => {
        window.localStorage.removeItem("jwtAccessToken");
        window.history.pushState({}, document.title, window.location.pathname);
        this.setState({ accessToken: undefined, user: undefined, authenticating: false, error: undefined });
    };

    /**
     * Gets the authentication status of the current session as defined by the accessToken
     *
     * @returns The response object with {"status":"authorized", "user": {...}} or {"status":"unauthorized"}
     */
    private readonly getAuthenticationStatus = async (): Promise<IAuthStatus> => {
        try {
            return (await (await this.doFetch(
                { input: `/authentication/status`, errorMsg: "Failed to authenticate." })).json()) as IAuthStatus;
        } catch (e) {
            return { status: "unauthorized" };
        }
    };

    private readonly ensureUserAccount = async (user: IUser): Promise<void> => {
        // Try to get the current user
        const existingUser = await (await this.doFetch({ input: "/mrsNotes/user" })).json();

        // If the user is not registered yet, add a row to the user table
        if (existingUser?.items?.length === 0) {
            await this.doFetch({
                input: "/mrsNotes/user",
                errorMsg: "Failed to create user account.",
                method: "POST",
                body: {
                    nickname: user?.name,
                    email: user?.email,
                },
            });

            user.nickname = user?.name;
        } else if (existingUser?.items?.length === 1) {
            user.nickname = existingUser.items[0].nickname;
            user.email = existingUser.items[0].email;
        }
    };

    /**
     * Updates the user component state
     *
     * @param user The new user settings
     */
    public updateUser = (user: IUser): void => {
        this.setState({ user });
    };

    /**
     * Displays the given page by setting the URL hash accordingly
     *
     * @param page The name of the page (without # prefix)
     * @param forcedUpdate Whether a render of the app should be triggered
     */
    public showPage = (page: string, forcedUpdate = true): void => {
        // Update the URL
        window.history.pushState(undefined, "", "#" + page);

        // Force a render update to reflect the changed URL hash
        if (forcedUpdate) {
            this.forceUpdate();
        }
    };

    /**
     * Displays the given error by setting the error component state
     *
     * @param error The Error object to display
     */
    public showError = (error: unknown): void => {
        this.setState({ error: error instanceof Error ? error : new Error(String(error), { cause: error }) });
    };

    /**
     * Resets the current error display
     */
    public resetError = (): void => {
        this.setState({ error: undefined });
    };

    /**
     * The component's render function
     *
     * @param _props The component's properties
     * @param state The component's state
     *
     * @returns ComponentChild
     */
    public render = (_props: undefined, state: IAppState): ComponentChild => {
        const { error, authenticating, restarting, user } = state;
        const page = window.location.hash;
        const errorHtml = restarting
            ? null
            : <ModalError error={error} resetError={this.resetError} logout={this.logout} />;

        if (authenticating) {
            return (
                <>
                    {errorHtml}
                    <div className="page">
                        <div className="doCenter">
                            <p>Loading ...</p>
                        </div>
                    </div>
                </>
            );
        } else if (page === "#user" || page.startsWith("#notes")) {
            return (
                <>
                    {errorHtml}
                    <div className="page">
                        <Header userNick={user?.nickname} showPage={this.showPage} logout={this.logout} />
                        {page === "#user" &&
                            <UserPage doFetch={this.doFetch} showError={this.showError} showPage={this.showPage}
                                user={user} updateUser={this.updateUser} />
                        }
                        {page.startsWith("#notes") &&
                            <Notes doFetch={this.doFetch} showError={this.showError} showPage={this.showPage} />
                        }
                    </div>
                </>
            );
        }

        return (
            <WelcomePage startLogin={this.startLogin} />
        );
    };
}

export default App;
