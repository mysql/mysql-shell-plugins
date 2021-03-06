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

import "./TagInput.css";
import closeButton from "../../../assets/images/close.svg";

import React from "react";

import {
    IComponentProperties, Component, Label, Container, Icon, Image, Button, DragEventType, Orientation, ContentWrap,
} from "..";

export interface ITag {
    id: string;
    caption?: string;
    picture?: React.ReactElement<Icon> | React.ReactElement<Image>;
}

// A block of tags that can be dragged in/out and individually be deleted.
export interface ITagInputProperties extends IComponentProperties {
    tags?: ITag[];
    removable?: boolean;
    orientation?: Orientation;

    innerRef?: React.RefObject<HTMLElement>;

    // No data id is available during drag over, so we cannot base a decision on that.
    canAdd?: (props: ITagInputProperties) => boolean;
    onAdd?: (id: string, props: ITagInputProperties) => void;
    onRemove?: (id: string, props: ITagInputProperties) => void;
}

export class TagInput extends Component<ITagInputProperties> {

    public constructor(props: ITagInputProperties) {
        super(props);

        this.addHandledProperties("tags", "removable", "onAdd", "onRemove", "orientation", "canAdd", "innerRef");
        this.connectDragEvents();
    }

    public render(): React.ReactNode {
        const { tags, removable, innerRef, orientation, children } = this.mergedProps;
        const className = this.getEffectiveClassNames(["tagInput"]);

        const content = tags?.map((tag: ITag) => {
            return <Label
                key={tag.id}
                className="tag"
                draggable
            >
                {tag.caption}
                {removable &&
                    <Button
                        id={tag.id}
                        onClick={this.handleCloseButtonClick}
                    >
                        <Icon as="span" src={closeButton} />
                    </Button>
                }
            </Label>;
        });

        return (
            <Container
                innerRef={innerRef}
                className={className}
                orientation={orientation}
                wrap={ContentWrap.Wrap}
                {...this.unhandledProperties}
            >
                {content}
                {children}
            </Container>
        );
    }

    protected handleDragEvent(type: DragEventType, e: React.DragEvent<HTMLElement>): boolean {
        switch (type) {
            case DragEventType.Start: {
                e.dataTransfer.setData("text/tag", (e.target as HTMLElement).innerText);
                e.dataTransfer.effectAllowed = "copy";

                break;
            }

            case DragEventType.Over: {
                if (e.dataTransfer) {
                    const { canAdd } = this.mergedProps;

                    // Data is not available during drag-over, so we can only check if the expected type matches.
                    const items = e.dataTransfer.items;
                    let canAccept = false;
                    if (items.length === 1 && items[0].type === "text/tag") {
                        canAccept = canAdd?.(this.mergedProps) ?? true;
                    }
                    e.dataTransfer.dropEffect = canAccept ? "copy" : "none";
                    e.preventDefault();
                }

                break;
            }

            case DragEventType.Enter: {
                e.currentTarget.classList.add("dropTarget");
                break;
            }

            case DragEventType.Leave: {
                e.currentTarget.classList.remove("dropTarget");
                break;
            }

            case DragEventType.Drop: {
                // Usually one would check the actual drop effect here, but that is broken in Chrome.
                // So we can only rely on the check done on drag over (and could repeat it here)
                e.preventDefault();
                e.currentTarget.classList.remove("dropTarget");

                // Do not add the new tag, but just tell the owner, to take action.
                const { tags, onAdd } = this.mergedProps;
                const value = e.dataTransfer.getData("text/tag");

                if (!tags || tags.length === 0) {
                    onAdd?.(value, this.mergedProps);

                    break;
                }

                const index = tags?.findIndex((tag: ITag) => { return tag.caption === value; });
                if (index === -1) {
                    onAdd?.(value, this.mergedProps);
                }

                break;
            }

            default: {
                break;
            }
        }

        return true;
    }

    private handleCloseButtonClick = (e: React.SyntheticEvent, props: IComponentProperties): void => {
        const { onRemove } = this.mergedProps;

        // Button in the label makes the entire label act like a button (but we only want the button to act so).
        if ((e.target as HTMLElement).className === "msg icon") {
            e.stopPropagation();
            onRemove?.(props.id || "", this.mergedProps);
        }
    };

}
