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

import "./TagInput.css";

import { ComponentChild, VNode } from "preact";

import { Assets } from "../../../supplement/Assets.js";
import { Button } from "../Button/Button.js";
import { ComponentBase, DragEventType, IComponentProperties } from "../Component/ComponentBase.js";
import { Container, ContentWrap, Orientation } from "../Container/Container.js";
import { IIconProperties, Icon } from "../Icon/Icon.js";
import { IImageProperties } from "../Image/Image.js";
import { Label } from "../Label/Label.js";

export interface ITag {
    id: string;
    caption?: string;
    picture?: VNode<IImageProperties | IIconProperties>;
}

/** A block of tags that can be dragged in/out and individually be deleted. */
export interface ITagInputProperties extends IComponentProperties {
    tags?: ITag[];
    removable?: boolean;
    orientation?: Orientation;

    innerRef?: preact.RefObject<HTMLDivElement>;

    canAdd?: (props: ITagInputProperties) => boolean;
    onAdd?: (id: string, props: ITagInputProperties) => void;
    onRemove?: (id: string, props: ITagInputProperties) => void;
}

export class TagInput extends ComponentBase<ITagInputProperties> {

    public constructor(props: ITagInputProperties) {
        super(props);

        this.addHandledProperties("tags", "removable", "onAdd", "onRemove", "orientation", "canAdd", "innerRef");
        this.connectDragEvents();
    }

    public render(): ComponentChild {
        const { tags, removable, innerRef, orientation, children } = this.props;
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
                        <Icon src={Assets.misc.closeIcon} />
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

    protected override handleDragEvent(type: DragEventType, e: DragEvent): boolean {
        const element = e.currentTarget as HTMLElement;
        switch (type) {
            case DragEventType.Start: {
                if (e.dataTransfer) {
                    e.dataTransfer.setData("text/tag", (e.target as HTMLElement).innerText);
                    e.dataTransfer.effectAllowed = "copy";
                }

                break;
            }

            case DragEventType.Over: {
                if (e.dataTransfer) {
                    const { canAdd } = this.props;

                    // Data is not available during drag-over, so we can only check if the expected type matches.
                    const items = e.dataTransfer.items;
                    let canAccept = false;
                    if (items.length === 1 && items[0].type === "text/tag") {
                        canAccept = canAdd?.(this.props) ?? true;
                    }
                    e.dataTransfer.dropEffect = canAccept ? "copy" : "none";
                    e.preventDefault();
                }

                break;
            }

            case DragEventType.Enter: {
                element.classList.add("dropTarget");
                break;
            }

            case DragEventType.Leave: {
                element.classList.remove("dropTarget");
                break;
            }

            case DragEventType.Drop: {
                // Usually one would check the actual drop effect here, but that is broken in Chrome.
                // So we can only rely on the check done on drag over (and could repeat it here)
                e.preventDefault();
                element.classList.remove("dropTarget");

                if (e.dataTransfer) {
                    // Do not add the new tag, but just tell the owner, to take action.
                    const { tags, onAdd } = this.props;
                    const value = e.dataTransfer.getData("text/tag");

                    if (!tags || tags.length === 0) {
                        onAdd?.(value, this.props);

                        break;
                    }

                    const index = tags?.findIndex((tag: ITag) => { return tag.caption === value; });
                    if (index === -1) {
                        onAdd?.(value, this.props);
                    }
                }

                break;
            }

            default: {
                break;
            }
        }

        return true;
    }

    private handleCloseButtonClick = (e: MouseEvent | KeyboardEvent, props: IComponentProperties): void => {
        const { onRemove } = this.props;

        // Button in the label makes the entire label act like a button (but we only want the button to act so).
        if ((e.target as HTMLElement).className === "msg icon") {
            e.stopPropagation();
            onRemove?.(props.id || "", this.props);
        }
    };

}
