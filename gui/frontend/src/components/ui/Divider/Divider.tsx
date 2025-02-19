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

import "./Divider.css";

import { ComponentChild } from "preact";

import { ComponentBase, IComponentProperties, MouseEventType } from "../Component/ComponentBase.js";

interface IDividerProperties extends IComponentProperties {
    vertical?: boolean;
    thickness?: number;

    innerRef?: preact.RefObject<HTMLDivElement>;

    // data-text is supported to set a title on the divider.
}

export class Divider extends ComponentBase<IDividerProperties> {

    public static override defaultProps = {
        vertical: false,
        thickness: 4,
    };

    private hoverTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(props: IDividerProperties) {
        super(props);

        this.addHandledProperties("vertical", "thickness", "innerRef", "style");
        this.connectEvents("onMouseEnter", "onMouseLeave");
    }

    public render(): ComponentChild {
        const { vertical, thickness, style, innerRef } = this.props;

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

    protected override handleMouseEvent(type: MouseEventType, e: MouseEvent): boolean {
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
