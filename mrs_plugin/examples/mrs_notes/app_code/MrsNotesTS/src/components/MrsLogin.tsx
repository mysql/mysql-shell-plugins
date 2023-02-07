/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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
import { IFetchInput } from "../app";
import styles from "./MrsLogin.module.css";

interface IAuthChallenge {
    nonce: string;
    iterations: number;
    salt: Uint8Array;
    session?: string;
}

interface IMrsLoginProps {
    doFetch: (input: string | IFetchInput, errorMsg?: string,
        method?: string, body?: object, autoResponseCheck?: boolean) => Promise<Response>,
    handleLogin: (authApp?: string, accessToken?: string, mrsBuiltInAuth?: boolean) => void,
    authApp: string;
}

interface IMrsLoginState {
    userName: string;
    password: string;
    clientFirst: string;
    clientFinal: string;
    serverFirst: string;
    challenge: IAuthChallenge;
    loginError: string;
}

/**
 * A WelcomePage Component that displays the number of managed notes and login buttons
 */
export default class MrsLogin extends Component<IMrsLoginProps, IMrsLoginState> {
    public constructor(props: IMrsLoginProps) {
        super(props);
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

        this.setState({ userName, clientFirst: undefined, password: undefined, loginError: undefined });
    };

    private readonly passwordChange = (password: string): void => {
        this.setStateClassStyle("passwordBtn", password !== "" ? styles.active : undefined);

        this.setState({ password });
    };

    private readonly showLoginError = (error: string): void => {
        this.setStateClassStyle("userNameBtn");
        this.setStateClassStyle("passwordBtn");

        this.setState({ clientFirst: undefined, password: undefined, loginError: error }, () => {
            const e = document.getElementById("userName") as HTMLInputElement | null;
            e?.focus();
            e?.select();
        });
    };

    private readonly hex = (arrayBuffer: Uint8Array): string => {
        return Array.from(new Uint8Array(arrayBuffer))
            .map((n) => { return n.toString(16).padStart(2, "0"); })
            .join("");
    };

    private readonly buildServerFirst = (challenge: IAuthChallenge): string => {
        const b64Salt = window.btoa(String.fromCharCode.apply(null, Array.from(challenge.salt)));

        return `r=${challenge.nonce},s=${b64Salt},i=${String(challenge.iterations)}`;
    };

    private readonly calculatePbkdf2 = async (password: BufferSource, salt: Uint8Array,
        iterations: number): Promise<Uint8Array> => {
        const ck1 = await crypto.subtle.importKey(
            "raw", password, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]);
        const result = new Uint8Array(await crypto.subtle.deriveBits(
            { name: "PBKDF2", hash: "SHA-256", salt, iterations }, ck1, 256));

        return result;
    };

    private readonly calculateSha256 = async (data: BufferSource): Promise<Uint8Array> => {
        return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    };

    private readonly calculateHmac = async (secret: BufferSource, data: BufferSource): Promise<Uint8Array> => {
        const key = await window.crypto.subtle.importKey(
            "raw", secret, { name: "HMAC", hash: { name: "SHA-256" } }, true, ["sign", "verify"]);
        const signature = await window.crypto.subtle.sign("HMAC", key, data);

        return new Uint8Array(signature);
    };

    private readonly calculateXor = (a1: Uint8Array, a2: Uint8Array): Uint8Array => {
        const l1 = a1.length;
        const l2 = a2.length;
        // cSpell:ignore amax
        let amax;
        let amin;
        let loop;

        if (l1 > l2) {
            amax = new Uint8Array(a1);
            amin = a2;
            loop = l2;
        } else {
            amax = new Uint8Array(a2);
            amin = a1;
            loop = l1;
        }

        for (let i = 0; i < loop; ++i) {
            amax[i] ^= amin[i];
        }

        return amax;
    };

    private readonly calculateClientProof = async (password: string, salt: Uint8Array, iterations: number,
        authMessage: Uint8Array): Promise<Uint8Array> => {
        const te = new TextEncoder();
        const saltedPassword = await this.calculatePbkdf2(te.encode(password), salt, iterations);
        const clientKey = await this.calculateHmac(saltedPassword, te.encode("Client Key"));
        const storedKey = await this.calculateSha256(clientKey);
        const clientSignature = await this.calculateHmac(storedKey, authMessage);
        const clientProof = this.calculateXor(clientSignature, clientKey);

        return clientProof;
    };

    private readonly verifyUserName = async (): Promise<void> => {
        const { doFetch, authApp } = this.props;
        const { userName } = this.state;

        const nonce = this.hex(crypto.getRandomValues(new Uint8Array(10)));

        this.setStateClassStyle("userNameBtn", styles.loading);
        try {
            const challenge: IAuthChallenge = await (await doFetch({
                input: `/authentication/login?app=${authApp}`,
                method: "POST",
                body: {
                    user: userName,
                    nonce,
                },
            })).json();

            // Convert the salt to and Uint8Array
            challenge.salt = new Uint8Array(challenge.salt);

            this.setState({
                clientFirst: `n=${userName},r=${nonce}`,
                clientFinal: `r=${challenge.nonce}`,
                serverFirst: this.buildServerFirst(challenge),
                challenge,
                loginError: undefined,
            }, () => { document.getElementById("userPassword")?.focus(); });
        } finally {
            this.setStateClassStyle("userNameBtn", userName !== "" ? styles.active : undefined);
        }
    };

    private readonly verifyPassword = async (): Promise<void> => {
        const { doFetch, handleLogin, authApp } = this.props;
        const { password, challenge, clientFirst, serverFirst, clientFinal } = this.state;

        if (password !== undefined && password !== "") {
            const te = new TextEncoder();
            const authMessage = `${clientFirst},${serverFirst},${clientFinal}`;
            const clientProof = Array.from(await this.calculateClientProof(
                password, challenge.salt, challenge.iterations, te.encode(authMessage)));

            this.setStateClassStyle("passwordBtn", styles.loading);
            try {
                const response = await doFetch({
                    input: `/authentication/login?app=${authApp}&sessionType=bearer` +
                        (challenge.session !== undefined ? "&session=" + challenge.session : ""),
                    method: "POST",
                    body: {
                        clientProof,
                        nonce: challenge.nonce,
                        state: "response",
                    },
                }, undefined, undefined, undefined, false);

                if (!response.ok) {
                    if (response.status === 401) {
                        this.showLoginError("The sign in failed. Please check your username and password.");
                    } else {
                        this.showLoginError(`The sign in failed. Error code: ${String(response.status)}`);
                    }
                } else {
                    const result = await response.json();

                    handleLogin(authApp, String(result.accessToken), true);
                }
            } catch (e) {
                this.showLoginError(`The sign in failed. Server Error: ${String(e)}`);
            } finally {
                this.setStateClassStyle("userNameBtn", password !== "" ? styles.active : undefined);
            }
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
        const { userName, password, clientFirst, loginError } = state;

        return (
            <div className={styles.mrsLogin}>
                <p>Sign in with {authApp}</p>
                <div className={styles.mrsLoginFields}>
                    <div className={styles.mrsLoginField}>
                        <input type="text" id="userName" placeholder="User Name or Email" autoFocus value={userName}
                            onInput={(e) => { this.userNameChange((e.target as HTMLInputElement).value); }}
                            onKeyPress={(e) => { if (e.keyCode === 13) { void this.verifyUserName(); } }} />
                        {clientFirst === undefined && <div id="userNameBtn" className={styles.mrsLoginBtnNext}
                            onClick={() => { void this.verifyUserName(); }} />
                        }
                    </div>
                    {clientFirst !== undefined &&
                        <div className={styles.mrsLoginField}>
                            <input type="password" id="userPassword" placeholder="Password" value={password}
                                onInput={(e) => { this.passwordChange((e.target as HTMLInputElement).value); }}
                                onKeyPress={(e) => { if (e.keyCode === 13) { void this.verifyPassword(); } }} />
                            <div id="passwordBtn" className={styles.mrsLoginBtnNext}
                                onClick={() => { void this.verifyPassword(); }} />
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
