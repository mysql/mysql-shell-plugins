/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import "./ConnectionTile.css";

import { ComponentChild, createRef } from "preact";

import type { ICdmConnectionEntry, ICdmConnectionGroupEntry } from "../../../data-models/ConnectionDataModel.js";
import { Assets } from "../../../supplement/Assets.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";
import { filterInt } from "../../../utilities/string-helpers.js";
import { Button } from "../Button/Button.js";
import type { Codicon } from "../Codicon.js";
import { ComponentBase, DragEventType, type IComponentProperties } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";

/** The tile type determines the presentation of the tile. */
export enum ConnectionTileType {
    /** Activates the tile. */
    Open = 0,

    /** Triggers creation of a new entry. */
    CreateNew = 1,

    /** Identifies this tile as being a group. */
    Group = 2,

    /** The tile to return from a group to the next upper level. */
    Back = 3,
}

export interface ITileActionOptions {
    newTab?: boolean;
    target?: HTMLElement | null;
    editor?: "notebook" | "script";

    id?: string;
    endpoints?: Array<{ ipAddress: string; }>;
    displayName?: string;
    description?: string;
    compartmentId?: string;
    profileName?: string;
    user?: string;
}

export interface IConnectionTileProperties extends IComponentProperties {
    entry?: ICdmConnectionEntry | ICdmConnectionGroupEntry;

    tileId: string;
    caption: string;
    description: string;
    type: ConnectionTileType;
    icon: string | Codicon;

    onAction?: (action: string, props: IConnectionTileProperties, options: ITileActionOptions) => void;
    onTileReorder?: (draggedTileId: number, props: unknown) => void;
}

export class ConnectionTile extends ComponentBase<IConnectionTileProperties> {

    private actionsRef = createRef<HTMLDivElement>();

    public constructor(props: IConnectionTileProperties) {
        super(props);

        this.addHandledProperties("tileId", "caption", "description", "type", "icon", "onAction", "onTileReorder");
        this.connectDragEvents();
    }

    public render(): ComponentChild {
        const { tileId, type, icon, caption, description } = this.props;

        const className = this.getEffectiveClassNames([
            "connectionTile",
            this.classFromProperty(type, ["", "createNew", "group", "back"]),
        ]);

        const actions = this.renderTileActionUI();

        return (
            <Button
                id={tileId}
                className={className}
                onClick={this.handleClick}
                onKeyPress={this.handleKeydown}
                {...this.unhandledProperties}
            >
                <Icon src={icon} />
                <Container
                    orientation={Orientation.TopDown}
                    className="textHost"
                >
                    <Label className="tileCaption">{caption}</Label>
                    <Label className="tileDescription">{description}</Label>
                </Container>
                {type === ConnectionTileType.Open && actions &&
                    <>
                        <Container id="actionsBackground" />
                        <Container
                            id="actions"
                            orientation={Orientation.TopDown}
                            mainAlignment={ContentAlignment.Center}
                            crossAlignment={ContentAlignment.Center}
                            innerRef={this.actionsRef}
                        >
                            {this.renderTileActionUI()}
                        </Container>
                    </>
                }
            </Button>
        );
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
                    <Icon src={Assets.toolbar.menuIcon} data-tooltip="inherit" />
                </Button>
                <Button
                    id="tileNewNotebookAction"
                    data-tooltip="Create New Notebook"
                    imageOnly
                    onClick={this.handleActionClick}
                >
                    <Icon src={Assets.misc.newNotebookIcon} data-tooltip="inherit" />
                </Button>
                <Button
                    id="tileNewScriptAction"
                    data-tooltip="Create New Script"
                    imageOnly
                    onClick={this.handleActionClick}
                >
                    <Icon src={Assets.misc.newScriptIcon} data-tooltip="inherit" />
                </Button>
            </>
        );
    };

    protected override handleDragEvent = (type: DragEventType, e: DragEvent): boolean => {
        if (!e.dataTransfer) {
            return false;
        }

        const element = e.currentTarget as HTMLElement;
        switch (type) {
            case DragEventType.Start: {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("browser/tile", element.id);

                return true;
            }

            case DragEventType.Enter: {
                e.stopPropagation();
                e.preventDefault();

                if (element.contains(e.relatedTarget as Node)) {
                    element.classList.add("dropTarget");
                }

                return true;
            }

            case DragEventType.Leave: {
                e.stopPropagation();
                e.preventDefault();

                if (!element.contains(e.relatedTarget as Node)) {
                    element.classList.remove("dropTarget");
                }

                return true;
            }

            case DragEventType.Drop: {
                element.classList.remove("dropTarget");

                const id = filterInt(e.dataTransfer.getData("browser/tile"));
                if (!isNaN(id)) {
                    const { onTileReorder } = this.props;
                    onTileReorder?.(id, this.props);
                }

                return true;
            }

            default: {
                return false;
            }
        }

    };

    private handleActionClick = (e: MouseEvent | KeyboardEvent): void => {
        const { onAction } = this.props;

        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).id;
        switch (id) {
            case "tileMoreActionsAction": {
                onAction?.("menu", this.props, { target: e.currentTarget as HTMLElement });

                break;
            }

            case "tileNewNotebookAction": {
                onAction?.("open", this.props, { newTab: e.metaKey || e.altKey, editor: "notebook" });

                break;
            }

            case "tileNewScriptAction": {
                onAction?.("open", this.props, { newTab: e.metaKey || e.altKey, editor: "script" });

                break;
            }

            default:
        }
    };

    private handleClick = (e: MouseEvent | KeyboardEvent): void => {
        const { onAction, type } = this.props;

        const event = e as MouseEvent;
        const button = event.currentTarget as HTMLButtonElement;

        // Have to prevent double clicks on browser tiles. But since everything is async there's no way to know
        // the action triggered by the tile is finished (or at least started, so the button is hidden).
        // Hence the only way to enable the button is to use a timer.
        button.disabled = true;
        setTimeout(() => {
            button.disabled = false;
        }, 200);
        e.stopPropagation();

        if (type === ConnectionTileType.Open) {
            onAction?.("open", this.props, { newTab: event.metaKey || event.altKey });
        } else {
            onAction?.(this.props.tileId === "-1" ? "new" : "", this.props, {});
        }
    };

    private handleKeydown = (e: KeyboardEvent): void => {
        if (e.key === KeyboardKeys.A) { // Unmodified A key.
            e.stopPropagation();
            const { type, onAction } = this.props;
            if (type === ConnectionTileType.Open) {
                this.actionsRef.current?.focus();
                onAction?.("menu", this.props, { target: this.actionsRef.current });
            }
        }
    };
}
