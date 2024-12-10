/* eslint-disable jsx-a11y/no-autofocus */
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

import { Component, ComponentChild } from "preact";
import styles from "./MrsLogin.module.css";
import type { ChatApp } from "../chatApp.mrs.sdk/chatApp";

interface IMrsLoginProps {
    handleLogin: (authApp?: string, accessToken?: string, mrsBuiltInAuth?: boolean) => void;
    authApp: string;
    chatApp: ChatApp;
}

interface IMrsLoginState {
    userName: string;
    password?: string;
    loginError?: string;
    userNameVerified: boolean;
}

/**
 * A WelcomePage Component that displays the number of managed notes and login buttons
 */
export default class MrsLogin extends Component<IMrsLoginProps, IMrsLoginState> {
    public constructor(props: IMrsLoginProps) {
        super(props);

        this.state = {
            userName: "",
            userNameVerified: false,
        };
    }

    private readonly setStateClassStyle = (id: string, className?: string): void => {
        const e = document.getElementById(id);

        // Remove unwanted styles
        if (className !== styles.active) { e?.classList.remove(styles.active); }
        if (className !== styles.loading) { e?.classList.remove(styles.loading); }

        // Added desired style
        if (className !== undefined) { e?.classList.add(className); }
    };

    private readonly userNameChange = (userName: string): void => {
        this.setStateClassStyle("userNameBtn", userName !== "" ? styles.active : undefined);

        this.setState({ userName, userNameVerified: false, password: undefined, loginError: undefined });
    };

    private readonly passwordChange = (password: string): void => {
        this.setStateClassStyle("passwordBtn", password !== "" ? styles.active : undefined);

        this.setState({ password });
    };

    private readonly showLoginError = (error: string): void => {
        this.setStateClassStyle("userNameBtn");
        this.setStateClassStyle("passwordBtn");

        this.setState({ password: undefined, loginError: error }, () => {
            const e = document.getElementById("userName") as HTMLInputElement | null;
            e?.focus();
            e?.select();
        });
    };

    private readonly verifyUserName = async (): Promise<void> => {
        const { authApp, chatApp: myService } = this.props;
        const { userName } = this.state;

        this.setStateClassStyle("userNameBtn", styles.loading);
        try {
            await myService.session.verifyUserName(authApp, userName);

            this.setState({
                userNameVerified: true,
            }, () => { document.getElementById("userPassword")?.focus(); });
        } finally {
            this.setStateClassStyle("userNameBtn", userName !== "" ? styles.active : undefined);
        }
    };

    private readonly verifyPassword = async (): Promise<void> => {
        const { handleLogin, chatApp: myService } = this.props;
        const { password } = this.state;

        if (password !== undefined && password !== "") {
            this.setStateClassStyle("passwordBtn", styles.loading);

            const response = await myService.session.verifyPassword(password);

            if (response.errorCode !== null && response.errorCode !== undefined) {
                this.showLoginError(response.errorMessage as string);
            }

            handleLogin(response.authApp, response.jwt, true);
            this.setStateClassStyle("userNameBtn", password !== "" ? styles.active : undefined);
        }
    };

    /**
     * The component's render function
     *
     * @param props The component's properties
     * @param state The component's state
     *
     * @returns The rendered ComponentChild
     */
    public render = (props: IMrsLoginProps, state: IMrsLoginState): ComponentChild => {
        const { authApp } = props;
        const { userName, password, loginError, userNameVerified } = state;

        return (
            <div className={styles.mrsLogin}>
                <p>Sign in with {authApp}</p>
                <div className={styles.mrsLoginFields}>
                    <div className={styles.mrsLoginField}>
                        <input type="text" id="userName" placeholder="User Name or Email" autoFocus value={userName}
                            onInput={(e) => { this.userNameChange((e.target as HTMLInputElement).value); }}
                            onKeyPress={(e) => { if (e.keyCode === 13) { void this.verifyUserName(); } }} />
                        {!userNameVerified && <div id="userNameBtn" className={styles.mrsLoginBtnNext}
                            onClick={() => { void this.verifyUserName(); }}
                            onKeyPress={() => { /** */ }} role="button" tabIndex={-1} />
                        }
                    </div>
                    {userNameVerified &&
                        <div className={styles.mrsLoginField}>
                            <input type="password" id="userPassword" placeholder="Password" value={password}
                                onInput={(e) => { this.passwordChange((e.target as HTMLInputElement).value); }}
                                onKeyPress={(e) => { if (e.keyCode === 13) { void this.verifyPassword(); } }} />
                            <div id="passwordBtn" className={styles.mrsLoginBtnNext}
                                onClick={() => { void this.verifyPassword(); }}
                                onKeyPress={() => { /** */ }} role="button" tabIndex={-2} />
                        </div>
                    }
                </div>
                {loginError !== undefined &&
                    <div className={styles.mrsLoginError}><p>{loginError}</p></div>
                }
                <div className={styles.mrsLoginSeparator}></div>
            </div>);
    };
}
