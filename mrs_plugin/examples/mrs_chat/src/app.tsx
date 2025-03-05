/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import { ComponentChild } from "preact";
import { ChatApp, IMrsAuthUser, IMrsAuthStatus } from "./chatApp.mrs.sdk/chatApp";
import { IAppState, MrsBaseApp } from "./chatApp.mrs.sdk/MrsBaseAppPreact";

import WelcomePage from "./pages/WelcomePage/WelcomePage";
import ModalError from "./components/ModalError";
import Header from "./components/Header";
import Chat from "./pages/ChatPage/ChatPage";

export interface IFetchInput {
    errorMsg?: string;
    method?: string;
    body?: object;
    input: string;
}

interface IMyAppState extends IAppState {
    user?: IMrsAuthUser;
}

export class App extends MrsBaseApp<ChatApp, IMrsAppConfig, IMyAppState> {
    public constructor({ services = [] }: IMrsAppConfig = { services: [] }) {
        super(new ChatApp(services[0].url), "HeatWaveChat");
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected afterHandleLogin = async (status: IMrsAuthStatus): Promise<void> => {
        // Make sure the user table has an entry for this user
        try {
            // Update the URL
            this.showPage("chat", false);
            // End the authenticating status and set the user info
            this.setState({ authenticating: false, user: status.user});
        } catch (e) {
            this.setState({ error: e instanceof Error ? e : Error(String(e)) });
        }
    };

    // eslint-disable-next-line @typescript-eslint/require-await
    protected afterLogout = async (): Promise<void> => {
        this.setState({ user: undefined });
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
    public render = (_props: undefined, state: IMyAppState): ComponentChild => {
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
        } else if (page.startsWith("#chat")) {
            return (
                <>
                    {errorHtml}
                    <div className="page">
                        <Header userNick={user?.name} showPage={this.showPage} logout={this.logout} />
                        <Chat showError={this.showError} showPage={this.showPage} chatApp={this.mrsService} />
                    </div>
                </>
            );
        }

        return (
            <WelcomePage chatApp={this.mrsService} startLogin={this.startLogin} handleLogin={this.handleLogin} />
        );
    };
}

export default App;
