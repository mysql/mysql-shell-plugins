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

import "./Divider.css";

import React from "react";

import { Component, IComponentProperties, MouseEventType } from "../Component/Component";

interface IDividerProperties extends IComponentProperties {
    vertical?: boolean;
    thickness?: number;

    innerRef?: React.RefObject<HTMLDivElement>;

    // data-text is supported to set a title on the divider.
}

export class Divider extends Component<IDividerProperties> {

    public static defaultProps = {
        vertical: false,
        thickness: 4,
    };

    private hoverTimer: ReturnType<typeof setTimeout> | null;

    public constructor(props: IDividerProperties) {
        super(props);

        this.addHandledProperties("vertical", "thickness", "innerRef");
        this.connectEvents("onMouseEnter", "onMouseLeave");
    }

    public render(): React.ReactNode {
        const { vertical, thickness, style, innerRef } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "divider",
            this.classFromProperty(vertical, ["horizontal", "vertical"]),
        ]);

        const newStyle = {
            ...style, ...{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "--thickness": `${(thickness ?? 4)}px`,
            },
        };

        return (
            <div
                ref={innerRef}
                className={className}
                style={newStyle}
                {...this.unhandledProperties}
            >
            </div>
        );
    }

    protected handleMouseEvent(type: MouseEventType, e: React.MouseEvent): boolean {
        switch (type) {
            case MouseEventType.Enter: {
                if (this.hoverTimer) {
                    clearTimeout(this.hoverTimer);
                }
                this.hoverTimer = setTimeout(() => {
                    (e.target as Element).classList.add("hover");
                    this.hoverTimer = null;
                }, 300);

                break;
            }

            case MouseEventType.Leave: {
                if (this.hoverTimer) {
                    clearTimeout(this.hoverTimer);
                    this.hoverTimer = null;
                }

                (e.target as Element).classList.remove("hover");

                break;
            }

            default:
        }

        return true;
    }
}
