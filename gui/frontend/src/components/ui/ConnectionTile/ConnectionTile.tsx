/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import { ComponentChild } from "preact";

import toolbarMenuIcon from "../../../assets/images/toolbar/toolbar-menu.svg";
import newNotebookIcon from "../../../assets/images/newNotebook.svg";
import newScriptIcon from "../../../assets/images/newScript.svg";

import { IConnectionDetails } from "../../../supplement/ShellInterface/index.js";
import { BrowserTile, IBrowserTileProperties } from "../BrowserTile/BrowserTile.js";
import { Button } from "../Button/Button.js";
import { Icon } from "../Icon/Icon.js";

export interface IConnectionTileProperties extends IBrowserTileProperties {
    details: IConnectionDetails;
}

export class ConnectionTile extends BrowserTile<IConnectionTileProperties> {

    public static defaultProps = {
        className: "connectionTile",
    };

    public constructor(props: IConnectionTileProperties) {
        super(props);

        this.addHandledProperties("details");
    }

    public render(): ComponentChild {
        return super.render();
    }

    protected renderTileActionUI = (): ComponentChild => {
        return (
            <>
                <Button
                    id="tileMoreActionsAction"
                    data-tooltip="More Actions"
                    imageOnly
                    onClick={this.handleActionClick}
                >
                    <Icon src={toolbarMenuIcon} data-tooltip="inherit" />
                </Button>
                <Button
                    id="tileNewNotebookAction"
                    data-tooltip="Create New Notebook"
                    imageOnly
                    onClick={this.handleActionClick}
                >
                    <Icon src={newNotebookIcon} data-tooltip="inherit" />
                </Button>
                <Button
                    id="tileNewScriptAction"
                    data-tooltip="Create New Script"
                    imageOnly
                    onClick={this.handleActionClick}
                >
                    <Icon src={newScriptIcon} data-tooltip="inherit" />
                </Button>
            </>
        );
    };

    private handleActionClick = (e: MouseEvent | KeyboardEvent): void => {
        const { onAction } = this.mergedProps;

        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).id;
        switch (id) {
            case "tileMoreActionsAction": {
                onAction?.("menu", this.mergedProps, { target: e.currentTarget as HTMLElement });

                break;
            }

            case "tileNewNotebookAction": {
                onAction?.("open", this.mergedProps, { newTab: e.metaKey || e.altKey, editor: "notebook" });

                break;
            }

            case "tileNewScriptAction": {
                onAction?.("open", this.mergedProps, { newTab: e.metaKey || e.altKey, editor: "script" });

                break;
            }

            default:
        }
    };

}
