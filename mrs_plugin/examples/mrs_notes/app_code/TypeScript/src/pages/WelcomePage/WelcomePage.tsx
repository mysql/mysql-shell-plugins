/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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
import { serviceUrl } from "../../app";
import styles from "./WelcomePage.module.css";

interface IWelcomePageProps {
    startLogin: (authApp: string) => void;
}

interface IWelcomePageState {
    notesServed: number;
    authApps?: string[];
}

/**
 * A WelcomePage Component that displays the number of managed notes and login buttons
 */
export default class WelcomePage extends Component<IWelcomePageProps, IWelcomePageState> {
    public constructor(props: IWelcomePageProps) {
        super(props);

        this.state = {
            notesServed: 0,
        };

        void this.getNotesServed().then((notesServed) => {
            this.setState({ notesServed });
        });

        void this.getAuthApps().then((authApps) => {
            this.setState({ authApps });
        });
    }

    /**
     * Get the number of served notes. This is a public API call and needs no authentication
     *
     * @returns The number of served notes or undefined, if there are none or an error occurred
     */
    private readonly getNotesServed = async (): Promise<number | undefined> => {
        try {
            const response = await fetch(`${serviceUrl}/mrsNotes/notesServed`);

            if (response.ok) {
                const result = await response.json();
                if (result.items !== undefined && result.items.length > 0) {
                    return result.items[0].notesServed as number ?? 0;
                } else {
                    return undefined;
                }
            }
        } catch (e) {
            // Ignore any exceptions
        }
    };

    /**
     * Get the list of supported authApps. This is a public API call and needs no authentication
     *
     * @returns The list of enabled authApps
     */
    private readonly getAuthApps = async (): Promise<string[] | undefined> => {
        try {
            const response = await fetch(`${serviceUrl}/authentication/authApps`);

            if (response.ok) {
                const result = await response.json();

                return result as string[];
            }
        } catch (e) {
            // Ignore any exceptions
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
    public render = (props: IWelcomePageProps, state: IWelcomePageState): ComponentChild => {
        const { startLogin } = props;
        const { notesServed, authApps } = state;
        // Build a human readable string of there are notesServed > 0
        const notesManaged = (notesServed > 0)
            ? `Managing ${notesServed ?? 0} note${notesServed !== 1 ? "s" : ""} for our users so far.`
            : "Managing notes for you.";
        const loginOptions = (authApps === undefined || authApps.length === 0)
            ? <p>No Authentication Apps setup for this MRS Service yet.</p>
            : authApps.map((authAppName) => {
                return (
                    <button key={authAppName} onClick={() => { startLogin(authAppName); }}
                        className={styles[`btn${authAppName}`]}>Login with {authAppName}</button>);
            });

        return (
            <div className="page">
                <div className={styles.welcome}>
                    <h1 className="gradientText">MRS Notes</h1>
                    <h2>Powered by the<br />MySQL REST Service.</h2>
                    <div className={styles.productInfo}>
                        <p>Writing a web app that uses the MySQL REST Service is straight forward.
                            This example implements a simple note taking application that allows
                            note sharing between its users.</p>
                        <p className={styles.marketing}>{notesManaged}</p>
                    </div>
                    <p>Choose one of the following login methods to start.</p>
                    <div className={styles.loginButtons}>
                        {loginOptions}
                    </div>
                </div>
                <div className="footer">
                    <p>Copyright (c) 2022, Oracle and/or its affiliates.</p>
                </div>
            </div>);
    };
}
