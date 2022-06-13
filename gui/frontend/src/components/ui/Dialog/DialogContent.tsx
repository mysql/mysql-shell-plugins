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

import closeButton from "../../../assets/images/close2.svg";

import React from "react";
import { isNil } from "lodash";

import { Component, IComponentProperties, IDialogActions, Container, Orientation, Icon, Button } from "..";

export interface IDialogContentProperties extends IComponentProperties {
    content?: React.ReactNode;
    header?: React.ReactNode;
    caption?: React.ReactNode;
    actions?: IDialogActions;

    onCloseClick?: () => void;
}

// This component is the separated-out content for a dialog, but can be rendered anywhere.
export class DialogContent extends Component<IDialogContentProperties> {

    public constructor(props: IDialogContentProperties) {
        super(props);

        this.addHandledProperties("content", "header", "caption", "actions", "onCloseClick");
    }

    public render(): React.ReactNode {
        const { children, content, header, caption, actions } = this.mergedProps;
        const className = this.getEffectiveClassNames(["dialog", "visible"]);

        let dialogContent;
        if (!isNil(children)) {
            dialogContent = children;
        } else {
            dialogContent = (
                <>
                    {caption && <div className="title verticalCenterContent">
                        {caption}
                        <Button id="closeButton"
                            imageOnly
                            onClick={this.handleCloseClick}
                        >
                            <Icon src={closeButton} />
                        </Button>
                    </div>
                    }
                    {header && <div className="header">{header}</div>}
                    {content && <div className="content fixedScrollbar">{content}</div>}
                    {actions &&
                        <div className="footer verticalCenterContent">
                            <Container
                                className="leftItems"
                                orientation={Orientation.LeftToRight}
                            >
                                {actions?.begin}
                            </Container>
                            <Container
                                className="rightItems"
                                orientation={Orientation.RightToLeft}
                            >
                                {actions?.end}
                            </Container>

                        </div>}
                </>
            );
        }

        return (
            <div
                className={className}
                {...this.unhandledProperties}
            >
                {dialogContent}
            </div>
        );
    }

    private handleCloseClick = () => {
        const { onCloseClick } = this.props;

        onCloseClick?.();
    };
}
