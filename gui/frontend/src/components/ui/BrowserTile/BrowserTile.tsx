/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import "./BrowserTile.css";

import * as React from "react";
import keyboardKey from "keyboard-key";

import {
    Component, IComponentProperties, Button, Label, Icon, Container, Orientation, DragEventType,
} from "..";
import { ContentAlignment } from "../Container/Container";
import { filterInt } from "../../../utilities/string-helpers";

export enum BrowserTileType {
    Open,
    CreateNew,
}

export interface IBrowserTileProperties extends IComponentProperties {
    innerRef?: React.RefObject<HTMLButtonElement>;

    tileId: number;
    caption: string;
    description: string;
    type: BrowserTileType;
    icon: string;

    onAction?: (action: string, props: IBrowserTileProperties, options: unknown) => void;
    onTileReorder?: (draggedTileId: number, props: unknown) => void;
}

export abstract class BrowserTile<P extends IBrowserTileProperties> extends Component<P> {

    private actionsRef = React.createRef<HTMLElement>();

    protected abstract renderTileActionUI: () => React.ReactNode;

    public constructor(props: P) {
        super(props);

        this.addHandledProperties("innerRef", "tileId", "caption", "description", "type", "icon", "onAction",
            "onTileReorder");
        this.connectDragEvents();
    }

    public render(): React.ReactNode {
        const { innerRef, tileId, type, icon, caption, description } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "browserTile",
            this.classFromProperty(type === BrowserTileType.CreateNew, "secondary"),
        ]);

        return (
            <Button
                innerRef={innerRef}
                id={tileId.toString()}
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
                {type === BrowserTileType.Open &&
                    <Container
                        id="actions"
                        orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.Center}
                        crossAlignment={ContentAlignment.Center}
                        innerRef={this.actionsRef}
                    >
                        {this.renderTileActionUI()}
                    </Container>
                }
            </Button>
        );
    }

    protected handleDragEvent = (type: DragEventType, e: React.DragEvent<HTMLElement>): boolean => {
        switch (type) {
            case DragEventType.Start: {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("browser/tile", e.currentTarget.id);

                return true;
            }

            case DragEventType.Enter: {
                e.stopPropagation();
                e.preventDefault();

                if (e.currentTarget.contains(e.relatedTarget as Node)) {
                    e.currentTarget.classList.add("dropTarget");
                }

                return true;
            }

            case DragEventType.Leave: {
                e.stopPropagation();
                e.preventDefault();

                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    e.currentTarget.classList.remove("dropTarget");
                }

                return true;
            }

            case DragEventType.Drop: {
                e.currentTarget.classList.remove("dropTarget");

                const id = filterInt(e.dataTransfer.getData("browser/tile"));
                if (!isNaN(id)) {
                    const { onTileReorder } = this.mergedProps;
                    onTileReorder?.(id, this.mergedProps);
                }

                return true;
            }

            default: {
                return false;
            }
        }

    };

    private handleClick = (e: React.SyntheticEvent): void => {
        const { onAction, type } = this.mergedProps;

        const event = e as React.MouseEvent;
        const button = event.currentTarget as HTMLButtonElement;

        // Have to prevent double clicks on browser tiles. But since everything is async there's no way to know
        // the action triggered by the tile is finished (or at least started, so the button is hidden).
        // Hence the only way to enable the button is to use a timer.
        button.disabled = true;
        setTimeout(() => {
            button.disabled = false;
        }, 200);
        e.stopPropagation();

        if (type === BrowserTileType.Open) {
            onAction?.("open", this.mergedProps, { newTab: event.metaKey || event.altKey });
        } else {
            onAction?.("new", this.mergedProps, {});
        }
    };

    private handleKeydown = (e: React.KeyboardEvent): void => {
        if (keyboardKey.getCode(e) === 97) { // Unmodified A key.
            e.stopPropagation();
            const { type, onAction } = this.mergedProps;
            if (type === BrowserTileType.Open) {
                this.actionsRef.current?.focus();
                onAction?.("menu", this.mergedProps, { target: this.actionsRef.current });
            }
        }
    };
}
