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

import "./Button.css";

import { ComponentChild, createRef } from "preact";

import { ComponentBase, DragEventType, IComponentProperties, MouseEventType } from "../Component/ComponentBase";
import { Orientation } from "../Container/Container";
import { IRequestTypeMap, requisitions } from "../../../supplement/Requisitions";

export interface IButtonProperties extends IComponentProperties {
    innerRef?: preact.RefObject<HTMLDivElement>;

    caption?: string;
    round?: boolean;
    orientation?: Orientation;

    /** When set the button gets no min width or extra padding. */
    imageOnly?: boolean;

    /** If set this button gets the initial focus. */
    isDefault?: boolean;

    /** Buttons can automatically trigger requests, if no parameter is required. */
    requestType?: keyof IRequestTypeMap;

    focusOnClick?: boolean;
}

export class Button extends ComponentBase<IButtonProperties> {

    private buttonRef: preact.RefObject<HTMLDivElement>;
    private dragInsideCounter = 0;

    public constructor(props: IButtonProperties) {
        super(props);

        // Have to handle the `disabled` property manually because we have to disable a div instead of a button element.
        this.addHandledProperties("innerRef", "round", "orientation", "imageOnly", "isDefault", "requestType",
            "disabled", "focusOnClick");

        if (props.requestType) {
            this.connectEvents("onClick");
        }
        this.connectEvents("onMouseDown");

        if (props.draggable) {
            this.connectDragEvents();
        }

        this.buttonRef = props.innerRef ?? createRef<HTMLDivElement>();
    }

    public componentDidMount(): void {
        const { isDefault } = this.props;
        if (isDefault && this.buttonRef?.current) {
            this.buttonRef.current.focus();
        }
    }

    public render(): ComponentChild {
        const { children, caption, style, orientation, round, imageOnly, disabled } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "button",
            this.classFromProperty(round, "round"),
            this.classFromProperty(imageOnly, "imageOnly"),
            this.classFromProperty(disabled, "disabled"),
        ]);

        const content = children ?? caption;
        const newStyle = {
            ...style,
            flexDirection: orientation,
        };

        return (
            // Using a div here instead of a button because we want to be able to not allow focus
            // but still be able to drag the button.
            <div
                ref={this.buttonRef}
                style={newStyle}
                className={className}
                tabIndex={0}
                draggable
                role="button"
                {...this.unhandledProperties}
            >
                {content}
            </div >
        );
    }

    protected handleMouseEvent(type: MouseEventType): boolean {
        switch (type) {
            case MouseEventType.Down: {
                const { focusOnClick } = this.mergedProps;
                if (focusOnClick) {
                    this.buttonRef?.current?.focus();
                }

                break;
            }

            case MouseEventType.Click: {
                const { requestType: requestId } = this.mergedProps;
                if (requestId) {
                    void requisitions.execute(requestId, undefined);

                    return false;
                }

                break;
            }

            default: {
                /* istanbul ignore next */
                break;
            }
        }

        return true;
    }

    protected handleDragEvent(type: DragEventType, e: DragEvent): boolean {
        const element = e.currentTarget as HTMLElement;
        if (!e.dataTransfer) {
            return true;
        }

        switch (type) {
            case DragEventType.Start: {
                e.dataTransfer.setData(`sourceid:${(e.target as HTMLElement).id}`, "");
                e.dataTransfer.effectAllowed = "move";
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
