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

import "./Button.css";

import React from "react";

import { Component, IComponentProperties, MouseEventType } from "../Component/Component";
import { Orientation } from "../Container/Container";
import { IRequestTypeMap, requisitions } from "../../../supplement/Requisitions";

export interface IButtonProperties extends IComponentProperties {
    innerRef?: React.RefObject<HTMLButtonElement>;

    caption?: string;
    round?: boolean;
    orientation?: Orientation;
    imageOnly?: boolean;       // When set the button gets no min width or extra padding.
    isDefault?: boolean;         // If set this button gets the initial focus.

    // Buttons can automatically trigger requests, if no parameter is required.
    requestType?: keyof IRequestTypeMap;

    focusOnClick?: boolean;
}

export class Button extends Component<IButtonProperties> {

    private buttonRef: React.RefObject<HTMLButtonElement>;

    public constructor(props: IButtonProperties) {
        super(props);

        this.addHandledProperties("innerRef", "round", "style", "orientation", "imageOnly", "isDefault", "requestType",
            "commandParams", "focusOnClick");

        if (props.requestType) {
            this.connectEvents("onClick");
        }
        this.connectEvents("onMouseDown");

        this.buttonRef = props.innerRef ?? React.createRef<HTMLButtonElement>();
    }

    public componentDidMount(): void {
        const { isDefault } = this.props;
        if (isDefault && this.buttonRef?.current) {
            this.buttonRef.current.focus();
        }
    }

    public render(): React.ReactNode {
        const { children, caption, style, orientation, round, imageOnly } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "button",
            this.classFromProperty(round, "round"),
            this.classFromProperty(imageOnly, "imageOnly"),
        ]);

        const content = children ?? caption;
        const newStyle = {
            ...style,
            flexDirection: orientation,
        };

        return (
            <button
                ref={this.buttonRef}
                style={newStyle}
                className={className}
                {...this.unhandledProperties}
            >
                {content}
            </button >
        );
    }

    protected handleMouseEvent(type: MouseEventType, e: React.MouseEvent): boolean {
        switch (type) {
            case MouseEventType.Down: {
                const { focusOnClick } = this.mergedProps;
                if (!focusOnClick) {
                    e.preventDefault();
                } else {
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
}
