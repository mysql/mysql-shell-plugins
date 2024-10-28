/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import "./BrowserTile.css";

import { ComponentChild, createRef } from "preact";

import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { filterInt } from "../../../utilities/string-helpers.js";
import { IComponentProperties, ComponentBase, DragEventType } from "../Component/ComponentBase.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";
import { Button } from "../Button/Button.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

export enum BrowserTileType {
    Open,
    CreateNew,
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
}

export interface IBrowserTileProperties extends IComponentProperties {
    innerRef?: preact.RefObject<HTMLDivElement>;

    tileId: number;
    caption: string;
    description: string;
    type: BrowserTileType;
    icon: string;

    onAction?: (action: string, props: IBrowserTileProperties, options: ITileActionOptions) => void;
    onTileReorder?: (draggedTileId: number, props: unknown) => void;
}

export abstract class BrowserTile<P extends IBrowserTileProperties> extends ComponentBase<P> {

    private actionsRef = createRef<HTMLDivElement>();

    protected abstract renderTileActionUI: () => ComponentChild;

    public constructor(props: P) {
        super(props);

        this.addHandledProperties("innerRef", "tileId", "caption", "description", "type", "icon", "onAction",
            "onTileReorder");
        this.connectDragEvents();
    }

    public render(): ComponentChild {
        const { innerRef, tileId, type, icon, caption, description } = this.props;

        const className = this.getEffectiveClassNames([
            "browserTile",
            this.classFromProperty(type === BrowserTileType.CreateNew, "secondary"),
        ]);

        return (
            <Button
                innerRef={innerRef}
                id={String(tileId)}
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

        if (type === BrowserTileType.Open) {
            onAction?.("open", this.props, { newTab: event.metaKey || event.altKey });
        } else {
            onAction?.("new", this.props, {});
        }
    };

    private handleKeydown = (e: KeyboardEvent): void => {
        if (e.key === KeyboardKeys.A) { // Unmodified A key.
            e.stopPropagation();
            const { type, onAction } = this.props;
            if (type === BrowserTileType.Open) {
                this.actionsRef.current?.focus();
                onAction?.("menu", this.props, { target: this.actionsRef.current });
            }
        }
    };
}
