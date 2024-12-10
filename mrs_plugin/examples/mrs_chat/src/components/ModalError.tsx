/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import styles from "./ModalError.module.css";

interface IModalErrorProps {
    error?: Error;
    resetError: () => void;
    logout: () => void;
}

/**
 * The ModalError Component renders an error message
 */
export default class ModalError extends Component<IModalErrorProps> {
    public render = (props: IModalErrorProps): ComponentChild => {
        const { error, resetError, logout } = props;

        if (error !== undefined) {
            return (
                <div className={styles.modal}>
                    <div className={styles.error}>
                        <p>{error.stack?.replace(/accessToken=.*?[&:]/gm, "accessToken=X:")}</p>
                        {error.cause ?? <p>{String(error.cause)}</p>}
                        <div className="errorButtons">
                            <button className="flatButton" onClick={() => { resetError(); }}>Close</button>
                            <button className="flatButton" onClick={() => { logout(); }}>Restart</button>
                        </div>
                    </div>
                </div>
            );
        }
    };
}
