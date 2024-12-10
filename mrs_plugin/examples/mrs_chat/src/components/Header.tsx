/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
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
import Icon from "./Icon";
import styles from "./Header.module.css";

interface IHeaderProps {
    userNick?: string,
    showPage: (page: string, forcedUpdate?: boolean) => void;
    logout: () => void;
}

/**
 * A simple Header Component that renders the app title and the current user
 */
export default class Header extends Component<IHeaderProps> {
    public render(props: IHeaderProps): ComponentChild {
        const { userNick, showPage, logout } = props;

        return (
            <div className={styles.header}>
                <Icon name="sakilaIcon" styleClass={styles.sakilaIconStyle}></Icon>
                <h1 onClick={() => { showPage("chat"); }}
                    onKeyPress={() => { /** */ }} role="button" tabIndex={-1}>HeatWave <span>Chat</span></h1>
                <p onClick={() => { showPage("user"); }}
                    onKeyPress={() => { /** */ }} role="button" tabIndex={-2}>{userNick ?? ""}</p>
                <Icon name="exitIcon" styleClass={styles.exitIconStyle} onClick={logout} />
            </div>);
    }
}
