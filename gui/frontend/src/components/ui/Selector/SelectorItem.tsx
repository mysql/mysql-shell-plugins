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

import { ComponentChild } from "preact";

import { ComponentBase, IComponentProperties, DragEventType } from "../Component/ComponentBase.js";
import { Codicon } from "../Codicon.js";
import { Orientation, Container, ContentAlignment } from "../Container/Container.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";

export interface ISelectorItemProperties extends IComponentProperties {
    selected?: boolean;
    disabled?: boolean;
    orientation?: Orientation;

    caption?: string;
    tooltip?: string;
    image?: string | Codicon;
    auxillary?: ComponentChild; // Any additional component, handled by the owner of the selector.
    // This is rendered end-aligned in the selector item container.

    type?: "normal" | "stepDown" | "stepUp" | "pageDown" | "pageUp";

    innerRef?: preact.RefObject<HTMLDivElement>;
}

export class SelectorItem extends ComponentBase<ISelectorItemProperties> {

    public static override defaultProps = {
        disabled: false,
        orientation: Orientation.LeftToRight,
        type: "normal",
    };

    private dragInsideCounter = 0; // When dragging over children we will receive multiple enter/leave events.

    public constructor(props: ISelectorItemProperties) {
        super(props);

        this.addHandledProperties("selected", "disabled", "orientation", "caption", "image", "auxillary", "type",
            "innerRef");
        if (props.draggable) {
            this.connectDragEvents();
        }
    }

    public render(): ComponentChild {
        const {
            selected, disabled, type, innerRef, orientation, image, caption, tooltip, auxillary,
        } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "selectorItem",
            this.classFromProperty(selected, "selected"),
            this.classFromProperty(disabled, "disabled"),
            this.classFromProperty(auxillary != null, "hasAuxillary"),
            type,
        ]);

        return (
            <Container
                innerRef={innerRef}
                className={className}
                orientation={orientation}
                mainAlignment={ContentAlignment.Center}
                crossAlignment={ContentAlignment.Center}
                data-tooltip={tooltip}

                {...this.unhandledProperties}
            >
                {image && <Icon src={image} data-tooltip="inherit" />}
                {caption && <Label data-tooltip="inherit">{caption}</Label>}
                {auxillary && <span id="auxillary">{auxillary}</span>}
            </Container>
        );
    }

    protected override handleDragEvent(type: DragEventType, e: DragEvent): boolean {
        const element = e.currentTarget as HTMLElement;
        switch (type) {
            case DragEventType.Start: {
                e.dataTransfer?.setData("sourceid", (e.target as HTMLElement).id);
                e.stopPropagation();

                break;
            }

            case DragEventType.Over: {
                e.preventDefault();
                break;
            }

            case DragEventType.Enter: {
                if (this.dragInsideCounter === 0) {
                    element.classList.add("dropTarget");
                }
                ++this.dragInsideCounter;
                e.stopPropagation();

                break;
            }

            case DragEventType.Leave: {
                --this.dragInsideCounter;
                if (this.dragInsideCounter === 0) {
                    element.classList.remove("dropTarget");
                }
                e.stopPropagation();

                break;
            }

            case DragEventType.Drop: {
                this.dragInsideCounter = 0;
                element.classList.remove("dropTarget");
                e.stopPropagation();
                e.preventDefault();

                break;
            }

            default: {
                break;
            }
        }

        return true;
    }

}
