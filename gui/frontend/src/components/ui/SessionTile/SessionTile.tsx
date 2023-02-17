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

import "./SessionTile.css";
import closeIcon from "../../../assets/images/close2.svg";

import { BrowserTile, IBrowserTileProperties } from "../BrowserTile/BrowserTile";
import { IShellSessionDetails } from "../../../supplement/ShellInterface";
import { ComponentChild } from "preact";
import { Icon } from "../Icon/Icon";

export interface ISessionTileProperties extends IBrowserTileProperties {
    details: IShellSessionDetails;
}

export class SessionTile extends BrowserTile<ISessionTileProperties> {

    public static defaultProps = {
        className: "sessionTile",
    };

    public constructor(props: ISessionTileProperties) {
        super(props);

        this.addHandledProperties("details");
    }

    public render(): ComponentChild {
        return super.render();
    }

    protected renderTileActionUI = (): ComponentChild => {
        return (
            <Icon
                src={closeIcon}
                onClick={this.handleActionClick}
            />
        );
    };

    private handleActionClick = (e: MouseEvent | KeyboardEvent): void => {
        const { onAction } = this.mergedProps;

        e.stopPropagation();
        onAction?.("remove", this.mergedProps, {});
    };

}
