/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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
import MrsLogin from "../../components/MrsLogin";
import styles from "./WelcomePage.module.css";
import type { MyService } from "../../myService.mrs.sdk/myService";
import { IMrsAuthApp } from "../../myService.mrs.sdk/MrsBaseClasses";

interface IWelcomePageProps {
    startLogin: (authApp: string) => void;
    handleLogin: (authApp?: string, accessToken?: string) => void;
    myService: MyService;
}

interface IWelcomePageState {
    notesServed: number;
    authApps?: IMrsAuthApp[];
    error?: string;
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
        const { myService } = this.props;

        try {
            const response = await myService.mrsNotes.notesServed.findFirst();

            if (typeof response === "undefined") {
                return undefined;
            }

            return response.notesServed ?? 0;
        } catch (e) {
            const errStr = (typeof e === "string") ? e : (e instanceof Error) ? e.message : "";
            this.setState({
                error: `Failed to connect to the REST endpoint:\n${myService.serviceUrl}` +
                    `/mrsNotes/notesServed\nError: ${errStr}`,
            });
        }
    };

    /**
     * Get the list of supported authApps. This is a public API call and needs no authentication
     *
     * @returns The list of enabled authApps
     */
    private readonly getAuthApps = async (): Promise<IMrsAuthApp[] | undefined> => {
        const { myService } = this.props;

        try {
            return await myService.getAuthApps();
        } catch (e) {
            return [];
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
        const { myService, handleLogin, startLogin } = props;
        const { notesServed, authApps, error } = state;
        // Build a human readable string of there are notesServed > 0
        const notesManaged = (notesServed > 0)
            ? `Managing ${notesServed ?? 0} note${notesServed !== 1 ? "s" : ""} for our users so far.`
            : "Managing notes for you.";
        // The built-in MRS authApp uses a specific ID
        const mrsAuthAppId = "0x30000000000000000000000000000000";
        const mrsAuthApp = authApps?.find((authApp) => {
            return authApp.vendorId === mrsAuthAppId;
        });
        const loginOptions = (authApps === undefined)
            ? <p>Loading ...</p>
            : ((authApps.length === 0)
                ? <p>No Authentication Apps setup for this MRS Service yet.</p>
                : <>
                    {(mrsAuthApp !== undefined)
                        ? <MrsLogin authApp={mrsAuthApp.name} handleLogin={handleLogin} myService={myService} />
                        : undefined
                    }
                    <div className={styles.loginButtons}>
                        {authApps.map((authApp) => {
                            return (authApp.vendorId !== mrsAuthAppId)
                                ? <button key={authApp.name} onClick={() => { startLogin(authApp.name); }}
                                    className={styles[`btn${authApp.name}`]}>Sign in with {authApp.name}</button>
                                : undefined;
                        })}
                    </div>
                </>
            );

        return (
            <div className="page">
                <div className={styles.welcome}>
                    <h1 className="gradientText">MRS Notes</h1>
                    <h2>Powered by the<br />MySQL REST Service.</h2>
                    <div className={styles.productInfo}>
                        <p>This example implements a simple note taking application that allows
                            note sharing between its users.</p>
                        <p className={styles.marketing}>{notesManaged}</p>
                    </div>
                    {(error !== undefined) ? <p className={styles.error}>{error}</p> : loginOptions}
                </div>
                <div className="footer">
                    <p>Copyright (c) 2022, 2023, Oracle and/or its affiliates.</p>
                </div>
            </div>);
    };
}
